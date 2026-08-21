// 答案量程约定：-3（强烈反对）.. 3（强烈同意），全部 UI 与评分逻辑共用
export const ANSWER_MIN = -3
export const ANSWER_MAX = 3
// 未作答哨兵值，与有效量程刻意拉开距离，避免与真实答案混淆
export const UNANSWERED = -10

export function isAnsweredValue(value: number): boolean {
  return Number.isFinite(value) && value >= ANSWER_MIN && value <= ANSWER_MAX
}

export type DimensionId =
  | 'expression'
  | 'temperature'
  | 'judgement'
  | 'order'
  | 'agency'
  | 'aura'

export type ArchetypeId =
  | 'luminous-lead'
  | 'icebound-observer'
  | 'oathbound-captain'
  | 'trickster-orbit'
  | 'gentle-healer'
  | 'shadow-strategist'
  | 'chaos-spark'
  | 'moonlit-guardian'

export type DimensionPair = 'E_I' | 'S_N' | 'T_F' | 'J_P'

export type MBTILetter = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P'

export type QuestionArchetypeWeightId =
  | 'hero'
  | 'strategist'
  | 'guardian'
  | 'lonewolf'
  | 'healer'
  | 'berserker'
  | 'trickster'
  | 'ruler'

export interface Question {
  id: string
  /** 题干原文（简体中文），其他语言由 i18n 的 quiz.questions 数组按序提供 */
  text: string
  scene: string
  weights?: Partial<Record<QuestionArchetypeWeightId, number>>
  dimension: DimensionPair
  sign: 1 | -1
}

export interface Archetype {
  id: ArchetypeId
  name: string
  subtitle: string
  oneLiners: string[]
  description: string
  tags: string[]
  narrativeRole: string
  spotlight: string
  weakness: string
  keywords: string[]
  accent: string
  vector: Record<DimensionId, number>
}

export type PersonaBasisType = 'canon' | 'fandom-impression'

export interface PersonaBasis {
  type: PersonaBasisType
  label: string
  confidence: 'high' | 'medium' | 'low'
  summary: string
}

export interface CharacterMatch {
  id: string
  name: string
  hidden?: boolean
  series: string
  addedAt?: string
  image?: string
  thumb?: string
  accent?: string
  matchCode: string
  matchCodeFlex?: string[]
  matchWeight?: number
  code: string
  title?: string
  archetypeId: ArchetypeId
  tags: string[]
  note: string
  vector: Record<DimensionId, number>
  personaBasis?: PersonaBasis
  signature?: {
    uniqueAxes?: Partial<Record<DimensionId, number>>
    questionAffinity?: Array<{
      questionId: string
      expected: 'agree' | 'disagree' | 'neutral'
      weight?: number
    }>
  }
}

export interface DimensionScore {
  pair: DimensionPair
  score: number
  dominant: MBTILetter
  percentage: number
}

export interface QuizRecord {
  answers: number[]
  createdAt: string
  startedAt?: string
  /** 每次完成测试时生成，一路沿用到结果页，用于上报去重 */
  submissionId?: string
  result: QuizResult
}

export interface CharacterMatchResult {
  character: CharacterMatch
  score: number
  probability: number
}

export interface QuizResult {
  code: string
  mbtiCode: string
  archetype: Archetype
  scores: Record<DimensionPair, DimensionScore>
  tags: string[]
  matchScore: number
  matchProbability: number
  characterMatches: CharacterMatch[]
  topCharacterMatches: CharacterMatchResult[]
  featuredCharacter: CharacterMatch | null
}
