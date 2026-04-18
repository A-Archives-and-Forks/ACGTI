// /api/feedback — 用户主动提交真实 MBTI 反馈
// 接入 Turnstile 服务端校验，note 限长且不公开

import {
  str,
  num,
  isValidMbti,
  isValidUuid,
  validateAnswers,
  verifyTurnstile,
  checkRateLimit,
} from './_shared'

async function ensureFeedbackAnswerColumns(DB: any) {
  try {
    const info = await DB.prepare('PRAGMA table_info(mbti_feedback)').all()
    const names = new Set((info?.results ?? []).map((col: any) => String(col.name)))

    if (!names.has('answers_json')) {
      await DB.exec('ALTER TABLE mbti_feedback ADD COLUMN answers_json TEXT;')
    }
    if (!names.has('answer_count')) {
      await DB.exec('ALTER TABLE mbti_feedback ADD COLUMN answer_count INTEGER;')
    }
  } catch (err) {
    console.warn('ensureFeedbackAnswerColumns failed:', err)
  }
}

function isMissingFeedbackAnswerColumns(err: unknown) {
  const text = String(err ?? '').toLowerCase()
  return text.includes('no such column') &&
    (text.includes('answers_json') || text.includes('answer_count'))
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
  }
) {
  return DB.prepare(
    `INSERT INTO mbti_feedback (id, submission_id, created_at, app_version, self_mbti, confidence, note, answers_json, answer_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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

  // Turnstile 校验（前端需传 turnstileToken 字段）
  const turnstileToken = str(raw.turnstileToken, 2048)
  const turnstileSecret = String(context.env.TURNSTILE_SECRET ?? '').trim()
  if (turnstileSecret && !turnstileToken) {
    return new Response('Missing Turnstile token', { status: 400 })
  }
  if (turnstileToken) {
    const turnstileOk = await verifyTurnstile(turnstileToken, ip, context.env)
    if (!turnstileOk) {
      return new Response('Forbidden', { status: 403 })
    }
  }

  // 白名单提取字段
  const submissionId = str(raw.submissionId, 64)
  const selfMbti = str(raw.selfMbti, 4)
  const confidence = num(raw.confidence, 1, 5)
  const note = typeof raw.note === 'string' ? raw.note.slice(0, 200) : null
  const appVersion = str(raw.appVersion, 16)
  const validatedAnswers = raw.answers === undefined ? null : validateAnswers(raw.answers)
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
    await insertFeedbackWithAnswers(DB, {
      feedbackId,
      submissionId: submissionIdOrNull,
      now,
      appVersion,
      selfMbti: selfMbtiUpper,
      confidence,
      note,
      answersJson,
      answerCount,
    })

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (isMissingFeedbackAnswerColumns(err)) {
      try {
        await ensureFeedbackAnswerColumns(DB)
        await insertFeedbackWithAnswers(DB, {
          feedbackId,
          submissionId: submissionIdOrNull,
          now,
          appVersion,
          selfMbti: selfMbtiUpper,
          confidence,
          note,
          answersJson,
          answerCount,
        })

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (retryErr) {
        try {
          await insertFeedbackLegacy(DB, {
            feedbackId,
            submissionId: submissionIdOrNull,
            now,
            appVersion,
            selfMbti: selfMbtiUpper,
            confidence,
            note,
          })

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (legacyErr) {
          console.error('Feedback error after legacy fallback:', legacyErr)
          return new Response(JSON.stringify({ ok: false, error: 'internal' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }
    }

    console.error('Feedback error:', err)
    return new Response(JSON.stringify({ ok: false, error: 'internal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
