// /api/insight — AI 结果解读（Workers AI，渐进增强）
//
// 设计约束（见 docs/adr/0006-ai-insight-workers-ai.md）：
// - 隐私：请求只包含角色代码与四维倾向分，绝不接收逐题答案
// - 成本：以「角色 + 四维倾向分桶 + 语言」为键写 D1 缓存，相同画像
//   全站共享一次生成结果，Neurons 消耗与桶数（≤ 113 × 81 × 4）同阶
// - 降级：未绑定 AI / 额度耗尽 / 生成失败一律返回 available:false，
//   前端隐藏卡片，结果页静态解析文案不受影响
// - 一致性：低温度 + 提示词只允许改写仓库自有的角色档案，禁止引入
//   档案之外的作品名与人名，输出经截断清洗后落缓存

import briefs from './_data/characterBrief.json'
import { checkRateLimit, isValidCode, num, str } from './_shared'

type Env = { DB: D1Database; AI?: Ai }

const MODEL_ID = '@cf/meta/llama-3.2-3b-instruct'
// 单 IP 每分钟最多解读次数（生成路径比查询路径重，收紧到 10）
const INSIGHT_RATE_LIMIT = 10
const LANGUAGES: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
}

// 分桶阈值：|score| ≥ 0.5 记为明显倾向，≥ 0.2 记为中等，否则轻微
function bucketOf(score: number): number {
  const abs = Math.abs(score)
  return abs >= 0.5 ? 2 : abs >= 0.2 ? 1 : 0
}

function tendencyText(label: string, score: number): string {
  const strength = bucketOf(score) === 2 ? '明显' : bucketOf(score) === 1 ? '比较' : '略微'
  return `${strength}偏向${score >= 0 ? label.split('/')[0] : label.split('/')[1]}`
}

function buildPrompt(
  brief: { name: string; title: string; series: string; mbti: string; tags: string[] },
  scores: { ei: number; sn: number; tf: number; jp: number },
  langName: string,
) {
  const system = [
    `你是二次元人格测试 ACGTI 的结果文案助手，请为完成测试的用户写一段第二人称的结果解读。`,
    `要求：用${langName}书写；篇幅 60 到 110 字；只依据给定的角色档案和四维倾向组织内容，`,
    `禁止引入档案之外的作品名、人名、地名或设定；不使用引号、列表、标题；角色名最多出现一次；`,
    `语气温暖、具体、肯定。直接输出正文，不要任何前缀或说明。`,
  ].join('')

  const user = [
    `角色档案：${brief.name}（出自《${brief.series}》，称号「${brief.title}」，MBTI 倾向 ${brief.mbti}）。`,
    `特质标签：${brief.tags.join('、')}。`,
    `用户四维倾向：${tendencyText('外向/内向', scores.ei)}；${tendencyText('实感/直觉', scores.sn)}；${tendencyText('思考/情感', scores.tf)}；${tendencyText('计划/随性', scores.jp)}。`,
    `请围绕这些倾向与角色特质的呼应，写出面向用户的解读。`,
  ].join('')

  return { system, user }
}

// 输出清洗：去引号包裹与前缀，截断长文幻觉
function sanitizeInsight(raw: string): string {
  let text = raw.trim().replace(/^["'“”「『]|["'“”」』]$/g, '')
  text = text.replace(/^(解读|分析|结果)[:：]\s*/, '')
  if (text.length > 240) {
    const cut = text.slice(0, 240)
    const lastStop = Math.max(
      cut.lastIndexOf('。'), cut.lastIndexOf('！'), cut.lastIndexOf('？'),
      cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'),
    )
    text = lastStop > 60 ? cut.slice(0, lastStop + 1) : cut + '…'
  }
  return text
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export async function onRequestPost(context: { env: Env; request: Request }) {
  const { DB, AI } = context.env

  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown'
  const allowed = await checkRateLimit(DB, ip, INSIGHT_RATE_LIMIT)
  if (!allowed) {
    return json({ text: null, available: false, reason: 'rate-limited' }, 429)
  }

  let raw: any
  try {
    raw = await context.request.json()
  } catch {
    return json({ text: null, available: false, reason: 'bad-json' }, 400)
  }

  const characterId = str(raw.characterCode, 32)
  const lang = str(raw.lang, 8)
  // Object.hasOwn 防原型链键（toString 等）绕过白名单混入缓存键与提示词
  const langName = Object.hasOwn(LANGUAGES, lang) ? lang : 'zh-CN'

  const ds = raw.dimensionScores
  const ei = num(ds?.ei, -1, 1)
  const sn = num(ds?.sn, -1, 1)
  const tf = num(ds?.tf, -1, 1)
  const jp = num(ds?.jp, -1, 1)

  if (!isValidCode(characterId) || ei === null || sn === null || tf === null || jp === null) {
    return json({ text: null, available: false, reason: 'invalid-payload' }, 400)
  }

  const brief = (briefs as Record<string, { name: string; title: string; series: string; mbti: string; tags: string[] }>)[characterId]
  if (!brief) {
    return json({ text: null, available: false, reason: 'unknown-character' })
  }

  if (!AI) {
    // 未绑定 Workers AI（本地或未配置）：明确告知前端不可用，走静态降级
    return json({ text: null, available: false, reason: 'no-binding' })
  }

  const scores = { ei, sn, tf, jp }
  const cacheKey = `${characterId}:${langName}:${bucketOf(ei)}${bucketOf(sn)}${bucketOf(tf)}${bucketOf(jp)}`
  const wantFresh = raw.fresh === true

  // 缓存读取失败不阻塞生成路径
  if (!wantFresh) {
    try {
      const cached = await DB.prepare(
        'SELECT text FROM ai_insight_cache WHERE cache_key = ?'
      ).bind(cacheKey).first<{ text: string }>()

      if (cached?.text) {
        DB.prepare(
          'UPDATE ai_insight_cache SET hits = hits + 1, updated_at = ? WHERE cache_key = ?'
        ).bind(new Date().toISOString(), cacheKey).run()
        return json({ text: cached.text, cached: true, available: true })
      }
    } catch {
      // 缓存表可能不存在（迁移未执行），继续走生成
    }
  }

  const { system, user } = buildPrompt(brief, scores, LANGUAGES[langName])

  let generated: string
  try {
    const result = await AI.run(MODEL_ID, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 300,
      temperature: 0.2,
    })
    generated = typeof result === 'string' ? result : (result as { response?: string })?.response ?? ''
  } catch (err) {
    console.error('Insight generation error:', err instanceof Error ? err.message : err)
    return json({ text: null, available: false, reason: 'generation-failed' })
  }

  const text = sanitizeInsight(generated)
  if (!text) {
    return json({ text: null, available: false, reason: 'empty-output' })
  }

  try {
    await DB.prepare(
      `INSERT INTO ai_insight_cache (cache_key, text, model, lang, hits, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         text = excluded.text, model = excluded.model,
         hits = 0, updated_at = excluded.updated_at`
    ).bind(cacheKey, text, MODEL_ID, langName, new Date().toISOString(), new Date().toISOString()).run()
  } catch {
    // 缓存写入失败不影响本次返回
  }

  return json({ text, cached: false, available: true })
}
