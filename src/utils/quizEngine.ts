import type {
  Archetype,
  ArchetypeId,
  CharacterMatch,
  Question,
  QuizResult,
  DimensionPair,
  DimensionScore,
  MBTILetter,
} from '../types/quiz'

const DIMENSION_LETTERS: Record<DimensionPair, [MBTILetter, MBTILetter]> = {
  'E_I': ['E', 'I'],
  'S_N': ['S', 'N'],
  'T_F': ['T', 'F'],
  'J_P': ['J', 'P']
}

const TYPE_TO_ARCHETYPE: Record<string, ArchetypeId> = {
  INTJ: 'shadow-strategist',
  INTP: 'icebound-observer',
  ENTJ: 'oathbound-captain',
  ENTP: 'trickster-orbit',
  INFJ: 'gentle-healer',
  INFP: 'moonlit-guardian',
  ENFJ: 'luminous-lead',
  ENFP: 'trickster-orbit',
  ISTJ: 'moonlit-guardian',
  ISFJ: 'gentle-healer',
  ESTJ: 'oathbound-captain',
  ESFJ: 'luminous-lead',
  ISTP: 'icebound-observer',
  ISFP: 'moonlit-guardian',
  ESTP: 'chaos-spark',
  ESFP: 'chaos-spark',
}

// 16personalities 风格的维度标签配置
export const TRAIT_CONFIG = {
  'E_I': {
    label: 'Energy',
    leftLabel: 'Extraverted',
    rightLabel: 'Introverted',
    leftCN: '外放',
    rightCN: '收束',
    color: '#9b59b6'
  },
  'S_N': {
    label: 'Mind',
    leftLabel: 'Intuitive',
    rightLabel: 'Observant',
    leftCN: '直觉',
    rightCN: '实感',
    color: '#3498db'
  },
  'T_F': {
    label: 'Nature',
    leftLabel: 'Thinking',
    rightLabel: 'Feeling',
    leftCN: '理性',
    rightCN: '共情',
    color: '#e74c3c'
  },
  'J_P': {
    label: 'Tactics',
    leftLabel: 'Judging',
    rightLabel: 'Prospecting',
    leftCN: '判断',
    rightCN: '展望',
    color: '#f39c12'
  }
}

// 角色分类映射（基于 MBTI 类型）
export const ROLE_MAPPING: Record<string, { name: string; description: string }> = {
  // Analysts (INTJ, INTP, ENTJ, ENTP)
  'INTJ': { name: 'Analysts', description: 'Analysts are imaginative and strategic thinkers, with a plan for everything.' },
  'INTP': { name: 'Analysts', description: 'Analysts are imaginative and strategic thinkers, with a plan for everything.' },
  'ENTJ': { name: 'Analysts', description: 'Analysts are imaginative and strategic thinkers, with a plan for everything.' },
  'ENTP': { name: 'Analysts', description: 'Analysts are imaginative and strategic thinkers, with a plan for everything.' },

  // Diplomats (INFJ, INFP, ENFJ, ENFP)
  'INFJ': { name: 'Diplomats', description: 'Diplomats are empathetic and principled, with a deep concern for others.' },
  'INFP': { name: 'Diplomats', description: 'Diplomats are empathetic and principled, with a deep concern for others.' },
  'ENFJ': { name: 'Diplomats', description: 'Diplomats are empathetic and principled, with a deep concern for others.' },
  'ENFP': { name: 'Diplomats', description: 'Diplomats are empathetic and principled, with a deep concern for others.' },

  // Sentinels (ISTJ, ISFJ, ESTJ, ESFJ)
  'ISTJ': { name: 'Sentinels', description: 'Sentinels are cooperative and practical, bringing stability and order.' },
  'ISFJ': { name: 'Sentinels', description: 'Sentinels are cooperative and practical, bringing stability and order.' },
  'ESTJ': { name: 'Sentinels', description: 'Sentinels are cooperative and practical, bringing stability and order.' },
  'ESFJ': { name: 'Sentinels', description: 'Sentinels are cooperative and practical, bringing stability and order.' },

  // Explorers (ISTP, ISFP, ESTP, ESFP)
  'ISTP': { name: 'Explorers', description: 'Explorers are utilitarian, practical, and spontaneous, shining in situations that require quick reaction.' },
  'ISFP': { name: 'Explorers', description: 'Explorers are utilitarian, practical, and spontaneous, shining in situations that require quick reaction.' },
  'ESTP': { name: 'Explorers', description: 'Explorers are utilitarian, practical, and spontaneous, shining in situations that require quick reaction.' },
  'ESFP': { name: 'Explorers', description: 'Explorers are utilitarian, practical, and spontaneous, shining in situations that require quick reaction.' }
}

const MBTI_PATTERN = /^[EI][SN][TF][JP]$/

const DEFAULT_DEBUG_PERCENTAGES: Record<DimensionPair, number> = {
  'E_I': 78,
  'S_N': 74,
  'T_F': 72,
  'J_P': 76,
}

