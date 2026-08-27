# ACGTI 审计问题档案（AUDIT_ISSUES.md）

> 严重级定义：S0 Critical（可被直接利用/数据泄露级）· S1 High（高暴露风险或核心功能缺陷）· S2 Medium（明确的攻击面/数据问题，有缓解）· S3 Low（防御纵深/正确性小缺陷）· S4 Info（卫生、可维护性、接受的设计取舍）。
> 状态：FIXED = 本次闭环修复并回归验证；OPEN = 未修（注明 blocker 或理由）；ACCEPTED = 风险接受。

---

## S1-001 开发链依赖漏洞群（npm audit 10 项）

- **Severity**: S1 High
- **Category**: Dependencies / DevOps
- **Location**: package.json（wrangler ^4.83.0、vite ^8.0.4 及其传递依赖 esbuild/ws/sharp/undici/nanoid/postcss/miniflare/valibot）
- **Description**: npm audit 报告 10 项漏洞：7 high（miniflare、nanoid、postcss、sharp（libvips CVE-2026-*）、undici（TLS 校验绕过）、vite（launch-editor NTLMv2 泄露 + server.fs.deny Windows 绕过）、ws（未初始化内存泄露 + DoS））、2 moderate（valibot、wrangler）、1 low（esbuild dev server Windows 任意文件读）。均位于 devDependencies 传递链。
- **Root Cause**: wrangler/vite 长期未升级；@cloudflare/workers-types@4 与新版 wrangler 的 peer 要求冲突导致 `npm audit fix` 直接失败。
- **Reproduction**: `npm audit`（基线输出 7 high / 2 moderate / 1 low）。
- **Impact**: 不进入生产构建，但暴露开发者本机与 CI（dev server 场景的文件读取、内存泄露类漏洞）；Windows 开发者受 esbuild/launch-editor 影响。
- **Fix**: 升级 vite→^8.2.2、wrangler→^4.126.0、workers-types→^5.20260825.1（满足 peer），连带 plugin-vue/puppeteer-core/vue-tsc 小幅跟进；`npm audit fix` 清零。（commit f24eb0f）
- **Test/Verification**: 双 tsconfig typecheck 通过；vitest 103/103；build 通过；e2e 32/32；audit 归零 found 0 vulnerabilities。
- **Status**: FIXED

## S2-001 /api/feedback Turnstile 服务端校验关闭

- **Severity**: S2 Medium
- **Category**: Security
- **Location**: functions/api/feedback.ts:69-71（TODO 注释处）
- **Description**: 原设计要求 turnstileToken 并做服务端 siteverify，现被临时禁用（前端获取 token 的代码同处于注释态，见 src/pages/ResultPage.vue:99-104）。
- **Root Cause**: 前端 Turnstile 组件被停用后服务端校验连带关闭，遗留 TODO 待联动恢复。
- **Reproduction**: 对 POST /api/feedback 构造无 turnstileToken 的合法 payload → 200 正常入库（唯一防线剩 5 次/分/IP 限流）。
- **Impact**: 脚本可用 IP 池向 mbti_feedback 注水（自评 MBTI + 200 字 note），污染校准数据源并产生 D1 存储成本；note 字段不受公开读取面影响。
- **Fix**: 未修。**Blocker**：恢复需先在前端重新启用 Turnstile widget 并重取 token（产品决策），随后在 feedback.ts 恢复 verifyTurnstile 调用——前端先行是硬前置。
- **Test**: 无（保持现状即回归通过：106/106）。
- **Status**: OPEN (blocker: 产品决策 + 前端组件恢复)

## S2-002 用户衍生反馈数据集入库公开仓库

- **Severity**: S2 Medium（无直接标识符，故未定 S1）
- **Category**: Repo Hygiene / Privacy
- **Location**: scripts/tf_feedback_data.json（18.5MB，10,773 条记录，字段仅 answers_json+self_mbti，经核验无 note/无 ID/无时间戳）
- **Description**: 由生产 D1 反馈表导出的校准数据集被 git 跟踪，随公开仓库再分发。
- **Root Cause**: 校准工作流将导出物直接放入 scripts/ 且未被 ignore 规则覆盖。
- **Reproduction**: `git ls-files | grep tf_feedback_data`（基线存在）；du 18.5MB 显著拖慢 clone。
- **Impact**: 生产衍生数据再分发的授权模糊；仓库体积膨胀。无 PII 级泄露（字段已最小化）。
- **Fix**: `git rm --cached` 移出索引并 ignore `scripts/tf_feedback_data*.json`（本地保留，本地校准脚本 verify_weights.mjs / tf_weight_scan.mjs 不受影响）。（commit 211924b）
- **Test**: git status 确认 untracked；测试套件不涉及该文件。
- **Status**: FIXED（残留：历史提交仍含该文件，彻底清除需改写历史 + force push，超出本次授权；建议后续评估 BFG/git-filter-repo）

## S3-001 /api/stats/result 参数未做格式白名单

- **Severity**: S3 Low
- **Category**: Security / Bug
- **Location**: functions/api/stats/result.ts:10-11（修改前）
- **Description**: character/archetype 查询参数 trim 后直接绑定查询；参数化查询保证无注入，但任意长度/形态输入直达 D1。
- **Root Cause**: 该端点早于 _shared 白名单体系成型（或遗漏复用）。
- **Reproduction**: `GET /api/stats/result?character=<超长串>&archetype=x` → 进入 DB.prepare().bind() 查询路径。
- **Impact**: 防御纵深缺失；极端长参数浪费 D1 配额。错误码路径不变。
- **Fix**: 复用 isValidCode 白名单；非法格式按"该维度未指定"返回零值且不发起查询。（commit 92433a0）
- **Test**: tests/api-endpoints.test.ts 新增 3 用例（缺参 400 / 合法取数全链路断言 count/percent/rank / 非法 code 零值直通且无对应查询记录）。终态 106/106。
- **Status**: FIXED

