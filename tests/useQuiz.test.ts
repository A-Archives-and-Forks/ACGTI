// useQuiz 状态机测试：composable 的数据/状态是模块级单例，每个用例用
// vi.resetModules + 动态导入获取全新模块实例；localStorage 用内存 Map stub
// （方式承袭 tests/storage.test.ts），并记录全部读写操作供幂等/卫兵断言。
import { afterEach, describe, expect, it, vi } from 'vitest'

const LAST_RECORD_KEY = 'acgti:last-result'
const PROGRESS_KEY = 'acgti:quiz-progress'
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface Op { op: 'get' | 'set' | 'remove'; key: string }

async function setupQuiz(preloaded: Record<string, string> = {}) {
  vi.resetModules()
  const store = new Map<string, string>(Object.entries(preloaded))
  const ops: Op[] = []
  const localStorageStub = {
    getItem: (key: string) => {
      ops.push({ op: 'get', key })
      return store.get(key) ?? null
    },
    setItem: (key: string, value: string) => {
      ops.push({ op: 'set', key })
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      ops.push({ op: 'remove', key })
      store.delete(key)
    },
  }
  // useQuiz 模块顶层就会读 localStorage（恢复最近记录），stub 必须先于动态导入
  vi.stubGlobal('window', { localStorage: localStorageStub })
  const mod = await import('../src/composables/useQuiz.ts')
  return { quiz: mod.useQuiz(), store, ops }
}

