#!/usr/bin/env node

/**
 * 角色数据校验脚本
 *
 * 支持两种模式：
 *   1. 校验 src/content/characters/*.json 源文件（优先）
 *   2. 若源文件不存在，回退到校验 src/data/characters.json
 *
 * 同时校验与 characterVisuals.json、i18n/characters.ts 的一致性。
 *
 * 用法：
 *   node scripts/validate-character-data.mjs
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── 合法值集合 ──────────────────────────────────────────────────────────────

const VALID_MBTI = new Set([
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
])

const VALID_ARCHETYPES = new Set([
  'luminous-lead',
  'icebound-observer',
  'oathbound-captain',
  'trickster-orbit',
  'gentle-healer',
  'shadow-strategist',
  'chaos-spark',
  'moonlit-guardian',
])

const VALID_DIMENSIONS = new Set([
  'expression', 'temperature', 'judgement', 'order', 'agency', 'aura',
])

const VALID_LOCALES = new Set(['zh-CN', 'zh-TW', 'en', 'ja'])

const VALID_PERSONA_BASIS_TYPES = new Set(['canon', 'fandom-impression'])
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low'])

// ── 工具函数 ────────────────────────────────────────────────────────────────

let errorCount = 0
let warningCount = 0

function error(msg) {
  console.error(`  ✗ ${msg}`)
  errorCount++
}

function warn(msg) {
  console.warn(`  ⚠ ${msg}`)
  warningCount++
}

function loadJSON(path) {
  const raw = readFileSync(resolve(ROOT, path), 'utf-8')
  return JSON.parse(raw)
}

// ── i18n 解析 ───────────────────────────────────────────────────────────────

function extractI18nBlock(varName) {
  const content = readFileSync(resolve(ROOT, 'src/i18n/characters.ts'), 'utf-8')
  const lines = content.split('\n')
  const result = {}

  let started = false
  let currentKey = null
  let currentEntries = {}

  for (const line of lines) {
    if (!started && line.includes(`const ${varName}`)) {
      started = true
      continue
    }
    if (!started) continue

    const keyMatch = line.match(/^\s*['"]([^'"]+)['"]\s*:\s*\{|^\s*([^\s'"{:]+)\s*:\s*\{/)
    if (keyMatch) {
      if (currentKey && Object.keys(currentEntries).length > 0) {
        result[currentKey] = currentEntries
      }
      currentKey = keyMatch[1] || keyMatch[2]
      currentEntries = {}
      continue
    }

    if (currentKey) {
      const localeMatch = line.match(/^\s*['"]?(zh-CN|zh-TW|en|ja)['"]?\s*:\s*['"]([^']*?)['"]/)
      if (localeMatch) {
        currentEntries[localeMatch[1]] = localeMatch[2]
      }
    }

    if (line.trim() === '},' || line.trim() === '}') {
      if (currentKey && Object.keys(currentEntries).length > 0) {
        result[currentKey] = currentEntries
      }
      currentKey = null
      currentEntries = {}
      if (line.trim() === '}') break
    }
  }

  return result
}

// ── 角色校验 ────────────────────────────────────────────────────────────────

function validateCharacter(char, prefix) {
  // 必填字段
  const requiredFields = ['id', 'name', 'series', 'matchCode', 'code', 'archetypeId', 'tags', 'note', 'vector']
  for (const field of requiredFields) {
    if (!char[field]) {
      error(`${prefix} 缺少必填字段: ${field}`)
    }
  }

  if (!char.id) return

  // matchCode 合法
  if (char.matchCode && !VALID_MBTI.has(char.matchCode)) {
    error(`${prefix} matchCode 不合法: ${char.matchCode}`)
  }

  // matchCodeFlex 合法
  if (Array.isArray(char.matchCodeFlex)) {
    for (const code of char.matchCodeFlex) {
      if (!VALID_MBTI.has(code)) {
        error(`${prefix} matchCodeFlex 条目不合法: ${code}`)
      }
    }
  }

  // archetypeId 合法
  if (char.archetypeId && !VALID_ARCHETYPES.has(char.archetypeId)) {
    error(`${prefix} archetypeId 不合法: ${char.archetypeId}`)
  }

  // vector 校验
  if (char.vector) {
    const vecKeys = Object.keys(char.vector)
    const missingDims = [...VALID_DIMENSIONS].filter(d => !vecKeys.includes(d))
    if (missingDims.length > 0) {
      error(`${prefix} vector 缺少维度: ${missingDims.join(', ')}`)
    }
    for (const [dim, val] of Object.entries(char.vector)) {
      if (!VALID_DIMENSIONS.has(dim)) {
        warn(`${prefix} vector 含未知维度: ${dim}`)
      }
      if (typeof val !== 'number' || val < -1 || val > 1) {
        error(`${prefix} vector.${dim} 值越界: ${val}（应在 [-1, 1]）`)
      }
    }
  }

  // matchWeight
  if (char.matchWeight !== undefined) {
    if (typeof char.matchWeight !== 'number' || char.matchWeight <= 0) {
      error(`${prefix} matchWeight 应为正数，当前: ${char.matchWeight}`)
    }
  }

  // personaBasis
  if (char.personaBasis) {
    if (!VALID_PERSONA_BASIS_TYPES.has(char.personaBasis.type)) {
      error(`${prefix} personaBasis.type 不合法: ${char.personaBasis.type}`)
    }
    if (!VALID_CONFIDENCE.has(char.personaBasis.confidence)) {
      error(`${prefix} personaBasis.confidence 不合法: ${char.personaBasis.confidence}`)
    }
    if (!char.personaBasis.label || !char.personaBasis.summary) {
      error(`${prefix} personaBasis 缺少 label 或 summary`)
    }
  }

  // signature
  if (char.signature?.uniqueAxes) {
    for (const dim of Object.keys(char.signature.uniqueAxes)) {
      if (!VALID_DIMENSIONS.has(dim)) {
        warn(`${prefix} signature.uniqueAxes 含未知维度: ${dim}`)
      }
    }
  }

  if (char.signature?.questionAffinity) {
    for (const qa of char.signature.questionAffinity) {
      if (!qa.questionId) {
        error(`${prefix} signature.questionAffinity 条目缺少 questionId`)
      }
      if (!['agree', 'disagree', 'neutral'].includes(qa.expected)) {
        error(`${prefix} signature.questionAffinity.expected 不合法: ${qa.expected}`)
      }
    }
  }

  // tags
  if (Array.isArray(char.tags) && char.tags.length === 0) {
    warn(`${prefix} tags 为空数组`)
  }

  // i18n 字符串缺陷：转义残留 / 以反斜杠结尾的截断串
  if (char._i18n) {
    for (const [block, value] of Object.entries(char._i18n)) {
      if (typeof value === 'string') {
        checkEscapedString(value, `${prefix} i18n.${block}`)
      } else if (value && typeof value === 'object') {
        for (const [locale, localeData] of Object.entries(value)) {
          if (typeof localeData === 'string') {
            checkEscapedString(localeData, `${prefix} i18n.${block}.${locale}`)
          } else if (localeData && typeof localeData === 'object') {
            for (const [field, fieldValue] of Object.entries(localeData)) {
              if (typeof fieldValue === 'string') {
                checkEscapedString(fieldValue, `${prefix} i18n.${block}.${locale}.${field}`)
              } else if (Array.isArray(fieldValue)) {
                fieldValue.forEach((item, idx) => {
                  if (typeof item === 'string') {
                    checkEscapedString(item, `${prefix} i18n.${block}.${locale}.${field}[${idx}]`)
                  }
                })
              }
            }
          }
        }
      }
    }
  }
}

/** 检测 JSON 解析后仍残留的转义符（历史批量脚本写坏的撇号/引号）与截断串 */
function checkEscapedString(value, prefix) {
  if (value.includes("\\'") || value.includes('\\"') || value.endsWith('\\')) {
    error(`${prefix} 含转义残留或截断: ${JSON.stringify(value.slice(0, 60))}...`)
  }
}

