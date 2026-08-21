<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useCharacterRarity } from '../composables/useCharacterRarity'
import { useI18n } from '../i18n'
import { getHiddenCharacterTags, getHiddenCharacterTitle, getLocalizedCharacterName, getLocalizedCharacterSeries, isHiddenCharacter } from '../i18n/characters'
import type { QuizResult } from '../types/quiz'
import { ensureReadableOnLight } from '../utils/color'
import { normalizeCharacterImagePath } from '../utils/characterVisuals'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  result: QuizResult
}>()

const emit = defineEmits<{
  /** 组件挂载且头像图加载完成（或失败）后触发（仅作挂载期通知） */
  ready: []
}>()

const rootEl = ref<HTMLElement | null>(null)
const { locale, t } = useI18n()

// 每次调用都基于当前 <img> 状态返回新的就绪 Promise：
// 首次导出与结果切换后的再次导出都能等到头像真正加载完成
function waitReady(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve()
    const el = rootEl.value
    if (!el) return done()
    const img = el.querySelector('img')
    if (!img || img.complete) return done()
    img.addEventListener('load', done, { once: true })
    img.addEventListener('error', done, { once: true })
  })
}

defineExpose({
  rootEl,
  waitReady,
})

const primaryCharacter = computed(() => props.result.characterMatches[0] ?? null)
const resultThemeColor = computed(() => primaryCharacter.value?.accent ?? props.result.archetype.accent ?? '#e2ad3b')
// 浅色 accent 在海报浅底上不可读，混合加深以保住对比度
const posterTitleColor = computed(() => ensureReadableOnLight(resultThemeColor.value))
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

  return normalizeCharacterImagePath(primaryCharacter.value.image || `/images/characters/${primaryCharacter.value.id}.webp`)
})
const posterSeries = computed(() => {
  if (!primaryCharacter.value) {
    return t('app.common.unknownSeries')
  }

  return getLocalizedCharacterSeries(primaryCharacter.value, locale.value)
})

const rarityVisuals = useCharacterRarity({
  character: () => primaryCharacter.value,
  themeColor: () => resultThemeColor.value,
  withShadow: false,
})
const rarityTierLabel = rarityVisuals.rarityTierLabel
const rarityTierStyle = rarityVisuals.rarityTierStyle
const rarityFontSizeStyle = rarityVisuals.rarityFontSizeStyle
const raritySummaryLabel = rarityVisuals.raritySummaryLabel

// 头像加载完成（含缓存命中 complete 与加载失败两种情况）后发一次挂载期通知
watch(rootEl, (el) => {
  if (!el) return
  const img = el.querySelector('img')
  if (!img || img.complete) {
    emit('ready')
    return
  }
  const notify = () => emit('ready')
  img.addEventListener('load', notify, { once: true })
  img.addEventListener('error', notify, { once: true })
}, { immediate: true, flush: 'post' })
</script>

<template>
  <div class="poster-container">
    <section ref="rootEl" class="share-poster" :style="{ '--poster-accent': resultThemeColor, '--poster-title-color': posterTitleColor }">
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
            <h2 class="share-poster__title" :style="{ color: posterTitleColor }">
              {{ primaryCharacter ? getLocalizedCharacterName(primaryCharacter, locale, { revealHidden: true }) : t('archetypes.' + result.archetype.id + '.name', undefined, result.archetype.name) }}
            </h2>
            <p class="share-poster__subtitle">{{ posterSubtitle }}</p>
          </div>

          <div class="share-poster__metrics">
            <div class="share-poster__metric">
              <span class="metric-label">{{ t('result.match') }}</span>
              <strong class="metric-value" :style="{ color: posterTitleColor }">{{ result.matchScore }}%</strong>
            </div>
            <div class="share-poster__metric-divider"></div>
            <div class="share-poster__metric">
              <span class="metric-label">{{ t('result.rarity') }}</span>
              <strong class="metric-value metric-value--rarity" :style="[rarityTierStyle, rarityFontSizeStyle]">{{ rarityTierLabel }}</strong>
              <span class="metric-subvalue">{{ raritySummaryLabel }}</span>
            </div>
          </div>

          <div class="share-poster__tags">
            <span
              v-for="tag in posterTags"
              :key="tag"
              class="tag-pill"
              :style="{ backgroundColor: resultThemeColor + '15', color: posterTitleColor }"
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
  color: var(--poster-title-color, var(--poster-accent));
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.08em;
  white-space: nowrap;
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
  white-space: nowrap;
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
  padding: 6px 12px 7px; /* bottom padding tuned for visual centering of inner text */
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 18px;
  letter-spacing: 0.04em;
  word-break: keep-all;
  line-height: 1;
  box-sizing: border-box;
}

.metric-subvalue {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.4;
  color: #7b8892;
  font-weight: 700;
  white-space: nowrap;
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
  white-space: nowrap;
}

.share-poster__body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: auto;
}

.share-poster__block {
  background: linear-gradient(180deg, #ffffff, #fafdff);
  border: 1px solid rgba(95, 137, 159, 0.15);
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
  white-space: nowrap;
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
  white-space: nowrap;
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
