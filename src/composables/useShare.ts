import { ref } from 'vue'
import { toPng } from 'html-to-image'

import type { QuizResult } from '../types/quiz'

function createShareText(result: QuizResult) {
  const matches = result.characterMatches.slice(0, 3).map((item) => `${item.name}（${item.series}）`)

  return [
    `我在 ACGTI 的人格类型是 ${result.mbtiCode}`,
    `对应原型：${result.archetype.name}`,
    result.archetype.subtitle,
    `剧情位置：${result.archetype.narrativeRole}`,
    `像我的角色：${matches.join('、') || '暂无更多展示角色'}`,
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
