/// <reference types="@cloudflare/workers-types" />
// 后端端点测试：不真跑 SQL，用内存 Map 模拟 D1 的 UPSERT/RETURNING 自增语义
// （模式承袭 tests/insightGuard.test.ts），直接构造 { env, request, waitUntil }
// context 调用各 onRequestPost / onRequest，断言"调用了预期的 SQL 与绑定参数、
// 返回了预期的状态码/JSON"。
import { afterEach, describe, expect, it, vi } from 'vitest'

import { onRequest as middlewareOnRequest } from '../functions/_middleware'
import { onRequestPost as feedbackHandler } from '../functions/api/feedback'
import { onRequestPost as insightHandler } from '../functions/api/insight'
import { onRequestPost as submitHandler } from '../functions/api/submit'
import {
  isValidCode,
  isValidMbti,
  isValidUuid,
  num,
  str,
  validateAnswers,
} from '../functions/api/_shared'
import briefsJson from '../functions/api/_data/characterBrief.json'

// ── fake D1 ──────────────────────────────────────────────────────────────────

type RecordedStmt = { sql: string; bound: unknown[]; via: 'first' | 'run' | 'batch' }

interface FakeDbOptions {
  /** 模拟 D1 整体不可用（限流降级路径） */
  fail?: boolean
  /** 预置限流/每日计数（键用归一化形式：剥掉末尾的分钟段或 UTC 日期段） */
  presetCounts?: Record<string, number>
  /** 预置 ai_insight_cache 缓存（键为完整 cache_key） */
  insightCache?: Record<string, string>
}

/**
 * 内存版 D1：按 SQL 内容分派语义。
 * - `_rate_limit` UPSERT RETURNING → 键归一化后自增（checkRateLimit / bumpDailyCounter）
 * - `SELECT ... FROM ai_insight_cache` → 查预置缓存
 * - submit 的四张聚合表 UPSERT → 对应键自增（等价 ON CONFLICT DO UPDATE cnt+1）
 * - 其余 INSERT（抽样明细 / 反馈）→ 记录绑定参数供断言
 */
function makeDb(opts: FakeDbOptions = {}) {
  const counts = new Map<string, number>(Object.entries(opts.presetCounts ?? {}))
  const insightCache = new Map<string, string>(Object.entries(opts.insightCache ?? {}))
  const aggCounts = new Map<string, number>()
  const recorded: RecordedStmt[] = []
  const inserted: RecordedStmt[] = []

  // rl:${scope}:${ip}:${minute} → 剥分钟段；day:${name}:${yyyy-mm-dd} → 剥日期段
  const normalizeKey = (k: string) => k.replace(/:(\d{4}-\d{2}-\d{2}|\d+)$/, '')
  const incr = (key: string) => {
    const next = (aggCounts.get(key) ?? 0) + 1
    aggCounts.set(key, next)
    return next
  }

  async function exec(sql: string, bound: unknown[], via: RecordedStmt['via']) {
    recorded.push({ sql, bound, via })
    if (opts.fail) throw new Error('d1 unavailable')

    if (sql.includes('_rate_limit')) {
      const key = normalizeKey(String(bound[0]))
      const next = (counts.get(key) ?? 0) + 1
      counts.set(key, next)
      return { cnt: next }
    }
    if (sql.includes('FROM ai_insight_cache')) {
      const text = insightCache.get(String(bound[0]))
      return text === undefined ? null : { text }
    }
    if (sql.includes('INTO ai_insight_cache')) {
      // 缓存 UPSERT：写入（ON CONFLICT 时覆盖），可断言绑定参数
      insightCache.set(String(bound[0]), String(bound[1]))
      return { meta: { changes: 1 } }
    }
    if (sql.includes('UPDATE ai_insight_cache')) {
      return { meta: { changes: 1 } }
    }
    // submit 聚合 UPSERT：按表分派到独立计数键
    if (sql.includes('INTO archetype_counts')) {
      incr(`archetype:${String(bound[0])}`)
      return { meta: { changes: 1 } }
    }
    if (sql.includes('INTO character_counts')) {
      incr(`character:${String(bound[0])}`)
      return { meta: { changes: 1 } }
    }
    if (sql.includes('INTO pair_counts')) {
      incr(`pair:${String(bound[0])}|${String(bound[1])}`)
      return { meta: { changes: 1 } }
    }
    if (sql.includes('INTO daily_counts')) {
      incr(`stat_date:${String(bound[0])}`)
      return { meta: { changes: 1 } }
    }
    if (sql.includes('INSERT')) {
      inserted.push({ sql, bound, via })
      return { meta: { changes: 1 } }
    }
    return { meta: {} }
  }

  const db = {
    prepare(sql: string) {
      const stmt: Record<string, unknown> & {
        bind: (...v: unknown[]) => unknown
        first: () => Promise<unknown>
        run: () => Promise<unknown>
        __sql: string
        __bound: unknown[]
      } = Object.create(null)
      stmt.__sql = sql
      stmt.__bound = []
      stmt.bind = (...v: unknown[]) => {
        stmt.__bound = v
        return stmt
      }
      stmt.first = () => exec(sql, stmt.__bound, 'first')
      stmt.run = () => exec(sql, stmt.__bound, 'run')
      return stmt
    },
    async batch(stmts: Array<{ __sql: string; __bound: unknown[] }>) {
      const out: unknown[] = []
      for (const s of stmts) out.push(await exec(s.__sql, s.__bound, 'batch'))
      return out
    },
  }

  return {
    db: db as unknown as D1Database,
    counts,
    aggCounts,
    insightCache,
    recorded,
    inserted,
  }
}

