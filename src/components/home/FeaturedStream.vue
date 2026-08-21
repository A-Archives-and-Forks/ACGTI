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
  padding: 2rem;
  border-radius: 28px;
  background: linear-gradient(135deg, #fff8e7 0%, #fff 48%, #f4faf8 100%);
  border: 1px solid #f0e3bb;
  box-shadow: 0 18px 48px rgba(58, 72, 84, 0.08);
}

.feature-tag {
  margin: 0 0 1rem;
  font-size: 0.78rem;
  letter-spacing: 0.13em;
  font-weight: 800;
  text-transform: uppercase;
}

.featured-stream-tag {
  color: #d39f1d;
}

.feature-title {
  margin: 0;
  font-size: clamp(2rem, 4.5vw, 2.7rem);
  line-height: 1.2;
}

.feature-copy {
  margin: 1.3rem 0 1.8rem;
  color: #666;
  font-size: 1.125rem;
  line-height: 1.75;
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
  min-height: 36px;
  padding: 0 0.95rem;
  border-radius: 999px;
  background: rgba(211, 159, 29, 0.12);
  color: #946c12;
  font-size: 0.9rem;
  font-weight: 700;
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
  gap: 0.55rem;
  background: #e1ab2f;
  box-shadow: 0 12px 26px rgba(161, 117, 16, 0.2);
}

.featured-stream-visual {
  display: flex;
  justify-content: center;
}

.featured-stream-card {
  width: min(100%, 380px);
  border-radius: 24px;
  overflow: hidden;
  background: linear-gradient(180deg, #fff7df 0%, #fff 100%);
  border: 1px solid #f0e1b2;
  box-shadow: 0 18px 44px rgba(90, 66, 16, 0.12);
}

.featured-stream-card-top {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 1rem 0;
}

.featured-stream-card-top span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #e6c76e;
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
