<template>
  <section class="panel progress-panel" :aria-label="label">
    <div class="progress-topline">
      <div>
        <p class="eyebrow">{{ label }}</p>
        <p class="progress-copy">第 {{ current }} / {{ total }} 题</p>
      </div>
      <p class="muted">已作答 {{ answered }} 题</p>
    </div>

    <div class="progress-track" aria-hidden="true">
      <div class="progress-fill" :style="{ width: `${percentage}%` }" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    current: number
    total: number
    answered: number
    label?: string
  }>(),
  {
    label: '测试进度',
  },
)

const percentage = computed(() => {
  if (props.total <= 0) return 0
  return Math.min(100, Math.max(0, (props.current / props.total) * 100))
})
</script>

<style scoped>
.progress-panel {
  display: grid;
  gap: 14px;
}

.progress-topline {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: end;
}

.progress-copy {
  margin: 0;
  font-size: 1.2rem;
  color: var(--text);
}

.progress-track {
  overflow: hidden;
  height: 12px;
  border-radius: 999px;
  background: var(--bg-soft, #f4f4f4);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05); /* 16Personalities style */
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--primary, #33a474);
  transition: width 300ms ease-out;
}

@media (max-width: 700px) {
  .progress-topline {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
