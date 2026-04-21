/**
 * 0.3.7-tf-balance2 回测验证
 */
import { readFileSync } from 'fs';

const recordsPath = process.argv[2] ?? process.env.TF_RECORDS_PATH ?? 'C:/Users/TX/tf_records.json';
const records = JSON.parse(readFileSync(recordsPath, 'utf8'));

const TF_SIGNS = { q1: -1, q7: 1, q9: -1, q13: -1, q17: -1, q18: -1, q19: -1, q20: -1, q22: -1, q27: -1, q29: 1 };

// v0.3.5 weights (old)
const OLD_WEIGHTS = { q1: -1, q7: 1, q9: -1, q13: -1, q17: -1, q18: -1, q19: -1, q20: -0.5, q22: -1, q27: -1, q29: 1.5 };
// v0.3.6 weights (previous experiment)
const EXPERIMENT_WEIGHTS = { q1: -1, q7: 1, q9: -1, q13: -1, q17: -1, q18: -1, q19: -0.5, q20: 0, q22: -1, q27: -0.5, q29: 1.5 };
// v0.3.7 weights (selected conservative rollback)
const NEW_WEIGHTS = { q1: -1, q7: 1, q9: -1, q13: -1, q17: -1, q18: -1, q19: -0.75, q20: 0, q22: -1, q27: -1, q29: 1.5 };

// All dimension weights for full MBTI sim
const DIM_WEIGHTS = {
  q2: { 'J_P': -1.15 }, q3: { 'S_N': 1 }, q4: { 'J_P': -1 }, q5: { 'J_P': -0.4 },
  q6: { 'S_N': -1 }, q8: { 'J_P': -1.2 }, q10: { 'S_N': -1 }, q11: { 'E_I': -1 },
  q12: { 'E_I': 1 }, q14: { 'S_N': 1 }, q15: { 'S_N': -1 }, q16: { 'S_N': 1 },
  q21: { 'J_P': -1 }, q23: { 'E_I': -1, 'S_N': -0.7 }, q24: { 'S_N': 1 },
  q25: { 'E_I': 0 }, q26: { 'E_I': 0 }, q28: { 'E_I': -2 },
  q30: { 'S_N': -1 }, q31: { 'J_P': -0.65 }, q32: { 'E_I': -1 },
  q33: { 'J_P': 0 }, q34: { 'J_P': 0 }, q35: { 'S_N': -0.65 },
  q36: { 'E_I': 1 }, q37: { 'S_N': -0.8, 'J_P': 0.25 }, q38: { 'J_P': 0 },
  q39: { 'E_I': 1 }
};

