<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AdsenseSlot from '../components/AdsenseSlot.vue'
import AppIcon from '../components/AppIcon.vue'
import { useShare } from '../composables/useShare'
import { useQuiz } from '../composables/useQuiz'
import { useI18n } from '../i18n'
import { getHiddenCharacterNote, getHiddenCharacterTags, getHiddenCharacterTitle, getLocalizedCharacterName, getLocalizedCharacterSeries, isHiddenCharacter } from '../i18n/characters'
import { formatCharacterProbability } from '../utils/characterProbability'
import { normalizeMbtiCode } from '../utils/quizEngine'

// SharePoster 只在用户点击"导出图片"时才加载和挂载
const SharePosterAsync = defineAsyncComponent(() => import('../components/SharePoster.vue'))

const route = useRoute()
const router = useRouter()
const quiz = useQuiz()
const activeDebugResult = ref<ReturnType<typeof quiz.createDebugResult>>(null)
const result = computed(() => activeDebugResult.value ?? quiz.latestResult.value)
const isCharacterImageBroken = ref(false)
const characterImageAttemptIndex = ref(0)
const share = useShare()
const posterRef = ref<{ rootEl: HTMLElement | null } | null>(null)
const shouldMountPoster = ref(false)
const { locale, t, tm } = useI18n()
const resultAdSlot = String(import.meta.env.VITE_ADSENSE_SLOT_RESULT ?? '').trim()

// 结果页需要数据来处理 debug 查询和角色匹配
onMounted(async () => {
  await quiz.ensureData()
  quiz.resumeLastResult()
  applyDebugResultFromRoute()

  if (!result.value) {
    void router.replace('/quiz')
  }
})

async function exportPosterImage() {
  if (!result.value) return
  // 首次导出时才挂载 SharePoster 组件
  if (!shouldMountPoster.value) {
    shouldMountPoster.value = true
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
  }
  if (!posterRef.value?.rootEl) return
  void share.exportPoster(posterRef.value.rootEl, result.value)
}

watch(
  () => [route.query.type, route.query.character],
  () => {
    applyDebugResultFromRoute()

    if (!result.value) {
      void router.replace('/quiz')
    }
  },
)

function retry() {
  quiz.resetQuiz()
  void router.push('/quiz')
}

function copyText() {
  if (!result.value) {
    return
  }
  void share.copyShareText(result.value)
}

function getCharacterImageCandidates(image: string | undefined) {
  if (!image) {
    return []
  }

  const variants = [image]

  if (image.endsWith('.webp')) {
    variants.push(image.replace(/\.webp$/i, '.png'))
  }

  if (image.endsWith('.png')) {
    variants.push(image.replace(/\.png$/i, '.webp'))
  }

  return Array.from(new Set(variants))
}

function handleCharacterImageError() {
  const nextAttempt = characterImageAttemptIndex.value + 1

  if (nextAttempt < primaryCharacterImageCandidates.value.length) {
    characterImageAttemptIndex.value = nextAttempt
    return
  }

  isCharacterImageBroken.value = true
}

function applyDebugResultFromRoute() {
  const normalizedType = normalizeMbtiCode(String(route.query.type ?? ''))
  const requestedCharacterId = String(route.query.character ?? '').trim().toLowerCase()

  if (!normalizedType && !requestedCharacterId) {
    activeDebugResult.value = null
    return
  }

  const preferredCharacter = requestedCharacterId
    ? quiz.characters.value.find((item) => item.id === requestedCharacterId)
    : null

  // Backward compatible with old debug links using ?type=XXXX.
  const fallbackCharacter = !preferredCharacter && normalizedType
    ? quiz.characters.value.find((item) => item.matchCode === normalizedType)
    : null

  const characterId = preferredCharacter?.id ?? fallbackCharacter?.id ?? ''
  activeDebugResult.value = characterId
    ? quiz.createDebugResult(characterId)
    : null
}

const primaryCharacterImage = computed(() => {
  const primary = result.value?.characterMatches?.[0]
  if (!primary) return ''
  return primary.image || `/images/characters/${primary.id}.webp`
})
const primaryCharacterImageCandidates = computed(() => getCharacterImageCandidates(primaryCharacterImage.value))
const activePrimaryCharacterImage = computed(() => primaryCharacterImageCandidates.value[characterImageAttemptIndex.value] ?? '')

