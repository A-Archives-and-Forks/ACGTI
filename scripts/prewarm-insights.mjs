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
//   node scripts/prewarm-insights.mjs --concurrency 2,10     # 按通道设并发（aigw,aigw2）
//
// 双通道：.dev.vars 同时配置 AIGW_API_KEY 与 AIGW2_API_KEY 时，任务按各通道
// 并发比例分流（两通道模型同名 step-3.7-flash，缓存键互通）。2026-08 实测：
//   aigw  = saurlax 网关，有效并发 ≈2（超发只排队不报错，吞吐反而下降）
//   aigw2 = stepfun 官方，并发 ≥32 无劣化，默认取 10 留余量
//
// 默认桶组合：bucket 顺序为 ei,sn,tf,jp（0 轻微 / 1 中等 / 2 明显），
// 依据反馈数据中维度得分多集中于 0.3-0.7 的分布，取常见强度组合；
// 全量 113 角色 × 4 语言 × 5 桶 ≈ 2260 条，双通道合计并发 12 时约 40 分钟。
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const BASE = 'http://127.0.0.1:8788'
const DEV_VARS = '.dev.vars'
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
const concRaw = flagValue('--concurrency')

// 探测 .dev.vars 里已配置的网关通道（与服务端 gatewayChannels 对应）
function detectChannels() {
  let vars = ''
  try {
    vars = readFileSync(DEV_VARS, 'utf-8')
  } catch {}
  const list = []
  if (/^AIGW_API_KEY\s*=\s*\S/m.test(vars)) list.push('aigw')
  if (/^AIGW2_API_KEY\s*=\s*\S/m.test(vars)) list.push('aigw2')
  return list
}

// 各通道并发：默认取实测安全值；--concurrency 传 N 全通道同值、传 N1,N2 按通道。
// 上限 32：stepfun 官方实测 32 并发无劣化；saurlax 只能吃 2（超发纯排队）
const DEFAULT_CONCURRENCY = { aigw: 2, aigw2: 10 }
function parseConcurrency(channels) {
  const parts = (concRaw || '').split(',').filter((s) => s.trim() !== '').map(Number)
  return Object.fromEntries(
    channels.map((c, i) => [c, Math.max(1, Math.min(32, parts[i] ?? parts[0] ?? DEFAULT_CONCURRENCY[c]))]),
  )
}

// 桶值（0/1/2）映射回维度分（取桶的中位幅度）
const BUCKET_SCORE = { 0: 0.1, 1: 0.35, 2: 0.7 }

const characters = JSON.parse(readFileSync('src/data/characters.json', 'utf-8'))
  .filter((c) => c && c.id && (!charactersFilter || charactersFilter.split(',').includes(c.id)))
console.log(`角色 ${characters.length} 个 × 语言 ${langs.length} 种 × 桶 ${buckets.length} 组 = ${characters.length * langs.length * buckets.length} 条`)

const channels = detectChannels()
const conc = parseConcurrency(channels)
const totalConc = channels.reduce((s, c) => s + conc[c], 0)

if (dryRun) {
  console.log('计划（--dry-run，不执行）：')
  console.log(`  语言: ${langs.join(', ')}`)
  console.log(`  桶: ${buckets.join(', ')}（ei,sn,tf,jp 顺序；0 轻微/1 中等/2 明显）`)
  console.log(
    `  通道: ${channels.length ? channels.map((c) => `${c}×${conc[c]}`).join(' + ') : '无（.dev.vars 未配置网关 key）'}`,
  )
  console.log(`  预计耗时 ≈ 条数 × 9s ÷ ${totalConc || 1}`)
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

// ── 预热（按通道分队列，各自并发 worker 池）──
const tasks = []
for (const lang of langs) {
  for (const character of characters) {
    for (const bucket of buckets) {
      tasks.push({ lang, character, bucket })
    }
  }
}

// 任务按通道并发比例轮转分配：每 total 个任务里按 conc 比例切段，
// 两池以匹配的速率消费，避免慢通道（saurlax）积压拖尾
const queues = Object.fromEntries(channels.map((c) => [c, []]))
if (channels.length > 0) {
  const total = totalConc
  tasks.forEach((task, i) => {
    let idx = 0
    let sum = 0
    const pos = (i % total) + 1
    while (idx < channels.length - 1 && sum + conc[channels[idx]] < pos) {
      sum += conc[channels[idx]]
      idx++
    }
    queues[channels[idx]].push(task)
  })
} else {
  // 无网关通道（REST/AI binding 模式）：单池跑，provider 留空走服务端默认
  queues.default = tasks
  channels.push('default')
  conc.default = 4
}

let ok = 0
let cached = 0
let failed = 0
let first = null
let retryQueue = []
const t0 = Date.now()

async function runTasks(queue, provider) {
  let cursor = 0
  async function worker() {
    // 取任务与推进游标之间没有 await，不会重复领取
    while (cursor < queue.length) {
      const { lang, character, bucket } = queue[cursor++]
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
      if (provider !== 'default') payload.provider = provider
      const label = `${character.id}/${lang}/${bucket}${provider !== 'default' ? `[${provider}]` : ''}`
      try {
        const resp = await fetch(BASE + '/api/insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(120000),
        })
        if (resp.status === 429) {
          console.warn(`\n  ⏳ ${label} 限流，等待 60s（.dev.vars 需配 ACGTI_INSIGHT_RATE_LIMIT）`)
          await new Promise((r) => setTimeout(r, 60000))
          retryQueue.push({ task: { lang, character, bucket }, provider })
          continue
        }
        const data = await resp.json()
        if (data?.available) {
          data.cached ? cached++ : ok++
          if (!first && !data.cached) first = data.text
          process.stdout.write(`\r  进度 ${ok + cached + failed}/${tasks.length} | 生成 ${ok} | 命中 ${cached} | 失败 ${failed}        `)
        } else {
          retryQueue.push({ task: { lang, character, bucket }, provider })
          console.error(`\n  ↻ ${label} -> ${data?.reason ?? resp.status}（稍后补跑）`)
        }
      } catch (err) {
        retryQueue.push({ task: { lang, character, bucket }, provider })
        console.error(`\n  ↻ ${label} -> ${err.message}（稍后补跑）`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(conc[provider], queue.length || 1) }, () => worker()))
}

await Promise.all(channels.map((c) => runTasks(queues[c], c)))

// 补跑一轮：偶发失败多来自热重载窗口或网络抖动，重跑幂等（已缓存的直接命中）
if (retryQueue.length) {
  const byProvider = {}
  for (const { task, provider } of retryQueue) (byProvider[provider] ??= []).push(task)
  console.log(`\n补跑失败任务 ${retryQueue.length} 条…`)
  retryQueue = []
  await Promise.all(Object.entries(byProvider).map(([p, list]) => runTasks(list, p)))
  // 补跑后仍留在 retryQueue 里的才计入失败
  failed += retryQueue.length
  for (const { task, provider } of retryQueue) {
    console.error(`  ✗ ${task.character.id}/${task.lang}/${task.bucket}[${provider}] 补跑仍失败`)
  }
}

const minutes = ((Date.now() - t0) / 60000).toFixed(1)
console.log(`\n预热完成（${minutes} 分钟，通道 ${channels.map((c) => `${c}×${conc[c]}`).join(' + ')}）：新生成 ${ok}，已缓存 ${cached}，失败 ${failed}`)
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
