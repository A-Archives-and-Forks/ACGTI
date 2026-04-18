// /api/submit — 聚合计数 + 抽样明细
// 每次提交只做 UPSERT 自增聚合表，原始明细 2% 抽样
// 不再全量写 submissions，不写 _rate_limit

import {
  str,
  num,
  isValidCode,
  isValidUuid,
  isValidMbti,
} from './_shared'

// 抽样比例：2% 的提交保留完整明细
const SAMPLE_RATE = 0.02
// answers 最少条数，低于此值视为无效提交
const MIN_ANSWERS = 20

export async function onRequestPost(context: any) {
  const { DB } = context.env as { DB: any }

  // --- 解析 payload ---
  let raw: any
  try {
    raw = await context.request.json()
  } catch {
    return new Response(null, { status: 204 })
  }

  // 白名单提取字段
  const submissionId = str(raw.submissionId, 64)
  const appVersion = str(raw.appVersion, 16)
  const archetypeCode = str(raw.archetypeCode, 32)
  const characterCode = str(raw.characterCode, 32)
  const predictedMbti = str(raw.predictedMbti, 4)
  const durationMs = num(raw.durationMs, 1000, 3600000)

  // 必填校验
  if (!submissionId || !appVersion || !archetypeCode || !characterCode) {
    return new Response(null, { status: 204 })
  }
  if (!isValidUuid(submissionId)) {
    return new Response(null, { status: 204 })
  }
  if (!isValidCode(archetypeCode) || !isValidCode(characterCode)) {
    return new Response(null, { status: 204 })
  }
  if (predictedMbti && !isValidMbti(predictedMbti)) {
    return new Response(null, { status: 204 })
  }
  if (durationMs === null) {
    return new Response(null, { status: 204 })
  }

  // 四维分数校验（0~100 范围）
  const ds = raw.dimensionScores
  const ei = num(ds?.ei, 0, 100)
  const sn = num(ds?.sn, 0, 100)
  const tf = num(ds?.tf, 0, 100)
  const jp = num(ds?.jp, 0, 100)
  if (ei === null || sn === null || tf === null || jp === null) {
    return new Response(null, { status: 204 })
  }

  // answers 校验：没有完整答案的提交不写库
  if (!Array.isArray(raw.answers) || raw.answers.length < MIN_ANSWERS) {
    return new Response(null, { status: 204 })
  }

  const now = new Date().toISOString()
  const today = now.slice(0, 10)

  try {
    // ── 核心写入：聚合表 UPSERT 自增 ──
    await DB.batch([
      DB.prepare(
        `INSERT INTO archetype_counts (archetype_code, cnt, updated_at)
         VALUES (?, 1, ?)
         ON CONFLICT(archetype_code)
         DO UPDATE SET cnt = cnt + 1, updated_at = excluded.updated_at`
      ).bind(archetypeCode, now),

      DB.prepare(
        `INSERT INTO character_counts (character_code, cnt, updated_at)
         VALUES (?, 1, ?)
         ON CONFLICT(character_code)
         DO UPDATE SET cnt = cnt + 1, updated_at = excluded.updated_at`
      ).bind(characterCode, now),

      DB.prepare(
        `INSERT INTO pair_counts (archetype_code, character_code, cnt, updated_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(archetype_code, character_code)
         DO UPDATE SET cnt = cnt + 1, updated_at = excluded.updated_at`
      ).bind(archetypeCode, characterCode, now),

      DB.prepare(
        `INSERT INTO daily_counts (stat_date, total_cnt, updated_at)
         VALUES (?, 1, ?)
         ON CONFLICT(stat_date)
         DO UPDATE SET total_cnt = total_cnt + 1, updated_at = excluded.updated_at`
      ).bind(today, now),
    ])

    // ── 抽样：保留少量原始明细用于校准和排查 ──
    if (Math.random() < SAMPLE_RATE) {
      await DB.batch([
        DB.prepare(
          `INSERT OR IGNORE INTO submissions_sampled
           (id, created_at, app_version, archetype_code, character_code,
            ei_score, sn_score, tf_score, jp_score, duration_ms, predicted_mbti)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          submissionId,
          now,
          appVersion,
          archetypeCode,
          characterCode,
          ei,
          sn,
          tf,
          jp,
          durationMs,
          predictedMbti || null,
        ),

        DB.prepare(
          `INSERT OR IGNORE INTO submission_answers_blob
           (submission_id, answers_json)
           VALUES (?, ?)`
        ).bind(submissionId, JSON.stringify(raw.answers)),
      ])
    }

    return new Response(null, { status: 204 })
  } catch (err) {
    // 聚合表可能还不存在（migration 未执行），降级静默处理
    console.error('Submit aggregate error:', err instanceof Error ? err.message : err)
    return new Response(null, { status: 204 })
  }
}
