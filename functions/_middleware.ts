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

/** 需要做跨站校验的写方法（GET 等只读请求不受影响） */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH'])

/**
 * CSRF 防线：防跨站表单/fetch 对 /api/ 写接口的投毒。
 * - Origin 存在时：必须与请求自身同源；本地回环（localhost / 127.0.0.1 /
 *   IPv6 [::1]）任意端口视为本地联调（Vite dev server 与 pages dev 端口不同）放行
 * - Sec-Fetch-Site: cross-site 直接判定跨站（现代浏览器都会携带该头）
 * - 两个头都没有（curl 等非浏览器客户端）放行，鉴权交由各端点自身逻辑
 */
function isCrossSiteWrite(request: Request, url: URL): boolean {
  const origin = request.headers.get('Origin')
  if (origin) {
    let originUrl: URL
    try {
      originUrl = new URL(origin)
    } catch {
      // Origin 值无法解析，视为非法来源
      return true
    }
    // [::1] 是 URL hostname 对 IPv6 回环的表示，裸 ::1 一并认可更稳妥
    if (['localhost', '127.0.0.1', '[::1]', '::1'].includes(originUrl.hostname)) {
      return false
    }
    if (originUrl.origin !== url.origin) {
      return true
    }
  }
  return request.headers.get('Sec-Fetch-Site') === 'cross-site'
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context
  const url = new URL(request.url)

  // 写接口的跨站请求直接拒绝（同源/本地联调/无浏览器头的客户端不受影响）
  if (
    url.pathname.startsWith('/api/') &&
    WRITE_METHODS.has(request.method) &&
    isCrossSiteWrite(request, url)
  ) {
    return new Response(JSON.stringify({ error: 'cross-site request rejected' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  // 仅对首页路径处理，且 query string 里只含追踪类参数时才重定向
  if (url.pathname === '/' && hasTrackingOnly(url)) {
    const clean = new URL(request.url)
    clean.search = ''
    return Response.redirect(clean.toString(), 301)
  }

  const response = await context.next()

  // API 响应统一补充基础安全响应头
  if (url.pathname.startsWith('/api/')) {
    const headers = new Headers(response.headers)
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Referrer-Policy', 'no-referrer')
    return new Response(response.body, { status: response.status, headers })
  }

  return response
}
