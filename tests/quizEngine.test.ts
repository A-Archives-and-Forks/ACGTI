import { describe, expect, it } from 'vitest'

import {
  buildScoresFromMbtiCode,
  calculateQuizResult,
  normalizeMbtiCode,
  resolveArchetypeForMbti,
} from '../src/utils/quizEngine.ts'
import { ANSWER_MAX, ANSWER_MIN, UNANSWERED, isAnsweredValue } from '../src/types/quiz.ts'
import type { Archetype, CharacterMatch, Question } from '../src/types/quiz.ts'
import archetypesJson from '../src/data/archetypes.json'
import charactersJson from '../src/data/characters.json'
import questionsJson from '../src/data/questions.json'
import questionDimensionWeightsJson from '../src/data/questionDimensionWeights.json'

// 使用真实数据集，保证题库/权重校准后测试随之同步暴露回归
const questions = questionsJson as unknown as Question[]
const archetypes = archetypesJson as unknown as Archetype[]
const characters = charactersJson as unknown as CharacterMatch[]

const MBTI_PATTERN = /^[EI][SN][TF][JP]$/
const DIMENSION_PAIRS = ['E_I', 'S_N', 'T_F', 'J_P'] as const

function runEngine(answers: number[]) {
  return calculateQuizResult({ answers, questions, archetypes, characters })
}

describe('normalizeMbtiCode', () => {
  it('规范化大小写与空白', () => {
    expect(normalizeMbtiCode(' infp ')).toBe('INFP')
    expect(normalizeMbtiCode('estj')).toBe('ESTJ')
  })

  it('拒绝非法编码', () => {
    expect(normalizeMbtiCode('INF')).toBeNull()
    expect(normalizeMbtiCode('INFXX')).toBeNull()
    expect(normalizeMbtiCode('')).toBeNull()
    expect(normalizeMbtiCode('ABCD')).toBeNull()
  })
})

describe('isAnsweredValue', () => {
  it('UNANSWERED 哨兵与越界值视为未作答', () => {
    expect(isAnsweredValue(UNANSWERED)).toBe(false)
    expect(isAnsweredValue(ANSWER_MAX)).toBe(true)
    expect(isAnsweredValue(ANSWER_MIN)).toBe(true)
    expect(isAnsweredValue(ANSWER_MAX + 1)).toBe(false)
    expect(isAnsweredValue(0)).toBe(true)
  })
})

describe('buildScoresFromMbtiCode', () => {
  it('按字母确定主导方向且量纲为 [-1, 1]', () => {
    const scores = buildScoresFromMbtiCode('ISTP')
    expect(scores).not.toBeNull()
    expect(scores!.E_I.dominant).toBe('I')
    expect(scores!.S_N.dominant).toBe('S')
    expect(scores!.T_F.dominant).toBe('T')
    expect(scores!.J_P.dominant).toBe('P')
    for (const pair of DIMENSION_PAIRS) {
      expect(scores![pair].score).toBeGreaterThanOrEqual(-1)
      expect(scores![pair].score).toBeLessThanOrEqual(1)
      expect(scores![pair].percentage).toBeGreaterThanOrEqual(50)
      expect(scores![pair].percentage).toBeLessThanOrEqual(99)
    }
  })

  it('正字母维度得分为正', () => {
    const scores = buildScoresFromMbtiCode('ESTJ')
    expect(scores!.E_I.score).toBeGreaterThan(0)
    expect(scores!.J_P.score).toBeGreaterThan(0)
  })

  it('非法编码返回 null', () => {
    expect(buildScoresFromMbtiCode('XXXX')).toBeNull()
  })
})

describe('resolveArchetypeForMbti', () => {
  it('十六型均能映射到 8 原型之一', () => {
    const codes = [
      'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
      'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
    ]
    const ids = new Set(archetypes.map((item) => item.id))
    for (const code of codes) {
      const matched = resolveArchetypeForMbti(code, archetypes)
      expect(matched).not.toBeNull()
      expect(ids.has(matched!.id)).toBe(true)
    }
  })

  it('非法编码返回 null', () => {
    expect(resolveArchetypeForMbti('INF', archetypes)).toBeNull()
  })
})

