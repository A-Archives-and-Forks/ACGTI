/**
 * Targeted combination tests for TF balancing
 */
import { readFileSync } from 'fs';

const recordsPath = process.argv[2] ?? process.env.TF_RECORDS_PATH ?? 'C:/Users/TX/tf_records.json';
const records = JSON.parse(readFileSync(recordsPath, 'utf8'));

const TF_SIGNS = { q1: -1, q7: 1, q9: -1, q13: -1, q17: -1, q18: -1, q19: -1, q20: -1, q22: -1, q27: -1, q29: 1 };
const TF_WEIGHTS = { q1: -1, q7: 1, q9: -1, q13: -1, q17: -1, q18: -1, q19: -1, q20: -0.5, q22: -1, q27: -1, q29: 1.5 };

const allRecords = records.filter(r => r.answers_json && r.self_mbti && r.predicted_mbti);
const T_records = allRecords.filter(r => r.self_mbti[2] === 'T');
const F_records = allRecords.filter(r => r.self_mbti[2] === 'F');

function simulateTFMatch(records, weightOverrides) {
  let correct = 0;
  for (const r of records) {
    try {
      const answers = JSON.parse(r.answers_json);
      let rawScore = 0, posMax = 0, negMax = 0;
      for (const a of answers) {
        if (!TF_SIGNS.hasOwnProperty(a.questionId)) continue;
        const weight = weightOverrides[a.questionId] ?? TF_WEIGHTS[a.questionId];
        if (weight === 0) continue;
        rawScore += a.answerValue * weight;
        if (weight > 0) posMax += 3 * weight;
        else negMax += 3 * Math.abs(weight);
      }
      const normalized = rawScore >= 0 ? rawScore / Math.max(1, posMax) : rawScore / Math.max(1, negMax);
      const predicted = normalized >= 0 ? 'T' : 'F';
      if ((r.self_mbti[2] === 'T' && predicted === 'T') || (r.self_mbti[2] === 'F' && predicted === 'F')) correct++;
    } catch (e) {}
  }
  return correct;
}

