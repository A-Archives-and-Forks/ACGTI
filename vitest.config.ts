import { defineConfig } from 'vitest/config'

// 单测只覆盖纯函数模块（quizEngine / color / storage），
// UI 与接口链路由 scripts/e2e-smoke.mjs 无头浏览器冒烟负责。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
