<h1 align="center">ACGTI</h1>

<p align="center">
  <strong>ACG Type Indicator — 一个以 MBTI 为基础的二次元角色原型测试网站</strong>
</p>

<p align="center">
  <a href="https://acgti.tianxingleo.top/">🌐 acgti.tianxingleo.top — ACGTI官网</a>
</p>

<p align="center">
  回答情境式问题 · 测出属于你的角色代码 · 解锁你的二次元人格原型
</p>

<p align="center">
  <a href="#️-架构与原理">📖 阅读文档</a> ·
  <a href="#-贡献">🤝 参与贡献</a>
</p>

<p align="center">
  <a href="https://github.com/tianxingleo/ACGTI/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/tianxingleo/ACGTI/ci.yml?branch=dev&style=flat-square&label=CI" alt="CI" /></a>
  <a href="https://acgti.tianxingleo.top/"><img src="https://img.shields.io/badge/Deploy-Cloudflare_Pages-F38020?style=flat-square&logo=cloudflare" alt="Deploy to Cloudflare Pages" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-blue.svg?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/Node-%E2%89%A522-339933?style=flat-square&logo=nodedotjs" alt="Node >= 22" />
</p>

<p align="center">
  <img
    src="https://count.getloli.com/@ACG-TI?name=ACG-TI&theme=asoul&padding=7&offset=0&align=top&scale=1&pixelated=1&darkmode=auto"
    alt="ACG-TI counter"
  />
</p>

<p align="center">
  <img
    src="https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_04_85afc638204090e964a385ef024963af.webp"
    alt="首页截图"
    width="45%"
  />
  &nbsp;
  <img
    src="https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_04_53f6126c96077f9990f8c8f4aef7d20d.webp"
    alt="答题截图"
    width="45%"
  />
</p>

<p align="center">
  <img
    src="https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_04_a4b8624d8dfeeeb23ca0b2de7a344e24.webp"
    alt="结果截图一"
    width="45%"
  />
  &nbsp;
  <img
    src="https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_04_83aa34b38a795f68b26eadbef4fca2b8.webp"
    alt="结果截图二"
    width="45%"
  />
</p>

> ⚠️ 本工具仅作娱乐用途，不能替代心理诊断、医学评估，也不要拿它对现实中的人下人格结论。

---

## ✨ 核心特性

- **MBTI 四维判定**：按 E/I、S/N、T/F、J/P 四个维度计分，再映射到二次元角色。
- **8 种专属原型**：发光主角位 · 冰面观察者 · 誓约队长 · 灵巧回旋者 · 温柔修复者 · 影面策士 · 混沌火花 · 月下守护者。
- **110+ 位角色库**：涵盖 BanG Dream!、孤独摇滚！、鸣潮、明日方舟、轻音少女、我推的孩子、Re:从零开始的异世界生活、原神、崩坏：星穹铁道、葬送的芙莉莲、Fate/stay night 等 60+ 部热门作品，持续扩充中。
- **AI 结果解读**：基于 Cloudflare Workers AI（零密钥部署）为你的四维倾向生成个性化解读。解读请求只带倾向分桶、不带逐题答案；额度耗尽时自动隐藏，不影响其他功能（详见 [ADR-0006](docs/adr/0006-ai-insight-workers-ai.md)）。
- **可视化交互**：16personalities 风格的交互式倾向滑块，把你的思维倾向画出来。
- **一键分享**：一键生成结果分享图；移动端经 Web Share API 直接进系统分享面板，桌面端导出 PNG 海报。
- **原生页面过渡**：支持 View Transitions API 的浏览器有原生页面切换动画，不支持的浏览器不受影响（渐进增强）。
- **轻量全栈**：测试在你的浏览器里完成计算，不需要注册，也不收集邮箱等身份信息。提交时会匿名上报最终命中的角色与原型用于全站统计与排行榜，另有约 2% 的提交会按抽样保留匿名逐题答案，用于校准题目（详见 [SECURITY.md](.github/SECURITY.md)）。
- **数据反馈校准**：用户可自愿提交"真实 MBTI"反馈，系统会把反馈和答题维度对比（含题目区分度与信度报表），据此调整题目权重、提升角色映射的准确度。

## 🛠️ 技术栈

<div align="center">
  <img src="https://img.shields.io/badge/Vue.js_3-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D" alt="Vue.js" />
  &nbsp;
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  &nbsp;
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  &nbsp;
  
  <img src="https://img.shields.io/badge/Cloudflare_Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Pages" />
  &nbsp;
  <img src="https://img.shields.io/badge/Cloudflare_D1-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare D1" />
