// /api/config — 公开前端运行时配置（不包含敏感信息）

export async function onRequestGet(context: any) {
  const siteKey = String(
    context.env.VITE_TURNSTILE_SITE_KEY ?? context.env.TURNSTILE_SITE_KEY ?? ''
  ).trim()

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
