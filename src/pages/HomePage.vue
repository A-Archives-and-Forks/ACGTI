<template>
  <div class="home">
    <UpdatePopup />

    <HeroSection />

    <StatsSection />

    <FeaturedStream />

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

    <TestimonialsSection />

    <!-- Stats / Leaderboard entry -->
    <section class="feature feature-light text-center" style="padding-top: 4rem; padding-bottom: 4rem;" v-reveal>
      <div class="container">
        <p class="feature-copy" style="max-width: 500px; margin: 0 auto 1.5rem; color: #666;">
          {{ t('home.statsLink').replace(' →', '') }}
        </p>
        <RouterLink to="/stats" class="btn btn-green" style="display: inline-flex; align-items: center; gap: 0.5rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 1.1rem; height: 1.1rem;"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
          {{ t('home.statsLink') }}
        </RouterLink>
      </div>
    </section>

    <section v-if="homeAdSlot" class="ad-section">
      <div class="container">
        <AdsenseSlot :slot="homeAdSlot" :label="t('app.common.sponsored')" />
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

    <!-- Community Discussion Section -->
    <section class="feature feature-light text-center community-section" style="padding-top: 4rem; padding-bottom: 4rem;" v-reveal>
      <div class="container">
        <p class="feature-tag tag-green">Community</p>
        <h2 class="feature-title" style="margin-bottom: 0.5rem;">{{ t('home.communityTitle') }}</h2>
        <div class="community-grid">
          <a
            v-for="(card, idx) in communityCards"
            :key="idx"
            href="https://github.com/tianxingleo/ACGTI/discussions"
            target="_blank"
            rel="noopener noreferrer"
            class="community-card"
          >
            <span class="community-card-icon" :class="`icon-${card.icon}`">
              <svg v-if="card.icon === 'nominate'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              <svg v-else-if="card.icon === 'bug'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M6 18l-2 2"/><path d="M18 18l2 2"/></svg>
              <svg v-else-if="card.icon === 'announce'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </span>
            <h3 class="community-card-title">{{ card.title }}</h3>
            <p class="community-card-desc">{{ card.desc }}</p>
          </a>
        </div>
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
import AdsenseSlot from '../components/AdsenseSlot.vue'
import UpdatePopup from '../components/home/UpdatePopup.vue'
import HeroSection from '../components/home/HeroSection.vue'
import StatsSection from '../components/home/StatsSection.vue'
import FeaturedStream from '../components/home/FeaturedStream.vue'
import TestimonialsSection from '../components/home/TestimonialsSection.vue'
import { computed } from 'vue'
import { useI18n } from '../i18n'
import { useSeo } from '../composables/useSeo'

useSeo({
  title: 'ACGTI 官网 - ACG Type Indicator | 二次元角色原型测试',
  description: 'ACGTI 官网，ACG Type Indicator 二次元角色原型测试。回答 39 道情境式问题，获得唯一命中的角色代码，查看 MBTI 维度倾向与二次元角色原型解析。',
  path: '/',
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'ACGTI',
    alternateName: 'ACG Type Indicator',
    url: 'https://acgti.tianxingleo.top',
    description: '以 MBTI 为基础的二次元角色原型测试',
    potentialAction: {
      '@type': 'TakeAction',
      target: 'https://acgti.tianxingleo.top/quiz',
      name: '开始测试',
    },
  },
})

const homeAdSlot = String(import.meta.env.VITE_ADSENSE_SLOT_HOME ?? '').trim()
const { t, tm } = useI18n()

const communityCards = computed(() => {
  const raw = tm<Array<{ title: string; desc: string; icon: string }>>('home.communityCards')
  return Array.isArray(raw) ? raw : []
})
</script>

<style scoped>
.home {
  background: #fff;
  color: #333;
}

.container {
  width: min(1200px, calc(100% - 2rem));
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.ad-section {
  padding: 0 0 3rem;
}

.feature {
  position: relative;
  padding: 5.5rem 0;
  overflow: hidden;
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

.hero-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 1.125rem;
  min-height: 56px;
  min-width: 196px;
  padding: 0 2.15rem;
  border-radius: 999px;
  background: #9474a4;
  color: #fff;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-decoration: none;
  border: 1.5px solid #9474a4;
  box-shadow: 0 10px 24px rgba(89, 58, 104, 0.28);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.hero-button:hover {
  background: #836592;
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(89, 58, 104, 0.28);
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
  .feature-layout,
  .reverse {
    grid-template-columns: 1fr;
  }

  .feature-illustration {
    height: 320px;
  }
}

@media (max-width: 768px) {
  .cta {
    padding: 7rem 0;
  }
}

.community-section {
  padding-top: 4rem;
  padding-bottom: 4rem;
}

.community-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-top: 2rem;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
}

.community-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px 16px 22px;
  border-radius: 18px;
  border: 1px solid #e8ecef;
  background: linear-gradient(180deg, #ffffff, #fbfdfb);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.community-card:hover {
  transform: translateY(-4px);
  border-color: #b8ddd0;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
}

.community-card-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  margin-bottom: 4px;
}

.community-card-icon svg {
  width: 24px;
  height: 24px;
}

.icon-nominate { background: #f3fbf7; color: #33a474; }
.icon-bug { background: #fef5f5; color: #e26666; }
.icon-announce { background: #fef9f0; color: #e4ae3a; }
.icon-share { background: #f3f0f8; color: #88619a; }

.community-card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #2f3a45;
}

.community-card-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #6c7780;
  text-align: center;
}

@media (max-width: 768px) {
  .community-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }

  .community-card {
    padding: 20px 12px 18px;
  }
}

@media (max-width: 480px) {
  .community-grid {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .community-card-title {
    font-size: 14px;
  }

  .community-card-desc {
    font-size: 12px;
  }
}
</style>
