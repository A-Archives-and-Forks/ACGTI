import { computed, reactive, readonly, ref } from 'vue'

import type { Archetype, CharacterMatch, Question, QuizRecord, QuizResult } from '../types/quiz'
import { hydrateCharacterVisual, hydrateQuizRecord } from '../utils/characterVisuals'
import { calculateQuizResult, createDebugQuizResult } from '../utils/quizEngine'
import { clearLastRecord, loadLastRecord, saveLastRecord } from '../utils/storage'

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

// 数据是否已就绪
const dataReady = computed(() => questions.value.length > 0)

const UNANSWERED = -10

function isAnsweredValue(value: number) {
  return value >= -3 && value <= 3
}

const emptyAnswers = () => Array.from({ length: questions.value.length }, () => UNANSWERED)

const state = reactive({
  currentIndex: 0,
  answers: emptyAnswers(),
  startedAt: null as string | null,
  latestRecord: hydrateQuizRecord(loadLastRecord() as QuizRecord | null),
})

const currentQuestion = computed(() => questions.value[state.currentIndex] ?? null)
const selectedOptionIndex = computed(() => state.answers[state.currentIndex] ?? UNANSWERED)
const progress = computed(() => (questions.value.length ? (state.currentIndex + 1) / questions.value.length : 0))
const answeredCount = computed(() => state.answers.filter((answer) => isAnsweredValue(answer)).length)
const firstUnansweredIndex = computed(() => state.answers.findIndex((answer) => !isAnsweredValue(answer)))
const canGoNext = computed(() => isAnsweredValue(selectedOptionIndex.value))
const canGoPrev = computed(() => state.currentIndex > 0)
const isComplete = computed(() => state.answers.every((answer) => isAnsweredValue(answer)))
const latestResult = computed(() => state.latestRecord?.result ?? null)

function selectOption(optionIndex: number) {
  if (!isAnsweredValue(optionIndex)) return
  if (!state.startedAt) {
    state.startedAt = new Date().toISOString()
  }
  state.answers[state.currentIndex] = optionIndex
}

function selectOptionAt(questionIndex: number, optionValue: number) {
  if (!isAnsweredValue(optionValue)) return
  if (questionIndex < 0 || questionIndex >= questions.value.length) return
  if (!state.startedAt) {
    state.startedAt = new Date().toISOString()
  }
  state.answers[questionIndex] = optionValue
}

function goNext() {
  if (canGoNext.value && state.currentIndex < questions.value.length - 1) {
    state.currentIndex += 1
  }
}

function goPrev() {
  if (canGoPrev.value) {
    state.currentIndex -= 1
  }
}

function jumpToQuestion(index: number) {
  if (index >= 0 && index < questions.value.length) {
    state.currentIndex = index
  }
}

function resetQuiz(clearHistory = false) {
  state.currentIndex = 0
  state.answers = emptyAnswers()
  state.startedAt = null

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

  return result
}

function resumeLastResult() {
  state.latestRecord = hydrateQuizRecord(loadLastRecord())
}

export function useQuiz() {
  return {
    // 异步初始化：调用方在需要数据时 await
    ensureData: async () => {
      const data = await loadQuizData()
      questions.value = data.questions
      archetypes.value = data.archetypes
      characters.value = data.characters
      // 如果 answers 长度和 questions 不匹配，重置
      if (state.answers.length !== questions.value.length) {
        state.answers = emptyAnswers()
      }
    },
    dataReady,
    questions,
    archetypes,
    characters,
    state: readonly(state),
    currentQuestion,
    selectedOptionIndex,
    progress,
    answeredCount,
    firstUnansweredIndex,
    canGoNext,
    canGoPrev,
    isComplete,
    latestResult,
    selectOption,
    selectOptionAt,
    goNext,
    goPrev,
    jumpToQuestion,
    resetQuiz,
    finalizeQuiz,
    resumeLastResult,
    createDebugResult: (characterId: string): QuizResult | null =>
      createDebugQuizResult({
        characterId,
        archetypes: archetypes.value,
        characters: characters.value,
      }),
  }
}
