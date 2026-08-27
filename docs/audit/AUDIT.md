# ACGTI 仓库审计报告（AUDIT.md）

- 审计日期：2026-08-27
- 审计基线 commit：`b74f391`（main，工作树含一处用户本地 README 改动，审计未触碰）
- 审计范围：全仓静态人工审计 + 动态验证 + 修复回归闭环
- 审计角色：架构 / 安全 / Bug / 测试 / DevOps 综合评审

---

## 1. Executive Summary

ACGTI 是一个工程质量明显高于同规模开源项目的水准：后端全部 D1 查询参数化、鉴权口子 fail-closed、限流原子化且有每日熔断硬顶；前端评分引擎有完整单测与 39 题状态机保护。本次审计未发现 S0 级问题。确认 9 项问题（S1×1、S2×2、S3×3、S4×3），其中 5 项已在本次闭环内修复并通过全量回归，2 项为有意设计/需产品决策记录在案，2 项低价值清理仅记录。开发依赖链的 10 个 npm audit 漏洞已全部清零。

## 2. Project Overview

- **产品**：MBTI 风格二次元人格测试（113 角色、8 原型、39 题七级量表），线上运行（Cloudflare Pages），GitHub 约 1055 star。
- **技术栈**：Vue 3.5 + Vite 8 + vue-router 4（前端）；Cloudflare Pages Functions + D1 + Workers AI/自建网关（后端）；独立 cron-worker 每 15 分钟重算统计快照。
- **数据流**：浏览器本地算分 → `POST /api/submit` 聚合自增（2% 抽样明细）→ cron 汇总进 `stats_snapshot` → 只读统计 API 消费快照；AI 解读按「角色+分桶+语言+模型」写 D1 缓存全站复用。
- **部署**：Pages 连接 Git（dist 构建产物），cron-worker 独立 wrangler 项目，迁移由 CI 在全新库干跑验证。

详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 3. Baseline

| 检查项 | 修前 | 修后 |
| --- | --- | --- |
| npm test (vitest) | 103/103 通过 | 106/106 通过（新增 3 用例） |
| npm run build（含 vue-tsc 类型检查） | 通过 | 通过 |
| tsc -p tsconfig.functions.json | 通过 | 通过 |
| tsc -p cron-worker/tsconfig.json | 通过 | 通过 |
| npm run test:e2e（puppeteer 冒烟） | 未跑过（本次首跑） | 32/32 通过，0 console 错误 |
| npm audit | 10 项（7 high / 2 moderate / 1 low） | 0 项 |
| lint | 无 lint 脚本（未引入） | 同左 |

环境：Node v22.19.0 / npm 10.9.3 / Windows + Git Bash。

## 4. Critical Findings（结论）

- **无 S0 Critical 问题**。未发现 SQL 注入（全部参数绑定）、管理口子未鉴权（预热/cron 手动触发均 fail-closed）、密钥入库或进入 git 历史。
- 最严重问题为 **S1 开发链依赖漏洞群**（不进入生产构建，但暴露开发者本机与 CI），已修复至 audit 归零。

## 5. Security

### 5.1 做得好的（防御面）
- 所有 D1 访问均为参数绑定，无字符串拼接注入点（含 stats/result 中动态表名，其来源是字面量联合类型而非用户输入）。
- 写接口统一经 `_middleware.ts` 做 Origin / Sec-Fetch-Site 跨站校验；API 响应统一补 `X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`；无 CORS 宽松放行。
- 输入校验集中在 `functions/api/_shared.ts` 白名单函数（str/num/isValidMbti/isValidCode/isValidUuid/validateAnswers），submit 对 payload 深度清洗后才落库，超体积直接拒绝。
- `/api/insight` 的 fresh/provider 高权限口子使用恒定时间令牌比较（Workers timingSafeEqual，Node 回退普通比较）；付费生成路径限流 strict 模式 fail-closed；另有全站每日生成熔断挡 IP 池轮换。
- cron-worker `/trigger` 无 secret 时默认拒绝；站点密钥下发接口只回显非敏感 siteKey。
- `.dev.vars`、`.env.local`、`d1-backups/`（62MB 全量导出）均未被 git 跟踪且历史干净。

