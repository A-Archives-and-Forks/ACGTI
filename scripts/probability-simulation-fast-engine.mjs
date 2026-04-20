const DIMENSION_PAIRS = ['E_I', 'S_N', 'T_F', 'J_P']
const DIMENSION_LETTERS = [
  ['E', 'I'],
  ['S', 'N'],
  ['T', 'F'],
  ['J', 'P'],
]
const VECTOR_AXES = ['expression', 'temperature', 'judgement', 'order', 'agency', 'aura']
const ROLE_IDS = ['hero', 'strategist', 'guardian', 'lonewolf', 'healer', 'berserker', 'trickster', 'ruler']
const ROLE_TO_ARCHETYPE = {
  hero: 'luminous-lead',
  strategist: 'shadow-strategist',
  guardian: 'moonlit-guardian',
  lonewolf: 'icebound-observer',
  healer: 'gentle-healer',
  berserker: 'chaos-spark',
  trickster: 'trickster-orbit',
  ruler: 'oathbound-captain',
}
const ARCHETYPE_IDS = ROLE_IDS.map((role) => ROLE_TO_ARCHETYPE[role])
const QUESTION_WEIGHT_FALLBACKS = {
  E_I: { hero: 2, trickster: 2, healer: 1, lonewolf: -2, strategist: -1 },
  S_N: { strategist: 2, trickster: 2, healer: 1, ruler: -1, guardian: -1 },
  T_F: { strategist: 2, ruler: 1, healer: -2, guardian: -1, berserker: 1 },
  J_P: { ruler: 2, guardian: 1, strategist: 1, trickster: -2, berserker: -1 },
}
const MBTI_PATTERN = /^[EI][SN][TF][JP]$/
const MBTI_WEIGHT = 0.25
const ARCHETYPE_WEIGHT = 0.28
const VECTOR_WEIGHT = 0.27
const CHARACTER_SPECIFIC_WEIGHT = 0.2

function normalizeQuestionWeights(weights) {
  const completed = ROLE_IDS.map((role) => weights?.[role] ?? 0)
  const mean = completed.reduce((sum, value) => sum + value, 0) / completed.length
  let norm = 0
  const centered = completed.map((value) => {
    const next = value - mean
    norm += Math.abs(next)
    return next
  })

  const divisor = norm || 1
  return centered.map((value) => value / divisor)
}

function parseQuestionIndex(questionId) {
  return Number.parseInt(questionId.replace(/^q/i, ''), 10) - 1
}

function evaluateAffinity(answer, expected) {
  if (expected === 'agree') {
    return Math.max(0, (answer + 3) / 6)
  }

  if (expected === 'disagree') {
    return Math.max(0, (3 - answer) / 6)
  }

  return Math.max(0, 1 - Math.abs(answer) / 3)
}

function localeTie(left, right) {
  return left.localeCompare(right, 'zh-Hans-CN')
}

