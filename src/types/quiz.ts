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

export interface QuestionOption {
  id: string
  label: string
  tone: string
  weights: Partial<Record<QuestionArchetypeWeightId, number>>
}

export interface Question {
  id: string
  text?: string
  prompt?: string
  scene: string
  options?: QuestionOption[]
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

// 16personalities 风格的额外类型
export interface TraitBar {
  label: string
  leftLabel: string
  rightLabel: string
  percentage: number
  dominant: 'left' | 'right'
  color: string
}

export interface RoleCard {
  title: string
  subtitle: string
  description: string
  imageUrl?: string
  learnMoreUrl?: string
}
