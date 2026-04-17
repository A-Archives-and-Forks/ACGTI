<script setup lang="ts">
import { computed, ref } from 'vue'

import { useI18n } from '../i18n'
import { getHiddenCharacterTags, getHiddenCharacterTitle, getLocalizedCharacterName, getLocalizedCharacterSeries, isHiddenCharacter } from '../i18n/characters'
import type { QuizResult } from '../types/quiz'
import { getCharacterRarityMeta } from '../utils/characterRarity'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  result: QuizResult
}>()

const rootEl = ref<HTMLElement | null>(null)
const { locale, t } = useI18n()

defineExpose({
  rootEl,
})

const primaryCharacter = computed(() => props.result.characterMatches[0] ?? null)
const resultThemeColor = computed(() => primaryCharacter.value?.accent ?? props.result.archetype.accent ?? '#e2ad3b')
const posterSubtitle = computed(() => {
  if (primaryCharacter.value) {
    if (isHiddenCharacter(primaryCharacter.value)) {
      return getHiddenCharacterTitle(locale.value, primaryCharacter.value)
    }

    return t(`characters.${primaryCharacter.value.id}.title`, undefined, primaryCharacter.value.title)
  }

  return t(`archetypes.${props.result.archetype.id}.subtitle`, undefined, props.result.archetype.subtitle)
})
const posterTags = computed(() => {
  if (primaryCharacter.value) {
    if (isHiddenCharacter(primaryCharacter.value)) {
      return getHiddenCharacterTags(locale.value)
    }

    return primaryCharacter.value.tags
      .map((tag, index) => t(`characters.${primaryCharacter.value!.id}.tags.${index}`, undefined, tag))
      .slice(0, 4)
  }

  const fallbackTags = props.result.tags.length ? props.result.tags : props.result.archetype.tags
  return fallbackTags
    .map((tag, index) => t(`archetypes.${props.result.archetype.id}.tags.${index}`, undefined, tag))
    .slice(0, 4)
})
const posterNarrativeRole = computed(() =>
  t(`archetypes.${props.result.archetype.id}.narrativeRole`, undefined, props.result.archetype.narrativeRole),
)
const posterImage = computed(() => {
  if (!primaryCharacter.value) {
    return ''
  }

  return primaryCharacter.value.image || `/images/characters/${primaryCharacter.value.id}.webp`
})
const posterSeries = computed(() => {
  if (!primaryCharacter.value) {
    return t('app.common.unknownSeries')
  }

  return getLocalizedCharacterSeries(primaryCharacter.value, locale.value)
})
function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const full = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized

  return {
    r: parseInt(full.substring(0, 2), 16),
    g: parseInt(full.substring(2, 4), 16),
    b: parseInt(full.substring(4, 6), 16),
  }
}

function mixRgb(base: { r: number; g: number; b: number }, target: { r: number; g: number; b: number }, weight: number) {
  const ratio = Math.max(0, Math.min(1, weight))
  return {
    r: Math.round(base.r * (1 - ratio) + target.r * ratio),
    g: Math.round(base.g * (1 - ratio) + target.g * ratio),
    b: Math.round(base.b * (1 - ratio) + target.b * ratio),
  }
}

function toRgbString(color: { r: number; g: number; b: number }, alpha?: number) {
  if (alpha === undefined) {
    return `rgb(${color.r}, ${color.g}, ${color.b})`
  }

  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
}

