const runtimeApiBase = String(import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

let apiReachablePromise: Promise<boolean> | null = null

function looksLikeHtml(payload: string) {
  const normalized = payload.trim().toLowerCase()
  return normalized.startsWith('<!doctype') || normalized.startsWith('<html')
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return runtimeApiBase ? `${runtimeApiBase}${normalizedPath}` : normalizedPath
}

export async function isRuntimeApiReachable() {
  if (apiReachablePromise) {
    return apiReachablePromise
  }

  apiReachablePromise = (async () => {
    try {
      const resp = await fetch(buildApiUrl('/api/ping'), {
        method: 'GET',
        cache: 'no-store',
      })

      if (!resp.ok) {
        return false
      }

      const body = await resp.text()
      return body.trim().toLowerCase() === 'pong'
    } catch {
      return false
    }
  })()

  return apiReachablePromise
}

export function isLikelyJsonResponse(resp: Response, bodyPreview: string) {
  const contentType = String(resp.headers.get('content-type') ?? '').toLowerCase()
  if (contentType.includes('application/json')) {
    return true
  }

  if (contentType.includes('text/html')) {
    return false
  }

  return !looksLikeHtml(bodyPreview)
}