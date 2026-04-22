/**
 * 离线回测验证 — 用全量反馈数据测试新权重配置
 */
import { readFileSync } from 'fs'

const questions = JSON.parse(readFileSync('src/data/questions.json', 'utf-8'))
const weights = JSON.parse(readFileSync('src/data/questionDimensionWeights.json', 'utf-8'))
const feedbackData = JSON.parse(readFileSync('scripts/tf_feedback_data.json', 'utf-8'))

const DIMS = ['E_I', 'S_N', 'T_F', 'J_P']
const LETTERS = { E_I: ['E','I'], S_N: ['S','N'], T_F: ['T','F'], J_P: ['J','P'] }

console.log('当前权重配置:')
const tfQs = questions.filter(q => q.dimension === 'T_F')
tfQs.forEach(q => {
  const ov = weights[q.id]
  const effective = (ov && ov.T_F !== undefined) ? ov.T_F : q.sign
  console.log('  ' + q.id + ': sign=' + q.sign + ', effective=' + effective)
})
console.log('\n反馈数据: ' + feedbackData.length + ' 条\n')

function getWeight(questionId, dim) {
  const ov = weights[questionId]
  if (ov && ov[dim] !== undefined) return ov[dim]
  const q = questions.find(q => q.id === questionId)
  return q?.dimension === dim ? q.sign : 0
}

function calculateMbti(answers) {
  const rawScores = { E_I: 0, S_N: 0, T_F: 0, J_P: 0 }
  const dirMax = { E_I: {pos:0,neg:0}, S_N: {pos:0,neg:0}, T_F: {pos:0,neg:0}, J_P: {pos:0,neg:0} }
  answers.forEach(a => {
    const q = questions.find(q => q.id === a.questionId)
    if (!q) return
    const val = a.answerValue
    if (val == null || val < -3 || val > 3) return
    DIMS.forEach(dim => {
      const w = getWeight(q.id, dim)
      if (w === 0) return
      rawScores[dim] += val * w
      if (w > 0) dirMax[dim].pos += 3 * Math.abs(w)
      else dirMax[dim].neg += 3 * Math.abs(w)
    })
  })
  let code = ''
  for (const dim of DIMS) {
    const score = rawScores[dim]
    let normalized
    if (score >= 0) normalized = score / Math.max(1, dirMax[dim].pos)
    else normalized = score / Math.max(1, dirMax[dim].neg)
    code += normalized >= 0 ? LETTERS[dim][0] : LETTERS[dim][1]
  }
  return code
}

let total = 0, exactMatch = 0
let dm = { E_I: 0, S_N: 0, T_F: 0, J_P: 0 }
let tfC = { TT: 0, TF: 0, FT: 0, FF: 0 }
let predCounts = {}

feedbackData.forEach(row => {
  let answers
  try { answers = JSON.parse(row.answers_json) } catch { return }
  const predicted = calculateMbti(answers)
  const self = row.self_mbti
  total++
  if (predicted === self) exactMatch++
  DIMS.forEach((dim, i) => { if (self[i] === predicted[i]) dm[dim]++ })
  tfC[self[2] + predicted[2]]++
  predCounts[predicted] = (predCounts[predicted] || 0) + 1
})

const tTotal = tfC.TT + tfC.TF
const fTotal = tfC.FT + tfC.FF
const bal = Math.min(tfC.TT/tTotal*100, tfC.FF/fTotal*100)

console.log('=== 离线回测结果 ===')
console.log('样本: ' + total)
console.log('完全匹配: ' + (exactMatch/total*100).toFixed(2) + '%')
console.log('EI: ' + (dm.E_I/total*100).toFixed(1) + '% | SN: ' + (dm.S_N/total*100).toFixed(1) + '% | TF: ' + (dm.T_F/total*100).toFixed(1) + '% | JP: ' + (dm.J_P/total*100).toFixed(1) + '%')
console.log('TF混淆: TT=' + tfC.TT + ' TF=' + tfC.TF + ' FT=' + tfC.FT + ' FF=' + tfC.FF)
console.log('T正确: ' + (tfC.TT/tTotal*100).toFixed(1) + '% (' + tfC.TT + '/' + tTotal + ')')
console.log('F正确: ' + (tfC.FF/fTotal*100).toFixed(1) + '% (' + tfC.FF + '/' + fTotal + ')')
console.log('平衡性: ' + bal.toFixed(1) + '%')

const topPred = Object.entries(predCounts).sort((a,b)=>b[1]-a[1]).slice(0,5)
console.log('Top预测: ' + topPred.map(([k,v])=>k+':'+v).join(', '))

// 对比表
console.log('\n=== 与线上版本对比 ===')
console.log('指标          0.3.5   0.3.7   0.3.8   新权重(离线)')
console.log('TF总精度      65.4%   66.8%   61.1%   ' + (dm.T_F/total*100).toFixed(1) + '%')
console.log('T正确率       43.0%   47.9%   49.5%   ' + (tfC.TT/tTotal*100).toFixed(1) + '%')
console.log('F正确率       79.5%   79.9%   67.8%   ' + (tfC.FF/fTotal*100).toFixed(1) + '%')
