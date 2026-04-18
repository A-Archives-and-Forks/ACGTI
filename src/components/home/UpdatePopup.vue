<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { useI18n } from '../../i18n'

const { t } = useI18n()
const isPopupReady = ref(false)
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

  isPopupReady.value = true

  if (window.localStorage.getItem(HOME_UPDATE_DISMISS_KEY) === '1') {
    return
  }

  popupShowTimer = window.setTimeout(() => {
    showUpdatePopup.value = true
    popupHideTimer = window.setTimeout(() => {
      dismissUpdatePopup(false)
    }, UPDATE_POPUP_AUTO_HIDE_MS)
  }, UPDATE_POPUP_DELAY_MS)
})

onBeforeUnmount(() => {
  if (popupShowTimer) {
    clearTimeout(popupShowTimer)
  }

  if (popupHideTimer) {
    clearTimeout(popupHideTimer)
  }
})

function dismissUpdatePopup(rememberDismissal = true) {
  showUpdatePopup.value = false

  if (popupShowTimer) {
    clearTimeout(popupShowTimer)
    popupShowTimer = null
  }

  if (popupHideTimer) {
    clearTimeout(popupHideTimer)
    popupHideTimer = null
  }

  if (rememberDismissal && typeof window !== 'undefined') {
    window.localStorage.setItem(HOME_UPDATE_DISMISS_KEY, '1')
  }
}
</script>

<template>
  <Transition name="update-popup">
    <div v-if="isPopupReady && showUpdatePopup" class="update-popup-shell" role="presentation">
      <button class="update-popup-backdrop" type="button" tabindex="-1" aria-hidden="true" @click="dismissUpdatePopup(true)"></button>
      <aside class="update-popup" role="dialog" aria-modal="true" :aria-label="t('home.updateBadge.tag')">
        <button class="update-popup-close" type="button" :aria-label="t('home.updateBadge.dismiss')" @click="dismissUpdatePopup(true)">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
        <p class="update-popup-tag">{{ t('home.updateBadge.tag') }}</p>
        <p class="update-popup-title">{{ t('home.updateBadge.title') }}</p>
        <p class="update-popup-text">{{ t('home.updateBadge.text') }}</p>
        <RouterLink to="/quiz" class="update-popup-link" @click="dismissUpdatePopup(true)">
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
  top: 104px;
  right: 24px;
  width: 360px;
  max-width: calc(100% - 2rem);
  padding: 1rem 1rem 1.1rem;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(219, 226, 231, 0.92);
  box-shadow: 0 20px 48px rgba(23, 39, 49, 0.16);
  backdrop-filter: blur(14px);
  box-sizing: border-box;
}

.update-popup-tag {
  margin: 0;
  color: #d39f1d;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
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
  min-height: 42px;
  padding: 0 1rem;
  border-radius: 999px;
  background: #4899a3;
  color: #fff;
  font-size: 0.92rem;
  font-weight: 800;
  text-decoration: none;
  box-shadow: 0 12px 24px rgba(72, 153, 163, 0.22);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.update-popup-link:hover {
  background: #3f8891;
  transform: translateY(-1px);
  box-shadow: 0 16px 28px rgba(63, 136, 145, 0.24);
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
  width: 32px;
  height: 32px;
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
  transform: rotate(90deg);
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
