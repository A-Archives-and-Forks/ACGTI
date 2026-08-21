import type {
  Archetype,
  ArchetypeId,
  CharacterMatch,
  DimensionId,
  DimensionPair,
  DimensionScore,
  MBTILetter,
  Question,
  QuestionArchetypeWeightId,
  QuizResult,
} from '../types/quiz'
import { ANSWER_MAX, isAnsweredValue } from '../types/quiz'
import questionDimensionWeights from '../data/questionDimensionWeights.json' with { type: 'json' }
import { getCharacterPopulationProbability } from './characterProbability.ts'

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

const ROLE_TO_ARCHETYPE: Record<QuestionArchetypeWeightId, ArchetypeId> = {
  hero: 'luminous-lead',
  strategist: 'shadow-strategist',
  guardian: 'moonlit-guardian',
  lonewolf: 'icebound-observer',
  healer: 'gentle-healer',
  berserker: 'chaos-spark',
  trickster: 'trickster-orbit',
  ruler: 'oathbound-captain',
}

const QUESTION_WEIGHT_FALLBACKS: Record<DimensionPair, Partial<Record<QuestionArchetypeWeightId, number>>> = {
  'E_I': { hero: 2, trickster: 2, healer: 1, lonewolf: -2, strategist: -1 },
  'S_N': { strategist: 2, trickster: 2, healer: 1, ruler: -1, guardian: -1 },
  'T_F': { strategist: 2, ruler: 1, healer: -2, guardian: -1, berserker: 1 },
  'J_P': { ruler: 2, guardian: 1, strategist: 1, trickster: -2, berserker: -1 },
}

const VECTOR_AXES: DimensionId[] = ['expression', 'temperature', 'judgement', 'order', 'agency', 'aura']
const ARCHETYPE_IDS = Object.values(ROLE_TO_ARCHETYPE)

const MBTI_WEIGHT = 0.25
const ARCHETYPE_WEIGHT = 0.28
const VECTOR_WEIGHT = 0.27
const CHARACTER_SPECIFIC_WEIGHT = 0.2

// 逐题维度权重覆盖表（基于真实反馈数据校准）。
// 覆盖语义为“整体替换”：表中列出的题目会完全取代题目自带的 dimension/sign 计分，
// 未列出的维度权重归零（含置 0 的降噪题），不在表中的题目沿用自身维度。
const DIMENSION_SCORE_WEIGHTS = questionDimensionWeights as Record<string, Partial<Record<DimensionPair, number>>>

const MBTI_PATTERN = /^[EI][SN][TF][JP]$/
// 角色预览路由（?character=）在无真实作答时使用的默认倾向幅度
const DEFAULT_PREVIEW_PERCENTAGES: Record<DimensionPair, number> = {
  'E_I': 78,
  'S_N': 74,
  'T_F': 72,
  'J_P': 76,
}

type DirectionalMax = Record<DimensionPair, { positive: number; negative: number }>
type ArchetypeAccumulator = Record<ArchetypeId, number>
type UserVector = Record<DimensionId, number>

type AnswerProfile = {
  scores: Record<DimensionPair, DimensionScore>
  mbtiCode: string
  archetypeRaw: ArchetypeAccumulator
  userVector: UserVector
  matchedArchetype: Archetype
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
  const answerProfile = buildAnswerProfile({
    answers,
    questions,
    archetypes,
  })
  const { scores, mbtiCode, archetypeRaw, userVector, matchedArchetype } = answerProfile
  const characterRankings = rankCharactersByProfile({
    scores,
    characters,
    archetypeRaw,
    userVector,
    answers,
    questionIndexById: buildQuestionIndexById(questions),
  })
  const featuredCharacter = characterRankings[0]?.character ?? null
  const charMatches = characterRankings.slice(0, 3).map((item) => item.character)
  const topCharacterMatches = characterRankings.slice(0, 4).map((item) => ({
    character: item.character,
    score: calculateCharacterMatchScore(item),
    probability: getCharacterPopulationProbability(item.character.id),
  }))
  const roleCode = featuredCharacter?.code ?? 'UNKN'
  const matchScore = calculateCharacterMatchScore(characterRankings[0])
  const matchProbability = getCharacterPopulationProbability(featuredCharacter?.id)

  return {
    code: roleCode,
    mbtiCode,
    scores,
    archetype: matchedArchetype,
    tags: [matchedArchetype.narrativeRole, ...matchedArchetype.tags].slice(0, 6),
    matchScore,
    matchProbability,
    characterMatches: charMatches,
    topCharacterMatches,
    featuredCharacter,
  }
}

