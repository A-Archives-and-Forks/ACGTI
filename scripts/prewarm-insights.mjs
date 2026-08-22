#!/usr/bin/env node
// AI 解读缓存预热：上线前把高频画像灌进 ai_insight_cache，
// 避免首个命中用户等真实生成（推理模型约 9-15s）并平滑额度消耗。
//
// 原理：复用线上完整链路——对本地 dev:pages 服务发 /api/insight 请求，
// 提示词构造、输出清洗、分桶、缓存键全部走 functions 代码（零逻辑重复），
// 结果落在本地 D1；可选 --push 把新增缓存行批量写入远程 D1。
//
// 前提：
//   1. npm run build && npm run dev:pages 已启动（网关模式，见 scripts/dev-pages.mjs）
//   2. 预热会大量请求：先在 .dev.vars 加 ACGTI_INSIGHT_RATE_LIMIT=600 并重启 dev:pages
//
// 用法：
//   node scripts/prewarm-insights.mjs --dry-run              # 只列计划
//   node scripts/prewarm-insights.mjs                        # 本地预热（默认桶）
//   node scripts/prewarm-insights.mjs --push                 # 预热完成后写入远程 D1
//   node scripts/prewarm-insights.mjs --langs zh-CN,en --buckets 1111,2112
//
// 默认桶组合：bucket 顺序为 ei,sn,tf,jp（0 轻微 / 1 中等 / 2 明显），
// 依据反馈数据中维度得分多集中于 0.3-0.7 的分布，取常见强度组合；
// 全量 113 角色 × 4 语言 × 5 桶 ≈ 2260 条，网关串行约 6 小时——
// 建议按语言分批跑（--langs zh-CN 先行）。
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const BASE = 'http://127.0.0.1:8788'
const DEFAULT_LANGS = ['zh-CN', 'zh-TW', 'en', 'ja']
const DEFAULT_BUCKETS = ['1111', '2112', '1211', '1121', '1112']

// ── 参数解析 ──
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const push = args.includes('--push')
const flagValue = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : null
}
const langs = (flagValue('--langs') || DEFAULT_LANGS.join(',')).split(',')
const buckets = (flagValue('--buckets') || DEFAULT_BUCKETS.join(',')).split(',')
const charactersFilter = flagValue('--characters')

// 桶值（0/1/2）映射回维度分（取桶的中位幅度）
const BUCKET_SCORE = { 0: 0.1, 1: 0.35, 2: 0.7 }

const characters = JSON.parse(readFileSync('src/data/characters.json', 'utf-8'))
  .filter((c) => c && c.id && (!charactersFilter || charactersFilter.split(',').includes(c.id)))
console.log(`角色 ${characters.length} 个 × 语言 ${langs.length} 种 × 桶 ${buckets.length} 组 = ${characters.length * langs.length * buckets.length} 条`)

if (dryRun) {
  console.log('计划（--dry-run，不执行）：')
  console.log(`  语言: ${langs.join(', ')}`)
  console.log(`  桶: ${buckets.join(', ')}（ei,sn,tf,jp 顺序；0 轻微/1 中等/2 明显）`)
  console.log('  预计串行耗时 ≈ 条数 × 9s，请按语言分批执行')
  process.exit(0)
}

// ── 健康检查 ──
try {
  const resp = await fetch(BASE + '/api/ping', { signal: AbortSignal.timeout(3000) })
  if (!resp.ok) throw new Error(String(resp.status))
} catch {
  console.error('本地服务未启动：先 npm run build && npm run dev:pages（预热前在 .dev.vars 配置 ACGTI_INSIGHT_RATE_LIMIT=600）')
  process.exit(1)
}

// ── 预热 ──
let ok = 0
let cached = 0
let failed = 0
let first = null
const t0 = Date.now()

for (const lang of langs) {
  for (const character of characters) {
    for (const bucket of buckets) {
      const payload = {
        characterCode: character.id,
        lang,
        dimensionScores: {
          ei: BUCKET_SCORE[bucket[0]],
          sn: BUCKET_SCORE[bucket[1]],
          tf: BUCKET_SCORE[bucket[2]],
          jp: BUCKET_SCORE[bucket[3]],
        },
      }
      const label = `${character.id}/${lang}/${bucket}`
      try {
        const resp = await fetch(BASE + '/api/insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(120000),
        })
        if (resp.status === 429) {
          console.warn(`  ⏳ ${label} 限流，等待 60s（.dev.vars 需配 ACGTI_INSIGHT_RATE_LIMIT）`)
          await new Promise((r) => setTimeout(r, 60000))
          failed++
          continue
        }
        const data = await resp.json()
        if (data?.available) {
          data.cached ? cached++ : ok++
          if (!first && !data.cached) first = data.text
          process.stdout.write(`\r  生成 ${ok} | 命中 ${cached} | 失败 ${failed} | ${label}        `)
        } else {
          failed++
          console.error(`\n  ✗ ${label} -> ${data?.reason ?? resp.status}`)
        }
      } catch (err) {
        failed++
        console.error(`\n  ✗ ${label} -> ${err.message}`)
      }
    }
  }
}

const minutes = ((Date.now() - t0) / 60000).toFixed(1)
console.log(`\n预热完成（${minutes} 分钟）：新生成 ${ok}，已缓存 ${cached}，失败 ${failed}`)
if (first) console.log(`首条示例：${first.slice(0, 60)}…`)

// ── 可选：推送远程 D1 ──
if (push && ok > 0) {
  const rows = readLocalCacheRows()
  if (!rows.length) {
    console.error('未在本地 D1 读到缓存行（检查 .wrangler/state 下的 sqlite）')
    process.exit(1)
  }
  const sqlFile = 'tmp-prewarm-insights.sql'
  writeFileSync(sqlFile, buildInsertSql(rows), 'utf-8')
  console.log(`已生成 ${sqlFile}（${rows.length} 行），开始写入远程 D1…`)
  execSync(`npx wrangler d1 execute acgti-stats --remote --file ${sqlFile}`, { stdio: 'inherit' })
  console.log('远程写入完成（INSERT OR IGNORE，已有键不受影响）')
}

// 从本地 miniflare D1 读缓存表（经 wrangler，避免直接依赖 sqlite 驱动）
function readLocalCacheRows() {
  try {
    const out = execSync(
      'npx wrangler d1 execute acgti-stats --local --json --command "SELECT cache_key, text, model, lang FROM ai_insight_cache"',
      { encoding: 'utf-8', timeout: 60000, windowsHide: true },
    )
    const parsed = JSON.parse(out)
    return Array.isArray(parsed) ? (parsed[0]?.results ?? []) : (parsed?.result?.[0]?.results ?? [])
  } catch (err) {
    console.error('读取本地 D1 失败:', err.message)
    return []
  }
}

function sqlEscape(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function buildInsertSql(rows) {
  const lines = rows.map((r) =>
    `INSERT OR IGNORE INTO ai_insight_cache (cache_key, text, model, lang, hits, created_at, updated_at) VALUES (${sqlEscape(r.cache_key)}, ${sqlEscape(r.text)}, ${sqlEscape(r.model)}, ${sqlEscape(r.lang)}, 0, datetime('now'), datetime('now'));`)
  return lines.join('\n') + '\n'
}