/** 角色签名的 questionAffinity 必须指向真实存在的题目，防止题库变更后静默失配 */
function validateQuestionAffinity(characters) {
  if (!existsSync(resolve(ROOT, 'src/data/questions.json'))) return
  const questions = loadJSON('src/data/questions.json')
  const questionIds = new Set(questions.map((q) => q.id))

  for (const char of characters) {
    for (const qa of char.signature?.questionAffinity ?? []) {
      if (qa.questionId && !questionIds.has(qa.questionId)) {
        error(`[${char.id}] signature.questionAffinity 引用了不存在的题目: ${qa.questionId}`)
      }
    }
  }
}

/** 图片资产校验：引用必存在、禁用 png 引用、public 目录不允许孤儿图片回潮 */
function validateImageAssets(visuals, characters, mode) {
  // source 模式以源文件 visual 为真源（聚合 characterVisuals.json 可能滞后于源文件）；
  // legacy 模式只能依赖聚合文件
  const refOf = (id) => {
    if (mode === 'source') {
      const char = characters.find((c) => c.id === id)
      return char?._visual ?? {}
    }
    return visuals[id] ?? {}
  }
  const referenced = new Set()
  const ids = mode === 'source'
    ? characters.map((c) => c.id)
    : Object.keys(visuals)
  for (const id of ids) {
    const v = refOf(id)
    for (const key of ['image', 'thumb']) {
      const p = v?.[key]
      if (!p) continue
      const rel = p.replace(/^\//, '')
      referenced.add(rel)
      const full = resolve(ROOT, 'public', rel)
      if (!existsSync(full)) {
        error(`[${id}] visual.${key} 引用的图片不存在: public/${rel}`)
      } else if (/\.png$/i.test(rel)) {
        warn(`[${id}] visual.${key} 引用了 png（线上统一使用 webp）: ${rel}`)
      }
    }
  }

  const imageRoot = resolve(ROOT, 'public/images/characters')
  if (!existsSync(imageRoot)) return
  const walk = (dir) => {
    const out = []
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        out.push(...walk(full))
      } else {
        out.push(relative(resolve(ROOT, 'public'), full).split('\\').join('/'))
      }
    }
    return out
  }
  for (const rel of walk(imageRoot)) {
    if (!referenced.has(rel)) {
      error(`public/${rel} 是未被任何角色引用的孤儿图片，请移出 public/（部署会全量带上它）`)
    }
  }
}