describe('calculateQuizResult（真实题库与角色数据）', () => {
  it('全同意 / 全反对均产出合法 MBTI 与四维得分', () => {
    for (const value of [ANSWER_MAX, ANSWER_MIN]) {
      const result = runEngine(questions.map(() => value))
      expect(MBTI_PATTERN.test(result.mbtiCode)).toBe(true)
      for (const pair of DIMENSION_PAIRS) {
        expect(result.scores[pair].score).toBeGreaterThanOrEqual(-1)
        expect(result.scores[pair].score).toBeLessThanOrEqual(1)
        expect(result.scores[pair].percentage).toBeGreaterThanOrEqual(50)
        expect(result.scores[pair].percentage).toBeLessThanOrEqual(100)
      }
    }
  })

  it('全同意与全反对得到不同的结果画像', () => {
    const agreeAll = runEngine(questions.map(() => ANSWER_MAX))
    const disagreeAll = runEngine(questions.map(() => ANSWER_MIN))
    expect(agreeAll.mbtiCode).not.toBe(disagreeAll.mbtiCode)
    expect(agreeAll.code).not.toBe(disagreeAll.code)
  })

  it('同输入结果完全确定（榜次稳定）', () => {
    const answers = questions.map((_, index) => (index % 2 === 0 ? 2 : -1))
    const first = runEngine(answers)
    const second = runEngine(answers)
    expect(second.mbtiCode).toBe(first.mbtiCode)
    expect(second.code).toBe(first.code)
    expect(second.matchScore).toBe(first.matchScore)
    expect(second.characterMatches.map((item) => item.id)).toEqual(
      first.characterMatches.map((item) => item.id),
    )
  })

  it('未作答哨兵不参与计分', () => {
    const answered = runEngine(questions.map(() => 2))
    const withBlanks = runEngine(
      questions.map((_, index) => (index % 3 === 0 ? UNANSWERED : 2)),
    )
    // 有空洞的作答仍是合法结果，但画像应与完整作答不同
    expect(MBTI_PATTERN.test(withBlanks.mbtiCode)).toBe(true)
    expect(withBlanks.matchScore).not.toBe(answered.matchScore)
  })

  it('前三角色去重且 matchScore 夹在 [60, 99]', () => {
    const result = runEngine(questions.map(() => 1))
    const ids = result.characterMatches.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(result.matchScore).toBeGreaterThanOrEqual(60)
    expect(result.matchScore).toBeLessThanOrEqual(99)
  })

  it('中性作答（全 0）触发明字母平局规则得到 ESTJ', () => {
    const result = runEngine(questions.map(() => 0))
    expect(result.mbtiCode).toBe('ESTJ')
  })
})

describe('calculateQuizResult（最小合成数据）', () => {
  const minimalArchetypes = archetypes
  const minimalCharacters: CharacterMatch[] = []

  it('无角色可匹配时回退 UNKN 与保底分', () => {
    const result = calculateQuizResult({
      answers: [3, -3],
      questions: [
        { id: 't1', text: 'q', dimension: 'E_I', sign: 1 } as unknown as Question,
        { id: 't2', text: 'q', dimension: 'S_N', sign: 1 } as unknown as Question,
      ],
      archetypes: minimalArchetypes,
      characters: minimalCharacters,
    })
    expect(result.code).toBe('UNKN')
    expect(result.matchScore).toBe(60)
    expect(result.characterMatches).toEqual([])
    expect(result.mbtiCode[0]).toBe('E')
    expect(result.mbtiCode[1]).toBe('S')
  })

  it('单题满同意时对应维度到达 100%', () => {
    const result = calculateQuizResult({
      answers: [3],
      questions: [
        { id: 't1', text: 'q', scene: 's', dimension: 'E_I', sign: 1 } as unknown as Question,
      ],
      archetypes: minimalArchetypes,
      characters: minimalCharacters,
    })
    expect(result.scores.E_I.dominant).toBe('E')
    expect(result.scores.E_I.percentage).toBe(100)
  })
})

