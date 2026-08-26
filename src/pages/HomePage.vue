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
          {{ t('home.statsLinkIntro') }}
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
          <AppIcon name="github" style="width: 1.25rem; height: 1.25rem;" />
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
            v-for="card in communityCards"
            :key="card.title"
            :href="card.href"
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
import AppIcon from '../components/AppIcon.vue'
import { computed } from 'vue'
import { useI18n } from '../i18n'
import { useSeo } from '../composables/useSeo'

const { t: homeT } = useI18n()
useSeo({
  title: computed(() => homeT('seo.homeTitle')),
  description: computed(() => homeT('seo.homeDesc')),
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

// 社区卡片跳转目标：「更新公告」指向 GitHub Releases，其余进入 Discussions
const COMMUNITY_DISCUSSIONS_URL = 'https://github.com/tianxingleo/ACGTI/discussions'
const COMMUNITY_RELEASES_URL = 'https://github.com/tianxingleo/ACGTI/releases'

const communityCards = computed(() => {
  const raw = tm<Array<{ title: string; desc: string; icon: string }>>('home.communityCards')
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.map(card => ({
    ...card,
    href: card.icon === 'announce' ? COMMUNITY_RELEASES_URL : COMMUNITY_DISCUSSIONS_URL,
  }))
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
  padding: 4.5rem 0;
  overflow: hidden;
  background: #ffffff;
  border-top: 1px solid #eef2f4;
}

.feature-alt {
  background: #f8f9fa;
}

.feature::before,
.feature-alt::before {
  display: none;
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
  display: inline-flex;
  align-items: center;
  margin: 0 0 0.85rem;
  padding: 4px 10px;
  font-size: 0.76rem;
  letter-spacing: 0.04em;
  font-weight: 700;
  text-transform: uppercase;
  border-radius: 999px;
  border: 1px solid #dbe7e1;
  background: #eef4f1;
}

.tag-green { color: #2f6e55; }
.tag-blue { color: #2f6a80; }

.feature-title {
  margin: 0;
  font-size: clamp(1.85rem, 4vw, 2.35rem);
  line-height: 1.22;
  font-weight: 800;
  letter-spacing: -0.02em;
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
  height: 340px;
  border-radius: 16px;
  border: 1px solid #e3e8ee;
  background: #f8f9fa;
  position: relative;
  overflow: hidden;
}

.feature-illustration::before {
  display: none;
}

.office-1 .window,
.office-2 .window {
  position: absolute;
  top: 32px;
  width: 36%;
  height: 72px;
  background: #eef2f4;
  border: 1px solid #dde5ea;
  border-radius: 8px;
}

.office-1 .window:first-child { left: 8%; }
.office-1 .window:last-child { right: 8%; }

.figure {
  position: absolute;
  bottom: 48px;
  width: 52px;
  border-radius: 10px 10px 6px 6px;
  opacity: 0.9;
}

.office-1 .a {
  left: 24%;
  height: 150px;
  background: #6bb18a;
  border: 1px solid #5a9a76;
}

.office-1 .b {
  left: 44%;
  height: 120px;
  background: #9b8ab0;
  border: 1px solid #8a7aa0;
}

.office-1 .c {
  left: 63%;
  height: 138px;
  background: #7fb9cc;
  border: 1px solid #6fa8bb;
}

.office-2 .d {
  left: 26%;
  height: 118px;
  background: #9b8ab0;
  border: 1px solid #8a7aa0;
}

.office-2 .e {
  left: 48%;
  height: 158px;
  background: #6bb18a;
  border: 1px solid #5a9a76;
}

.office-2 .f {
  left: 68%;
  height: 140px;
  background: #d4b85c;
  border: 1px solid #c0a84e;
}

.desk {
  position: absolute;
  bottom: 22px;
  left: 10%;
  width: 80%;
  height: 12px;
  border-radius: 6px;
  background: #d6dde2;
  border: 1px solid #c8d2d9;
}

.hero-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 1.06rem;
  min-height: 52px;
  min-width: 184px;
  padding: 0 1.9rem;
  border-radius: 999px;
  background: #33a474;
  color: #fff;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-decoration: none;
  border: 1px solid #2d9168;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.hero-button:hover {
  background: #2d9168;
  border-color: #267a58;
}

.cta {
  margin-top: 0;
  position: relative;
  background: #2f7a5c;
  padding: 4.5rem 0;
  border-top: 1px solid #285f4a;
  border-bottom: 1px solid #285f4a;
  overflow: hidden;
}

.cta-top-wave,
.cta-bottom-wave {
  display: none;
}

.cta-inner {
  position: relative;
  z-index: 2;
  text-align: center;
  color: #fff;
}

.cta-inner h2 {
  margin: 0 0 1.5rem;
  font-size: clamp(1.7rem, 4vw, 2.35rem);
  line-height: 1.25;
  font-weight: 800;
  letter-spacing: -0.02em;
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
  padding: 24px 16px 20px;
  border-radius: 14px;
  border: 1px solid #e3e8ee;
  background: #ffffff;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.community-card:hover {
  border-color: #b8ddd0;
  background: #f8fdfb;
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
