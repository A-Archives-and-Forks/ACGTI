<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { useQuiz } from '../composables/useQuiz'
import { useI18n } from '../i18n'
import { useSeo } from '../composables/useSeo'
import {
  getHiddenCharacterOrder,
  getHiddenCharacterTitle,
  getLocalizedCharacterName,
  getLocalizedCharacterSeries,
  isHiddenCharacter,
} from '../i18n/characters'
import { getCharacterRarityMeta } from '../utils/characterRarity'
import type { CharacterMatch } from '../types/quiz'

useSeo({
  title: 'ACGTI 角色库 - 105+ 二次元角色原型',
  description: '浏览 ACGTI 官网角色库，包含 105+ 位二次元角色原型。每角色均基于 MBTI 十六型人格映射，展示性格维度、稀有度和角色来源。',
  path: '/characters',
})

const { characters, ensureData } = useQuiz()
const { locale, t } = useI18n()
type CharacterSortField = 'rarity' | 'release' | 'series'
type SortDirection = 'asc' | 'desc'

const sortField = ref<CharacterSortField>('release')
const sortDirection = ref<SortDirection>('asc')
const isSortMenuOpen = ref(false)
const sortDropdownRef = ref<HTMLElement | null>(null)

// 进入图鉴页时才加载角色数据
onMounted(() => {
  void ensureData()
  document.addEventListener('click', closeSortMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeSortMenu)
})

const visibleCharacters = computed(() => characters.value.filter((character) => !isHiddenCharacter(character)))
const hiddenCharacters = computed(() => characters.value.filter((character) => isHiddenCharacter(character)))
const visibleCharacterIndexMap = computed(() => new Map(
  visibleCharacters.value.map((character, index) => [character.id, index]),
))

const orderedCharacters = computed(() => {
  const sortedVisibleCharacters = [...visibleCharacters.value].sort(compareCharacters)

  return [
    ...sortedVisibleCharacters,
    ...[...hiddenCharacters.value].sort((left, right) => getHiddenCharacterOrder(left) - getHiddenCharacterOrder(right)),
  ]
})

const latestCharacters = computed(() => {
  return [...visibleCharacters.value]
    .map((character, index) => ({
      character,
      index,
      timestamp: Date.parse(character.addedAt ?? ''),
    }))
    .sort((left, right) => {
      const leftHasDate = Number.isFinite(left.timestamp)
      const rightHasDate = Number.isFinite(right.timestamp)

      if (leftHasDate && rightHasDate && left.timestamp !== right.timestamp) {
        return right.timestamp - left.timestamp
      }

      if (leftHasDate !== rightHasDate) {
        return leftHasDate ? -1 : 1
      }

      return right.index - left.index
    })
    .slice(0, 3)
    .map(({ character }) => character)
})

const localizedStatsText = computed(() => {
  return t('characters.stats', { count: orderedCharacters.value.length })
})

const sortOptions = computed(() => ([
  { value: 'rarity', label: t('characters.sortFields.rarity') },
  { value: 'release', label: t('characters.sortFields.release') },
  { value: 'series', label: t('characters.sortFields.series') },
]) as Array<{ value: CharacterSortField; label: string }>)
const currentSortLabel = computed(() => {
  return sortOptions.value.find((option) => option.value === sortField.value)?.label ?? ''
})
const currentDirectionLabel = computed(() => t(`characters.sortDirections.${sortDirection.value}`))

function toggleSortMenu() {
  isSortMenuOpen.value = !isSortMenuOpen.value
}

function selectSortField(field: CharacterSortField) {
  sortField.value = field
  isSortMenuOpen.value = false
}

function toggleSortDirection() {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
}

function closeSortMenu(event: MouseEvent) {
  if (sortDropdownRef.value && !sortDropdownRef.value.contains(event.target as Node)) {
    isSortMenuOpen.value = false
  }
}

function compareCharacters(left: CharacterMatch, right: CharacterMatch) {
  switch (sortField.value) {
    case 'release':
      return compareReleaseDate(left, right)
    case 'series':
      return compareSeries(left, right)
    case 'rarity':
    default:
      return compareRarity(left, right)
  }
}

