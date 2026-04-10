<template>
  <div class="page-stack compact">
    <section class="hero-panel center">
      <p class="eyebrow">测试说明</p>
      <h1 class="display-title">这是角色原型测试，不是心理诊断。</h1>
      <p class="lead">
        你会回答 48 道五级量表题。系统会先计算 MBTI 四个维度，再映射唯一命中的角色代码、对应的二次元原型，以及各维度倾向比例。
      </p>
      <div class="cta-row" style="justify-content: center;">
        <RouterLink class="button button-primary" to="/quiz">直接开始</RouterLink>
      </div>
    </section>

    <section class="split-grid">
      <article class="panel">
        <h2 class="section-title">结果会告诉你什么</h2>
        <div class="meta-list">
          <div class="meta-item">
            <span class="label">主原型</span>
            <p class="value">你在二次元叙事里更接近哪一种角色气质。</p>
          </div>
          <div class="meta-item">
            <span class="label">角色代码</span>
            <p class="value">结果会优先展示命中的角色自定义代码，并展示每个维度的倾向比例。</p>
          </div>
          <div class="meta-item">
            <span class="label">角色命中</span>
            <p class="value">当前版本会输出唯一命中角色，并用该角色承载结果页的主视觉与解析。</p>
          </div>
        </div>
      </article>

      <article class="panel">
        <h2 class="section-title">四个 MBTI 维度</h2>
        <div class="pill-row">
          <span class="pill">外向 / 内向</span>
          <span class="pill">实感 / 直觉</span>
          <span class="pill">理性 / 情感</span>
          <span class="pill">判断 / 感知</span>
        </div>
      </article>
    </section>
  </div>
</template>
