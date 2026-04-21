/**
 * TF 权重扫描器 — 用 0.3.5 真实反馈数据回测不同权重组合
 * 不改题面，只调 questionDimensionWeights.json 中的 T_F 权重
 */
import { readFileSync } from 'fs'

const DIMS = ['E_I', 'S_N', 'T_F', 'J_P']
const LETTERS = { E_I: ['E','I'], S_N: ['S','N'], T_F: ['T','F'], J_P: ['J','P'] }

// 加载题目数据
const questions = JSON.parse(readFileSync('src/data/questions.json', 'utf-8'))

// TF 题目基础信息
const tfQuestions = questions.filter(q => q.dimension === 'T_F')
console.log('TF 题目:', tfQuestions.map(q => `${q.id}(sign=${q.sign})`).join(', '))

// 加载基础权重覆盖（0.3.5 状态，不含 TF 实验改动）
const baseWeights = JSON.parse(readFileSync('src/data/questionDimensionWeights.json', 'utf-8'))

// 加载反馈数据
const feedbackData = JSON.parse(readFileSync('scripts/tf_feedback_data.json', 'utf-8'))
console.log(`已加载 ${feedbackData.length} 条反馈记录`)
runScan()

function getDimensionWeights(questionId, overrides) {
  const ov = overrides[questionId]
  if (ov && ov['T_F'] !== undefined) return ov['T_F']
  const q = questions.find(q => q.id === questionId)
  return q?.dimension === 'T_F' ? q.sign : 0
}

function calculateMbti(answers, tfOverrides) {
  const rawScores = { E_I: 0, S_N: 0, T_F: 0, J_P: 0 }
  const dirMax = { E_I: {pos:0,neg:0}, S_N: {pos:0,neg:0}, T_F: {pos:0,neg:0}, J_P: {pos:0,neg:0} }

  answers.forEach(a => {
    const q = questions.find(q => q.id === a.questionId)
    if (!q) return
    const val = a.answerValue
    if (val == null || val < -3 || val > 3) return

    // 对 TF 维度使用覆盖权重，其他维度保持原样
    const dims = ['E_I', 'S_N', 'T_F', 'J_P']
    dims.forEach(dim => {
      let weight
      if (dim === 'T_F') {
        weight = getDimensionWeights(q.id, tfOverrides)
      } else {
        // 使用 0.3.5 基础权重
        const ov = baseWeights[q.id]
        if (ov && ov[dim] !== undefined) {
          weight = ov[dim]
        } else {
          weight = q.dimension === dim ? q.sign : 0
        }
      }
      if (weight === 0) return
      rawScores[dim] += val * weight
      if (weight > 0) dirMax[dim].positive += 3 * Math.abs(weight)
      else dirMax[dim].negative += 3 * Math.abs(weight)
    })
  })

  let code = ''
  for (const dim of DIMS) {
    const score = rawScores[dim]
    let normalized
    if (score >= 0) normalized = score / Math.max(1, dirMax[dim].positive)
    else normalized = score / Math.max(1, dirMax[dim].negative)
    const [pos, neg] = LETTERS[dim]
    code += normalized >= 0 ? pos : neg
  }
  return code
}

function evaluate(overrides, label) {
  let total = 0, exactMatch = 0
  let dimMatch = { E_I: 0, S_N: 0, T_F: 0, J_P: 0 }
  let tfConfusion = { TT: 0, TF: 0, FT: 0, FF: 0 }
  let predCounts = {}
  let selfCounts = {}

  feedbackData.forEach(row => {
    let answers
    try { answers = JSON.parse(row.answers_json) } catch { return }
    const predicted = calculateMbti(answers, overrides)
    const self = row.self_mbti
    total++
    if (predicted === self) exactMatch++
    DIMS.forEach(dim => {
      const i = DIMS.indexOf(dim)
      if (self[i] === predicted[i]) dimMatch[dim]++
    })
    // TF confusion
    const selfTF = self[2]
    const predTF = predicted[2]
    tfConfusion[selfTF + predTF]++

    predCounts[predicted] = (predCounts[predicted] || 0) + 1
    selfCounts[self] = (selfCounts[self] || 0) + 1
  })

  const exactPct = (exactMatch / total * 100).toFixed(2)
  const dimPct = {}
  DIMS.forEach(d => dimPct[d] = (dimMatch[d] / total * 100).toFixed(2))

  const tTotal = tfConfusion.TT + tfConfusion.TF
  const fTotal = tfConfusion.FT + tfConfusion.FF
  const tCorrect = tTotal ? (tfConfusion.TT / tTotal * 100).toFixed(1) : 'N/A'
  const fCorrect = fTotal ? (tfConfusion.FF / fTotal * 100).toFixed(1) : 'N/A'

  const t2f = tTotal ? tfConfusion.TF : 0
  const f2t = fTotal ? tfConfusion.FT : 0

  const infpPred = predCounts['INFP'] || 0
  const infpSelf = selfCounts['INFP'] || 0
  const infpPrec = infpPred ? (infpSelf / infpPred * 100).toFixed(1) : 'N/A'

  console.log(`\n=== ${label} ===`)
  console.log(`样本: ${total} | 完全匹配: ${exactPct}%`)
  console.log(`E/I: ${dimPct.E_I}% | S/N: ${dimPct.S_N}% | T/F: ${dimPct.T_F}% | J/P: ${dimPct.J_P}%`)
  console.log(`T正确: ${tCorrect}% (${tfConfusion.TT}/${tTotal}) | F正确: ${fCorrect}% (${tfConfusion.FF}/${fTotal})`)
  console.log(`T→F: ${t2f} | F→T: ${f2t} | T→F/F→T比: ${f2t ? (t2f/f2t).toFixed(1) : '∞'}`)
  console.log(`INFP预测: ${infpPred} | INFP自报: ${infpSelf} | INFP精确率: ${infpPrec}%`)

  return { exactPct: parseFloat(exactPct), tfPct: parseFloat(dimPct.T_F), jpPct: parseFloat(dimPct.J_P) }
}

