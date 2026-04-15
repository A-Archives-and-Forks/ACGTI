import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { calculateCharacterProbabilityWeights, calculateQuizResult } from '../src/utils/quizEngine.ts'
import questions from '../src/data/questions.json' with { type: 'json' }
import archetypes from '../src/data/archetypes.json' with { type: 'json' }
import characters from '../src/data/characters.json' with { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outputPath = path.join(root, 'src/data/characterProbabilities.json')
const cliArgs = process.argv.slice(2)
const positionalArgs = cliArgs.filter((arg) => !arg.startsWith('--'))

function createRng(seed) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const answerScale = [-3, -2, -1, 0, 1, 2, 3]
const seed = Number(positionalArgs[0] ?? 20260411)
const runs = Number(positionalArgs[1] ?? 200000)
const shouldWrite = cliArgs.includes('--write')
const rng = createRng(seed)
const winnerCounts = new Map(characters.map((character) => [character.id, 0]))
const probabilityWeights = new Map(characters.map((character) => [character.id, 0]))

function roundProbability(value) {
  if (value >= 0.01) {
    return Number(value.toFixed(4))
  }

  if (value >= 0.0001) {
    return Number(value.toFixed(6))
  }

  return Number(value.toPrecision(8))
}

function buildRoundedProbabilities(weightEntries, runCount) {
  const sortedEntries = [...weightEntries]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'en'))

  const roundedEntries = sortedEntries.map(([id, accumulatedWeight]) => [
    id,
    roundProbability((accumulatedWeight / runCount) * 100),
  ])

  const roundedTotal = roundedEntries.reduce((sum, [, value]) => sum + value, 0)
  const roundingDelta = Number((100 - roundedTotal).toFixed(8))

  if (roundedEntries.length && roundingDelta !== 0) {
    roundedEntries[0][1] = Number((roundedEntries[0][1] + roundingDelta).toFixed(8))
  }

  return Object.fromEntries(roundedEntries)
}

for (let index = 0; index < runs; index += 1) {
  const answers = questions.map(() => answerScale[Math.floor(rng() * answerScale.length)])
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

const probabilities = buildRoundedProbabilities(probabilityWeights.entries(), runs)

const entries = [...probabilityWeights.entries()]
  .sort((left, right) => right[1] - left[1])
  .map(([id, accumulatedWeight]) => ({
    id,
    displayWeight: accumulatedWeight,
    displayProbability: probabilities[id],
    winnerCount: winnerCounts.get(id) ?? 0,
    probability: probabilities[id],
  }))

const payload = {
  seed,
  runs,
  method: 'softmax-score-share',
  probabilities,
  entries,
}

if (shouldWrite) {
  fs.writeFileSync(
    outputPath,
    JSON.stringify({
      seed,
      runs,
      method: 'softmax-score-share',
      probabilities,
    }, null, 2) + '\n',
  )
  console.log(`Updated ${path.relative(root, outputPath)} with ${runs} runs (seed=${seed}).`)
} else {
  console.log(JSON.stringify(payload, null, 2))
}
