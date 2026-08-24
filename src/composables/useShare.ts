import { ref } from 'vue'

import type { QuizResult } from '../types/quiz'
import { getLocale, t } from '../i18n'
import { getLocalizedCharacterName, getLocalizedCharacterSeries } from '../i18n/characters'
import { getCharacterRarityMeta } from '../utils/characterRarity'
import { formatCharacterProbability } from '../utils/characterProbability'

let htmlToImageLoader: Promise<typeof import('html-to-image')> | null = null

const SITE_URL = 'https://acgti.tianxingleo.top'

function createShareText(result: QuizResult) {
  const featured = result.characterMatches[0]
  const locale = getLocale()
  const rarityMeta = getCharacterRarityMeta(featured?.id)
  const rarityLabel = rarityMeta
    ? t(`result.rarityTiers.${rarityMeta.tier}`, undefined, rarityMeta.tier)
    : '--'
  const displayProbability = formatCharacterProbability(result.matchProbability)
  const siteUrl = SITE_URL

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

// 海报文件命名（下载与系统分享共用同一规则）
function posterFileName(archetypeId: string) {
  return `acgti-${archetypeId}.png`
}

// 海报渲染公共流程：懒加载 html-to-image、等待字体就绪后导出 PNG Blob；失败返回 null
async function renderPoster(target: HTMLElement): Promise<Blob | null> {
  try {
    htmlToImageLoader ??= import('html-to-image')
    const { toBlob } = await htmlToImageLoader
    // 等待字体就绪，避免导出图片出现字体回退；同源资源关闭 cacheBust，
    // 避免每次导出都绕过缓存重新拉取图片。
    await document.fonts.ready
    return await toBlob(target, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    })
  } catch {
    return null
  }
}

export function useShare() {
  const isExporting = ref(false)
  const feedback = ref('')

  async function exportPoster(target: HTMLElement | null, result: QuizResult) {
    if (!target || isExporting.value) {
      // 早退也清空提示，避免残留上一次的成功文案
      feedback.value = ''
      return
    }

    isExporting.value = true
    feedback.value = ''

    try {
      const blob = await renderPoster(target)
      if (!blob) {
        feedback.value = t('app.common.exportFail')
        return
      }

      // 通过对象 URL 触发下载，用完立即释放
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = posterFileName(result.archetype.id)
      link.click()
      URL.revokeObjectURL(url)
      feedback.value = t('app.common.exportSuccess')
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

  // Web Share API Level 2（分享文件）：把海报 PNG 直接交給系统分享面板。
  // 仅移动端浏览器与桌面 Safari/Chrome 支持，不支持或用户取消时返回 false，
  // 由调用方回落到「下载图片」路径。
  async function sharePosterFile(target: HTMLElement | null, result: QuizResult): Promise<boolean> {
    if (!target || isExporting.value) {
      // 早退也清空提示，避免残留上一次的成功文案
      feedback.value = ''
      return false
    }
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
      feedback.value = ''
      return false
    }

    isExporting.value = true
    feedback.value = ''

    try {
      const blob = await renderPoster(target)
      if (!blob) {
        // 海报渲染失败是确定性失败，直接给出失败提示
        feedback.value = t('app.common.exportFail')
        return false
      }

      const file = new File([blob], posterFileName(result.archetype.id), { type: 'image/png' })
      if (!navigator.canShare({ files: [file] })) {
        // 文件不可分享：反馈交给回落到「下载图片」的流程设置，这里保持已清空状态
        return false
      }

      await navigator.share({
        files: [file],
        title: 'ACGTI',
        text: t('app.common.shareCode', { code: result.code }) + '\n' + SITE_URL,
      })
      feedback.value = t('app.common.shareSuccess')
      return true
    } catch (err) {
      // 用户在系统面板里取消分享不是错误
      if (err instanceof DOMException && err.name === 'AbortError') {
        return true
      }
      // 其他失败保持反馈为空（已清空），由调用方的回落流程给出最终提示
      return false
    } finally {
      isExporting.value = false
    }
  }

  return {
    isExporting,
    feedback,
    exportPoster,
    copyShareText,
    sharePosterFile,
  }
}