const primaryCharacter = computed(() => result.value?.characterMatches?.[0] ?? null)
const secondaryCharacterMatches = computed(() => result.value?.topCharacterMatches?.slice(1, 4) ?? [])
const displayTags = computed(() => {
  if (!primaryCharacter.value) {
    return []
  }

  return isHiddenCharacter(primaryCharacter.value)
    ? getHiddenCharacterTags(locale.value)
    : primaryCharacter.value.tags.map((tag, idx) =>
        t('characters.' + primaryCharacter.value!.id + '.tags.' + idx, undefined, tag),
      )
})
const displayCode = computed(() => result.value?.code ?? result.value?.mbtiCode ?? '')
const displayProbability = computed(() => formatCharacterProbability(result.value?.matchProbability ?? 0))
const resultThemeColor = computed(() => primaryCharacter.value?.accent ?? result.value?.archetype.accent ?? '#e2ad3b')
const strongestTrait = computed(() => {
  if (!result.value) {
    return null
  }

  return traits.value.reduce((strongest, trait) => {
    const currentScore = result.value!.scores[trait.id]

    if (!strongest || currentScore.percentage > strongest.score.percentage) {
      return {
        trait,
        score: currentScore,
      }
    }

    return strongest
  }, null as { trait: (typeof traits.value)[number]; score: (typeof result.value.scores)[TraitDimension] } | null)
})

watch(primaryCharacterImageCandidates, () => {
  characterImageAttemptIndex.value = 0
  isCharacterImageBroken.value = false
})

type TraitDimension = 'E_I' | 'S_N' | 'T_F' | 'J_P'

const traits = computed(() => {
  const tDims = tm<Record<string, string[]>>('result.dimensions');
  return [
    { id: 'E_I' as const, leftCode: 'E', leftLabel: tDims.E_I[0], rightCode: 'I', rightLabel: tDims.E_I[1], color: '#4298B4' },
    { id: 'S_N' as const, leftCode: 'S', leftLabel: tDims.S_N[0], rightCode: 'N', rightLabel: tDims.S_N[1], color: '#E4AE3A' },
    { id: 'T_F' as const, leftCode: 'T', leftLabel: tDims.T_F[0], rightCode: 'F', rightLabel: tDims.T_F[1], color: '#33A474' },
    { id: 'J_P' as const, leftCode: 'J', leftLabel: tDims.J_P[0], rightCode: 'P', rightLabel: tDims.J_P[1], color: '#88619A' },
  ];
})

function getHandlePosition(traitId: TraitDimension, leftCode: string) {
  if (!result.value) return 50

  const score = result.value.scores[traitId]
  const percent = score.percentage

  if (score.dominant === leftCode) {
    return 50 - (percent - 50)
  }

  return 50 + (percent - 50)
}

function getDominantTraitLabel(traitId: TraitDimension, leftCode: string, leftLabel: string, rightLabel: string) {
  if (!result.value) return ''
  return result.value.scores[traitId].dominant === leftCode ? leftLabel : rightLabel
}

