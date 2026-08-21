import { ref } from 'vue'

import type { QuizResult } from '../types/quiz'
import { getLocale, t } from '../i18n'
import { getLocalizedCharacterName, getLocalizedCharacterSeries } from '../i18n/characters'
import { getCharacterRarityMeta } from '../utils/characterRarity'
import { formatCharacterProbability } from '../utils/characterProbability'

let htmlToImageLoader: Promise<typeof import('html-to-image')> | null = null

function createShareText(result: QuizResult) {
  const featured = result.characterMatches[0]
  const locale = getLocale()
  const rarityMeta = getCharacterRarityMeta(featured?.id)
  const rarityLabel = rarityMeta
    ? t(`result.rarityTiers.${rarityMeta.tier}`, undefined, rarityMeta.tier)
    : '--'
  const displayProbability = formatCharacterProbability(result.matchProbability)
  const siteUrl = 'https://acgti.tianxingleo.top'

  return [
    t('app.common.shareCode', { code: result.code }),
    featured
      ? t('app.common.shareCharacter', {
          name: getLocalizedCharacterName(featured, locale),
          series: getLocalizedCharacterSeries(featured, locale),
        })
      : t('app.common.shareUnknown'),
    rarityMeta
      ? t('app.common.shareRarity', {
          tier: rarityLabel,
          rank: rarityMeta.rank,
          total: rarityMeta.total,
        })
      : null,
    t('app.common.shareProbability', { prob: displayProbability }),
    t('app.common.shareProbabilityDesc'),
    t('app.common.shareArchetype', { name: t(`archetypes.${result.archetype.id}.name`) }),
    t(`archetypes.${result.archetype.id}.subtitle`),
    t('app.common.shareRole', { role: t(`archetypes.${result.archetype.id}.narrativeRole`) }),
    '',
    t('app.common.shareFooterProject'),
    t('app.common.shareFooterStar'),
    t('app.common.shareFooterCta', { url: siteUrl }),
  ].filter(line => line !== null).join('\n')
}

export function useShare() {
  const isExporting = ref(false)
  const feedback = ref('')

  async function exportPoster(target: HTMLElement | null, result: QuizResult) {
    if (!target || isExporting.value) {
      return
    }

    isExporting.value = true
    feedback.value = ''

    try {
      htmlToImageLoader ??= import('html-to-image')
      const { toPng } = await htmlToImageLoader
      // 等待字体就绪，避免导出图片出现字体回退；同源资源关闭 cacheBust，
      // 避免每次导出都绕过缓存重新拉取图片。
      await document.fonts.ready
      const dataUrl = await toPng(target, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })

      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `acgti-${result.archetype.id}.png`
      link.click()
      feedback.value = t('app.common.exportSuccess')
    } catch {
      feedback.value = t('app.common.exportFail')
    } finally {
      isExporting.value = false
    }
  }

  async function copyShareText(result: QuizResult) {
    const text = createShareText(result)

    try {
      await navigator.clipboard.writeText(text)
      feedback.value = t('app.common.copySuccess')
    } catch {
      feedback.value = t('app.common.copyFail')
    }
  }

  return {
    isExporting,
    feedback,
    exportPoster,
    copyShareText,
  }
}
