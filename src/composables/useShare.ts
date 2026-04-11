import { ref } from 'vue'

import type { QuizResult } from '../types/quiz'

let htmlToImageLoader: Promise<typeof import('html-to-image')> | null = null

function createShareText(result: QuizResult) {
  const featured = result.characterMatches[0]

  return [
    `我在 ACGTI 命中的角色代码是 ${result.code}`,
    `命中角色：${featured ? `${featured.name}（${featured.series}）` : '未知角色'}`,
    `匹配概率：${result.matchProbability}%`,
    `对应原型：${result.archetype.name}`,
    result.archetype.subtitle,
    `剧情位置：${result.archetype.narrativeRole}`,
  ].join('\n')
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
      const dataUrl = await toPng(target, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#100f17',
      })

      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `acgti-${result.archetype.id}.png`
      link.click()
      feedback.value = '海报已导出为 PNG。'
    } catch {
      feedback.value = '导出失败，请稍后重试。'
    } finally {
      isExporting.value = false
    }
  }

  async function copyShareText(result: QuizResult) {
    const text = createShareText(result)

    try {
      await navigator.clipboard.writeText(text)
      feedback.value = '分享文案已复制。'
    } catch {
      feedback.value = '复制失败，请手动截图。'
    }
  }

  return {
    isExporting,
    feedback,
    exportPoster,
    copyShareText,
  }
}
