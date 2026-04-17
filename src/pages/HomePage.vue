<template>
  <div class="home">
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

    <section class="stats" v-reveal>
      <div class="container stat-grid">
        <div v-for="item in stats" :key="item.label" class="stat-item">
          <p class="stat-value" :style="{ color: item.color }">{{ item.value }}</p>
          <p class="stat-label">{{ item.label }}</p>
        </div>
      </div>
    </section>

    <section v-if="homeAdSlot" class="ad-section">
      <div class="container">
        <AdsenseSlot :slot="homeAdSlot" :label="t('app.common.sponsored')" />
      </div>
    </section>

    <section class="featured-stream" v-reveal>
      <div class="container featured-stream-layout">
        <article class="featured-stream-copy">
          <p class="feature-tag featured-stream-tag">{{ t('home.socialProof.tag') }}</p>
          <h2 class="feature-title featured-stream-title">{{ t('home.socialProof.title') }}</h2>
          <p class="feature-copy featured-stream-body">{{ t('home.socialProof.copy') }}</p>
          <div class="featured-stream-meta">
            <span class="featured-stream-pill">{{ t('home.socialProof.pillA') }}</span>
            <span class="featured-stream-pill">{{ t('home.socialProof.pillB') }}</span>
          </div>
          <a
            href="https://www.bilibili.com/video/BV11FDyBZEN1/?spm_id_from=333.337.search-card.all.click"
            target="_blank"
            rel="noopener noreferrer"
            class="btn featured-stream-button"
          >
            <svg style="width: 20px; height: 20px;" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
            {{ t('home.socialProof.button') }}
          </a>
        </article>
        <aside class="featured-stream-visual" aria-hidden="true">
          <div class="featured-stream-card">
            <div class="featured-stream-card-top">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <img
              class="featured-stream-image"
              src="/images/characters/永雏塔菲.webp"
              :alt="t('home.socialProof.imageAlt')"
              decoding="async"
              fetchpriority="high"
            />
          </div>
        </aside>
      </div>
    </section>

    <section class="feature feature-light" v-reveal>
      <div class="container feature-layout">
        <article>
          <p class="feature-tag tag-green">Personality Types</p>
          <h2 class="feature-title">{{ t('home.featureA.title') }}</h2>
          <p class="feature-copy">{{ t('home.featureA.copy') }}</p>
          <div class="feature-actions">
            <RouterLink to="/about" class="btn btn-green">{{ t('home.featureA.button') }}</RouterLink>
            <RouterLink to="/about" class="link-green">{{ t('home.featureA.link') }}</RouterLink>
          </div>
        </article>
        <aside class="feature-illustration office-1" aria-hidden="true">
          <div class="window"></div>
          <div class="window"></div>
          <div class="figure a"></div>
          <div class="figure b"></div>
          <div class="figure c"></div>
          <div class="desk"></div>
        </aside>
      </div>
    </section>

    <section class="feature feature-alt" v-reveal>
      <div class="container feature-layout reverse">
        <aside class="feature-illustration office-2" aria-hidden="true">
          <div class="figure d"></div>
          <div class="figure e"></div>
          <div class="figure f"></div>
          <div class="desk"></div>
        </aside>
        <article>
          <p class="feature-tag tag-blue">Results</p>
          <h2 class="feature-title">{{ t('home.featureB.title') }}</h2>
          <p class="feature-copy">{{ t('home.featureB.copy') }}</p>
          <RouterLink to="/quiz" class="btn btn-blue">{{ t('home.featureB.button') }}</RouterLink>
        </article>
      </div>
    </section>

    <section class="testimonials" v-reveal>
      <div class="quote-badge">“</div>
      <div class="container">
        <p class="testimonial-tag">Testimonials</p>
        <h2 class="testimonial-title">{{ t('home.testimonialsTitle') }}</h2>

        <div class="testimonial-track">
          <article v-for="item in testimonials" :key="item.name" class="testimonial-card">
            <div class="card-top" :style="{ backgroundColor: item.color }"></div>
            <div class="card-body">
              <div class="profile-row">
                <div class="avatar" :style="{ background: item.avatar }"></div>
                <div>
                  <h3>{{ item.name }}</h3>
                  <p :style="{ color: item.color }">{{ item.role }} ({{ item.type }})</p>
                </div>
              </div>
              <p class="quote">{{ item.quote }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- GitHub Star Call to Action -->
    <section class="feature feature-light text-center" style="padding-top: 5rem; padding-bottom: 5rem;">
      <div class="container">
        <h2 class="feature-title" style="margin-bottom: 1rem;">{{ t('home.ossTitle') }}</h2>
        <p class="feature-copy" style="max-width: 600px; margin: 0 auto 2.5rem;">{{ t('home.ossCopy') }}</p>
        <a href="https://github.com/tianxingleo/ACGTI" target="_blank" rel="noopener noreferrer" class="btn btn-green" style="display: inline-flex; justify-content: center; align-items: center; gap: 0.5rem; max-width: 250px; margin: 0 auto;">
          <svg style="width: 1.25rem; height: 1.25rem;" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          {{ t('home.ossButton') }}
        </a>
        <p class="feature-copy" style="max-width: 600px; margin: 1rem auto 0; font-size: 0.95rem; color: #6b7680;">
          {{ t('home.ossHint') }}
          <a href="https://github.com/tianxingleo/ACGTI/issues" target="_blank" rel="noopener noreferrer" style="color: #3ba17c; font-weight: 700; text-decoration: none;">{{ t('home.ossIssue') }}</a>
        </p>
      </div>
    </section>

    <section class="cta">
      <div class="cta-top-wave"></div>
      <div class="container cta-inner">
        <h2>{{ t('home.ctaTitle') }}</h2>
        <RouterLink to="/quiz" class="hero-button">{{ t('home.ctaButton') }}</RouterLink>
      </div>
      <div class="cta-bottom-wave"></div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import AdsenseSlot from '../components/AdsenseSlot.vue'
import { useI18n } from '../i18n'

const homeAdSlot = String(import.meta.env.VITE_ADSENSE_SLOT_HOME ?? '').trim()
const { t, tm } = useI18n()
const relayFeedback = ref('')
const isPopupReady = ref(false)
const showUpdatePopup = ref(false)

const HOME_UPDATE_DISMISS_KEY = 'acgti:home-update-2026-04-17-popup-v3-dismissed'
const UPDATE_POPUP_DELAY_MS = 500
const UPDATE_POPUP_AUTO_HIDE_MS = 5200

let popupShowTimer: ReturnType<typeof setTimeout> | null = null
let popupHideTimer: ReturnType<typeof setTimeout> | null = null

const stats = computed(() => tm<Array<{ value: string; label: string; color: string }>>('home.stats'))

const testimonialBase = [
  {
    name: "Benny",
    role: "ARCHITECT",
    type: "INTJ",
    color: "#8a609d",
    avatar: "linear-gradient(135deg, #f7b2b2 0%, #f3d3d3 100%)",
    quote: "结果非常细，像拿着镜子把我的习惯和思考方式都照了出来。",
  },
  {
    name: "Nicole",
    role: "ADVOCATE",
    type: "INFJ",
    color: "#3ba17c",
    avatar: "linear-gradient(135deg, #b8d7ff 0%, #d6e6ff 100%)",
    quote: "终于有一个结果把我解释清楚了，不再觉得自己和别人不一样。",
  },
  {
    name: "Caroline",
    role: "DEFENDER",
    type: "ISFJ",
    color: "#4298b4",
    avatar: "linear-gradient(135deg, #bdebc9 0%, #dff5e6 100%)",
    quote: "优势和盲点写得很准确，尤其是关系与工作场景建议，实用度很高。",
  },
  {
    name: "Marta",
    role: "COMMANDER",
    type: "ENTJ",
    color: "#8a609d",
    avatar: "linear-gradient(135deg, #ffe6a8 0%, #fff1cb 100%)",
  },
]

const testimonials = computed(() =>
  testimonialBase.map((item, index) => ({
    ...item,
    quote: tm<string[]>('home.testimonials')[index] ?? '',
  })),
)

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

async function copyQuizLink() {
  try {
    const link = new URL('/quiz', window.location.href).toString()
    await navigator.clipboard.writeText(link)
    relayFeedback.value = t('home.relayFeedback')
  } catch {
    relayFeedback.value = t('app.common.copyFail')
  }
}

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

<style scoped>
.home {
  background: #fff;
  color: #333;
}

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
  --hero-btn-bg: #9474a4;
  --hero-btn-bg-hover: #836592;
  --hero-btn-fg: #fff;
  --hero-btn-border: #9474a4;
  --hero-btn-shadow: rgba(89, 58, 104, 0.28);
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

.stats {
  padding: 4.5rem 0;
}

.ad-section {
  padding: 0 0 3rem;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  text-align: center;
}

.stat-value {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1;
  font-weight: 800;
}

.stat-label {
  margin: 0.7rem 0 0;
  font-size: 0.95rem;
  font-weight: 500;
  color: #666;
}

.feature {
  position: relative;
  padding: 5.5rem 0;
  overflow: hidden;
}

.featured-stream {
  padding: 0 0 4.5rem;
}

.featured-stream-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
  gap: 2rem;
  align-items: center;
  padding: 2rem;
  border-radius: 28px;
  background: linear-gradient(135deg, #fff8e7 0%, #fff 48%, #f4faf8 100%);
  border: 1px solid #f0e3bb;
  box-shadow: 0 18px 48px rgba(58, 72, 84, 0.08);
}

.featured-stream-tag {
  color: #d39f1d;
}

.featured-stream-title {
  font-size: clamp(1.8rem, 4vw, 2.5rem);
}

.featured-stream-body {
  margin-bottom: 1.2rem;
}

.featured-stream-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.featured-stream-pill {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 0.95rem;
  border-radius: 999px;
  background: rgba(211, 159, 29, 0.12);
  color: #946c12;
  font-size: 0.9rem;
  font-weight: 700;
}

.featured-stream-button {
  gap: 0.55rem;
  background: #e1ab2f;
  box-shadow: 0 12px 26px rgba(161, 117, 16, 0.2);
}

.featured-stream-visual {
  display: flex;
  justify-content: center;
}

.featured-stream-card {
  width: min(100%, 380px);
  border-radius: 24px;
  overflow: hidden;
  background: linear-gradient(180deg, #fff7df 0%, #fff 100%);
  border: 1px solid #f0e1b2;
  box-shadow: 0 18px 44px rgba(90, 66, 16, 0.12);
}

.featured-stream-card-top {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 1rem 0;
}

.featured-stream-card-top span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #e6c76e;
}

.featured-stream-image {
  display: block;
  width: 100%;
  height: 420px;
  object-fit: contain;
  padding: 1rem;
}

.feature::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(170deg, #f7f8f9 0%, #fff 55%);
  z-index: 0;
}

.feature-alt::before {
  background: linear-gradient(192deg, #f7f8f9 0%, #fff 58%);
}

.feature-layout {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3.5rem;
  align-items: center;
}

.reverse {
  grid-template-columns: 1fr 1fr;
}

.feature-tag {
  margin: 0 0 1rem;
  font-size: 0.78rem;
  letter-spacing: 0.13em;
  font-weight: 800;
  text-transform: uppercase;
}

.tag-green { color: #3ba17c; }
.tag-blue { color: #4298b4; }

.feature-title {
  margin: 0;
  font-size: clamp(2rem, 4.5vw, 2.7rem);
  line-height: 1.2;
}

.feature-copy {
  margin: 1.3rem 0 1.8rem;
  color: #666;
  font-size: 1.125rem;
  line-height: 1.75;
}

.feature-actions {
  display: flex;
  gap: 1.1rem;
  flex-wrap: wrap;
  align-items: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 50px;
  border-radius: 999px;
  padding: 0 1.6rem;
  color: #fff;
  font-weight: 700;
}

.btn-green { background: #3ba17c; }
.btn-blue { background: #4298b4; }
.link-green {
  color: #3ba17c;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.85rem;
}

.feature-illustration {
  height: 390px;
  border-radius: 18px;
  border: 1px solid #e7ebee;
  background: #fff;
  box-shadow: 0 20px 50px rgba(20, 33, 45, 0.08);
  position: relative;
  overflow: hidden;
}

.feature-illustration::before {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(246, 248, 249, 0.8);
  clip-path: polygon(0 0, 100% 6%, 100% 96%, 0 100%);
}

.office-1 .window {
  position: absolute;
  top: 42px;
  width: 36%;
  height: 96px;
  background: #d7e7ef;
  border-radius: 8px;
}

.office-1 .window:first-child { left: 8%; }
.office-1 .window:last-child { right: 8%; }

.figure {
  position: absolute;
  bottom: 52px;
  width: 58px;
  border-radius: 12px 12px 6px 6px;
}

.office-1 .a {
  left: 24%;
  height: 170px;
  background: #5aa273;
}

.office-1 .b {
  left: 44%;
  height: 136px;
  background: #8a609d;
}

.office-1 .c {
  left: 63%;
  height: 154px;
  background: #68b6ce;
}

.office-2 .d {
  left: 26%;
  height: 132px;
  background: #8a609d;
}

.office-2 .e {
  left: 48%;
  height: 176px;
  background: #5aa273;
}

.office-2 .f {
  left: 68%;
  height: 156px;
  background: #e5b540;
}

.desk {
  position: absolute;
  bottom: 26px;
  left: 10%;
  width: 80%;
  height: 16px;
  border-radius: 8px;
  background: #51575f;
}

.testimonials {
  padding: 5.5rem 0;
  position: relative;
}

.quote-badge {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%) rotate(12deg);
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #e5b540;
  color: #fff;
  font-size: 3rem;
  font-family: Georgia, serif;
  line-height: 1.3;
  text-align: center;
  box-shadow: 0 10px 24px rgba(131, 96, 17, 0.28);
}

.testimonial-tag {
  text-align: center;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #e5b540;
  font-weight: 800;
  font-size: 0.75rem;
  margin: 1.6rem 0 0;
}

.testimonial-title {
  text-align: center;
  margin: 0.6rem 0 2.6rem;
  font-size: clamp(1.9rem, 4.5vw, 2.8rem);
}

.testimonial-track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(280px, 360px);
  gap: 1.2rem;
  overflow-x: auto;
  padding: 0.4rem 0.2rem 1.2rem;
  scroll-snap-type: x mandatory;
}

.testimonial-card {
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(32, 38, 46, 0.1);
  overflow: hidden;
  scroll-snap-align: center;
}

.card-top {
  height: 6px;
}

.card-body {
  padding: 1.4rem;
}

.profile-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.avatar {
  width: 52px;
  height: 52px;
  border-radius: 999px;
}

.profile-row h3 {
  margin: 0;
  font-size: 1.05rem;
}

.profile-row p {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  font-weight: 700;
}

.quote {
  margin: 1rem 0 0;
  color: #555;
  line-height: 1.7;
  font-size: 0.95rem;
}

.cta {
  margin-top: 1rem;
  position: relative;
  background: #46a27e;
  padding: 8rem 0;
  overflow: hidden;
}

.cta-top-wave,
.cta-bottom-wave {
  position: absolute;
  left: 0;
  right: 0;
  height: 84px;
  background: #fff;
}

.cta-top-wave {
  top: 0;
  clip-path: polygon(0 0, 100% 0, 100% 12%, 48% 100%, 0 42%);
}

.cta-bottom-wave {
  bottom: 0;
  clip-path: polygon(0 78%, 52% 22%, 100% 90%, 100% 100%, 0 100%);
}

.cta-inner {
  position: relative;
  z-index: 2;
  text-align: center;
  color: #fff;
}

.cta-inner h2 {
  margin: 0 0 2rem;
  font-size: clamp(2rem, 4.5vw, 3rem);
  line-height: 1.2;
}

@media (max-width: 1024px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 1.8rem;
  }

  .featured-stream-layout {
    grid-template-columns: 1fr;
  }

  .feature-layout,
  .reverse {
    grid-template-columns: 1fr;
  }

  .feature-illustration {
    height: 320px;
  }
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

  .testimonial-track {
    grid-auto-columns: minmax(260px, 86vw);
  }

  .featured-stream-layout {
    padding: 1.4rem;
  }

  .featured-stream-image {
    height: 320px;
  }

  .cta {
    padding: 7rem 0;
  }
}
</style>
