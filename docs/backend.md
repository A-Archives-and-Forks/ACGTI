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
│   ├── insight.ts        # AI 结果解读（Workers AI + D1 缓存，限流 10 次/分/IP）
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
| `/api/insight` | POST | 200 `{text, cached, available}` | 400 参数非法 / 429 超限 |
| `/api/ping` | GET | 200 `pong`（text/plain） | — |

设计要点：

- **聚合表不可逆**：`submit` 直接对 `archetype_counts` / `character_counts` / `pair_counts` / `daily_counts` 做 UPSERT 自增，无法事后剔除脏数据，因此入口配了分钟级限流兜底。
- **答案量程约定**：前后端约定反馈/明细中的 `answerValue` 为五档量程（±2），前端会把七档 UI 的 ±3 压缩后上报（见 `src/pages/ResultPage.vue` 的 `collectAnswerList` 与 `functions/api/_shared.ts` 的 `validateAnswers`，两侧需同步修改）。
- **版本号单一来源**：`appVersion` 来自 `package.json`（vite define 注入），上限 32 字符。

## AI 结果解读（/api/insight）

结果页的「AI 解读」卡片由 Workers AI 生成个性化文案，遵循三条硬约束：

1. **隐私**：请求只包含角色代码、四维倾向分（-1~1）与语言，绝不包含逐题答案；提示词素材来自构建期生成的 `functions/api/_data/characterBrief.json`（角色名/系列/标签，随 `npm run generate:data` 自动同步）。
2. **成本**：以「角色 + 四维倾向分桶（强/中/轻微，3⁴=81 桶）+ 语言」为缓存键写入 `ai_insight_cache`（迁移 0009），相同画像全站共享一次生成结果；免费额度（每日 10000 Neurons）下消耗与桶数同阶而非与流量同阶。前端「换一种说法」走 `fresh: true` 重新生成并覆盖缓存，同一结果限 3 次（sessionStorage 计数）。
3. **降级**：未绑定 AI、额度耗尽或生成失败一律返回 `{text:null, available:false}`，前端隐藏整卡，结果页静态解析不受影响。

配置：`wrangler.jsonc` 已声明 `"ai": {"binding": "AI"}`，部署到 Cloudflare Pages 即自动生效，无需任何密钥。模型为 `@cf/meta/llama-3.2-3b-instruct`（温度 0.2），升级模型时需同步清空 `ai_insight_cache`（缓存行记录了 `model` 字段可按需清理）。

### 本地联调（受限网络环境）

本地 `wrangler pages dev` 的 AI binding 走 wrangler 远程代理会话（部署在 `<随机hash>.<账号>.workers.dev`）。实测受限网络下该域名存在两层封锁：系统 DNS 被随机投毒（返回被墙站点 IP）+ 真实 IP 的 TLS 流量被按 SNI 重置，远程绑定 RPC 会确定性 `internal error` 并拖垮进程；而经本机代理访问 Cloudflare API 完全正常。

为此 `npm run dev:pages`（`scripts/dev-pages.mjs`）提供本地联调模式：

1. 临时剥离 `wrangler.jsonc` 的 ai binding（退出自动恢复）；
2. `/api/insight` 由此走 REST 直连回退（`runModel` 读 `.dev.vars` 中自动注入的 `ACGTI_AI_TOKEN` / `ACGTI_AI_ACCOUNT_ID`，凭据复用 wrangler 本地 OAuth 登录态，退出时按标记移除）；
3. 注入 `scripts/wrangler-proxy-preload.cjs`：对 Node 侧三类出站路径（https.request 的 createConnection、https.Agent 原型、undici 全局 dispatcher）统一接管为代理 CONNECT 隧道——wrangler 自身的远程连接不遵守 `https_proxy` 环境变量，这是本地不崩的前提。

各层诊断结论记录在 `scripts/wrangler-proxy-preload.cjs` 头部注释。

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

`analysis/` 目录提供反馈数据的导出、落地与分析脚本（基于用户自愿提交的自报 MBTI 样本做题目权重校准），其中 `item_health.py` 产出题目区分度（校正题总相关）与维度信度（Cronbach alpha）报表，是改题前的第一道体检；依赖与用法见各脚本头部注释；完整说明保存在本地的 `analysis/README.md`（含内部数据规模，不随仓库发布）。全库备份流程见本地文档 `docs/d1-backup.md`。