export function calculateQuizResult({
  answers,
  questions,
  archetypes,
  characters,
}: {
  answers: number[]
  questions: Question[]
  archetypes: Archetype[]
  characters: CharacterMatch[]
}): QuizResult {
  const rawScores: Record<DimensionPair, number> = {
    'E_I': 0, 'S_N': 0, 'T_F': 0, 'J_P': 0
  }
  const maxScores: Record<DimensionPair, number> = {
    'E_I': 0, 'S_N': 0, 'T_F': 0, 'J_P': 0
  }

  questions.forEach((question, index) => {
    const val = answers[index]
    if (typeof val !== 'number') return

    const { dimension, sign } = question
    maxScores[dimension] += Math.abs(sign) * 3
    rawScores[dimension] += val * sign
  })

  const scores = {} as Record<DimensionPair, DimensionScore>
  let finalCode = ''

  for (const pair in DIMENSION_LETTERS) {
    const dimension = pair as DimensionPair
    const score = rawScores[dimension]
    const maxScore = Math.max(1, maxScores[dimension])

    const [posLetter, negLetter] = DIMENSION_LETTERS[dimension]
    const dominant = score >= 0 ? posLetter : negLetter

    // percentage calculation (50 to 100)
    const intensity = Math.abs(score) / maxScore
    const percentage = Math.round(50 + (intensity * 50))

    scores[dimension] = {
      pair: dimension,
      score,
      dominant,
      percentage
    }
    finalCode += dominant
  }

  const featuredCharacter = pickFeaturedCharacter({
    scores,
    characters,
    answers,
  })

  const matchedArchetype: Archetype =
    archetypes.find((a: Archetype) => a.id === featuredCharacter?.archetypeId) || {
    id: 'luminous-lead' as ArchetypeId,
    name: '异格旅行者',
    subtitle: '无法被定义的观测者',
    oneLiner: '世界之外，唯有真实的自我。',
    description: '游离于传统分类之外的特殊存在',
    tags: ['神秘判定', '罕见'],
    narrativeRole: '旁观者',
    spotlight: '不可名状的直觉',
    weakness: '常常难以被常人理解',
    keywords: ['观测', '唯一', '脱轨'],
    accent: '#aaaaaa',
    vector: { expression: 0, temperature: 0, judgement: 0, order: 0, agency: 0, aura: 0 }
  }

  const charMatches = featuredCharacter ? [featuredCharacter] : []

  // 用题目结果强度和角色命中层级计算稳定的命中感，避免同一份答案重复提交时数值跳变。
  const matchScore = calculateCharacterMatchScore(scores, featuredCharacter)
  const roleCode = featuredCharacter?.code ?? 'UNKN'

  return {
    code: roleCode,
    mbtiCode: finalCode,
    scores,
    archetype: matchedArchetype,
    tags: [matchedArchetype.narrativeRole, ...matchedArchetype.tags].slice(0, 6),
    matchScore,
    characterMatches: charMatches,
    featuredCharacter,
  }
}

export function normalizeMbtiCode(mbtiCode: string) {
  const normalized = mbtiCode.trim().toUpperCase()
  return MBTI_PATTERN.test(normalized) ? normalized : null
}

export function buildScoresFromMbtiCode(
  mbtiCode: string,
  percentages: Partial<Record<DimensionPair, number>> = {},
) {
  const normalized = normalizeMbtiCode(mbtiCode)

  if (!normalized) {
    return null
  }

  const pairs: DimensionPair[] = ['E_I', 'S_N', 'T_F', 'J_P']

  return pairs.reduce((acc, pair, index) => {
    const dominant = normalized[index] as MBTILetter
    const percentage = Math.max(50, Math.min(99, Math.round(percentages[pair] ?? DEFAULT_DEBUG_PERCENTAGES[pair])))
    const sign = dominant === DIMENSION_LETTERS[pair][0] ? 1 : -1

    acc[pair] = {
      pair,
      dominant,
      percentage,
      score: sign * (percentage - 50),
    }

    return acc
  }, {} as Record<DimensionPair, DimensionScore>)
}

export function resolveArchetypeForMbti(mbtiCode: string, archetypes: Archetype[]) {
  const normalized = normalizeMbtiCode(mbtiCode)

  if (!normalized) {
    return null
  }

  const matchedArchetypeId = TYPE_TO_ARCHETYPE[normalized]
  return (
    archetypes.find((item) => item.id === matchedArchetypeId) ??
    archetypes.find((item) => item.id === 'luminous-lead') ??
    null
  )
}

export function rankCharactersForMbti({
  characters,
  mbtiCode,
  preferredCharacterId,
}: {
  characters: CharacterMatch[]
  mbtiCode: string
  preferredCharacterId?: string | null
}) {
  const normalized = normalizeMbtiCode(mbtiCode)

  if (!normalized) {
    return []
  }

  const matchedArchetypeId = TYPE_TO_ARCHETYPE[normalized]
  const preferredId = preferredCharacterId?.trim().toLowerCase()
  const ranked = rankCharacters({
    characters,
    finalCode: normalized,
    matchedArchetypeId,
  })

  if (!preferredId) {
    return ranked
  }

  return [...ranked].sort((left, right) => {
    if (left.id === preferredId && right.id !== preferredId) {
      return -1
    }

    if (right.id === preferredId && left.id !== preferredId) {
      return 1
    }

    return 0
  })
}

