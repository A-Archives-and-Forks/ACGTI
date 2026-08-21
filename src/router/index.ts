import { createRouter, createWebHistory, type RouteLocationRaw, type Router } from 'vue-router'

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
  scrollBehavior(to, _from, savedPosition) {
    // 前进时优先处理锚点；浏览器返回/前进恢复上次滚动位置
    if (to.hash) {
      return { el: to.hash, top: 80, behavior: 'smooth' }
    }
    return savedPosition ?? { top: 0 }
  },
})

// 同文档 View Transitions（渐进增强）：支持时编程式导航在过渡回调内完成，
// 旧页面快照冻结期间恰好覆盖懒加载 chunk 的等待，随后播放合成器动画。
// 不支持的浏览器与 prefers-reduced-motion 用户直接执行原导航。
function enableViewTransitions(router: Router) {
  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
    return
  }

  const wrap = (fn: (to: RouteLocationRaw) => Promise<unknown>) => {
    return (to: RouteLocationRaw): Promise<undefined> => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return fn(to).then(() => undefined, () => undefined)
      }

      const transition = document.startViewTransition(() => fn(to))
      // 导航失败（如守卫拦截）不产生未处理拒绝
      return transition.updateCallbackDone.then(() => undefined, () => undefined)
    }
  }

  router.push = wrap(router.push.bind(router)) as Router['push']
  router.replace = wrap(router.replace.bind(router)) as Router['replace']
}

enableViewTransitions(router)

export default router
