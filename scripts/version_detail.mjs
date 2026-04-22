import { readFileSync } from 'fs'

const sql = readFileSync('analysis/backup/mbti_feedback_data_2026-04-22.sql', 'utf-8')
const lines = sql.split('\n').filter(l => l.startsWith('INSERT'))
const verPattern = /'0\.3\.[0-8](?:-[a-z-]+)?'/

const records = []
for (const line of lines) {
  const vm = line.match(verPattern)
  if (!vm) continue
  const ver = vm[0].slice(1,-1)
  const jsonStart = line.indexOf("'[")
  if (jsonStart === -1) continue
  const closingIdx = line.indexOf("}]',", jsonStart)
  if (closingIdx === -1) continue
  const afterVer = line.substring(vm.index + vm[0].length)
  const selfMatch = afterVer.match(/^\s*,\s*'([EI][NS][TF][JP])'\s*,\s*(\d)/)
  if (!selfMatch) continue
  const afterJson = line.substring(closingIdx + 4)
  const predMatch = afterJson.match(/^\s*'([EI][NS][TF][JP])'/)
  if (!predMatch) continue
  records.push({ ver, self: selfMatch[1], pred: predMatch[1], conf: parseInt(selfMatch[2]) })
}

console.log('=== 自报 T/F 比例 vs 预测 T/F 比例 ===')
for (const ver of ['0.3.5-jp-fix', '0.3.7-tf-balance', '0.3.8-tf-denoise']) {
  const vr = records.filter(r => r.ver === ver)
  const tSelf = vr.filter(r => r.self[2]==='T').length
  const fSelf = vr.filter(r => r.self[2]==='F').length
  const tPred = vr.filter(r => r.pred[2]==='T').length
  const fPred = vr.filter(r => r.pred[2]==='F').length
  console.log(ver + ': 自报 T:' + tSelf + ' F:' + fSelf + ' (' + (tSelf/(tSelf+fSelf)*100).toFixed(1) + '%T) | 预测 T:' + tPred + ' F:' + fPred + ' (' + (tPred/(tPred+fPred)*100).toFixed(1) + '%T)')
}

console.log('\n=== 0.3.8 的问题诊断 ===')
const v38 = records.filter(r => r.ver === '0.3.8-tf-denoise')
const v35 = records.filter(r => r.ver === '0.3.5-jp-fix')

// How many F→T in 0.3.8 vs 0.3.5
const f2t_38 = v38.filter(r => r.self[2]==='F' && r.pred[2]==='T').length
const f2t_35 = v35.filter(r => r.self[2]==='F' && r.pred[2]==='T').length
const fSelf38 = v38.filter(r => r.self[2]==='F').length
const fSelf35 = v35.filter(r => r.self[2]==='F').length

console.log('F→T 误判: 0.3.5=' + f2t_35 + '/' + fSelf35 + '(' + (f2t_35/fSelf35*100).toFixed(1) + '%) → 0.3.8=' + f2t_38 + '/' + fSelf38 + '(' + (f2t_38/fSelf38*100).toFixed(1) + '%)')

// Which types are most affected by F→T in 0.3.8?
const f2tTypes38 = {}
v38.filter(r => r.self[2]==='F' && r.pred[2]==='T').forEach(r => {
  const key = r.self + '→' + r.pred
  f2tTypes38[key] = (f2tTypes38[key] || 0) + 1
})
console.log('\n0.3.8 F→T 误判类型分布:')
Object.entries(f2tTypes38).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v))

// T→F in 0.3.8
const t2fTypes38 = {}
v38.filter(r => r.self[2]==='T' && r.pred[2]==='F').forEach(r => {
  const key = r.self + '→' + r.pred
  t2fTypes38[key] = (t2fTypes38[key] || 0) + 1
})
console.log('\n0.3.8 T→F 误判类型分布:')
Object.entries(t2fTypes38).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v))

// Conclusion
console.log('\n=== 结论 ===')
console.log('0.3.5: TF总精度最高(65.4%), 但T正确率最低(43.0%), 偏F')
console.log('0.3.7: TF总精度最高(66.8%), T/F较平衡(47.9%/79.9%), 但完全匹配退(24.4%)')
console.log('0.3.8: T正确率最高(49.5%), 但TF总精度最低(61.1%), F→T暴增到158')
console.log('')
console.log('0.3.8 的核心问题: 清零q13降低了F方向信号, 导致大量F被误判为T')
console.log('0.3.7 虽然被回退, 但线上数据证明它的TF表现最好')