// ── 关键分支补测：平局规则 / 权重覆盖表 / matchCodeFlex ────────────────────────
// 合成题目 id 用 m 前缀，避开真实权重覆盖表（q1..q39）避免被覆盖语义干扰
const DIMENSION_SCORE_WEIGHTS = questionDimensionWeightsJson as Record<
  string,
  Partial<Record<'E_I' | 'S_N' | 'T_F' | 'J_P', number>>
>

function makeQuestion(id: string, dimension: Question['dimension'], sign: 1 | -1): Question {
  return { id, text: 'q', scene: 's', dimension, sign } as unknown as Question
}

function makeFlatCharacter(
  id: string,
  name: string,
  overrides: Partial<CharacterMatch> = {},
): CharacterMatch {
  return {
    id,
    name,
    series: 's',
    matchCode: 'ESTJ',
    code: id.toUpperCase(),
    archetypeId: 'luminous-lead',
    tags: [],
    note: 'n',
    vector: { expression: 0, temperature: 0, judgement: 0, order: 0, agency: 0, aura: 0 },
    ...overrides,
  } as CharacterMatch
}

describe('calculateQuizResult（平局分支）', () => {
  it('单维度恰好 50% 平局：score 为 0 时 dominant 取正字母', () => {
    // 同维度两题 sign 相反、答案同为 +3：raw = 3 - 3 = 0 → 恰好 50% 平局
    const result = calculateQuizResult({
      answers: [3, 3],
      questions: [makeQuestion('m1', 'E_I', 1), makeQuestion('m2', 'E_I', -1)],
      archetypes,
      characters: [],
    })
    expect(result.scores.E_I.score).toBe(0)
    expect(result.scores.E_I.percentage).toBe(50)
    expect(result.scores.E_I.dominant).toBe('E')
    expect(result.mbtiCode[0]).toBe('E')
  })

  it('原型累计全为 0（spread ≤ 0.0001）时原型分退化为常数：总分有限、榜次并列稳定', () => {
    // 全 0 作答：archetypeRaw 全 0 → scoreArchetype 走平局分支（0.55/0.45 常数，
    // 若实现错误地做 (raw-min)/spread 会除零产生 NaN，导致 matchScore 变 NaN）
    const questions = [makeQuestion('m0', 'E_I', 1)]
    const r1 = makeFlatCharacter('tie-a', '并列甲', { archetypeId: 'luminous-lead' })
    const r2 = makeFlatCharacter('tie-b', '并列乙', { archetypeId: 'shadow-strategist' })

    const first = calculateQuizResult({
      answers: [0],
      questions,
      archetypes,
      characters: [r1, r2],
    })
    const second = calculateQuizResult({
      answers: [0],
      questions,
      archetypes,
      characters: [r1, r2],
    })

    // 无 NaN：平局分支没有做除零运算
    expect(Number.isFinite(first.matchScore)).toBe(true)
    expect(first.topCharacterMatches.every((m) => Number.isFinite(m.score))).toBe(true)
    // 并列时总分相同（两原型拿到同一个常数分），榜次由中文名兜底且稳定
    expect(first.characterMatches.map((c) => c.id)).toEqual(
      second.characterMatches.map((c) => c.id),
    )
    // 0.25*0.5 + 0.28*0.55 + 0.27*0.5 + 0.2*0.5 = 0.514 → 夹取到保底 60
    expect(first.matchScore).toBe(60)
  })
})

