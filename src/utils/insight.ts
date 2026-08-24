// AI 结果解读的请求封装：只上传角色代码与四维倾向，不上传逐题答案

export interface InsightScores {
  ei: number
  sn: number
  tf: number
  jp: number
}

export interface InsightResponse {
  text: string | null
  cached?: boolean
  available: boolean
  reason?: string
}

// AI 解读接口可能长时间无响应，超时后按失败处理，避免结果页骨架屏无限显示
const INSIGHT_TIMEOUT_MS = 10_000

export async function fetchAiInsight(
  characterCode: string,
  scores: InsightScores,
  lang: string,
  fresh = false,
): Promise<InsightResponse | null> {
  // AbortController 控制超时：到时中断请求，异常统一走现有失败路径
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), INSIGHT_TIMEOUT_MS)

  try {
    const resp = await fetch('/api/insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterCode,
        dimensionScores: scores,
        lang,
        fresh,
      }),
      signal: controller.signal,
    })

    if (!resp.ok && resp.status !== 429) {
      return null
    }

    const data = (await resp.json()) as InsightResponse
    if (typeof data?.available !== 'boolean') {
      return null
    }
    return data
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