// Simulate full MBTI prediction with updated TF weights
function simulateFullMBTI(records, tfOverrides) {
  // All dimension weights (non-TF from current config)
  const DIM_WEIGHTS = {
    // E_I weights
    q11: { 'E_I': -1 }, q12: { 'E_I': 1 }, q23: { 'E_I': -1, 'S_N': -0.7 },
    q25: { 'E_I': 0 }, q26: { 'E_I': 0 }, q28: { 'E_I': -2 },
    q32: { 'E_I': -1 }, q36: { 'E_I': 1 }, q39: { 'E_I': 1 },
    // S_N weights
    q3: { 'S_N': 1 }, q6: { 'S_N': -1 }, q10: { 'S_N': -1 },
    q14: { 'S_N': 1 }, q15: { 'S_N': -1 }, q16: { 'S_N': 1 },
    q24: { 'S_N': 1 }, q30: { 'S_N': -1 }, q35: { 'S_N': -0.65 },
    // J_P weights
    q2: { 'J_P': -1.15 }, q4: { 'J_P': -1 }, q5: { 'J_P': -0.4 },
    q8: { 'J_P': -1.2 }, q21: { 'J_P': -1 }, q31: { 'J_P': -0.65 },
    q33: { 'J_P': 0 }, q34: { 'J_P': 0 }, q37: { 'S_N': -0.8, 'J_P': 0.25 },
    q38: { 'J_P': 0 },
  };

  let exactMatch = 0;
  let eiCorrect = 0, snCorrect = 0, tfCorrect = 0, jpCorrect = 0;
  let infpPredicted = 0;

  for (const r of records) {
    try {
      const answers = JSON.parse(r.answers_json);
      const dims = { 'E_I': 0, 'S_N': 0, 'T_F': 0, 'J_P': 0 };
      const maxScores = {
        'E_I': { pos: 0, neg: 0 },
        'S_N': { pos: 0, neg: 0 },
        'T_F': { pos: 0, neg: 0 },
        'J_P': { pos: 0, neg: 0 }
      };

      for (const a of answers) {
        const qid = a.questionId;
        let dimWeights;

        if (TF_SIGNS.hasOwnProperty(qid)) {
          const w = tfOverrides[qid] ?? TF_WEIGHTS[qid];
          dimWeights = { 'T_F': w };
        } else if (DIM_WEIGHTS[qid]) {
          dimWeights = DIM_WEIGHTS[qid];
        } else {
          // Default from questions.json sign
          const q = { q3: ['S_N',1], q6: ['S_N',-1], q10: ['S_N',-1], q11: ['E_I',-1], q12: ['E_I',1], q14: ['S_N',1], q15: ['S_N',-1], q16: ['S_N',1], q21: ['J_P',-1], q24: ['S_N',1], q25: ['E_I',1], q26: ['E_I',1], q30: ['S_N',-1], q32: ['E_I',-1], q36: ['E_I',1], q39: ['E_I',1] }[qid];
          if (q) dimWeights = { [q[0]]: q[1] };
          else continue;
        }

        for (const [dim, weight] of Object.entries(dimWeights)) {
          if (weight === 0) continue;
          dims[dim] += a.answerValue * weight;
          if (weight > 0) maxScores[dim].pos += 3 * weight;
          else maxScores[dim].neg += 3 * Math.abs(weight);
        }
      }

      const letters = [];
      const dimPairs = ['E_I', 'S_N', 'T_F', 'J_P'];
      const posLetters = { 'E_I': 'E', 'S_N': 'S', 'T_F': 'T', 'J_P': 'J' };

      for (const dim of dimPairs) {
        const raw = dims[dim];
        const norm = raw >= 0 ? raw / Math.max(1, maxScores[dim].pos) : raw / Math.max(1, maxScores[dim].neg);
        letters.push(norm >= 0 ? posLetters[dim] : dim.split('_')[1]);
      }

      const predicted = letters.join('');
      const self = r.self_mbti;

      if (predicted === self) exactMatch++;
      if (predicted[0] === self[0]) eiCorrect++;
      if (predicted[1] === self[1]) snCorrect++;
      if (predicted[2] === self[2]) tfCorrect++;
      if (predicted[3] === self[3]) jpCorrect++;
      if (predicted === 'INFP') infpPredicted++;

    } catch (e) {}
  }

  const n = records.length;
  return {
    exactMatch: (exactMatch / n * 100).toFixed(1),
    ei: (eiCorrect / n * 100).toFixed(1),
    sn: (snCorrect / n * 100).toFixed(1),
    tf: (tfCorrect / n * 100).toFixed(1),
    jp: (jpCorrect / n * 100).toFixed(1),
    infpPct: (infpPredicted / n * 100).toFixed(1),
    infpCount: infpPredicted,
    n
  };
}

console.log('=== 精准组合测试 ===\n');
console.log('配置'.padEnd(65) + '| 总TF | T正确 | F正确');
console.log('-'.repeat(100));

