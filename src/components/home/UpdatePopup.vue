<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { useI18n } from '../../i18n'

const { t } = useI18n()
const showUpdatePopup = ref(false)

const HOME_UPDATE_DISMISS_KEY = 'acgti:home-update-2026-04-18-popup-v4-dismissed'
const UPDATE_POPUP_DELAY_MS = 3000
const UPDATE_POPUP_AUTO_HIDE_MS = 5200

let popupShowTimer: ReturnType<typeof setTimeout> | null = null
let popupHideTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  if (typeof window === 'undefined') {
    return
  }

  if (window.localStorage.getItem(HOME_UPDATE_DISMISS_KEY) === '1') {
    return
  }

  popupShowTimer = window.setTimeout(() => {
    showUpdatePopup.value = true
    // 非模态通知（role="status"）：不抢焦点，读屏用户通过区域播报感知
    popupHideTimer = window.setTimeout(() => {
      dismissUpdatePopup()
    }, UPDATE_POPUP_AUTO_HIDE_MS)
  }, UPDATE_POPUP_DELAY_MS)

  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  if (popupShowTimer) {
    clearTimeout(popupShowTimer)
  }

  if (popupHideTimer) {
    clearTimeout(popupHideTimer)
  }

  window.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && showUpdatePopup.value) {
    dismissUpdatePopup()
  }
}

// 关闭（手动或自动超时）一律视为「已看过」，下次访问不再弹出
function dismissUpdatePopup() {
  showUpdatePopup.value = false

  if (popupShowTimer) {
    clearTimeout(popupShowTimer)
    popupShowTimer = null
  }

  if (popupHideTimer) {
    clearTimeout(popupHideTimer)
    popupHideTimer = null
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(HOME_UPDATE_DISMISS_KEY, '1')
  }
}
</script>

<template>
  <Transition name="update-popup">
    <div v-if="showUpdatePopup" class="update-popup-shell" role="presentation">
      <button class="update-popup-backdrop" type="button" tabindex="-1" aria-hidden="true" @click="dismissUpdatePopup"></button>
      <aside class="update-popup" role="status" :aria-label="t('home.updateBadge.tag')">
        <button class="update-popup-close" type="button" :aria-label="t('home.updateBadge.dismiss')" @click="dismissUpdatePopup">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
        <p class="update-popup-tag">{{ t('home.updateBadge.tag') }}</p>
        <p class="update-popup-title">{{ t('home.updateBadge.title') }}</p>
        <p class="update-popup-text">{{ t('home.updateBadge.text') }}</p>
        <RouterLink to="/quiz" class="update-popup-link" @click="dismissUpdatePopup">
          {{ t('home.updateBadge.link') }}
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </RouterLink>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.update-popup-shell {
  position: fixed;
  inset: 0;
  z-index: 60;
}

.update-popup-backdrop {
  appearance: none;
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  outline: none;
  box-shadow: none;
  background: rgba(24, 33, 41, 0.12);
  cursor: pointer;
  transform: none;
  transition: opacity 0.24s ease;
}

.update-popup-backdrop:hover,
.update-popup-backdrop:active,
.update-popup-backdrop:focus,
.update-popup-backdrop:focus-visible {
  background: rgba(24, 33, 41, 0.12);
  box-shadow: none;
  outline: none;
  transform: none;
}

.update-popup {
  position: absolute;
  top: 88px;
  right: 20px;
  width: 340px;
  max-width: calc(100% - 2rem);
  padding: 1rem 1rem 1rem;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid #dbe2e7;
  box-shadow: 0 8px 24px rgba(23, 39, 49, 0.08);
  box-sizing: border-box;
}

.update-popup-tag {
  margin: 0;
  color: #6b7a86;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.update-popup-title {
  margin: 0.45rem 0 0;
  color: #23313a;
  font-size: 1.15rem;
  font-weight: 800;
  line-height: 1.3;
}

.update-popup-text {
  margin: 0.65rem 0 0;
  color: #5b6973;
  font-size: 0.95rem;
  line-height: 1.65;
}

.update-popup-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 1rem;
  min-height: 38px;
  padding: 0 0.9rem;
  border-radius: 999px;
  background: #3ba17c;
  color: #fff;
  font-size: 0.88rem;
  font-weight: 700;
  text-decoration: none;
  border: 1px solid #2d9168;
  transition: background 0.2s ease;
}

.update-popup-link:hover {
  background: #2d9168;
}

.update-popup-link svg,
.update-popup-close svg {
  width: 16px;
  height: 16px;
}

.update-popup-link svg {
  transition: transform 0.2s ease;
}

.update-popup-link:hover svg {
  transform: translateX(3px);
}

.update-popup-close {
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #f3f6f8;
  color: #6f7d88;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.update-popup-close:hover {
  background: #e7edf1;
  color: #394854;
}

.update-popup-enter-active,
.update-popup-leave-active {
  transition: opacity 0.24s ease;
}

.update-popup-enter-from,
.update-popup-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .update-popup {
    top: auto;
    right: 1rem;
    bottom: 1rem;
    left: 1rem;
    width: auto;
    border-radius: 20px;
  }
}
</style>
