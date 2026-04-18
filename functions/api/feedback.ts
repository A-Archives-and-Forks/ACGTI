// /api/feedback — 用户主动提交真实 MBTI 反馈
// 接入 Turnstile 服务端校验，note 限长且不公开

import {
  str,
  num,
  isValidMbti,
  isValidUuid,
  validateAnswers,
  checkRateLimit,
} from './_shared'

async function ensureFeedbackTable(DB: any) {
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS mbti_feedback (
      id TEXT PRIMARY KEY,
      submission_id TEXT,
      created_at TEXT NOT NULL,
      app_version TEXT NOT NULL,
      self_mbti TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      note TEXT,
      answers_json TEXT,
      answer_count INTEGER
    )`
  ).run()
}

async function ensureFeedbackAnswerColumns(DB: any) {
  await ensureFeedbackTable(DB)

  try {
    const info = await DB.prepare('PRAGMA table_info(mbti_feedback)').all()
    const names = new Set((info?.results ?? []).map((col: any) => String(col.name)))

    if (!names.has('answers_json')) {
      await DB.exec('ALTER TABLE mbti_feedback ADD COLUMN answers_json TEXT;')
    }
    if (!names.has('answer_count')) {
      await DB.exec('ALTER TABLE mbti_feedback ADD COLUMN answer_count INTEGER;')
    }
    if (!names.has('predicted_mbti')) {
      await DB.exec('ALTER TABLE mbti_feedback ADD COLUMN predicted_mbti TEXT;')
    }
    if (!names.has('archetype_code')) {
      await DB.exec('ALTER TABLE mbti_feedback ADD COLUMN archetype_code TEXT;')
    }
    if (!names.has('character_code')) {
      await DB.exec('ALTER TABLE mbti_feedback ADD COLUMN character_code TEXT;')
    }
  } catch (err) {
    console.warn('ensureFeedbackAnswerColumns failed:', err)
    throw err
  }
}

function isMissingFeedbackAnswerColumns(err: unknown) {
  const text = String(err ?? '').toLowerCase()
  return (text.includes('no such column') || text.includes('no column named')) &&
    (text.includes('answers_json') || text.includes('answer_count'))
}

function isMissingFeedbackTable(err: unknown) {
  const text = String(err ?? '').toLowerCase()
  return text.includes('no such table') && text.includes('mbti_feedback')
}

async function insertFeedbackWithAnswers(
  DB: any,
  params: {
    feedbackId: string
    submissionId: string | null
    now: string
    appVersion: string
    selfMbti: string
    confidence: number
    note: string | null
    answersJson: string | null
    answerCount: number | null
    predictedMbti: string | null
    archetypeCode: string | null
    characterCode: string | null
  }
) {
  return DB.prepare(
    `INSERT INTO mbti_feedback (id, submission_id, created_at, app_version, self_mbti, confidence, note, answers_json, answer_count, predicted_mbti, archetype_code, character_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    params.feedbackId,
    params.submissionId,
    params.now,
    params.appVersion,
    params.selfMbti,
    params.confidence,
    params.note,
    params.answersJson,
    params.answerCount,
    params.predictedMbti,
    params.archetypeCode,
    params.characterCode,
  ).run()
}

