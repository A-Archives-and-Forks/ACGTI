<script setup lang="ts">
// AI 结果解读卡片：进入结果页自动请求 /api/insight，
// 首次加载失败（后端未绑定 Workers AI / 额度耗尽等）时整卡隐藏（渐进增强，不占版面）；
// 重生成失败则保留旧文案，仅在按钮旁给出轻提示。
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { useI18n } from '../i18n'
import { fetchAiInsight } from '../utils/insight'
import { DEFAULT_AI_ACCENT } from '../utils/themeDefaults'

const props = defineProps<{
  characterCode: string
  scores: { ei: number; sn: number; tf: number; jp: number }
  accent: string
}>()

const { locale, t } = useI18n()

type Phase = 'loading' | 'streaming' | 'done' | 'hidden'
const phase = ref<Phase>('loading')
const fullText = ref('')
const displayCount = ref(0)
const isCached = ref(false)
const isRegenerating = ref(false)
const limitReached = ref(false)

// 同一结果最多手动重试 3 次，保护免费额度
const REGENERATE_LIMIT = 3
const retryKey = computed(() => `acgti:ai-insight-retry:${props.characterCode}`)
const retryCount = ref(Number(sessionStorage.getItem(retryKey.value) ?? '0') || 0)
if (retryCount.value >= REGENERATE_LIMIT) {
  limitReached.value = true
}

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

let streamTimer: ReturnType<typeof setInterval> | null = null

// 请求序号守卫：语言/角色快速切换会并发发起请求，
// await 返回后序号不匹配说明已被更新的请求取代，本次结果直接丢弃
let loadSeq = 0

// 重生成失败的提示文案与自动清除计时器（几秒后消失，或随下次请求清除）
const regenError = ref('')
let regenErrorTimer: ReturnType<typeof setTimeout> | null = null

function showRegenError() {
  regenError.value = t('ai.regenerateFailed')
  if (regenErrorTimer) clearTimeout(regenErrorTimer)
  regenErrorTimer = setTimeout(() => {
    regenError.value = ''
    regenErrorTimer = null
  }, 4000)
}

function clearRegenError() {
  if (regenErrorTimer) {
    clearTimeout(regenErrorTimer)
    regenErrorTimer = null
  }
  regenError.value = ''
}

function stopStream() {
  if (streamTimer) {
    clearInterval(streamTimer)
    streamTimer = null
  }
}

function playStream() {
  stopStream()
  if (prefersReducedMotion || !fullText.value) {
    displayCount.value = fullText.value.length
    phase.value = 'done'
    return
  }
  phase.value = 'streaming'
  displayCount.value = 0
  // 每 32ms 输出 1-2 个字符；约百字的解读在 2s 内播完
  streamTimer = setInterval(() => {
    displayCount.value = Math.min(fullText.value.length, displayCount.value + (Math.random() > 0.5 ? 2 : 1))
    if (displayCount.value >= fullText.value.length) {
      stopStream()
      phase.value = 'done'
    }
  }, 32)
}

onBeforeUnmount(() => {
  stopStream()
  clearRegenError()
})

async function load(fresh = false) {
  if (!props.characterCode) {
    phase.value = 'hidden'
    return
  }
  // 是否从未成功展示过文案，用于区分两种失败路径（见下方失败分支）
  const isFirstLoad = fullText.value === ''
  clearRegenError()
  stopStream()
  phase.value = 'loading'
  const seq = ++loadSeq
  const data = await fetchAiInsight(props.characterCode, props.scores, locale.value, fresh)
  // 旧请求已过期：丢弃结果，避免覆盖新角色/新语言请求回来的文案
  if (seq !== loadSeq) return
  if (!data?.available || !data.text) {
    // 两种失败路径的区别：
    // 1) 首次加载失败（从未展示过文案）：后端未绑定 AI / 额度耗尽 / 请求失败，
    //    整卡隐藏（渐进增强，不占版面）；
    // 2) 重生成失败（已有展示中的文案）：保留旧解读不清空，仅提示本次换一种说法失败。
    if (isFirstLoad) {
      phase.value = 'hidden'
      return
    }
    displayCount.value = fullText.value.length
    phase.value = 'done'
    showRegenError()
    return
  }
  fullText.value = data.text
  isCached.value = !!data.cached
  playStream()
}

function regenerate() {
  if (isRegenerating.value || limitReached.value || phase.value === 'hidden') return
  retryCount.value += 1
  sessionStorage.setItem(retryKey.value, String(retryCount.value))
  if (retryCount.value >= REGENERATE_LIMIT) {
    limitReached.value = true
  }
  isRegenerating.value = true
  load(true).finally(() => {
    isRegenerating.value = false
  })
}

