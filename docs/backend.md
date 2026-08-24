# 后端架构说明（Cloudflare Pages Functions + D1）

本文面向贡献者与部署者，介绍 ACGTI 后端的接口、数据库、定时任务与可选配置。核心原则：**测试计分全部在浏览器本地完成，后端只做匿名统计的收集与查询**，不涉及用户系统与鉴权。

## 目录结构

```text
functions/                # Cloudflare Pages Functions（后端 API）
├── _middleware.ts        # 全局中间件：/api/* 写接口跨站校验（Same-Origin）+ 安全响应头 + 首页追踪参数 301 清洗
├── api/
│   ├── _shared.ts        # 白名单校验、Turnstile 校验、D1 分钟级限流、每日熔断、恒定时间令牌比较
│   ├── config.ts         # 运行时配置（Turnstile site key 下发）
│   ├── submit.ts         # 结果匿名上报（聚合表自增 + 2% 抽样明细，answers 白名单校验与体积上限，限流 30 次/分/IP）
│   ├── feedback.ts       # 用户自报 MBTI 反馈（限流 5 次/分/IP，含答案明细）
│   ├── insight.ts        # AI 结果解读（多级回退 + D1 缓存，限流 10 次/分/IP + fresh 子限流 + 每日熔断）
│   ├── ping.ts           # 健康检查
│   └── stats/            # 统计查询接口（读取快照/聚合表，缓存 1-5 分钟，逐端点见 api.md）
│       ├── overview.ts   # 总量 / 今日 / 近两日
│       ├── archetypes.ts # 原型分布排行
│       ├── characters.ts # 角色命中排行
│       └── result.ts     # 结果页专用：当前角色/原型的占比与排名

cron-worker/              # 独立 Cloudflare Worker（非 Pages）
└── src/index.ts          # 每 15 分钟重算统计快照 + 清理限流表过期行

migrations/               # D1 迁移（CI 会在全新库上按序干跑，保证可重现）
```

### 跨站写入校验（_middleware.ts）

`/api/` 的 POST / PUT / PATCH 请求在进入各端点前先过一道 CSRF 防线：

- `Origin` 头存在时必须与请求自身同源；localhost / 127.0.0.1 的任意端口
  视为本地联调（Vite dev server 与 pages dev 端口不同）放行；
- 无 `Origin` 但 `Sec-Fetch-Site: cross-site` 的请求直接判定跨站；
- 两个头都没有（curl 等非浏览器客户端）放行，鉴权交由各端点自身逻辑。

跨站写请求返回 `403 {error:"cross-site request rejected"}`。这道防线挡的是
第三方页面借用户浏览器向统计接口投毒（表单 / fetch 跨站携带 Origin），
不能替代各端点自身的限流与白名单校验。

## API 约定

| 端点 | 方法 | 成功 | 失败 |
|:--|:--|:--|:--|
| `/api/submit` | POST | 204 空体（防枚举，输入非法同样 204） | 429 超限（空体） |
| `/api/feedback` | POST | 200 `{ok:true}` | 400 纯文本错误信息 / 429 空体 / 500 JSON `{ok:false,error:"internal"}` |
| `/api/stats/*` | GET | 200 `{data, updatedAt}` | 500 `{error:"internal"}` |
| `/api/config` | GET | 200 `{turnstileSiteKey?}` | — |
| `/api/insight` | POST | 200 `{text, cached, available}` | 400 参数非法 / 429 超限（均为 JSON） |
| `/api/ping` | GET | 200 `pong`（text/plain） | — |

设计要点：

- **聚合表不可逆**：`submit` 直接对 `archetype_counts` / `character_counts` / `pair_counts` / `daily_counts` 做 UPSERT 自增，无法事后剔除脏数据，因此入口配了分钟级限流兜底。
- **答案量程约定**：前后端约定反馈/明细中的 `answerValue` 为五档量程（±2），前端会把七档 UI 的 ±3 压缩后上报（见 `src/pages/ResultPage.vue` 的 `collectAnswerList` 与 `functions/api/_shared.ts` 的 `validateAnswers`，两侧需同步修改）。
- **版本号单一来源**：`appVersion` 来自 `package.json`（vite define 注入），上限 32 字符。

