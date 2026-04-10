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

  const matchedArchetypeId = TYPE_TO_ARCHETYPE[finalCode]

  const matchedArchetype: Archetype = archetypes.find((a: Archetype) => a.id === matchedArchetypeId) || {
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

  const charMatches = rankCharacters({
    characters,
    finalCode,
    matchedArchetypeId,
  }).slice(0, 5)
  const featuredCharacter = charMatches[0] ?? null

  // 用题目结果强度和角色匹配层级计算稳定的命中感，避免同一份答案重复提交时数值跳变。
  const matchScore = calculateMatchScore({
    scores,
    finalCode,
    featuredCharacter,
    matchedArchetypeId,
  })

  return {
    code: featuredCharacter?.code ?? finalCode,
    mbtiCode: finalCode,
    scores,
    archetype: matchedArchetype,
    tags: [matchedArchetype.narrativeRole, ...matchedArchetype.tags].slice(0, 6),
    matchScore,
    characterMatches: charMatches,
    featuredCharacter,
  }
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

function calculateMatchScore({
  scores,
  finalCode,
  featuredCharacter,
  matchedArchetypeId,
}: {
  scores: Record<DimensionPair, DimensionScore>
  finalCode: string
  featuredCharacter: CharacterMatch | null
  matchedArchetypeId: ArchetypeId | undefined
}) {
  const averageCertainty =
    Object.values(scores).reduce((sum, item) => sum + item.percentage, 0) / Object.values(scores).length

  if (!featuredCharacter) {
    return Math.round(Math.min(89, averageCertainty + 12))
  }

  const featuredCode = featuredCharacter.matchCode.toUpperCase()
  const exactBonus = featuredCode === finalCode ? 10 : 0
  const archetypeBonus = featuredCharacter.archetypeId === matchedArchetypeId ? 4 : 0
  const overlapBonus = sharedLetterCount(featuredCode, finalCode) * 2

  return Math.max(60, Math.min(99, Math.round(averageCertainty + exactBonus + archetypeBonus + overlapBonus)))
}
