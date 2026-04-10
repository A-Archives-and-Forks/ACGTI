<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import SharePoster from '../components/SharePoster.vue'
import { useShare } from '../composables/useShare'
import { useQuiz } from '../composables/useQuiz'

const router = useRouter()
const quiz = useQuiz()
const result = computed(() => quiz.latestResult.value)
const posterRef = ref<{ rootEl: HTMLElement | null } | null>(null)
const isCharacterImageBroken = ref(false)
const share = useShare()

onMounted(() => {
  quiz.resumeLastResult()

  if (!quiz.latestResult.value) {
    void router.replace('/quiz')
  }
})

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

const primaryCharacterImage = computed(() => {
  const primary = result.value?.characterMatches?.[0]
  if (!primary) return ''
  return primary.image || `/images/characters/${primary.id}.png`
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
  { id: 'J_P', leftCode: 'J', leftLabel: '判断', rightCode: 'P', rightLabel: '感知', color: '#88619A' }
]

function getHandlePosition(traitId: TraitDimension, leftCode: string) {
  if (!result.value) return 50
  
  const score = result.value.scores[traitId]
  const percent = score.percentage
  
  if (score.dominant === leftCode) {
    return 50 - (percent - 50)
  } else {
    return 50 + (percent - 50)
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex justify-center py-6 px-4 md:py-12" v-if="result">
    <div class="max-w-6xl w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
      
      <!-- Sidebar / Hero -->
      <div 
        class="md:w-1/3 p-8 md:p-10 text-white flex flex-col items-center text-center relative"
        :style="{ backgroundColor: result.archetype.accent || '#8CA260' }"
      >
        <h2 class="text-sm tracking-widest uppercase mb-2 font-bold opacity-90">{{ result.mbtiCode }} · {{ result.archetype.name }}</h2>
        <h1 class="text-4xl font-black mb-3">{{ result.characterMatches[0]?.name || result.archetype.name }}</h1>
        <p class="text-lg font-bold opacity-90 mb-6 bg-black/10 px-4 py-1.5 rounded-full backdrop-blur-sm">{{ result.characterMatches[0]?.title || result.archetype.subtitle }}</p>
        
        <div class="w-48 h-48 md:w-56 md:h-56 mb-8 relative flex items-center justify-center">
          <img 
            v-if="result.characterMatches[0]?.id && !isCharacterImageBroken" 
            :src="primaryCharacterImage" 
            alt="Character" 
            class="w-full h-full object-contain relative z-10 drop-shadow-xl" 
            @error="hideBrokenImage" 
          />
          <i v-else class="fa-solid fa-user-astronaut text-8xl opacity-80 z-10"></i>
        </div>
        
        <p class="text-lg italic opacity-90 mb-10 leading-relaxed font-medium">"{{ result.archetype.oneLiner }}"</p>
        
        <div class="flex flex-col w-full gap-4 mt-auto">
          <button 
            @click="copyText" 
            class="w-full py-3.5 px-6 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl transition-colors backdrop-blur-sm flex items-center justify-center gap-2"
          >
            <i class="fa-solid fa-copy"></i>
            复原文案
          </button>
          
          <button 
            @click="exportPoster" 
            :disabled="share.isExporting.value"
            class="w-full py-3.5 px-6 bg-white text-gray-800 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <i class="fa-solid fa-download" v-if="!share.isExporting.value"></i>
            <i class="fa-solid fa-spinner fa-spin" v-else></i>
            {{ share.isExporting.value ? '导出中...' : '导出海报' }}
          </button>
          
          <button 
            @click="retry" 
            class="w-full py-3.5 px-6 bg-transparent border-2 border-white/30 hover:bg-white/10 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <i class="fa-solid fa-rotate-right"></i>
            再测一次
          </button>

          <p v-if="share.feedback.value" class="text-sm font-bold text-white/90 mt-2">{{ share.feedback.value }}</p>
        </div>
      </div>
      
      <!-- Content / Data Visualization -->
      <div class="md:w-2/3 p-8 lg:p-12">
        <h3 class="text-2xl font-black text-gray-800 mb-8 flex items-center border-b-2 border-gray-100 pb-4">
          <i class="fa-solid fa-chart-pie mr-3 text-gray-400"></i>你的特质倾向
        </h3>
        
        <!-- Interactive Trait Sliders -->
        <div class="space-y-10 mb-12">
          <div v-for="trait in traits" :key="trait.id" class="w-full">
            
            <div class="flex justify-between items-end mb-3">
              <!-- Left trait info -->
              <div 
                class="flex flex-col items-start"
                :class="{ 'opacity-100 font-bold': result.scores[trait.id].dominant === trait.leftCode, 'opacity-40': result.scores[trait.id].dominant !== trait.leftCode }"
                :style="{ color: result.scores[trait.id].dominant === trait.leftCode ? trait.color : '#4b5563' }"
              >
                <span class="text-2xl">{{ result.scores[trait.id].dominant === trait.leftCode ? result.scores[trait.id].percentage + '%' : '' }}</span>
                <span class="text-base uppercase">{{ trait.leftLabel }} ({{ trait.leftCode }})</span>
              </div>
              
              <!-- Right trait info -->
              <div 
                class="flex flex-col items-end"
                :class="{ 'opacity-100 font-bold': result.scores[trait.id].dominant === trait.rightCode, 'opacity-40': result.scores[trait.id].dominant !== trait.rightCode }"
                :style="{ color: result.scores[trait.id].dominant === trait.rightCode ? trait.color : '#4b5563' }"
              >
                <span class="text-2xl">{{ result.scores[trait.id].dominant === trait.rightCode ? result.scores[trait.id].percentage + '%' : '' }}</span>
                <span class="text-base uppercase">{{ trait.rightLabel }} ({{ trait.rightCode }})</span>
              </div>
            </div>

            <!-- Slider bar -->
            <div class="relative h-4 bg-gray-200 rounded-full flex items-center">
              <!-- Colored active tract -->
              <div 
                class="absolute h-full rounded-full transition-all duration-1000 ease-out"
                :style="{ 
                  width: result.scores[trait.id].dominant === trait.leftCode ? `${getHandlePosition(trait.id, trait.leftCode)}%` : `${100 - getHandlePosition(trait.id, trait.leftCode)}%`,
                  left: result.scores[trait.id].dominant === trait.leftCode ? '0' : 'auto',
                  right: result.scores[trait.id].dominant === trait.rightCode ? '0' : 'auto',
                  backgroundColor: trait.color 
                }"
              ></div>
              
              <!-- Center Divider -->
              <div class="absolute left-1/2 top-0 bottom-0 w-1 -ml-[2px] bg-white z-10"></div>
              
              <!-- Handle Indicator (React style positioning) -->
              <div 
                class="absolute w-8 h-8 bg-white border-4 rounded-full shadow-md z-20 flex items-center justify-center transition-all duration-1000 ease-out -ml-4"
                :style="{ 
                  left: `${getHandlePosition(trait.id, trait.leftCode)}%`,
                  borderColor: trait.color
                }"
              >
                <div class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: trait.color }"></div>
              </div>
            </div>

          </div>
        </div>

        <!-- Character Analysis -->
        <div v-if="result.characterMatches[0]" class="mb-12">
          <h3 class="text-2xl font-black text-gray-800 mb-6 flex items-center border-b-2 border-gray-100 pb-4">
            <i class="fa-solid fa-user-ninja mr-3 text-gray-400"></i>二次元映射
          </h3>
          <p class="mb-4 text-sm font-semibold tracking-wide text-gray-500 uppercase">
            MBTI 类型：{{ result.mbtiCode }} · 最多展示 5 位相近角色
          </p>
          <div class="flex flex-wrap gap-2 mb-6">
            <span v-for="tag in result.characterMatches[0].tags" :key="tag" class="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-bold border border-gray-200">
              # {{ tag }}
            </span>
          </div>
          <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100 relative">
            <i class="fa-solid fa-quote-left absolute top-5 left-5 text-gray-200 text-3xl"></i>
            <p class="text-gray-700 text-lg leading-relaxed relative z-10 pl-8 pt-2">
              {{ result.characterMatches[0].note }}
            </p>
          </div>
        </div>

        <!-- Result Description -->
        <h3 class="text-2xl font-black text-gray-800 mb-6 flex items-center border-b-2 border-gray-100 pb-4">
          <i class="fa-solid fa-book-open mr-3 text-gray-400"></i>原型解析 · {{ result.archetype.name }}
        </h3>
        <p class="text-gray-600 text-lg leading-relaxed mb-8">
          {{ result.archetype.description }}
        </p>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100 transition-colors hover:border-[#8ca260]">
            <h4 class="font-bold text-gray-800 mb-3 flex items-center text-lg">
              <i class="fa-solid fa-star text-[#8ca260] mr-2"></i>亮点表现
            </h4>
            <p class="text-gray-600 leading-relaxed">{{ result.archetype.spotlight }}</p>
          </div>
          <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100 transition-colors hover:border-red-400">
            <h4 class="font-bold text-gray-800 mb-3 flex items-center text-lg">
              <i class="fa-solid fa-triangle-exclamation text-red-400 mr-2"></i>短板分析
            </h4>
            <p class="text-gray-600 leading-relaxed">{{ result.archetype.weakness }}</p>
          </div>
        </div>
        
        <div class="hidden">
          <SharePoster ref="posterRef" :result="result" />
        </div>

      </div>
      
    </div>
  </div>
</template>

<style scoped>
</style>
