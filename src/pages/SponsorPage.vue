<script setup lang="ts">
import { useI18n } from '../i18n'
import { useSeo } from '../composables/useSeo'

const { t } = useI18n()

useSeo({
  title: t('sponsor.seoTitle'),
  description: t('sponsor.seoDescription'),
  path: '/sponsor',
})
</script>

<template>
  <div class="sponsor-page-container">
    <div class="sponsor-layout">
      <div class="page-stack">
        <!-- 主介绍区 -->
        <section class="intro-block" v-reveal>
          <p class="eyebrow">{{ t('sponsor.eyebrow') }}</p>
          <h1 class="page-title">{{ t('sponsor.title') }}</h1>
          <p class="lead">{{ t('sponsor.leadA') }}</p>
          <p class="lead">{{ t('sponsor.leadB') }}</p>

          <div class="cost-tags">
            <span v-for="tag in (['server', 'domain', 'database', 'cdn', 'ai'] as const)" :key="tag" class="cost-tag">
              {{ t(`sponsor.costTags.${tag}`) }}
            </span>
          </div>

          <div class="action-wrap">
            <a href="https://github.com/tianxingleo/ACGTI" target="_blank" rel="noopener noreferrer" class="btn btn-green github-btn">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              {{ t('sponsor.star') }}
            </a>
          </div>
        </section>

        <!-- 免责声明 -->
        <section class="disclaimer-block" v-reveal>
          <div class="disclaimer-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <p class="disclaimer-text">{{ t('sponsor.disclaimer') }}</p>
        </section>

        <!-- 赞助方式 -->
        <section class="methods-section" v-reveal>
          <p class="eyebrow">{{ t('sponsor.methodsEyebrow') }}</p>
          <h2 class="section-title">{{ t('sponsor.methodsTitle') }}</h2>
          <p class="section-lead">{{ t('sponsor.methodsLead') }}</p>

          <div class="methods-grid">
            <!-- 微信 -->
            <div class="method-card">
              <div class="method-icon wechat-icon">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zM14.033 13.3c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982z"/></svg>
              </div>
              <h3 class="method-name">{{ t('sponsor.wechat') }}</h3>
              <p class="method-desc">{{ t('sponsor.wechatDesc') }}</p>
              <div class="qr-placeholder">
                <img :src="'/images/wechat-qr.webp'" :alt="t('sponsor.wechatQrAlt')" loading="lazy" />
              </div>
            </div>

            <!-- 支付宝 -->
            <div class="method-card">
              <div class="method-icon alipay-icon">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.422 15.358c-3.32-1.326-6.092-3.014-6.092-3.014s1.439-3.667 1.853-5.943H13.01V4.79h5.16V3.478h-5.16V.296h-2.384s-.036.024-.036.036v3.146H5.44V4.79h5.15V4.2h-5.15v1.2h5.15v.038h2.42v2.563H7.22v1.312h8.15c-.3 1.35-.9 3.15-.9 3.15s-3.6-1.8-6.58-2.25c-3.98-.6-8.76.6-9.13 4.24-.37 3.64 3.72 5.4 6.6 5.58 2.88.18 5.94-1.2 8.16-3.24 1.44 1.02 4.5 2.76 8.64 3.84L24 18.58s-1.62-1.62-2.578-3.222zM8.3 18.56c-3.24.12-6.12-1.2-6.24-3.6-.12-2.4 2.64-3.72 5.4-3.72 2.76 0 5.52 1.2 7.92 3.12-1.92 2.04-4.44 4.08-7.08 4.2z"/></svg>
              </div>
              <h3 class="method-name">{{ t('sponsor.alipay') }}</h3>
              <p class="method-desc">{{ t('sponsor.alipayDesc') }}</p>
              <div class="qr-placeholder">
                <img :src="'/images/alipay-qr.webp'" :alt="t('sponsor.alipayQrAlt')" loading="lazy" />
              </div>
            </div>
          </div>
        </section>

        <!-- 其他支持方式 -->
        <section class="other-ways" v-reveal>
          <p class="eyebrow">{{ t('sponsor.otherEyebrow') }}</p>
          <h2 class="section-title">{{ t('sponsor.otherTitle') }}</h2>
          <div class="ways-grid">
            <div class="way-card">
              <div class="way-icon" style="color: #e5b540;">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279L12 19.771l-7.416 3.642 1.48-8.279L0 9.306l8.332-1.151z"/></svg>
              </div>
              <h3 class="way-name">{{ t('sponsor.wayStar') }}</h3>
              <p class="way-desc">{{ t('sponsor.wayStarDesc') }}</p>
            </div>
            <div class="way-card">
              <div class="way-icon" style="color: #4298b4;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
              </div>
              <h3 class="way-name">{{ t('sponsor.wayShare') }}</h3>
              <p class="way-desc">{{ t('sponsor.wayShareDesc') }}</p>
            </div>
            <div class="way-card">
              <div class="way-icon" style="color: #9474a4;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <h3 class="way-name">{{ t('sponsor.wayFeedback') }}</h3>
              <p class="way-desc">{{ t('sponsor.wayFeedbackDesc') }}</p>
            </div>
          </div>
        </section>

        <!-- 感谢 -->
        <section class="thanks-block" v-reveal>
          <p class="thanks-text">{{ t('sponsor.thanks') }}</p>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sponsor-page-container {
  background: #f9f9f9;
  min-height: 100vh;
  padding: 40px 24px 80px;
  color: #333e49;
}

