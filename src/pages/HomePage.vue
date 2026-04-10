<template>
  <div class="home">
    <section class="hero">
      <div class="container hero-inner">
        <h1 class="hero-title">"终于有人把你看懂了。"</h1>
        <p class="hero-subtitle">
          仅需 10 分钟，获得一份高贴合度人格报告：核心四字母类型、维度倾向比例，以及对应二次元角色原型。
        </p>
        <RouterLink to="/quiz" class="hero-button">开始测试 →</RouterLink>
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

    <section class="stats">
      <div class="container stat-grid">
        <div v-for="item in stats" :key="item.label" class="stat-item">
          <p class="stat-value" :style="{ color: item.color }">{{ item.value }}</p>
          <p class="stat-label">{{ item.label }}</p>
        </div>
      </div>
    </section>

    <section class="feature feature-light">
      <div class="container feature-layout">
        <article>
          <p class="feature-tag tag-green">Personality Types</p>
          <h2 class="feature-title">理解他人，也更理解自己</h2>
          <p class="feature-copy">
            我们以标准 MBTI 四字母编码为结果核心，并提供二次元角色原型解析，让你快速理解各类型的驱动力、压力点与关系风格。
          </p>
          <div class="feature-actions">
            <RouterLink to="/intro" class="btn btn-green">查看 16 型人格</RouterLink>
            <RouterLink to="/intro" class="link-green">阅读理论 →</RouterLink>
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

    <section class="feature feature-alt">
      <div class="container feature-layout reverse">
        <aside class="feature-illustration office-2" aria-hidden="true">
          <div class="figure d"></div>
          <div class="figure e"></div>
          <div class="figure f"></div>
          <div class="desk"></div>
        </aside>
        <article>
          <p class="feature-tag tag-blue">Results</p>
          <h2 class="feature-title">把四字母结果翻译成看得懂的角色语言</h2>
          <p class="feature-copy">
            结果页会展示四个维度的倾向比例、对应原型的亮点与短板，以及最多 5 位相近角色，帮助你快速理解这份结果到底在说什么。
          </p>
          <RouterLink to="/intro" class="btn btn-blue">先看结果结构</RouterLink>
        </article>
      </div>
    </section>

    <section class="testimonials">
      <div class="quote-badge">“</div>
      <div class="container">
        <p class="testimonial-tag">Testimonials</p>
        <h2 class="testimonial-title">看看大家的测试反馈</h2>

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

    <section class="cta">
      <div class="cta-top-wave"></div>
      <div class="container cta-inner">
        <h2>想知道你的四字母类型会是哪一个？</h2>
        <RouterLink to="/quiz" class="hero-button">立即开始测试 →</RouterLink>
      </div>
      <div class="cta-bottom-wave"></div>
    </section>
  </div>
</template>

<script setup lang="ts">
const stats = [
  { value: "48", label: "测试题数", color: "#4899a3" },
  { value: "16", label: "MBTI 类型", color: "#e5b540" },
  { value: "8", label: "原型映射", color: "#5ca173" },
  { value: "22", label: "当前角色库", color: "#9474a4" },
]

const testimonials = [
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
    quote: "我原本只想随便测测，没想到结论和我现实状态高度一致。",
  },
]
</script>

<style scoped>
.home {
  background: #fff;
  color: #333;
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
  margin: 1.4rem auto 2.2rem;
  font-size: clamp(1rem, 2.4vw, 1.35rem);
  opacity: 0.95;
}

.hero-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 54px;
  padding: 0 2rem;
  border-radius: 999px;
  background: #9474a4;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 12px 26px rgba(89, 58, 104, 0.28);
  transition: transform 0.2s ease;
}

.hero-button:hover {
  transform: translateY(-2px);
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
  color: #64717b;
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
  color: #54616c;
  font-size: 1.08rem;
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
  color: #4f5e6b;
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

  .feature-layout,
  .reverse {
    grid-template-columns: 1fr;
  }

  .feature-illustration {
    height: 320px;
  }
}

@media (max-width: 768px) {
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

  .cta {
    padding: 7rem 0;
  }
}
</style>
