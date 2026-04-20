import { parentPort, workerData } from 'node:worker_threads'

import { calculateCharacterProbabilityWeights, calculateQuizResult } from '../src/utils/quizEngine.ts'
import questions from '../src/data/questions.json' with { type: 'json' }
import archetypes from '../src/data/archetypes.json' with { type: 'json' }
import characters from '../src/data/characters.json' with { type: 'json' }

const LCG_A = 1664525
const LCG_C = 1013904223
const LCG_M = 0x100000000

function geometricSum(a, n, m) {
  if (n === 0) return 0n
  if (n === 1) return 1n

  const aBig = BigInt(a)
  const mBig = BigInt(m)

  if (n % 2 === 0) {
    const half = geometricSum(a, n / 2, m)
    const aPowHalf = powMod(aBig, BigInt(n / 2), mBig)
    return (half * (1n + aPowHalf)) % mBig
  } else {
    const prev = geometricSum(a, n - 1, m)
    const aPowPrev = powMod(aBig, BigInt(n - 1), mBig)
    return (prev + aPowPrev) % mBig
  }
}

function powMod(base, exp, mod) {
  let result = 1n
  base = base % mod
  while (exp > 0n) {
    if (exp & 1n) {
      result = (result * base) % mod
    }
    base = (base * base) % mod
    exp >>= 1n
  }
  return result
}

function getNthState(state0, n) {
  if (n === 0) return state0 >>> 0

  const aBig = BigInt(LCG_A)
  const mBig = BigInt(LCG_M)

  const aPowN = powMod(aBig, BigInt(n), mBig)
  const sumCoef = geometricSum(LCG_A, n, mBig)

  const part1 = (aPowN * BigInt(state0)) % mBig
  const part2 = (BigInt(LCG_C) * sumCoef) % mBig

  return Number((part1 + part2) % mBig)
}

const answerScale = [-3, -2, -1, 0, 1, 2, 3]

const { startIndex, runs, mainSeed, questionsPerRun } = workerData

const initialState = getNthState(mainSeed, startIndex * questionsPerRun)
let rngState = initialState

const winnerCounts = new Map(characters.map((character) => [character.id, 0]))
const probabilityWeights = new Map(characters.map((character) => [character.id, 0]))

for (let i = 0; i < runs; i++) {
  const answers = []
  for (let q = 0; q < questionsPerRun; q++) {
    rngState = (rngState * LCG_A + LCG_C) >>> 0
    answers.push(answerScale[Math.floor((rngState / LCG_M) * answerScale.length)])
  }

  const result = calculateQuizResult({
    answers,
    questions,
    archetypes,
    characters,
  })
  const winnerId = result.featuredCharacter?.id
  if (winnerId) {
    winnerCounts.set(winnerId, (winnerCounts.get(winnerId) ?? 0) + 1)
  }

  const weights = calculateCharacterProbabilityWeights({
    answers,
    questions,
    archetypes,
    characters,
  })

  for (const item of weights) {
    probabilityWeights.set(
      item.characterId,
      (probabilityWeights.get(item.characterId) ?? 0) + item.weight,
    )
  }
}

parentPort.postMessage({
  winnerCounts: Array.from(winnerCounts.entries()),
  probabilityWeights: Array.from(probabilityWeights.entries()),
})
