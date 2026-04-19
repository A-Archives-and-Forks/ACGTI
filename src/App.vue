<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useI18n } from './i18n'
import { socialIcons } from './data/socialIcons'

const route = useRoute()
const { locale, localeOptions, setLocale, t } = useI18n()

type AuthorSocialLink = {
  label: string
  href: string
  title: string
  brand: 'xiaoheihe' | 'bilibili' | 'xiaohongshu' | 'github'
}

const isLangOpen = ref(false)
const isNavOpen = ref(false)
const langDropdownRef = ref<HTMLElement | null>(null)

const currentLabel = computed(() => {
  return localeOptions.find(o => o.code === locale.value)?.label || 'Language'
})

const toggleLangDropdown = () => {
  isLangOpen.value = !isLangOpen.value
}

const toggleNav = () => {
  isNavOpen.value = !isNavOpen.value
}

const handleResize = () => {
  if (window.innerWidth > 768) {
    isNavOpen.value = false
  }
}

const handleNavClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement | null
  if (target?.closest('a')) {
    isNavOpen.value = false
    isLangOpen.value = false
  }
}

const selectLanguage = (code: string) => {
  setLocale(code as never)
  isLangOpen.value = false
  isNavOpen.value = false
}

const closeLangDropdown = (e: MouseEvent) => {
  if (langDropdownRef.value && !langDropdownRef.value.contains(e.target as Node)) {
    isLangOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeLangDropdown)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  document.removeEventListener('click', closeLangDropdown)
  window.removeEventListener('resize', handleResize)
})

watch(() => route.path, () => {
  isNavOpen.value = false
  isLangOpen.value = false
})

const showFooter = computed(() => route.path !== '/quiz')
const routeTransitionName = computed(() => (route.path === '/quiz' ? 'page-fade-static' : 'page-fade'))

