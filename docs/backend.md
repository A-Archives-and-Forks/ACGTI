# 后端架构说明（Cloudflare Pages Functions + D1）

本文面向贡献者与部署者，介绍 ACGTI 后端的接口、数据库、定时任务与可选配置。核心原则：**测试计分全部在浏览器本地完成，后端只做匿名统计的收集与查询**，不涉及用户系统与鉴权。

## 目录结构

```text
functions/                # Cloudflare Pages Functions（后端 API）
├── _middleware.ts        # 全局中间件：首页追踪参数 301 清洗 + /api/* 安全响应头
├── api/
│   ├── _shared.ts        # 输入校验工具、Turnstile 校验、D1 分钟级限流
│   ├── config.ts         # 运行时配置（Turnstile site key 下发）
│   ├── submit.ts         # 结果匿名上报（聚合表自增 + 2% 抽样明细，限流 30 次/分/IP）
│   ├── feedback.ts       # 用户自报 MBTI 反馈（限流 5 次/分/IP，含答案明细）
│   ├── ping.ts           # 健康检查
│   └── stats/            # 统计查询接口（读取快照/聚合表，带 5 分钟缓存）
│       ├── overview.ts   # 总量 / 今日 / 近两日
│       ├── archetypes.ts # 原型分布排行
│       ├── characters.ts # 角色命中排行
│       └── result.ts     # 结果页专用：当前角色/原型的占比与排名

cron-worker/              # 独立 Cloudflare Worker（非 Pages）
└── src/index.ts          # 每 15 分钟重算统计快照 + 清理限流表过期行

migrations/               # D1 迁移（CI 会在全新库上按序干跑，保证可重现）
```

## API 约定

| 端点 | 方法 | 成功 | 失败 |
|:--|:--|:--|:--|
| `/api/submit` | POST | 204 空体（防枚举，输入非法同样 204） | 429 超限 |
| `/api/feedback` | POST | 200 `{ok:true}` | 400/429/500 `{ok:false,error}` |
| `/api/stats/*` | GET | 200 `{data, updatedAt}` | 500 `{error}` |
| `/api/config` | GET | 200 `{turnstileSiteKey?}` | — |
| `/api/ping` | GET | 200 `pong`（text/plain） | — |

设计要点：

- **聚合表不可逆**：`submit` 直接对 `archetype_counts` / `character_counts` / `pair_counts` / `daily_counts` 做 UPSERT 自增，无法事后剔除脏数据，因此入口配了分钟级限流兜底。
- **答案量程约定**：前后端约定反馈/明细中的 `answerValue` 为五档量程（±2），前端会把七档 UI 的 ±3 压缩后上报（见 `src/pages/ResultPage.vue` 的 `collectAnswerList` 与 `functions/api/_shared.ts` 的 `validateAnswers`，两侧需同步修改）。
- **版本号单一来源**：`appVersion` 来自 `package.json`（vite define 注入），上限 32 字符。

## 数据库迁移

```bash
# 本地全新库按序执行全部迁移（CI 也会跑这一步）
npx wrangler d1 migrations apply acgti-stats --local

# 应用到远程库
npx wrangler d1 migrations apply acgti-stats --remote
```

注意：**已发布的迁移文件不可回改**——迁移按文件名记录应用状态，回改会导致全新环境与线上环境结构分叉（0001/0006 曾因此冲突，现已修复并加了 CI 干跑防护）。

建议预览与生产使用独立的 D1 实例，避免测试数据污染正式统计。

## cron-worker

每 15 分钟执行：

1. 从聚合表重算 `overview` / `archetypes` / `characters` 三份快照写入 `stats_snapshot`；
2. 清理 `_rate_limit` 表的过期行（该表只写不清会无限膨胀）。

手动触发 `POST /trigger`：配置了 `CRON_TRIGGER_SECRET` 环境变量时要求 `Authorization: Bearer <secret>`，未配置则开放（仅建议本地）。部署：`cd cron-worker && npm run deploy`。

## 可选配置：Turnstile 人机验证

反馈端点已内置服务端校验逻辑（`verifyTurnstile`），当前默认未启用：

- `VITE_TURNSTILE_SITE_KEY`：前端 site key（Pages 环境变量）。
- `TURNSTILE_SECRET`：服务端 secret（`wrangler pages secret put TURNSTILE_SECRET`）。
- 本地未配置时自动回退 Cloudflare 测试 key，可直接跑通链路。

如需恢复强制校验，在 `functions/api/feedback.ts` 中重新接入 `verifyTurnstile`（代码已保留）。

## 数据分析流水线（本地）

`analysis/` 目录提供反馈数据的导出、落地与分析脚本（基于用户自愿提交的自报 MBTI 样本做题目权重校准），依赖与用法见各脚本头部注释；完整说明保存在本地的 `analysis/README.md`（含内部数据规模，不随仓库发布）。全库备份流程见本地文档 `docs/d1-backup.md`。
