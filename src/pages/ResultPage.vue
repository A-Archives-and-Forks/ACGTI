<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppIcon from '../components/AppIcon.vue'
import SharePoster from '../components/SharePoster.vue'
import { useShare } from '../composables/useShare'
import { useQuiz } from '../composables/useQuiz'
import { normalizeMbtiCode } from '../utils/quizEngine'

const route = useRoute()
const router = useRouter()
const quiz = useQuiz()
const activeDebugResult = ref<ReturnType<typeof quiz.createDebugResult>>(null)
const result = computed(() => activeDebugResult.value ?? quiz.latestResult.value)
const posterRef = ref<{ rootEl: HTMLElement | null } | null>(null)
const isCharacterImageBroken = ref(false)
const share = useShare()

onMounted(() => {
  quiz.resumeLastResult()
  applyDebugResultFromRoute()

  if (!result.value) {
    void router.replace('/quiz')
  }
})

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

function exportPoster() {
  if (!result.value) {
    return
  }
  void share.exportPoster(posterRef.value?.rootEl ?? null, result.value)
}

function copyText() {
  if (!result.value) {
    return
  }
  void share.copyShareText(result.value)
}

function hideBrokenImage(event: Event) {
  isCharacterImageBroken.value = true
  const img = event.currentTarget as HTMLImageElement | null
  if (!img) return
  img.style.display = 'none'
}

function applyDebugResultFromRoute() {
  const normalizedType = normalizeMbtiCode(String(route.query.type ?? ''))
  const requestedCharacterId = String(route.query.character ?? '').trim().toLowerCase()

  if (!normalizedType && !requestedCharacterId) {
    activeDebugResult.value = null
    return
  }

  const preferredCharacter = requestedCharacterId
    ? quiz.characters.find((item) => item.id === requestedCharacterId)
    : null

  // Backward compatible with old debug links using ?type=XXXX.
  const fallbackCharacter = !preferredCharacter && normalizedType
    ? quiz.characters.find((item) => item.matchCode === normalizedType)
    : null

  const characterId = preferredCharacter?.id ?? fallbackCharacter?.id ?? ''
  activeDebugResult.value = characterId
    ? quiz.createDebugResult(characterId)
    : null
}

const primaryCharacterImage = computed(() => {
  const primary = result.value?.characterMatches?.[0]
  if (!primary) return ''
  return primary.image || `/images/characters/${primary.id}.png`
})

const primaryCharacter = computed(() => result.value?.characterMatches?.[0] ?? null)
const displayCode = computed(() => result.value?.code ?? result.value?.mbtiCode ?? '')
const resultThemeColor = computed(() => primaryCharacter.value?.accent ?? result.value?.archetype.accent ?? '#e2ad3b')
const strongestTrait = computed(() => {
  if (!result.value) {
    return null
  }

  return traits.reduce((strongest, trait) => {
    const currentScore = result.value!.scores[trait.id]

    if (!strongest || currentScore.percentage > strongest.score.percentage) {
      return {
        trait,
        score: currentScore,
      }
    }

    return strongest
  }, null as { trait: (typeof traits)[number]; score: (typeof result.value.scores)[TraitDimension] } | null)
})

watch(primaryCharacterImage, () => {
  isCharacterImageBroken.value = false
})

type TraitDimension = 'E_I' | 'S_N' | 'T_F' | 'J_P'

const traits: Array<{
  id: TraitDimension
  leftCode: string
  leftLabel: string
  rightCode: string
  rightLabel: string
  color: string
}> = [
  { id: 'E_I', leftCode: 'E', leftLabel: '外向', rightCode: 'I', rightLabel: '内向', color: '#4298B4' },
  { id: 'S_N', leftCode: 'S', leftLabel: '实感', rightCode: 'N', rightLabel: '直觉', color: '#E4AE3A' },
  { id: 'T_F', leftCode: 'T', leftLabel: '理智', rightCode: 'F', rightLabel: '情感', color: '#33A474' },
  { id: 'J_P', leftCode: 'J', leftLabel: '判断', rightCode: 'P', rightLabel: '感知', color: '#88619A' },
]

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
</script>