function simulateFullMBTI(records, tfWeights) {
  const typeCounts = {};
  let exactMatch = 0, eiC = 0, snC = 0, tfC = 0, jpC = 0;
  let tTotal = 0, tCorrect = 0, fTotal = 0, fCorrect = 0;

  // Misclassification tracking
  const misclass = {};

  for (const r of records) {
    try {
      const answers = JSON.parse(r.answers_json);
      const dims = { 'E_I': 0, 'S_N': 0, 'T_F': 0, 'J_P': 0 };
      const maxScores = {
        'E_I': { pos: 0, neg: 0 }, 'S_N': { pos: 0, neg: 0 },
        'T_F': { pos: 0, neg: 0 }, 'J_P': { pos: 0, neg: 0 }
      };

      for (const a of answers) {
        const qid = a.questionId;
        let dimWeights;

        if (TF_SIGNS.hasOwnProperty(qid)) {
          dimWeights = { 'T_F': tfWeights[qid] };
        } else if (DIM_WEIGHTS[qid]) {
          dimWeights = DIM_WEIGHTS[qid];
        } else {
          continue;
        }

        for (const [dim, weight] of Object.entries(dimWeights)) {
          if (weight === 0) continue;
          dims[dim] += a.answerValue * weight;
          if (weight > 0) maxScores[dim].pos += 3 * weight;
          else maxScores[dim].neg += 3 * Math.abs(weight);
        }
      }

      const letters = [];
      const posLetters = { 'E_I': 'E', 'S_N': 'S', 'T_F': 'T', 'J_P': 'J' };
      for (const dim of ['E_I', 'S_N', 'T_F', 'J_P']) {
        const raw = dims[dim];
        const norm = raw >= 0 ? raw / Math.max(1, maxScores[dim].pos) : raw / Math.max(1, maxScores[dim].neg);
        letters.push(norm >= 0 ? posLetters[dim] : dim.split('_')[1]);
      }

      const predicted = letters.join('');
      const self = r.self_mbti;

      typeCounts[predicted] = (typeCounts[predicted] || 0) + 1;
      if (predicted === self) exactMatch++;
      if (predicted[0] === self[0]) eiC++;
      if (predicted[1] === self[1]) snC++;
      if (predicted[2] === self[2]) tfC++;
      if (predicted[3] === self[3]) jpC++;

      if (self[2] === 'T') { tTotal++; if (predicted[2] === 'T') tCorrect++; }
      if (self[2] === 'F') { fTotal++; if (predicted[2] === 'F') fCorrect++; }

      if (predicted !== self) {
        const key = `${self}→${predicted}`;
        misclass[key] = (misclass[key] || 0) + 1;
      }
    } catch (e) {}
  }

  const n = records.length;
  return {
    n, exactMatch, eiC, snC, tfC, jpC, tTotal, tCorrect, fTotal, fCorrect,
    typeCounts, misclass,
    exact: (exactMatch / n * 100).toFixed(1),
    ei: (eiC / n * 100).toFixed(1),
    sn: (snC / n * 100).toFixed(1),
    tf: (tfC / n * 100).toFixed(1),
    jp: (jpC / n * 100).toFixed(1),
    tRate: (tCorrect / tTotal * 100).toFixed(1),
    fRate: (fCorrect / fTotal * 100).toFixed(1),
  };
}

const allRecords = records.filter(r => r.answers_json && r.self_mbti && r.predicted_mbti);

console.log('=== 0.3.7-tf-balance2 回测验证 ===\n');
console.log(`数据集: ${allRecords.length} 条 (v0.3.3 ~ v0.3.5 反馈)\n`);

const old = simulateFullMBTI(allRecords, OLD_WEIGHTS);
const nw = simulateFullMBTI(allRecords, NEW_WEIGHTS);
const candidates = [
  { label: 'v0.3.5', weights: OLD_WEIGHTS },
  { label: 'A q20=0 q19=-0.75 q27=-1', weights: { ...OLD_WEIGHTS, q20: 0, q19: -0.75, q27: -1 } },
  { label: 'B q20=0 q19=-1 q27=-0.75', weights: { ...OLD_WEIGHTS, q20: 0, q19: -1, q27: -0.75 } },
  { label: 'C q20=0 q19=-0.75 q27=-0.75', weights: { ...OLD_WEIGHTS, q20: 0, q19: -0.75, q27: -0.75 } },
  { label: 'D v0.3.6 q20=0 q19=-0.5 q27=-0.5', weights: EXPERIMENT_WEIGHTS },
].map((item) => ({ ...item, result: simulateFullMBTI(allRecords, item.weights) }));

console.log('指标'.padEnd(20) + '| v0.3.5 (旧) | v0.3.7 (新) | 变化');
console.log('-'.repeat(65));
console.log(`精确匹配`.padEnd(20) + `| ${old.exact}%`.padEnd(14) + `| ${nw.exact}%`.padEnd(12) + `| ${parseFloat(nw.exact) - parseFloat(old.exact) >= 0 ? '+' : ''}${(parseFloat(nw.exact) - parseFloat(old.exact)).toFixed(1)}pp`);
console.log(`EI 准确率`.padEnd(20) + `| ${old.ei}%`.padEnd(14) + `| ${nw.ei}%`.padEnd(12) + `| ${(parseFloat(nw.ei) - parseFloat(old.ei)).toFixed(1)}pp`);
console.log(`SN 准确率`.padEnd(20) + `| ${old.sn}%`.padEnd(14) + `| ${nw.sn}%`.padEnd(12) + `| ${(parseFloat(nw.sn) - parseFloat(old.sn)).toFixed(1)}pp`);
console.log(`TF 准确率`.padEnd(20) + `| ${old.tf}%`.padEnd(14) + `| ${nw.tf}%`.padEnd(12) + `| ${(parseFloat(nw.tf) - parseFloat(old.tf)).toFixed(1)}pp`);
console.log(`JP 准确率`.padEnd(20) + `| ${old.jp}%`.padEnd(14) + `| ${nw.jp}%`.padEnd(12) + `| ${(parseFloat(nw.jp) - parseFloat(old.jp)).toFixed(1)}pp`);
console.log(`T 正确率`.padEnd(20) + `| ${old.tRate}% (${old.tCorrect}/${old.tTotal})`.padEnd(14) + `| ${nw.tRate}% (${nw.tCorrect}/${nw.tTotal})`.padEnd(12) + `| ${(parseFloat(nw.tRate) - parseFloat(old.tRate)).toFixed(1)}pp`);
console.log(`F 正确率`.padEnd(20) + `| ${old.fRate}% (${old.fCorrect}/${old.fTotal})`.padEnd(14) + `| ${nw.fRate}% (${nw.fCorrect}/${nw.fTotal})`.padEnd(12) + `| ${(parseFloat(nw.fRate) - parseFloat(old.fRate)).toFixed(1)}pp`);