function compareRarity(left: CharacterMatch, right: CharacterMatch) {
  const leftMeta = getCharacterRarityMeta(left.id)
  const rightMeta = getCharacterRarityMeta(right.id)
  const leftRank = leftMeta?.rank ?? Number.POSITIVE_INFINITY
  const rightRank = rightMeta?.rank ?? Number.POSITIVE_INFINITY

  if (leftRank !== rightRank) {
    return sortDirection.value === 'asc' ? leftRank - rightRank : rightRank - leftRank
  }

  return compareByLocalizedName(left, right)
}

function compareReleaseDate(left: CharacterMatch, right: CharacterMatch) {
  const leftTimestamp = Date.parse(left.addedAt ?? '')
  const rightTimestamp = Date.parse(right.addedAt ?? '')
  const leftHasDate = Number.isFinite(leftTimestamp)
  const rightHasDate = Number.isFinite(rightTimestamp)

  if (leftHasDate && rightHasDate && leftTimestamp !== rightTimestamp) {
    return sortDirection.value === 'asc' ? leftTimestamp - rightTimestamp : rightTimestamp - leftTimestamp
  }

  if (leftHasDate !== rightHasDate) {
    if (sortDirection.value === 'asc') {
      return leftHasDate ? 1 : -1
    }

    return leftHasDate ? -1 : 1
  }

  const leftIndex = visibleCharacterIndexMap.value.get(left.id) ?? Number.MAX_SAFE_INTEGER
  const rightIndex = visibleCharacterIndexMap.value.get(right.id) ?? Number.MAX_SAFE_INTEGER

  if (leftIndex !== rightIndex) {
    return sortDirection.value === 'asc' ? leftIndex - rightIndex : rightIndex - leftIndex
  }

  return compareByLocalizedName(left, right)
}

function compareSeries(left: CharacterMatch, right: CharacterMatch) {
  const leftSeries = getLocalizedCharacterSeries(left, locale.value)
  const rightSeries = getLocalizedCharacterSeries(right, locale.value)
  const seriesDelta = leftSeries.localeCompare(rightSeries, locale.value)

  if (seriesDelta !== 0) {
    return sortDirection.value === 'asc' ? seriesDelta : -seriesDelta
  }

  return compareByLocalizedName(left, right)
}

function compareByLocalizedName(left: CharacterMatch, right: CharacterMatch) {
  const leftName = getLocalizedCharacterName(left, locale.value)
  const rightName = getLocalizedCharacterName(right, locale.value)
  return leftName.localeCompare(rightName, locale.value)
}
</script>

