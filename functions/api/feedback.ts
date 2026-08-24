// /api/feedback — 用户主动提交真实 MBTI 反馈
// 接入 Turnstile 服务端校验，note 限长且不公开
//
// 表结构由 migrations 0006/0008 保证，CI 有 fresh DB 迁移验证；
// 请求路径不做任何运行时 DDL / schema 自修复——那会掩盖部署错误

import {
  str,
  num,
  isValidCode,
  isValidMbti,
  isValidUuid,
  validateAnswers,
  checkRateLimit,
} from './_shared'

async function insertFeedbackWithAnswers(
  DB: D1Database,
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

export async function onRequestPost(context: any) {
  const { DB } = context.env as { DB: D1Database }

  // --- 限流 ---
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown'
  const allowed = await checkRateLimit(DB, 'feedback', ip, 5)
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
  // TODO: 前端恢复 turnstileToken 获取后才可重新启用服务端 verifyTurnstile 校验

  // 白名单提取字段
  const submissionId = str(raw.submissionId, 64)
  const selfMbti = str(raw.selfMbti, 4)
  const confidence = num(raw.confidence, 1, 5)
  const note = typeof raw.note === 'string' ? raw.note.slice(0, 200) : null
  const appVersion = str(raw.appVersion, 32)
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
  // 与 submit.ts 对齐：可选的 predictedMbti 一旦携带就必须是合法格式，
  // 防伪造 payload 写入非法 MBTI 污染校准数据
  if (predictedMbti && !isValidMbti(predictedMbti)) {
    return new Response('Invalid predictedMbti', { status: 400 })
  }
  // 与 submit.ts 对齐：可选的 code 字段一旦携带就必须是合法格式，防脏数据入库
  if (archetypeCode && !isValidCode(archetypeCode)) {
    return new Response('Invalid archetype code', { status: 400 })
  }
  if (characterCode && !isValidCode(characterCode)) {
    return new Response('Invalid character code', { status: 400 })
  }

  const feedbackId = crypto.randomUUID()

  try {
    const res = await insertFeedbackWithAnswers(DB, {
      feedbackId,
      submissionId: submissionId || null,
      now: new Date().toISOString(),
      appVersion,
      selfMbti: selfMbti.toUpperCase(),
      confidence,
      note,
      answersJson,
      answerCount,
      predictedMbti: predictedMbti || null,
      archetypeCode: archetypeCode || null,
      characterCode: characterCode || null,
    })

    console.log('✅ Feedback stored', { feedbackId, meta: res.meta })

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // 迁移未执行等部署错误直接暴露为 500，不做运行时自修复掩盖问题
    console.error('❌ Feedback error:', err)

    // 对外只返回通用错误码，SQL 细节留在服务端日志
    return new Response(JSON.stringify({ ok: false, error: 'internal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
