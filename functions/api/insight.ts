// /api/insight — AI 结果解读（Workers AI，渐进增强）
//
// 设计约束（见 docs/adr/0006-ai-insight-workers-ai.md）：
// - 隐私：请求只包含角色代码与四维倾向分，绝不接收逐题答案
// - 成本：以「角色 + 四维倾向分桶 + 语言」为键写 D1 缓存，相同画像
//   全站共享一次生成结果，Neurons 消耗与桶数（≤ 113 × 81 × 4）同阶
// - 降级：未绑定 AI / 额度耗尽 / 生成失败一律返回 available:false，
//   前端隐藏卡片，结果页静态解析文案不受影响
// - 防滥用：fresh/provider 是高权限口子，仅对携带 ACGTI_PREWARM_TOKEN
//   的预热请求开放；外部请求的 fresh 受独立子限流约束，真实生成计入
//   全站每日熔断（挡 IP 池轮换），生成路径限流全部 fail-closed（D1
//   不可用时拒绝），避免"打满 D1 写入配额让限流失效"的组合攻击
// - 一致性：低温度 + 提示词只允许改写仓库自有的角色档案，禁止引入
//   档案之外的作品名与人名，输出经截断清洗后落缓存

import briefs from './_data/characterBrief.json'
import { bumpDailyCounter, checkRateLimit, isValidCode, num, str, tokenEquals } from './_shared'

const MODEL_ID = '@cf/meta/llama-3.2-3b-instruct'
// OpenAI 兼容网关（自建或第三方）：key、base、model 三项全部显式配置才启用，
// 不设任何默认端点/模型——避免他人部署时请求打到作者私人网关。
// 网关上的推理模型（如 step-3.7-flash）会先输出思考过程再出正文，
// max_tokens 需给足推理余量。
// 第二网关通道（AIGW2_*）：与主通道独立的并发额度，专供预热脚本分流提速
// （两通道模型同名时缓存键一致，可混跑互通）。
// 角色档案内容版本：characterBrief.json 的档案文案/标签有实质更新，或调整
// 生成提示词/清洗规则后，应 bump 此值——缓存键随之变化，旧缓存自然失效，
// 否则老解读会永久命中。当前缓存里的存量键视为 v1，故初始值为 2。
const BRIEF_VERSION = 2
// 单 IP 每分钟最多解读次数（生成路径比查询路径重，收紧到 10）
const INSIGHT_RATE_LIMIT = 10
// 未鉴权请求每分钟最多强制新生成（fresh）次数：前端"换一个"单结果页
// 最多 3 次（sessionStorage 限制），2 次/分对正常用户无感、对脚本有效
const INSIGHT_FRESH_RATE_LIMIT = 2
// 未鉴权请求每日真实生成全站上限（UTC 日）：缓存未命中才计数，超限后
// 未命中请求一律降级隐藏卡片；这是挡 IP 池轮换的最后一道硬顶
const INSIGHT_DAILY_LIMIT = 1000
const LANGUAGES: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
}

type Env = {
  DB: D1Database
  AI?: Ai
  // OpenAI 兼容网关（优先级最高；启用需 KEY + BASE_URL + MODEL 三项齐备）
  AIGW_API_KEY?: string
  AIGW_BASE_URL?: string
  AIGW_MODEL?: string
  // 第二网关通道（预热双通道分流用，见 runModel；同样三项齐备才启用）
  AIGW2_API_KEY?: string
  AIGW2_BASE_URL?: string
  AIGW2_MODEL?: string
  // REST 回退（本地联调用，见 runModel）：与 AI binding 二选一即可
  ACGTI_AI_TOKEN?: string
  ACGTI_AI_ACCOUNT_ID?: string
  // 限流覆盖（本地预热/联调用；线上保持默认 10 次/分/IP）
  ACGTI_INSIGHT_RATE_LIMIT?: string
  // 预热口子鉴权：配置后 Authorization: Bearer <token> 的预热请求才能
  // 使用 fresh/provider 高权限字段并豁免每日熔断；未配置则全部视为普通请求
  ACGTI_PREWARM_TOKEN?: string
  // 每日生成熔断上限覆盖（本地联调用；线上保持默认 1000）
  ACGTI_INSIGHT_DAILY_LIMIT?: string
}

type ChatMessage = { role: 'system' | 'user'; content: string }

// 网关并发限流（可恢复）：与永久性生成失败区分，调用方据此等待重试
class RateLimitError extends Error {}

type GatewayChannel = { name: 'aigw' | 'aigw2'; key: string; base: string; model: string }