describe('calculateQuizResult（权重覆盖表整体替换语义）', () => {
  const questionById = (id: string) =>
    questionsJson.find((q) => q.id === id) as unknown as Question

  it('q7 降噪条目：题目自带 dimension/sign 被整体替换为 0，不再计分', () => {
    // 前提：q7 在覆盖表中且值为 0（整体替换 = 该题完全退出维度计分）
    expect(DIMENSION_SCORE_WEIGHTS.q7).toEqual({ T_F: 0 })
    const q7 = questionById('q7') // 自身 dimension: T_F, sign: 1

    const result = calculateQuizResult({
      answers: [3],
      questions: [q7],
      archetypes,
      characters: [],
    })
    // 若误用题目自带 sign=1，满同意会得到 percentage 100；覆盖生效则保持 50
    expect(result.scores.T_F.score).toBe(0)
    expect(result.scores.T_F.percentage).toBe(50)
  })

  it('q35 覆盖条目：负权重翻转题目自带 sign 的计分方向', () => {
    // q35 自身 S_N sign=+1，覆盖表为 { S_N: -0.65 }：满同意应推向 N 而非 S
    expect(DIMENSION_SCORE_WEIGHTS.q35?.S_N).toBe(-0.65)
    const q35 = questionById('q35')

    const result = calculateQuizResult({
      answers: [3],
      questions: [q35],
      archetypes,
      characters: [],
    })
    expect(result.scores.S_N.dominant).toBe('N')
    expect(result.scores.S_N.percentage).toBe(100)
  })

  it('q23 覆盖条目：覆盖表新增的维度也参与计分（非自身 dimension）', () => {
    // q23 自身只有 E_I，覆盖表 { E_I: -1, S_N: -0.7 }：S_N 的得分只能来自覆盖表
    expect(DIMENSION_SCORE_WEIGHTS.q23).toEqual({ E_I: -1, S_N: -0.7 })
    const q23 = questionById('q23')

    const result = calculateQuizResult({
      answers: [3],
      questions: [q23],
      archetypes,
      characters: [],
    })
    expect(result.scores.E_I.dominant).toBe('I')
    expect(result.scores.S_N.dominant).toBe('N')
    expect(result.scores.S_N.percentage).toBe(100)
  })
})

describe('calculateQuizResult（matchCodeFlex 多码取最优）', () => {
  // 四题合成卷：前三维 sign=+1，J_P 用 sign=-1（引擎的方向容量按权重符号累计，
  // sign=-1 的题配正答案才能把 J_P 推向负向 dominant P）
  const flexQuestions: Question[] = [
    makeQuestion('m-e', 'E_I', 1),
    makeQuestion('m-s', 'S_N', 1),
    makeQuestion('m-t', 'T_F', 1),
    makeQuestion('m-j', 'J_P', -1),
  ]
  // 全 +3 → E/S/T/P = ESTP
  const estpAnswers = [3, 3, 3, 3]

  it('数据前提：真实角色集中存在带 matchCodeFlex 的角色', () => {
    expect(characters.some((c) => (c.matchCodeFlex ?? []).length > 0)).toBe(true)
  })

  it('flex 码命中时，带 flex 的角色胜过同配置但无 flex 的对照角色', () => {
    // 逢坂大河 matchCode=ISFP、matchCodeFlex=[INFP, ESTP]：
    // ESTP 作答下她靠 flex 拿满 mbti 分；对照组去掉 flex 后只剩 ISFP 的低分
    const taiga = characters.find((c) => c.id === 'aisaka-taiga')!
    expect(taiga.matchCodeFlex).toContain('ESTP')
    const control = { ...taiga, id: 'ctrl-no-flex', code: 'CTRL', name: '对照组角色', matchCodeFlex: undefined }

    const result = calculateQuizResult({
      answers: estpAnswers,
      questions: flexQuestions,
      archetypes,
      characters: [control, taiga],
    })
    expect(result.mbtiCode).toBe('ESTP')
    expect(result.code).toBe('TIGA')
    expect(result.characterMatches[0]!.id).toBe('aisaka-taiga')
  })

  it('flex 未命中时（作答码既非 matchCode 也非 flex），flex 角色不获得额外加成', () => {
    const taiga = characters.find((c) => c.id === 'aisaka-taiga')!
    const control = { ...taiga, id: 'ctrl-no-flex', code: 'CTRL', name: '对照组角色', matchCodeFlex: undefined }
    // ESTJ 作答：与 ISFP/INFP/ESTP 均不相同 → 两者的 mbti 分完全一致、总分并列
    const result = calculateQuizResult({
      answers: [3, 3, 3, -3], // E/S/T/J
      questions: flexQuestions,
      archetypes,
      characters: [control, taiga],
    })
    expect(result.mbtiCode).toBe('ESTJ')
    // 并列（差值小于排序阈值），榜次按中文名兜底，结果稳定不乱序
    expect(result.characterMatches).toHaveLength(2)
    expect(Number.isFinite(result.matchScore)).toBe(true)
  })
})
