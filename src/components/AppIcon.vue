<script setup lang="ts">
const props = defineProps<{
  name:
    | 'copy'
    | 'download'
    | 'spinner'
    | 'refresh'
    | 'chart'
    | 'character'
    | 'quote'
    | 'book'
    | 'star'
    | 'warning'
    | 'fallback'
    | 'github'
  class?: string
}>()

// fill 型品牌图标（logo 本身是实心形状，不适合 stroke 描边）
const FILLED_ICONS = new Set(['github'])

const paths: Record<string, string[]> = {
  copy: [
    'M9 9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2z',
    'M5 15V5a2 2 0 0 1 2-2h10',
  ],
  download: [
    'M12 3v11',
    'm7 11 5 5 5-5',
    'M5 21h14',
  ],
  spinner: [
    'M21 12a9 9 0 1 1-6.219-8.56',
  ],
  refresh: [
    'M3 12a9 9 0 0 1 15.364-6.364L21 8',
    'M21 3v5h-5',
    'M21 12a9 9 0 0 1-15.364 6.364L3 16',
    'M8 16H3v5',
  ],
  chart: [
    'M4 20h16',
    'M7 16v-4',
    'M12 16V8',
    'M17 16V4',
  ],
  character: [
    'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z',
    'M4.5 20a7.5 7.5 0 0 1 15 0',
  ],
  quote: [
    'M9 11H5a2 2 0 0 0-2 2v2a4 4 0 0 0 4 4',
    'M19 11h-4a2 2 0 0 0-2 2v2a4 4 0 0 0 4 4',
  ],
  book: [
    'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 0 4 23Z',
    'M4 5.5v15',
    'M8 7h8',
  ],
  star: [
    'm12 3 2.9 5.88 6.49.94-4.7 4.58 1.11 6.45L12 17.77 6.2 20.85l1.11-6.45-4.7-4.58 6.49-.94z',
  ],
  warning: [
    'M12 4 21 20H3Z',
    'M12 9v5',
    'M12 18h.01',
  ],
  fallback: [
    'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z',
    'M4.5 20a7.5 7.5 0 0 1 15 0',
    'M18 6l2-2',
    'M20 6h-4',
  ],
  github: [
    'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z',
  ],
}
</script>

<template>
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    :fill="FILLED_ICONS.has(props.name) ? 'currentColor' : 'none'"
    :stroke="FILLED_ICONS.has(props.name) ? 'none' : 'currentColor'"
    :stroke-linecap="FILLED_ICONS.has(props.name) ? undefined : 'round'"
    :stroke-linejoin="FILLED_ICONS.has(props.name) ? undefined : 'round'"
    :stroke-width="FILLED_ICONS.has(props.name) ? undefined : '1.85'"
    :class="['app-icon', props.class]"
  >
    <path v-for="path in paths[props.name]" :key="path" :d="path" />
  </svg>
</template>

<style scoped>
.app-icon {
  width: 1em;
  height: 1em;
  flex: none;
}
</style>