</div>

## ⚙️ 架构与原理

<details>
<summary><b>点击展开查看工作原理</b></summary>

核心计算流程如下：

```
答题 (39道七级量表题) → 算分 (维度权重+原型权重) → 原型匹配 (8种原型) → 角色命中 (输出唯一代码) → 结果展示
```

1. **答题** — 39 道七级量表题（-3 到 +3），每题关联一个 MBTI 维度与原型权重
2. **算分** — 综合维度权重（MBTI 25%）、原型权重（28%）、角色向量（27%）与角色专属权重（20%）四层评分，输出维度倾向百分比
3. **原型匹配** — 将四维结果映射到 8 种二次元原型之一
4. **角色命中** — 基于维度结果与角色六维向量在角色库中进行 softmax 匹配，命中 1 位主角色并输出自定义角色代码
5. **结果展示** — 角色代码、维度倾向滑块、角色解析、原型描述，支持导出海报

**数据校准与消融实验**：系统会收集用户自愿提交的"真实 MBTI"反馈，把它们当作标签在历史答题数据上离线重放（逐题 / 逐维度开关对比），验证不同权重配置下的匹配准确率与维度偏差，再把验证过的最优配置上线。每轮校准有独立的版本号，支持一键回退。

</details>

更完整的架构视图（数据流图、分层职责、扩展指南）见 [`docs/architecture.md`](docs/architecture.md)；后端接口契约见 [`docs/backend.md`](docs/backend.md) 与公开规范 [`/api/openapi.yaml`](public/api/openapi.yaml)；关键设计决策的取舍记录见 [`docs/adr/`](docs/adr/)。

<details>
<summary><b>点击展开查看项目目录结构</b></summary>

```text
src/
├── components/           # 可复用 UI 组件
│   ├── home/             # 首页区块（Hero / 数据 / 推广 / 评价 / 更新弹窗）
│   ├── AppIcon.vue
│   ├── SharePoster.vue   # 分享海报
│   └── AdsenseSlot.vue
├── composables/          # Vue 组合式函数
│   ├── useQuiz.ts        # 测试状态、进度持久化与结果计算入口
│   ├── useCharacterRarity.ts # 稀有度徽章派生逻辑（结果页/海报共用）
│   ├── useShare.ts       # 分享文案与海报导出
│   └── useSeo.ts         # 页面 meta / OG / JSON-LD
├── content/characters/   # 角色源数据（每角色一个 JSON：meta + visual + i18n）
├── data/                 # 题库与聚合产物（角色相关由脚本生成）
│   ├── questions.json             # 39 道情境式题目
│   ├── questionDimensionWeights.json  # 逐题维度权重（校准产物）
│   ├── archetypes.json            # 8 个角色原型定义
│   ├── characters.json            # 角色资料库（自动生成）
│   ├── characterVisuals.json      # 角色视觉配置（自动生成）
│   ├── characterMessages.json     # 角色多语言文案（自动生成，按需异步加载）
│   └── characterProbabilities.json # 角色命中概率先验
├── i18n/                 # 国际化（简中/繁中/英/日）
│   ├── messages.ts       # UI 文案与题目翻译
│   ├── characters.ts     # 角色名/系列名翻译与隐藏角色处理
│   └── characterMessages.ts # 角色文案的按需加载入口
├── pages/                # 页面组件（Home/Quiz/Result/Characters/Stats/About/Sponsor）
├── types/quiz.ts         # 类型定义与答案量程常量
├── utils/
│   ├── quizEngine.ts     # 评分、原型匹配、角色命中逻辑
│   ├── characterRarity.ts      # 稀有度分桶
│   ├── characterVisuals.ts     # 角色视觉注水与图片路径归一
│   ├── characterProbability.ts # 角色命中概率
│   ├── statsReporter.ts        # 结果/反馈匿名上报
│   ├── insight.ts              # AI 解读请求（只上传维度倾向）
│   ├── color.ts                # 主题色工具（对比度/混色）
│   ├── adsense.ts              # Google AdSense 配置
│   └── storage.ts              # localStorage 工具（结果 + 答题进度）
├── router/index.ts        # 路由配置（含 View Transitions 包装）
├── App.vue                # 根组件（导航/页脚/语言切换）
├── main.ts                # 入口文件（含 v-reveal 指令）
└── style.css              # 全局样式

functions/                 # Cloudflare Pages Functions（后端 API + 全局中间件）
├── api/insight.ts         # AI 结果解读（Workers AI + D1 分桶缓存）
└── api/_data/             # 构建期生成的角色精简档案（AI 提示词素材）
cron-worker/               # 独立 Cron Worker（统计快照重算与限流表清理）
migrations/                # Cloudflare D1 数据库迁移（CI 会在全新库上干跑校验）
scripts/                   # 数据校验 / 聚合构建 / E2E 冒烟等脚本
tests/                     # Vitest 单元测试（评分引擎/颜色/存储）
analysis/                  # 反馈数据分析与权重校准流水线（本地）
docs/
├── adr/                   # 架构决策记录（MADR 格式，8 篇）
├── architecture.md        # 系统架构总览（数据流图 + 扩展指南）
├── backend.md             # 后端接口与数据库说明
└── api.md                 # API 调用说明（规范文件见 public/api/openapi.yaml）
```

