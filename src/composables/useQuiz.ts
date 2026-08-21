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
    submissionId: crypto.randomUUID(),
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

  const newId = crypto.randomUUID()
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