const combos = [
  // 基准
  { label: 'BASELINE v0.3.5', w: {} },
  // q20 保留去噪，q19/q27 做 -0.75 回拉扫描
  { label: 'A: q20→0, q19→-0.75, q27→-1', w: { q20: 0, q19: -0.75, q27: -1 } },
  { label: 'B: q20→0, q19→-1, q27→-0.75', w: { q20: 0, q19: -1, q27: -0.75 } },
  { label: 'C: q20→0, q19→-0.75, q27→-0.75', w: { q20: 0, q19: -0.75, q27: -0.75 } },
  { label: 'D: q20→0, q19→-0.5, q27→-0.5', w: { q20: 0, q19: -0.5, q27: -0.5 } },
  // 最小改动：只动 q19 和 q27
  { label: 'q19→-0.5, q27→-0.5', w: { q19: -0.5, q27: -0.5 } },
  { label: 'q19→-0.5, q27→-0.5, q20→0', w: { q19: -0.5, q27: -0.5, q20: 0 } },
  { label: 'q19→-0.5, q27→-0.5, q29→2', w: { q19: -0.5, q27: -0.5, q29: 2 } },
  { label: 'q19→-0.5, q27→-0.5, q20→0, q29→2', w: { q19: -0.5, q27: -0.5, q20: 0, q29: 2 } },
  // 更激进
  { label: 'q19→0, q27→-0.5, q20→0', w: { q19: 0, q27: -0.5, q20: 0 } },
  { label: 'q19→0, q27→-0.5, q20→0, q29→2', w: { q19: 0, q27: -0.5, q20: 0, q29: 2 } },
  { label: 'q19→0, q27→0, q20→0', w: { q19: 0, q27: 0, q20: 0 } },
  { label: 'q19→0, q27→0, q20→0, q29→2', w: { q19: 0, q27: 0, q20: 0, q29: 2 } },
  // 温和组合
  { label: 'q19→-0.5, q27→-0.5, q17→-0.5, q9→-0.5', w: { q19: -0.5, q27: -0.5, q17: -0.5, q9: -0.5 } },
  { label: 'q19→-0.5, q27→-0.5, q20→-0.25, q29→1.75', w: { q19: -0.5, q27: -0.5, q20: -0.25, q29: 1.75 } },
  // 最优平衡搜索
  { label: 'q19→0, q27→-0.5, q29→1.75', w: { q19: 0, q27: -0.5, q29: 1.75 } },
  { label: 'q19→0, q27→-0.5, q29→1.75, q7→1.25', w: { q19: 0, q27: -0.5, q29: 1.75, q7: 1.25 } },
];

for (const c of combos) {
  const overrides = { ...TF_WEIGHTS, ...c.w };
  const tc = simulateTFMatch(T_records, overrides);
  const fc = simulateTFMatch(F_records, overrides);
  const total = T_records.length + F_records.length;
  const totalRate = ((tc + fc) / total * 100).toFixed(1);
  const tRate = (tc / T_records.length * 100).toFixed(1);
  const fRate = (fc / F_records.length * 100).toFixed(1);
  console.log(`${c.label.padEnd(65)} | ${totalRate}% | ${tRate}% (${tc}/${T_records.length}) | ${fRate}% (${fc}/${F_records.length})`);
}

// Now test top candidates with full MBTI simulation
console.log('\n\n=== 全维度回测 (含 MBTI 匹配率) ===\n');
console.log('配置'.padEnd(55) + '| 精确 | EI  | SN  | TF  | JP  | INFP%');
console.log('-'.repeat(100));

const fullCombos = [
  { label: 'BASELINE', w: {} },
  { label: 'A: q20→0, q19→-0.75, q27→-1', w: { q20: 0, q19: -0.75, q27: -1 } },
  { label: 'B: q20→0, q19→-1, q27→-0.75', w: { q20: 0, q19: -1, q27: -0.75 } },
  { label: 'C: q20→0, q19→-0.75, q27→-0.75', w: { q20: 0, q19: -0.75, q27: -0.75 } },
  { label: 'D: q20→0, q19→-0.5, q27→-0.5', w: { q20: 0, q19: -0.5, q27: -0.5 } },
  { label: 'q19→-0.5, q27→-0.5', w: { q19: -0.5, q27: -0.5 } },
  { label: 'q19→-0.5, q27→-0.5, q20→0, q29→2', w: { q19: -0.5, q27: -0.5, q20: 0, q29: 2 } },
  { label: 'q19→0, q27→-0.5, q29→1.75', w: { q19: 0, q27: -0.5, q29: 1.75 } },
  { label: 'q19→0, q27→-0.5, q20→0, q29→2', w: { q19: 0, q27: -0.5, q20: 0, q29: 2 } },
  { label: 'q19→0, q27→0, q20→0, q29→2', w: { q19: 0, q27: 0, q20: 0, q29: 2 } },
  { label: 'q19→-0.5, q27→-0.5, q20→-0.25, q29→1.75', w: { q19: -0.5, q27: -0.5, q20: -0.25, q29: 1.75 } },
];

for (const c of fullCombos) {
  const r = simulateFullMBTI(allRecords, c.w);
  console.log(`${c.label.padEnd(55)} | ${r.exactMatch}% | ${r.ei}% | ${r.sn}% | ${r.tf}% | ${r.jp}% | ${r.infpPct}% (${r.infpCount})`);
}
