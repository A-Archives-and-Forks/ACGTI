<template>
  <div class="site-shell">
    <!-- 16Personalities-style Header -->
    <header v-if="$route.path !== '/quiz'" class="site-header">
      <RouterLink class="brand-lockup" to="/">
        <div class="brand-logo" aria-hidden="true">
          <span class="dot dot-1"></span>
          <span class="dot dot-2"></span>
          <span class="dot dot-3"></span>
          <span class="dot dot-4"></span>
        </div>
        <span class="brand-name">ACGTI</span>
      </RouterLink>

      <nav class="site-nav">
        <RouterLink to="/quiz">开始测试</RouterLink>
        <RouterLink to="/intro">人格类型</RouterLink>
        <RouterLink to="/about">项目说明</RouterLink>
        <RouterLink to="/result" v-if="$route.path !== '/result'">最近结果</RouterLink>
        <RouterLink to="/quiz" class="button button-primary nav-cta">立即测评</RouterLink>
      </nav>
    </header>

    <!-- Main Content -->
    <main class="site-main">
      <RouterView />
    </main>

    <!-- 16Personalities-style Footer (only show on non-quiz pages) -->
    <footer v-if="$route.path !== '/quiz'" class="site-footer">
      <div class="footer-content">
        <div class="footer-section">
          <h3 class="footer-title">测试入口</h3>
          <RouterLink to="/quiz" class="footer-link">开始 ACGTI 测试</RouterLink>
          <RouterLink to="/result" class="footer-link">查看最近结果</RouterLink>
          <RouterLink to="/intro" class="footer-link">16 型人格说明</RouterLink>
        </div>
        <div class="footer-section">
          <h3 class="footer-title">项目内容</h3>
          <RouterLink to="/intro" class="footer-link">结果结构说明</RouterLink>
          <RouterLink to="/about" class="footer-link">项目边界</RouterLink>
          <RouterLink to="/about" class="footer-link">更新方向</RouterLink>
        </div>
        <div class="footer-section">
          <h3 class="footer-title">使用提醒</h3>
          <p class="footer-note">结果会优先展示四字母 MBTI 类型，再映射二次元原型与角色。</p>
          <p class="footer-note">测试结果仅保存在当前浏览器，不会上传到后端。</p>
          <p class="footer-note">本项目用于娱乐表达，不替代专业评估。</p>
        </div>
        <div class="footer-section">
          <h3 class="footer-title">当前状态</h3>
          <p class="footer-note">纯前端静态站点</p>
          <p class="footer-note">48 道题 / 4 维 MBTI</p>
          <p class="footer-note">8 个原型 / 22 位角色</p>
        </div>
      </div>
      <div class="footer-bottom">
        <p class="footer-copyright">© 2026 ACGTI Project</p>
        <div class="footer-social">
          <RouterLink to="/" title="首页">首页</RouterLink>
          <RouterLink to="/quiz" title="测试">测试</RouterLink>
          <RouterLink to="/intro" title="类型">类型</RouterLink>
          <RouterLink to="/about" title="说明">说明</RouterLink>
        </div>
      </div>
    </footer>
  </div>
</template>