function scrollToSection(sectionId: string) {
  if (typeof window === 'undefined') return

  const target = document.getElementById(sectionId)
  if (!target) return

  window.history.replaceState(null, '', `#${sectionId}`)
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div v-if="result" class="result-page">
    <section class="result-hero" :style="{ background: resultThemeColor }">
      <div class="result-hero-inner">
        <div class="hero-copy type-box">
          <p class="hero-caption">{{ t('result.heroCaption') }}</p>
          <div class="hero-title-wrap">
            <h1 class="hero-title">{{ primaryCharacter ? getLocalizedCharacterName(primaryCharacter, locale, { revealHidden: true }) : t('archetypes.' + result.archetype.id + '.name', undefined, result.archetype.name) }}</h1>
            <span v-if="primaryCharacter && isHiddenCharacter(primaryCharacter)" class="hero-hidden-badge">{{ getHiddenCharacterTitle(locale, primaryCharacter) }}</span>
          </div>
          <div class="hero-badge-wrap">
            <span class="hero-code">{{ displayCode }}</span>
          </div>
          <div class="hero-metrics">
            <div class="hero-metric">
              <span>{{ t('result.rarity') }}</span>
              <strong>{{ displayProbability }}%</strong>
            </div>
            <div class="hero-metric">
              <span>{{ t('result.match') }}</span>
              <strong>{{ result.matchScore }}%</strong>
            </div>
          </div>
          <p class="hero-quote">{{ t('archetypes.' + result.archetype.id + '.oneLiner', undefined, result.archetype.oneLiner) }}</p>

          <div class="hero-actions">
            <button class="action-btn light" @click="copyText">
              <AppIcon name="copy" />
              {{ t('result.copy') }}
            </button>
            <a href="https://github.com/tianxingleo/ACGTI" target="_blank" rel="noopener noreferrer" class="action-btn" style="background: rgba(255, 255, 255, 0.2); color: white; text-decoration: none; border: none;">
              <svg style="width: 18px; height: 18px;" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              GitHub Star
            </a>
            <button class="action-btn ghost" @click="retry">
              <AppIcon name="refresh" />
              {{ t('result.retry') }}
            </button>
          </div>
          <p v-if="share.feedback.value" class="hero-feedback">{{ share.feedback.value }}</p>
        </div>

        <div class="hero-visual poster-box">
          <div class="poster-frame">
            <img
              v-if="primaryCharacter?.id && activePrimaryCharacterImage && !isCharacterImageBroken"
              :src="activePrimaryCharacterImage"
              :alt="primaryCharacter ? getLocalizedCharacterName(primaryCharacter, locale) : 'Character'"
              class="hero-image"
              decoding="async"
              fetchpriority="high"
              @error="handleCharacterImageError"
            />
            <div v-else class="hero-image-fallback">
              <AppIcon name="fallback" />
            </div>
          </div>
        </div>
      </div>

      <div class="hero-wave" aria-hidden="true">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,0 L0,120 L1200,120 L1200,60 C1000,80 800,20 600,60 C400,100 200,40 0,0 Z" />
        </svg>
      </div>
    </section>

    <div class="result-body">
      <main class="result-main">
        <section class="intro-block" v-reveal>
          <p>{{ t('archetypes.' + result.archetype.id + '.description', undefined, result.archetype.description) }}</p>
          <p>{{ primaryCharacter ? (isHiddenCharacter(primaryCharacter) ? getHiddenCharacterNote(locale, primaryCharacter) : t('characters.' + primaryCharacter.id + '.note', undefined, primaryCharacter.note)) : '' }}</p>
          <div v-if="primaryCharacter?.personaBasis?.type === 'fandom-impression'" class="persona-basis-notice">
            <span class="persona-basis-badge">{{ t('result.personaBasisBadge') }}</span>
            <p class="persona-basis-summary">{{ t('result.personaBasisTip') }}</p>
          </div>
        </section>

        <section v-if="secondaryCharacterMatches.length" class="similar-characters-section" v-reveal>
          <div class="section-title-wrap">
            <div class="section-index">+</div>
            <h2 class="section-title">{{ t('result.otherMatchesTitle', undefined, '其他高匹配角色') }}</h2>
          </div>

          <div class="similar-characters-grid">
            <article v-for="match in secondaryCharacterMatches" :key="match.character.id" class="similar-character-card">
              <div class="similar-character-head">
                <div>
                  <p class="similar-character-rank">{{ t('result.otherMatchesLabel', undefined, '高匹配候选') }}</p>
                  <h3>{{ getLocalizedCharacterName(match.character, locale) }}</h3>
                  <p class="similar-character-series">{{ getLocalizedCharacterSeries(match.character, locale) }}</p>
                </div>
                <div class="similar-character-score">
                  <strong>{{ match.score }}%</strong>
                  <span>{{ t('result.match', undefined, '整体命中感') }}</span>
                </div>
              </div>

              <p class="similar-character-code">{{ match.character.code }}</p>
              <p class="similar-character-note">
                {{ isHiddenCharacter(match.character) ? getHiddenCharacterNote(locale, match.character) : t('characters.' + match.character.id + '.note', undefined, match.character.note) }}
              </p>
            </article>
          </div>
        </section>

        <section class="traits-section" id="traits-section" v-reveal>
          <div class="section-title-wrap">
            <div class="section-index">1</div>
            <h2 class="section-title">{{ t('result.traitsTitle') }}</h2>
          </div>

          <div class="traits-card">
            <div class="traits-list">
              <div v-for="trait in traits" :key="trait.id" class="trait-row">
                <div
                  class="trait-percent"
                  :style="{
                    left: `${getHandlePosition(trait.id, trait.leftCode)}%`,
                    color: trait.color,
                  }"
                >
                  {{ result.scores[trait.id].percentage }}% {{ getDominantTraitLabel(trait.id, trait.leftCode, trait.leftLabel, trait.rightLabel) }}
                </div>

                <div class="trait-track" :style="{ backgroundColor: trait.color }">
                  <span class="trait-center-marker"></span>
                  <span
                    class="trait-handle"
                    :style="{
                      left: `calc(${getHandlePosition(trait.id, trait.leftCode)}% - 7px)`,
                      borderColor: trait.color,
                    }"
                  ></span>
                </div>

                <div class="trait-labels">
                  <span>{{ trait.leftLabel }} ({{ trait.leftCode }})</span>
                  <span>{{ trait.rightLabel }} ({{ trait.rightCode }})</span>
                </div>
              </div>
            </div>

            <aside class="traits-highlight">
              <p class="highlight-name">{{ t('result.strongest') }}</p>
              <h3 :style="{ color: strongestTrait?.trait.color ?? '#4298B4' }">
                {{ strongestTrait?.score.percentage ?? 0 }}% {{ strongestTrait ? getDominantTraitLabel(strongestTrait.trait.id, strongestTrait.trait.leftCode, strongestTrait.trait.leftLabel, strongestTrait.trait.rightLabel) : '' }}
              </h3>
              <div class="highlight-icon-wrap">
                <AppIcon name="chart" />
              </div>
              <p v-if="strongestTrait">
                {{ t('result.strongestCopy', { label: getDominantTraitLabel(strongestTrait.trait.id, strongestTrait.trait.leftCode, strongestTrait.trait.leftLabel, strongestTrait.trait.rightLabel) }) }}
              </p>
            </aside>
          </div>
        </section>

        <section class="analysis-grid" id="analysis-section" v-reveal>
          <article class="analysis-card good">
            <h3>
                <AppIcon name="star" />
                {{ t('result.spotlight', undefined, '亮点表现') }}
              </h3>
            <p>{{ t('archetypes.' + result.archetype.id + '.spotlight', undefined, result.archetype.spotlight) }}</p>
          </article>
          <article class="analysis-card bad">
            <h3>
                <AppIcon name="warning" />
                {{ t('result.weakness', undefined, '短板分析') }}
              </h3>
            <p>{{ t('archetypes.' + result.archetype.id + '.weakness', undefined, result.archetype.weakness) }}</p>
          </article>
        </section>

        <section class="tags-block" id="tags-section" v-if="primaryCharacter" v-reveal>
          <h3>
            <AppIcon name="character" />
            {{ t('result.tags') }}
          </h3>
          <div class="tags-wrap">
            <span v-for="tag in displayTags" :key="tag"># {{ tag }}</span>
          </div>
        </section>

        <div style="margin-top: 40px; display: flex; flex-direction: column; align-items: center; gap: 16px;">
  <button @click="exportPosterImage" :disabled="share.isExporting.value" class="export-image-btn" :style="{ backgroundColor: resultThemeColor }">
    <AppIcon name="spinner" v-if="share.isExporting.value" style="animation: spin 1s linear infinite" />
    <AppIcon name="download" v-else />
    <span style="letter-spacing: 0.05em">{{ share.isExporting.value ? t('common.generating', undefined, '生成中...') : t('common.saveImage', undefined, '生成并分享次元身份卡') }}</span>
  </button>
  <p v-if="share.feedback.value" class="export-feedback">{{ share.feedback.value }}</p>