const rarityMeta = computed(() => getCharacterRarityMeta(primaryCharacter.value?.id))
const rarityTierLabel = computed(() => {
  const tier = rarityMeta.value?.tier
  return tier
    ? t(`result.rarityTiers.${tier}`, undefined, tier)
    : '--'
})
const rarityTierStyle = computed(() => {
  const base = hexToRgb(resultThemeColor.value)
  const white = { r: 255, g: 255, b: 255 }
  const dark = { r: 47, g: 58, b: 69 }
  const hiddenBase = { r: 122, g: 92, b: 255 }

  switch (rarityMeta.value?.tier) {
    case 'ex': {
      const text = mixRgb(hiddenBase, white, 0.08)
      return {
        color: toRgbString(text),
        background: 'linear-gradient(135deg, rgba(122, 92, 255, 0.16), rgba(255, 123, 172, 0.18))',
        borderColor: 'rgba(122, 92, 255, 0.35)',
      }
    }
    case 'ur': {
      const text = mixRgb(base, dark, 0.22)
      return {
        color: toRgbString(text),
        background: toRgbString(base, 0.28),
        borderColor: toRgbString(base, 0.5),
      }
    }
    case 'ssr': {
      const text = mixRgb(base, dark, 0.3)
      return {
        color: toRgbString(text),
        background: toRgbString(base, 0.18),
        borderColor: toRgbString(base, 0.34),
      }
    }
    case 'sr': {
      const text = mixRgb(base, dark, 0.4)
      return {
        color: toRgbString(text),
        background: toRgbString(base, 0.1),
        borderColor: toRgbString(base, 0.22),
      }
    }
    default: {
      const muted = mixRgb(base, white, 0.72)
      const text = mixRgb(base, dark, 0.52)
      return {
        color: toRgbString(text),
        background: toRgbString(muted, 0.32),
        borderColor: toRgbString(base, 0.16),
      }
    }
  }
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
</script>

<template>
  <div class="poster-container">
    <section ref="rootEl" class="share-poster" :style="{ '--poster-accent': resultThemeColor }">
      <div class="share-poster__accent-bar"></div>
      <div class="share-poster__surface"></div>

      <div class="share-poster__inner">
        <div class="share-poster__copy">
          <div class="share-poster__header">
            <p class="share-poster__kicker">{{ t('result.shareCard', undefined, 'ACG TYPE INDICATOR') }}</p>
            <div class="share-poster__title-row">
              <span class="share-poster__code">{{ result.code }}</span>
              <p v-if="primaryCharacter?.personaBasis?.type === 'fandom-impression'" class="share-poster__basis-tip">
                {{ t('result.personaBasisBadge') }}
              </p>
            </div>
            <h2 class="share-poster__title" :style="{ color: resultThemeColor }">
              {{ primaryCharacter ? getLocalizedCharacterName(primaryCharacter, locale, { revealHidden: true }) : t('archetypes.' + result.archetype.id + '.name', undefined, result.archetype.name) }}
            </h2>
            <p class="share-poster__subtitle">{{ posterSubtitle }}</p>
          </div>

          <div class="share-poster__metrics">
            <div class="share-poster__metric">
              <span class="metric-label">{{ t('result.match') }}</span>
              <strong class="metric-value" :style="{ color: resultThemeColor }">{{ result.matchScore }}%</strong>
            </div>
            <div class="share-poster__metric-divider"></div>
            <div class="share-poster__metric">
              <span class="metric-label">{{ t('result.rarity') }}</span>
              <strong class="metric-value metric-value--rarity" :style="rarityTierStyle">{{ rarityTierLabel }}</strong>
              <span class="metric-subvalue">{{ raritySummaryLabel }}</span>
            </div>
          </div>

          <div class="share-poster__tags">
            <span
              v-for="tag in posterTags"
              :key="tag"
              class="tag-pill"
              :style="{ backgroundColor: resultThemeColor + '15', color: resultThemeColor }"
            ># {{ tag }}</span>
          </div>

          <div class="share-poster__body">
            <div class="share-poster__block">
              <p class="block-label"><AppIcon name="star" /> {{ t('result.spotlight', undefined, '亮点表现') }}</p>
              <p class="block-content">{{ t('archetypes.' + result.archetype.id + '.spotlight', undefined, result.archetype.spotlight) }}</p>
            </div>
            <div class="share-poster__block">
              <p class="block-label"><AppIcon name="book" /> {{ t('result.narrativeRole', undefined, '剧情位置') }}</p>
              <p class="block-content">{{ posterNarrativeRole }}</p>
            </div>
          </div>

          <div class="share-poster__footer">
            <div class="footer-left">
              <div class="footer-logo">ACGTI</div>
              <div class="footer-desc">{{ t('result.testNote', undefined, '你的社交白皮书') }}</div>
            </div>
            <div class="footer-links">
              <span class="footer-link-item">github.com/tianxingleo/ACGTI</span>
              <span class="footer-link-item">acgti.tianxingleo.top</span>
            </div>
          </div>
        </div>

        <div class="share-poster__visual">
          <div class="share-poster__visual-card">
            <div class="visual-chip">{{ t('result.hitCharacter', undefined, '对应角色') }}</div>
            <p class="visual-name">
              {{ primaryCharacter ? getLocalizedCharacterName(primaryCharacter, locale) : t('app.common.unknownCharacter') }}
            </p>
            <p class="visual-series">{{ posterSeries }}</p>
            <div class="visual-image-shell">
              <img v-if="posterImage" :src="posterImage" :alt="primaryCharacter ? getLocalizedCharacterName(primaryCharacter, locale) : t('app.common.unknownCharacter')" class="visual-image" />
              <div v-else class="visual-fallback">
                <AppIcon name="fallback" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.poster-container {
  display: flex;
  justify-content: center;
}

.share-poster {
  position: relative;
  width: 980px;
  min-height: 560px;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.4), transparent 34%),
    linear-gradient(135deg, color-mix(in srgb, var(--poster-accent) 18%, #f5fbfd) 0%, #ffffff 42%, #f7fbfc 100%);
  border-radius: 28px;
  box-shadow: 0 24px 80px rgba(31, 57, 76, 0.16);
  overflow: hidden;
  text-align: left;
  border: 1px solid rgba(95, 137, 159, 0.14);
}

.share-poster__accent-bar {
  height: 16px;
  background: var(--poster-accent);
}

.share-poster__surface {
  position: absolute;
  inset: 60px -120px auto auto;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--poster-accent) 16%, #ffffff);
  opacity: 0.65;
  filter: blur(8px);
}

.share-poster__inner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.28fr) minmax(300px, 0.9fr);
  gap: 22px;
  padding: 28px 30px 26px;
  align-items: stretch;
}

