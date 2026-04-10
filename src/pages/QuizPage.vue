<template>
  <div class="quiz-page-16p">
    <header class="quiz-topbar">
      <div class="quiz-topbar-inner">
        <RouterLink to="/" class="brand-wrap" aria-label="返回首页">
          <span class="logo-dot-wrap" aria-hidden="true">
            <span class="logo-dot d1"></span>
            <span class="logo-dot d2"></span>
            <span class="logo-dot d3"></span>
            <span class="logo-dot d4"></span>
            <span class="logo-core"></span>
          </span>
          <span class="brand-text">ACGTI</span>
        </RouterLink>

        <nav class="top-links" aria-label="主导航">
          <RouterLink to="/quiz">性格测试</RouterLink>
          <RouterLink to="/intro">性格类型</RouterLink>
          <RouterLink to="/about">项目说明</RouterLink>
        </nav>

        <RouterLink class="login-btn" to="/">返回首页</RouterLink>
      </div>
    </header>

    <main class="quiz-main">
      <section class="hero">
        <h1>免费性格测试</h1>
        <p>ACG Type Indicator</p>
      </section>

      <section class="step-cards" aria-label="测试步骤">
        <article class="step-card step-teal">
          <span class="step-pill">STEP 1</span>
          <h3>完成测试</h3>
          <p>做真实的自己并诚实回答，以发现你的性格类型。</p>
        </article>

        <article class="step-card step-green">
          <span class="step-pill">STEP 2</span>
          <h3>查看详细结果</h3>
          <p>了解你的性格类型如何影响你生活的各个方面。</p>
        </article>

        <article class="step-card step-purple">
          <span class="step-pill">STEP 3</span>
          <h3>解锁你的潜能</h3>
          <p>结合你的偏好维度，获取更匹配的发展建议。</p>
        </article>
      </section>

      <section class="quiz-notice" aria-label="测试说明">
        <p>本测试共 {{ questions.length }} 题，基于 MBTI 四个维度计算四字母类型，再映射对应的二次元原型与相近角色。</p>
        <p>结果仅保存在当前浏览器，不收集邮箱、性别等个人信息。</p>
      </section>

      <section class="question-list" aria-label="测试题目">
        <article
          v-for="(question, idx) in questions"
          :key="question.id"
          class="question-block"
        >
          <h2>{{ question.text ?? question.prompt ?? '（题干缺失）' }}</h2>

          <div class="question-scale">
            <span class="agree-label">不同意</span>

            <div class="scale-buttons" role="radiogroup" :aria-label="`问题 ${idx + 1}`">
              <button
                v-for="option in scaleOptions"
                :key="option.value"
                type="button"
                class="scale-btn"
                :class="[
                  option.sizeClass,
                  option.side === 'agree' ? 'agree-ring' : option.side === 'disagree' ? 'disagree-ring' : 'neutral-ring',
                  { selected: state.answers[idx] === option.value }
                ]"
                :aria-checked="state.answers[idx] === option.value"
                :aria-label="option.label"
                @click="onSelect(idx, option.value)"
              >
                <span class="checkmark" v-if="state.answers[idx] === option.value">✓</span>
              </button>
            </div>

            <span class="disagree-label">同意</span>
          </div>

          <div class="mobile-labels">
            <span class="agree-label">不同意</span>
            <span class="disagree-label">同意</span>
          </div>
        </article>
      </section>

      <section class="result-form-card">
        <div class="submit-row">
          <p class="progress-hint">已完成 {{ answeredCount }} / {{ questions.length }} 题</p>
          <button
            class="submit-btn"
            type="button"
            :disabled="!isComplete"
            @click="submitQuiz"
          >
            查看结果
          </button>
        </div>
      </section>
    </main>

    <footer class="quiz-footer">
      <div class="quiz-footer-inner">
        <div class="share-count">48 题 MBTI 测试</div>
        <div class="footer-links">
          <RouterLink to="/">首页</RouterLink>
          <RouterLink to="/intro">人格类型</RouterLink>
          <RouterLink to="/about">项目说明</RouterLink>
          <RouterLink to="/result">最近结果</RouterLink>
          <span>本地保存</span>
        </div>
        <p>© 2026 ACGTI Project</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useQuiz } from '../composables/useQuiz'

