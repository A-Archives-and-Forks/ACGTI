// /api/config — 公开前端运行时配置（不包含敏感信息）

export async function onRequestGet(context: any) {
  const viteSiteKey = String(context.env.VITE_TURNSTILE_SITE_KEY ?? '').trim()
  const legacySiteKey = String(context.env.TURNSTILE_SITE_KEY ?? '').trim()
  const siteKey = viteSiteKey || legacySiteKey

  console.info('[api/config] Turnstile key diagnostics', {
    source: viteSiteKey ? 'VITE_TURNSTILE_SITE_KEY' : legacySiteKey ? 'TURNSTILE_SITE_KEY' : 'none',
    viteKeyLength: viteSiteKey.length,
    legacyKeyLength: legacySiteKey.length,
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