## AI 结果解读（/api/insight）

结果页的「AI 解读」卡片由多级回退的模型通道生成（网关 > Workers AI binding > REST，见下文），遵循四条硬约束：

1. **隐私**：请求只包含角色代码、四维倾向分（-1~1）与语言，绝不包含逐题答案；提示词素材来自构建期生成的 `functions/api/_data/characterBrief.json`（角色名/系列/标签，随 `npm run generate:data` 自动同步）。
2. **成本**：以「角色 + 四维倾向分桶（强/中/轻微，3⁴=81 桶）+ 语言」为缓存键写入 `ai_insight_cache`（迁移 0009），相同画像全站共享一次生成结果，免费额度（每日 10000 Neurons）下消耗与桶数同阶而非与流量同阶。前端「换一种说法」走 `fresh: true` 重新生成并覆盖缓存，同一结果限 3 次（sessionStorage 计数）。
3. **降级**：未绑定任何通道、额度耗尽、超出每日熔断或生成失败一律返回 `{text:null, available:false}`（`reason` 区分 `daily-limit` 等原因），前端隐藏整卡，结果页静态解析不受影响。
4. **防滥用**：单 IP 分钟限流 fail-closed（D1 不可用时拒绝而非放行）；`fresh` 有独立子限流（未鉴权 2 次/分/IP，超限降级读缓存）；未鉴权请求受全站每日真实生成总量熔断保护（默认 1000，`ACGTI_INSIGHT_DAILY_LIMIT` 可覆盖，缓存命中不计数）；`fresh` / `provider` 高权限字段仅对携带 `ACGTI_PREWARM_TOKEN`（恒定时间比较）的预热请求开放。

配置：`wrangler.jsonc` 已声明 `"ai": {"binding": "AI"}`，部署到 Cloudflare Pages 即自动生效，无需任何密钥。模型为 `@cf/meta/llama-3.2-3b-instruct`（温度 0.2），升级模型时需同步清空 `ai_insight_cache`（缓存行记录了 `model` 字段可按需清理）。

### 模型提供方（三级回退）

`runModel` 按优先级尝试三种 provider，任一可用即可。**网关通道没有任何
默认端点或默认模型**：`AIGW_API_KEY` + `AIGW_BASE_URL` + `AIGW_MODEL`
三项全部显式配置才启用，缺一项即视为该通道未配置、走后续降级链——
避免他人部署时请求打到作者的私人网关。

| 优先级 | 条件 | 说明 |
|:--|:--|:--|
| 1 | `AIGW_API_KEY` + `AIGW_BASE_URL` + `AIGW_MODEL` 三项齐备 | OpenAI 兼容网关（主通道），中文质量最佳；网关地址与模型全部通过环境变量显式配置。注意网关上的推理模型先思考后成文，max_tokens 需给足（当前 4000） |
| 1b | `AIGW2_API_KEY` + `AIGW2_BASE_URL` + `AIGW2_MODEL` 三项齐备 | 第二网关通道（与主通道相互独立的并发额度）：仅携带 `ACGTI_PREWARM_TOKEN` 的预热请求可通过请求体 `provider: "aigw2"` 指定，专供预热脚本双通道分流；线上常规请求该字段无效，永远走主通道。两通道模型同名时缓存键一致，生成结果互通 |
| 2 | `wrangler.jsonc` 的 ai binding | 线上部署零配置零密钥，走 Workers AI 的 llama-3.2-3b |
| 3 | `ACGTI_AI_TOKEN` + `ACGTI_AI_ACCOUNT_ID` | Cloudflare REST 直连，仅本地联调用（由 `dev:pages` 自动注入） |

**网关并发经验（2026-08 实测）**：不同网关对**在途长请求**的并发上限差异很大——短请求压测会严重高估上限（1 秒级请求快进快出，堆不起在途数），而 AI 长生成请求容易触顶，表现为直接 429，或超发不报错而是排队挂起、吞吐不升反降。因此预热脚本按通道显式设定并发，默认按主通道 2 + 第二通道 9 分流；服务端把网关 429 透传为 HTTP 429，供脚本等待补跑。接入新网关时先小并发试跑再放量。