## S3-002 insight fresh 子限流降级对用户不可感知

- **Severity**: S3 Low
- **Category**: Bug / UX
- **Location**: functions/api/insight.ts:312-338 与 src/components/AiInsightCard.vue:129-140
- **Description**: 未鉴权 fresh 超过 2 次/分时服务端静默回退读缓存；前端"换一个"按钮此时收到 cached:true 的旧文案但按新生成展示（流式动画+计数已扣），用户感知为"没换".
- **Root Cause**: 服务端以可用性优先的有意降级，但 API 未向客户端区分"降级命中"与"真缓存".
- **Reproduction**: 同结果页 1 分钟内点第 3 次"换一个" → 返回与上次相同文案（服务端日志可见 fresh 拒绝）。
- **Impact**: 轻度 UX 困惑；无资损与安全影响。
- **Fix**: 未修（最小充分修改原则下避免扩大 API 契约改动面）。
- **Blocker/理由**: 需要响应体新增标记（如 degradedFresh:true）并跨端联动文案；属产品体验改进而非缺陷修复。
- **Status**: OPEN (低优先，建议下个功能版本处理)

## S3-003 本地备份脚本入库

- **Severity**: S3 Low
- **Category**: Repo Hygiene
- **Location**: scripts/backups/probability-simulation.mjs.bak、scripts/backups/probability-simulation-worker.mjs.bak
- **Description**: .bak 备份产物被 git 跟踪，无版本化价值且易与现代实现混淆。
- **Root Cause**: 早期能力实验阶段误提交后从未清理。
- **Reproduction**: `git ls-files scripts/backups`（基线返回 2 个文件）。
- **Impact**: 维护噪音；搜索误导。
- **Fix**: git rm --cached + .gitignore 增加 scripts/backups/。（commit 211924b）
- **Test**: N/A（git status 验证）。
- **Status**: FIXED

## S4-001 AI 解读卡重试配额跨角色顺延

- **Severity**: S4 Info
- **Category**: Bug（UI 状态）
- **Location**: src/components/AiInsightCard.vue:29-33（修改前）
- **Description**: retryCount/limitReached ref 仅在 setup 时初始化一次；characterCode 变化（角色预览切换）时 sessionStorage 键已换但内存计数未重读，上一角色已用次数顺延给下一角色（或反之漏算）。
- **Root Cause**: ref 初始化时机早于键的响应式变化，缺少对 retryKey 的订阅。
- **Reproduction**: 角色预览链路连续切换两个角色并各尝试 regenerate —— 第二个角色的剩余次数不是全新 3 次。
- **Impact**: 配额隔离语义被破坏；影响范围限于手动"换一个"功能。
- **Fix**: watch(retryKey) 重读存储并重算 limitReached。（commit cb75259）
- **Test**: build（vue-tsc）+ 全量 vitest 106/106 + e2e 冒烟 32/32 兜底；项目无组件测试基建（jsdom/@vue/test-utils 缺位），单断言级验证暂不可行（已在 AUDIT §16 建议补基建）。
- **Status**: FIXED

## S4-002 submit 聚合计数无幂等（重放刷量面）

- **Severity**: S4 Info
- **Category**: Security / Design
- **Location**: functions/api/submit.ts:101-131
- **Description**: 聚合表 UPSERT 自增不以 submissionId 去重，同一有效 payload 可重放多次累加（限流 30/min/IP 为唯一约束）。
- **Root Cause**: 有意取舍：聚合写入极简优先，作者注释明确"聚合表无法事后剔除脏数据，入口做分钟级限流兜底"。
- **Impact**: 匿名统计口径可被低成本轻微扰动；不影响用户功能与其他端点。
- **Fix**: ACCEPTED（如未来需要，可在抽样明细表上加 submissionId 幂等比对或迁 CF Rate Limiting binding）。
- **Status**: ACCEPTED

## S4-003 一次性校准脚本堆积与命名重复

- **Severity**: S4 Info
- **Category**: Maintainability
- **Location**: scripts/offline_replay_tf.py 与 scripts/offline-replay-tf.py（并存两份同义实现）；offline-replay-round4/4b/5/5b/tf 系列
- **Description**: 多轮离线校准的一次性脚本全部堆在 scripts/ 根目录，含大小写/连字符变体重名。
- **Root Cause**: 快速迭代校准实验的历史沉淀。
- **Impact**: 可发现性下降；无运行期影响。
- **Fix**: 未修（避免超出审计职责的大批量移动破坏作者既有工作流引用）。建议归档到 scripts/calibration-archive/ 或随下次使用清理。
- **Status**: OPEN (低价值清理，交由维护者)

---

## 统计汇总

| 级别 | 数量 | 已修复 | OPEN | ACCEPTED |
| --- | --- | --- | --- | --- |
| S0 | 0 | - | - | - |
| S1 | 1 | 1 | 0 | 0 |
| S2 | 2 | 1 | 1 | 0 |
| S3 | 3 | 2 | 1 | 0 |
| S4 | 3 | 1 | 1 | 1 |
| **合计** | **9** | **5** | **3** | **1** |

对应 commit：f24eb0f（deps）/ 211924b（repo hygiene）/ cb75259（ui fix）/ 92433a0（api fix + test）。