<template>
  <div class="page-stack page-stack--narrow">
    <section class="hero-panel center compact">
      <h1 class="display-title">{{ t('characters.title') }}</h1>
      <p class="lead">{{ t('characters.lead') }}</p>
     
      <div class="hero-toolbar" v-if="orderedCharacters.length > 0">
        <div class="stats-panel">
          <span class="stat-count">{{ localizedStatsText }}</span>
          <span class="stat-divider" v-if="latestCharacters.length > 0">｜</span>
          <span class="stat-latest" v-if="latestCharacters.length > 0">
            {{ t('characters.latest') }}
            <template v-for="(char, index) in latestCharacters" :key="char.id">
              <RouterLink 
                class="latest-link"
                :to="{ path: '/result', query: { character: char.id } }"
              >{{ getLocalizedCharacterName(char, locale) }}</RouterLink><span v-if="index < latestCharacters.length - 1">, </span>
            </template>
          </span>
        </div>

        <div class="sort-panel" v-if="visibleCharacters.length > 0">
          <div class="sort-dropdown" :class="{ 'is-open': isSortMenuOpen }" ref="sortDropdownRef">
            <button
              class="sort-dropdown-trigger"
              type="button"
              :aria-label="`${t('characters.sortLabel')}：${currentSortLabel}`"
              :aria-expanded="isSortMenuOpen"
              @click.stop="toggleSortMenu"
            >
              <span class="sort-trigger-prefix">{{ t('characters.sortLabel') }}</span>
              <span class="sort-trigger-value">{{ currentSortLabel }}</span>
              <span class="arrow"></span>
            </button>

            <transition name="dropdown">
              <ul class="sort-dropdown-menu" v-show="isSortMenuOpen" role="listbox">
                <li
                  v-for="option in sortOptions"
                  :key="option.value"
                  role="option"
                  :aria-selected="option.value === sortField"
                  :class="{ active: option.value === sortField }"
                  @click.stop="selectSortField(option.value)"
                >
                  {{ option.label }}
                </li>
              </ul>
            </transition>
          </div>

          <button
            class="sort-direction-btn"
            type="button"
            :aria-label="`${t('characters.sortDirectionLabel')}：${currentDirectionLabel}`"
            :title="`${t('characters.sortDirectionLabel')}：${currentDirectionLabel}`"
            @click="toggleSortDirection"
          >
            <svg v-if="sortDirection === 'asc'" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 17V7" />
              <path d="M4 10l3-3 3 3" />
              <path d="M13 7h7" />
              <path d="M13 12h5" />
              <path d="M13 17h3" />
            </svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7v10" />
              <path d="M4 14l3 3 3-3" />
              <path d="M13 7h3" />
              <path d="M13 12h5" />
              <path d="M13 17h7" />
            </svg>
          </button>
        </div>
      </div>
    </section>

    <section class="characters-grid">
      <component
        v-for="character in orderedCharacters"
        :key="character.id"
        :is="isHiddenCharacter(character) ? 'article' : 'RouterLink'"
        :to="isHiddenCharacter(character) ? undefined : { path: '/result', query: { character: character.id } }"
        class="character-card"
        :class="{ 'character-card--hidden': isHiddenCharacter(character) }"
        :style="{ '--accent-color': character.accent }"
        v-reveal
      >
        <div class="card-image-wrap">
          <img
            v-if="!isHiddenCharacter(character)"
            :src="character.thumb || character.image"
            :alt="getLocalizedCharacterName(character, locale)"
            class="card-image"
            loading="lazy"
            decoding="async"
            width="320"
            height="320"
          />
          <div v-else class="card-image-placeholder">{{ getLocalizedCharacterSeries(character, locale) }}</div>
        </div>
        <div class="card-content">
          <div class="card-tags">
            <span class="card-code">{{ character.code }}</span>
            <span class="card-mbti">{{ character.matchCode }}</span>
            <span v-if="character.personaBasis?.type === 'fandom-impression'" class="card-fandom-tag">{{ t('result.personaBasisBadge') }}</span>
          </div>
          <h2 class="card-name">{{ getLocalizedCharacterName(character, locale) }}</h2>
          <p class="card-source">{{ getLocalizedCharacterSeries(character, locale) }}</p>
          <p class="card-title">
            {{ isHiddenCharacter(character) ? getHiddenCharacterTitle(locale, character) : t('characters.' + character.id + '.title', undefined, character.title) }}
          </p>
        </div>
      </component>
    </section>
  </div>
</template>

