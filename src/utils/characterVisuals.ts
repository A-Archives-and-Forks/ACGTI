import characterVisualsData from '../data/characterVisuals.json'
import type { CharacterMatch, QuizRecord, QuizResult } from '../types/quiz'

type CharacterVisualMeta = {
  image: string
  accent: string
}

const characterVisuals = characterVisualsData as Record<string, CharacterVisualMeta>

export function resolvePublicAsset(path: string | undefined) {
  if (!path) {
    return ''
  }

  if (/^https?:\/\//.test(path)) {
    return path
  }

  const normalized = path.startsWith('/') ? path.slice(1) : path
  return `${import.meta.env.BASE_URL}${normalized}`
}

export function hydrateCharacterVisual<T extends CharacterMatch>(character: T): T {
  const visual = characterVisuals[character.id]

  const hydrated = {
    ...character,
    image: resolvePublicAsset(visual?.image ?? character.image),
    accent: visual?.accent ?? character.accent,
  }

  return hydrated
}

export function hydrateQuizResult(result: QuizResult | null): QuizResult | null {
  if (!result) {
    return null
  }

  const characterMatches = result.characterMatches.map((character) => hydrateCharacterVisual(character))
  const featuredCharacter = result.featuredCharacter ? hydrateCharacterVisual(result.featuredCharacter) : characterMatches[0] ?? null

  return {
    ...result,
    matchProbability: result.matchProbability ?? result.matchScore ?? 0,
    characterMatches,
    featuredCharacter,
  }
}

export function hydrateQuizRecord(record: QuizRecord | null): QuizRecord | null {
  if (!record) {
    return null
  }

  return {
    ...record,
    result: hydrateQuizResult(record.result) as QuizResult,
  }
}
