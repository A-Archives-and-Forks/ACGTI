<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import archetypesData from '../data/archetypes.json'
import charactersData from '../data/characters.json'
import characterVisualsData from '../data/characterVisuals.json'
import { useI18n } from '../i18n'
import { getLocalizedCharacterName, getLocalizedCharacterSeries } from '../i18n/characters'
import { resolvePublicAsset } from '../utils/characterVisuals'

const { t, locale } = useI18n()

// --- Archetype lookup ---
interface ArchetypeDef {
  id: string
  name: string
  subtitle: string
  accent: string
}
const archetypeMap = computed(() => {
  const map = new Map<string, ArchetypeDef>()
  for (const a of archetypesData as ArchetypeDef[]) {
    map.set(a.id, a)
  }
  return map
})

// --- Character visual lookup ---
type CharacterVisual = { thumb?: string; accent: string }
const visualMap = characterVisualsData as Record<string, CharacterVisual>

interface CharacterDef {
  id: string
  code: string
  name: string
  series: string
  hidden?: boolean
}

const characterCodeMap = computed(() => {
  const map = new Map<string, CharacterDef>()
  for (const item of charactersData as CharacterDef[]) {
    map.set(item.code.toUpperCase(), item)
  }
  return map
})

// --- Stats data ---
interface OverviewData {
  totalSubmissions: number
  todaySubmissions: number
  last24hSubmissions: number
}
interface RankedItem {
  code: string
  count: number
  percent: number
}

const loading = ref(true)
const overview = ref<OverviewData | null>(null)
const archetypes = ref<RankedItem[]>([])
const characters = ref<RankedItem[]>([])
const updatedAt = ref<string | null>(null)
const loadError = ref<string | null>(null)

function getLocaleLoadErrorMessage(): string {
  if (locale.value === 'zh-TW') {
    return '統計資料目前無法載入。若在本機開發，請使用 wrangler pages dev 啟動，才能訪問 /api/stats/*。'
  }
  if (locale.value === 'en') {
    return 'Stats data is currently unavailable. In local development, please run with wrangler pages dev so /api/stats/* works.'
  }
  if (locale.value === 'ja') {
    return '統計データを読み込めません。ローカル開発では wrangler pages dev で起動して /api/stats/* にアクセスしてください。'
  }
  return '统计数据暂时无法加载。本地开发请使用 wrangler pages dev 启动，才能访问 /api/stats/*。'
}

async function fetchStatsJson(url: string) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok || !contentType.includes('application/json')) {
    throw new Error('stats_api_unavailable')
  }
  return response.json()
}

function getCharacterFromCode(code: string): CharacterDef | null {
  return characterCodeMap.value.get(code.toUpperCase()) ?? null
}

function getCharacterName(code: string): string {
  const character = getCharacterFromCode(code)
  if (!character) return code
  return getLocalizedCharacterName(character, locale.value)
}

function getCharacterSeries(code: string): string {
  const character = getCharacterFromCode(code)
  if (!character) return ''
  return getLocalizedCharacterSeries(character, locale.value)
}

function getCharacterThumb(code: string): string | null {
  const character = getCharacterFromCode(code)
  if (!character) return null
  const thumb = visualMap[character.id]?.thumb
  return thumb ? resolvePublicAsset(thumb) : null
}

function getCharacterAccent(code: string): string {
  const character = getCharacterFromCode(code)
  if (!character) return '#3ba17c'
  return visualMap[character.id]?.accent ?? '#3ba17c'
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'W'
  return n.toLocaleString()
}

function formatTime(iso: string | null): string {
  if (!iso) return '--'
  const d = new Date(iso)
  return d.toLocaleString(locale.value === 'zh-CN' || locale.value === 'zh-TW' ? 'zh-CN' : locale.value)
}

// Only show top 20 characters on the page
const topCharacters = computed(() => characters.value.slice(0, 20))