/** messages.ts 中的题目/角色数量常量必须与数据文件同步（首屏不静态导入 JSON 的代价） */
function validateMessageCountConstants(characterCount) {
  if (!existsSync(resolve(ROOT, 'src/data/questions.json'))) return
  const questions = loadJSON('src/data/questions.json')
  const messages = readFileSync(resolve(ROOT, 'src/i18n/messages.ts'), 'utf-8')

  const qMatch = messages.match(/const QUESTION_COUNT = '(\d+)'/)
  const cMatch = messages.match(/const CHARACTER_COUNT = '(\d+)'/)
  if (!qMatch) {
    error('messages.ts 中未找到 QUESTION_COUNT 常量（手工维护的题目数）')
  } else if (Number(qMatch[1]) !== questions.length) {
    error(`messages.ts QUESTION_COUNT=${qMatch[1]} 与 questions.json 实际题数 ${questions.length} 不一致`)
  }
  if (!cMatch) {
    error('messages.ts 中未找到 CHARACTER_COUNT 常量（手工维护的角色数）')
  } else if (Number(cMatch[1]) !== characterCount) {
    error(`messages.ts CHARACTER_COUNT=${cMatch[1]} 与实际角色数 ${characterCount} 不一致`)
  }
}

/** audit-reachability.mjs 的权重常量必须与 quizEngine.ts 保持同步，否则审计结果失真 */
function validateEngineWeightSync() {
  const auditPath = resolve(ROOT, 'scripts/audit-reachability.mjs')
  const enginePath = resolve(ROOT, 'src/utils/quizEngine.ts')
  if (!existsSync(auditPath) || !existsSync(enginePath)) return

  const readConsts = (content) => {
    const map = {}
    for (const m of content.matchAll(/(?:const|let)\s+(MBTI_WEIGHT|ARCHETYPE_WEIGHT|VECTOR_WEIGHT|CHARACTER_SPECIFIC_WEIGHT)\s*=\s*([\d.]+)/g)) {
      map[m[1]] = m[2]
    }
    return map
  }
  const audit = readConsts(readFileSync(auditPath, 'utf-8'))
  const engine = readConsts(readFileSync(enginePath, 'utf-8'))
  for (const key of Object.keys(engine)) {
    if (audit[key] === undefined) {
      warn(`audit-reachability.mjs 缺少权重常量 ${key}，审计口径可能与引擎不一致`)
    } else if (audit[key] !== engine[key]) {
      error(`audit-reachability.mjs 的 ${key}=${audit[key]} 与 quizEngine.ts 的 ${key}=${engine[key]} 不一致`)
    }
  }
}