// ── context / payload 构造 ───────────────────────────────────────────────────

function makePostContext(
  url: string,
  body: unknown,
  envExtra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
  dbOptsOrFake: FakeDbOptions | ReturnType<typeof makeDb> = {},
) {
  // 支持传入已有 fake（Request body 只能消费一次，跨多次调用需各自新 body 共享同一 db）
  const fake = 'db' in dbOptsOrFake ? (dbOptsOrFake as ReturnType<typeof makeDb>) : makeDb(dbOptsOrFake as FakeDbOptions)
  const waitUntilPromises: Promise<unknown>[] = []
  const context = {
    request: new Request(url, {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env: { DB: fake.db, ...envExtra },
    waitUntil: (p: Promise<unknown>) => {
      waitUntilPromises.push(p)
    },
    data: {},
    params: {},
    next: async () => new Response('next-ok'),
  }
  return { context, fake, waitUntilPromises }
}

const UUID_V4 = '01234567-89ab-4cde-8f01-0123456789ab'

function makeAnswers(count: number) {
  // validateAnswers 白名单：questionId 字符串、answerValue ∈ [-2, 2]
  return Array.from({ length: count }, (_, i) => ({
    questionId: `q${(i % 39) + 1}`,
    answerValue: (i % 5) - 2,
  }))
}

function makeSubmitPayload(overrides: Record<string, unknown> = {}) {
  return {
    submissionId: UUID_V4,
    appVersion: '0.4.0',
    archetypeCode: 'luminous-lead',
    characterCode: 'TIGA',
    predictedMbti: 'ESFP',
    durationMs: 60000,
    dimensionScores: { ei: 50, sn: 60, tf: 40, jp: 55 },
    answers: makeAnswers(20),
    ...overrides,
  }
}

const SUBMIT_URL = 'http://localhost:8788/api/submit'
const FEEDBACK_URL = 'http://localhost:8788/api/feedback'
const INSIGHT_URL = 'http://localhost:8788/api/insight'

// insight 测试常量：网关三项齐备才启用通道；缓存键 v{BRIEF_VERSION}:{id}:{lang}:{buckets}:{model}
const GW_MODEL = 'test-model'
const GW_ENV = {
  AIGW_API_KEY: 'gw-key',
  AIGW_BASE_URL: 'https://gw.test/v1',
  AIGW_MODEL: GW_MODEL,
}
const CHAR_ID = Object.keys(briefsJson)[0]
// dimensionScores 全 0 → 四桶均为 0 → 桶段 '0000'
const INSIGHT_CACHE_KEY = `v2:${CHAR_ID}:zh-CN:0000:${GW_MODEL}`

function makeInsightBody(overrides: Record<string, unknown> = {}) {
  return {
    characterCode: CHAR_ID,
    lang: 'zh-CN',
    dimensionScores: { ei: 0, sn: 0, tf: 0, jp: 0 },
    ...overrides,
  }
}

function gatewayResponse(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ── _shared 纯函数 ────────────────────────────────────────────────────────────

describe('_shared 纯函数', () => {
  it('str：字符串按上限截断，非字符串返回空串', () => {
    expect(str('abcdef', 3)).toBe('abc')
    expect(str(123)).toBe('')
    expect(str(null)).toBe('')
    expect(str(undefined)).toBe('')
  })

  it('num：范围内返回原值，越界/非数字/非有限返回 null', () => {
    expect(num(5, 0, 10)).toBe(5)
    expect(num(0, 0, 10)).toBe(0)
    expect(num(10, 0, 10)).toBe(10)
    expect(num(-1, 0, 10)).toBeNull()
    expect(num(11, 0, 10)).toBeNull()
    expect(num('5', 0, 10)).toBeNull()
    expect(num(NaN, 0, 10)).toBeNull()
    expect(num(Infinity, 0, 10)).toBeNull()
  })

  it('isValidMbti：四字母格式，大小写不敏感', () => {
    expect(isValidMbti('INFP')).toBe(true)
    expect(isValidMbti('estj')).toBe(true)
    expect(isValidMbti('INF')).toBe(false)
    expect(isValidMbti('INFXX')).toBe(false)
    expect(isValidMbti('ABCD')).toBe(false)
    expect(isValidMbti('')).toBe(false)
  })

  it('isValidCode：字母数字短横线下划线，最长 32 位', () => {
    expect(isValidCode('luminous-lead')).toBe(true)
    expect(isValidCode('TIGA_01')).toBe(true)
    expect(isValidCode('a'.repeat(32))).toBe(true)
    expect(isValidCode('a'.repeat(33))).toBe(false)
    expect(isValidCode('bad code')).toBe(false)
    expect(isValidCode('含中文')).toBe(false)
    expect(isValidCode('')).toBe(false)
  })

  it('isValidUuid：仅接受 v4 格式（大小写不敏感）', () => {
    expect(isValidUuid(UUID_V4)).toBe(true)
    expect(isValidUuid(UUID_V4.toUpperCase())).toBe(true)
    // v1 风格版本位（第三组以 1 开头）不合法
    expect(isValidUuid('01234567-89ab-1cde-8f01-0123456789ab')).toBe(false)
    // variant 位非法
    expect(isValidUuid('01234567-89ab-4cde-0f01-0123456789ab')).toBe(false)
    expect(isValidUuid('not-a-uuid')).toBe(false)
    expect(isValidUuid('')).toBe(false)
  })

  it('validateAnswers：非数组 / 条数不符 / 坏条目均返回 null', () => {
    expect(validateAnswers('nope')).toBeNull()
    expect(validateAnswers(null)).toBeNull()
    expect(validateAnswers(makeAnswers(3), 4)).toBeNull()

    expect(validateAnswers([{ questionId: 'q1', answerValue: 3 }])).toBeNull() // 超出 ±2
    expect(validateAnswers([{ questionId: 'q1', answerValue: 'x' }])).toBeNull()
    expect(validateAnswers([{ answerValue: 1 }])).toBeNull()
    expect(validateAnswers([{ questionId: 'q1', answerValue: null }])).toBeNull()
    expect(validateAnswers([null])).toBeNull()
  })

  it('validateAnswers：合法数组清洗返回，questionId 截断到 16 字符', () => {
    const result = validateAnswers([
      { questionId: 'q1', answerValue: -2 },
      { questionId: 'x'.repeat(30), answerValue: 2 },
    ])
    expect(result).toEqual([
      { questionId: 'q1', answerValue: -2 },
      { questionId: 'x'.repeat(16), answerValue: 2 },
    ])
  })
})

// ── _middleware 跨站写防护 ────────────────────────────────────────────────────

describe('_middleware（/api/ 写接口跨站防护）', () => {
  async function run(
    method: string,
    url: string,
    headers: Record<string, string> = {},
    body?: string,
  ) {
    let nextCalled = false
    const response = await middlewareOnRequest({
      request: new Request(url, { method, headers, body }),
      env: {},
      params: {},
      data: {},
      next: async () => {
        nextCalled = true
        return new Response('next-ok')
      },
    } as any)
    return { response, nextCalled }
  }

  it('POST 无 Origin/Sec-Fetch 头（curl 等非浏览器客户端）放行', async () => {
    const { response, nextCalled } = await run('POST', SUBMIT_URL, {}, '{}')
    expect(nextCalled).toBe(true)
    expect(response.status).toBe(200)
  })

  it('POST 同源 Origin 放行，且 /api/ 响应补充安全头', async () => {
    const { response, nextCalled } = await run(
      'POST',
      SUBMIT_URL,
      { Origin: 'http://localhost:8788' },
      '{}',
    )
    expect(nextCalled).toBe(true)
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  })

  it('POST Origin 为 localhost / 127.0.0.1 任意端口（本地联调）放行', async () => {
    const local = await run('POST', SUBMIT_URL, { Origin: 'http://localhost:3000' }, '{}')
    expect(local.nextCalled).toBe(true)
    const loopback = await run('POST', SUBMIT_URL, { Origin: 'http://127.0.0.1:5173' }, '{}')
    expect(loopback.nextCalled).toBe(true)
  })

  it('POST 跨站 Origin 拒绝 403', async () => {
    const { response, nextCalled } = await run(
      'POST',
      SUBMIT_URL,
      { Origin: 'https://evil.example' },
      '{}',
    )
    expect(nextCalled).toBe(false)
    expect(response.status).toBe(403)
    const body = (await response.json()) as { error: string }
    expect(body.error).toContain('cross-site')
  })

  it('POST 无 Origin 但 Sec-Fetch-Site: cross-site 拒绝 403', async () => {
    const { response, nextCalled } = await run(
      'POST',
      SUBMIT_URL,
      { 'Sec-Fetch-Site': 'cross-site' },
      '{}',
    )
    expect(nextCalled).toBe(false)
    expect(response.status).toBe(403)
  })

  it('POST Origin 值无法解析为 URL 时视为非法来源拒绝', async () => {
    const { response } = await run('POST', SUBMIT_URL, { Origin: 'not a url' }, '{}')
    expect(response.status).toBe(403)
  })

  it('GET 请求不受跨站校验影响（含 Sec-Fetch-Site: cross-site）', async () => {
    const { response, nextCalled } = await run('GET', 'http://localhost:8788/api/stats', {
      'Sec-Fetch-Site': 'cross-site',
      Origin: 'https://evil.example',
    })
    expect(nextCalled).toBe(true)
    expect(response.status).toBe(200)
  })

  it('非 /api/ 路径的跨站写不受影响', async () => {
    const { nextCalled } = await run(
      'POST',
      'http://localhost:8788/some-page',
      { Origin: 'https://evil.example' },
      '{}',
    )
    expect(nextCalled).toBe(true)
  })

  it('首页仅含追踪参数时 301 到清洁 URL', async () => {
    const { response, nextCalled } = await run(
      'GET',
      'http://localhost:8788/?utm_source=x&utm_medium=y',
    )
    expect(nextCalled).toBe(false)
    expect(response.status).toBe(301)
    expect(response.headers.get('Location')).toBe('http://localhost:8788/')
  })
})

// ── /api/submit ──────────────────────────────────────────────────────────────

describe('/api/submit', () => {
  it('合法 payload：静默 204 且四张聚合表各自 UPSERT 自增一次', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99) // 不触发 2% 抽样
    const { context, fake } = makePostContext(SUBMIT_URL, makeSubmitPayload())

    const res = await submitHandler(context)
    expect(res.status).toBe(204)

    expect(fake.aggCounts.get('archetype:luminous-lead')).toBe(1)
    expect(fake.aggCounts.get('character:TIGA')).toBe(1)
    expect(fake.aggCounts.get('pair:luminous-lead|TIGA')).toBe(1)
    expect([...fake.aggCounts.keys()].filter((k) => k.startsWith('stat_date:'))).toHaveLength(1)

    // 绑定参数：UPSERT 语句携带角色代码与时间戳
    const archetypeStmt = fake.recorded.find((r) => r.sql.includes('INTO archetype_counts'))
    expect(archetypeStmt?.bound[0]).toBe('luminous-lead')
    // 非抽样路径不应有明细 INSERT
    expect(fake.inserted).toHaveLength(0)
  })

  it('同一 payload 连续提交两次：聚合计数自增到 2（UPSERT 语义）', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const first = makePostContext(SUBMIT_URL, makeSubmitPayload())
    await submitHandler(first.context)
    // Request body 只能消费一次：第二次用新 body、共享同一 fake db
    const second = makePostContext(SUBMIT_URL, makeSubmitPayload(), {}, {}, first.fake)
    await submitHandler(second.context)
    expect(first.fake.aggCounts.get('archetype:luminous-lead')).toBe(2)
    expect(first.fake.aggCounts.get('character:TIGA')).toBe(2)
  })

  it('Math.random 命中抽样：写入明细表与答案 blob 两条 INSERT', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // 必然抽样
    const { context, fake } = makePostContext(SUBMIT_URL, makeSubmitPayload())

    await submitHandler(context)
    expect(fake.aggCounts.get('archetype:luminous-lead')).toBe(1)
    expect(fake.inserted).toHaveLength(2)
    const blobInsert = fake.inserted.find((r) => r.sql.includes('submission_answers_blob'))
    expect(blobInsert?.bound[0]).toBe(UUID_V4)
    // 落库的是清洗后的白名单字段（questionId / answerValue）
    expect(String(blobInsert?.bound[1])).toContain('"questionId"')
  })

  it('answers 少于 20 条：204 静默且不写任何表', async () => {
    const { context, fake } = makePostContext(
      SUBMIT_URL,
      makeSubmitPayload({ answers: makeAnswers(19) }),
    )
    const res = await submitHandler(context)
    expect(res.status).toBe(204)
    expect(fake.aggCounts.size).toBe(0)
    expect(fake.inserted).toHaveLength(0)
  })

  it('answers 超过 100 条：204 静默且不写库', async () => {
    const { context, fake } = makePostContext(
      SUBMIT_URL,
      makeSubmitPayload({ answers: makeAnswers(101) }),
    )
    const res = await submitHandler(context)
    expect(res.status).toBe(204)
    expect(fake.aggCounts.size).toBe(0)
  })

  it('answers 含非法条目（answerValue 超白名单）：204 静默且不写库', async () => {
    const answers = makeAnswers(20)
    answers[5] = { questionId: 'q6', answerValue: 99 }
    const { context, fake } = makePostContext(SUBMIT_URL, makeSubmitPayload({ answers }))
    const res = await submitHandler(context)
    expect(res.status).toBe(204)
    expect(fake.aggCounts.size).toBe(0)
  })

  it('answers 序列化超 64KB：204 静默且不写库（深度防御分支）', async () => {
    // 白名单清洗后（≤100 条 × questionId≤16）物理上不可能超 64KB，
    // 该分支是防御纵深：mock JSON.stringify 触发，验证"超长必拒"的守卫本身
    vi.spyOn(JSON, 'stringify').mockReturnValue('x'.repeat(64 * 1024 + 1))
    const { context, fake } = makePostContext(SUBMIT_URL, makeSubmitPayload())
    const res = await submitHandler(context)
    expect(res.status).toBe(204)
    expect(fake.aggCounts.size).toBe(0)
  })

  it('单 IP 分钟限流超 30 次：429', async () => {
    const { context } = makePostContext(SUBMIT_URL, makeSubmitPayload(), {}, {}, {
      presetCounts: { 'rl:submit:unknown': 30 }, // 下一次计数为 31 > 30
    })
    const res = await submitHandler(context)
    expect(res.status).toBe(429)
  })

  it('必填字段缺失 / submissionId 非 UUID / 非法 JSON body：均 204 静默', async () => {
    const missing = makePostContext(SUBMIT_URL, makeSubmitPayload({ characterCode: '' }))
    expect((await submitHandler(missing.context)).status).toBe(204)

    const badUuid = makePostContext(
      SUBMIT_URL,
      makeSubmitPayload({ submissionId: 'not-a-uuid' }),
    )
    expect((await submitHandler(badUuid.context)).status).toBe(204)

    const badJson = makePostContext(SUBMIT_URL, '{broken')
    expect((await submitHandler(badJson.context)).status).toBe(204)
    expect(badJson.fake.aggCounts.size).toBe(0)
  })
})

