# ACGTI

**ACGTI = ACG Type Indicator**

一个以 MBTI 为基础的二次元角色原型测试站点。通过回答情境式问题，获得你唯一命中的角色代码、维度倾向比例，以及对应的二次元角色原型解析。

> **试玩链接：[https://acgti.tianxingleo.top/](https://acgti.tianxingleo.top/)**
>
> 本工具仅作娱乐用途，不作为心理诊断、医学评估或现实人格结论。

## 贡献

欢迎 Fork，欢迎 PR！当前项目仍处于早期阶段，题目数量和角色库都还不够丰富，如果你有好的情境题目想法或想补充更多作品的角色，非常期待你的参与。

## 特性

- **MBTI 四维判定** — 标准的 E/I、S/N、T/F、J/P 四维度测评作为底层框架
- **8 种二次元原型** — 发光主角位、冰面观察者、誓约队长、灵巧回旋者、温柔修复者、影面策士、混沌火花、月下守护者
- **22 位角色库** — 涵盖 VOCALOID、EVA、东方Project、孤独摇滚、MyGO、Ave Mujica、原神等作品
- **维度可视化** — 16personalities 风格的交互式维度倾向滑块
- **分享海报** — 一键导出结果海报为 PNG
- **本地存储** — 自动保存最近一次测试结果
- **响应式设计** — 适配桌面端与移动端

## 致谢

- **界面风格** — 参考自 [16personalities](https://www.16personalities.com/) 的扁平化设计与专业测评体验。
- **项目启发** — 受到开源项目 [UnluckyNinja/SBTI-test](https://github.com/UnluckyNinja/SBTI-test) 的启发，致力于二次元人格倾向的数字化表达。
- **视觉素材** — 项目中的所有角色立绘与背景图片均由 **ChatGPT (DALL·E)** 生成，旨在提供统一的二次元视觉风格。

## 技术栈

- Vue 3 + Composition API
- TypeScript
- Vite
- Vue Router（Hash 模式）
- html-to-image（海报导出）
- Tailwind CSS（CDN）
- Font Awesome（图标）

## 项目结构

```
src/
├── components/           # 可复用 UI 组件
│   ├── ProgressBar.vue
│   ├── QuestionCard.vue
│   ├── ResultSummary.vue
│   └── SharePoster.vue
├── composables/          # Vue 组合式函数
│   ├── useQuiz.ts       # 测试状态与逻辑
│   └── useShare.ts      # 分享与导出功能
├── data/                # 静态数据
│   ├── questions.json   # 48 道情境式题目
│   ├── archetypes.json  # 8 个角色原型定义
│   └── characters.json  # 角色资料库
├── pages/               # 页面组件
│   ├── HomePage.vue     # 首页（16personalities 风格）
│   ├── IntroPage.vue    # 测试说明页
│   ├── QuizPage.vue     # 答题页
│   ├── ResultPage.vue   # 结果展示页
│   └── AboutPage.vue    # 关于页
├── types/
│   └── quiz.ts          # TypeScript 类型定义
├── utils/
│   ├── quizEngine.ts    # 评分、原型匹配、角色命中逻辑
│   └── storage.ts       # localStorage 工具
├── router/
│   └── index.ts         # 路由配置
├── App.vue              # 根组件（全局 Header/Footer）
├── main.ts              # 入口文件
└── style.css            # 全局样式
```

## 工作原理

1. **答题** — 48 道五级量表题（-3 到 +3），每题关联一个 MBTI 维度（E/I、S/N、T/F、J/P）
2. **算分** — 按维度累加带符号权重，计算每个维度的倾向百分比（50%–100%）
3. **原型匹配** — 将四维结果映射到 8 种二次元原型之一
4. **角色命中** — 根据维度结果在角色库中命中 1 位主角色，并输出其自定义角色代码
5. **结果展示** — 展示角色代码、维度倾向滑块、角色解析、原型描述，支持导出海报

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

构建产物输出到 `dist/`，配置为相对路径（`base: './'`），可直接部署到 GitHub Pages 等静态托管平台。

## 内容数据

| 文件 | 说明 |
|------|------|
| `src/data/questions.json` | 48 道情境式题目，包含维度、权重、场景标签 |
| `src/data/archetypes.json` | 8 个角色原型的完整定义（名称、描述、亮点、短板、向量） |
| `src/data/characters.json` | 22 个角色条目，包含角色代码、MBTI 映射、标签、吐槽文案、六维角色向量 |

## 产品边界

- 纯静态前端，无后端服务、无用户系统、无数据库
- 不作为心理诊断或医学评估工具
- 测试结果保存于浏览器 localStorage
- 不收集邮箱、性别等个人信息
- 部署于 Cloudflare Pages
