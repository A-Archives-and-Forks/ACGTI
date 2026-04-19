<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../i18n'
import { useSeo } from '../composables/useSeo'

const { t, tm } = useI18n()
const relayFeedback = ref('')

useSeo({
  title: 'ACGTI 介绍页 - ACG Type Indicator | 测试说明',
  description: '了解 ACGTI（ACG Type Indicator）的测试规则、隐私说明和分享方式；如需查看项目说明，请前往关于页面。',
  path: '/intro',
})

async function copyQuizLink() {
  try {
    const link = new URL('/quiz', window.location.href).toString()
    await navigator.clipboard.writeText(link)
    relayFeedback.value = t('home.relayFeedback')
  } catch {
    relayFeedback.value = t('app.common.copyFail')
  }
}
</script>

<template>
  <div class="intro-page-container">
    <div class="intro-layout">
      <div class="page-stack">
        <!-- Hero Section -->
        <section class="intro-block center-align" v-reveal>
          <div class="icon-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <p class="eyebrow">{{ t('intro.eyebrow') }}</p>
          <h1 class="page-title">{{ t('intro.title') }}</h1>
          <p class="brand-line">ACGTI 介绍页 · ACG Type Indicator</p>
          <p class="lead">{{ t('intro.lead') }}</p>
          <div class="action-wrap">
            <RouterLink class="btn btn-primary main-btn" to="/quiz">{{ t('intro.start') }}</RouterLink>
          </div>
        </section>

        <!-- Relay / Share Section -->
        <section class="info-panel relay-panel" v-reveal>
          <div class="panel-header">
            <div class="panel-icon-wrap" style="color: #3ba17c; background: #eaf5f0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            </div>
            <h2 class="panel-title">{{ t('intro.relayTitle') }}</h2>
          </div>
          <p class="lead relay-copy">{{ t('intro.relayCopy') }}</p>
          <div class="action-row">
            <button class="btn btn-ghost copy-btn" type="button" @click="copyQuizLink">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px; margin-right: 6px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              {{ t('intro.relayButton') }}
            </button>
            <RouterLink class="btn btn-primary" to="/quiz">{{ t('intro.start') }}</RouterLink>
          </div>
          <p v-if="relayFeedback" class="relay-feedback">{{ relayFeedback }}</p>
        </section>

        <!-- Privacy Section -->
        <section class="info-panel privacy-panel" v-reveal>
          <div style="display: flex; align-items: flex-start; gap: 16px;">
            <div style="color: #8fa0ad; margin-top: 2px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <p class="privacy-copy">{{ t('intro.privacyCopy') }}</p>
          </div>
        </section>

        <section class="split-grid" v-reveal>
          <article class="info-panel">
            <h2 class="panel-title" style="margin-bottom: 24px;">{{ t('intro.resultTitle') }}</h2>
            <div class="custom-list">
              <div v-for="item in tm<string[][]>('intro.resultItems')" :key="item[0]" class="list-item">
                <span class="item-label">{{ item[0] }}</span>
                <p class="item-value">{{ item[1] }}</p>
              </div>
            </div>
          </article>

          <article class="info-panel">
            <h2 class="panel-title" style="margin-bottom: 24px;">{{ t('intro.dimensionTitle') }}</h2>
            <div class="pill-row">
              <span v-for="dimension in tm<string[]>('intro.dimensions')" :key="dimension" class="pill">{{ dimension }}</span>
            </div>
          </article>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.intro-page-container {
  background: #f9f9f9;
  min-height: 100vh;
  padding: 40px 24px 80px;
  color: #333e49;
}

.intro-layout {
  max-width: 900px;
  margin: 0 auto;
}

.page-stack {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* 通用面板框样式 */
.intro-block, .info-panel {
  background: #ffffff;
  border: 1px solid #e8ecef;
  border-radius: 18px;
  padding: 40px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
}

.center-align {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 图标徽章 */
.icon-badge {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: #f0f4f8;
  color: #4298b4;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.icon-badge svg {
  width: 32px;
  height: 32px;
}

.eyebrow {
  margin: 0 0 12px;
  color: #4298b4;
  font-weight: 800;
  font-size: 14px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.page-title {
  margin: 0 0 20px;
  font-size: clamp(32px, 5vw, 44px);
  font-weight: 800;
  color: #2f3a45;
  line-height: 1.2;
}

.brand-line {
  margin: -8px 0 16px;
  color: #3ba17c;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.lead {
  margin: 0 0 20px;
  font-size: 17px;
  line-height: 1.7;
  color: #5f6b75;
  font-weight: 500;
}

.action-wrap {
  margin-top: 16px;
}

/* 按钮样式 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 28px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: #9474a4;
  color: #fff;
  box-shadow: 0 8px 20px rgba(148, 116, 164, 0.25);
}

.btn-primary:hover {
  background: #7e5c8e;
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(148, 116, 164, 0.35);
}

.main-btn {
  padding: 16px 40px;
  font-size: 18px;
}

.btn-ghost {
  background: transparent;
  color: #4c5863;
  border: 1px solid #dce2e6;
  font-weight: 600;
}

.btn-ghost:hover {
  background: #f4f7f9;
  border-color: #c8d2d9;
}

/* 特殊面板 */
.relay-panel {
  background: linear-gradient(180deg, #ffffff 0%, #f7fdfa 100%);
  border-color: #e5f2ec;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.panel-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-icon-wrap svg {
  width: 24px;
  height: 24px;
}

.panel-title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: #2f3a45;
}

.relay-copy {
  margin-bottom: 28px;
  font-size: 16px;
  color: #4f5d67;
}

.action-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.relay-feedback {
  margin: 16px 0 0;
  color: #3ba17c;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
}

.privacy-panel {
  padding: 24px 32px;
  background: #fafbFC;
}

.privacy-copy {
  margin: 0;
  color: #7b8690;
  font-size: 14.5px;
  line-height: 1.6;
}

/* 双列布局 */
.split-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
}

@media (min-width: 768px) {
  .split-grid {
    grid-template-columns: 1fr 1fr;
  }
}

/* 列表修饰 */
.custom-list {
  display: grid;
  gap: 24px;
}

.list-item {
  position: relative;
  padding-left: 18px;
}

.list-item::before {
  content: '';
  position: absolute;
  top: 6px;
  bottom: -24px;
  left: 0;
  width: 2px;
  background: #edf0f2;
}

.list-item:last-child::before {
  display: none;
}

.list-item::after {
  content: '';
  position: absolute;
  left: -4px;
  top: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #dbe2e7;
  border: 2px solid #fff;
}

.item-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 800;
  color: #7b8690;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.item-value {
  margin: 0;
  font-size: 15px;
  line-height: 1.65;
  color: #4f5d67;
}

/* 胶囊标签 */
.pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.pill {
  background: #f0f4f8;
  border: 1px solid #e1e7ec;
  color: #4f5d67;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
}

@media (max-width: 768px) {
  .intro-page-container {
    padding: 24px 16px 60px;
  }

  .intro-block, .info-panel {
    padding: 28px 20px;
    border-radius: 14px;
  }
  
  .privacy-panel {
    padding: 20px;
  }

  .action-row {
    flex-direction: column;
    gap: 12px;
  }
  
  .action-row .btn {
    width: 100%;
  }
}
</style>
