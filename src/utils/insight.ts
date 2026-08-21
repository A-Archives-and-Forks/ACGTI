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

export async function fetchAiInsight(
  characterCode: string,
  scores: InsightScores,
  lang: string,
  fresh = false,
): Promise<InsightResponse | null> {
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
  }
}
