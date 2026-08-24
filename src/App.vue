<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useI18n, type AppLocale } from './i18n'
import { socialIcons } from './data/socialIcons'
import AppIcon from './components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const { locale, localeOptions, setLocale, t } = useI18n()

const isFirstLoad = ref(true)

const dismissLoading = () => {
  const el = document.getElementById('loading-screen')
  if (el && !el.classList.contains('loaded')) {
    el.classList.add('loaded')
    const remove = () => el.remove()
    el.addEventListener('transitionend', remove, { once: true })
    setTimeout(remove, 600)
  }
}

router.isReady().then(() => {
  requestAnimationFrame(dismissLoading)
})

const onAfterEnter = () => {
  isFirstLoad.value = false
}

type AuthorSocialLink = {
  label: string
  href: string
  title: string
  brand: 'xiaoheihe' | 'bilibili' | 'xiaohongshu' | 'github'
}

const isLangOpen = ref(false)
const isNavOpen = ref(false)
const langDropdownRef = ref<HTMLElement | null>(null)
const langTriggerRef = ref<HTMLButtonElement | null>(null)

const currentLabel = computed(() => {
  return localeOptions.find(o => o.code === locale.value)?.label || 'Language'
})

const toggleLangDropdown = () => {
  isLangOpen.value = !isLangOpen.value
}

const toggleNav = () => {
  isNavOpen.value = !isNavOpen.value
}

// 桌面断点媒体查询：只在跨越断点时关闭移动菜单，避免 resize 逐帧回调
// （769px 与 style.css 的 max-width: 768px 移动端断点严格互补）
const desktopMediaQuery = window.matchMedia('(min-width: 769px)')

const handleDesktopMediaChange = (e: MediaQueryListEvent) => {
  if (e.matches) {
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

const selectLanguage = (code: AppLocale) => {
  setLocale(code)
  isLangOpen.value = false
  isNavOpen.value = false
}

const closeLangDropdown = (e: MouseEvent) => {
  if (langDropdownRef.value && !langDropdownRef.value.contains(e.target as Node)) {
    isLangOpen.value = false
  }
}

// Escape 关闭语言菜单并把焦点还给触发按钮，保证键盘可达
const handleLangKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isLangOpen.value) {
    isLangOpen.value = false
    langTriggerRef.value?.focus()
  }
}

onMounted(() => {
  document.addEventListener('click', closeLangDropdown)
  desktopMediaQuery.addEventListener('change', handleDesktopMediaChange)
})

onUnmounted(() => {
  document.removeEventListener('click', closeLangDropdown)
  desktopMediaQuery.removeEventListener('change', handleDesktopMediaChange)
})

watch(() => route.path, () => {
  isNavOpen.value = false
  isLangOpen.value = false
})

const showFooter = computed(() => route.path !== '/quiz')
// 支持 View Transitions 的浏览器交由合成器动画接管路由切换
// （见 src/router/index.ts 的 push/replace 包装与 style.css 的 ::view-transition-*），
// 其余浏览器保留 Vue transition 的 fade 兜底
const supportsViewTransition = typeof document.startViewTransition === 'function'
const routeTransitionName = computed(() => {
  if (isFirstLoad.value || supportsViewTransition) return ''
  return route.path === '/quiz' ? 'page-fade-static' : 'page-fade'
})

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
        :aria-label="isNavOpen ? '关闭导航菜单' : '打开导航菜单'"
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
          <AppIcon name="github" style="width: 18px; height: 18px; color: #3ba17c;" />
          <span class="nav-star-text" style="font-size: 15px;">{{ t('app.nav.star') }}</span>
        </a>
        <div class="lang-dropdown" :class="{ 'is-open': isLangOpen }" ref="langDropdownRef" @keydown="handleLangKeydown">
          <button class="lang-dropdown-trigger" ref="langTriggerRef" type="button" @click.prevent="toggleLangDropdown" :aria-label="t('app.language.label')" :aria-expanded="isLangOpen">
            {{ currentLabel }}
            <span class="arrow"></span>
          </button>
          <transition name="dropdown">
            <ul class="lang-dropdown-menu" v-show="isLangOpen" :aria-label="t('app.language.label')">
              <li
                v-for="option in localeOptions"
                :key="option.code"
                :class="{ active: option.code === locale }"
              >
                <button
                  type="button"
                  class="lang-option-btn"
                  :aria-pressed="option.code === locale"
                  @click="selectLanguage(option.code)"
                >
                  {{ option.label }}
                </button>
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
        <transition :name="routeTransitionName" mode="out-in" @after-enter="onAfterEnter">
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
          <!-- 锚点分别指向 About 页的边界说明与更新内容面板（见 AboutPage 的 section id） -->
          <RouterLink to="/about#boundaries" class="footer-link">{{ t('app.footer.links.boundaries') }}</RouterLink>
          <RouterLink to="/about#roadmap" class="footer-link">{{ t('app.footer.links.roadmap') }}</RouterLink>
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
            <AppIcon name="github" style="width: 16px; height: 16px;" />
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