</div>

<div class="poster-capture-wrapper">
  <SharePosterAsync v-if="shouldMountPoster" ref="posterRef" :result="result" />
</div>


        <section v-if="resultAdSlot" class="result-ad-section">
          <AdsenseSlot :slot="resultAdSlot" :label="t('app.common.sponsored')" />
        </section>
      </main>

      <aside class="result-sidebar">
        <div class="sidebar-card profile-card">
          <p class="small-title">{{ t('result.hitCharacter') }}</p>
          <h3>{{ primaryCharacter ? getLocalizedCharacterName(primaryCharacter, locale, { revealHidden: true }) : t('archetypes.' + result.archetype.id + '.name', undefined, result.archetype.name) }}</h3>
          <p v-if="primaryCharacter && isHiddenCharacter(primaryCharacter)" class="profile-hidden-flag">{{ getHiddenCharacterTitle(locale, primaryCharacter) }}</p>
          <p class="profile-code">{{ displayCode }}</p>
          <p class="profile-probability">{{ t('result.matchProbability', { value: displayProbability }) }}</p>
        </div>

        <div class="sidebar-card nav-card">
          <p class="small-title">{{ t('result.toc') }}</p>
          <a href="#traits-section" @click.prevent="scrollToSection('traits-section')">{{ tm<string[]>('result.tocItems')[0] }}</a>
          <a href="#analysis-section" @click.prevent="scrollToSection('analysis-section')">{{ tm<string[]>('result.tocItems')[1] }}</a>
          <a href="#tags-section" @click.prevent="scrollToSection('tags-section')">{{ tm<string[]>('result.tocItems')[2] }}</a>
        </div>

        <div class="sidebar-actions">
          <button @click="copyText">
            <AppIcon name="copy" />
            {{ t('result.share') }}
          </button>
          
          <button @click="exportPosterImage" :disabled="share.isExporting.value" :style="{ background: resultThemeColor, marginTop: '4px' }">
            <AppIcon name="spinner" v-if="share.isExporting.value" style="animation: spin 1s linear infinite" />
            <AppIcon name="download" v-else />
            {{ share.isExporting.value ? t('common.generating', undefined, '生成中...') : t('common.saveImage', undefined, '导出图片') }}
          </button>
          <p v-if="share.feedback.value" class="sidebar-feedback">{{ share.feedback.value }}</p>
        </div>

        <div class="sidebar-card relay-card">
          <div class="relay-card-icon">
            <AppIcon name="copy" />
          </div>
          <p class="relay-copy">{{ t('result.relayCopy') }}</p>
          <div class="relay-divider"></div>
          <p class="relay-hint">{{ t('result.relayHint') }}</p>
        </div>

        <div class="sidebar-card project-card">
          <p class="small-title">{{ t('result.ossTitle') }}</p>
          <p style="margin: 8px 0 12px; font-size: 14px; line-height: 1.5; color: #5f6b75;">
            {{ t('result.ossCopy') }}
          </p>
          <a href="https://github.com/tianxingleo/ACGTI" target="_blank" rel="noopener noreferrer" class="project-link" style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #3ba17c; color: white; border-radius: 20px; padding: 6px 12px; font-weight: 600; text-decoration: none;">
            <svg style="width: 14px; height: 14px;" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            {{ t('result.ossButton') }}
          </a>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.result-page {
  background: #f9f9f9;
  color: #333e49;
  min-height: 100vh;
  overflow-x: hidden;
  margin-left: 0;
  margin-right: 0;
  margin-bottom: -32px;
}

