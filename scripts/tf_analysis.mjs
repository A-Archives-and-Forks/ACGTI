/**
 * TF 维度差异分析脚本
 * 对比 T 型误判组和 T 型正确组在每道 TF 题上的答题分布
 */

// 从 stdin 读取 JSON 数据
let inputData = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { inputData += chunk; });
process.stdin.on('end', () => {
  const records = JSON.parse(inputData);

  // TF 相关题目
  const TF_QUESTIONS = ['q1', 'q7', 'q9', 'q13', 'q17', 'q18', 'q19', 'q20', 'q22', 'q27', 'q29'];

  const TF_QUESTION_TEXTS = {
    q1: '看到针对小圈子引战→情绪波动和愤怒',
    q7: '"战力厨"吵300楼是行为艺术',
    q9: '经常深夜emo',
    q13: '"党争"是ACG最伟大的发明',
    q17: '看完致郁作品→看点轻松的缓解',
    q18: '抽卡相信玄学而不是计算保底',
    q19: '番剧完结→强烈失落和空虚感',
    q20: '反感"饭圈化"行为',
    q22: '对Vtuber/角色投入很深感情',
    q27: '烂尾作品→作者应磕头谢罪',
    q29: '喜欢地狱笑话/毫无心理负担',
  };

  const TF_SIGNS = {
    q1: -1, q7: 1, q9: -1, q13: -1, q17: -1,
    q18: -1, q19: -1, q20: -1, q22: -1, q27: -1, q29: 1
  };

  const TF_WEIGHTS = {
    q1: -1, q7: 1, q9: -1, q13: -1, q17: -1,
    q18: -1, q19: -1, q20: -0.5, q22: -1, q27: -1, q29: 1.5
  };

  // 分组
  const selfT_misF = []; // T→F 误判组 (self=T, predicted=F)
  const selfT_correctT = []; // T→T 正确组
  const selfF_correctF = []; // F→F 正确组 (对照组)
  const selfF_misT = []; // F→T 误判组

  for (const r of records) {
    if (!r.answers_json || !r.self_mbti || !r.predicted_mbti) continue;
    const selfT = 'TF'.includes(r.self_mbti[2]) ? (r.self_mbti[2] === 'T') : null;
    const predT = r.predicted_mbti[2] === 'T';
    if (selfT === null) continue;

    try {
      const answers = JSON.parse(r.answers_json);
      const answerMap = {};
      for (const a of answers) {
        answerMap[a.questionId] = a.answerValue;
      }

      const entry = { ...r, answerMap };

      if (selfT && !predT) selfT_misF.push(entry);
      else if (selfT && predT) selfT_correctT.push(entry);
      else if (!selfT && !predT) selfF_correctF.push(entry);
      else if (!selfT && predT) selfF_misT.push(entry);
    } catch (e) { /* skip */ }
  }

  console.log('=== TF 维度差异分析 ===\n');
  console.log(`T→F 误判组: ${selfT_misF.length} 人`);
  console.log(`T→T 正确组: ${selfT_correctT.length} 人`);
  console.log(`F→F 正确组: ${selfF_correctF.length} 人`);
  console.log(`F→T 误判组: ${selfF_misT.length} 人`);

  // 每题统计
  function avgAnswer(group, qid) {
    const vals = group.map(r => r.answerMap[qid]).filter(v => v !== undefined);
    if (!vals.length) return { avg: 0, n: 0, posRate: 0, negRate: 0 };
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const posRate = vals.filter(v => v > 0).length / vals.length;
    const negRate = vals.filter(v => v < 0).length / vals.length;
    return { avg: avg.toFixed(3), n: vals.length, posRate: (posRate * 100).toFixed(1), negRate: (negRate * 100).toFixed(1) };
  }

  // 计算每题对 TF rawScore 的贡献
  function avgContribution(group, qid) {
    const weight = TF_WEIGHTS[qid];
    const vals = group.map(r => r.answerMap[qid]).filter(v => v !== undefined);
    if (!vals.length) return 0;
    return vals.reduce((s, v) => s + (v * weight), 0) / vals.length;
  }

  console.log('\n=== 每题平均答题值 ===');
  console.log('题号 | T→F误判 | T→T正确 | F→F正确 | F→T误判 | 差异(T→F vs T→T) | 伪F嫌疑');
  console.log('-'.repeat(110));

  const suspiciousQuestions = [];

  for (const qid of TF_QUESTIONS) {
    const mF = avgAnswer(selfT_misF, qid);
    const cT = avgAnswer(selfT_correctT, qid);
    const cF = avgAnswer(selfF_correctF, qid);
    const mT = avgAnswer(selfF_misT, qid);

    const diff = parseFloat(mF.avg) - parseFloat(cT.avg);
    // "伪F嫌疑": T→F误判组和T→T正确组的差异小 (说明这题无法区分T型内部的T/F倾向)
    // 同时T→F误判组的平均答题值偏向agree (说明他们确实在这题上同意了)
    const sign = TF_SIGNS[qid];
    const isFPush = sign === -1; // agree pushes F
    const misFAvg = parseFloat(mF.avg);
    const isAgreeing = misFAvg > 0;

    let suspicion = '';
    if (isFPush && isAgreeing && Math.abs(diff) < 0.5) {
      suspicion = '*** HIGH: T误判F也同意 + 区分度低';
      suspiciousQuestions.push({ qid, reason: 'T→F误判组也同意,与T正确组差异小', diff, avg: misFAvg });
    } else if (isFPush && isAgreeing && Math.abs(diff) < 1.0) {
      suspicion = '** MEDIUM: T误判F同意 + 区分度中低';
      suspiciousQuestions.push({ qid, reason: 'T→F误判组同意,区分度中低', diff, avg: misFAvg });
    } else if (!isFPush && !isAgreeing) {
      suspicion = '? T锚点题但T误判组不同意';
    }

    console.log(`${qid} | ${mF.avg.padStart(7)} (${mF.posRate}%) | ${cT.avg.padStart(7)} (${cT.posRate}%) | ${cF.avg.padStart(7)} (${cF.posRate}%) | ${mT.avg.padStart(7)} (${mT.posRate}%) | ${diff.toFixed(3).padStart(6)} | ${suspicion}`);
  }

  console.log('\n=== 每题对 TF rawScore 的平均贡献 (answer × weight) ===');
  console.log('题号 | 权重 | T→F误判 | T→T正确 | F→F正确 | 差异');
  console.log('-'.repeat(80));

  let totalContribution_mF = 0;
  let totalContribution_cT = 0;

  for (const qid of TF_QUESTIONS) {
    const weight = TF_WEIGHTS[qid];
    const c_mF = avgContribution(selfT_misF, qid);
    const c_cT = avgContribution(selfT_correctT, qid);
    const c_cF = avgContribution(selfF_correctF, qid);
    totalContribution_mF += c_mF;
    totalContribution_cT += c_cT;

    const diff = c_mF - c_cT;
    console.log(`${qid} | ${weight.toString().padStart(4)} | ${c_mF.toFixed(3).padStart(7)} | ${c_cT.toFixed(3).padStart(7)} | ${c_cF.toFixed(3).padStart(7)} | ${diff.toFixed(3)}`);
  }

  console.log(`\n总计 rawScore 贡献: T→F误判=${totalContribution_mF.toFixed(2)}, T→T正确=${totalContribution_cT.toFixed(2)}`);
  console.log(`差异: ${(totalContribution_mF - totalContribution_cT).toFixed(2)}`);

  // 诊断：哪些题目贡献了最大的差异
  console.log('\n=== 差异贡献排名（T→F误判 vs T→T正确，按 rawScore 差异排序）===');
  const contributions = [];
  for (const qid of TF_QUESTIONS) {
    const c_mF = avgContribution(selfT_misF, qid);
    const c_cT = avgContribution(selfT_correctT, qid);
    const diff = c_mF - c_cT;
    contributions.push({ qid, diff, c_mF, c_cT });
  }
  contributions.sort((a, b) => a.diff - b.diff); // most negative diff = biggest discriminator

  console.log('题号 | 差异 | T→F贡献 | T→T贡献 | 含义');
  for (const c of contributions) {
    let meaning = '';
    if (c.diff < -0.3) meaning = '*** 强区分题';
    else if (c.diff < -0.1) meaning = '** 中等区分';
    else if (Math.abs(c.diff) <= 0.1) meaning = '几乎无区分力';
    else meaning = '反向 (T→T组反而更F)';
    console.log(`${c.qid} | ${c.diff.toFixed(3).padStart(6)} | ${c.c_mF.toFixed(3).padStart(7)} | ${c.c_cT.toFixed(3).padStart(7)} | ${meaning}`);
  }

  // 现在做消融分析：如果调整权重，对整体 TF 匹配率的影响
  console.log('\n=== 消融分析：调整权重对 TF 匹配率的影响 ===\n');

  // 用所有数据回测
  const allRecords = records.filter(r => r.answers_json && r.self_mbti && r.predicted_mbti);
  const T_records = allRecords.filter(r => r.self_mbti[2] === 'T');
  const F_records = allRecords.filter(r => r.self_mbti[2] === 'F');

  function simulateTFMatch(records, weightOverrides) {
    let correct = 0;
    for (const r of records) {
      try {
        const answers = JSON.parse(r.answers_json);
        let rawScore = 0;
        let posMax = 0;
        let negMax = 0;

        for (const a of answers) {
          const qid = a.questionId;
          if (!TF_SIGNS.hasOwnProperty(qid)) continue;
          const weight = weightOverrides[qid] ?? TF_WEIGHTS[qid];
          if (weight === 0) continue;
          rawScore += a.answerValue * weight;
          if (weight > 0) posMax += 3 * weight;
          else negMax += 3 * Math.abs(weight);
        }

        const normalized = rawScore >= 0 ? rawScore / Math.max(1, posMax) : rawScore / Math.max(1, negMax);
        const predicted = normalized >= 0 ? 'T' : 'F';

        if ((r.self_mbti[2] === 'T' && predicted === 'T') ||
            (r.self_mbti[2] === 'F' && predicted === 'F')) {
          correct++;
        }
      } catch (e) { /* skip */ }
    }
    return correct;
  }

  // Baseline
  const totalTF = T_records.length + F_records.length;
  const baseCorrect = simulateTFMatch([...T_records, ...F_records], {});
  const baseT_correct = simulateTFMatch(T_records, {});
  const baseF_correct = simulateTFMatch(F_records, {});
  console.log(`基准 (当前权重): 总TF=${((baseCorrect/totalTF)*100).toFixed(1)}% | T正确=${((baseT_correct/T_records.length)*100).toFixed(1)}% (${baseT_correct}/${T_records.length}) | F正确=${((baseF_correct/F_records.length)*100).toFixed(1)}% (${baseF_correct}/${F_records.length})`);

  // 单题消融
  console.log('\n--- 单题调整测试 ---');
  const testWeights = [
    // 降低 F 推送题的权重
    { q1: 0 }, { q1: -0.5 },
    { q9: 0 }, { q9: -0.5 },
    { q17: 0 }, { q17: -0.5 },
    { q18: 0 }, { q18: -0.5 },
    { q19: 0 }, { q19: -0.5 },
    { q20: 0 }, { q20: -0.25 },
    { q22: 0 }, { q22: -0.5 },
    { q27: 0 }, { q27: -0.5 },
    { q13: 0 }, { q13: -0.5 },
    // 提升 T 推送题的权重
    { q7: 1.5 }, { q7: 2 },
    { q29: 2 }, { q29: 2.5 },
  ];

  for (const tw of testWeights) {
    const overrides = { ...TF_WEIGHTS, ...tw };
    const c = simulateTFMatch([...T_records, ...F_records], overrides);
    const tc = simulateTFMatch(T_records, overrides);
    const fc = simulateTFMatch(F_records, overrides);
    const totalRate = ((c/totalTF)*100).toFixed(1);
    const tRate = ((tc/T_records.length)*100).toFixed(1);
    const fRate = ((fc/F_records.length)*100).toFixed(1);
    const [q, w] = Object.entries(tw)[0];
    const oldW = TF_WEIGHTS[q];
    console.log(`${q}: ${oldW} → ${w} | 总TF=${totalRate}% | T正确=${tRate}% (${tc}/${T_records.length}) | F正确=${fRate}% (${fc}/${F_records.length})`);
  }

  // 最佳组合测试
  console.log('\n--- 组合测试 ---');
  const combos = [
    { label: 'q19→0 + q17→0', overrides: { q19: 0, q17: 0 } },
    { label: 'q19→0 + q17→0 + q1→0', overrides: { q19: 0, q17: 0, q1: 0 } },
    { label: 'q19→0 + q17→0 + q9→0', overrides: { q19: 0, q17: 0, q9: 0 } },
    { label: 'q19→-0.5 + q17→-0.5 + q9→-0.5', overrides: { q19: -0.5, q17: -0.5, q9: -0.5 } },
    { label: 'q19→0 + q17→0 + q29→2', overrides: { q19: 0, q17: 0, q29: 2 } },
    { label: 'q19→0 + q17→0 + q7→1.5', overrides: { q19: 0, q17: 0, q7: 1.5 } },
    { label: 'q19→0 + q17→-0.5 + q29→2', overrides: { q19: 0, q17: -0.5, q29: 2 } },
    { label: 'q19→0 + q1→0 + q17→0', overrides: { q19: 0, q1: 0, q17: 0 } },
    { label: 'q19→0 + q1→0 + q17→0 + q9→0', overrides: { q19: 0, q1: 0, q17: 0, q9: 0 } },
    { label: 'q19→0 + q1→0 + q17→0 + q22→0', overrides: { q19: 0, q1: 0, q17: 0, q22: 0 } },
    { label: 'q19→-0.5 + q1→-0.5 + q17→-0.5 + q9→-0.5', overrides: { q19: -0.5, q1: -0.5, q17: -0.5, q9: -0.5 } },
    { label: 'q19→0 + q1→0 + q17→0 + q7→1.5 + q29→2', overrides: { q19: 0, q1: 0, q17: 0, q7: 1.5, q29: 2 } },
    { label: 'q19→-0.5 + q17→-0.5 + q9→-0.5 + q7→1.5 + q29→2', overrides: { q19: -0.5, q17: -0.5, q9: -0.5, q7: 1.5, q29: 2 } },
    { label: 'q19→0 + q17→0 + q1→-0.5 + q9→-0.5', overrides: { q19: 0, q17: 0, q1: -0.5, q9: -0.5 } },
    { label: 'q19→-0.5 + q17→-0.5 + q1→-0.5 + q7→1.5', overrides: { q19: -0.5, q17: -0.5, q1: -0.5, q7: 1.5 } },
  ];

  for (const combo of combos) {
    const overrides = { ...TF_WEIGHTS, ...combo.overrides };
    const c = simulateTFMatch([...T_records, ...F_records], overrides);
    const tc = simulateTFMatch(T_records, overrides);
    const fc = simulateTFMatch(F_records, overrides);
    const totalRate = ((c/totalTF)*100).toFixed(1);
    const tRate = ((tc/T_records.length)*100).toFixed(1);
    const fRate = ((fc/F_records.length)*100).toFixed(1);
    console.log(`${combo.label.padEnd(55)} | 总TF=${totalRate}% | T=${tRate}% (${tc}/${T_records.length}) | F=${fRate}% (${fc}/${F_records.length})`);
  }
});
