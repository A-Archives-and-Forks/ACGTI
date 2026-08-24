# ACGTI API 说明

本文面向贡献者与第三方调用者，说明 ACGTI 后端接口的行为约定。
后端由 Cloudflare Pages Functions（`functions/` 目录）+ D1 数据库实现，
核心测试计算在浏览器本地完成，服务端只接收最终命中的结果。

## 概述

- **匿名统计定位**：后端只收集聚合计数、约 2% 抽样的匿名逐题答案，
  以及用户主动提交的自评反馈，不涉及用户系统、登录或鉴权。
- **无鉴权**：所有接口均可匿名调用，不要在请求中携带任何凭据。唯一的
  例外是 `/api/insight` 的预热口子：`fresh` / `provider` 高权限字段仅对
  携带 `ACGTI_PREWARM_TOKEN` Bearer 令牌的运维预热请求生效，普通调用者
  无需（也无法）获取该令牌。
- **限流策略**：写入类接口基于 `CF-Connecting-IP` 做 **D1 分钟级限流**
  （按自然分钟分桶计数，过期行由 Cron Worker 清理），**各端点独立计数
  （scope 隔离）**——一次完整流程（1 次 submit + 数次 insight + 1 次 feedback）
  不会在同分钟内互相挤占额度。各接口阈值见下表。
  限流计数表异常时：统计类端点降级放行（可用性优先）；付费生成路径
  （insight）fail-closed 直接拒绝，防止打满 D1 写入配额让限流失效后刷穿
  上游额度。
- **跨站写入校验**：`/api/` 的 POST / PUT / PATCH 请求要求同源
  （见 `functions/_middleware.ts`）：`Origin` 存在时必须与请求同源
  （localhost 任意端口视为本地联调放行），`Sec-Fetch-Site: cross-site`
  直接拒绝，返回 `403` `{error:"cross-site request rejected"}`；
  不带浏览器头的非浏览器客户端（curl 等）不受影响。
- **安全响应头**：所有 `/api/` 路径的响应统一附加
  `X-Content-Type-Options: nosniff` 与 `Referrer-Policy: no-referrer`
  （见 `functions/_middleware.ts`）。
- **统计快照**：stats 系列接口的数据来自 `stats_snapshot` 快照表，
  由 Cron Worker（`cron-worker/`）每 15 分钟刷新一次，
  响应中的 `updatedAt` 为快照生成时间。

## 端点速览

| 方法 | 路径 | 用途 | 成功响应 | 限流（次/分钟/IP） | 缓存 |
| ---- | ---- | ---- | -------- | ------------------ | ---- |
| GET | `/api/ping` | 健康检查 | `200` 纯文本 `pong` | 无 | 无 |
| GET | `/api/config` | 前端运行时配置（Turnstile 站点密钥） | `200` JSON | 无 | `no-store` |
| POST | `/api/submit` | 上报测试结果（聚合计数 + 2% 抽样明细） | `204` 空体 | 30 | 无 |
| POST | `/api/feedback` | 提交真实 MBTI 自评反馈 | `200` `{ok:true}` | 5 | 无 |
| POST | `/api/insight` | AI 结果解读（Workers AI） | `200` JSON | 10 | 服务端 D1 缓存 |
| GET | `/api/stats/overview` | 总提交数 / 今日 / 近两日 | `200` `{data, updatedAt}` | 无 | `max-age=60` |
| GET | `/api/stats/archetypes` | 原型命中排行（全量，按 count 降序） | `200` `{data, updatedAt}` | 无 | `max-age=120` |
| GET | `/api/stats/characters` | 角色命中排行（前 200 名） | `200` `{data, updatedAt}` | 无 | `max-age=120` |
| GET | `/api/stats/result` | 结果页专用统计（需 `character` / `archetype` 查询参数） | `200` `{data, updatedAt}` | 无 | `max-age=300` |

## 公开规范文件

完整的请求 / 响应结构、字段校验规则与错误码以 OpenAPI 3.1.0 规范为准：

- 部署后线上地址：`https://<站点域名>/api/openapi.yaml`
- 仓库内源文件：[`public/api/openapi.yaml`](../public/api/openapi.yaml)

`public/` 下的文件在构建时会被复制到 `dist/api/`，因此规范文件与
Functions 共享 `/api/` 前缀：请求会先经过 `functions/_middleware.ts`
（附加安全响应头），再回落到静态文件。修改接口时请同步更新规范文件。

## 答案量程约定

前端 UI 的作答控件是 **7 档量程（±3）**，而后端与历史数据约定为
**5 档量程（±2）**。上报时由前端把 ±3 压缩到 ±2：

