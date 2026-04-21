// _middleware.ts — Cloudflare Pages Functions 全局中间件
// 将带追踪参数的首页 URL 301 重定向到干净 URL，避免 Google 重复收录

/** 需要从首页移除的追踪参数前缀 / 精确名称 */
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'media_id',
  'media_author_id',
  'source_reply_media_id',
  'source',
  'share',
]

function hasTrackingOnly(url: URL): boolean {
  const keys = [...url.searchParams.keys()]
  if (keys.length === 0) return false
  return keys.every((k) => TRACKING_PARAMS.some((t) => k === t || k.startsWith(t + '_')))
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context
  const url = new URL(request.url)

  // 仅对首页路径处理，且 query string 里只含追踪类参数时才重定向
  if (url.pathname === '/' && hasTrackingOnly(url)) {
    const clean = new URL(url)
    clean.search = ''
    return Response.redirect(clean.toString(), 301)
  }

  return context.next()
}
