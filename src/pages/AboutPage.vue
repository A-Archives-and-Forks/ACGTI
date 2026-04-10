<template>
  <div class="page-stack compact">
    <section class="hero-panel">
      <p class="eyebrow">关于 ACGTI</p>
      <h1 class="display-title">先做一个单测试作品，再把角色宇宙慢慢扩开。</h1>
      <p class="lead">
        当前版本是纯静态前端实现：Vue 3 + Vite + Vue Router，本地题库、本地原型库、本地角色库，本地保存最近一次测试结果。
      </p>
    </section>

    <section class="split-grid">
      <article class="panel">
        <h2 class="section-title">当前边界</h2>
        <div class="meta-list">
          <div class="meta-item">
            <span class="label">娱乐定位</span>
            <p class="value">它是角色原型测试，不是专业心理评估，也不用于现实人格定型。</p>
          </div>
          <div class="meta-item">
            <span class="label">技术边界</span>
            <p class="value">暂不引入账号、数据库、排行榜或后台，优先保证体验、内容和维护成本。</p>
          </div>
          <div class="meta-item">
            <span class="label">后续扩展</span>
            <p class="value">后面可以继续扩题库、扩角色库、加隐藏结果、做分享海报或多主题模式。</p>
          </div>
        </div>
      </article>

      <article class="panel">
        <h2 class="section-title">这版实现了什么</h2>
        <div class="timeline-list">
          <div class="timeline-item">
            <span class="label">内容层</span>
            <p class="value">48 道题、8 个原型、22 位已录入角色。</p>
          </div>
          <div class="timeline-item">
            <span class="label">规则层</span>
            <p class="value">先计算 MBTI 四维得分，再做原型映射和角色相似度排序。</p>
          </div>
          <div class="timeline-item">
            <span class="label">表现层</span>
            <p class="value">首页、说明页、测试页、结果页、关于页的完整闭环。</p>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>