.result-hero {
  color: #fff;
  position: relative;
  overflow: hidden;
  padding-top: 56px;
}

.result-hero-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px 100px;
  display: grid;
  gap: 40px;
  grid-template-columns: 1fr;
  align-items: start;
}

@media (min-width: 768px) {
  .result-hero-inner {
    grid-template-columns: 1fr 1fr;
    padding-top: 60px;
    padding-bottom: 120px;
    gap: 60px;
  }

  .hero-copy {
    margin-top: 30px;
  }
}

.hero-caption {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  opacity: 0.9;
  letter-spacing: 1px;
}

.hero-title {
  margin: 8px 0 0;
  font-size: clamp(48px, 8vw, 76px);
  line-height: 1.1;
  font-weight: 900;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.hero-title-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.hero-hidden-badge {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.28);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.hero-badge-wrap {
  margin: 16px 0 0;
  display: inline-flex;
  background: rgba(255, 255, 255, 0.2);
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(8px);
}

.hero-code {
  font-size: clamp(24px, 4vw, 32px);
  font-weight: 800;
  letter-spacing: 2px;
}

.hero-quote {
  margin: 28px 0 0;
  max-width: 640px;
  font-size: clamp(20px, 3.5vw, 24px);
  line-height: 1.65;
  font-weight: 600;
  font-style: normal;
  letter-spacing: 0.5px;
  color: #fff;
  opacity: 0.96;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.hero-metrics {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.hero-metric {
  min-width: 148px;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.24);
}

.hero-metric span {
  display: block;
  font-size: 12px;
  line-height: 1.4;
  opacity: 0.88;
}

.hero-metric strong {
  display: block;
  margin-top: 4px;
  font-size: 24px;
  line-height: 1;
}

.hero-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 36px;
}

.action-btn {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border-radius: 999px;
  padding: 10px 16px;
  font-weight: 700;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  cursor: pointer;
}

.action-btn.light {
  background: #fff;
  border-color: #fff;
  color: #2f3a45;
}

.action-btn.ghost {
  background: transparent;
}

.hero-feedback {
  margin-top: 12px;
  font-size: 14px;
  font-weight: 700;
  opacity: 0.95;
}

.hero-visual {
  display: flex;
  justify-content: center;
  align-items: center;
  perspective: 1000px;
}

.poster-frame {
  position: relative;
  background: #fff;
  padding: 16px 16px 40px;
  border-radius: 12px;
  box-shadow: 
    0 20px 40px rgba(0,0,0,0.15),
    0 1px 3px rgba(0,0,0,0.05);
  transform: rotate(2deg) translateY(-10px);
  max-width: 380px;
  width: 100%;
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.poster-frame:hover {
  transform: rotate(0deg) translateY(-15px) scale(1.02);
  box-shadow: 
    0 30px 60px rgba(0,0,0,0.2),
    0 2px 4px rgba(0,0,0,0.05);
}

.hero-image {
  width: 100%;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  background: #f4f6f8;
  border: 1px solid #edf0f2;
}

.hero-image-fallback {
  width: 100%;
  aspect-ratio: 1;
  background: #f4f6f8;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 80px;
  color: #cdd4d9;
}

.hero-wave {
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 64px;
}

.hero-wave svg {
  width: 100%;
  height: 100%;
  display: block;
}

.hero-wave path {
  fill: #f9f9f9;
}

.result-body {
  max-width: 1280px;
  margin: 0 auto;
  padding: 26px 24px 40px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.intro-block {
  font-size: 19px;
  line-height: 1.75;
  color: #5f6b75;
  background: linear-gradient(180deg, #ffffff, #fbfdfb);
  border: 1px solid #e8ecef;
  border-radius: 18px;
  padding: 24px;
  margin-bottom: 32px;
}

.intro-block p {
  margin: 0 0 16px;
}

.intro-block p:last-child {
  margin-bottom: 0;
}

.persona-basis-notice {
  margin-top: 16px;
  padding: 12px 16px;
  background: #fffdf5;
  border: 1px solid #f0e2b0;
  border-radius: 10px;
}

.persona-basis-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  background: #fef3cd;
  border: 1px solid #f0e2b0;
  color: #8a6d1f;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}

.persona-basis-summary {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #7a6a3a;
  font-weight: 500;
}

.similar-characters-section {
  margin-bottom: 32px;
}

.similar-characters-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.similar-character-card {
  background: linear-gradient(180deg, #ffffff, #fbfdfb);
  border: 1px solid #e8ecef;
  border-radius: 18px;
  padding: 20px 22px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}

.similar-character-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.similar-character-rank {
  margin: 0 0 6px;
  color: #7b8690;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.similar-character-head h3 {
  margin: 0;
  font-size: 24px;
  color: #2f3a45;
}

.similar-character-series {
  margin: 8px 0 0;
  color: #6f7a83;
  font-size: 14px;
  font-weight: 600;
}

.similar-character-score {
  min-width: 92px;
  text-align: right;
}

.similar-character-score strong {
  display: block;
  color: #33a474;
  font-size: 28px;
  line-height: 1;
}

.similar-character-score span {
  display: block;
  margin-top: 6px;
  color: #7b8690;
  font-size: 12px;
  font-weight: 700;
}

.similar-character-code {
  margin: 14px 0 10px;
  color: #e4ae3a;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.similar-character-note {
  margin: 0;
  color: #596671;
  line-height: 1.75;
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.section-index {
  width: 50px;
  height: 50px;
  border-radius: 999px;
  border: 2px solid #e4ae3a;
  color: #e4ae3a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 800;
  background: #fff;
}

.section-title {
  font-size: clamp(30px, 4vw, 44px);
  margin: 0;
  font-weight: 800;
}

.traits-section,
.analysis-grid,
.tags-block {
  scroll-margin-top: 88px;
}

.traits-card {
  background: linear-gradient(180deg, #ffffff, #fbfdfb);
  border: 1px solid #e8ecef;
  border-radius: 18px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr;
}

.traits-list {
  padding: 24px;
}

.trait-row {
  margin-bottom: 30px;
}

.trait-row:last-child {
  margin-bottom: 0;
}

.trait-percent {
  position: relative;
  width: max-content;
  transform: translateX(-50%);
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 7px;
}

.trait-track {
  position: relative;
  width: 100%;
  border-radius: 999px;
  height: 6px;
}

.trait-center-marker {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 12px;
  background: rgba(255, 255, 255, 0.78);
}

.trait-handle {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 3px solid;
  background: #fff;
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.16);
}

.trait-labels {
  margin-top: 9px;
  display: flex;
  justify-content: space-between;
  color: #6c7780;
  font-size: 13px;
  font-weight: 600;
}

.traits-highlight {
  border-top: 1px solid #edf0f2;
  background: #f8f9fa;
  padding: 24px;
  text-align: center;
  color: #5f6b75;
}

.traits-highlight h3 {
  margin: 5px 0 14px;
  font-size: 28px;
}

.highlight-name {
  margin: 0;
  color: #7c8791;
  font-size: 14px;
  font-weight: 700;
}

.highlight-icon-wrap {
  width: 122px;
  height: 122px;
  margin: 0 auto 14px;
  border-radius: 999px;
  border: 1px solid #e6eaed;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 52px;
  color: #a3adb6;
}

.analysis-grid {
  margin-top: 32px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.analysis-card {
  background: linear-gradient(180deg, #ffffff, #fbfdfb);
  border: 1px solid #e8ecef;
  border-radius: 18px;
  padding: 24px;
}

.analysis-card h3 {
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
}

.analysis-card.good h3 {
  color: #33a474;
}

.analysis-card.bad h3 {
  color: #e26666;
}

.analysis-card p {
  margin: 0;
  line-height: 1.7;
  color: #596671;
}

.tags-block {
  margin-top: 24px;
  background: linear-gradient(180deg, #ffffff, #fbfdfb);
  border: 1px solid #e8ecef;
  border-radius: 18px;
  padding: 24px;
}

.tags-block h3 {
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 22px;
}

.tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tags-wrap span {
  border: 1px solid #e4e8eb;
  background: #f7f8f9;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 700;
  color: #596671;
}

.result-ad-section {
  margin-top: 24px;
}

.result-sidebar {
  position: relative;
}

.sidebar-card {
  background: linear-gradient(180deg, #ffffff, #fbfdfb);
  border: 1px solid #e7eaed;
  border-radius: 18px;
  padding: 20px;
  margin-bottom: 16px;
}

.small-title {
  margin: 0;
  color: #7b8690;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.profile-card h3 {
  margin: 8px 0 2px;
  font-size: 28px;
}

.profile-code {
  margin: 0;
  color: #e4ae3a;
  font-size: 24px;
  font-weight: 800;
}

.profile-hidden-flag {
  margin: 8px 0 0;
  color: #8f5a0a;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.profile-probability {
  margin: 10px 0 0;
  color: #5f6b75;
  font-size: 14px;
  font-weight: 700;
}

.nav-card {
  display: grid;
  gap: 2px;
}

.nav-card a {
  color: #4c5863;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  padding: 8px 4px;
  border-radius: 8px;
}

.nav-card a:hover {
  background: #f4f7f9;
  color: #2f3a45;
}

.sidebar-actions {
  display: grid;
  gap: 8px;
  margin-bottom: 24px;
}

.sidebar-actions button {
  width: 100%;
  border: 1px solid #dbe1e5;
  background: #fff;
  color: #4c5863;
  border-radius: 999px;
  font-weight: 700;
  font-size: 14px;
  padding: 10px 14px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.sidebar-actions button:hover {
  border-color: #c8d0d7;
}

.sidebar-feedback {
  margin: 8px 0 0;
  font-size: 13px;
  font-weight: 700;
  color: #33a474;
  text-align: center;
}

.relay-card {
  background: linear-gradient(180deg, #ffffff, #f7faf9);
  border-color: #e2e8e5;
  padding: 24px 20px;
  position: relative;
  overflow: hidden;
}

.relay-card-icon {
  position: absolute;
  top: -10px;
  right: -5px;
  font-size: 48px;
  color: #33a474;
  opacity: 0.05;
  transform: rotate(15deg);
}

.relay-copy {
  margin: 12px 0;
  font-size: 14px;
  line-height: 1.6;
  color: #4f5d67;
}

.relay-divider {
  height: 1px;
  background: #eef2f0;
  margin: 14px 0;
}

.relay-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #33a474;
  font-weight: 700;
}

.project-card {
  text-align: center;
}

.project-link {
  display: inline-block;
  margin-top: 6px;
  color: #33a474;
  font-weight: 700;
  font-size: 14px;
  text-decoration: none;
}

.project-link:hover {
  text-decoration: underline;
}

.project-cta {
  margin: 6px 0 0;
  font-size: 12px;
  color: #7b8690;
  font-weight: 600;
}

@media (min-width: 960px) {
  .result-hero-inner {
    grid-template-columns: 58% 42%;
    align-items: start;
    padding-bottom: 120px;
  }

  .result-body {
    grid-template-columns: minmax(0, 68%) minmax(280px, 32%);
    align-items: start;
    gap: 28px;
    margin-top: -30px;
  }

  .result-sidebar {
    position: sticky;
    top: 94px;
  }

  .traits-card {
    grid-template-columns: 65% 35%;
  }

  .traits-highlight {
    border-top: 0;
    border-left: 1px solid #edf0f2;
  }

  .analysis-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .similar-characters-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .result-hero {
    padding-top: 34px;
  }

  .result-hero-inner,
  .result-body {
    padding-left: 20px;
    padding-right: 20px;
  }

  .result-hero-inner {
    padding-top: 22px;
    padding-bottom: 72px;
    gap: 16px;
  }

  .hero-caption {
    font-size: 20px;
  }

  .hero-title {
    font-size: clamp(34px, 10vw, 48px);
  }

  .hero-code {
    font-size: clamp(22px, 6vw, 30px);
  }

  .hero-quote {
    font-size: 16px;
    line-height: 1.6;
    margin-top: 14px;
  }

  .hero-metrics {
    gap: 8px;
  }

  .hero-metric {
    flex: 1 1 140px;
    min-width: 0;
    padding: 10px 12px;
  }

  .hero-metric strong {
    font-size: 21px;
  }

  .hero-visual {
    margin-top: 24px;
  }

  .hero-image {
    width: min(320px, 100%);
    display: block;
    margin: 0 auto;
  }

  .hero-image-fallback {
    margin: 0 auto;
  }

  .hero-wave {
    height: 50px;
  }

  .result-body {
    padding-top: 16px;
    padding-bottom: 24px;
    gap: 16px;
  }

  .traits-section,
  .analysis-grid,
  .tags-block,
  .result-sidebar {
    margin-left: 2px;
    margin-right: 2px;
  }

  .intro-block {
    font-size: 16px;
    line-height: 1.7;
  }

  .section-title-wrap {
    gap: 10px;
    margin-bottom: 12px;
  }

  .section-index {
    width: 40px;
    height: 40px;
    font-size: 19px;
  }

  .section-title {
    font-size: 28px;
  }

  .traits-list,
  .traits-highlight,
  .analysis-card,
  .similar-character-card,
  .tags-block,
  .sidebar-card {
    padding: 14px;
  }

  .trait-row {
    margin-bottom: 22px;
  }

  .trait-percent {
    font-size: 12px;
  }

  .trait-labels {
    font-size: 12px;
    gap: 10px;
  }

  .analysis-card h3,
  .tags-block h3 {
    font-size: 18px;
  }

  .similar-character-head {
    flex-direction: column;
  }

  .similar-character-score {
    text-align: left;
  }

  .hero-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .action-btn {
    justify-content: center;
    width: 100%;
    min-height: 42px;
    font-size: 14px;
    padding: 8px 12px;
  }

  .result-sidebar {
    position: static;
  }
}

@media (max-width: 520px) {
  .result-hero-inner,
  .result-body {
    padding-left: 14px;
    padding-right: 14px;
  }

  .hero-title {
    font-size: clamp(30px, 10vw, 40px);
  }

  .hero-caption {
    font-size: 18px;
  }

  .hero-code {
    font-size: 22px;
  }

  .hero-image {
    width: min(270px, 100%);
  }

  .result-body {
    gap: 14px;
  }

  .trait-labels {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .profile-card h3 {
    font-size: 24px;
  }

  .profile-code {
    font-size: 21px;
  }

  .sidebar-card,
  .analysis-card,
  .similar-character-card,
  .traits-list,
  .traits-highlight,
  .tags-block {
    border-radius: 14px;
  }
}

.export-image-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: white;
  border: none;
  border-radius: 999px;
  padding: 16px 36px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s, box-shadow 0.2s;
  width: 100%;
  max-width: 360px;
}
.export-image-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}
.export-image-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
}
.export-feedback {
  margin: 0;
  font-size: 14px;
  color: #3ba17c;
  font-weight: 600;
}
@keyframes spin {
  100% { transform: rotate(360deg); }
}

.poster-capture-wrapper {
  position: absolute;
  top: -9999px;
  left: -9999px;
  width: 440px;
  pointer-events: none;
  z-index: -9999;
}
</style>
