# ACGTI 架构说明（ARCHITECTURE.md）

> 审计视角的架构快照（2026-08-27，基线 b74f391）。项目自有文档见 README「架构与原理」与本地 docs/（architecture.md、backend.md、adr/）。

## 1. 系统拓扑

```
浏览器（Vue 3 SPA）
  │  本地算分：39 题 → quizEngine 四层评分 → 唯一角色代码
  │
  ├─ POST /api/submit        匿名聚合上报（fire-and-forget, sendBeacon）
  ├─ GET  /api/stats/result  结果页站内统计（读快照）
  ├─ POST /api/insight       AI 解读（分桶缓存）
  ├─ POST /api/feedback      真实 MBTI 反馈收集
  └─ GET  /api/config|stats/*  配置与榜单

Cloudflare Pages Functions（functions/）
  _middleware.ts：跨站写校验 + 安全面 + 首页追踪参数 301
  api/_shared.ts：白名单校验 / 分钟级 D1 限流 / 每日熔断 / timingSafeEqual

D1（acgti-stats）
  聚合表 archetype_counts / character_counts / pair_counts / daily_counts
  抽样表 submissions_sampled(+answers_blob)   反馈表 mbti_feedback
  缓存表 ai_insight_cache                     快照表 stats_snapshot
  限流表 _rate_limit

cron-worker（独立 Workers 项目，*/15 * * * *）
  重算 overview/archetypes/characters 快照 + 清理 _rate_limit 过期行
```

## 2. 前端计算管线（核心业务）

`src/utils/quizEngine.ts` 的 `calculateQuizResult`：

1. **维度得分**：逐题权重优先取 `questionDimensionWeights.json` 的"整体替换"覆盖，否则回退题目自带 dimension/sign；按作用方向分别归一化后夹取 [-1,1]。平局偏向正字母（E/S/T/J）。
2. **原型匹配**：8 原型原始分（题内 role 权重中心化归一 × 作答），直接取最高者。
3. **角色命中**：对 113 角色并行算四层分数线性加权——MBTI 柔性匹配 25%（matchCode+Flex 取最优）、原型得分 28%、六维向量余弦相似度 27%、角色专属签名轴/题目亲和 20%，再乘 matchWeight 排序；同分按中文名稳定排序。
4. **输出**：唯一 character code、四维百分比滑条（恒 ≥50）、Top4 匹配列表与人群概率先验。

预览路径 `createDebugQuizResult`（?character= 分享链接）不触达真实作答链路，且 ResultPage 会话去重保证 debug 结果不上报。

## 3. 后端 API 合同要点

| 端点 | 方法 | 鉴权 | 防线 |
| --- | --- | --- | --- |
| /api/submit | POST | 无（匿名统计） | 跨站中间件 + 30/min/IP；payload 全量白名单清洗；64KB 上限；失败静默 204 |
| /api/feedback | POST | 无 | 跨站中间件 + 5/min/IP；Turnstile 服务端校验**当前关闭**（TODO） |
| /api/insight | POST | fresh/provider 高权限字段需 Bearer ACGTI_PREWARM_TOKEN | 10/min/IP(strict) + fresh 子限流 2/min + 全站每日生成熔断 1000 + 缓存键内容版本化 |
| /api/stats/* | GET | 无 | 只读快照 + Cache-Control；result 参数经 isValidCode 白名单 |
| /api/config | GET | 无 | 仅下发非敏感 siteKey；本地回环才回测试密钥 |

AI provider 回退链：OpenAI 兼容网关（双通道，预热可指定）→ Workers AI binding → CF REST 凭据。全部未配置时返回 `no-binding` 明确降级。

## 4. 数据一致性设计

- 聚合表不可回撤 ⇒ submit 入口限流 + 答案合法性校验前置；
- 读多写少 ⇒ 统计一律走 cron 15 分钟快照，端点不直查全表排行（result.ts 仅单点 count 直查聚合表）；
- 快照缺失（新环境迁移未跑）⇒ 返回 fallback 零值而非报错；cron 侧缺失则 fail visible 跳过写入并打日志——两侧语义互补，绝不产出旧口径数据。
- AI 缓存键带 BRIEF_VERSION 与模型标签：档案文案或提示词升级后旧缓存自然失效。

## 5. 构建与校验流水线

- `npm run build` = validate:data（113 角色×视觉×i18n 交叉校验）→ generate:data → vue-tsc -b → vite build。
- CI 在其上追加：vitest、Functions/cron 双 tsc、`wrangler d1 migrations apply --local` 全新库干跑。
- 数据源单一事实在 `src/content/characters/*.json`（每角色一文件），构建期聚合成 src/data/* 运行时产物。

## 6. 关键权衡记录（审计确认属有意设计）

1. 聚合无幂等：接受重放刷量风险换取写入极简（限流缓解）。
2. 平局偏正字母：16personalities 风格 UI 百分比恒 ≥50。
3. 每日熔断先扣额后生成：网关故障烧额度只影响可用性不影响资损。
4. strict 限流仅用于付费路径：统计可用性与资损安全分层。
5. feedback 错误统一 500 通用文案：SQL 细节只留服务端日志。