/** 题目维度（四对轴）合法值，与 src/types/quiz.ts 的 DimensionPair 对齐 */
const VALID_PAIR_DIMENSIONS = new Set(['E_I', 'S_N', 'T_F', 'J_P'])

/** questions.json 自身结构校验：id 唯一、dimension 属于四对轴、sign 只能是 ±1 */
function validateQuestionsStructure() {
  const questionsPath = resolve(ROOT, 'src/data/questions.json')
  if (!existsSync(questionsPath)) return
  const questions = loadJSON('src/data/questions.json')

  const seenIds = new Set()
  for (const q of questions) {
    const prefix = `[题目 ${q.id ?? '???'}]`
    if (!q.id) {
      error(`${prefix} 缺少 id`)
      continue
    }
    if (seenIds.has(q.id)) {
      error(`${prefix} id 重复`)
    }
    seenIds.add(q.id)

    if (!VALID_PAIR_DIMENSIONS.has(q.dimension)) {
      error(`${prefix} dimension 不合法: ${q.dimension}（应为 E_I/S_N/T_F/J_P 之一）`)
    }
    if (q.sign !== 1 && q.sign !== -1) {
      error(`${prefix} sign 不合法: ${q.sign}（应为 1 或 -1）`)
    }
  }
}

/** 权重覆盖表引用的题目 id 必须真实存在，题库增删后覆盖表不允许静默失配 */
function validateDimensionWeightsReferences() {
  const weightsPath = resolve(ROOT, 'src/data/questionDimensionWeights.json')
  const questionsPath = resolve(ROOT, 'src/data/questions.json')
  if (!existsSync(weightsPath) || !existsSync(questionsPath)) return

  const weights = loadJSON('src/data/questionDimensionWeights.json')
  const questions = loadJSON('src/data/questions.json')
  const questionIds = new Set(questions.map((q) => q.id))

  for (const [qid, entry] of Object.entries(weights)) {
    if (!questionIds.has(qid)) {
      error(`questionDimensionWeights.json 引用了不存在的题目: ${qid}`)
      continue
    }
    // 覆盖表是"整体替换"语义：键必须是四对轴、值必须是有限数字
    for (const [dim, weight] of Object.entries(entry ?? {})) {
      if (!VALID_PAIR_DIMENSIONS.has(dim)) {
        error(`questionDimensionWeights.json[${qid}] 含非法维度键: ${dim}`)
      }
      if (typeof weight !== 'number' || !Number.isFinite(weight)) {
        error(`questionDimensionWeights.json[${qid}].${dim} 权重非法: ${weight}`)
      }
    }
  }
}

