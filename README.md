<div align="center">

# ACGTI

ACG Type Indicator

**一个以 MBTI 为基础的二次元角色原型测试站点**

回答情境式问题 · 获得唯一命中的角色代码 · 解锁你的二次元人格原型

<p align="center">
  <a href="https://acgti.tianxingleo.top/"><img src="https://img.shields.io/badge/Deploy-Cloudflare_Pages-F38020?style=flat-square&logo=cloudflare" alt="Deploy to Cloudflare Pages" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/Hits-4M+-green.svg?style=flat-square" alt="Hits" />
</p>

[**✨ 立即体验**](https://acgti.tianxingleo.top/) | [**📖 阅读文档**](#️-架构与原理) | [**🤝 参与贡献**](#-贡献)

> ⚠️ 本工具仅作娱乐用途，不作为心理诊断、医学评估或现实人格结论。

</div>

---

## 🎮 界面预览

<div align="center">
  <img src="https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_04_85afc638204090e964a385ef024963af.webp" alt="首页截图" width="45%" />
  &nbsp;
  <img src="https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_04_53f6126c96077f9990f8c8f4aef7d20d.webp" alt="答题截图" width="45%" />
  <br />
  <br />
  <img src="https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_04_a4b8624d8dfeeeb23ca0b2de7a344e24.webp" alt="结果截图一" width="45%" />
  &nbsp;
  <img src="https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_04_83aa34b38a795f68b26eadbef4fca2b8.webp" alt="结果截图二" width="45%" />
</div>

## ✨ 核心特性

- **MBTI 四维判定**：基于 E/I、S/N、T/F、J/P 四大维度构建严谨的底层框架。
- **8 种专属原型**：发光主角位 · 冰面观察者 · 誓约队长 · 灵巧回旋者 · 温柔修复者 · 影面策士 · 混沌火花 · 月下守护者。
- **42 位角色库**：当前包含 40 位常规角色与 2 位隐藏角色，涵盖 VOCALOID、EVA、名侦探柯南、东方、孤独摇滚、MyGO、原神等热门作品，持续扩充中。
- **可视化交互**：16personalities 风格的交互式倾向滑块，直观展现你的思维倾向。
- **一键分享**：精美的结果图报表，支持一键导出 PNG 海报分享给同好。
- **纯前端架构**：无后端、无注册、无数据收集，测算过程全部在本地浏览器完成，极致极速且保护隐私。

## 🛠️ 技术栈

<div align="center">
  <img src="https://img.shields.io/badge/Vue.js_3-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D" alt="Vue.js" />
  &nbsp;
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  &nbsp;
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  &nbsp;
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
</div>

## ⚙️ 架构与原理

<details>
<summary><b>点击展开查看工作原理</b></summary>

核心计算流程如下：

```
答题 (39道七级量表题) → 算分 (维度权重+原型权重) → 原型匹配 (8种原型) → 角色命中 (输出唯一代码) → 结果展示
```

1. **答题** — 39 道七级量表题（-3 到 +3），每题关联一个 MBTI 维度与原型权重
2. **算分** — 按维度累加带符号权重，计算每个维度的倾向百分比（50%–100%）
3. **原型匹配** — 将四维结果映射到 8 种二次元原型之一
4. **角色命中** — 根据维度结果在角色库中命中 1 位主角色，输出其自定义角色代码
5. **结果展示** — 角色代码、维度倾向滑块、角色解析、原型描述，支持导出海报

</details>

<details>
<summary><b>点击展开查看项目目录结构</b></summary>

```text
src/
├── components/           # 可复用 UI 组件
│   ├── AppIcon.vue
│   ├── ProgressBar.vue
│   ├── QuestionCard.vue
│   ├── ResultSummary.vue
│   ├── SharePoster.vue
│   └── AdsenseSlot.vue
├── composables/          # Vue 组合式函数
│   ├── useQuiz.ts       # 测试状态与逻辑
│   └── useShare.ts      # 分享与导出功能
├── data/                # 静态数据
│   ├── questions.json   # 39 道情境式题目
│   ├── archetypes.json  # 8 个角色原型定义
│   ├── characters.json  # 角色资料库
│   ├── characterVisuals.json       # 角色视觉配置
│   └── characterProbabilities.json # 角色命中概率
├── pages/               # 页面组件
│   ├── HomePage.vue     # 首页
│   ├── IntroPage.vue    # 测试说明页
│   ├── QuizPage.vue     # 答题页
│   ├── ResultPage.vue   # 结果展示页
│   ├── CharactersPage.vue # 角色图鉴页
│   └── AboutPage.vue    # 关于页
├── types/
│   └── quiz.ts          # TypeScript 类型定义
├── utils/
│   ├── quizEngine.ts    # 评分、原型匹配、角色命中逻辑
│   ├── characterVisuals.ts    # 角色视觉数据注水
│   ├── characterProbability.ts # 角色命中概率计算
│   ├── adsense.ts       # Google AdSense 配置
│   └── storage.ts       # localStorage 工具
├── router/
│   └── index.ts         # 路由配置
├── App.vue              # 根组件
├── main.ts              # 入口文件
└── style.css            # 全局样式
```

</details>

<details>
<summary><b>点击展开查看内容数据一览</b></summary>

| 文件 | 说明 |
|:-----|:-----|
| `src/data/questions.json` | 39 道情境式题目 — 维度、原型权重、场景标签 |
| `src/data/archetypes.json` | 8 个角色原型 — 名称、描述、亮点、短板 |
| `src/data/characters.json` | 42 个角色条目（含 2 个隐藏角色）— 角色代码、MBTI 映射、标签、六维向量 |
| `src/data/characterVisuals.json` | 角色视觉配置 — 立绘、色彩、主题 |
| `src/data/characterProbabilities.json` | 角色命中概率 — 基于人群统计的先验分布 |

</details>

## 📰 时间线

- **2026.4.14 15:00** [网站](https://acgti.tianxingleo.top/)访问量超过 400 万
- **2026.4.13 21:00:** [网站](https://acgti.tianxingleo.top/)访问人数达到 100 万，仓库Star 数达到 300
- **2026.4.12 8:00:** 访问人数达到 50 万
- **2026.4.11 23:00:** 进入 [**永雏塔菲**](https://www.bilibili.com/video/BV11FDyBZEN1/?spm_id_from=333.337.search-card.all.click) 直播间
- **2026.4.11 12:00:** 在校内 100 人 BanG Dream 群测试，首次公开
- **2026.4.10:** 创建仓库

## 🚀 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build
```

构建产物输出到 `dist/`，配置为相对路径（`base: './'`），可直接部署到 Cloudflare Pages 等静态托管平台。

## 🤝 贡献

欢迎 **Star** · 欢迎 **Fork** · 欢迎 **PR**！

当前项目仍处于早期阶段，题目数量和角色库都还不够丰富。如果你有好的情境题目想法或想补充更多作品的角色，非常期待你的参与：

- 补充新角色 → 编辑 `src/data/characters.json`（详见 [新增角色流程](docs/新增角色流程.md)）
- 添加新题目 → 编辑 `src/data/questions.json`
- 修复 Bug / 改进 UI → 直接提 PR

> 新增角色的完整流程（含 WebP 图片转换、缩略图生成、概率重算等）请参考 [**新增角色流程文档**](docs/新增角色流程.md)。

### 分支管理

| 分支 | 用途 |
| :--- | :--- |
| `main` | 稳定版本，仅接受来自 `dev` 的合并 |
| `dev` | 开发分支，日常开发在此进行 |

- **内部开发**：在 `dev` 分支上进行开发，稳定后向 `main` 发起 PR 合并
- **外部贡献**：Fork 本仓库后，向 `dev` 分支提交 Pull Request
- **CI 校验**：仓库已配置 GitHub Actions，会在 `push` 到 `main`/`dev` 和所有 PR 上自动执行 `npm ci` 与 `npm run build`

线上部署由 Cloudflare Pages 负责。

## 📦 持续集成与部署

- **GitHub Actions**：负责在 `main` push / PR 时校验构建是否通过
- **Cloudflare Pages**：负责连接 GitHub 后的自动构建与部署
- **GitHub Release**：在推送 `v*` tag 时自动构建 `dist/`、打包为 zip，并创建 Release

发版方式示例：

```bash
git tag v0.2.0
git push origin v0.2.0
```

## 📄 开源协议与免责声明

### 代码授权

本项目前端源代码基于 [MIT License](LICENSE) 开源。您可以自由地学习、修改和分发本项目的源代码，但请保留原作者的版权声明。

### 知识产权与素材声明 ⚠️

- 项目中使用的所有二次元角色名称、设定、图像资源（包含但不限于立绘、截图、图标等）的版权均属于其**原版权方或原作者**（如各大动画制作委员会、游戏开发商、插画师等）。
- 本项目不主张对任何引用的角色 IP 拥有所有权。本项目属于"合理使用（Fair Use）"范畴下的同人衍生交流性质。如有侵权，请提交 Issue 或通过邮件联系，我们将第一时间配合下架并删除相关内容。

### 隐私与数据安全

- 本工具为**纯前端运行**架构（无后端服务器）。
- 您的所有测试过程、点击数据与最终生成的结果海报，均只在您的**本地浏览器**中计算生成。我们**不会**收集、上传或存储您的任何答题数据或个人隐私信息。

### 测试结果声明

- 本测试基于部分公开的 MBTI 理论与二次元角色原型进行结合与娱乐化重构。测试结果**不具备任何专业的心理学、医学或社会学参考价值**，请仅当作同人娱乐看待，勿将其作为现实生活指导或专业诊断的依据。

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

- **界面风格** — 参考自 [16personalities](https://www.16personalities.com/) 的扁平化设计与专业测评体验
- **项目启发** — 受到开源项目 [UnluckyNinja/SBTI-test](https://github.com/UnluckyNinja/SBTI-test) 的启发
- **视觉素材** — 项目中的角色立绘与背景图片由 **ChatGPT (DALL·E)** 生成
- **特别鸣谢** — [saurlax](https://saurlax.com/) 提供 GPT-5.4 Token 支持

## 作者

**tianxingleo** · [GitHub 主页](https://github.com/tianxingleo/) · [作者主页](https://tianxingleo.top)

<div align="center">

---

**[⬆ 回到顶部](#acgti)**

</div>
