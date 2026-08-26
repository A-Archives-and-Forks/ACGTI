<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '../../i18n'

const { tm } = useI18n()
const stats = computed(() => tm<Array<{ value: string; label: string; color: string }>>('home.stats'))
</script>

<template>
  <section class="stats" v-reveal>
    <div class="container stat-grid">
      <div v-for="item in stats" :key="item.label" class="stat-item">
        <p class="stat-value" :style="{ color: item.color }">{{ item.value }}</p>
        <p class="stat-label">{{ item.label }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.container {
  width: min(1200px, calc(100% - 2rem));
  margin: 0 auto;
}

.stats {
  padding: 3rem 0;
  border-top: 1px solid #eef2f4;
  border-bottom: 1px solid #eef2f4;
  background: #ffffff;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  text-align: center;
}

.stat-value {
  margin: 0;
  font-size: clamp(1.8rem, 3.5vw, 2.4rem);
  line-height: 1;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.stat-label {
  margin: 0.5rem 0 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: #6b7680;
  letter-spacing: 0.01em;
}

@media (max-width: 1024px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 1.8rem;
  }
}
</style>
