/// <reference types="@cloudflare/workers-types" />
// AI 防滥用三件套（分钟限流 strict、每日熔断、预热令牌比较）的单元测试。
// D1 用内存 Map 模拟 UPSERT RETURNING 自增语义；窗口键末尾的分钟/日期
// 段做归一，避免测试恰好在窗口边界跨越时计数被重置导致抖动。
import { describe, expect, it } from 'vitest'

import { bumpDailyCounter, checkRateLimit, tokenEquals } from '../functions/api/_shared'

function makeDb(opts: { fail?: boolean } = {}) {
  const rows = new Map<string, { cnt: number }>()
  const normalizeKey = (k: string) => k.replace(/:\d+$/, '')
  return {
    rows,
    prepare(sql: string) {
      let bound: unknown[] = []
      const stmt = {
        bind(...vals: unknown[]) {
          bound = vals
          return stmt
        },
        async first<T>(): Promise<T | null> {
          if (opts.fail) throw new Error('d1 unavailable')
          if (!sql.includes('RETURNING')) return null
          const key = normalizeKey(String(bound[0]))
          const row = rows.get(key) ?? { cnt: 0 }
          row.cnt += 1
          rows.set(key, row)
          return { cnt: row.cnt } as T
        },
        async run() {
          return {}
        },
      }
      return stmt
    },
  } as unknown as D1Database & { rows: Map<string, { cnt: number }> }
}

describe('checkRateLimit（分钟级 IP 限流）', () => {
  it('同一 IP 在限额内放行、超限后拒绝', async () => {
    const db = makeDb()
    const results: boolean[] = []
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit(db, '1.2.3.4', 3))
    expect(results).toEqual([true, true, true, false])
  })

  it('不同 IP 计数互相独立', async () => {
    const db = makeDb()
    expect(await checkRateLimit(db, '1.1.1.1', 1)).toBe(true)
    expect(await checkRateLimit(db, '2.2.2.2', 1)).toBe(true)
    expect(await checkRateLimit(db, '1.1.1.1', 1)).toBe(false)
  })

  it('D1 异常时：统计端点降级放行，strict 生成路径拒绝', async () => {
    expect(await checkRateLimit(makeDb({ fail: true }), '1.2.3.4', 10)).toBe(true)
    expect(await checkRateLimit(makeDb({ fail: true }), '1.2.3.4', 10, true)).toBe(false)
  })
})

describe('bumpDailyCounter（全站每日熔断）', () => {
  it('同日累计计数，超过上限后拒绝', async () => {
    const db = makeDb()
    expect(await bumpDailyCounter(db, 'insight-gen', 2)).toBe(true)
    expect(await bumpDailyCounter(db, 'insight-gen', 2)).toBe(true)
    expect(await bumpDailyCounter(db, 'insight-gen', 2)).toBe(false)
    // 被拒后计数继续增长，保持拒绝状态
    expect(await bumpDailyCounter(db, 'insight-gen', 2)).toBe(false)
  })

  it('不同计数名互相独立', async () => {
    const db = makeDb()
    expect(await bumpDailyCounter(db, 'a', 1)).toBe(true)
    expect(await bumpDailyCounter(db, 'b', 1)).toBe(true)
    expect(await bumpDailyCounter(db, 'a', 1)).toBe(false)
  })

  it('D1 异常时：strict 拒绝生成，非 strict 放行', async () => {
    expect(await bumpDailyCounter(makeDb({ fail: true }), 'x', 5, true)).toBe(false)
    expect(await bumpDailyCounter(makeDb({ fail: true }), 'x', 5)).toBe(true)
  })
})

describe('tokenEquals（预热令牌恒定时间比较）', () => {
  const token = 'a'.repeat(48)

  it('相同令牌通过，不同令牌拒绝', async () => {
    expect(await tokenEquals(token, token)).toBe(true)
    expect(await tokenEquals(token, 'b'.repeat(48))).toBe(false)
  })

  it('长度不同或为空直接拒绝', async () => {
    expect(await tokenEquals(token, token.slice(0, 47))).toBe(false)
    expect(await tokenEquals('', token)).toBe(false)
    expect(await tokenEquals(token, '')).toBe(false)
  })
})
