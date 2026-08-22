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

const MODEL_ID = '@cf/meta/llama-3.2-3b-instruct'
// OpenAI 兼容网关（如 saurlax AI 网关）：配置 AIGW_API_KEY 即启用，
// 模型与端点可覆盖。网关上的推理模型（如 step-3.7-flash）会先输出
// 思考过程再出正文，max_tokens 需给足推理余量。
const AIGW_DEFAULT_BASE = 'https://aigw.saurlax.com/v1'
const AIGW_DEFAULT_MODEL = 'step-3.7-flash'
// 单 IP 每分钟最多解读次数（生成路径比查询路径重，收紧到 10）
const INSIGHT_RATE_LIMIT = 10
const LANGUAGES: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
}

type Env = {
  DB: D1Database
  AI?: Ai
  // OpenAI 兼容网关（优先级最高；配置后 AIGW_MODEL/AIGW_BASE_URL 可选覆盖）
  AIGW_API_KEY?: string
  AIGW_BASE_URL?: string
  AIGW_MODEL?: string
  // REST 回退（本地联调用，见 runModel）：与 AI binding 二选一即可
  ACGTI_AI_TOKEN?: string
  ACGTI_AI_ACCOUNT_ID?: string
}

type ChatMessage = { role: 'system' | 'user'; content: string }

// 解析 OpenAI 兼容的 chat/completions 响应（网关与 Cloudflare REST 同构）
function parseChatChoices(data: unknown): string {
  const d = data as { choices?: Array<{ message?: { content?: string } }> }
  return d?.choices?.[0]?.message?.content ?? ''
}

// 模型调用，按优先级回退：
//   1. OpenAI 兼容网关（AIGW_API_KEY，中文质量最佳）
//   2. AI binding（线上部署零配置）
//   3. Cloudflare REST + .dev.vars 凭据（本地联调：pages dev 的远程绑定
//      依赖 wrangler 远程代理会话，受限网络下会 internal error）
async function runModel(env: Env, messages: ChatMessage[]): Promise<{ text: string; modelTag: string }> {
  if (env.AIGW_API_KEY) {
    const base = (env.AIGW_BASE_URL || AIGW_DEFAULT_BASE).replace(/\/+$/, '')
    const model = env.AIGW_MODEL || AIGW_DEFAULT_MODEL
    let resp: Response
    try {
      resp = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.AIGW_API_KEY}`,
          'Content-Type': 'application/json',
        },
        // 推理模型先思考后成文；思考长度不稳定，4000 给足余量
        // （max_tokens 是上限而非消耗，正文长度仍由提示词约束）
        body: JSON.stringify({ model, messages, max_tokens: 4000, temperature: 0.2 }),
      })
    } catch (err) {
      throw new Error(`AIGW fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (!resp.ok) {
      throw new Error(`AIGW ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
    }
    const text = parseChatChoices(await resp.json())
    if (!text) {
      // 推理模型 token 耗尽在思考阶段时 content 为空
      throw new Error('AIGW empty content (reasoning exceeded max_tokens?)')
    }
    return { text, modelTag: model }
  }

  if (env.AI) {
    const result = await env.AI.run(MODEL_ID, {
      messages,
      max_tokens: 400,
      temperature: 0.2,
    })
    const text = typeof result === 'string' ? result : (result as { response?: string })?.response ?? ''
    return { text, modelTag: 'llama-3.2-3b' }
  }

  if (env.ACGTI_AI_TOKEN && env.ACGTI_AI_ACCOUNT_ID) {
    let resp: Response
    try {
      resp = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.ACGTI_AI_ACCOUNT_ID}/ai/run/${MODEL_ID}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.ACGTI_AI_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages, max_tokens: 400, temperature: 0.2 }),
        },
      )
    } catch (err) {
      throw new Error(`REST AI fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (!resp.ok) {
      throw new Error(`REST AI ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
    }
    const data = await resp.json<{ success?: boolean; errors?: Array<{ message?: string }>; result?: unknown }>()
    if (data.success === false) {
      throw new Error(`REST AI api error: ${JSON.stringify(data.errors ?? []).slice(0, 200)}`)
    }
    return { text: parseChatChoices(data.result), modelTag: 'llama-3.2-3b' }
  }

  throw new Error('no ai provider configured')
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
  const { DB, AI, AIGW_API_KEY, ACGTI_AI_TOKEN, ACGTI_AI_ACCOUNT_ID } = context.env

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

  if (!AIGW_API_KEY && !AI && !(ACGTI_AI_TOKEN && ACGTI_AI_ACCOUNT_ID)) {
    // 无任何可用 provider（网关 / AI binding / REST 凭据）：明确告知前端不可用
    return json({ text: null, available: false, reason: 'no-binding' })
  }

  const scores = { ei, sn, tf, jp }
  // 缓存键含模型标签：切换 provider/模型后旧缓存自然失效，不互相污染
  const providerTag = AIGW_API_KEY
    ? (context.env.AIGW_MODEL || AIGW_DEFAULT_MODEL)
    : 'llama-3.2-3b'
  const cacheKey = `${characterId}:${langName}:${bucketOf(ei)}${bucketOf(sn)}${bucketOf(tf)}${bucketOf(jp)}:${providerTag}`
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
  let usedModel: string
  try {
    const result = await runModel(context.env, [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ])
    generated = result.text
    usedModel = result.modelTag
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
    ).bind(cacheKey, text, usedModel, langName, new Date().toISOString(), new Date().toISOString()).run()
  } catch {
    // 缓存写入失败不影响本次返回
  }

  return json({ text, cached: false, available: true })
}
