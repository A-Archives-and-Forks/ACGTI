/**
 * 按版本分段对比线上真实表现
 */
import { readFileSync } from 'fs'

const sql = readFileSync('analysis/backup/mbti_feedback_data_2026-04-22.sql', 'utf-8')
const lines = sql.split('\n').filter(l => l.startsWith('INSERT'))

const records = []
let parseFail = 0

const verPattern = /'0\.3\.[0-8](?:-[a-z-]+)?'/
const mbtiPattern = /'([EI][NS][TF][JP])',\s*\d/

for (const line of lines) {
  // Version
  const vm = line.match(verPattern)
  if (!vm) { parseFail++; continue }
  const appVersion = vm[0].slice(1, -1)

  // Extract answers JSON
  const jsonStart = line.indexOf("'[{")
  if (jsonStart === -1) { parseFail++; continue }
  const closingIdx = line.indexOf("}]',", jsonStart)
  if (closingIdx === -1) { parseFail++; continue }

  // self_mbti: find the MBTI code right after the version string
  const afterVer = line.substring(vm.index + vm[0].length)
  const selfMatch = afterVer.match(/^\s*,\s*'([EI][NS][TF][JP])'\s*,\s*(\d)/)
  if (!selfMatch) { parseFail++; continue }
  const selfMbti = selfMatch[1]
  const confidence = parseInt(selfMatch[2])

  // predicted_mbti: after answers_json closing
  // closingIdx points to start of }]', pattern, skip }]', (4 chars) to get to predicted_mbti
  const afterJson = line.substring(closingIdx + 4)
  const predMatch = afterJson.match(/^\s*'([EI][NS][TF][JP])'/)
  if (!predMatch) { parseFail++; continue }
  const predictedMbti = predMatch[1]

  const answersJson = line.substring(jsonStart + 1, closingIdx + 2)

  try {
    const answers = JSON.parse(answersJson)
    if (!Array.isArray(answers) || answers.length === 0) continue
    records.push({ appVersion, selfMbti, confidence, predictedMbti, answers })
  } catch(e) { parseFail++ }
}

console.log('解析成功:', records.length, '失败:', parseFail)

// Version distribution
const verDist = {}
records.forEach(r => { verDist[r.appVersion] = (verDist[r.appVersion] || 0) + 1 })
console.log('\n版本分布:')
Object.entries(verDist).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v))

// Analysis
const versions = ['0.3.0', '0.3.1-sn-jp1', '0.3.2-ei-fix', '0.3.3-tf-fix', '0.3.4-ei-fix', '0.3.5-jp-fix', '0.3.7-tf-balance', '0.3.8-tf-denoise']

console.log('\n=== 各版本线上实际表现（系统真实预测 vs 用户自报）===')
console.log()
console.log('版本'.padEnd(20) + 'n'.padStart(5) + ' conf'.padStart(5) + ' 完全'.padStart(7) + ' EI'.padStart(7) + ' SN'.padStart(7) + ' TF'.padStart(7) + ' JP'.padStart(7) + ' T%'.padStart(18) + ' F%'.padStart(18) + ' 平衡'.padStart(7) + ' T>F'.padStart(5) + ' F>T'.padStart(5))
console.log('-'.repeat(130))

