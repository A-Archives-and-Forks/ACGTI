# 架构决策记录（ADR）

本目录记录 ACGTI 的关键架构决策，采用轻量化的 [MADR](https://adr.github.io/madr/) 格式：**背景 → 候选方案 → 决定 → 后果**。

规则：

- 决策一旦记录不可回改内容，只可通过新记录将其标记为 `已取代（superseded by XXXX）`；
- 编号递增，文件名 `NNNN-短标题.md`；
- 答辩、复盘或贡献者提问「为什么这样设计」时，以本目录为准。

| 编号 | 决策 | 状态 |
|:--|:--|:--|
| [0001](0001-cloudflare-stack.md) | 前后端一体托管于 Cloudflare Pages + D1 | 已接受 |
| [0002](0002-spa-seo.md) | 纯 SPA 无 SSR，以静态元数据 + 站点地图兜底 SEO | 已接受 |
| [0003](0003-data-driven-engine.md) | 测评内核数据驱动：题库 / 权重 / 角色全部为受校验的 JSON | 已接受 |
| [0004](0004-anonymous-stats.md) | 匿名统计：聚合表自增 + 低比例抽样明细，不做用户系统 | 已接受 |
| [0005](0005-migrations-immutable.md) | 已发布的 D1 迁移文件不可回改 | 已接受 |
| [0006](0006-ai-insight-workers-ai.md) | AI 结果解读：Workers AI + 分桶缓存 + 静态降级 | 已接受 |
| [0007](0007-i18n-single-source.md) | i18n 角色文案单一数据源，按需加载 | 已接受 |
| [0008](0008-progressive-enhancement.md) | 交互能力渐进增强（View Transitions / Web Share L2） | 已接受 |