export function createDebugQuizResult({
  characterId,
  archetypes,
  characters,
}: {
  characterId: string
  archetypes: Archetype[]
  characters: CharacterMatch[]
}): QuizResult | null {
  const requestedCharacterId = characterId.trim().toLowerCase()
  const character = characters.find((item) => item.id === requestedCharacterId)

  if (!character) {
    return null
  }

  const matchedArchetype =
    archetypes.find((item) => item.id === character.archetypeId) ??
    archetypes.find((item) => item.id === 'luminous-lead') ??
    null

  if (!matchedArchetype) {
    return null
  }

  const scores = buildScoresFromMbtiCode(character.matchCode)

  if (!scores) {
    return null
  }

  const matchScore = calculateCharacterMatchScore(scores, character)

  return {
    code: character.code,
    mbtiCode: character.matchCode,
    scores,
    archetype: matchedArchetype,
    tags: [matchedArchetype.narrativeRole, ...matchedArchetype.tags].slice(0, 6),
    matchScore,
    characterMatches: [character],
    featuredCharacter: character,
  }
}

function pickFeaturedCharacter({
  scores,
  characters,
  answers,
}: {
  scores: Record<DimensionPair, DimensionScore>
  characters: CharacterMatch[]
  answers: number[]
}) {
  if (!characters.length) {
    return null
  }

  const scored = characters.map((character) => ({
    character,
    score: getCharacterDimensionScore(scores, character),
  }))
  const bestScore = Math.max(...scored.map((item) => item.score))
  const topCandidates = scored
    .filter((item) => item.score === bestScore)
    .map((item) => item.character)
    .sort((left, right) => left.id.localeCompare(right.id, 'en'))

  if (topCandidates.length === 1) {
    return topCandidates[0]
  }

  // 同分角色用答案指纹分流，避免同一 matchCode 的角色永远被固定压制。
  const fingerprint = buildAnswerFingerprint(answers)
  return topCandidates[fingerprint % topCandidates.length]
}

function buildAnswerFingerprint(answers: number[]) {
  return answers.reduce((seed, answer, index) => {
    const normalized = answer + 4
    return (seed * 131 + normalized * (index + 7)) % 2147483647
  }, 17)
}

function getCharacterDimensionScore(
  scores: Record<DimensionPair, DimensionScore>,
  character: CharacterMatch,
) {
  const pairs: DimensionPair[] = ['E_I', 'S_N', 'T_F', 'J_P']
  let total = 0

  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index]
    const expectedLetter = character.matchCode[index] as MBTILetter
    const actual = scores[pair]
    const sameDominant = actual.dominant === expectedLetter

    total += sameDominant ? actual.percentage : 100 - actual.percentage
  }

  return total
}

function calculateCharacterMatchScore(
  scores: Record<DimensionPair, DimensionScore>,
  featuredCharacter: CharacterMatch | null,
) {
  const averageCertainty =
    Object.values(scores).reduce((sum, item) => sum + item.percentage, 0) / Object.values(scores).length

  if (!featuredCharacter) {
    return Math.round(Math.min(89, averageCertainty + 12))
  }

  const raw = getCharacterDimensionScore(scores, featuredCharacter)
  return Math.max(60, Math.min(99, Math.round((raw / 400) * 100)))
}

// 获取角色分类（用于结果页面）
export function getRoleForType(mbtiType: string): { name: string; description: string } {
  const baseType = mbtiType.slice(0, 4)
  return ROLE_MAPPING[baseType] || { name: 'Explorers', description: 'Unique individuals with diverse perspectives.' }
}

function rankCharacters({
  characters,
  finalCode,
  matchedArchetypeId,
}: {
  characters: CharacterMatch[]
  finalCode: string
  matchedArchetypeId: ArchetypeId | undefined
}) {
  return [...characters].sort((left, right) => {
    const rightScore = getCharacterRankScore(right, finalCode, matchedArchetypeId)
    const leftScore = getCharacterRankScore(left, finalCode, matchedArchetypeId)

    if (rightScore !== leftScore) {
      return rightScore - leftScore
    }

    return right.name.localeCompare(left.name, 'zh-Hans-CN')
  })
}

function getCharacterRankScore(
  character: CharacterMatch,
  finalCode: string,
  matchedArchetypeId: ArchetypeId | undefined,
) {
  const code = character.matchCode.toUpperCase()
  let score = sharedLetterCount(code, finalCode) * 10

  if (character.archetypeId === matchedArchetypeId) {
    score += 8
  }

  if (code === finalCode) {
    score += 60
  }

  return score
}

function sharedLetterCount(left: string, right: string) {
  let count = 0

  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] === right[index]) {
      count += 1
    }
  }

  return count
}

// 保留旧函数区域占位，匹配分数已迁移到 calculateCharacterMatchScore。
