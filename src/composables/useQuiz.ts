import { computed, reactive, readonly, ref } from 'vue'

import type { Archetype, CharacterMatch, Question, QuizRecord, QuizResult } from '../types/quiz'
import { UNANSWERED, isAnsweredValue } from '../types/quiz'
import { hydrateCharacterVisual, hydrateQuizRecord } from '../utils/characterVisuals'
import { calculateQuizResult, createDebugQuizResult } from '../utils/quizEngine'
import {
  clearLastRecord,
  clearQuizProgress,
  loadLastRecord,
  loadQuizProgress,
  saveLastRecord,
  saveQuizProgress,
} from '../utils/storage'

// ── 异步加载数据 ──────────────────────────────────────────
// 数据不再顶层静态导入，改为首次使用时按需异步加载
let quizDataPromise: Promise<{
  questions: Question[]
  archetypes: Archetype[]
  characters: CharacterMatch[]
}> | null = null

function loadQuizData() {
  if (!quizDataPromise) {
    quizDataPromise = Promise.all([
      import('../data/questions.json'),
      import('../data/archetypes.json'),
      import('../data/characters.json'),
    ]).then(([q, a, c]) => ({
      questions: q.default as Question[],
      archetypes: a.default as Archetype[],
      characters: (c.default as CharacterMatch[]).map(hydrateCharacterVisual),
    }))
  }
  return quizDataPromise
}

// ── 同步数据引用（数据加载完毕后赋值） ──────────────────────
const questions = ref<Question[]>([])
const archetypes = ref<Archetype[]>([])
const characters = ref<CharacterMatch[]>([])

// 题库是否已完成首次注入：QuizPage 与 ResultPage 会各调一次 ensureData，
// 用该标志做幂等保护，跳过重复赋值与重复的进度恢复
let quizDataReady = false

// crypto.randomUUID 在旧浏览器或非安全上下文（如非 HTTPS 环境）会抛 TypeError，
// 这里做兜底：优先原生 randomUUID，异常时用 getRandomValues 手拼 v4 格式
function createUuid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    // 原生实现不可用，落到下方手拼逻辑
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  // 按 RFC 4122 v4 设置 version 与 variant 位
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const emptyAnswers = () => Array.from({ length: questions.value.length }, () => UNANSWERED)

const state = reactive({
  answers: [] as number[],
  startedAt: null as string | null,
  latestRecord: hydrateQuizRecord(loadLastRecord()),
})

const answeredCount = computed(() => state.answers.filter((answer) => isAnsweredValue(answer)).length)
const firstUnansweredIndex = computed(() => state.answers.findIndex((answer) => !isAnsweredValue(answer)))
const isComplete = computed(() => state.answers.length > 0 && state.answers.every((answer) => isAnsweredValue(answer)))
const latestResult = computed(() => state.latestRecord?.result ?? null)

function persistProgress() {
  if (!state.startedAt) return
  saveQuizProgress({ answers: [...state.answers], startedAt: state.startedAt })
}

function selectOptionAt(questionIndex: number, optionValue: number) {
  if (!isAnsweredValue(optionValue)) return
  if (questionIndex < 0 || questionIndex >= questions.value.length) return
  if (!state.startedAt) {
    state.startedAt = new Date().toISOString()
  }
  state.answers[questionIndex] = optionValue
  persistProgress()
}

function resetQuiz(clearHistory = false) {
  state.answers = emptyAnswers()
  state.startedAt = null
  clearQuizProgress()

  if (clearHistory) {
    state.latestRecord = null
    clearLastRecord()
  }
}

function finalizeQuiz(): QuizResult | null {
  if (!isComplete.value) {
    return null
  }

  const result = calculateQuizResult({
    answers: state.answers,
    questions: questions.value,
    archetypes: archetypes.value,
    characters: characters.value,
  })

  const record: QuizRecord = {
    answers: [...state.answers],
    createdAt: new Date().toISOString(),
    startedAt: state.startedAt || undefined,
    submissionId: createUuid(),
    result,
  }

  state.latestRecord = hydrateQuizRecord(record)
  saveLastRecord(record)
  clearQuizProgress()

  return result
}

function resumeLastResult() {
  state.latestRecord = hydrateQuizRecord(loadLastRecord())
}

/**
 * 兜底保证记录上存在稳定的 submissionId（旧版本记录可能没有）。
 * 通过整体替换记录并回写 localStorage，避免外部直接改写 readonly 状态。
 */
function ensureSubmissionId(): string {
  const record = state.latestRecord
  if (record?.submissionId) {
    return record.submissionId
  }

  const newId = createUuid()
  if (record) {
    const updated: QuizRecord = { ...record, submissionId: newId }
    state.latestRecord = hydrateQuizRecord(updated)
    saveLastRecord(updated)
  }
  return newId
}

export function useQuiz() {
  return {
    // 异步初始化：调用方在需要数据时 await
    ensureData: async () => {
      const data = await loadQuizData()

      // 幂等保护：数据已注入过则直接返回，避免重复赋值触发无谓的响应式更新，
      // 进度恢复也只在首次真实加载时执行一次，行为与单次调用完全一致
      if (quizDataReady) return
      quizDataReady = true

      questions.value = data.questions
      archetypes.value = data.archetypes
      characters.value = data.characters

      // 恢复上次未完成的答题进度（题数一致才可信，防止题库变更后错位）
      const progress = state.answers.length > 0
        ? { answers: state.answers, startedAt: state.startedAt }
        : loadQuizProgress()
      if (progress && progress.answers.length === questions.value.length && progress.startedAt) {
        state.answers = [...progress.answers]
        state.startedAt = progress.startedAt
      } else {
        state.answers = emptyAnswers()
        state.startedAt = null
        clearQuizProgress()
      }
    },
    questions,
    archetypes,
    characters,
    state: readonly(state),
    answeredCount,
    firstUnansweredIndex,
    isComplete,
    latestResult,
    isAnsweredValue,
    selectOptionAt,
    resetQuiz,
    finalizeQuiz,
    resumeLastResult,
    ensureSubmissionId,
    createDebugResult: (characterId: string): QuizResult | null =>
      createDebugQuizResult({
        characterId,
        archetypes: archetypes.value,
        characters: characters.value,
      }),
  }
}