function runScan() {
  // 基线：0.3.5 原始（无 TF 覆盖）
  const baseline = {}
  evaluate(baseline, '基线 0.3.5-jp-fix（无TF覆盖）')

  // 方案1：清零 5 个无效题（q7,q13,q19,q20,q27），保持 q29=1.5
  const plan1 = {
    q7: { T_F: 0 },
    q13: { T_F: 0 },
    q19: { T_F: 0 },
    q20: { T_F: 0 },
    q27: { T_F: 0 },
    q29: { T_F: 1.5 }
  }
  evaluate(plan1, '方案1: 清零5个无效题 + q29=1.5')

  // 方案2：清零无效题 + 大幅提升 q29
  const plan2 = {
    q7: { T_F: 0 },
    q13: { T_F: 0 },
    q19: { T_F: 0 },
    q20: { T_F: 0 },
    q27: { T_F: 0 },
    q29: { T_F: 2.5 }
  }
  evaluate(plan2, '方案2: 清零5个无效题 + q29=2.5')

  // 方案3：清零无效题 + q29=3.5
  const plan3 = {
    q7: { T_F: 0 },
    q13: { T_F: 0 },
    q19: { T_F: 0 },
    q20: { T_F: 0 },
    q27: { T_F: 0 },
    q29: { T_F: 3.5 }
  }
  evaluate(plan3, '方案3: 清零5个无效题 + q29=3.5')

  // 方案4：只清零3个最差(q7,q20,q27) + q29提升
  const plan4 = {
    q7: { T_F: 0 },
    q20: { T_F: 0 },
    q27: { T_F: 0 },
    q29: { T_F: 2.5 }
  }
  evaluate(plan4, '方案4: 只清零3个最差 + q29=2.5')

  // 方案5：渐进式 — 清零最差3个 + 降权弱区分2个 + 提q29
  const plan5 = {
    q7: { T_F: 0 },
    q20: { T_F: 0 },
    q27: { T_F: 0 },
    q13: { T_F: -0.3 },
    q19: { T_F: -0.3 },
    q29: { T_F: 2.5 }
  }
  evaluate(plan5, '方案5: 清零3+降权2+q29=2.5')

  // 方案6：清零5个 + q29=2.0 + 稍微提升q17（区分度OK但弱）
  const plan6 = {
    q7: { T_F: 0 },
    q13: { T_F: 0 },
    q19: { T_F: 0 },
    q20: { T_F: 0 },
    q27: { T_F: 0 },
    q17: { T_F: -1.5 },
    q29: { T_F: 2.0 }
  }
  evaluate(plan6, '方案6: 清零5+q17=-1.5+q29=2.0')

  // 扫描 q29 最优权重（固定清零5个）
  console.log('\n=== q29 权重扫描（固定清零q7,q13,q19,q20,q27）===')
  for (let w = 1.0; w <= 5.0; w += 0.5) {
    const ov = {
      q7: { T_F: 0 }, q13: { T_F: 0 }, q19: { T_F: 0 },
      q20: { T_F: 0 }, q27: { T_F: 0 }, q29: { T_F: w }
    }
    const r = evaluate(ov, `q29=${w}`)
  }
}
