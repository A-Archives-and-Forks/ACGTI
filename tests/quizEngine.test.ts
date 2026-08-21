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
        { id: 't1', text: 'q', dimension: 'E_I', sign: 1 } as unknown as Question,
      ],
      archetypes: minimalArchetypes,
      characters: minimalCharacters,
    })
    expect(result.scores.E_I.dominant).toBe('E')
    expect(result.scores.E_I.percentage).toBe(100)
  })
})
