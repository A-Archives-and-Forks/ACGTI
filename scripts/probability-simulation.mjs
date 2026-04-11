import { calculateQuizResult } from '../src/utils/quizEngine.ts'
import questions from '../src/data/questions.json' with { type: 'json' }
import archetypes from '../src/data/archetypes.json' with { type: 'json' }
import characters from '../src/data/characters.json' with { type: 'json' }

function createRng(seed) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function clampAnswer(value) {
  return Math.max(-3, Math.min(3, value))
}

function perturbAnswers(answers, rng) {
  return answers.map((answer) => {
    const roll = rng()

    if (roll < 0.08) return clampAnswer(answer - 1)
    if (roll < 0.16) return clampAnswer(answer + 1)
    if (roll < 0.18) return clampAnswer(answer - 2)
    if (roll < 0.2) return clampAnswer(answer + 2)

    return answer
  })
}

const answerScale = [-3, -2, -1, 0, 1, 2, 3]
const rng = createRng(20260411)
const globalRuns = 40000
const localRuns = 480
const perturbRuns = 120
const winnerCounts = new Map()
const probabilityBuckets = new Map()

for (let index = 0; index < globalRuns; index += 1) {
  const answers = questions.map(() => answerScale[Math.floor(rng() * answerScale.length)])
  const result = calculateQuizResult({
    answers,
    questions,
    archetypes,
    characters,
    includeProbabilityEstimate: false,
  })
  const winnerId = result.featuredCharacter?.id ?? 'unknown'

  winnerCounts.set(winnerId, (winnerCounts.get(winnerId) ?? 0) + 1)

  if (index >= localRuns) {
    continue
  }

  let winnerHits = 0
  for (let retry = 0; retry < perturbRuns; retry += 1) {
    const rerun = calculateQuizResult({
      answers: perturbAnswers(answers, rng),
      questions,
      archetypes,
      characters,
      includeProbabilityEstimate: false,
    })

    if ((rerun.featuredCharacter?.id ?? 'unknown') === winnerId) {
      winnerHits += 1
    }
  }

  const stabilityPct = Math.round((winnerHits / perturbRuns) * 100)
  const bucketKey = Math.floor(stabilityPct / 5) * 5
  const bucket = probabilityBuckets.get(bucketKey) ?? { count: 0, stability: 0 }
  bucket.count += 1
  bucket.stability += winnerHits / perturbRuns
  probabilityBuckets.set(bucketKey, bucket)
}

const topWinners = [...winnerCounts.entries()]
  .sort((left, right) => right[1] - left[1])
  .slice(0, 10)
  .map(([id, count]) => ({
    id,
    count,
    pct: Number(((count / globalRuns) * 100).toFixed(2)),
  }))

const probabilitySummary = [...probabilityBuckets.entries()]
  .sort((left, right) => left[0] - right[0])
  .map(([bucketKey, value]) => ({
    bucket: `${bucketKey}-${bucketKey + 4}`,
    samples: value.count,
    avgStabilityPct: Number(((value.stability / value.count) * 100).toFixed(1)),
  }))

console.log(JSON.stringify({
  seed: 20260411,
  globalRuns,
  localRuns,
  perturbRuns,
  topWinners,
  probabilitySummary,
}, null, 2))
