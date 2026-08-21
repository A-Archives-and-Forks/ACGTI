<script setup lang="ts">
import { ref } from 'vue'

import { useI18n } from '../../i18n'

const { t } = useI18n()
const relayFeedback = ref('')

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
          <svg class="hero-button-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          {{ t('home.starProject') }}
        </a>
      </div>
      <div class="hero-relay">
        <p class="hero-relay-title">{{ t('home.relayTitle') }}</p>
        <p class="hero-relay-copy">{{ t('home.relayCopy') }}</p>
        <div class="hero-relay-visitor">
          <svg class="visitor-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
          <span v-html="t('home.visitorCount')"></span>
        </div>
        <button class="hero-relay-button" type="button" @click="copyQuizLink">{{ t('home.relayButton') }}</button>
        <p v-if="relayFeedback" class="hero-relay-feedback">{{ relayFeedback }}</p>
      </div>
      <div class="hero-privacy" role="note">
        <p class="hero-privacy-copy">
          {{ t('home.privacyCopy') }}
          <a
            href="https://arkti.ybwlawa0.com/quiz"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('home.privacyLinkLabel') }}
          </a>
        </p>
      </div>
    </div>

    <div class="hero-wave"></div>

    <div class="hero-scene" aria-hidden="true">
      <div class="tree tree-1"></div>
      <div class="tree tree-2"></div>
      <div class="tree tree-3"></div>
      <div class="stone stone-1"></div>
      <div class="stone stone-2"></div>
      <div class="person person-1"></div>
      <div class="person person-2"></div>
      <div class="campfire"></div>
      <div class="person person-3"></div>
      <div class="person person-4"></div>
    </div>
  </section>
</template>

<style scoped>
.container {
  width: min(1200px, calc(100% - 2rem));
  margin: 0 auto;
}

.hero {
  position: relative;
  padding: 5.5rem 0 14rem;
  background: #4899a3;
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
  max-width: 760px;
  margin: 1.5rem auto 2.5rem;
  font-size: clamp(1rem, 2.2vw, 1.25rem);
  line-height: 1.7;
  color: #e3f2f3;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
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
  transform: translateY(-2px);
  box-shadow: 0 14px 30px var(--hero-btn-shadow);
}

.hero-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.34), 0 12px 30px var(--hero-btn-shadow);
}

.hero-button-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
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
  width: min(720px, 100%);
  margin: 1.5rem auto 0;
  padding: 1.1rem 1.25rem;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(6px);
}

.hero-relay-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}

.hero-relay-copy {
  margin: 0.45rem 0 0;
  font-size: 0.96rem;
  line-height: 1.7;
  opacity: 0.92;
}

.hero-relay-visitor {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 1rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
  background: rgba(0, 0, 0, 0.15);
  padding: 0.5rem 1rem;
  border-radius: 50px;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
}

.visitor-icon {
  width: 18px;
  height: 18px;
  opacity: 0.9;
}

.hero-relay-visitor :deep(strong) {
  color: #ffd700;
  font-size: 1.1rem;
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
  height: 160px;
  background: #fff;
  clip-path: polygon(0 35%, 12% 25%, 50% 58%, 82% 18%, 100% 32%, 100% 100%, 0 100%);
  z-index: 2;
}

.hero-scene {
  position: absolute;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  width: min(1180px, 92vw);
  height: 240px;
  z-index: 1;
}

.tree {
  position: absolute;
  bottom: 40px;
  width: 0;
  height: 0;
  border-left: 24px solid transparent;
  border-right: 24px solid transparent;
  border-bottom: 72px solid #4f9e6c;
}

.tree-1 { left: 12%; }
.tree-2 {
  left: 22%;
  border-left-width: 34px;
  border-right-width: 34px;
  border-bottom-width: 96px;
  border-bottom-color: #3b7a52;
}
.tree-3 {
  right: 14%;
  border-left-width: 36px;
  border-right-width: 36px;
  border-bottom-width: 104px;
}

.stone {
  position: absolute;
  bottom: 24px;
  background: #9fa6ad;
  border-radius: 16px 16px 8px 8px;
}

.stone-1 {
  left: 29%;
  width: 54px;
  height: 38px;
  transform: skewX(-12deg);
}

.stone-2 {
  right: 24%;
  width: 64px;
  height: 44px;
  transform: skewX(12deg);
}

.person {
  position: absolute;
  bottom: 34px;
  width: 26px;
  height: 26px;
  border-radius: 8px;
}

.person::after {
  content: "";
  position: absolute;
  top: 31px;
  left: 50%;
  transform: translateX(-50%);
  width: 38px;
  height: 64px;
  border-radius: 16px 16px 10px 10px;
  background: currentColor;
}

.person-1 {
  left: 33%;
  color: #68b6ce;
  background: #4298b4;
}

.person-2 {
  left: 42%;
  color: #5aa273;
  background: #d5dbe3;
}

.person-3 {
  left: 59%;
  color: #e1c152;
  background: #57616f;
}

.person-4 {
  left: 70%;
  color: #a683b5;
  background: #8a609d;
}

.campfire {
  position: absolute;
  left: 50%;
  bottom: 48px;
  transform: translateX(-50%);
  width: 40px;
  height: 56px;
  background: #f2c244;
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
}

.campfire::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -10px;
  transform: translateX(-50%);
  width: 58px;
  height: 10px;
  border-radius: 999px;
  background: #7e3c28;
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