// 收集已配置的网关通道（顺序即优先级，主通道在前）。
// key / base / model 缺一即视为未配置该通道，走后续降级链
// （AI binding → REST），不回落到任何硬编码端点
function gatewayChannels(env: Env): GatewayChannel[] {
  const channels: GatewayChannel[] = []
  if (env.AIGW_API_KEY && env.AIGW_BASE_URL && env.AIGW_MODEL) {
    channels.push({
      name: 'aigw',
      key: env.AIGW_API_KEY,
      base: env.AIGW_BASE_URL.replace(/\/+$/, ''),
      model: env.AIGW_MODEL,
    })
  }
  if (env.AIGW2_API_KEY && env.AIGW2_BASE_URL && env.AIGW2_MODEL) {
    channels.push({
      name: 'aigw2',
      key: env.AIGW2_API_KEY,
      base: env.AIGW2_BASE_URL.replace(/\/+$/, ''),
      model: env.AIGW2_MODEL,
    })
  }
  return channels
}

// 解析 OpenAI 兼容的 chat/completions 响应（网关与 Cloudflare REST 同构）
function parseChatChoices(data: unknown): string {
  const d = data as { choices?: Array<{ message?: { content?: string } }> }
  return d?.choices?.[0]?.message?.content ?? ''
}