function buildAnswerProfile({
  answers,
  questions,
  archetypes,
}: {
  answers: number[]
  questions: Question[]
  archetypes: Archetype[]
}): AnswerProfile {
  const rawScores: Record<DimensionPair, number> = {
    'E_I': 0, 'S_N': 0, 'T_F': 0, 'J_P': 0
  }
  const directionalMaxScores: DirectionalMax = {
    'E_I': { positive: 0, negative: 0 },
    'S_N': { positive: 0, negative: 0 },
    'T_F': { positive: 0, negative: 0 },
    'J_P': { positive: 0, negative: 0 }
  }
  const archetypeRaw = createEmptyArchetypeAccumulator()
  const userVector = createEmptyUserVector()
  const archetypeMap = new Map(archetypes.map((item) => [item.id, item]))

  questions.forEach((question, index) => {
    const answer = answers[index]
    if (!isAnsweredValue(answer)) {
      return
    }

    const dimensionWeights = DIMENSION_SCORE_WEIGHTS[question.id] ?? { [question.dimension]: question.sign }
    for (const [pair, weight] of Object.entries(dimensionWeights) as [DimensionPair, number | undefined][]) {
      if (!weight) {
        continue
      }

      rawScores[pair] += answer * weight
      if (weight > 0) {
        directionalMaxScores[pair].positive += ANSWER_MAX * weight
      } else {
        directionalMaxScores[pair].negative += ANSWER_MAX * Math.abs(weight)
      }
    }

    const normalizedWeights = normalizeQuestionWeights(question.weights ?? QUESTION_WEIGHT_FALLBACKS[question.dimension])

    for (const role of Object.keys(normalizedWeights) as QuestionArchetypeWeightId[]) {
      const value = normalizedWeights[role] ?? 0
      const archetypeId = ROLE_TO_ARCHETYPE[role]
      const archetype = archetypeMap.get(archetypeId)
      if (!archetype || value === 0) {
        continue
      }

      const weightedAnswer = answer * value
      archetypeRaw[archetypeId] += weightedAnswer

      for (const axis of VECTOR_AXES) {
        userVector[axis] += weightedAnswer * archetype.vector[axis]
      }
    }
  })

  const scores = {} as Record<DimensionPair, DimensionScore>
  let mbtiCode = ''

  for (const [pair, [posLetter, negLetter]] of Object.entries(DIMENSION_LETTERS) as [DimensionPair, [MBTILetter, MBTILetter]][]) {
    const score = normalizeDimensionScore(rawScores[pair], directionalMaxScores[pair])
    // 平局规则：score === 0 时偏向正字母（E/S/T/J），四维全中性会得到 ESTJ。
    // 这是 16personalities 风格的既定取舍：UI 的 percentage 恒 >= 50，不展示“完全中立”。
    const dominant = score >= 0 ? posLetter : negLetter
    const intensity = Math.min(1, Math.abs(score))
    const percentage = Math.round(50 + (intensity * 50))

    scores[pair] = {
      pair,
      score,
      dominant,
      percentage
    }
    mbtiCode += dominant
  }

  return {
    scores,
    mbtiCode,
    archetypeRaw,
    userVector,
    matchedArchetype: pickMatchedArchetype(archetypes, archetypeRaw, mbtiCode),
  }
}

function createEmptyArchetypeAccumulator(): ArchetypeAccumulator {
  return ARCHETYPE_IDS.reduce((acc, id) => {
    acc[id] = 0
    return acc
  }, {} as ArchetypeAccumulator)
}

function createEmptyUserVector(): UserVector {
  return VECTOR_AXES.reduce((acc, axis) => {
    acc[axis] = 0
    return acc
  }, {} as UserVector)
}

function normalizeDimensionScore(
  rawScore: number,
  directionalMax: { positive: number; negative: number },
) {
  // 按答案作用方向分别归一化：即使某方向的题目权重总量不足 1 也不放大百分比
  if (rawScore >= 0) {
    return directionalMax.positive > 0 ? rawScore / directionalMax.positive : 0
  }

  return directionalMax.negative > 0 ? rawScore / directionalMax.negative : 0
}

function normalizeQuestionWeights(weights: Partial<Record<QuestionArchetypeWeightId, number>>) {
  const completed = Object.keys(ROLE_TO_ARCHETYPE).reduce((acc, role) => {
    const typedRole = role as QuestionArchetypeWeightId
    acc[typedRole] = weights[typedRole] ?? 0
    return acc
  }, {} as Record<QuestionArchetypeWeightId, number>)

  const values = Object.values(completed)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const centered = Object.fromEntries(
    Object.entries(completed).map(([key, value]) => [key, value - mean])
  ) as Record<QuestionArchetypeWeightId, number>

  const norm = Object.values(centered).reduce((sum, value) => sum + Math.abs(value), 0) || 1

  return Object.fromEntries(
    Object.entries(centered).map(([key, value]) => [key, value / norm])
  ) as Record<QuestionArchetypeWeightId, number>
}