/** 预置一条旧版（无 submissionId）的完成记录 */
function legacyRecordJson() {
  return JSON.stringify({
    answers: [1, -1, 2],
    createdAt: '2026-08-01T00:00:00.000Z',
    result: {
      code: 'TIGA',
      mbtiCode: 'ISFP',
      characterMatches: [],
      topCharacterMatches: [],
      featuredCharacter: null,
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useQuiz 状态机', () => {
  it('ensureData 后题库就绪，进度为空白 39 题', async () => {
    const { quiz } = await setupQuiz()
    await quiz.ensureData()
    expect(quiz.questions.value).toHaveLength(39)
    expect(quiz.state.answers).toHaveLength(39)
    expect(quiz.state.answers.every((v) => v === -10)).toBe(true) // 全部 UNANSWERED
    expect(quiz.state.startedAt).toBeNull()
    expect(quiz.isComplete.value).toBe(false)
  })

  it('selectOptionAt 卫兵：非法值与越界下标不生效、不写进度', async () => {
    const { quiz, store } = await setupQuiz()
    await quiz.ensureData()

    // 非法值：UNANSWERED 哨兵与量程外的数字都不是有效作答
    quiz.selectOptionAt(0, -10)
    quiz.selectOptionAt(0, 99)
    quiz.selectOptionAt(0, Number.NaN)
    // 越界下标：负数与 >= 题数
    quiz.selectOptionAt(-1, 2)
    quiz.selectOptionAt(39, 2)

    expect(quiz.state.answers.filter((v) => v !== -10)).toHaveLength(0)
    expect(quiz.state.startedAt).toBeNull()
    expect(store.has(PROGRESS_KEY)).toBe(false)
  })

  it('selectOptionAt 合法作答：记录答案、启动计时并持久化进度', async () => {
    const { quiz, store } = await setupQuiz()
    await quiz.ensureData()

    quiz.selectOptionAt(0, 2)
    expect(quiz.state.answers[0]).toBe(2)
    expect(quiz.state.startedAt).toBeTruthy()
    expect(quiz.answeredCount.value).toBe(1)

    const saved = JSON.parse(store.get(PROGRESS_KEY)!)
    expect(saved.answers[0]).toBe(2)
    expect(saved.answers).toHaveLength(39)
  })

  it('finalizeQuiz 未完成：返回 null 且不清除进行中的进度', async () => {
    const { quiz, store } = await setupQuiz()
    await quiz.ensureData()
    quiz.selectOptionAt(0, 1)

    expect(quiz.finalizeQuiz()).toBeNull()
    expect(store.has(PROGRESS_KEY)).toBe(true)
    expect(quiz.latestResult.value).toBeNull()
  })

  it('finalizeQuiz 完成：产出结果、清进度并写入含 v4 submissionId 的记录', async () => {
    const { quiz, store } = await setupQuiz()
    await quiz.ensureData()
    // 交替作答制造有区分度的画像
    quiz.questions.value.forEach((_, i) => quiz.selectOptionAt(i, i % 2 === 0 ? 2 : -1))

    expect(quiz.isComplete.value).toBe(true)
    const result = quiz.finalizeQuiz()
    expect(result).not.toBeNull()
    expect(/^[EI][SN][TF][JP]$/.test(result!.mbtiCode)).toBe(true)

    // 进度被清除，最近记录被写入
    expect(store.has(PROGRESS_KEY)).toBe(false)
    const saved = JSON.parse(store.get(LAST_RECORD_KEY)!)
    expect(saved.submissionId).toMatch(UUID_V4_RE)
    expect(saved.answers).toHaveLength(39)
    expect(quiz.latestResult.value?.code).toBe(result!.code)
  })

  it('ensureSubmissionId：旧记录无 id 时兜底生成、回写并保持幂等', async () => {
    const { quiz, store } = await setupQuiz({ [LAST_RECORD_KEY]: legacyRecordJson() })

    const first = quiz.ensureSubmissionId()
    expect(first).toMatch(UUID_V4_RE)
    // 回写后的记录带上 submissionId
    expect(JSON.parse(store.get(LAST_RECORD_KEY)!).submissionId).toBe(first)
    // 再次调用返回同一 id（幂等，不重复生成）
    expect(quiz.ensureSubmissionId()).toBe(first)
  })

  it('ensureSubmissionId：无任何历史记录时也能生成 id（不写库）', async () => {
    const { quiz, store } = await setupQuiz()
    const id = quiz.ensureSubmissionId()
    expect(id).toMatch(UUID_V4_RE)
    expect(store.has(LAST_RECORD_KEY)).toBe(false)
  })

  it('createUuid 兜底：randomUUID 抛错时用 getRandomValues 手拼合法 v4', async () => {
    const { quiz, store } = await setupQuiz()
    // 模拟非安全上下文：原生 randomUUID 不可用，走 getRandomValues 兜底路径
    vi.stubGlobal('crypto', {
      randomUUID: () => {
        throw new TypeError('randomUUID is not available')
      },
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = (i * 37 + 11) & 0xff
        return arr
      },
    })
    await quiz.ensureData()
    quiz.questions.value.forEach((_, i) => quiz.selectOptionAt(i, 1))

    const result = quiz.finalizeQuiz()
    expect(result).not.toBeNull()
    const saved = JSON.parse(store.get(LAST_RECORD_KEY)!)
    expect(saved.submissionId).toMatch(UUID_V4_RE)
  })

  it('ensureData 幂等：二次调用不重跑初始化（进度清理只执行一次）', async () => {
    // 无预置进度：首次 ensureData 走"空进度清理"分支（removeItem 一次）；
    // 若幂等保护失效，第二次会再次执行 clearQuizProgress（第二次 removeItem）
    const { quiz, ops } = await setupQuiz()
    await quiz.ensureData()

    // 两次调用之间插入作答，验证二次调用不会重置状态
    quiz.selectOptionAt(0, 3)
    const refBefore = quiz.questions.value
    await quiz.ensureData()

    expect(quiz.questions.value).toBe(refBefore) // 引用不变：未重复赋值
    expect(quiz.state.answers[0]).toBe(3) // 作答保留
    expect(quiz.state.startedAt).toBeTruthy()
    expect(ops.filter((o) => o.op === 'remove' && o.key === PROGRESS_KEY)).toHaveLength(1)
  })

  it('ensureData 进度恢复：题数一致的预置进度被恢复', async () => {
    const progress = JSON.stringify({
      answers: Array.from({ length: 39 }, (_, i) => (i === 0 ? 2 : -10)),
      startedAt: '2026-08-20T10:00:00.000Z',
    })
    const { quiz } = await setupQuiz({ [PROGRESS_KEY]: progress })
    await quiz.ensureData()

    expect(quiz.state.answers[0]).toBe(2)
    expect(quiz.state.startedAt).toBe('2026-08-20T10:00:00.000Z')
    expect(quiz.answeredCount.value).toBe(1)
  })
})
