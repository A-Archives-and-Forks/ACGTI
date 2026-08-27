// Red Team 对抗测试：输入校验器边界与 insight 角色白名单的原型链绕过
//
// 背景（red team 发现）：insight.ts 的 langCode 白名单已用 Object.hasOwn
// 防原型链键，但 briefs[characterId] 查找未做同样防护——"__proto__" /
// "constructor" 均通过 isValidCode（字符类含下划线），并沿原型链命中
// Object.prototype（truthy），绕过 113 个真实角色的白名单，走到生成路径
// 产生垃圾缓存条目。
//
// 运行: npx vitest run tests/redteam_input_validation.test.ts
import { describe, expect, it } from 'vitest'

import {
  isValidCode,
  isValidMbti,
  isValidUuid,
  num,
  str,
  validateAnswers,
} from '../functions/api/_shared'
import { onRequestPost as insightHandler } from '../functions/api/insight'

// ── 最小 fake D1：first() 恒 null（限流计数 0 → 放行；缓存未命中） ──────────
function makeFakeDb() {
  const prepare = (_sql: string) => ({
    bind: (..._args: unknown[]) => ({
      first: async () => null,
      run: async () => ({ success: true }),
    }),
  })
  return { prepare, batch: async () => [] } as unknown as D1Database
}

function makeInsightContext(characterCode: string) {
  const db = makeFakeDb()
  const context = {
    request: new Request('http://localhost/api/insight', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '203.0.113.7' },
      body: JSON.stringify({
        characterCode,
        lang: 'zh-CN',
        dimensionScores: { ei: 0.8, sn: -0.3, tf: 0.6, jp: -0.1 },
      }),
    }),
    env: { DB: db },
    waitUntil: (_p: Promise<unknown>) => {},
    params: {},
    next: async () => new Response('next-ok'),
  }
  return context
}

async function insightReasonFor(characterCode: string): Promise<string> {
  const res = await insightHandler(makeInsightContext(characterCode) as any)
  const body = await res.json() as { reason?: string }
  return body.reason ?? ''
}

describe('redteam: insight 角色白名单原型链绕过', () => {
  it('"__proto__" 不得绕过 113 角色白名单（应 unknown-character，不得进入生成路径）', async () => {
    expect(isValidCode('__proto__')).toBe(true) // 校验器确实放行该字符串
    // 若返回 no-binding 说明 brief 查找被 Object.prototype 蒙混过关
    expect(await insightReasonFor('__proto__')).toBe('unknown-character')
  })

  it('"constructor" 等原型链键同样被拒', async () => {
    expect(await insightReasonFor('constructor')).toBe('unknown-character')
  })

  it('"hasOwnProperty" 原型方法名同样被拒', async () => {
    expect(await insightReasonFor('hasOwnProperty')).toBe('unknown-character')
  })
})

describe('redteam: 校验器边界（防御有效性）', () => {
  it('isValidMbti 拒绝 NUL 结尾与大小写混合合法形式以外的输入', () => {
    expect(isValidMbti('EITP\0')).toBe(false)
    expect(isValidMbti('EITP\n')).toBe(false)
    expect(isValidMbti('EITP ')).toBe(false)
    expect(isValidMbti('eNtj')).toBe(true) // i 标志下大小写混合合法
    expect(isValidMbti('einp')).toBe(false) // 第 2 位越出 [SN]
    expect(isValidMbti('ＥＩＴＰ')).toBe(false) // 全角同形字符
  })

  it('num 拒绝 NaN/Infinity/越界，-0 与 0 语义等价', () => {
    expect(num(Number.NaN, -1, 1)).toBeNull()
    expect(num(Number.POSITIVE_INFINITY, -1, 1)).toBeNull()
    expect(num(-Number.POSITIVE_INFINITY, -1, 1)).toBeNull()
    expect(num(1.0000001, -1, 1)).toBeNull()
    const minusZero = num(-0, -1, 1)
    expect(minusZero !== null && Math.abs(minusZero) === 0).toBe(true) // -0 通过且与 0 等价
  })

  it('str 对非字符串与超长输入安全截断', () => {
    expect(str(123 as unknown)).toBe('')
    expect(str(null as unknown)).toBe('')
    expect(str(['x'] as unknown)).toBe('')
    expect(str('a'.repeat(500), 32)).toBe('a'.repeat(32))
    // 代理对截断：不抛错（孤立代理项允许落库，消费端按字符串处理）
    expect(() => str('👍'.repeat(300), 1)).not.toThrow()
  })

  it('validateAnswers 拒绝稀疏数组、伪装数组与非法元素', () => {
    const sparse = new Array(30)
    sparse[0] = { questionId: 'q1', answerValue: 1 }
    expect(validateAnswers(sparse)).toBeNull() // hole 元素被拒

    const disguised = { length: 30, 0: { questionId: 'q1', answerValue: 1 } }
    expect(validateAnswers(disguised)).toBeNull() // Array.isArray 为 false

    expect(validateAnswers([null])).toBeNull()
    expect(validateAnswers([42])).toBeNull()
    expect(validateAnswers([{ questionId: 'q1', answerValue: 3 }])).toBeNull()
    // questionId 超长：按 16 位截断清洗后放行（设计行为），确认截断生效
    const truncated = validateAnswers([
      { questionId: 'q'.repeat(100), answerValue: 1 },
    ])
    expect(truncated).toHaveLength(1)
    expect(truncated![0].questionId).toHaveLength(16)
    expect(validateAnswers([{ questionId: '', answerValue: 1 }])).toBeNull()
  })

  it('isValidUuid 拒绝非 v4 版本位与非法变体位', () => {
    expect(isValidUuid('01234567-89ab-cdef-8f01-0123456789ab')).toBe(false) // 版本位 c
    expect(isValidUuid('01234567-89ab-4cde-ff01-0123456789ab')).toBe(false) // 变体位 f
    expect(isValidUuid('0123456789ab4cde8f010123456789ab')).toBe(false) // 无连字符
    expect(isValidUuid('01234567-89AB-4CDE-8F01-0123456789AB')).toBe(true) // 大写合法
  })

  it('isValidCode 拒绝点、冒号、引号等注入字符', () => {
    expect(isValidCode('a.b')).toBe(false)
    expect(isValidCode('a:b')).toBe(false)
    expect(isValidCode("a'b")).toBe(false)
    expect(isValidCode('a%00b')).toBe(false)
    expect(isValidCode('a'.repeat(33))).toBe(false)
  })
})