const authorSocialLinks: AuthorSocialLink[] = [
  {
    label: '小黑盒',
    href: 'https://www.xiaoheihe.cn/bbs/user_profile_share?user_id=926369fb2568&h_src=heyboxapp',
    title: '小黑盒',
    brand: 'xiaoheihe',
  },
  {
    label: '哔哩哔哩',
    href: 'https://b23.tv/vL9ibhc',
    title: '哔哩哔哩',
    brand: 'bilibili',
  },
  {
    label: '小红书',
    href: 'https://xhslink.com/m/91AyZ1GSX4z',
    title: '小红书',
    brand: 'xiaohongshu',
  },
  {
    label: 'GitHub',
    href: 'https://github.com/tianxingleo',
    title: 'GitHub',
    brand: 'github',
  },
]
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <RouterLink class="brand-lockup" to="/">
        <div class="brand-logo" aria-hidden="true">
          <span class="dot dot-1"></span>
          <span class="dot dot-2"></span>
          <span class="dot dot-3"></span>
          <span class="dot dot-4"></span>
        </div>
        <span class="brand-name">ACGTI</span>
      </RouterLink>

      <button
        class="mobile-nav-toggle"
        type="button"
        @click="toggleNav"
        :aria-expanded="isNavOpen"
        :aria-label="isNavOpen ? 'Close navigation' : 'Open navigation'"
      >
        <svg v-if="!isNavOpen" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <nav class="site-nav" :class="{ 'is-open': isNavOpen }" @click="handleNavClick">
        <a href="https://github.com/tianxingleo/ACGTI" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 4px; color: #333e49; font-weight: 600; text-decoration: none;" :title="t('app.nav.githubTitle')">
          <svg style="width: 18px; height: 18px; color: #3ba17c;" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          <span class="nav-star-text" style="font-size: 15px;">{{ t('app.nav.star') }} 🌟</span>
        </a>
        <div class="lang-dropdown" :class="{ 'is-open': isLangOpen }" ref="langDropdownRef">
          <button class="lang-dropdown-trigger" type="button" @click.prevent="toggleLangDropdown" :aria-label="t('app.language.label')" :aria-expanded="isLangOpen">
            {{ currentLabel }}
            <span class="arrow"></span>
          </button>
          <transition name="dropdown">
            <ul class="lang-dropdown-menu" v-show="isLangOpen" role="listbox">
              <li 
                v-for="option in localeOptions" 
                :key="option.code"
                role="option"
                :aria-selected="option.code === locale"
                :class="{ active: option.code === locale }"
                @click.stop="selectLanguage(option.code)"
              >
                {{ option.label }}
              </li>
            </ul>
          </transition>
        </div>
        <RouterLink to="/characters">{{ t('app.nav.characters') }}</RouterLink>
        <RouterLink to="/stats">{{ t('app.nav.stats') || 'Stats' }}</RouterLink>
        <RouterLink to="/about">{{ t('app.nav.about') }}</RouterLink>
        <RouterLink to="/sponsor">{{ t('app.nav.sponsor') }}</RouterLink>
        <a href="https://github.com/tianxingleo/ACGTI/discussions" target="_blank" rel="noopener noreferrer" class="nav-external-link">{{ t('app.nav.community') }}</a>
        <RouterLink to="/result">{{ t('app.nav.result') }}</RouterLink>
        <RouterLink to="/quiz" class="button button-primary nav-cta">{{ t('app.nav.cta') }}</RouterLink>
      </nav>
    </header>

    <main class="site-main">
      <router-view v-slot="{ Component }">
          <transition :name="routeTransitionName" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
    </main>

    <footer v-if="showFooter" class="site-footer">
      <div class="footer-content">
        <div class="footer-section">
          <h3 class="footer-title">{{ t('app.footer.sections.test') }}</h3>
          <RouterLink to="/quiz" class="footer-link">{{ t('app.footer.links.startQuiz') }}</RouterLink>
          <RouterLink to="/result" class="footer-link">{{ t('app.footer.links.latestResult') }}</RouterLink>
          <RouterLink to="/characters" class="footer-link">{{ t('app.footer.links.characters') }}</RouterLink>
        </div>
        <div class="footer-section">
          <h3 class="footer-title">{{ t('app.footer.sections.project') }}</h3>
          <RouterLink to="/about" class="footer-link">{{ t('app.footer.links.boundaries') }}</RouterLink>
          <RouterLink to="/about" class="footer-link">{{ t('app.footer.links.roadmap') }}</RouterLink>
        </div>
        <div class="footer-section">
          <h3 class="footer-title">{{ t('app.footer.sections.reminders') }}</h3>
          <p class="footer-note">{{ t('app.footer.notes.result') }}</p>
          <p class="footer-note">{{ t('app.footer.notes.localOnly') }}</p>
          <p class="footer-note">{{ t('app.footer.notes.disclaimer') }}</p>
        </div>
        <div class="footer-section">
          <h3 class="footer-title">{{ t('app.footer.sections.status') }}</h3>
          <p class="footer-note">{{ t('app.footer.notes.frontend') }}</p>
          <p class="footer-note">{{ t('app.footer.notes.stats') }}</p>
          <p class="footer-note">{{ t('app.footer.notes.library') }}</p>
        </div>
        <div class="footer-section">
          <h3 class="footer-title">{{ t('app.footer.sections.openSource') }}</h3>
          <p class="footer-note">{{ t('app.footer.notes.likeIt') }}</p>
          <a href="https://github.com/tianxingleo/ACGTI" target="_blank" rel="noopener noreferrer" class="footer-link cta-star" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: #3ba17c; margin-top: 4px;">
            <svg style="width: 16px; height: 16px;" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            {{ t('app.footer.notes.star') }}
          </a>
          <p class="footer-note" style="margin-top: 8px;">
            {{ t('app.footer.notes.feedback') }}
            <a href="https://github.com/tianxingleo/ACGTI/issues" target="_blank" rel="noopener noreferrer" style="color: #3ba17c; font-weight: 700; text-decoration: none;">{{ t('app.footer.notes.issue') }}</a>
          </p>
        </div>
        <div class="footer-section">
          <h3 class="footer-title">{{ t('app.footer.sections.friendlyLinks') }}</h3>
          <p class="footer-note">{{ t('app.footer.notes.saurlaxCreditBefore') }}<a href="https://saurlax.com/" target="_blank" rel="noopener noreferrer" style="color: #3ba17c; text-decoration: none; font-weight: 600;">saurlax</a>{{ t('app.footer.notes.saurlaxCreditAfter') }}</p>
          <p class="footer-note">{{ t('app.footer.notes.sowieeeCreditBefore') }}<a href="https://github.com/SoWiEee" target="_blank" rel="noopener noreferrer" style="color: #3ba17c; text-decoration: none; font-weight: 600;">SoWiEee</a>{{ t('app.footer.notes.sowieeeCreditAfter') }}</p>
        </div>
        <div class="footer-section author-social-section">
          <h3 class="footer-title">{{ t('app.footer.sections.authorSocial') }}</h3>
          <div class="author-social-list">
            <a
              v-for="social in authorSocialLinks"
              :key="social.label"
              :href="social.href"
              target="_blank"
              rel="noopener noreferrer"
              class="author-social-link"
              :data-brand="social.brand"
              :title="social.title"
            >
              <span class="author-social-icon" aria-hidden="true">
                <svg :viewBox="socialIcons[social.brand].viewBox" fill="currentColor">
                  <path v-for="path in socialIcons[social.brand].paths" :key="path" :d="path" />
                </svg>
              </span>
              <span class="author-social-label">{{ t(`app.footer.socialLinks.${social.brand}`, undefined, social.label) }}</span>
            </a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <p class="footer-copyright">© 2026 ACGTI Project</p>
        <div class="footer-social">
          <RouterLink to="/" :title="t('app.footer.social.home')">{{ t('app.footer.social.home') }}</RouterLink>
          <RouterLink to="/quiz" :title="t('app.footer.social.quiz')">{{ t('app.footer.social.quiz') }}</RouterLink>
          <RouterLink to="/characters" :title="t('app.footer.social.characters')">{{ t('app.footer.social.characters') }}</RouterLink>
          <RouterLink to="/about" :title="t('app.footer.social.about')">{{ t('app.footer.social.about') }}</RouterLink>
          <RouterLink to="/sponsor" :title="t('app.footer.social.sponsor')">{{ t('app.footer.social.sponsor') }}</RouterLink>
        </div>
      </div>
    </footer>
  </div>
</template>