缓存键含模型标签（取自该通道 `AIGW_MODEL` / `AIGW2_MODEL` 的实际值），切换 provider 后旧缓存自然失效，不会互相污染。**密钥只放环境变量与 `.dev.vars`（已被 gitignore），绝不提交仓库。**

### 缓存预热（可选，上线前执行）

缓存默认惰性填充：线上第一个命中某画像的用户需等真实生成（推理模型约 9-15s）。可在上线前用 `scripts/prewarm-insights.mjs` 预灌高频画像：

```bash
# 1. .dev.vars 加 ACGTI_INSIGHT_RATE_LIMIT=600（跳过本地限流），启动联调环境
npm run dev:pages

# 2. 预热（复用 /api/insight 完整链路：提示词/清洗/分桶/缓存键零重复）
node scripts/prewarm-insights.mjs --dry-run            # 查看计划
node scripts/prewarm-insights.mjs --langs zh-CN        # 按语言分批（推荐）
node scripts/prewarm-insights.mjs --characters frieren,akemi-homura --buckets 1111,2112
node scripts/prewarm-insights.mjs --concurrency 2,10   # 按通道设并发（aigw,aigw2）

# 3. 部署后把本地预热结果推到线上库（INSERT OR IGNORE，幂等可重复）
node scripts/prewarm-insights.mjs --push
```

默认桶组合为常见强度画像（`1111/2112/1211/1121/1112`，依据反馈数据的得分分布）；全量 113 角色 × 4 语言 × 5 桶 ≈ 2260 条。注意预热结果只落在**本地** D1（`.wrangler/state` 下的开发库），线上 Pages 读的是**远程** D1——想让它对线上生效必须执行 `--push`；若不预热，线上会惰性生成（首个命中该画像的用户等 9-15s，token 不限量时成本可忽略）。

`.dev.vars` 同时配置主通道（`AIGW_*`）与第二通道（`AIGW2_*`）时自动启用双通道：任务按各通道并发比例分流，默认主通道 2 + 第二通道 9（默认安全值，依据见上方网关并发经验），单第二通道跑全量约 1-2 小时。单网关配置则单池运行。偶发失败（网关限流/热重载窗口/网络抖动）自动补跑一轮，重跑幂等（已缓存直接命中并自增 hits）。

### 本地联调（受限网络环境）

本地 `wrangler pages dev` 的 AI binding 走 wrangler 远程代理会话（部署在 `<随机hash>.<账号>.workers.dev`）。实测受限网络下该域名存在两层封锁：系统 DNS 被随机投毒（返回被墙站点 IP）+ 真实 IP 的 TLS 流量被按 SNI 重置，远程绑定 RPC 会确定性 `internal error` 并拖垮进程；而经本机代理访问 Cloudflare API 完全正常。

为此 `npm run dev:pages`（`scripts/dev-pages.mjs`）提供本地联调模式：

1. 临时剥离 `wrangler.jsonc` 的 ai binding（退出自动恢复）——本地远程绑定在受限网络下必崩，与用哪个 provider 无关。wrangler pages dev 不支持 `--config` 自定义配置路径（实测 4.83 报错），只能原地改写，配套三层防护：
   - **崩溃自愈**：剥离前备份原文到 `.wrangler`（gitignored），强杀/崩溃后下次启动检测到备份即先还原；
   - **端口清理**：自愈时顺带释放可能被残留 wrangler 占用的 8788 端口；
   - **运行期守护**：同步软件等外部程序可能把运行中的 `wrangler.jsonc` 还原成原文，触发 wrangler 热重载（窗口内请求 503）。启动器每 2s 校验，被还原成启动时原文就立即重新剥离（实测本机存在此类外部改写，守护已在实战中触发并恢复）；
2. 优先级识别：`.dev.vars` 手动配置了 `AIGW_API_KEY`（网关模式）时直接使用；否则注入 REST 凭据（`ACGTI_AI_TOKEN` / `ACGTI_AI_ACCOUNT_ID`，复用 wrangler 本地 OAuth 登录态，退出时按标记移除）；
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