type ScaleSide = 'agree' | 'neutral' | 'disagree'

interface ScaleOption {
  value: number
  label: string
  side: ScaleSide
  sizeClass: string
}

const router = useRouter()
const { questions, state, answeredCount, isComplete, selectOptionAt, finalizeQuiz } = useQuiz()

const scaleOptions: ScaleOption[] = [
  { value: -3, label: '强烈不同意', side: 'agree', sizeClass: 'size-xl' },
  { value: -2, label: '不同意', side: 'agree', sizeClass: 'size-lg' },
  { value: -1, label: '略微不同意', side: 'agree', sizeClass: 'size-md' },
  { value: 0, label: '中立', side: 'neutral', sizeClass: 'size-sm' },
  { value: 1, label: '略微同意', side: 'disagree', sizeClass: 'size-md' },
  { value: 2, label: '同意', side: 'disagree', sizeClass: 'size-lg' },
  { value: 3, label: '强烈同意', side: 'disagree', sizeClass: 'size-xl' },
]

function onSelect(questionIndex: number, value: number) {
  selectOptionAt(questionIndex, value)
}

function submitQuiz() {
  const result = finalizeQuiz()
  if (!result) return
  router.push({ name: 'result' })
}
</script>

<style scoped>
.quiz-page-16p {
  min-height: 100vh;
  background: #ffffff;
  color: #2d3436;
}

.quiz-topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid #edf1f5;
  background: #ffffff;
}

.quiz-topbar-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand-wrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.logo-dot-wrap {
  position: relative;
  width: 26px;
  height: 26px;
}

.logo-dot,
.logo-core {
  position: absolute;
  border-radius: 999px;
}

.logo-dot {
  width: 8px;
  height: 8px;
}

.logo-core {
  width: 10px;
  height: 10px;
  left: 8px;
  top: 8px;
  background: #d9dde3;
}

.d1 {
  left: 0;
  top: 9px;
  background: #37a676;
}

.d2 {
  right: 0;
  top: 9px;
  background: #8a64a2;
}

.d3 {
  left: 9px;
  top: 0;
  background: #3c98b7;
}

.d4 {
  left: 9px;
  bottom: 0;
  background: #f0ab2e;
}

.brand-text {
  font-weight: 700;
  color: #3a4045;
  letter-spacing: 0.01em;
}

.top-links {
  display: flex;
  align-items: center;
  gap: 18px;
}

.top-links a {
  color: #5f6a75;
  font-size: 14px;
  font-weight: 600;
}

.login-btn {
  border: 1px solid #ccd4dc;
  background: #ffffff;
  color: #4f5b66;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
}

.quiz-main {
  max-width: 1020px;
  margin: 0 auto;
  padding: 34px 16px 56px;
}

.hero {
  text-align: center;
  margin-bottom: 34px;
}

.hero h1 {
  margin: 0;
  font-size: clamp(32px, 5vw, 50px);
  line-height: 1.1;
  color: #2d3436;
}

.hero p {
  margin: 10px 0 0;
  font-size: 14px;
  letter-spacing: 0.12em;
  color: #8191a3;
}

.step-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 36px;
}

.step-card {
  background: #ffffff;
  border: 1px solid #edf1f5;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 8px 24px rgba(17, 24, 39, 0.05);
}

.step-card h3 {
  margin: 10px 0 8px;
  font-size: 22px;
  color: #2e353a;
}

.step-card p {
  margin: 0;
  font-size: 14px;
  color: #61707f;
  line-height: 1.65;
}

.step-pill {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #ffffff;
  border-radius: 999px;
  padding: 4px 8px;
}

.step-teal {
  border-top: 4px solid #33a474;
}

.step-teal .step-pill {
  background: #33a474;
}

.step-green {
  border-top: 4px solid #55c391;
}

.step-green .step-pill {
  background: #55c391;
}

.step-purple {
  border-top: 4px solid #88619a;
}

.step-purple .step-pill {
  background: #88619a;
}

.question-list {
  max-width: 880px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid #eef2f6;
  overflow: hidden;
}