/** AI 解读档案的角色集合必须与 characters.json 完全一致（双向），缺条目或多条目都报错 */
function validateCharacterBriefSync() {
  const briefPath = resolve(ROOT, 'functions/api/_data/characterBrief.json')
  const charactersPath = resolve(ROOT, 'src/data/characters.json')
  if (!existsSync(briefPath) || !existsSync(charactersPath)) return

  const briefs = loadJSON('functions/api/_data/characterBrief.json')
  const characters = loadJSON('src/data/characters.json')
  const characterIds = new Set(characters.map((c) => c.id))
  const briefIds = new Set(Object.keys(briefs))

  for (const id of characterIds) {
    if (!briefIds.has(id)) {
      error(`characterBrief.json 缺少角色档案: ${id}（insight 端点会对该角色直接降级）`)
    }
  }
  for (const id of briefIds) {
    if (!characterIds.has(id)) {
      error(`characterBrief.json 含多余角色档案: ${id}（characters.json 中不存在该角色）`)
    }
  }
}

// ── 主逻辑 ──────────────────────────────────────────────────────────────────

function main() {
  console.log('\n📋 ACGTI 角色数据校验\n')

  const SOURCE_DIR = resolve(ROOT, 'src/content/characters')

  // 加载 visuals 和 i18n
  const visuals = loadJSON('src/data/characterVisuals.json')
  const nameI18n = extractI18nBlock('characterNameI18n')
  const seriesI18n = extractI18nBlock('seriesI18n')
  const visualIds = new Set(Object.keys(visuals))

  let characters = []
  let mode = ''

  // 优先从 src/content/characters/ 读取
  if (existsSync(SOURCE_DIR)) {
    const files = readdirSync(SOURCE_DIR).filter(f => f.endsWith('.json'))
    if (files.length > 0) {
      mode = 'source'
      for (const file of files) {
        const entry = JSON.parse(readFileSync(resolve(SOURCE_DIR, file), 'utf-8'))
        characters.push({ ...entry.meta, _visual: entry.visual, _i18n: entry.i18n })
      }
    }
  }

  // 回退到 src/data/characters.json
  if (mode !== 'source') {
    mode = 'legacy'
    characters = loadJSON('src/data/characters.json')
  }

  const characterIds = new Set()
  const characterCodes = new Map()
  const characterNames = new Map()

  console.log(`  模式: ${mode === 'source' ? '源文件 (src/content/characters/)' : '聚合文件 (src/data/characters.json)'}`)
  console.log(`  角色总数: ${characters.length}`)
  console.log(`  Visual 条目: ${visualIds.size}`)
  console.log(`  i18n 名称条目: ${Object.keys(nameI18n).length}`)
  console.log()

  for (const char of characters) {
    const prefix = `[${char.id || '???'}]`

    validateCharacter(char, prefix)

    if (!char.id) continue

    // id 唯一性
    if (characterIds.has(char.id)) {
      error(`${prefix} id 重复: ${char.id}`)
    }
    characterIds.add(char.id)

    // code 唯一性
    if (char.code) {
      if (characterCodes.has(char.code)) {
        error(`${prefix} code 重复: ${char.code}（与 ${characterCodes.get(char.code)} 冲突）`)
      }
      characterCodes.set(char.code, char.id)
    }

    // name 唯一性
    if (char.name) {
      if (characterNames.has(char.name)) {
        warn(`${prefix} name 重复: ${char.name}（与 ${characterNames.get(char.name)} 相同）`)
      }
      characterNames.set(char.name, char.id)
    }

    // visual 校验
    if (mode === 'source' && char._visual) {
      const v = char._visual
      if (!v.image) error(`${prefix} visual 缺少 image`)
      if (!v.accent) error(`${prefix} visual 缺少 accent`)
      if (v.accent && !/^#[0-9a-fA-F]{3,8}$/.test(v.accent)) {
        error(`${prefix} visual.accent 格式不合法: ${v.accent}`)
      }
    } else {
      if (!visualIds.has(char.id)) {
        warn(`${prefix} 在 characterVisuals.json 中无对应条目`)
      } else {
        const v = visuals[char.id]
        if (!v.image) error(`${prefix} visual 缺少 image`)
        if (!v.accent) error(`${prefix} visual 缺少 accent`)
        if (v.accent && !/^#[0-9a-fA-F]{3,8}$/.test(v.accent)) {
          error(`${prefix} visual.accent 格式不合法: ${v.accent}`)
        }
      }
    }

    // i18n 校验
    if (mode === 'source' && char._i18n) {
      if (!char._i18n.name || Object.keys(char._i18n.name).length === 0) {
        warn(`${prefix} 源文件中缺少 i18n.name 翻译`)
      }
      if (!char._i18n.series || Object.keys(char._i18n.series).length < VALID_LOCALES.size) {
        warn(`${prefix} 源文件中缺少或未覆盖四语的 i18n.series`)
      } else if (char.series && char._i18n.series['zh-CN'] && char._i18n.series['zh-CN'] !== char.series) {
        warn(`${prefix} i18n.series.zh-CN（${char._i18n.series['zh-CN']}）与 meta.series（${char.series}）不一致，运行时以 meta.series 为准`)
      }
      // title/note/tags 翻译完整性：构建脚本读取 i18n[locale] 的三块生成
      // characterMessages.json（ADR-0007 数据链路），缺失时对应语言回退中文。
      // 当前全量非隐藏角色均已补齐三语翻译，因此按 error 级把关；
      // 隐藏角色不对外展示，不做此要求
      for (const locale of ['zh-TW', 'en', 'ja']) {
        if (char.hidden) continue
        const localeData = char._i18n[locale]
        if (!localeData) {
          error(`${prefix} 源文件中缺少 i18n.${locale} 翻译（title/note/tags）`)
        } else {
          if (!localeData.title) error(`${prefix} 源文件中缺少 i18n.${locale}.title`)
          if (!localeData.note) error(`${prefix} 源文件中缺少 i18n.${locale}.note`)
          if (!localeData.tags) error(`${prefix} 源文件中缺少 i18n.${locale}.tags`)
        }
      }
    } else {
      if (!nameI18n[char.id]) {
        warn(`${prefix} 在 i18n/characters.ts 中无名称翻译`)
      }
    }
  }

  // 孤儿检测（仅 legacy 模式）
  if (mode === 'legacy') {
    for (const vid of visualIds) {
      if (!characterIds.has(vid)) {
        warn(`characterVisuals.json 中有孤儿条目: ${vid}（无对应角色）`)
      }
    }
    for (const iid of Object.keys(nameI18n)) {
      if (!characterIds.has(iid)) {
        warn(`i18n/characters.ts 中有孤儿条目: ${iid}（无对应角色）`)
      }
    }
  }

  validateQuestionAffinity(characters)
  validateImageAssets(visuals, characters, mode)
  validateMessageCountConstants(characters.length)
  validateEngineWeightSync()
  validateQuestionsStructure()
  validateDimensionWeightsReferences()
  validateCharacterBriefSync()

  // 汇总
  console.log()
  console.log('──────────────────────────────')
  if (errorCount === 0 && warningCount === 0) {
    console.log('✓ 所有校验通过，数据一致。')
  } else {
    console.log(`  错误: ${errorCount}`)
    console.log(`  警告: ${warningCount}`)
    if (errorCount > 0) {
      console.log('\n✗ 存在错误，请修复后重新校验。')
      process.exit(1)
    } else {
      console.log('\n⚠ 仅有警告，可以继续，但建议检查。')
    }
  }
  console.log()
}

main()
