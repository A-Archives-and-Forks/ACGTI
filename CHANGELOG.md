# 更新日志（Changelog）

本项目所有显著变更均记录在本文件。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]（预计随 0.4.1 发布）

### 安全（Security）

- `/api/*` 写接口（POST / PUT / PATCH）新增**跨站写入校验**：`Origin`
  与请求不同源、或 `Sec-Fetch-Site: cross-site` 的跨站写请求直接返回
  `403`（`functions/_middleware.ts`），防第三方页面借用户浏览器投毒。
- `/api/submit` 的 `answers` 收紧为**白名单校验 + 大小上限**：逐条校验
  结构（`questionId` / `answerValue`）、条数限定 [20, 100]、清洗后序列化
  体积上限 64KB，巨型恶意 payload 不再进入抽样与 D1 存储。
- `/api/feedback` 补充可选 `archetypeCode` / `characterCode` 的格式校验，
  非法即返回 400，与 submit 口径对齐，防脏数据入库。
- `/api/insight` 防滥用多层加固：
  - 生成路径限流改为 **fail-closed**（D1 不可用时拒绝而非放行，防打满
    D1 写入配额让限流失效后刷穿上游额度）；
  - `fresh` 新增独立子限流（未鉴权 2 次/分/IP，超限静默降级为读缓存）；
  - 新增**全站每日真实生成熔断**（默认 1000 次/日，超限返回
    `reason: "daily-limit"`，缓存命中不计数），挡 IP 池轮换刷量；
  - `fresh` / `provider` 高权限字段仅对携带 `ACGTI_PREWARM_TOKEN`
    （恒定时间比较）的预热请求开放，外部请求永远走主通道。
- AI 网关通道**删除全部硬编码默认端点 / 默认模型**：`AIGW_*` / `AIGW2_*`
  须三项（KEY / BASE_URL / MODEL）显式配置齐备才启用，避免他人部署时
  请求打到作者的私人网关。

### 变更（Changed）

- 各端点限流计数改为 **scope 隔离**（submit / feedback / insight 独立
  计数），一次完整测试流程（1 次 submit + 数次 insight + 1 次 feedback）
  不再互相挤占额度。
- 题库多语言文案本地化重写（详见 git 历史）。
- OpenAPI 规范（`public/api/openapi.yaml`）同步以上全部行为，
  `info.version` 提升至 0.4.1。

### 新增（Added）

- 新建本 CHANGELOG。
- `.env.example` 补全 AI 网关通道变量（`AIGW_*` / `AIGW2_*` /
  `ACGTI_AI_*` / `ACGTI_INSIGHT_*`）的作用说明，明确
  「不配置（或配置不齐）则该通道不启用」的语义。
- 端到端冒烟测试支持通过 `ACGTI_E2E_BROWSER` 环境变量指定浏览器路径。

### 修复（Fixed）

- AI 解读卡片**切换竞态与重生成失败保护**：请求带自增序号，快速切换
  角色/语言时过期响应直接丢弃，不再覆盖新请求回来的文案；「换一种说法」
  失败时保留旧解读不清空，仅在按钮旁给出数秒自动消失的轻提示。
- 海报导出的立绘等待改为 **load / error 事件驱动**挂载，修复按固定延时
  截图导致的导出缺图/空图。
- `crypto.randomUUID` 在旧浏览器或非安全上下文（非 HTTPS）下抛 TypeError
  的场景补 **getRandomValues 兜底**，提交 ID 不再因此丢失。
- 答题页支持**数字键 1-7 快捷作答**（对应七档量程），键盘用户双手
  不离主键区即可完成测试。
- 首页「检查更新」弹窗打开时**不再抢占键盘焦点**。
- **en / ja 题库文案整体重写**，修正机翻腔与维度语义漂移。

### 文档（Docs）

- `docs/`（architecture / backend / api / 新增角色流程 / adr）与
  `public/api/openapi.yaml` **恢复纳入版本控制**，修复 README /
  CONTRIBUTING 中指向它们的失效链接；`.gitignore` 改为精确忽略
  内部运维文档（internal-ops / d1-backup / 排行榜优化方案 / asset-review）。
- README 修复口径矛盾：版权声明改为区分「角色名称与设定归原版权方 /
  立绘插图为 AI 生成或自绘的同人衍生创作」；时间线日期与博客链接统一；
  补全 functions 目录结构。

> 备忘：隐藏角色展示编号改为按角色数据顺序派生（phrolova 与
> kasugano-sora 的编号互换）；发布 0.4.1 时需同步 bump `package.json`
> 的版本号。

## [0.4.0] - 2026-08

> 回填摘要；完整细节详见 git 历史与 Release 页。

### 新增（Added）

- **AI 结果解读**（ADR-0006）：结果页可选的 LLM 生成个性化解读。隐私上
  只上传角色代码与四维倾向分、绝不上传逐题答案；以「角色 + 画像分桶 +
  语言」为键的 D1 缓存让模型消耗与桶数同阶而非与流量同阶；任何失败均
  静态降级隐藏卡片，不影响结果页静态文案。
- AI 解读**模型通道三级回退**（OpenAI 兼容网关 > Workers AI binding >
  Cloudflare REST 直连）与**缓存预热脚本**（`scripts/prewarm-insights.mjs`，
  支持双通道并发分流、网关 429 等待补跑与幂等重跑）。
- **多语言精修**（ADR-0007）：角色文案改为单一数据源 + 动态 import
  按需加载，首屏 i18n 块显著瘦身（gzip 约 183KB → 58KB），结构性消除
  双份数据漂移。
- **交互渐进增强**（ADR-0008）：View Transitions 原生页面过渡与
  Web Share Level 2 文件分享，不支持的浏览器自动回落，零新增依赖。
- **题目健康度分析**：`analysis/item_health.py` 产出题目区分度
  （校正题总相关）与维度信度（Cronbach alpha）报表，作为改题前的
  第一道体检，接入反馈数据校准闭环。

<!-- 版本链接暂以纯文本呈现：仓库现有 tag 仅为 v0.1.0 / v0.2.0 / v1.0.0，
     v0.4.0 未打 tag，compare/releases 链接均为死链；待发布流程补齐后再恢复 -->