.share-poster__copy {
  display: flex;
  flex-direction: column;
}

.share-poster__header {
  margin-bottom: 22px;
}

.share-poster__kicker {
  font-size: 13px;
  font-weight: 800;
  color: #8c9ba5;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin: 0 0 8px;
}

.share-poster__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.share-poster__code {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 6px 14px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--poster-accent) 14%, #ffffff);
  color: var(--poster-accent);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.share-poster__basis-tip {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: #a0832c;
}

.share-poster__title {
  font-size: 40px;
  font-weight: 900;
  line-height: 1.04;
  margin: 0 0 8px;
  font-family: system-ui, -apple-system, sans-serif;
  letter-spacing: -0.04em;
  max-width: 10ch;
}

.share-poster__subtitle {
  font-size: 15px;
  color: #5f6b75;
  margin: 0;
  font-weight: 600;
  max-width: 34rem;
  line-height: 1.5;
}

.share-poster__metrics {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(95, 137, 159, 0.12);
  border-radius: 18px;
  padding: 14px 16px;
  margin-bottom: 16px;
}

.share-poster__metric {
  flex: 1;
}

.metric-label {
  display: block;
  font-size: 12px;
  color: #5f6b75;
  font-weight: 700;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.metric-value {
  display: block;
  font-size: 26px;
  font-weight: 800;
  color: #333e49;
  line-height: 1;
}

.metric-value--rarity {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 18px;
  letter-spacing: 0.04em;
}

.metric-subvalue {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.4;
  color: #7b8892;
  font-weight: 700;
}

.share-poster__metric-divider {
  width: 1px;
  height: 36px;
  background: #dfe3e8;
  margin: 0 20px;
}

.share-poster__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
}

.tag-pill {
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.share-poster__body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: auto;
}

.share-poster__block {
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(95, 137, 159, 0.12);
  border-top: 4px solid var(--poster-accent);
  padding: 16px 18px 18px;
  border-radius: 16px;
  min-height: 126px;
}

.block-label {
  font-size: 12px;
  color: #5f6b75;
  font-weight: 800;
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.block-content {
  font-size: 15px;
  line-height: 1.5;
  color: #333e49;
  margin: 0;
}

.share-poster__footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-top: 1px dashed rgba(95, 137, 159, 0.22);
  padding-top: 16px;
  margin-top: 24px;
}

.footer-logo {
  font-weight: 900;
  font-size: 16px;
  color: #333e49;
  letter-spacing: 1px;
}

.footer-desc {
  font-size: 12px;
  color: #8c9ba5;
  font-weight: 700;
  margin-top: 2px;
}

.footer-links {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.footer-link-item {
  font-size: 11px;
  color: #8c9ba5;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.share-poster__visual {
  display: flex;
}

.share-poster__visual-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100%;
  padding: 18px 18px 0;
  border-radius: 26px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--poster-accent) 14%, #ffffff) 0%, rgba(255, 255, 255, 0.96) 34%, rgba(255, 255, 255, 0.98) 100%);
  border: 1px solid rgba(95, 137, 159, 0.16);
  overflow: hidden;
}

.share-poster__visual-card::before {
  content: '';
  position: absolute;
  inset: auto -34px -40px auto;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--poster-accent) 16%, #ffffff);
}

.visual-chip {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-self: flex-start;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(95, 137, 159, 0.12);
  color: #5f6b75;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.visual-name {
  position: relative;
  z-index: 1;
  margin: 16px 0 4px;
  font-size: 28px;
  line-height: 1.1;
  font-weight: 900;
  color: #333e49;
}

.visual-series {
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: 14px;
  color: #70808b;
  font-weight: 600;
}

.visual-image-shell {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 320px;
  margin-top: 8px;
}

.visual-image {
  width: 100%;
  max-width: 320px;
  max-height: 390px;
  object-fit: contain;
  object-position: center center;
  filter: drop-shadow(0 26px 32px rgba(58, 79, 96, 0.22));
}

.visual-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 220px;
  height: 220px;
  margin: auto;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.72);
  color: var(--poster-accent);
}
</style>
