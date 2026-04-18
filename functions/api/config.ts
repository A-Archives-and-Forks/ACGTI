// /api/config — 公开前端运行时配置（不包含敏感信息）

const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'

function isLocalTurnstileHost(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '0.0.0.0'
      || hostname === '::1'
      || hostname.endsWith('.localhost')
  } catch {
    return false
  }
}

export async function onRequestGet(context: any) {
  const viteSiteKey = String(context.env.VITE_TURNSTILE_SITE_KEY ?? '').trim()
  const legacySiteKey = String(context.env.TURNSTILE_SITE_KEY ?? '').trim()
  const isLocalRequest = isLocalTurnstileHost(context.request.url)
  const siteKey = viteSiteKey || legacySiteKey || (isLocalRequest ? TURNSTILE_TEST_SITE_KEY : '')

  console.log('[api/config] Turnstile key diagnostics', {
    source: viteSiteKey
      ? 'VITE_TURNSTILE_SITE_KEY'
      : legacySiteKey
        ? 'TURNSTILE_SITE_KEY'
        : isLocalRequest
          ? 'TURNSTILE_TEST_SITE_KEY(local-fallback)'
          : 'none',
    viteKeyLength: viteSiteKey.length,
    legacyKeyLength: legacySiteKey.length,
    isLocalRequest,
    hasSiteKey: siteKey.length > 0,
  })

  return new Response(
    JSON.stringify({
      turnstileSiteKey: siteKey || undefined,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  )
}
