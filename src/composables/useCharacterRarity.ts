import { computed } from 'vue'

import { t } from '../i18n'
import type { CharacterMatch } from '../types/quiz'
import { hexToRgb, mixRgb, toRgbString } from '../utils/color'
import { getCharacterRarityMeta } from '../utils/characterRarity'

// 稀有度徽章的派生展示逻辑（标签、配色、字号、排名文案），
// 结果页与分享海报共用，调整档位样式只需改这一处。

export function useCharacterRarity(options: {
  character: () => CharacterMatch | null | undefined
  themeColor: () => string
  withShadow?: boolean
}) {
  const rarityMeta = computed(() => getCharacterRarityMeta(options.character()?.id))
  const rarityTierLabel = computed(() => {
    const tier = rarityMeta.value?.tier
    return tier
      ? t(`result.rarityTiers.${tier}`, undefined, tier)
      : '--'
  })

  const rarityTierStyle = computed(() => {
    const base = hexToRgb(options.themeColor())
    const white = { r: 255, g: 255, b: 255 }
    const dark = { r: 47, g: 58, b: 69 }
    const shadow = options.withShadow

    switch (rarityMeta.value?.tier) {
      case 'ex': {
        const text = mixRgb(base, dark, 0.15)
        return {
          color: toRgbString(text),
          background: `linear-gradient(135deg, ${toRgbString(base, 0.2)}, ${toRgbString(base, 0.35)})`,
          borderColor: toRgbString(base, 0.45),
          boxShadow: shadow ? `0 10px 24px ${toRgbString(base, 0.22)}` : 'none',
        }
      }
      case 'ur': {
        const text = mixRgb(base, dark, 0.22)
        return {
          color: toRgbString(text),
          background: toRgbString(base, 0.28),
          borderColor: toRgbString(base, 0.5),
          boxShadow: shadow ? `0 8px 18px ${toRgbString(base, 0.18)}` : 'none',
        }
      }
      case 'ssr': {
        const text = mixRgb(base, dark, 0.3)
        return {
          color: toRgbString(text),
          background: toRgbString(base, 0.18),
          borderColor: toRgbString(base, 0.34),
          boxShadow: shadow ? `0 6px 14px ${toRgbString(base, 0.12)}` : 'none',
        }
      }
      case 'sr': {
        const text = mixRgb(base, dark, 0.4)
        return {
          color: toRgbString(text),
          background: toRgbString(base, 0.1),
          borderColor: toRgbString(base, 0.22),
          boxShadow: 'none',
        }
      }
      default: {
        const muted = mixRgb(base, white, 0.72)
        const text = mixRgb(base, dark, 0.52)
        return {
          color: toRgbString(text),
          background: toRgbString(muted, 0.32),
          borderColor: toRgbString(base, 0.16),
          boxShadow: 'none',
        }
      }
    }
  })

  const rarityFontSizeStyle = computed(() => {
    const len = rarityTierLabel.value.length
    if (len > 12) return { fontSize: '13px' }
    if (len > 8) return { fontSize: '14px' }
    if (len > 5) return { fontSize: '15px' }
    return { fontSize: '18px' }
  })

  const rarityRankLabel = computed(() => {
    if (!rarityMeta.value) {
      return ''
    }

    return t('result.rarityRank', {
      rank: rarityMeta.value.rank,
      total: rarityMeta.value.total,
    }, `相对稀有排名 #${rarityMeta.value.rank}/${rarityMeta.value.total}`)
  })

  const raritySummaryLabel = computed(() => {
    if (!rarityMeta.value) {
      return ''
    }

    return t(`result.rarityTierDescriptions.${rarityMeta.value.tier}`, {
      start: rarityMeta.value.startRank,
      end: rarityMeta.value.endRank,
      startPercent: rarityMeta.value.rangeStartPercent,
      endPercent: rarityMeta.value.rangeEndPercent,
    })
  })

  return {
    rarityMeta,
    rarityTierLabel,
    rarityTierStyle,
    rarityFontSizeStyle,
    rarityRankLabel,
    raritySummaryLabel,
  }
}
