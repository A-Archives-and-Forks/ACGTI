import { useHead } from '@unhead/vue'
import { computed, type MaybeRef, unref } from 'vue'

const SITE_NAME = 'ACGTI'
const SITE_URL = 'https://acgti.tianxingleo.top'

interface SeoOptions {
  title: MaybeRef<string>
  description: MaybeRef<string>
  path?: MaybeRef<string>
  image?: MaybeRef<string>
  jsonLd?: MaybeRef<Record<string, unknown> | Record<string, unknown>[]>
}

export function useSeo(options: SeoOptions) {
  const url = computed(() => {
    const p = unref(options.path) ?? ''
    const normalizedPath = p === '' || p === '/' ? '/' : (p.startsWith('/') ? p : `/${p}`)
    return normalizedPath === '/' ? `${SITE_URL}/` : `${SITE_URL}${normalizedPath}`
  })

  const fullTitle = computed(() => {
    const t = unref(options.title)
    return t.includes(SITE_NAME) ? t : `${t} - ${SITE_NAME}`
  })

  const imageUrl = computed(() => {
    return unref(options.image) ?? `${SITE_URL}/og-image.png`
  })

  useHead({
    title: fullTitle,
    meta: [
      { name: 'description', content: options.description },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: options.description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: imageUrl },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: options.description },
      { name: 'twitter:image', content: imageUrl },
    ],
    link: [
      { rel: 'canonical', href: url },
    ],
    script: options.jsonLd
      ? [{ type: 'application/ld+json', innerHTML: JSON.stringify(unref(options.jsonLd)) }]
      : undefined,
  })
}