function pickMatchedArchetype(
  archetypes: Archetype[],
  archetypeRaw: ArchetypeAccumulator,
  finalCode: string,
) {
  const sortedByScore = [...archetypes].sort((left, right) => {
    const delta = archetypeRaw[right.id] - archetypeRaw[left.id]
    if (delta !== 0) {
      return delta
    }

    return left.id.localeCompare(right.id, 'en')
  })

  const fallback =
    sortedByScore[0] ??
    resolveArchetypeForMbti(finalCode, archetypes) ??
    // archetypes 来自固定的 archetypes.json（8 条），空数组不可能发生；
    // 这里仍显式兜底避免类型欺瞒
    archetypes[0]
  return fallback as Archetype
}

type RankedCharacter = {
  character: CharacterMatch
  total: number
  mbti: number
  archetype: number
  vector: number
  specific: number
}

function rankCharactersByProfile({
  scores,
  characters,
  archetypeRaw,
  userVector,
  answers,
  questionIndexById,
}: {
  scores: Record<DimensionPair, DimensionScore>
  characters: CharacterMatch[]
  archetypeRaw: ArchetypeAccumulator
  userVector: UserVector
  answers: number[]
  questionIndexById: Map<string, number>
}) {
  return [...characters]
    .map((character) => {
      const mbti = scoreFlexibleMbti(character, scores)
      const archetype = scoreArchetype(character.archetypeId, archetypeRaw)
      const vector = scoreVector(userVector, character.vector)
      const specific = scoreCharacterSpecific(userVector, character, answers, questionIndexById)
      const total =
        MBTI_WEIGHT * mbti +
        ARCHETYPE_WEIGHT * archetype +
        VECTOR_WEIGHT * vector +
        CHARACTER_SPECIFIC_WEIGHT * specific
      const weightedTotal = total * (character.matchWeight ?? 1)

      return {
        character,
        total: weightedTotal,
        mbti,
        archetype,
        vector,
        specific,
      }
    })
    .sort((left, right) => {
      const totalDelta = right.total - left.total
      if (Math.abs(totalDelta) > 0.005) {
        return totalDelta
      }

      const archetypeDelta = right.archetype - left.archetype
      if (Math.abs(archetypeDelta) > 0.005) {
        return archetypeDelta
      }

      const vectorDelta = right.vector - left.vector
      if (Math.abs(vectorDelta) > 0.005) {
        return vectorDelta
      }

      const specificDelta = right.specific - left.specific
      if (Math.abs(specificDelta) > 0.005) {
        return specificDelta
      }

      // 同分兜底按中文名排序，保证榜次稳定
      return left.character.name.localeCompare(right.character.name, 'zh-Hans-CN')
    })
}

function scoreMbti(
  matchCode: string,
  scores: Record<DimensionPair, DimensionScore>,
) {
  const code = matchCode.toUpperCase()
  if (!MBTI_PATTERN.test(code)) {
    return 0
  }

  const pairs: DimensionPair[] = ['E_I', 'S_N', 'T_F', 'J_P']
  let total = 0

  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index]
    const actual = scores[pair]
    const expectedLetter = code[index] as MBTILetter
    total += actual.dominant === expectedLetter ? actual.percentage : 100 - actual.percentage
  }

  return total / 400
}

function scoreFlexibleMbti(
  character: CharacterMatch,
  scores: Record<DimensionPair, DimensionScore>,
) {
  const codes = [character.matchCode, ...(character.matchCodeFlex ?? [])]
  return codes.reduce((best, code) => Math.max(best, scoreMbti(code, scores)), 0)
}

function scoreArchetype(archetypeId: ArchetypeId, archetypeRaw: ArchetypeAccumulator) {
  const values = Object.values(archetypeRaw)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min

  if (spread <= 0.0001) {
    return archetypeRaw[archetypeId] >= 0 ? 0.55 : 0.45
  }

  return (archetypeRaw[archetypeId] - min) / spread
}

function scoreVector(
  userVector: UserVector,
  characterVector: CharacterMatch['vector'],
) {
  const cosine = cosineSimilarity(userVector, characterVector)
  return (cosine + 1) / 2
}

function scoreCharacterSpecific(
  userVector: UserVector,
  character: CharacterMatch,
  answers: number[],
  questionIndexById: Map<string, number>,
) {
  const uniqueAxes = character.signature?.uniqueAxes
  const questionAffinity = character.signature?.questionAffinity ?? []

  const axisScore = !uniqueAxes || !Object.keys(uniqueAxes).length
    ? scoreVector(userVector, character.vector)
    : scoreUniqueAxes(userVector, uniqueAxes)

  if (!questionAffinity.length) {
    return axisScore
  }

  const affinityScore = scoreQuestionAffinity(questionAffinity, answers, questionIndexById)
  return axisScore * 0.45 + affinityScore * 0.55
}