// 模型调用，按优先级回退：
//   1. OpenAI 兼容网关（显式指定通道，或主通道，中文质量最佳）
//   2. AI binding（线上部署零配置）
//   3. Cloudflare REST + .dev.vars 凭据（本地联调：pages dev 的远程绑定
//      依赖 wrangler 远程代理会话，受限网络下会 internal error）
// 显式通道仅由预热脚本通过请求体 provider 字段指定（双通道并发分流），
// 线上请求不带该字段，永远走主通道，缓存键行为与单通道时一致。
async function runModel(
  env: Env,
  messages: ChatMessage[],
  channel?: GatewayChannel,
): Promise<{ text: string; modelTag: string }> {
  const gw = channel ?? gatewayChannels(env)[0]
  if (gw) {
    let resp: Response
    try {
      resp = await fetch(`${gw.base}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gw.key}`,
          'Content-Type': 'application/json',
        },
        // 推理模型先思考后成文；思考长度不稳定，4000 给足余量
        // （max_tokens 是上限而非消耗，正文长度仍由提示词约束）
        body: JSON.stringify({ model: gw.model, messages, max_tokens: 4000, temperature: 0.2 }),
      })
    } catch (err) {
      throw new Error(`AIGW[${gw.name}] fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (!resp.ok) {
      if (resp.status === 429) {
        // 网关限流是瞬时可恢复状态：向上透传为 429，预热脚本据此等待补跑
        throw new RateLimitError(`AIGW[${gw.name}] 429: ${(await resp.text()).slice(0, 200)}`)
      }
      throw new Error(`AIGW[${gw.name}] ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
    }
    const text = parseChatChoices(await resp.json())
    if (!text) {
      // 推理模型 token 耗尽在思考阶段时 content 为空
      throw new Error(`AIGW[${gw.name}] empty content (reasoning exceeded max_tokens?)`)
    }
    return { text, modelTag: gw.model }
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB, AI, ACGTI_AI_TOKEN, ACGTI_AI_ACCOUNT_ID } = context.env
  const channels = gatewayChannels(context.env)

  // ── 预热鉴权：fresh/provider 高权限口子仅对带 Bearer 令牌的预热脚本开放。
  // 未配置 ACGTI_PREWARM_TOKEN 时所有请求一律按普通请求处理（最安全默认），
  // 令牌比对走恒定时间比较，不泄漏前缀 ──
  const prewarmSecret = context.env.ACGTI_PREWARM_TOKEN
  const authHeader = context.request.headers.get('Authorization') || ''
  const bearerToken = (authHeader.match(/^Bearer\s+(\S+)$/i) || [])[1] || ''
  const isPrewarm = !!prewarmSecret && (await tokenEquals(bearerToken, prewarmSecret))

  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown'
  const rateLimit = Number(context.env.ACGTI_INSIGHT_RATE_LIMIT) > 0
    ? Number(context.env.ACGTI_INSIGHT_RATE_LIMIT)
    : INSIGHT_RATE_LIMIT
  // strict：本端点触发付费生成，D1 不可用时拒绝而非放行
  const allowed = await checkRateLimit(DB, 'insight', ip, rateLimit, true)
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
  const langCode = Object.hasOwn(LANGUAGES, lang) ? lang : 'zh-CN'

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

  if (channels.length === 0 && !AI && !(ACGTI_AI_TOKEN && ACGTI_AI_ACCOUNT_ID)) {
    // 无任何可用 provider（网关 / AI binding / REST 凭据）：明确告知前端不可用
    return json({ text: null, available: false, reason: 'no-binding' })
  }

  // 预热脚本可指定网关通道（双通道并发分流）；外部请求一律走主通道，
  // 防止第三方指定 aigw2 通道消耗独立的第二网关额度
  const providerRaw = isPrewarm ? str(raw.provider, 8) : ''
  const channel = channels.find((c) => c.name === providerRaw) ?? channels[0]

  const scores = { ei, sn, tf, jp }
  // 缓存键含内容版本与模型标签：档案/提示词更新（BRIEF_VERSION bump）或切换
  // provider/模型后旧缓存自然失效，不互相污染。指定通道时用该通道的模型；
  // 两通道模型同名则缓存互通（预热混跑的前提）
  const providerTag = channel ? channel.model : 'llama-3.2-3b'
  const cacheKey = `v${BRIEF_VERSION}:${characterId}:${langCode}:${bucketOf(ei)}${bucketOf(sn)}${bucketOf(tf)}${bucketOf(jp)}:${providerTag}`

  // 未鉴权请求的 fresh 受独立子限流约束（正常用户"换一个"无感）；
  // 超限时降级为读缓存而非报错，攻击者也拿不到额外生成
  let wantFresh = raw.fresh === true
  if (wantFresh && !isPrewarm) {
    const freshAllowed = await checkRateLimit(DB, 'insight-fresh', `fresh:${ip}`, INSIGHT_FRESH_RATE_LIMIT, true)
    if (!freshAllowed) wantFresh = false
  }

  // 缓存读取失败不阻塞生成路径
  if (!wantFresh) {
    try {
      const cached = await DB.prepare(
        'SELECT text FROM ai_insight_cache WHERE cache_key = ?'
      ).bind(cacheKey).first<{ text: string }>()

      if (cached?.text) {
        // hits 只是统计性写入，不应阻塞本次响应；但 Workers 对响应后遗留的
        // 未 await Promise 不保证执行，必须用 waitUntil 托管，否则计数大量丢失
        context.waitUntil(
          DB.prepare(
            'UPDATE ai_insight_cache SET hits = hits + 1, updated_at = ? WHERE cache_key = ?'
          ).bind(new Date().toISOString(), cacheKey).run()
        )
        return json({ text: cached.text, cached: true, available: true })
      }
    } catch {
      // 缓存表可能不存在（迁移未执行），继续走生成
    }
  }

  // ── 每日生成熔断（仅未鉴权请求）：单 IP 限流挡不住 IP 池轮换，
  // 全站每日真实生成总量是额度安全的最后硬顶；缓存命中不计数，
  // 预热请求豁免（自己的脚本，单日生成量按预热计划走） ──
  if (!isPrewarm) {
    const dailyLimit = Number(context.env.ACGTI_INSIGHT_DAILY_LIMIT) > 0
      ? Number(context.env.ACGTI_INSIGHT_DAILY_LIMIT)
      : INSIGHT_DAILY_LIMIT
    // 计数在生成前递增、且不因后续网关失败回滚：即使网关故障，被"烧掉"的
    // 当日额度也只影响可用性（降级隐藏卡片），不会造成额度被刷穿。这是
    // "偏向绝对安全"的有意取舍——先扣额后生成，宁可少生成不可被刷量
    const withinDaily = await bumpDailyCounter(DB, 'insight-gen', dailyLimit, true)
    if (!withinDaily) {
      console.warn(`[insight] daily generation limit reached (${dailyLimit}), serving cache-only`)
      return json({ text: null, available: false, reason: 'daily-limit' })
    }
  }

  const { system, user } = buildPrompt(brief, scores, LANGUAGES[langCode])

  let generated: string
  let usedModel: string
  try {
    const t0 = Date.now()
    const result = await runModel(
      context.env,
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      channel,
    )
    generated = result.text
    usedModel = result.modelTag
    console.log(`[insight] generated via ${channel?.name ?? 'binding/rest'} in ${Date.now() - t0}ms`)
  } catch (err) {
    if (err instanceof RateLimitError) {
      // 打日志观测网关侧的并发计数（current 值），供预热调参
      console.warn(`[insight] gateway rate-limited: ${err.message}`)
      return json({ text: null, available: false, reason: 'rate-limited' }, 429)
    }
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
    ).bind(cacheKey, text, usedModel, langCode, new Date().toISOString(), new Date().toISOString()).run()
  } catch {
    // 缓存写入失败不影响本次返回
  }

  return json({ text, cached: false, available: true })
}