// 语言切换 / 角色预览切换后重新请求（缓存键含语言，命中时开销极小）
watch(
  () => [props.characterCode, locale.value] as const,
  () => {
    load()
  },
)

load()

const displayText = computed(() => fullText.value.slice(0, displayCount.value))
const accentColor = computed(() => props.accent || DEFAULT_AI_ACCENT)
</script>

<template>
  <section v-if="phase !== 'hidden'" class="ai-insight-section" v-reveal :style="{ '--ai-accent': accentColor }">
    <div class="section-title-wrap">
      <div class="section-index">—</div>
      <h2 class="section-title">{{ t('result.aiInsight.title') }}</h2>
    </div>

    <div class="ai-insight-card">
      <div v-if="phase === 'loading'" class="ai-insight-skeleton" aria-live="polite">
        <span class="skeleton-line"></span>
        <span class="skeleton-line short"></span>
        <p class="ai-insight-loading-hint">{{ t('result.aiInsight.loading') }}</p>
      </div>

      <template v-else>
        <p class="ai-insight-text" aria-live="polite">{{ displayText }}<span v-if="phase === 'streaming'" class="ai-caret">▍</span></p>

        <div class="ai-insight-footer">
          <p class="ai-insight-privacy">{{ t('result.aiInsight.privacy') }}</p>
          <div class="ai-insight-actions">
            <span v-if="isCached" class="ai-insight-cached-badge">{{ t('result.aiInsight.cachedBadge') }}</span>
            <span v-if="limitReached" class="ai-insight-limit-hint">{{ t('result.aiInsight.limitReached') }}</span>
            <button
              v-else
              class="ai-insight-regen-btn"
              type="button"
              :disabled="isRegenerating || phase === 'streaming'"
              @click="regenerate"
            >
              {{ isRegenerating ? t('result.aiInsight.regenerating') : t('result.aiInsight.regenerate') }}
            </button>
            <!-- 重生成失败提示：保留旧解读，仅在此处提示，几秒后自动消失 -->
            <span v-if="regenError" class="ai-insight-regen-error" role="alert">{{ regenError }}</span>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.ai-insight-section {
  margin-top: 32px;
  margin-bottom: 32px;
}

.ai-insight-card {
  position: relative;
  border: 1px solid #e3e8ee;
  border-left: 3px solid var(--ai-accent, #33a474);
  border-radius: 10px;
  padding: 18px 20px 16px;
  background: #ffffff;
}

.ai-insight-skeleton {
  display: grid;
  gap: 10px;
}

.skeleton-line {
  height: 12px;
  border-radius: 6px;
  background: #edf1f5;
}

.skeleton-line.short {
  width: 62%;
}

.ai-insight-loading-hint {
  margin: 4px 0 0;
  font-size: 13px;
  color: #8a97a6;
}

.ai-insight-text {
  margin: 0;
  font-size: 15px;
  line-height: 1.75;
  color: #2f3a45;
  min-height: 3.2em;
}

.ai-caret {
  display: inline-block;
  margin-left: 2px;
  color: var(--ai-accent, #33a474);
  animation: caret-blink 0.9s step-end infinite;
}

@keyframes caret-blink {
  50% { opacity: 0; }
}

.ai-insight-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #e3e8ee;
}

.ai-insight-privacy {
  margin: 0;
  flex: 1 1 320px;
  font-size: 12px;
  line-height: 1.6;
  color: #9aa6b4;
}

.ai-insight-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-insight-cached-badge {
  font-size: 12px;
  color: #8a97a6;
  background: #f1f5f9;
  border-radius: 999px;
  padding: 3px 10px;
}

.ai-insight-limit-hint {
  font-size: 12px;
  color: #b0bac6;
}

.ai-insight-regen-btn {
  border: 1px solid color-mix(in srgb, var(--ai-accent, #33a474) 45%, #e3e8ee);
  background: #ffffff;
  color: var(--ai-accent, #33a474);
  font-size: 13px;
  font-weight: 600;
  border-radius: 999px;
  padding: 7px 16px;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}

.ai-insight-regen-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ai-accent, #33a474) 10%, #ffffff);
}

.ai-insight-regen-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.ai-insight-regen-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

/* 重生成失败提示：与缓存徽标同规格的小字提示，融入 footer 操作区 */
.ai-insight-regen-error {
  font-size: 12px;
  color: #e26666;
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-line,
  .ai-caret {
    animation: none;
  }
}
</style>