for (const ver of versions) {
  const vr = records.filter(r => r.appVersion === ver)
  if (vr.length === 0) continue
  const n = vr.length
  let exactMatch = 0, confSum = 0
  let dm = { E_I: 0, S_N: 0, T_F: 0, J_P: 0 }
  let tTotal = 0, tCorrect = 0, fTotal = 0, fCorrect = 0
  let tfC = { TT: 0, TF: 0, FT: 0, FF: 0 }

  vr.forEach(r => {
    confSum += r.confidence
    if (r.predictedMbti === r.selfMbti) exactMatch++
    ;['E_I','S_N','T_F','J_P'].forEach((dim, i) => {
      if (r.selfMbti[i] === r.predictedMbti[i]) dm[dim]++
    })
    const s = r.selfMbti[2], p = r.predictedMbti[2]
    tfC[s+p]++
    if (s === 'T') { tTotal++; if (p === 'T') tCorrect++ }
    else { fTotal++; if (p === 'F') fCorrect++ }
  })

  const bal = Math.min(tTotal ? tCorrect/tTotal*100 : 0, fTotal ? fCorrect/fTotal*100 : 0)

  console.log(
    ver.padEnd(20) +
    String(n).padStart(5) +
    (' ' + (confSum/n).toFixed(2)).padStart(6) +
    (' ' + (exactMatch/n*100).toFixed(1) + '%').padStart(8) +
    (' ' + (dm.E_I/n*100).toFixed(1) + '%').padStart(8) +
    (' ' + (dm.S_N/n*100).toFixed(1) + '%').padStart(8) +
    (' ' + (dm.T_F/n*100).toFixed(1) + '%').padStart(8) +
    (' ' + (dm.J_P/n*100).toFixed(1) + '%').padStart(8) +
    (' ' + (tTotal?(tCorrect/tTotal*100).toFixed(1):'N/A') + '%(' + tCorrect + '/' + tTotal + ')').padStart(19) +
    (' ' + (fTotal?(fCorrect/fTotal*100).toFixed(1):'N/A') + '%(' + fCorrect + '/' + fTotal + ')').padStart(19) +
    (' ' + bal.toFixed(1) + '%').padStart(8) +
    String(tfC.TF).padStart(5) +
    String(tfC.FT).padStart(5)
  )
}

// 重点对比：三个 TF 相关版本
console.log('\n=== 三个 TF 版本对比（0.3.5 基线 → 0.3.7 实验 → 0.3.8 当前）===')
for (const ver of ['0.3.5-jp-fix', '0.3.7-tf-balance', '0.3.8-tf-denoise']) {
  const vr = records.filter(r => r.appVersion === ver)
  if (vr.length === 0) continue
  const n = vr.length
  let exactMatch = 0
  let dm = { E_I: 0, S_N: 0, T_F: 0, J_P: 0 }
  let tTotal = 0, tCorrect = 0, fTotal = 0, fCorrect = 0
  let tfC = { TT: 0, TF: 0, FT: 0, FF: 0 }
  let selfDist = {}

  vr.forEach(r => {
    if (r.predictedMbti === r.selfMbti) exactMatch++
    ;['E_I','S_N','T_F','J_P'].forEach((dim, i) => {
      if (r.selfMbti[i] === r.predictedMbti[i]) dm[dim]++
    })
    const s = r.selfMbti[2], p = r.predictedMbti[2]
    tfC[s+p]++
    if (s === 'T') { tTotal++; if (p === 'T') tCorrect++ }
    else { fTotal++; if (p === 'F') fCorrect++ }
    selfDist[r.selfMbti] = (selfDist[r.selfMbti] || 0) + 1
  })

  console.log('\n--- ' + ver + ' (n=' + n + ') ---')
  console.log('完全匹配: ' + (exactMatch/n*100).toFixed(2) + '%')
  console.log('EI:' + (dm.E_I/n*100).toFixed(1) + '% SN:' + (dm.S_N/n*100).toFixed(1) + '% TF:' + (dm.T_F/n*100).toFixed(1) + '% JP:' + (dm.J_P/n*100).toFixed(1) + '%')
  console.log('TF混淆: TT=' + tfC.TT + ' TF=' + tfC.TF + ' FT=' + tfC.FT + ' FF=' + tfC.FF)
  console.log('T正确: ' + (tTotal?(tCorrect/tTotal*100).toFixed(1):'N/A') + '% F正确: ' + (fTotal?(fCorrect/fTotal*100).toFixed(1):'N/A') + '%')
  console.log('自报分布: ' + Object.entries(selfDist).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>k+':'+v).join(' '))
}
