// 角色 title/note/tags 的多语言数据（约 270KB JSON）按需异步加载，
// 避免整包进入首屏关键路径。加载完成前 t() 自动回退到源数据的简体中文。
import { DEFAULT_LOCALE, type AppLocale } from './types'

type CharacterMessage = {
  title?: string
  note?: string
  tags?: string[]
}

type CharacterMessageLocale = Record<string, CharacterMessage>

let cache: Record<AppLocale, CharacterMessageLocale> | null = null
let loading: Promise<void> | null = null

/** 首次调用发起加载；结果页/角色库页在渲染角色文案前 await 它 */
export function ensureCharacterMessages(): Promise<void> {
  loading ??= import('../data/characterMessages.json').then((mod) => {
    cache = mod.default as Record<AppLocale, CharacterMessageLocale>
  })
  return loading
}

export function getCharacterMessage(locale: AppLocale, key: string) {
  if (!cache) {
    return undefined
  }

  const match = /^characters\.([a-z0-9-]+)\.(title|note|tags\.(\d+))$/.exec(key)
  if (!match) {
    return undefined
  }

  const [, characterId, field, tagIndex] = match
  const localeMessages = cache[locale]
  const fallbackMessages = cache[DEFAULT_LOCALE]
  const message = localeMessages?.[characterId] ?? fallbackMessages?.[characterId]

  if (!message) return undefined
  if (field === 'title') return message.title
  if (field === 'note') return message.note

  const index = Number(tagIndex)
  return Number.isInteger(index) ? message.tags?.[index] : undefined
}