console.log('\n=== q20 固定清零后的 q19/q27 回拉扫描 ===');
console.log('方案'.padEnd(38) + '| 精确 | TF  | T正确 | F正确 | INFP% | INTP%');
console.log('-'.repeat(95));
for (const candidate of candidates) {
  const r = candidate.result;
  const infp = r.typeCounts['INFP'] || 0;
  const intp = r.typeCounts['INTP'] || 0;
  console.log(
    `${candidate.label.padEnd(38)} | ${r.exact}% | ${r.tf}% | ${r.tRate}% | ${r.fRate}% | ${(infp / r.n * 100).toFixed(1)}% | ${(intp / r.n * 100).toFixed(1)}%`
  );
}

// INFP analysis
const oldInfp = old.typeCounts['INFP'] || 0;
const newInfp = nw.typeCounts['INFP'] || 0;
console.log(`\nINFP 预测数`.padEnd(20) + `| ${oldInfp} (${(oldInfp/old.n*100).toFixed(1)}%)`.padEnd(14) + `| ${newInfp} (${(newInfp/nw.n*100).toFixed(1)}%)`.padEnd(12) + `| ${(newInfp-oldInfp) >= 0 ? '+' : ''}${newInfp-oldInfp}`);

// Self-reported INFP
const selfInfp = allRecords.filter(r => r.self_mbti === 'INFP').length;
console.log(`INFP 自报数`.padEnd(20) + `| ${selfInfp} (${(selfInfp/allRecords.length*100).toFixed(1)}%)`);

// Top misclassification patterns
console.log('\n=== Top 误判模式对比 ===');
const topMisOld = Object.entries(old.misclass).sort((a,b) => b[1]-a[1]).slice(0, 10);
const topMisNew = Object.entries(nw.misclass).sort((a,b) => b[1]-a[1]).slice(0, 10);

console.log('v0.3.5 (旧):');
for (const [k, v] of topMisOld) console.log(`  ${k}: ${v}`);
console.log('v0.3.7 (新):');
for (const [k, v] of topMisNew) console.log(`  ${k}: ${v}`);

// Type distribution comparison
console.log('\n=== 类型分布对比 ===');
const allTypes = ['INFP','INTP','INFJ','INTJ','ENFP','ENTP','ENFJ','ENTJ','ISFP','ISTP','ISFJ','ISTJ','ESFP','ESTP','ESFJ','ESTJ'];
console.log('类型'.padEnd(8) + '| v0.3.5 | v0.3.7 | 自报 | 变化');
console.log('-'.repeat(55));
for (const t of allTypes) {
  const o = old.typeCounts[t] || 0;
  const n = nw.typeCounts[t] || 0;
  const s = allRecords.filter(r => r.self_mbti === t).length;
  const diff = n - o;
  console.log(`${t.padEnd(8)}| ${(o + '').padStart(4)} (${(o/old.n*100).toFixed(1)}%) | ${(n + '').padStart(4)} (${(n/nw.n*100).toFixed(1)}%) | ${(s + '').padStart(4)} (${(s/allRecords.length*100).toFixed(1)}%) | ${diff >= 0 ? '+' : ''}${diff}`);
}