后端 API、数据库迁移与 cron-worker 的详细说明见 [`docs/backend.md`](docs/backend.md)。

</details>

<details>
<summary><b>点击展开查看内容数据一览</b></summary>

| 文件 | 说明 |
|:-----|:-----|
| `src/data/questions.json` | 39 道情境式题目 — 维度、原型权重、场景标签 |
| `src/data/archetypes.json` | 8 个角色原型 — 名称、描述、亮点、短板 |
| `src/data/characters.json` | 113 个角色条目（含隐藏角色） — 角色代码、MBTI 映射、标签、六维向量（构建时自动生成） |
| `src/data/characterVisuals.json` | 角色视觉配置 — 立绘、色彩、主题（构建时自动生成） |
| `src/data/characterProbabilities.json` | 角色命中概率 — 基于人群统计的先验分布 |

</details>

## 📰 时间线

- **2026.4.18 12:00:** GitHub 仓库 ⭐ 数量达到 500，访问量达到 550 万
- **2026.4.14 15:00:** [网站](https://acgti.tianxingleo.top/)访问量超过 400 万，发布复盘博客：[《从一晚上一米工位到 2 天 68w 人访问的网站，我做了什么》](https://tianxingleo.top/2026/04/12/%E4%BB%8E%E4%B8%80%E6%99%9A%E4%B8%8A%E4%B8%80%E7%B1%B3%E5%B7%A5%E4%BD%9C%E4%BD%8D%E5%88%B02%E5%A4%A968w%E4%BA%BA%E8%AE%BF%E9%97%AE%E7%9A%84%E7%BD%91%E7%AB%99%EF%BC%8C%E6%88%91%E5%81%9A%E4%BA%86%E4%BB%80%E4%B9%88/)
- **2026.4.13 21:00:** [网站](https://acgti.tianxingleo.top/)访问人数达到 100 万，仓库 Star 数达到 300
- **2026.4.12 8:00:** 访问人数达到 50 万
- **2026.4.11 23:00:** 进入 [永雏塔菲](https://www.bilibili.com/video/BV11FDyBZEN1/?spm_id_from=333.337.search-card.all.click) 直播间
- **2026.4.11 12:00:** 在校内 100 人 BanG Dream 群测试，首次公开
- **2026.4.10:** 创建仓库

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_04_cd104ba6bdd4ba3053fcbd82fa1513f7.webp)

## 🚀 本地开发

环境要求：Node.js >= 22（与 CI 一致）。图片处理脚本另需 Python 3 + Pillow（可选）。

```bash
# 安装依赖
npm install

# 启动前端开发服务器
npm run dev

# 构建
npm run build

# 启动全栈本地开发（含 Cloudflare D1 + Pages Functions）
npm run dev:pages
```

推荐的本地联调流程（避免 `--proxy` 弃用告警）：

```bash
# 终端 1（仓库根目录）：监听构建产物到 dist/
npm run build:watch

# 终端 2（仓库根目录）：启动 Pages + Functions + D1
npm run dev:pages
```

然后访问：`http://127.0.0.1:8788/stats`

注意：

- `wrangler pages dev ...` 必须在仓库根目录执行，不要在 `cron-worker/` 目录执行。
- 如果需要单独调试 Cron Worker，请在 `cron-worker/` 目录运行 `npm run dev`。该模式下出现 "Scheduled Workers are not automatically triggered during local development." 是正常提示，可按日志里的 `curl /cdn-cgi/handler/scheduled` 手动触发。

构建产物输出到 `dist/`（站点部署在根路径）。后端 API 基于 Cloudflare Pages Functions，使用 D1 数据库存储匿名统计数据，部署在 Cloudflare Pages 上。

### 后端与环境变量

后端 API 基于 Cloudflare Pages Functions + D1 数据库，主要承担以下职责：

- **结果上报**：接收前端匿名提交的测试结果（命中角色、原型、四维倾向百分比），写入 D1 用于全站统计与排行榜展示。
- **反馈收集**：用户可在结果页自愿提交"真实 MBTI"自评，与答题维度对比后用于后续校准题目权重。
- **统计查询**：提供角色排行、原型分布等聚合数据接口，供统计页与结果页展示。

## 🤝 贡献

欢迎 **Star** · 欢迎 **Fork** · 欢迎 **Issue** · 欢迎 **PR**！

当前项目仍处于早期阶段，题目数量和角色库都还不够丰富。如果你有好的情境题目想法或想补充更多作品的角色，非常期待你的参与：

- 补充新角色 → 在 `src/content/characters/` 下新增 `<id>.json`（详见 [新增角色流程](docs/新增角色流程.md)）
- 添加新题目 → 编辑 `src/data/questions.json`
- 希望新增某个角色 / 某部作品 → 欢迎先提 Issue，附上角色名、作品名和推荐理由
- 对题目表述、题目维度、现有角色设定或结果解析有改进意见 → 欢迎提 Issue 讨论
- 修复 Bug / 改进 UI → 直接提 PR

> 新增角色的完整流程（含 WebP 图片转换、缩略图生成、概率重算等）请参考 [**新增角色流程文档**](docs/新增角色流程.md)。

### 欢迎二次创作

欢迎基于本项目 Fork、改版、二次创作与衍生开发。

如果你基于本项目发布自己的版本，建议同时做到以下几点：

- 在仓库 `README`、网站页脚、关于页或发布说明中明确标注出处，并附上原项目链接：<https://github.com/tianxingleo/ACGTI>
- 在说明文案中清楚写明"基于 ACGTI 项目二次创作 / 修改"
- 保留当前仓库可追溯的 Git 提交历史与贡献记录，不要在迁移或改版时刻意抹除原始贡献者信息
- 如果你的版本做了明显调整，请额外注明改动范围，避免与原始项目混淆

### 分支管理

| 分支 | 用途 |
| :--- | :--- |
| `main` | 稳定版本，仅接受来自 `dev` 的合并 |
| `dev` | 开发分支，日常开发在此进行 |

- **内部开发**：在 `dev` 分支上进行开发，稳定后向 `main` 发起 PR 合并
- **外部贡献**：Fork 本仓库后，向 `dev` 分支提交 Pull Request
- **CI 校验**：仓库已配置 GitHub Actions，会在 `push` 到 `main`/`dev` 和所有 PR 上自动执行数据校验、前后端类型检查、D1 迁移干跑与 `npm run build`

线上部署由 Cloudflare Pages 负责，后端 API 通过 Cloudflare Pages Functions 运行，数据存储在 Cloudflare D1 数据库中。

## 📦 持续集成与部署

- **GitHub Actions**：在 `main`/`dev` 的 push 和 PR 上运行完整 CI 检查（数据校验、类型检查、构建）
- **Cloudflare Pages**：负责连接 GitHub 后的自动构建与部署，同时托管 Pages Functions 后端 API
- **GitHub Release**：在推送 `v*` tag 时自动构建 `dist/`、打包为 zip，并创建 Release

发版方式示例：

```bash
git tag vX.Y.Z
git push origin vX.Y.Z   # 推送 tag 触发 Release 工作流
```

## 📄 开源协议与免责声明

### 代码授权

本项目源代码基于 [Apache License 2.0](LICENSE) 开源。您可以学习、修改和分发本项目的代码，但在再分发或衍生发布时，需要一并提供许可证文本、保留适用的版权与归属声明，并在修改过的文件中明确标注已修改。根目录中的 [NOTICE](NOTICE) 记录了本项目的原始归属信息。

### 归属与修改说明

- 本项目由 **tianxingleo / Li Tianxing** 原始创建，原始仓库为 <https://github.com/tianxingleo/ACGTI>。
- 欢迎 Fork 本项目继续开发、改版或二次创作；基于本项目公开发布衍生版本时，请引用原项目并注明来源。
- 再分发或衍生版本不应删除原始版权与归属信息，也不应将修改版本描述为完全独立原创而不提及来源。
- 如无特殊原因，建议直接在 GitHub 上保留 Fork 关系，或至少保留可追溯的提交历史、Contributors 页面与其他仓库贡献记录。
- 修改过的版本应明确说明哪些文件或内容已经调整，避免与原始项目混淆。

### 品牌与官方关系声明

- Apache-2.0 不自动授予 `ACGTI` 项目名称、Logo 等品牌元素的使用权，也不代表官方背书。
- 任何再分发的版本、镜像站、改版站或衍生项目，均不得暗示自己与原作者存在官方合作、官方维护或获得原作者认可，除非另有明确授权。

### 知识产权与素材声明 ⚠️

- 项目中使用的所有二次元角色名称、设定、图像资源（包含但不限于立绘、截图、图标等）的版权均属于其**原版权方或原作者**（如各大动画制作委员会、游戏开发商、插画师等）。
- 本项目不主张对任何引用的角色 IP 拥有所有权，属于非营利的同人衍生交流，主张对引用素材构成合理使用（Fair Use）。如有侵权，请提交 Issue 或通过邮件联系，我们将第一时间配合下架并删除相关内容。

### 隐私与数据安全

- 本工具的核心计算过程在**本地浏览器**中完成。
- 结果页会**匿名上报最终命中角色、原型与维度倾向**到后端（Cloudflare D1），用于全站统计、题目校准与角色映射优化；另有约 2% 的提交会按抽样保留匿名逐题答案，用于校准。
- 我们**不会**收集邮箱、手机号、昵称等直接身份信息，也不会存储完整 IP 或 User-Agent。
- 用户可自愿在结果页提交"真实 MBTI"反馈，用于校准题目权重，该反馈完全匿名且可选。

### 测试结果声明

- 本测试把公开的 MBTI 理论和二次元角色原型结合起来，做了娱乐化改编。测试结果**不具备任何专业的心理学、医学或社会学参考价值**，请仅当作同人娱乐看待，勿将其作为现实生活指导或专业诊断的依据。

## Star History

<a href="https://www.star-history.com/?repos=tianxingleo%2FACGTI&type=date&legend=top-left">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="https://api.star-history.com/chart?repos=tianxingleo/ACGTI&type=date&theme=dark&legend=top-left"
    />
    <source
      media="(prefers-color-scheme: light)"
      srcset="https://api.star-history.com/chart?repos=tianxingleo/ACGTI&type=date&legend=top-left"
    />
    <img
      alt="Star History Chart"
      src="https://api.star-history.com/chart?repos=tianxingleo/ACGTI&type=date&legend=top-left"
    />
  </picture>
</a>

## 致谢

- **界面风格** — 参考了 [16personalities](https://www.16personalities.com/) 的扁平化设计与测评体验
- **项目启发** — 受到开源项目 [UnluckyNinja/SBTI-test](https://github.com/UnluckyNinja/SBTI-test) 的启发
- **视觉素材** — 项目中的角色立绘与背景图片由 **ChatGPT (DALL·E)** 生成
- **特别鸣谢** — [saurlax](https://saurlax.com/) 提供 GPT-5.4 Token 支持

## 支持项目

如果你喜欢 ACGTI 并希望支持它的持续维护和更新：

- ⭐ 在 GitHub 给仓库点 Star
- 🔁 把测试链接分享给朋友、群聊或同好圈
- 💖 赞助支持：[赞助页面](https://acgti.tianxingleo.top/sponsor)

你的支持会用来支付服务器、域名、数据库等开销。

> 赞助完全自愿，不涉及任何商品或服务交易。ACGTI 核心功能对所有用户免费。

<details>
<summary><b>扫码赞助</b></summary>

<table>
  <tr>
    <td align="center">
      <img src="https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_04_2cebfcbc467809e334f38fd4b2e22aa8.webp" alt="微信收款码" width="200" />
      <br/>微信支付
    </td>
    <td align="center">
      <img src="https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_04_d2c89724432aca7063429257cb363d62.webp" alt="支付宝收款码" width="200" />
      <br/>支付宝
    </td>
  </tr>
</table>

</details>

## 作者

**tianxingleo** · [GitHub 主页](https://github.com/tianxingleo/) · [作者主页](https://tianxingleo.top)

## Contributors

<a href="https://github.com/tianxingleo/ACGTI/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tianxingleo/ACGTI" />
</a>

<div align="center">

---

**[⬆ 回到顶部](#acgti)**

</div>
