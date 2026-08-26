<script setup lang="ts">
import { computed } from 'vue'

import { useI18n, type AppLocale } from '../../i18n'

const { locale, t, tm } = useI18n()

// 评价引用的四个原型（id 对应 src/data/archetypes.json）
type TestimonialArchetypeId = 'shadow-strategist' | 'oathbound-captain' | 'moonlit-guardian' | 'chaos-spark'

// 匿名社区昵称：按语言本地化的轻口味署名，不做真人感伪装
const NICKNAMES: Record<AppLocale, string[]> = {
  'zh-CN': ['某个路过的 I 人', '拉全群来测的 E 人', '深夜补测试的旅人', '晒角色代码的群友'],
  'zh-TW': ['某個路過的 I 人', '拉全群來測的 E 人', '深夜補測試的旅人', '曬角色代碼的群友'],
  'en': ['passing introvert', 'the one who dragged the group in', 'night-shift tester', 'group-chat showoff'],
  'ja': ['通りすがりのI型', 'グループを巻き込んだE型', '深夜に受験した旅人', 'キャラコード自慢の住人'],
}

// 角色标签用 ACGTI 自己的原型体系，替代 16personalities 的官方角色名（名称按语言本地化）
const ARCHETYPE_LABELS: Record<AppLocale, Record<TestimonialArchetypeId, string>> = {
  'zh-CN': {
    'shadow-strategist': '影面策士',
    'oathbound-captain': '誓约队长',
    'moonlit-guardian': '月下守护者',
    'chaos-spark': '混沌火花',
  },
  'zh-TW': {
    'shadow-strategist': '影面策士',
    'oathbound-captain': '誓約隊長',
    'moonlit-guardian': '月下守護者',
    'chaos-spark': '混沌火花',
  },
  'en': {
    'shadow-strategist': 'Shadow Strategist',
    'oathbound-captain': 'Oathbound Captain',
    'moonlit-guardian': 'Moonlit Guardian',
    'chaos-spark': 'Chaos Spark',
  },
  'ja': {
    'shadow-strategist': '影の策士',
    'oathbound-captain': '誓約の隊長',
    'moonlit-guardian': '月夜の守護者',
    'chaos-spark': '混沌の火花',
  },
}

// 视觉字段（配色/头像渐变）保持原有卡片风格，仅替换署名与角色标签
const testimonialBase: Array<{
  archetypeId: TestimonialArchetypeId
  type: string
  color: string
  avatar: string
}> = [
  {
    archetypeId: 'shadow-strategist',
    type: 'INTJ',
    color: '#6b5a7f',
    avatar: '#ede8f0',
  },
  {
    archetypeId: 'oathbound-captain',
    type: 'ENTJ',
    color: '#2f6e55',
    avatar: '#e6efec',
  },
  {
    archetypeId: 'moonlit-guardian',
    type: 'INFJ',
    color: '#2f6a80',
    avatar: '#e6eef2',
  },
  {
    archetypeId: 'chaos-spark',
    type: 'ENTP',
    color: '#7a5f3a',
    avatar: '#faf3e0',
  },
]

const testimonials = computed(() =>
  testimonialBase.map((item, index) => ({
    ...item,
    name: NICKNAMES[locale.value][index] ?? '',
    role: ARCHETYPE_LABELS[locale.value][item.archetypeId],
    quote: tm<string[]>('home.testimonials')[index] ?? '',
  })),
)
</script>

<template>
  <section class="testimonials" v-reveal>
    <div class="quote-badge">"</div>
    <div class="container">
      <p class="testimonial-tag">Testimonials</p>
      <h2 class="testimonial-title">{{ t('home.testimonialsTitle') }}</h2>

      <div class="testimonial-track">
        <article v-for="item in testimonials" :key="item.archetypeId" class="testimonial-card">
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
</template>

<style scoped>
.container {
  width: min(1200px, calc(100% - 2rem));
  margin: 0 auto;
}

.testimonials {
  padding: 4rem 0;
  position: relative;
  background: #f8f9fa;
  border-top: 1px solid #eef2f4;
  border-bottom: 1px solid #eef2f4;
}

.quote-badge {
  display: none;
}

.testimonial-tag {
  text-align: center;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6b7a86;
  font-weight: 700;
  font-size: 0.74rem;
  margin: 0;
}

.testimonial-title {
  text-align: center;
  margin: 0.5rem 0 2rem;
  font-size: clamp(1.6rem, 3.8vw, 2.2rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #1f2a32;
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
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e3e8ee;
  overflow: hidden;
  scroll-snap-align: center;
}

.card-top {
  height: 3px;
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
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid #dde5ea;
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
  margin: 0.85rem 0 0;
  color: #4a5560;
  line-height: 1.7;
  font-size: 0.92rem;
}

@media (max-width: 768px) {
  .testimonial-track {
    grid-auto-columns: minmax(260px, 86vw);
  }
}
</style>
