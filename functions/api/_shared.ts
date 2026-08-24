// _shared.ts — API 层共享的安全校验工具

/**
 * 从原始 payload 中安全提取字符串字段，防止多余字段注入
 */
export function str(val: unknown, maxLen = 64): string {
  return typeof val === 'string' ? val.slice(0, maxLen) : ''
}

/**
 * 从原始 payload 中安全提取数字字段，限定范围
 */
export function num(val: unknown, min: number, max: number): number | null {
  return typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max
    ? val
    : null
}

/**
 * 校验 MBTI 四字母格式
 */
export function isValidMbti(val: string): boolean {
  return /^[EI][SN][TF][JP]$/i.test(val)
}

/**
 * 校验 archetype / character code 格式（字母、数字、短横线，最长 32 位）
 */
export function isValidCode(val: string): boolean {
  return /^[A-Za-z0-9_-]{1,32}$/.test(val)
}

/**
 * 校验 UUID v4 格式
 */
export function isValidUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val)
}

/**
 * 校验 answers 数组长度是否匹配题目数，以及每条 answer 是否合法
 */
export function validateAnswers(
  answers: unknown,
  expectedCount?: number,
): Array<{ questionId: string; answerValue: number }> | null {
  if (!Array.isArray(answers)) return null
  if (expectedCount !== undefined && answers.length !== expectedCount) return null

  const result: Array<{ questionId: string; answerValue: number }> = []
  for (const a of answers) {
    if (
      typeof a !== 'object' || a === null ||
      typeof (a as any).questionId !== 'string' ||
      typeof (a as any).answerValue !== 'number'
    ) return null
    const qid = str((a as any).questionId, 16)
    const val = num((a as any).answerValue, -2, 2)
    if (!qid || val === null) return null
    result.push({ questionId: qid, answerValue: val })
  }
  return result
}

/**
 * Turnstile 服务端 Siteverify 校验
 * token 有效期 5 分钟，单次使用
 */
export async function verifyTurnstile(
  token: string,
  ip: string | undefined,
  env: { TURNSTILE_SECRET?: string },
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET
  if (!secret) {
    // 未配置 secret 时跳过校验（本地开发 / 尚未接入阶段）
    console.warn('Turnstile secret not configured, skipping verification')
    return true
  }

  const form = new URLSearchParams()
  form.set('secret', secret)
  form.set('response', token)
  if (ip) form.set('remoteip', ip)

  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    })
    const data = await resp.json<{ success: boolean }>()
    return !!data.success
  } catch (err) {
    console.error('Turnstile verify error:', err)
    return false
  }
}

/**
 * 简易分钟级限流：基于 CF-Connecting-IP
 * 使用 D1 做轻量计数（每分钟归零，由 cron-worker 定期清理过期行）
 * 适用于低流量场景；高流量应改用 Cloudflare Rate Limiting API
 *
 * strict 模式供付费生成路径使用：D1 不可用时拒绝请求而非放行，
 * 防止攻击者刻意打满 D1 写入配额让限流失效后刷穿上游额度
 */
export async function checkRateLimit(
  DB: D1Database,
  ip: string,
  limit = 10,
  strict = false,
): Promise<boolean> {
  const windowKey = `rl:${ip}:${Math.floor(Date.now() / 60000)}`
  try {
    // 单条原子 UPSERT + RETURNING：并发请求各自拿到自增后的计数，避免"先读后写"竞态超限
    const row = await DB.prepare(
      `INSERT INTO _rate_limit (k, cnt, exp) VALUES (?, 1, ?)
       ON CONFLICT(k) DO UPDATE SET cnt = cnt + 1
       RETURNING cnt`
    ).bind(windowKey, Math.floor(Date.now() / 1000) + 120).first<{ cnt: number }>()

    return (row?.cnt ?? 0) <= limit
  } catch {
    if (strict) return false
    // 表不存在或 D1 抖动时降级放行：统计类端点的可用性优先于严格限流
    return true
  }
}

/**
 * 每日计数熔断：复用 _rate_limit 表（键按 UTC 日切换，exp 两天后由 cron 清理）。
 * 单 IP 限流挡不住 IP 池轮换，全站每日总量是付费生成路径的最后一道硬顶。
 * 计数先增后判：被拒请求同样计数，只会让拒绝状态更稳固，不影响正常流量。
 */
export async function bumpDailyCounter(
  DB: D1Database,
  name: string,
  limit: number,
  strict = false,
): Promise<boolean> {
  const dayKey = `day:${name}:${new Date().toISOString().slice(0, 10)}`
  try {
    const row = await DB.prepare(
      `INSERT INTO _rate_limit (k, cnt, exp) VALUES (?, 1, ?)
       ON CONFLICT(k) DO UPDATE SET cnt = cnt + 1
       RETURNING cnt`
    ).bind(dayKey, Math.floor(Date.now() / 1000) + 172800).first<{ cnt: number }>()

    return (row?.cnt ?? 0) <= limit
  } catch {
    if (strict) return false
    return true
  }
}

/**
 * 恒定时间字符串比较，用于预热口子的 Bearer 令牌校验，
 * 避免普通 === 的短路逐字符比较泄漏令牌前缀。
 * Workers 运行时提供 crypto.subtle.timingSafeEqual 扩展；
 * 其他环境（本地 Node 测试）无此扩展时回退普通比较。
 */
export async function tokenEquals(a: string, b: string): Promise<boolean> {
  if (!a || !b || a.length !== b.length) return false
  try {
    const enc = new TextEncoder()
    // timingSafeEqual 是 Workers 的非标准扩展，以可选成员探测，
    // 兼容无此扩展的类型环境（DOM lib）与运行时（Node）
    const subtle = crypto.subtle as SubtleCrypto & {
      timingSafeEqual?: (x: BufferSource, y: BufferSource) => boolean
    }
    if (typeof subtle.timingSafeEqual === 'function') {
      return subtle.timingSafeEqual(enc.encode(a), enc.encode(b))
    }
  } catch {
    // 比较异常时回退普通比较
  }
  return a === b
}