### 5.2 风险与处置
- [S1] 开发链依赖漏洞 10 项 —— 已修复（见 §9）。
- [S2] `/api/feedback` Turnstile 服务端校验被临时关闭（代码内 TODO 注明），现仅剩 5 次/分/IP 限流防线，IP 池可注水反馈数据 —— blocker：恢复依赖前端先恢复 turnstileToken 获取（前端组件同步处于禁用态），属产品决策，故本次仅记录。
- [S4] 本地 `.dev.vars` 存有真实形态密钥（TURNSTILE_SECRET 0x4A…、AIGW_API_KEY sk-7…、AIGW2_API_KEY 9kr2…、ACGTI_PREWARM_TOKEN 4be4…）。未被跟踪、不在 git 历史；建议：保持不入库，若怀疑本机泄露则在 Cloudflare / 网关侧轮换。
- 匿名统计端点对 curl 类无浏览器头客户端放行属既定设计（数据本身匿名聚合），风险接受。

## 6. Bugs

- [S3] `/api/stats/result` 查询参数未做格式白名单即进查询 —— 已修复（非法 code 直接零值返回，不发起查询）并补 3 个端点用例。
- [S4] `AiInsightCard.vue` 重试计数 ref 仅初始化一次，角色预览切换时配额跨角色顺延 —— 已修复（watch retryKey 重读存储）。
- 前端核心计算逻辑复核结论：`quizEngine.ts` 四层评分（MBTI 25%/原型 28%/向量 27%/专属 20%）、逐题维度权重覆盖表（"整体替换"语义）、平局偏向正字母、负权重夹取 [-1,1]、请求序号守卫等均有明确设计与测试护栏；未发现评分/类型判定错误。
- 未发现错误吞噬导致的状态错乱：各 catch 均有注释化的降级意图（统计可用性优先 / fail visible 等）。
- 明确检查过的边界：39 题进度持久化校验题数一致才恢复；重复提交有 sessionStorage 会话去重；多语言切换有 loadSeq 丢弃过期响应。

## 7. Performance

- 读路径全部走 `stats_snapshot` 快照表，写路径聚合 UPSERT 单行自增，D1 压力与提交量同阶。
- AI 解读以「角色 × 分桶 × 语言 × 模型」缓存，成本上限 ≈ 113×81×4 键数级，另有每日熔断兜底。
- 前端题库/角色数据按需异步加载，结果页 35KB gzip 级别；未见明显性能风险。
- `checkRateLimit` 为每请求一次 UPSERT RETURNING（原子），高频下仍会增加 D1 写入，作者已注明高流量应迁 Cloudflare Rate Limiting API —— 合理的未来项。

## 8. Testing

- 现状：vitest 6 文件 106 用例全绿；覆盖评分引擎（35）、答题状态机（12+useQuiz）、后端端点与中间件（46）、共享校验纯函数、颜色工具、insight 保护逻辑。
- 本次新增：stats/result 端点 3 用例（缺参 400 / 全链路取数断言 / 非法 code 零值直通），测试桩 makeDb 相应扩展快照与聚合表分派。
- e2e：scripts/e2e-smoke.mjs 在本机实跑 32/32 通过（桌面+移动双视口、答题主流程、0 console 错误）。
- 缺口：Vue 组件级测试基建不存在（无 @vue/test-utils/jsdom），UI 态修复只能以 build+typecheck+e2e 兜底；CI 不含 e2e。

## 9. Dependencies

- runtime 依赖仅 4 个（vue、vue-router、@unhead/vue、html-to-image），克制。
- devDependencies 升级：vite ^8.0.4→^8.2.2、wrangler ^4.83.0→^4.126.0、@cloudflare/workers-types ^4→^5、@vitejs/plugin-vue、puppeteer-core、vue-tsc 小幅跟进。
- workers-types v5 大版本升级经两套 tsconfig 验证无类型破坏。
- `npm audit fix` 后归零；valibot/moderate 与其余 high 全部消除。
- 遗留观察项：vue-router 5.x、typescript 7.x 已发布 major，本次不动（遵循最小充分修改）。

## 10. DevOps