<style scoped>
.page-stack--narrow {
  gap: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.hero-panel.compact {
  max-width: 1200px;
}

.stats-panel {
  padding: 0.6rem 1.25rem;
  background: var(--surface-color, #ffffff);
  border-radius: 999px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.95rem;
}

.hero-toolbar {
  width: 100%;
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.stats-panel,
.sort-panel {
  flex: 0 1 auto;
}

.sort-panel {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sort-dropdown {
  position: relative;
}

.sort-dropdown-trigger,
.sort-direction-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: auto;
  padding: 0.6rem 1.25rem;
  border-radius: 999px;
  background: var(--surface-color, #ffffff);
  border: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  color: #23313a;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.sort-dropdown-trigger:hover,
.sort-direction-btn:hover,
.sort-dropdown.is-open .sort-dropdown-trigger {
  box-shadow: 0 6px 16px rgba(24, 39, 51, 0.08);
  transform: translateY(-1px);
}

.sort-trigger-prefix {
  color: #6b7a84;
  font-size: 0.9rem;
  font-weight: 700;
  white-space: nowrap;
}

.sort-trigger-value {
  font-size: 0.95rem;
  font-weight: 800;
  color: #2c3c45;
}

.sort-dropdown-trigger .arrow {
  width: 8px;
  height: 8px;
  border-right: 2px solid #6b7a84;
  border-bottom: 2px solid #6b7a84;
  transform: rotate(45deg) translateY(-1px);
  transition: transform 0.2s ease;
}

.sort-dropdown.is-open .arrow {
  transform: rotate(-135deg) translateY(-1px);
}

.sort-dropdown-menu {
  position: absolute;
  top: calc(100% + 0.55rem);
  right: 0;
  min-width: 180px;
  margin: 0;
  padding: 0.4rem;
  list-style: none;
  border-radius: 18px;
  border: 1px solid #dbe5ea;
  background: #ffffff;
  box-shadow: 0 18px 40px rgba(27, 39, 48, 0.14);
  z-index: 10;
}

.sort-dropdown-menu li {
  padding: 0.72rem 0.9rem;
  border-radius: 12px;
  color: #4d5c66;
  font-weight: 700;
  line-height: 1.3;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.sort-dropdown-menu li:hover {
  background: #f4f8f6;
  color: #2c3c45;
}

.sort-dropdown-menu li.active {
  background: #e8f4ee;
  color: #2d7f5e;
}

.sort-direction-btn {
  min-width: 48px;
  padding-left: 1rem;
  padding-right: 1rem;
}

.sort-direction-btn svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.stat-count {
  font-weight: 700;
  color: #333;
}

.stat-divider {
  color: #ddd;
}

.stat-latest {
  color: #666;
}

.latest-link {
  color: var(--primary-color, #42b883);
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s;
}

.latest-link:hover {
  text-decoration: underline;
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.5rem;
  padding: 0.25rem 1.5rem 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.character-card {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  text-decoration: none;
  color: inherit;
  border: 2px solid transparent;
}

.character-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
  border-color: var(--accent-color, #42b883);
}

.character-card--hidden {
  cursor: default;
}

.character-card--hidden:hover {
  transform: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-color: transparent;
}

.card-image-wrap {
  width: 100%;
  aspect-ratio: 1;
  background-color: #f8f9fa;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
  position: relative;
  background: linear-gradient(to bottom, #f8f9fa, color-mix(in srgb, var(--accent-color, #e9ecef) 20%, transparent));
}

.card-image {
  width: 90%;
  height: 90%;
  object-fit: contain;
  object-position: bottom;
  transform-origin: bottom center;
  transition: transform 0.3s ease;
}

.card-image-placeholder {
  width: calc(100% - 28px);
  height: calc(100% - 28px);
  margin: 14px;
  border-radius: 8px;
  border: 1px dashed color-mix(in srgb, var(--accent-color, #42b883) 48%, white);
  background: color-mix(in srgb, var(--accent-color, #42b883) 10%, white);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 16px;
  color: #50606d;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.5;
}

.character-card:hover .card-image {
  transform: scale(1.05);
}

.character-card--hidden:hover .card-image {
  transform: none;
}

.card-content {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.card-code {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  font-weight: 800;
  font-size: 0.85rem;
  line-height: 1.2;
  color: var(--accent-color, #42b883);
  background: color-mix(in srgb, var(--accent-color, #42b883) 15%, transparent);
  padding: 0.2rem 0.6rem;
  border-radius: 100px;
  white-space: nowrap;
}

.card-mbti {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  font-weight: 700;
  font-size: 0.85rem;
  line-height: 1.2;
  color: #6c757d;
  background: #e9ecef;
  padding: 0.2rem 0.6rem;
  border-radius: 100px;
  white-space: nowrap;
}

.card-fandom-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  font-weight: 700;
  font-size: 0.75rem;
  line-height: 1.35;
  text-align: center;
  color: #8a6d1f;
  background: #fef3cd;
  border: 1px solid #f0e2b0;
  padding: 0.15rem 0.5rem;
  border-radius: 100px;
  max-width: 100%;
}

.card-name {
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0 0 0.25rem 0;
  color: #212529;
}

.card-source {
  font-size: 0.85rem;
  color: #6c757d;
  margin: 0 0 0.75rem 0;
  font-weight: 500;
}

.card-title {
  font-size: 0.9rem;
  color: #495057;
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 600px) {
  .hero-toolbar {
    align-items: stretch;
  }

  .stats-panel,
  .sort-panel {
    width: 100%;
  }

  .sort-panel {
    justify-content: center;
  }

  .sort-dropdown {
    flex: 1 1 auto;
  }

  .sort-dropdown-trigger {
    width: 100%;
    justify-content: space-between;
  }

  .sort-dropdown-menu {
    left: 0;
    right: 0;
    min-width: 0;
  }

  .characters-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      padding: 0.25rem 1rem 1rem;
  }
  
  .card-content {
    padding: 0.75rem;
  }
  
  .card-name {
    font-size: 1.1rem;
  }

  .card-tags {
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  
  .card-title {
    font-size: 0.8rem;
  }
}
</style>