onMounted(async () => {
  try {
    const [overviewRes, archetypesRes, charactersRes] = await Promise.all([
      fetchStatsJson('/api/stats/overview'),
      fetchStatsJson('/api/stats/archetypes'),
      fetchStatsJson('/api/stats/characters'),
    ])

    const overviewJson = overviewRes
    const archetypesJson = archetypesRes
    const charactersJson = charactersRes

    if (overviewJson.data) overview.value = overviewJson.data
    if (archetypesJson.data?.items) archetypes.value = archetypesJson.data.items
    if (charactersJson.data?.items) characters.value = charactersJson.data.items
    updatedAt.value = overviewJson.updatedAt ?? archetypesJson.updatedAt ?? charactersJson.updatedAt ?? null
  } catch (err) {
    console.error('Failed to load stats:', err)
    loadError.value = getLocaleLoadErrorMessage()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="stats-page">
    <!-- Hero header -->
    <section class="stats-hero" v-reveal>
      <div class="container">
        <h1 class="stats-page-title">{{ t('stats.title') }}</h1>
        <p class="stats-page-subtitle">{{ t('stats.subtitle') }}</p>
      </div>
    </section>

    <!-- Loading skeleton -->
    <section v-if="loading" class="stats-section">
      <div class="container">
        <div class="skeleton-grid">
          <div v-for="i in 3" :key="i" class="skeleton-card">
            <div class="skeleton-line wide"></div>
            <div class="skeleton-line narrow"></div>
          </div>
        </div>
      </div>
    </section>

    <template v-else>
      <section v-if="loadError" class="stats-section" v-reveal>
        <div class="container">
          <div class="error-card">{{ loadError }}</div>
        </div>
      </section>

      <!-- Overview cards -->
      <section class="stats-section" v-reveal>
        <div class="container">
          <div class="overview-grid">
            <div class="overview-card">
              <span class="overview-value">{{ formatNumber(overview?.totalSubmissions ?? 0) }}</span>
              <span class="overview-label">{{ t('stats.overview.total') }}</span>
            </div>
            <div class="overview-card">
              <span class="overview-value">{{ formatNumber(overview?.todaySubmissions ?? 0) }}</span>
              <span class="overview-label">{{ t('stats.overview.today') }}</span>
            </div>
            <div class="overview-card">
              <span class="overview-value">{{ formatNumber(overview?.last24hSubmissions ?? 0) }}</span>
              <span class="overview-label">{{ t('stats.overview.last24h') }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Archetype rankings -->
      <section class="stats-section" v-reveal>
        <div class="container">
          <h2 class="section-title">{{ t('stats.archetypes.title') }}</h2>
          <p class="section-subtitle">{{ t('stats.archetypes.subtitle') }}</p>

          <div class="ranking-list">
            <div
              v-for="(item, index) in archetypes"
              :key="item.code"
              class="ranking-row archetype-row"
            >
              <span class="ranking-index">{{ index + 1 }}</span>
              <div class="ranking-info">
                <div class="ranking-header">
                  <span
                    class="ranking-name"
                    :style="{ color: archetypeMap.get(item.code)?.accent }"
                  >
                    {{ archetypeMap.get(item.code)?.name ?? item.code }}
                  </span>
                  <span class="ranking-percent">{{ item.percent.toFixed(1) }}%</span>
                </div>
                <div class="ranking-bar-track">
                  <div
                    class="ranking-bar-fill"
                    :style="{
                      width: `${Math.max(item.percent, 1)}%`,
                      backgroundColor: archetypeMap.get(item.code)?.accent ?? '#3ba17c',
                    }"
                  ></div>
                </div>
                <span class="ranking-count">{{ formatNumber(item.count) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Character rankings -->
      <section class="stats-section" v-reveal>
        <div class="container">
          <h2 class="section-title">{{ t('stats.characters.title') }}</h2>
          <p class="section-subtitle">{{ t('stats.characters.subtitle') }}</p>

          <div class="ranking-list">
            <div
              v-for="(item, index) in topCharacters"
              :key="item.code"
              class="ranking-row character-row"
            >
              <span class="ranking-index">{{ index + 1 }}</span>
              <img
                v-if="getCharacterThumb(item.code)"
                :src="getCharacterThumb(item.code) ?? undefined"
                :alt="getCharacterName(item.code)"
                class="ranking-avatar"
              />
              <div v-else class="ranking-avatar placeholder"></div>
              <div class="ranking-info">
                <div class="ranking-header">
                  <span class="ranking-name">{{ getCharacterName(item.code) }}</span>
                  <span class="ranking-percent">{{ item.percent.toFixed(1) }}%</span>
                </div>
                <span class="ranking-subtitle">{{ getCharacterSeries(item.code) || item.code }}</span>
                <div class="ranking-bar-track">
                  <div
                    class="ranking-bar-fill"
                    :style="{
                      width: `${Math.max(item.percent, 1)}%`,
                      backgroundColor: getCharacterAccent(item.code),
                    }"
                  ></div>
                </div>
                <span class="ranking-count">{{ formatNumber(item.count) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Footer note -->
      <section class="stats-footer" v-reveal>
        <div class="container">
          <p class="footer-note">{{ t('stats.footer.note') }}</p>
          <p class="footer-update">{{ t('stats.footer.updateFreq') }}</p>
          <p class="footer-time">{{ t('stats.footer.lastUpdate', { time: formatTime(updatedAt) }) }}</p>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.container {
  width: min(1200px, calc(100% - 2rem));
  margin: 0 auto;
}

/* Hero */
.stats-hero {
  padding: 5rem 0 3rem;
  text-align: center;
  background: linear-gradient(135deg, #e8f5ee 0%, #f0f4ff 100%);
}
.stats-page-title {
  margin: 0;
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  font-weight: 800;
  color: #1a1a2e;
}
.stats-page-subtitle {
  margin: 0.8rem 0 0;
  font-size: 1.05rem;
  color: #666;
}

/* Sections */
.stats-section {
  padding: 3rem 0;
}

.section-title {
  margin: 0 0 0.4rem;
  font-size: clamp(1.3rem, 3vw, 1.8rem);
  font-weight: 700;
  color: #1a1a2e;
}
.section-subtitle {
  margin: 0 0 2rem;
  font-size: 0.95rem;
  color: #888;
}

/* Overview cards */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.2rem;
}
.overview-card {
  background: #fff;
  border-radius: 12px;
  padding: 2rem 1.5rem;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
.overview-value {
  display: block;
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  font-weight: 800;
  color: #3ba17c;
  line-height: 1.1;
}
.overview-label {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: #888;
}

/* Ranking list */
.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.ranking-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #fff;
  border-radius: 10px;
  padding: 1rem 1.2rem;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
  transition: transform 0.15s, box-shadow 0.15s;
}
.ranking-row:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.ranking-index {
  flex-shrink: 0;
  width: 2rem;
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  color: #aaa;
}
.ranking-row:nth-child(1) .ranking-index { color: #e5b540; }
.ranking-row:nth-child(2) .ranking-index { color: #aab0b3; }
.ranking-row:nth-child(3) .ranking-index { color: #c0885a; }

.ranking-avatar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background: #f0f0f0;
}
.ranking-avatar.placeholder {
  background: linear-gradient(135deg, #e0e0e0, #f5f5f5);
}

.ranking-info {
  flex: 1;
  min-width: 0;
}
.ranking-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.35rem;
}
.ranking-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: #1a1a2e;
}
.ranking-percent {
  font-weight: 700;
  font-size: 0.95rem;
  color: #3ba17c;
  flex-shrink: 0;
}
.ranking-subtitle {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.8rem;
  color: #8a8a8a;
}
.ranking-bar-track {
  width: 100%;
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}
.ranking-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s ease;
}
.ranking-count {
  font-size: 0.8rem;
  color: #aaa;
  margin-top: 0.2rem;
  display: block;
}

/* Footer */
.stats-footer {
  padding: 2.5rem 0 4rem;
  text-align: center;
  border-top: 1px solid #f0f0f0;
}
.footer-note {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: #888;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}
.footer-update {
  margin: 0 0 0.3rem;
  font-size: 0.85rem;
  color: #aaa;
}
.footer-time {
  margin: 0;
  font-size: 0.85rem;
  color: #aaa;
}

/* Loading skeleton */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.2rem;
}
.skeleton-card {
  background: #fff;
  border-radius: 12px;
  padding: 2rem 1.5rem;
}
.error-card {
  border: 1px solid #f0d9a6;
  background: #fff8e8;
  color: #7a5a16;
  border-radius: 12px;
  padding: 1rem 1.2rem;
  font-size: 0.9rem;
  line-height: 1.6;
}
.skeleton-line {
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
.skeleton-line.wide { height: 2rem; width: 60%; margin: 0 auto 0.8rem; }
.skeleton-line.narrow { height: 1rem; width: 40%; margin: 0 auto; }
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Responsive */
@media (max-width: 768px) {
  .overview-grid {
    grid-template-columns: 1fr;
    gap: 0.8rem;
  }
  .skeleton-grid {
    grid-template-columns: 1fr;
  }
  .ranking-row {
    padding: 0.8rem 1rem;
  }
  .ranking-avatar {
    width: 32px;
    height: 32px;
  }
}
</style>