.sponsor-layout {
  max-width: 900px;
  margin: 0 auto;
}

.page-stack {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* 主介绍区 */
.intro-block {
  background: linear-gradient(135deg, #ffffff 0%, #f0faf5 100%);
  border: 1px solid #e0ece6;
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
  font-size: clamp(28px, 5vw, 38px);
  font-weight: 800;
  color: #2f3a45;
  line-height: 1.25;
}

.lead {
  margin: 0 0 16px;
  font-size: 17px;
  line-height: 1.7;
  color: #5f6b75;
  font-weight: 500;
}

.cost-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
  margin-bottom: 28px;
}

.cost-tag {
  display: inline-block;
  padding: 6px 14px;
  background: rgba(59, 161, 124, 0.08);
  color: #3ba17c;
  font-size: 13px;
  font-weight: 700;
  border-radius: 20px;
  border: 1px solid rgba(59, 161, 124, 0.15);
}

.action-wrap {
  margin-top: 8px;
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

/* 免责声明 */
.disclaimer-block {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: #fffbf0;
  border: 1px solid #f0e6c8;
  border-radius: 14px;
  padding: 20px 24px;
}

.disclaimer-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #fff8e1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e67e22;
}

.disclaimer-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #8a7553;
}

/* 赞助方式 */
.methods-section {
  background: linear-gradient(180deg, #ffffff, #fafcfb);
  border: 1px solid #e8ecef;
  border-radius: 18px;
  padding: 36px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
}

.section-title {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 800;
  color: #2f3a45;
}

.section-lead {
  margin: 0 0 28px;
  font-size: 15px;
  color: #5f6b75;
  line-height: 1.7;
}

.methods-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.method-card {
  background: #f9fbfc;
  border: 1px solid #e8ecef;
  border-radius: 16px;
  padding: 28px;
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.method-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
}

.method-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.method-icon svg {
  width: 28px;
  height: 28px;
}

.wechat-icon {
  background: #e8f5e9;
  color: #07c160;
}

.alipay-icon {
  background: #e3f2fd;
  color: #1677ff;
}

.method-name {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 700;
  color: #2f3a45;
}

.method-desc {
  margin: 0 0 20px;
  font-size: 13px;
  color: #8a9aa8;
  line-height: 1.5;
}

.qr-placeholder {
  width: 180px;
  height: 180px;
  margin: 0 auto;
  border-radius: 12px;
  overflow: hidden;
  background: #f0f2f5;
  border: 1px solid #e0e3e6;
}

.qr-placeholder img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 其他支持方式 */
.other-ways {
  background: linear-gradient(180deg, #ffffff, #fafcfb);
  border: 1px solid #e8ecef;
  border-radius: 18px;
  padding: 36px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
}

.ways-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 24px;
}

.way-card {
  background: #f9fbfc;
  border: 1px solid #e8ecef;
  border-radius: 16px;
  padding: 24px;
  text-align: center;
}

.way-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: #f4f6f8;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
}

.way-icon svg {
  width: 24px;
  height: 24px;
}

.way-name {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
  color: #2f3a45;
}

.way-desc {
  margin: 0;
  font-size: 14px;
  color: #7b8a94;
  line-height: 1.6;
}

/* 感谢 */
.thanks-block {
  text-align: center;
  padding: 24px;
  background: linear-gradient(135deg, rgba(59, 161, 124, 0.06) 0%, rgba(66, 152, 180, 0.06) 100%);
  border-radius: 16px;
  border: 1px solid rgba(59, 161, 124, 0.1);
}

.thanks-text {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #3ba17c;
  line-height: 1.7;
}

/* 响应式 */
@media (max-width: 768px) {
  .sponsor-page-container {
    padding: 24px 16px 60px;
  }

  .intro-block,
  .methods-section,
  .other-ways {
    padding: 24px;
    border-radius: 14px;
  }

  .page-title {
    font-size: 26px;
  }

  .methods-grid {
    grid-template-columns: 1fr;
  }

  .ways-grid {
    grid-template-columns: 1fr;
  }

  .qr-placeholder {
    width: 200px;
    height: 200px;
  }
}

@media (max-width: 480px) {
  .cost-tags {
    gap: 8px;
  }

  .cost-tag {
    font-size: 12px;
    padding: 5px 10px;
  }
}
</style>
