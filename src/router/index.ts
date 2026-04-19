import { createRouter, createWebHistory } from 'vue-router'

// 兼容旧 hash 路由：在 router 创建之前替换 URL
// 这样 createWebHistory 初始化时直接读到正确路径
const hashMatch = window.location.hash.match(/^#\/(.+)/)
if (hashMatch) {
  window.history.replaceState(null, '', '/' + hashMatch[1])
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('../pages/HomePage.vue') },
    { path: '/intro', redirect: '/about' },
    { path: '/quiz', name: 'quiz', component: () => import('../pages/QuizPage.vue') },
    { path: '/result', name: 'result', component: () => import('../pages/ResultPage.vue') },
    { path: '/characters', name: 'characters', component: () => import('../pages/CharactersPage.vue') },
    { path: '/about', name: 'about', component: () => import('../pages/AboutPage.vue') },
    { path: '/stats', name: 'stats', component: () => import('../pages/StatsPage.vue') },
    { path: '/sponsor', name: 'sponsor', component: () => import('../pages/SponsorPage.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
