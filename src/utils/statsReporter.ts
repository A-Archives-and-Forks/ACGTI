// 统计上报工具 — fire-and-forget，绝不阻碍页面加载
// 使用 sendBeacon 优先，fallback 到 fetch keepalive

const APP_VERSION = '0.3.0'

export interface SubmitPayload {
  submissionId: string
  appVersion: string
  archetypeCode: string
  characterCode: string
  dimensionScores: {
    ei?: number
    sn?: number
    tf?: number
    jp?: number
  }
  answers: Array<{ questionId: string; answerValue: number }>
  durationMs?: number
}

export interface FeedbackPayload {
  submissionId: string
  selfMbti: string
  confidence: number
  note?: string
  appVersion: string
}

/**
 * 后台静默上报问卷结果
 * 使用 sendBeacon 或 fetch keepalive，失败完全吞掉
 */
export function reportResultInBackground(payload: Omit<SubmitPayload, 'appVersion'>) {
  const body = JSON.stringify({ ...payload, appVersion: APP_VERSION })

  setTimeout(() => {
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' })
        const queued = navigator.sendBeacon('/api/submit', blob)
        if (queued) return
      }

      // fallback
      fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        // 静默失败
      })
    } catch {
      // 静默失败
    }
  }, 0)
}

/**
 * 用户主动提交 MBTI 反馈
 * 返回 true/false 表示成功/失败，用于 UI 提示
 */
export async function submitFeedback(payload: Omit<FeedbackPayload, 'appVersion'>): Promise<boolean> {
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, appVersion: APP_VERSION }),
    })
    const data = await res.json()
    return data.ok === true
  } catch {
    return false
  }
}