<template>
  <div v-if="result" class="result-page">
    <section class="result-hero" :style="{ background: resultThemeColor }">
      <div class="result-hero-inner">
        <div class="hero-copy">
          <p class="hero-caption">你的匹配角色是</p>
          <h1 class="hero-title">{{ primaryCharacter?.name || result.archetype.name }}</h1>
          <p class="hero-code">{{ displayCode }}</p>
          <p class="hero-quote">{{ result.archetype.oneLiner }}</p>

          <div class="hero-actions">
            <button class="action-btn light" @click="copyText">
              <AppIcon name="copy" />
              复制文案
            </button>
            <button class="action-btn" :disabled="share.isExporting.value" @click="exportPoster">
              <AppIcon :name="share.isExporting.value ? 'spinner' : 'download'" :class="share.isExporting.value ? 'spin' : ''" />
              {{ share.isExporting.value ? '导出中...' : '导出海报' }}
            </button>
            <button class="action-btn ghost" @click="retry">
              <AppIcon name="refresh" />
              重新测试
            </button>
          </div>
          <p v-if="share.feedback.value" class="hero-feedback">{{ share.feedback.value }}</p>
        </div>

        <div class="hero-visual">
          <img
            v-if="primaryCharacter?.id && !isCharacterImageBroken"
            :src="primaryCharacterImage"
            :alt="primaryCharacter?.name || 'Character'"
            class="hero-image"
            @error="hideBrokenImage"
          />
          <div v-else class="hero-image-fallback">
            <AppIcon name="fallback" />
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
        <section class="intro-block">
          <p>{{ result.archetype.description }}</p>
          <p>{{ primaryCharacter?.note }}</p>
        </section>

        <section class="traits-section" id="traits-section">
          <div class="section-title-wrap">
            <div class="section-index">1</div>
            <h2 class="section-title">人格特质倾向</h2>
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
              <p class="highlight-name">当前最显著维度</p>
              <h3 :style="{ color: strongestTrait?.trait.color ?? '#4298B4' }">
                {{ strongestTrait?.score.percentage ?? 0 }}% {{ strongestTrait ? getDominantTraitLabel(strongestTrait.trait.id, strongestTrait.trait.leftCode, strongestTrait.trait.leftLabel, strongestTrait.trait.rightLabel) : '' }}
              </h3>
              <div class="highlight-icon-wrap">
                <AppIcon name="chart" />
              </div>
              <p v-if="strongestTrait">
                这一维度在你的答题里最稳定，当前更明显地指向{{ getDominantTraitLabel(strongestTrait.trait.id, strongestTrait.trait.leftCode, strongestTrait.trait.leftLabel, strongestTrait.trait.rightLabel) }}取向。
              </p>
            </aside>
          </div>
        </section>

        <section class="analysis-grid">
          <article class="analysis-card good">
            <h3>
              <AppIcon name="star" />
              亮点表现
            </h3>
            <p>{{ result.archetype.spotlight }}</p>
          </article>
          <article class="analysis-card bad">
            <h3>
              <AppIcon name="warning" />
              短板分析
            </h3>
            <p>{{ result.archetype.weakness }}</p>
          </article>
        </section>

        <section v-if="primaryCharacter" class="tags-block">
          <h3>
            <AppIcon name="character" />
            角色映射
          </h3>
          <div class="tags-wrap">
            <span v-for="tag in primaryCharacter.tags" :key="tag"># {{ tag }}</span>
          </div>
        </section>
      </main>

      <aside class="result-sidebar">
        <div class="sidebar-card profile-card">
          <p class="small-title">命中角色</p>
          <h3>{{ primaryCharacter?.name || result.archetype.name }}</h3>
          <p class="profile-code">{{ displayCode }}</p>
        </div>

        <div class="sidebar-card nav-card">
          <p class="small-title">本页内容</p>
          <a href="#traits-section">1. 人格特质倾向</a>
          <a href="#">2. 亮点与短板</a>
          <a href="#">3. 角色映射标签</a>
        </div>

        <div class="sidebar-actions">
          <button @click="copyText">
            <AppIcon name="copy" />
            分享结果
          </button>
          <button @click="exportPoster">
            <AppIcon name="download" />
            导出图片
          </button>
        </div>

        <div class="sidebar-card project-card">
          <p class="small-title">开源项目</p>
          <p style="margin: 8px 0 4px; font-size: 14px; line-height: 1.6; color: #5f6b75;">
            ACGTI 是一个开源项目，当前仍处于早期阶段，题目和角色都还不够丰富。
          </p>
          <a href="https://github.com/tianxingleo/ACGTI" target="_blank" rel="noopener" class="project-link">
            GitHub 仓库 →
          </a>
          <p class="project-cta">欢迎 Star / Fork / PR</p>
        </div>
      </aside>
    </div>

    <div class="poster-hidden">
      <SharePoster ref="posterRef" :result="result" />
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
  max-width: 1280px;
  margin: 0 auto;
  padding: 30px 24px 96px;
  display: grid;
  gap: 24px;
  grid-template-columns: 1fr;
}

.hero-caption {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  opacity: 0.92;
}

.hero-title {
  margin: 8px 0 0;
  font-size: clamp(44px, 8vw, 82px);
  line-height: 1;
  font-weight: 800;
}

.hero-code {
  margin: 6px 0 0;
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 700;
  opacity: 0.95;
}

.hero-quote {
  margin: 18px 0 0;
  max-width: 640px;
  font-size: 18px;
  line-height: 1.65;
  opacity: 0.95;
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 26px;
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

.action-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spin {
  animation: spin 900ms linear infinite;
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
  align-items: flex-end;
}

.hero-image {
  width: min(430px, 100%);
  object-fit: contain;
  filter: drop-shadow(0 26px 38px rgba(0, 0, 0, 0.2));
}

.hero-image-fallback {
  width: 220px;
  height: 220px;
  border-radius: 20px;
  border: 2px dashed rgba(255, 255, 255, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 80px;
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
}

.intro-block p {
  margin: 0 0 18px;
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

.traits-card {
  background: #fff;
  border: 1px solid #eceff1;
  border-radius: 20px;
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
  margin-top: 24px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.analysis-card {
  background: #fff;
  border: 1px solid #e8ecef;
  border-radius: 16px;
  padding: 18px;
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
  margin-top: 16px;
  background: #fff;
  border: 1px solid #e8ecef;
  border-radius: 16px;
  padding: 18px;
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

.result-sidebar {
  position: relative;
}

.sidebar-card {
  background: #fff;
  border: 1px solid #e7eaed;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
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

.poster-hidden {
  display: none;
}

@media (min-width: 960px) {
  .result-hero-inner {
    grid-template-columns: 58% 42%;
    align-items: center;
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

  .hero-image {
    width: min(320px, 100%);
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
  .traits-list,
  .traits-highlight,
  .tags-block {
    border-radius: 14px;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