// ── /api/feedback ────────────────────────────────────────────────────────────

describe('/api/feedback', () => {
  function makeFeedbackBody(overrides: Record<string, unknown> = {}) {
    return {
      selfMbti: 'infp',
      confidence: 4,
      appVersion: '0.4.0',
      ...overrides,
    }
  }

  it('缺必填字段：400', async () => {
    const { context } = makePostContext(FEEDBACK_URL, { appVersion: '0.4.0' })
    const res = await feedbackHandler(context)
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Missing required fields')
  })

  it('非法 JSON body：400', async () => {
    const { context } = makePostContext(FEEDBACK_URL, '{broken')
    const res = await feedbackHandler(context)
    expect(res.status).toBe(400)
  })

  it('合法提交：200 且 mbti_feedback 以白名单字段写入（selfMbti 大写化）', async () => {
    const { context, fake } = makePostContext(
      FEEDBACK_URL,
      makeFeedbackBody({
        submissionId: UUID_V4,
        note: 'x'.repeat(300), // 超长备注应被截断到 200
        archetypeCode: 'moonlit-guardian',
        characterCode: 'TIGA',
      }),
    )
    const res = await feedbackHandler(context)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    expect(fake.inserted).toHaveLength(1)
    const bound = fake.inserted[0]!.bound
    // INSERT 列序：id, submission_id, created_at, app_version, self_mbti, confidence, note, ...
    expect(bound[0]).toMatch(/[0-9a-f-]{36}/) // crypto.randomUUID 生成的反馈 id
    expect(bound[1]).toBe(UUID_V4)
    expect(bound[4]).toBe('INFP') // 小写输入被大写化入库
    expect(bound[5]).toBe(4)
    expect((bound[6] as string).length).toBe(200) // note 截断
    expect(bound[10]).toBe('moonlit-guardian')
    expect(bound[11]).toBe('TIGA')
  })

  it('answers 携带时逐条白名单校验，非法条目 400', async () => {
    const { context } = makePostContext(
      FEEDBACK_URL,
      makeFeedbackBody({ answers: [{ questionId: 'q1', answerValue: 99 }] }),
    )
    const res = await feedbackHandler(context)
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Invalid answers')
  })

  it('可选 code 字段非法：400（不写库）', async () => {
    const badArchetype = makePostContext(
      FEEDBACK_URL,
      makeFeedbackBody({ archetypeCode: 'bad code!' }),
    )
    expect((await feedbackHandler(badArchetype.context)).status).toBe(400)
    expect(badArchetype.fake.inserted).toHaveLength(0)

    const badCharacter = makePostContext(
      FEEDBACK_URL,
      makeFeedbackBody({ characterCode: '含中文' }),
    )
    expect((await feedbackHandler(badCharacter.context)).status).toBe(400)
  })

  it('非法 selfMbti 格式 / 非法 submissionId：400', async () => {
    const badMbti = makePostContext(FEEDBACK_URL, makeFeedbackBody({ selfMbti: 'XYZ' }))
    expect((await feedbackHandler(badMbti.context)).status).toBe(400)

    const badUuid = makePostContext(
      FEEDBACK_URL,
      makeFeedbackBody({ submissionId: 'nope' }),
    )
    expect((await feedbackHandler(badUuid.context)).status).toBe(400)
  })

  it('单 IP 分钟限流超 5 次：429', async () => {
    const { context } = makePostContext(FEEDBACK_URL, makeFeedbackBody(), {}, {}, {
      presetCounts: { 'rl:feedback:unknown': 5 },
    })
    const res = await feedbackHandler(context)
    expect(res.status).toBe(429)
  })
})