```
answerValue = max(-2, min(2, round(原始 7 档值)))
```

压缩逻辑位于 `src/pages/ResultPage.vue` 的 `collectAnswerList()`，
服务端校验位于 `functions/api/_shared.ts` 的 `validateAnswers()`
（`answerValue` 合法区间为 [-2, 2]，`questionId` 截断到 16 字符）。
两侧必须保持一致，**勿单独改动任何一侧**。

另注意两处差别：

- `/api/submit` 对 `answers` 做白名单校验：必须是 20~100 条的数组，逐条
  校验结构（`questionId` / `answerValue`），且清洗后的序列化体积上限 64KB，
  任一不满足即整条静默丢弃（仍返回 204）；
- `/api/feedback` 对 `answers` 逐条严格校验，任一条目非法即返回 400。

## AI 解读（insight）的隐私与缓存设计

`/api/insight` 是渐进增强能力，设计决策详见
`docs/adr/0006-ai-insight-workers-ai.md`，要点：

- **隐私**：请求只包含角色代码、语言与四维倾向分（[-1, 1]），
  **绝不上传逐题答案**或其他可还原测试内容的字段。
- **缓存**：以「角色代码 + 语言 + 四维倾向分桶」为键写入 D1 缓存，
  相同画像全站共享一次生成结果。分桶规则：|score| ≥ 0.5 记为明显、
  ≥ 0.2 记为中等、否则轻微，因此同一角色每种语言最多 81 种桶组合，
  模型消耗与桶数同阶。请求带 `fresh: true` 可跳过缓存强制重新生成。
- **防滥用（多层）**：
  - 单 IP 分钟限流 10 次，且生成路径 **fail-closed**（D1 不可用时拒绝）；
  - `fresh` 有独立子限流（未鉴权请求 2 次/分/IP），超限时静默降级为读缓存；
  - **全站每日生成熔断**：未鉴权请求每日真实生成总量上限（默认 1000，
    可用 `ACGTI_INSIGHT_DAILY_LIMIT` 覆盖，UTC 日切换），超限返回
    `reason: "daily-limit"` 隐藏卡片，缓存命中不计数——这是挡 IP 池轮换的
    最后一道硬顶；
  - **预热鉴权**：`fresh` / `provider` 是高权限字段，仅对携带
    `Authorization: Bearer <ACGTI_PREWARM_TOKEN>` 的预热请求开放（令牌比对
    为恒定时间比较）；未配置令牌时所有请求一律按普通请求处理。`provider`
    可指定网关通道（`aigw` / `aigw2`），外部请求该字段无效，永远走主通道。
- **降级**：未绑定任何 AI 通道、生成失败、输出为空、未知角色、超出每日
  熔断时均返回 `available: false`（`text: null` 且带 `reason`），前端隐藏
  解读卡片，结果页静态解析文案不受影响。

## 错误约定

- **204 防枚举（仅 `/api/submit`）**：`submit` 直接写聚合计数表，
  且聚合表无法事后剔除脏数据，因此接口对「成功」「校验失败」「内部错误」
  一律返回 **204 空响应**——调用方无法从状态码探测提交是否被入库，
  也无法用响应差异枚举有效字段组合。唯一的例外是限流，超限返回 `429` 空响应。
- **`/api/feedback`**：非法输入返回 `400`（纯文本错误信息，非 JSON），
  数据库失败返回 `500` `{ok:false, error:"internal"}`（SQL 细节只留服务端日志），
  限流返回 `429` 空响应。
- **`/api/insight`**：所有错误都是 JSON，形如
  `{text:null, available:false, reason:"..."}`；`400` 为 `bad-json` /
  `invalid-payload`，`429` 为 `rate-limited`（本端点限流或上游网关限流透传），
  其余 200 降级原因（`unknown-character` / `no-binding` /
  `generation-failed` / `empty-output` / `daily-limit`）见 OpenAPI 规范。
- **stats 系列**：`/api/stats/result` 缺参数返回 `400` `{error:"missing character or archetype param"}`；
  快照表缺失时返回零值数据（`updatedAt: null`）而非报错，其余内部错误返回 `500` `{error:"internal"}`。

## 相关文件索引

| 关注点 | 位置 |
| ------ | ---- |
| 各端点实现 | `functions/api/*.ts`、`functions/api/stats/*.ts` |
| 校验与限流工具 | `functions/api/_shared.ts` |
| 安全响应头与首页重定向 | `functions/_middleware.ts` |
| 统计快照生成 | `cron-worker/src/index.ts` |
| 前端上报封装 | `src/utils/statsReporter.ts` |
| 数据库结构 | `migrations/` |
