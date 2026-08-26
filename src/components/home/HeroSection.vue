<script setup lang="ts">
import { computed, ref } from 'vue'

import { useI18n } from '../../i18n'
import AppIcon from '../AppIcon.vue'

const { t } = useI18n()
const relayFeedback = ref('')

// 访问数文案内含 <strong> 高亮标记，这里拆成三段交给模板用真实元素重建，避免 v-html
const visitorCountParts = computed(() => {
  const raw = t('home.visitorCount')
  const match = raw.match(/^(.*?)<strong>(.*?)<\/strong>(.*)$/s)
  if (!match) {
    return { before: raw, value: '', after: '' }
  }
  return { before: match[1], value: match[2], after: match[3] }
})

async function copyQuizLink() {
  try {
    const link = new URL('/quiz', window.location.href).toString()
    await navigator.clipboard.writeText(link)
    relayFeedback.value = t('home.relayFeedback')
  } catch {
    relayFeedback.value = t('app.common.copyFail')
  }
}
</script>

<template>
  <section class="hero">
    <div class="container hero-inner">
      <h1 class="hero-title">{{ t('home.heroTitle') }}</h1>
      <p class="hero-subtitle">{{ t('home.heroSubtitle') }}</p>
      <div class="hero-actions">
        <RouterLink to="/quiz" class="hero-button">{{ t('home.start') }}</RouterLink>
        <a href="https://github.com/tianxingleo/ACGTI" target="_blank" rel="noopener noreferrer" class="hero-button hero-button-alt">
          <AppIcon name="github" style="width: 20px; height: 20px;" />
          {{ t('home.starProject') }}
        </a>
      </div>
      <div class="hero-relay">
        <p class="hero-relay-title">{{ t('home.relayTitle') }}</p>
        <p class="hero-relay-copy">{{ t('home.relayCopy') }}</p>
        <div class="hero-relay-visitor">
          <svg class="visitor-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
          <span>{{ visitorCountParts.before }}<strong v-if="visitorCountParts.value">{{ visitorCountParts.value }}</strong>{{ visitorCountParts.after }}</span>
        </div>
        <button class="hero-relay-button" type="button" @click="copyQuizLink">{{ t('home.relayButton') }}</button>
        <p v-if="relayFeedback" class="hero-relay-feedback">{{ relayFeedback }}</p>
      </div>
      <div class="hero-privacy" role="note">
        <p class="hero-privacy-copy">
          {{ t('home.privacyCopy') }}
        </p>
      </div>
    </div>

    <div class="hero-wave" aria-hidden="true"></div>
  </section>
</template>

<style scoped>
.container {
  width: min(1200px, calc(100% - 2rem));
  margin: 0 auto;
}

.hero {
  position: relative;
  padding: 5.5rem 0 5.5rem;
  background: #3f8e99;
  overflow: hidden;
}

.hero-inner {
  text-align: center;
  position: relative;
  z-index: 3;
  color: #fff;
}

.hero-title {
  margin: 0;
  font-size: clamp(2.2rem, 5.5vw, 3.5rem);
  line-height: 1.15;
  font-weight: 800;
}

.hero-subtitle {
  max-width: 680px;
  margin: 1.25rem auto 2rem;
  font-size: clamp(1rem, 2.1vw, 1.18rem);
  line-height: 1.7;
  color: #e6f0f1;
  font-weight: 500;
}

.hero-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  align-items: center;
  margin-top: 2rem;
  flex-wrap: wrap;
}

.hero-button {
  --hero-btn-bg: #33a474;
  --hero-btn-bg-hover: #2d9168;
  --hero-btn-fg: #fff;
  --hero-btn-border: #33a474;
  --hero-btn-shadow: rgba(38, 122, 87, 0.28);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 1.125rem;
  min-height: 56px;
  min-width: 196px;
  padding: 0 2.15rem;
  border-radius: 999px;
  background: var(--hero-btn-bg);
  color: var(--hero-btn-fg);
  font-weight: 700;
  letter-spacing: 0.01em;
  text-decoration: none;
  border: 1.5px solid var(--hero-btn-border);
  box-shadow: 0 10px 24px var(--hero-btn-shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.hero-button:hover {
  background: var(--hero-btn-bg-hover);
  box-shadow: 0 8px 20px var(--hero-btn-shadow);
}

.hero-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.34), 0 12px 30px var(--hero-btn-shadow);
}

.hero-button-alt {
  --hero-btn-bg: transparent;
  --hero-btn-bg-hover: rgba(255, 255, 255, 0.1);
  --hero-btn-fg: rgba(255, 255, 255, 0.95);
  --hero-btn-border: rgba(255, 255, 255, 0.35);
  --hero-btn-shadow: none;
}

.hero-button-alt:hover {
  border-color: rgba(255, 255, 255, 0.5);
}

.hero-relay {
  width: min(640px, 100%);
  margin: 1.75rem auto 0;
  padding: 1rem 1.25rem;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #dbe7e1;
  color: #2f3a45;
}

.hero-relay-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}

.hero-relay-copy {
  margin: 0.45rem 0 0;
  font-size: 0.94rem;
  line-height: 1.65;
  color: #5a6872;
}

.hero-relay-visitor {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 0.9rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #3f4b54;
  background: #f2f6f7;
  border: 1px solid #e3ecef;
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
}

.visitor-icon {
  width: 18px;
  height: 18px;
  opacity: 0.9;
}

.hero-relay-visitor strong {
  color: #2f3a45;
  font-size: 1rem;
  font-weight: 800;
  margin: 0 2px;
}

.hero-relay-button {
  margin-top: 1.2rem;
  min-height: 42px;
  padding: 0 1.2rem;
  border: 0;
  border-radius: 999px;
  background: #fff;
  color: #2f3a45;
  font-weight: 800;
  cursor: pointer;
}

.hero-relay-feedback {
  margin: 0.65rem 0 0;
  font-size: 0.88rem;
  font-weight: 700;
  opacity: 0.95;
}

.hero-privacy {
  width: min(720px, 100%);
  margin: 0.75rem auto 0;
  padding: 0.25rem 0;
  text-align: center;
}

.hero-privacy-copy {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.6;
  opacity: 0.78;
}

.hero-wave {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 36px;
  background: #fff;
  border-top: 1px solid #e8ecef;
  z-index: 2;
}

.hero-scene {
  display: none;
}

@media (max-width: 768px) {
  .hero {
    padding-top: 4.2rem;
    padding-bottom: 11.5rem;
  }

  .hero-scene {
    height: 170px;
  }

  .person::after {
    width: 28px;
    height: 48px;
    top: 28px;
  }

  .tree,
  .stone,
  .person-4 {
    display: none;
  }
}
</style>
