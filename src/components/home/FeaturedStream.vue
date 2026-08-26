<script setup lang="ts">
import { useI18n } from '../../i18n'

const { t } = useI18n()
</script>

<template>
  <section class="featured-stream" v-reveal>
    <div class="container featured-stream-layout">
      <article class="featured-stream-copy">
        <p class="feature-tag featured-stream-tag">{{ t('home.socialProof.tag') }}</p>
        <h2 class="feature-title featured-stream-title">{{ t('home.socialProof.title') }}</h2>
        <p class="feature-copy featured-stream-body">{{ t('home.socialProof.copy') }}</p>
        <div class="featured-stream-meta">
          <span class="featured-stream-pill">{{ t('home.socialProof.pillA') }}</span>
          <span class="featured-stream-pill">{{ t('home.socialProof.pillB') }}</span>
        </div>
        <a
          href="https://www.bilibili.com/video/BV11FDyBZEN1/?spm_id_from=333.337.search-card.all.click"
          target="_blank"
          rel="noopener noreferrer"
          class="btn featured-stream-button"
        >
          <svg style="width: 20px; height: 20px;" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
          {{ t('home.socialProof.button') }}
        </a>
      </article>
      <aside class="featured-stream-visual" aria-hidden="true">
        <div class="featured-stream-card">
          <div class="featured-stream-card-top">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <img
            class="featured-stream-image"
            src="/images/characters/永雏塔菲.webp"
            :alt="t('home.socialProof.imageAlt')"
            width="380"
            height="420"
            decoding="async"
            loading="lazy"
          />
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.container {
  width: min(1200px, calc(100% - 2rem));
  margin: 0 auto;
}

.featured-stream {
  padding: 0 0 4.5rem;
}

.featured-stream-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
  gap: 2rem;
  align-items: center;
  padding: 1.75rem;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #e3e8ee;
}

.feature-tag {
  display: inline-flex;
  align-items: center;
  margin: 0 0 0.8rem;
  padding: 4px 10px;
  font-size: 0.74rem;
  letter-spacing: 0.04em;
  font-weight: 700;
  text-transform: uppercase;
  border-radius: 999px;
  border: 1px solid #eadfbe;
  background: #fdf8eb;
}

.featured-stream-tag {
  color: #8a6d1f;
}

.feature-title {
  margin: 0;
  font-size: clamp(2rem, 4.5vw, 2.7rem);
  line-height: 1.2;
}

.feature-copy {
  margin: 1rem 0 1.4rem;
  color: #5a6570;
  font-size: 1.02rem;
  line-height: 1.7;
}

.featured-stream-title {
  font-size: clamp(1.8rem, 4vw, 2.5rem);
}

.featured-stream-body {
  margin-bottom: 1.2rem;
}

.featured-stream-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.featured-stream-pill {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 0.85rem;
  border-radius: 999px;
  background: #fdf8eb;
  border: 1px solid #eadfbe;
  color: #7a5f17;
  font-size: 0.84rem;
  font-weight: 600;
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

.featured-stream-button {
  gap: 0.5rem;
  background: #3ba17c;
  border: 1px solid #2d9168;
}

.featured-stream-visual {
  display: flex;
  justify-content: center;
}

.featured-stream-card {
  width: min(100%, 380px);
  border-radius: 16px;
  overflow: hidden;
  background: #f8f9fa;
  border: 1px solid #e3e8ee;
}

.featured-stream-card-top {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 1rem 0;
}

.featured-stream-card-top span {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #c8d2d9;
  border: 1px solid #b8c4ce;
}

.featured-stream-image {
  display: block;
  width: 100%;
  height: 420px;
  object-fit: contain;
  padding: 1rem;
}

@media (max-width: 1024px) {
  .featured-stream-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .featured-stream-layout {
    padding: 1.4rem;
  }

  .featured-stream-image {
    height: 320px;
  }
}
</style>