.question-block {
  padding: 36px 18px;
  border-bottom: 1px solid #f1f4f8;
}

.question-block:last-child {
  border-bottom: none;
}

.question-block h2 {
  margin: 0 0 24px;
  text-align: center;
  color: #2f3841;
  font-size: clamp(20px, 2.7vw, 28px);
  line-height: 1.35;
}

.question-scale {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.agree-label,
.disagree-label {
  width: 64px;
  font-size: 14px;
  font-weight: 700;
}

.agree-label {
  color: #33a474;
  text-align: right;
}

.disagree-label {
  color: #88619a;
  text-align: left;
}

.scale-buttons {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.scale-btn {
  border-radius: 999px;
  background: #ffffff;
  border: 3px solid;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.18s ease, background-color 0.18s ease, opacity 0.18s ease;
}

.size-sm { width: 28px; height: 28px; }
.size-md { width: 36px; height: 36px; }
.size-lg { width: 46px; height: 46px; }
.size-xl { width: 56px; height: 56px; }

.agree-ring { border-color: #33a474; }
.disagree-ring { border-color: #88619a; }
.neutral-ring { border-color: #9aa5b1; }

.scale-btn:not(.selected) {
  opacity: 0.65;
}

.scale-btn:hover {
  transform: translateY(-1px);
  opacity: 1;
}

.scale-btn.selected {
  opacity: 1;
  border-color: transparent;
  transform: scale(1.04);
}

.scale-btn.agree-ring.selected {
  background: #33a474;
}

.scale-btn.disagree-ring.selected {
  background: #88619a;
}

.scale-btn.neutral-ring.selected {
  background: #9aa5b1;
}

.checkmark {
  color: #ffffff;
  font-size: 14px;
  line-height: 1;
  font-weight: 700;
}

.mobile-labels {
  display: none;
}

.result-form-card {
  max-width: 880px;
  margin: 28px auto 0;
  padding: 28px 20px;
  border: 1px solid #edf1f5;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(17, 24, 39, 0.05);
}

.quiz-notice {
  max-width: 880px;
  margin: 0 auto 28px;
  padding: 18px 20px;
  border-radius: 14px;
  border: 1px solid #edf1f5;
  background: #f7fafc;
  color: #5d6b78;
  display: grid;
  gap: 6px;
  line-height: 1.7;
}

.quiz-notice p {
  margin: 0;
  font-size: 14px;
}

.submit-row {
  margin-top: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.progress-hint {
  margin: 0;
  color: #6d7c8a;
  font-size: 14px;
}

.submit-btn {
  border: none;
  border-radius: 999px;
  padding: 12px 28px;
  color: #ffffff;
  background: #88619a;
  font-weight: 700;
  cursor: pointer;
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.quiz-footer {
  margin-top: 30px;
  border-top: 1px solid #edf1f5;
  background: #f7f9fc;
}

.quiz-footer-inner {
  max-width: 1020px;
  margin: 0 auto;
  padding: 30px 16px;
  text-align: center;
}

.share-count {
  color: #3a434b;
  font-size: 24px;
  font-weight: 700;
}

.footer-links {
  margin: 16px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  justify-content: center;
}

.footer-links > * {
  color: #33a474;
  font-size: 14px;
  font-weight: 600;
}

.quiz-footer p {
  margin: 0;
  color: #8a97a5;
  font-size: 12px;
}

@media (max-width: 980px) {
  .step-cards {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .top-links {
    display: none;
  }

  .agree-label,
  .disagree-label {
    display: none;
  }

  .mobile-labels {
    margin-top: 10px;
    display: flex;
    justify-content: space-between;
    max-width: 300px;
    margin-left: auto;
    margin-right: auto;
  }

  .scale-buttons {
    gap: 10px;
    flex-wrap: wrap;
  }

  .size-sm { width: 26px; height: 26px; }
  .size-md { width: 32px; height: 32px; }
  .size-lg { width: 40px; height: 40px; }
  .size-xl { width: 48px; height: 48px; }

  .submit-row {
    flex-direction: column;
    align-items: stretch;
  }

  .submit-btn {
    width: 100%;
  }
}
</style>
