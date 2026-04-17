import charactersData from '../data/characters.json' with { type: 'json' }
import characterProbabilitiesData from '../data/characterProbabilities.json' with { type: 'json' }

export type RarityTierId = 'ur' | 'ssr' | 'sr' | 'r' | 'ex'

export interface CharacterRarityMeta {
  tier: RarityTierId
  rank: number
  total: number
  rarityIndex: number
  probability: number
  rarerThanPercent: number
  topPercent: number
  rangeStartPercent: number
  rangeEndPercent: number
  startRank: number
  endRank: number
}

const probabilityDataset = characterProbabilitiesData as {
  probabilities: Record<string, number>
}

const characterDataset = charactersData as Array<{
  id: string
  hidden?: boolean
}>

const hiddenCharacterIds = new Set(
  characterDataset
    .filter((character) => character.hidden)
    .map((character) => character.id),
)

const rarityPlan: Array<{ tier: Exclude<RarityTierId, 'ex'>; cumulativeShare: number }> = [
  { tier: 'ur', cumulativeShare: 0.02 },
  { tier: 'ssr', cumulativeShare: 0.07 },
  { tier: 'sr', cumulativeShare: 0.2 },
  { tier: 'r', cumulativeShare: 1 },
]

const rankedNormalCharacters = Object.entries(probabilityDataset.probabilities)
  .filter(([characterId]) => !hiddenCharacterIds.has(characterId))
  .sort((left, right) => {
    if (left[1] !== right[1]) {
      return left[1] - right[1]
    }

    return left[0].localeCompare(right[0])
  })

const totalCharacters = rankedNormalCharacters.length
const totalProbability = rankedNormalCharacters.reduce((sum, [, probability]) => sum + probability, 0)

const rarityMetaMap = new Map<string, CharacterRarityMeta>()

let runningProbability = 0
let currentTierIndex = 0
let currentBucketStartRank = 1
let currentBucketStartShare = 0
let currentBucketTier = rarityPlan[0].tier
let bucketRanks: number[] = []
let bucketCharacterIds: string[] = []

rankedNormalCharacters.forEach(([characterId, probability], index) => {
  const rank = index + 1
  const nextRunningProbability = runningProbability + probability
  const nextShare = totalProbability > 0 ? nextRunningProbability / totalProbability : 0

  while (
    currentTierIndex < rarityPlan.length - 1
    && nextShare > rarityPlan[currentTierIndex].cumulativeShare
  ) {
    currentTierIndex += 1
  }

  const tier = rarityPlan[currentTierIndex].tier

  if (bucketRanks.length > 0 && tier !== currentBucketTier) {
    finalizeBucket(currentBucketTier, bucketRanks, bucketCharacterIds, currentBucketStartShare, runningProbability / totalProbability)
    currentBucketTier = tier
    currentBucketStartRank = rank
    currentBucketStartShare = runningProbability / totalProbability
    bucketRanks = []
    bucketCharacterIds = []
  }

  bucketRanks.push(rank)
  bucketCharacterIds.push(characterId)
  runningProbability = nextRunningProbability

  if (rank === totalCharacters) {
    finalizeBucket(currentBucketTier, bucketRanks, bucketCharacterIds, currentBucketStartShare, nextShare)
  }
})

Object.entries(probabilityDataset.probabilities)
  .filter(([characterId]) => hiddenCharacterIds.has(characterId))
  .sort((left, right) => left[0].localeCompare(right[0]))
  .forEach(([characterId, probability], index, entries) => {
    rarityMetaMap.set(characterId, {
      tier: 'ex',
      rank: index + 1,
      total: entries.length,
      rarityIndex: getRarityIndex(probability),
      probability,
      rarerThanPercent: entries.length > 1
        ? Math.round(((entries.length - index - 1) / (entries.length - 1)) * 100)
        : 0,
      topPercent: 100,
      rangeStartPercent: 0,
      rangeEndPercent: 100,
      startRank: 1,
      endRank: entries.length,
    })
  })

function finalizeBucket(
  tier: Exclude<RarityTierId, 'ex'>,
  ranks: number[],
  characterIds: string[],
  rangeStartShare: number,
  rangeEndShare: number,
) {
  const startRank = currentBucketStartRank
  const endRank = ranks[ranks.length - 1]
  const rangeStartPercent = Math.round(rangeStartShare * 100)
  const rangeEndPercent = Math.round(rangeEndShare * 100)

  characterIds.forEach((characterId, bucketIndex) => {
    const rank = ranks[bucketIndex]
    const probability = probabilityDataset.probabilities[characterId] ?? 0

    rarityMetaMap.set(characterId, {
      tier,
      rank,
      total: totalCharacters,
      rarityIndex: getRarityIndex(probability),
      probability,
      rarerThanPercent: totalCharacters > 1
        ? Math.round(((totalCharacters - rank) / (totalCharacters - 1)) * 100)
        : 0,
      topPercent: rangeEndPercent,
      rangeStartPercent,
      rangeEndPercent,
      startRank,
      endRank,
    })
  })
}

function getRarityIndex(probability: number) {
  const safeProbability = Math.max(probability / 100, 0.000001)
  return Number((-Math.log2(safeProbability)).toFixed(1))
}

export function getCharacterRarityMeta(characterId: string | null | undefined): CharacterRarityMeta | null {
  if (!characterId) {
    return null
  }

  return rarityMetaMap.get(characterId) ?? null
}