- CI（.github/workflows/ci.yml）：npm ci → validate:data → 单测 → Functions/cron 双 typecheck → D1 迁移全新库干跑 → build。链路完整且有价值（迁移干跑少见的好实践）。
- 缺失项：无 lint 步骤（项目也无 lint 配置）；无 npm audit 步骤（建议后续加 `npm audit --audit-level=high` 或 Dependabot）。
- release.yml 于 tag 推送时构建 dist 并发布 zip 到 GitHub Release，权限收敛为 contents:write，合理。
- d1-backups 目录（62MB SQL 全量导出）未被 git 跟踪且有 .gitignore 规则；migrations 仅审查未执行（遵守约束）。
- wrangler.jsonc：database_id 为资源标识而非凭据，公开属正常；compatibility_date 2026-04-18 未过期。

## 11. Documentation

- README 信息密度高（原理/目录/数据一览/合规声明俱全）；AGENTS.md 有清晰工程规范；docs/ 下另有本地运维文档（architecture/backend/api/d1-backup/internal-ops/ADR）。
- 缺口：docs/ 整体被 .gitignore 忽略，团队协作时这些文档不可分享；本次已为 docs/audit/ 开例外通道（其余文档维持忽略，尊重项目现状）。

## 12. Fixes Applied（见 commit 列表）

1. chore(deps) `f24eb0f`：开发链依赖升级，npm audit 10→0（两套 typecheck + 103 测试 + build 回归通过）。
2. chore(repo) `211924b`：移除误入库的 18.5MB 用户衍生反馈数据 scripts/tf_feedback_data.json 与 scripts/backups/*.bak（untrack + ignore，本地保留）。
3. fix(ui) `cb75259`：AI 解读卡重试计数随角色预览切换重新初始化。
4. fix(api)/test(api) `92433a0`：stats/result 参数白名单校验 + 3 个新端点用例。
5. docs(audit)：本目录三份审计文档 + .gitignore docs/audit 例外。

## 13. Tests Added

- tests/api-endpoints.test.ts：+3 用例（43→46），并为测试桩增加 stats_snapshot / 聚合单点计数的内存分派能力。
- 全量终态：vitest 106/106；e2e 32/32；build + 双 typecheck 通过；npm audit 0。

## 14. Verification

每个修复均走「改动 → vitest / 受影响 typecheck / build 回归 → commit」闭环；依赖升级额外跑了 workers-types v5 双工程类型检查与 e2e 实测。声称与证据一一对应，无未经验证的修复声明。

## 15. Remaining Risks

1. [S2/blocker] feedback Turnstile 校验关闭——防刷仅剩 IP 分钟限流，等待前端恢复 token 后联动重启服务端校验。
2. [数据残留] tf_feedback_data.json 已从最新提交移除，但历史提交仍包含该文件；彻底清除需改写历史（涉及 force push，超出本次授权范围）。
3. [S4/接受] submit 聚合表无 submissionId 幂等，理论上可重放刷量；已有 30 次/分/IP 限流与匿名统计定位，风险接受。
4. [S3/有意设计] insight fresh 子限流超限时静默降级读缓存，用户"换一个"可能拿到相同文案且无提示；改进需扩展 API 返回标记（cached 已有，缺 degraded 标记），建议后续小版本处理。
5. 历史杂项：scripts/offline_replay_tf.py 与 offline-replay-tf.py 命名重复等一次性校准脚本堆积，影响可发现性不影响运行。

## 16. Recommended Future Work

1. 恢复 Turnstile 前端 token 获取并重新启用 /api/feedback 服务端校验（解决唯一 S2）。
2. CI 增加 lint（如 oxlint/eslint-plugin-vue）与 `npm audit --audit-level=high` / Dependabot。
3. insight 响应增加 degradedFresh 标记，前端对降级命中给出轻提示。
4. 引入组件测试基建（@vue/test-utils + jsdom）覆盖 AiInsightCard 等有状态组件。
5. 将 docs/ 运维文档选择性脱敏入库或移入 wiki，减少"文档孤岛"。
6. 高流量时把分钟级限流迁往 Cloudflare Rate Limiting binding（代码注释已有预案）。

---

十维健康评分与生命周期建议见最终审计答复正文（AUDIT_ISSUES.md 含逐问题档案）。