export function createFastProbabilitySimulator({
  questions,
  archetypes,
  characters,
  questionDimensionWeights,
  sharpness = 120,
}) {
  const dimensionIndexById = new Map(DIMENSION_PAIRS.map((id, index) => [id, index]))
  const archetypeIndexById = new Map(ARCHETYPE_IDS.map((id, index) => [id, index]))
  const archetypeVectorById = new Map(archetypes.map((item) => [item.id, item.vector]))
  const directionalPositiveMax = new Float64Array(DIMENSION_PAIRS.length)
  const directionalNegativeMax = new Float64Array(DIMENSION_PAIRS.length)

  const preparedQuestions = questions.map((question) => {
    const dimensionWeights = questionDimensionWeights[question.id] ?? { [question.dimension]: question.sign }
    const dimensions = []

    for (const pair of Object.keys(dimensionWeights)) {
      const weight = dimensionWeights[pair] ?? 0
      if (weight === 0) {
        continue
      }

      const dimensionIndex = dimensionIndexById.get(pair)
      if (dimensionIndex === undefined) {
        continue
      }

      dimensions.push([dimensionIndex, weight])
      if (weight > 0) {
        directionalPositiveMax[dimensionIndex] += 3 * weight
      } else {
        directionalNegativeMax[dimensionIndex] += 3 * Math.abs(weight)
      }
    }

    const archetypeUnit = new Float64Array(ARCHETYPE_IDS.length)
    const vectorUnit = new Float64Array(VECTOR_AXES.length)
    const normalizedWeights = normalizeQuestionWeights(
      question.weights ?? QUESTION_WEIGHT_FALLBACKS[question.dimension],
    )

    for (let roleIndex = 0; roleIndex < ROLE_IDS.length; roleIndex += 1) {
      const value = normalizedWeights[roleIndex] ?? 0
      if (value === 0) {
        continue
      }

      const archetypeId = ROLE_TO_ARCHETYPE[ROLE_IDS[roleIndex]]
      const archetypeIndex = archetypeIndexById.get(archetypeId)
      const archetypeVector = archetypeVectorById.get(archetypeId)
      if (archetypeIndex === undefined || !archetypeVector) {
        continue
      }

      archetypeUnit[archetypeIndex] += value
      for (let axisIndex = 0; axisIndex < VECTOR_AXES.length; axisIndex += 1) {
        vectorUnit[axisIndex] += value * archetypeVector[VECTOR_AXES[axisIndex]]
      }
    }

    return { dimensions, archetypeUnit, vectorUnit }
  })

  const preparedCharacters = characters.map((character, index) => {
    const vector = new Float64Array(VECTOR_AXES.map((axis) => character.vector[axis] ?? 0))
    let vectorMagnitude = 0
    for (const value of vector) {
      vectorMagnitude += value * value
    }
    vectorMagnitude = Math.sqrt(vectorMagnitude)

    const codes = [character.matchCode, ...(character.matchCodeFlex ?? [])]
      .map((code) => code.toUpperCase())
      .filter((code) => MBTI_PATTERN.test(code))

    const uniqueAxes = Object.entries(character.signature?.uniqueAxes ?? {})
      .map(([axis, expected]) => [VECTOR_AXES.indexOf(axis), expected])
      .filter(([axisIndex]) => axisIndex >= 0)

    const questionAffinity = (character.signature?.questionAffinity ?? [])
      .map((affinity) => ({
        questionIndex: parseQuestionIndex(affinity.questionId),
        expected: affinity.expected,
        weight: affinity.weight ?? 1,
      }))
      .filter((affinity) => affinity.questionIndex >= 0)

    return {
      index,
      id: character.id,
      name: character.name,
      matchWeight: character.matchWeight ?? 1,
      archetypeIndex: archetypeIndexById.get(character.archetypeId) ?? -1,
      codes,
      vector,
      vectorMagnitude,
      uniqueAxes,
      questionAffinity,
    }
  })

  const characterCount = preparedCharacters.length
  const totals = new Float64Array(characterCount)
  const archetypeScores = new Float64Array(characterCount)
  const vectorScores = new Float64Array(characterCount)
  const specificScores = new Float64Array(characterCount)
  const rankingIndices = preparedCharacters.map((_, index) => index)

  return {
    characterIds: preparedCharacters.map((character) => character.id),
    run(answers) {
      const rawScores = new Float64Array(DIMENSION_PAIRS.length)
      const archetypeRaw = new Float64Array(ARCHETYPE_IDS.length)
      const userVector = new Float64Array(VECTOR_AXES.length)

      for (let questionIndex = 0; questionIndex < preparedQuestions.length; questionIndex += 1) {
        const answer = answers[questionIndex]
        if (answer < -3 || answer > 3) {
          continue
        }

        const question = preparedQuestions[questionIndex]
        for (const [dimensionIndex, weight] of question.dimensions) {
          rawScores[dimensionIndex] += answer * weight
        }
        for (let index = 0; index < ARCHETYPE_IDS.length; index += 1) {
          archetypeRaw[index] += answer * question.archetypeUnit[index]
        }
        for (let index = 0; index < VECTOR_AXES.length; index += 1) {
          userVector[index] += answer * question.vectorUnit[index]
        }
      }

      const dominantLetters = new Array(DIMENSION_PAIRS.length)
      const percentages = new Float64Array(DIMENSION_PAIRS.length)
      for (let index = 0; index < DIMENSION_PAIRS.length; index += 1) {
        const rawScore = rawScores[index]
        const normalized = rawScore >= 0
          ? rawScore / Math.max(1, directionalPositiveMax[index])
          : rawScore / Math.max(1, directionalNegativeMax[index])
        dominantLetters[index] = DIMENSION_LETTERS[index][normalized >= 0 ? 0 : 1]
        percentages[index] = Math.round(50 + Math.min(1, Math.abs(normalized)) * 50)
      }

      let archetypeMin = Infinity
      let archetypeMax = -Infinity
      for (const value of archetypeRaw) {
        if (value < archetypeMin) archetypeMin = value
        if (value > archetypeMax) archetypeMax = value
      }
      const archetypeSpread = archetypeMax - archetypeMin

      let userVectorMagnitude = 0
      for (const value of userVector) {
        userVectorMagnitude += value * value
      }
      userVectorMagnitude = Math.sqrt(userVectorMagnitude)

      let maxTotal = -Infinity

      for (const character of preparedCharacters) {
        let mbti = 0
        for (const code of character.codes) {
          let codeScore = 0
          for (let dimensionIndex = 0; dimensionIndex < DIMENSION_PAIRS.length; dimensionIndex += 1) {
            codeScore += dominantLetters[dimensionIndex] === code[dimensionIndex]
              ? percentages[dimensionIndex]
              : 100 - percentages[dimensionIndex]
          }
          mbti = Math.max(mbti, codeScore / 400)
        }

        const archetypeValue = character.archetypeIndex >= 0 ? archetypeRaw[character.archetypeIndex] : 0
        const archetype = archetypeSpread <= 0.0001
          ? (archetypeValue >= 0 ? 0.55 : 0.45)
          : (archetypeValue - archetypeMin) / archetypeSpread

        let cosine = 0
        if (userVectorMagnitude && character.vectorMagnitude) {
          let dot = 0
          for (let axisIndex = 0; axisIndex < VECTOR_AXES.length; axisIndex += 1) {
            dot += userVector[axisIndex] * character.vector[axisIndex]
          }
          cosine = dot / (userVectorMagnitude * character.vectorMagnitude)
        }
        const vector = (cosine + 1) / 2

        let axisScore = vector
        if (character.uniqueAxes.length) {
          let weightedScore = 0
          let weightTotal = 0
          for (const [axisIndex, expected] of character.uniqueAxes) {
            const actual = userVector[axisIndex]
            const axisWeight = Math.max(0.5, Math.abs(expected))
            const distance = Math.abs(actual - expected)
            const normalizedDistance = Math.min(1, distance / 6)
            weightedScore += Math.max(0, 1 - normalizedDistance) * axisWeight
            weightTotal += axisWeight
          }
          axisScore = weightTotal ? weightedScore / weightTotal : 0.5
        }

        let specific = axisScore
        if (character.questionAffinity.length) {
          let weightedScore = 0
          let weightTotal = 0
          for (const affinity of character.questionAffinity) {
            const answer = answers[affinity.questionIndex]
            if (answer < -3 || answer > 3) {
              continue
            }
            weightedScore += evaluateAffinity(answer, affinity.expected) * affinity.weight
            weightTotal += affinity.weight
          }
          const affinityScore = weightTotal ? weightedScore / weightTotal : 0.5
          specific = axisScore * 0.45 + affinityScore * 0.55
        }

        const total = (
          MBTI_WEIGHT * mbti +
          ARCHETYPE_WEIGHT * archetype +
          VECTOR_WEIGHT * vector +
          CHARACTER_SPECIFIC_WEIGHT * specific
        ) * character.matchWeight

        totals[character.index] = total
        archetypeScores[character.index] = archetype
        vectorScores[character.index] = vector
        specificScores[character.index] = specific
        if (total > maxTotal) {
          maxTotal = total
        }
      }

      for (let index = 0; index < characterCount; index += 1) {
        rankingIndices[index] = index
      }
      rankingIndices.sort((left, right) => {
        const totalDelta = totals[right] - totals[left]
        if (Math.abs(totalDelta) > 0.005) {
          return totalDelta
        }

        const archetypeDelta = archetypeScores[right] - archetypeScores[left]
        if (Math.abs(archetypeDelta) > 0.005) {
          return archetypeDelta
        }

        const vectorDelta = vectorScores[right] - vectorScores[left]
        if (Math.abs(vectorDelta) > 0.005) {
          return vectorDelta
        }

        const specificDelta = specificScores[right] - specificScores[left]
        if (Math.abs(specificDelta) > 0.005) {
          return specificDelta
        }

        return localeTie(preparedCharacters[left].name, preparedCharacters[right].name)
      })
      const winnerIndex = rankingIndices[0] ?? -1

      let totalWeight = 0
      for (let index = 0; index < characterCount; index += 1) {
        const weight = Math.exp((totals[index] - maxTotal) * sharpness)
        totals[index] = weight
        totalWeight += weight
      }

      if (totalWeight <= 0) {
        totals.fill(1 / characterCount)
      } else {
        for (let index = 0; index < characterCount; index += 1) {
          totals[index] /= totalWeight
        }
      }

      return {
        winnerIndex,
        weights: totals,
      }
    },
  }
}
