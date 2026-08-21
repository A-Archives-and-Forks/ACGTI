import { afterEach, describe, expect, it, vi } from 'vitest'

import { UNANSWERED } from '../src/types/quiz.ts'
import {
  clearLastRecord,
  clearQuizProgress,
  loadLastRecord,
  loadQuizProgress,
  saveLastRecord,
  saveQuizProgress,
} from '../src/utils/storage.ts'

// 用内存 Map 模拟 localStorage，逐用例重置
function stubLocalStorage() {
  const store = new Map<string, string>()
  const localStorageStub = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
  }
  vi.stubGlobal('window', { localStorage: localStorageStub })
  return store
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lastRecord 持久化', () => {
  it('保存后可完整读回', () => {
    stubLocalStorage()
    // 本用例只验证序列化往返，result 用占位对象避免构造完整 QuizResult
    const record = {
      answers: [1, -2, 0],
      createdAt: '2026-08-21T00:00:00.000Z',
      startedAt: '2026-08-21T00:00:00.000Z',
      result: null,
    } as unknown as Parameters<typeof saveLastRecord>[0]
    saveLastRecord(record)
    expect(loadLastRecord()).toEqual(record)
  })

  it('损坏 JSON 清理后返回 null', () => {
    const store = stubLocalStorage()
    store.set('acgti:last-result', '{broken')
    expect(loadLastRecord()).toBeNull()
    expect(store.has('acgti:last-result')).toBe(false)
  })

  it('clearLastRecord 清空存储', () => {
    const store = stubLocalStorage()
    saveLastRecord({ answers: [], createdAt: '', result: null } as unknown as Parameters<typeof saveLastRecord>[0])
    clearLastRecord()
    expect(store.has('acgti:last-result')).toBe(false)
  })
})

describe('quizProgress 持久化', () => {
  it('进度往返一致', () => {
    stubLocalStorage()
    saveQuizProgress({ answers: [1, 2, -3, UNANSWERED], startedAt: '2026-08-21T00:00:00.000Z' })
    expect(loadQuizProgress()).toEqual({
      answers: [1, 2, -3, UNANSWERED],
      startedAt: '2026-08-21T00:00:00.000Z',
    })
  })

  it('answers 非数字数组时返回 null', () => {
    stubLocalStorage()
    window.localStorage.setItem('acgti:quiz-progress', JSON.stringify({ answers: ['a', 1], startedAt: null }))
    expect(loadQuizProgress()).toBeNull()
  })

  it('缺失 answers 字段返回 null', () => {
    stubLocalStorage()
    window.localStorage.setItem('acgti:quiz-progress', JSON.stringify({ startedAt: 'x' }))
    expect(loadQuizProgress()).toBeNull()
  })

  it('startedAt 缺失时回退为 null 而不是抛错', () => {
    stubLocalStorage()
    window.localStorage.setItem('acgti:quiz-progress', JSON.stringify({ answers: [0, 1] }))
    expect(loadQuizProgress()).toEqual({ answers: [0, 1], startedAt: null })
  })

  it('损坏 JSON 清理后返回 null', () => {
    const store = stubLocalStorage()
    store.set('acgti:quiz-progress', 'not-json')
    expect(loadQuizProgress()).toBeNull()
    expect(store.has('acgti:quiz-progress')).toBe(false)
  })

  it('clearQuizProgress 清空存储', () => {
    const store = stubLocalStorage()
    saveQuizProgress({ answers: [], startedAt: null })
    clearQuizProgress()
    expect(store.has('acgti:quiz-progress')).toBe(false)
  })
})

describe('SSR 防御', () => {
  it('无 window 环境静默降级', () => {
    expect(loadLastRecord()).toBeNull()
    expect(loadQuizProgress()).toBeNull()
    expect(() => saveQuizProgress({ answers: [], startedAt: null })).not.toThrow()
    expect(() => clearQuizProgress()).not.toThrow()
  })
})