function scoreUniqueAxes(
  userVector: UserVector,
  uniqueAxes: Partial<Record<DimensionId, number>>,
) {
  let weightedScore = 0
  let weightTotal = 0

  for (const axis of Object.keys(uniqueAxes) as DimensionId[]) {
    const expected = uniqueAxes[axis] ?? 0
    const actual = userVector[axis]
    const axisWeight = Math.max(0.5, Math.abs(expected))
    const distance = Math.abs(actual - expected)
    // 角色签名轴需要更强的辨识度，否则极端画像会被相邻的泛型角色长期压住。
    const normalizedDistance = Math.min(1, distance / 6)
    const similarity = Math.max(0, 1 - normalizedDistance)
    weightedScore += similarity * axisWeight
    weightTotal += axisWeight
  }

  return weightTotal ? weightedScore / weightTotal : 0.5
}

function scoreQuestionAffinity(
  affinities: NonNullable<NonNullable<CharacterMatch['signature']>['questionAffinity']>,
  answers: number[],
  questionIndexById: Map<string, number>,
) {
  let weightedScore = 0
  let weightTotal = 0

  for (const affinity of affinities) {
    // 用 id -> 下标映射并校验题目确实存在，题库增删后签名不会静默指错题
    const questionIndex = questionIndexById.get(affinity.questionId)
    if (questionIndex === undefined) {
      console.warn(`[quizEngine] 角色签名引用了不存在的题目: ${affinity.questionId}`)
      continue
    }

    const answer = answers[questionIndex]
    if (!isAnsweredValue(answer)) {
      continue
    }

    const weight = affinity.weight ?? 1
    weightedScore += evaluateAffinity(answer, affinity.expected) * weight
    weightTotal += weight
  }

  return weightTotal ? weightedScore / weightTotal : 0.5
}

function evaluateAffinity(answer: number, expected: 'agree' | 'disagree' | 'neutral') {
  if (expected === 'agree') {
    return Math.max(0, (answer + 3) / 6)
  }

  if (expected === 'disagree') {
    return Math.max(0, (3 - answer) / 6)
  }

  return Math.max(0, 1 - Math.abs(answer) / 3)
}

function buildQuestionIndexById(questions: Question[]) {
  const indexById = new Map<string, number>()
  questions.forEach((question, index) => {
    indexById.set(question.id, index)
  })
  return indexById
}

function cosineSimilarity(
  left: UserVector,
  right: CharacterMatch['vector'],
) {
  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0

  for (const axis of VECTOR_AXES) {
    dot += left[axis] * right[axis]
    leftMagnitude += left[axis] * left[axis]
    rightMagnitude += right[axis] * right[axis]
  }

  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude)
  if (!denominator) {
    return 0
  }

  return dot / denominator
}

export function normalizeMbtiCode(mbtiCode: string) {
  const normalized = mbtiCode.trim().toUpperCase()
  return MBTI_PATTERN.test(normalized) ? normalized : null
}

// 由 MBTI 编码直接构造四维得分（角色预览用，与真实作答路径量纲一致：score ∈ [-1, 1]）
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
    const percentage = Math.max(50, Math.min(99, Math.round(percentages[pair] ?? DEFAULT_PREVIEW_PERCENTAGES[pair])))
    const sign = dominant === DIMENSION_LETTERS[pair][0] ? 1 : -1

    acc[pair] = {
      pair,
      dominant,
      percentage,
      score: sign * (percentage - 50) / 50,
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

// 角色预览结果：服务于 /result?character= 分享链接，不是调试专用。
// 无真实作答，matchScore 固定展示一个可信的中高值。
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

  return {
    code: character.code,
    mbtiCode: character.matchCode,
    scores,
    archetype: matchedArchetype,
    tags: [matchedArchetype.narrativeRole, ...matchedArchetype.tags].slice(0, 6),
    matchScore: 92,
    matchProbability: getCharacterPopulationProbability(character.id),
    characterMatches: [character],
    topCharacterMatches: [{
      character,
      score: 92,
      probability: getCharacterPopulationProbability(character.id),
    }],
    featuredCharacter: character,
  }
}

function calculateCharacterMatchScore(topMatch?: Pick<RankedCharacter, 'total'> | null) {
  if (!topMatch) {
    return 60
  }

  return Math.max(60, Math.min(99, Math.round(topMatch.total * 100)))
}
