import type { QuizRecord } from '../types/quiz'

const STORAGE_KEY = 'acgti:last-result'
// 进行中的答题进度，避免刷新/误触返回导致 39 题答案全部丢失
const PROGRESS_KEY = 'acgti:quiz-progress'

export interface QuizProgress {
  answers: number[]
  startedAt: string | null
}

export function loadLastRecord(): QuizRecord | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as QuizRecord
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function saveLastRecord(record: QuizRecord) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
}

export function clearLastRecord() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
}

export function saveQuizProgress(progress: QuizProgress) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
}

export function loadQuizProgress(): QuizProgress | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(PROGRESS_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<QuizProgress>
    if (!Array.isArray(parsed.answers) || parsed.answers.some((v) => typeof v !== 'number')) {
      return null
    }
    return {
      answers: parsed.answers,
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : null,
    }
  } catch {
    window.localStorage.removeItem(PROGRESS_KEY)
    return null
  }
}

export function clearQuizProgress() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(PROGRESS_KEY)
}

