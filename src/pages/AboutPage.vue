<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../i18n'
import { useSeo } from '../composables/useSeo'

const { t, tm } = useI18n()

const faqItems = computed(() => tm<string[][]>('about.faqItems'))
const faqJsonLd = computed(() => [
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.value.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ACGTI',
    alternateName: 'ACG Type Indicator',
    description: '以 MBTI 为基础的二次元角色原型测试工具，通过情境式问题生成专属角色代码和原型报告。',
    url: 'https://acgti.tianxingleo.top',
    applicationCategory: 'Entertainment',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CNY',
    },
    author: {
      '@type': 'Person',
      name: 'tianxingleo',
      url: 'https://github.com/tianxingleo',
    },
  },
])

useSeo({
  title: '关于 ACGTI - ACG Type Indicator 二次元人格测试 | 项目说明与常见问题',
  description: 'ACGTI（ACG Type Indicator）是以 MBTI 为基础的二次元角色原型测试工具。39 道情境题、8 大原型、110 位角色，支持中英日多语言。了解项目定位、当前功能、技术边界与常见问题。',
  path: '/about',
  jsonLd: faqJsonLd,
})
</script>

<template>
  <div class="about-page-container">
    <div class="about-layout">
      <div class="page-stack">
        <section class="intro-block" v-reveal>
          <p class="eyebrow">{{ t('about.eyebrow') }}</p>
          <h1 class="page-title">{{ t('about.title') }}</h1>
          <p class="lead">{{ t('about.leadA') }}</p>
          <p class="lead">{{ t('about.leadB') }}</p>
          
          <div class="action-wrap">
            <a href="https://github.com/tianxingleo/ACGTI" target="_blank" rel="noopener noreferrer" class="btn btn-green github-btn">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              {{ t('about.star') }}
            </a>
            <p class="action-note">
              {{ t('about.feedbackIntro') }}
              <a href="https://github.com/tianxingleo/ACGTI/issues" target="_blank" rel="noopener noreferrer">{{ t('about.issue') }}</a>
            </p>
          </div>
        </section>

        <section class="split-grid" v-reveal>
          <article class="info-panel">
            <div class="panel-icon-wrap" style="color: #3ba17c;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 32px; height: 32px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <h2 class="panel-title">{{ t('about.boundaryTitle') }}</h2>
            <div class="custom-list">
              <div v-for="item in tm<string[][]>('about.boundaryItems')" :key="item[0]" class="list-item">
                <span class="item-label">{{ item[0] }}</span>
                <p class="item-value">{{ item[1] }}</p>
              </div>
            </div>
          </article>

          <article class="info-panel">
            <div class="panel-icon-wrap" style="color: #4298b4;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 32px; height: 32px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <h2 class="panel-title">{{ t('about.shippedTitle') }}</h2>
            <div class="custom-list">
              <div v-for="item in tm<string[][]>('about.shippedItems')" :key="item[0]" class="list-item">
                <span class="item-label">{{ item[0] }}</span>
                <p class="item-value">{{ item[1] }}</p>
              </div>
            </div>
          </article>
        </section>

        <section class="faq-panel" v-reveal>
          <div class="faq-header">
            <p class="eyebrow">{{ t('about.faqEyebrow') }}</p>
            <h2 class="panel-title">{{ t('about.faqTitle') }}</h2>
            <p class="faq-lead">{{ t('about.faqLead') }}</p>
          </div>
          <div class="faq-grid">
            <article v-for="item in faqItems" :key="item[0]" class="faq-card">
              <h3 class="faq-question">{{ item[0] }}</h3>
              <p class="faq-answer">{{ item[1] }}</p>
            </article>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.about-page-container {
  background: #f9f9f9;
  min-height: 100vh;
  padding: 40px 24px 80px;
  color: #333e49;
}

.about-layout {
  max-width: 1000px;
  margin: 0 auto;
}

.page-stack {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* 上半部分：白底轻投影介绍框 */
.intro-block {
  background: #ffffff;
  border: 1px solid #e8ecef;
  border-radius: 18px;
  padding: 48px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
}

.eyebrow {
  margin: 0 0 12px;
  color: #3ba17c;
  font-weight: 800;
  font-size: 14px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.page-title {
  margin: 0 0 24px;
  font-size: clamp(32px, 5vw, 42px);
  font-weight: 800;
  color: #2f3a45;
  line-height: 1.2;
}

.lead {
  margin: 0 0 16px;
  font-size: 17px;
  line-height: 1.7;
  color: #5f6b75;
  font-weight: 500;
}

.lead:last-of-type {
  margin-bottom: 0;
}

.action-wrap {
  margin-top: 32px;
}

.action-note {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: #6b7680;
}

.action-note a {
  color: #3ba17c;
  font-weight: 700;
  text-decoration: none;
}

.action-note a:hover {
  text-decoration: underline;
}

.github-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #3ba17c;
  color: #fff;
  padding: 12px 24px;
  border-radius: 30px;
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s;
}

.github-btn:hover {
  background: #2d8a68;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 161, 124, 0.25);
}

.github-btn svg {
  width: 20px;
  height: 20px;
}

/* 下半部分：双列面板 */
.split-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

@media (min-width: 768px) {
  .split-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.info-panel {
  background: linear-gradient(180deg, #ffffff, #fbfdfb);
  border: 1px solid #e8ecef;
  border-radius: 18px;
  padding: 36px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
}

.panel-icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #f4f6f8;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.panel-title {
  margin: 0 0 28px;
  font-size: 24px;
  font-weight: 800;
  color: #2f3a45;
}

/* 列表修饰 */
.custom-list {
  display: grid;
  gap: 24px;
}

.faq-panel {
  background: linear-gradient(180deg, #ffffff, #fafcfb);
  border: 1px solid #e8ecef;
  border-radius: 18px;
  padding: 36px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
}

.faq-header {
  display: grid;
  gap: 8px;
  margin-bottom: 28px;
}

.faq-lead {
  margin: 0;
  color: #5f6b75;
  line-height: 1.7;
  font-size: 16px;
}

.faq-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.faq-card {
  background: #f9fbfc;
  border: 1px solid #e8ecef;
  border-radius: 16px;
  padding: 22px;
}

.faq-question {
  margin: 0 0 12px;
  font-size: 18px;
  line-height: 1.45;
  color: #2f3a45;
}

.faq-answer {
  margin: 0;
  color: #5f6b75;
  line-height: 1.75;
  font-size: 15px;
}

@media (max-width: 900px) {
  .faq-grid {
    grid-template-columns: 1fr;
  }
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

@media (max-width: 768px) {
  .about-page-container {
    padding: 24px 16px 60px;
  }

  .intro-block, .info-panel {
    padding: 24px;
    border-radius: 14px;
  }

  .page-title {
    font-size: 28px;
    margin-bottom: 16px;
  }

  .panel-title {
    font-size: 22px;
    margin-bottom: 20px;
  }
  
  .lead {
    font-size: 15px;
  }

  .action-wrap {
    margin-top: 24px;
  }
}
</style>