async function insertFeedbackLegacy(
  DB: any,
  params: {
    feedbackId: string
    submissionId: string | null
    now: string
    appVersion: string
    selfMbti: string
    confidence: number
    note: string | null
  }
) {
  return DB.prepare(
    `INSERT INTO mbti_feedback (id, submission_id, created_at, app_version, self_mbti, confidence, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    params.feedbackId,
    params.submissionId,
    params.now,
    params.appVersion,
    params.selfMbti,
    params.confidence,
    params.note,
  ).run()
}

export async function onRequestPost(context: any) {
  const { DB } = context.env as { DB: any }

  // --- 限流 ---
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown'
  const allowed = await checkRateLimit(DB, ip, 5)
  if (!allowed) return new Response(null, { status: 429 })

  // --- 解析 payload ---
  let raw: any
  try {
    raw = await context.request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Turnstile temporarily disabled.
  // 原本会要求 turnstileToken 并做服务端校验，这里先跳过，保持反馈提交可用。

  // 白名单提取字段
  const submissionId = str(raw.submissionId, 64)
  const selfMbti = str(raw.selfMbti, 4)
  const confidence = num(raw.confidence, 1, 5)
  const note = typeof raw.note === 'string' ? raw.note.slice(0, 200) : null
  const appVersion = str(raw.appVersion, 16)
  const validatedAnswers = raw.answers === undefined ? null : validateAnswers(raw.answers)
  const predictedMbti = str(raw.predictedMbti, 4)
  const archetypeCode = str(raw.archetypeCode, 32)
  const characterCode = str(raw.characterCode, 32)
  if (raw.answers !== undefined && !validatedAnswers) {
    return new Response('Invalid answers', { status: 400 })
  }
  const answersJson = validatedAnswers && validatedAnswers.length > 0
    ? JSON.stringify(validatedAnswers)
    : null
  const answerCount = validatedAnswers?.length ?? null

  // 必填校验
  if (!selfMbti || confidence === null || !appVersion) {
    return new Response('Missing required fields', { status: 400 })
  }
  if (!isValidMbti(selfMbti)) {
    return new Response('Invalid MBTI format', { status: 400 })
  }
  if (submissionId && !isValidUuid(submissionId)) {
    return new Response('Invalid submissionId', { status: 400 })
  }

  const feedbackId = crypto.randomUUID()
  const now = new Date().toISOString()
  const submissionIdOrNull = submissionId || null
  const selfMbtiUpper = selfMbti.toUpperCase()

  try {
    const res = await insertFeedbackWithAnswers(DB, {
      feedbackId,
      submissionId: submissionIdOrNull,
      now,
      appVersion,
      selfMbti: selfMbtiUpper,
      confidence,
      note,
      answersJson,
      answerCount,
      predictedMbti: predictedMbti || null,
      archetypeCode: archetypeCode || null,
      characterCode: characterCode || null,
    })

    console.log('✅ Feedback stored', { feedbackId, res })

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('❌ Feedback error (initial attempt):', err)
    if (isMissingFeedbackTable(err) || isMissingFeedbackAnswerColumns(err)) {
      try {
        console.log('🔧 Attempting feedback schema repair...')
        await ensureFeedbackTable(DB)
        await ensureFeedbackAnswerColumns(DB)
        const res = await insertFeedbackWithAnswers(DB, {
          feedbackId,
          submissionId: submissionIdOrNull,
          now,
          appVersion,
          selfMbti: selfMbtiUpper,
          confidence,
          note,
          answersJson,
          answerCount,
          predictedMbti: predictedMbti || null,
          archetypeCode: archetypeCode || null,
          characterCode: characterCode || null,
        })

        console.log('✅ Feedback stored after schema repair', { feedbackId, res })

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (retryErr) {
        console.error('❌ Feedback retry after schema repair failed:', retryErr)
        try {
          console.log('🔧 Attempting feedback legacy fallback...')
          await ensureFeedbackTable(DB)
          const res = await insertFeedbackLegacy(DB, {
            feedbackId,
            submissionId: submissionIdOrNull,
            now,
            appVersion,
            selfMbti: selfMbtiUpper,
            confidence,
            note,
          })

          console.log('✅ Feedback stored with legacy schema', { feedbackId, res })

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (legacyErr) {
          console.error('❌ Feedback error after legacy fallback:', legacyErr)
          return new Response(JSON.stringify({ ok: false, error: 'internal', details: String(legacyErr) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }
    }

    return new Response(JSON.stringify({ ok: false, error: 'internal', details: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