// ── /api/insight ─────────────────────────────────────────────────────────────

describe('/api/insight onRequestPost', () => {
  it('未配 AI binding 且无网关 env：降级 available:false（reason no-binding，不抛错）', async () => {
    const { context } = makePostContext(INSIGHT_URL, makeInsightBody())
    const res = await insightHandler(context as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ text: null, available: false, reason: 'no-binding' })
  })

  it('payload 非法（characterCode 含空格 / 四维缺失）：400', async () => {
    const badCode = makePostContext(
      INSIGHT_URL,
      makeInsightBody({ characterCode: 'bad code' }),
      GW_ENV,
    )
    const res = await insightHandler(badCode.context as any)
    expect(res.status).toBe(400)
    expect(((await res.json()) as { reason: string }).reason).toBe('invalid-payload')

    const missingScores = makePostContext(
      INSIGHT_URL,
      makeInsightBody({ dimensionScores: { ei: 0 } }),
      GW_ENV,
    )
    expect((await insightHandler(missingScores.context as any)).status).toBe(400)
  })

  it('未知角色：available:false（reason unknown-character）', async () => {
    const { context } = makePostContext(
      INSIGHT_URL,
      makeInsightBody({ characterCode: 'no-such-character' }),
      GW_ENV,
    )
    const res = await insightHandler(context as any)
    const body = (await res.json()) as { available: boolean; reason: string }
    expect(body.available).toBe(false)
    expect(body.reason).toBe('unknown-character')
  })

  it('缓存命中：直接返回缓存文本，hits 自增通过 waitUntil 托管', async () => {
    const { context, fake, waitUntilPromises } = makePostContext(
      INSIGHT_URL,
      makeInsightBody(),
      GW_ENV,
      {},
      { insightCache: { [INSIGHT_CACHE_KEY]: '缓存中的解读文本。' } },
    )
    const res = await insightHandler(context as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ text: '缓存中的解读文本。', cached: true, available: true })

    // hits 更新不阻塞响应，但必须经 waitUntil 托管（否则 Workers 不保证执行）
    expect(waitUntilPromises).toHaveLength(1)
    await Promise.all(waitUntilPromises)
    const update = fake.recorded.find((r) => r.sql.includes('hits = hits + 1'))
    expect(update?.bound[1]).toBe(INSIGHT_CACHE_KEY)
  })

  it('每日生成熔断：reason daily-limit，且不触达模型网关', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { context } = makePostContext(
      INSIGHT_URL,
      makeInsightBody(),
      GW_ENV,
      {},
      // day:insight-gen 键已计数 1000 → 本次自增为 1001 > 1000 触发熔断
      { presetCounts: { 'day:insight-gen': 1000 } },
    )
    const res = await insightHandler(context as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ text: null, available: false, reason: 'daily-limit' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('未携带预热令牌时 fresh 受独立子限流约束：超限后降级读缓存', async () => {
    // fresh 子限流（2 次/分）已打满 → wantFresh 被降级为 false → 命中缓存返回
    const { context } = makePostContext(
      INSIGHT_URL,
      makeInsightBody({ fresh: true }),
      GW_ENV,
      {},
      {
        presetCounts: { 'rl:insight-fresh:fresh:unknown': 2 },
        insightCache: { [INSIGHT_CACHE_KEY]: '降级后读到的缓存。' },
      },
    )
    const res = await insightHandler(context as any)
    const body = (await res.json()) as { cached: boolean; text: string }
    expect(body.cached).toBe(true)
    expect(body.text).toBe('降级后读到的缓存。')
  })

  it('未携带预热令牌时 fresh 首次可用：跳过缓存直接生成并写缓存', async () => {
    const fetchMock = vi.fn(async () => gatewayResponse('这是新生成的解读文本。'))
    vi.stubGlobal('fetch', fetchMock)
    const { context, fake } = makePostContext(
      INSIGHT_URL,
      makeInsightBody({ fresh: true }),
      GW_ENV,
      {},
      { insightCache: { [INSIGHT_CACHE_KEY]: '旧缓存不应被返回。' } },
    )
    const res = await insightHandler(context as any)
    const body = (await res.json()) as { cached: boolean; text: string }
    expect(body.cached).toBe(false)
    expect(body.text).toBe('这是新生成的解读文本。')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String((fetchMock.mock.calls as unknown[][])[0]?.[0])).toContain('https://gw.test/v1/chat/completions')

    // 生成结果写回缓存（UPSERT），后续相同画像可命中
    expect(fake.insightCache.get(INSIGHT_CACHE_KEY)).toBe('这是新生成的解读文本。')
  })

  it('携带正确预热令牌：fresh 豁免子限流与每日熔断，仍可生成', async () => {
    const fetchMock = vi.fn(async () => gatewayResponse('预热令牌放行的生成结果。'))
    vi.stubGlobal('fetch', fetchMock)
    const { context } = makePostContext(
      INSIGHT_URL,
      makeInsightBody({ fresh: true }),
      { ...GW_ENV, ACGTI_PREWARM_TOKEN: 'prewarm-secret' },
      { Authorization: 'Bearer prewarm-secret' },
      {
        // fresh 子限流与每日熔断均已打满：普通请求会被拦，预热请求豁免
        presetCounts: {
          'rl:insight-fresh:fresh:unknown': 2,
          'day:insight-gen': 1000,
        },
      },
    )
    const res = await insightHandler(context as any)
    const body = (await res.json()) as { available: boolean; text: string }
    expect(body.available).toBe(true)
    expect(body.text).toBe('预热令牌放行的生成结果。')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('错误令牌不具高权限：fresh 仍被子限流拦下并降级读缓存', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { context } = makePostContext(
      INSIGHT_URL,
      makeInsightBody({ fresh: true }),
      { ...GW_ENV, ACGTI_PREWARM_TOKEN: 'prewarm-secret' },
      { Authorization: 'Bearer wrong-token' },
      {
        presetCounts: { 'rl:insight-fresh:fresh:unknown': 2 },
        insightCache: { [INSIGHT_CACHE_KEY]: '错误令牌降级后的缓存。' },
      },
    )
    const res = await insightHandler(context as any)
    const body = (await res.json()) as { cached: boolean; text: string }
    // 若错误令牌被误判为预热请求，会跳过缓存直接生成；这里必须读到缓存
    expect(body.cached).toBe(true)
    expect(body.text).toBe('错误令牌降级后的缓存。')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('预热请求可指定 provider 通道（双通道分流），走 aigw2 的 base', async () => {
    const fetchMock = vi.fn(async () => gatewayResponse('第二通道的生成结果。'))
    vi.stubGlobal('fetch', fetchMock)
    const { context } = makePostContext(
      INSIGHT_URL,
      makeInsightBody({ fresh: true, provider: 'aigw2' }),
      {
        ...GW_ENV,
        AIGW2_API_KEY: 'gw2-key',
        AIGW2_BASE_URL: 'https://gw2.test/v1',
        AIGW2_MODEL: 'test-model', // 与主通道同名 → 缓存键互通
        ACGTI_PREWARM_TOKEN: 'prewarm-secret',
      },
      { Authorization: 'Bearer prewarm-secret' },
    )
    const res = await insightHandler(context as any)
    const body = (await res.json()) as { available: boolean }
    expect(body.available).toBe(true)
    expect(String((fetchMock.mock.calls as unknown[][])[0]?.[0])).toContain('https://gw2.test/v1/chat/completions')

    // 未携带令牌的普通请求不允许指定 provider（走主通道）
    const fetchMain = vi.fn(async () => gatewayResponse('主通道的生成结果。'))
    vi.stubGlobal('fetch', fetchMain)
    const normal = makePostContext(
      INSIGHT_URL,
      makeInsightBody({ fresh: true, provider: 'aigw2' }),
      {
        ...GW_ENV,
        AIGW2_API_KEY: 'gw2-key',
        AIGW2_BASE_URL: 'https://gw2.test/v1',
        AIGW2_MODEL: 'test-model',
      },
    )
    await insightHandler(normal.context as any)
    expect(String((fetchMain.mock.calls as unknown[][])[0]?.[0])).toContain('https://gw.test/v1/chat/completions')
  })

  it('单 IP 分钟限流超 10 次：429（reason rate-limited）', async () => {
    const { context } = makePostContext(
      INSIGHT_URL,
      makeInsightBody(),
      GW_ENV,
      {},
      { presetCounts: { 'rl:insight:unknown': 10 } },
    )
    const res = await insightHandler(context as any)
    expect(res.status).toBe(429)
    expect(((await res.json()) as { reason: string }).reason).toBe('rate-limited')
  })
})
