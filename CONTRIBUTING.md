# 贡献指南

感谢你对 ACGTI 项目的关注！在提交 Issue 或 Pull Request 之前，请务必阅读以下规范。

## 环境准备

- Node.js >= 22（与 CI 一致）
- 如需运行图片处理脚本：Python 3 + Pillow（可选）

```bash
# 安装依赖
npm install

# 启动前端开发服务器
npm run dev

# 全栈本地联调（含 Cloudflare D1 + Pages Functions）
npm run build:watch   # 终端 1：监听构建产物到 dist/
npm run dev:pages     # 终端 2：启动 Pages + Functions + D1，访问 http://127.0.0.1:8788
```

后端 API、数据库迁移与 cron-worker 的说明见 [`docs/backend.md`](docs/backend.md)。

## 分支策略

| 分支 | 用途 | 说明 |
|------|------|------|
| `main` | 生产环境稳定分支 | 仅接受来自 `dev` 的合并，不接受直接 PR |
| `dev` | 主要开发分支 | 所有功能提交、Bug 修复等 PR 请务必指向此分支 |

### ⚠️ 重要提醒

- **所有 PR 请将目标分支设置为 `dev`。**
- 针对 `main` 分支的非紧急修复 PR 将被直接关闭。

## 如何贡献

### 1. Fork 并创建分支

```bash
# Fork 后克隆你的仓库
git clone https://github.com/<你的用户名>/ACGTI.git
cd ACGTI

# 基于 dev 创建你的功能分支
git checkout dev
git checkout -b feature/your-feature-name
```

### 2. 开发与提交

- 确保你的修改基于最新的 `dev` 分支。
- 提交信息请使用中文，采用"标题 + 空行 + 正文"的形式，标题行使用 `<类型>(<范围>): <摘要>`（类型如 feat / fix / docs / style / refactor / perf / chore）。
- 每次提交只包含一个逻辑变更，避免混合多个不相关的修改。

### 3. 提交前自检

PR 前请在本地确认以下检查通过（CI 也会执行同样的检查）：

```bash
npm run validate:data   # 角色数据校验（图片引用、孤儿图片、i18n 完整性等）
npm test                # 单元测试（评分引擎、颜色、存储等纯函数模块）
npm run build           # 类型检查 + 构建（内含数据校验）
npm run test:e2e        # 可选：无头浏览器冒烟测试（需先启动 npm run dev:pages）
```

### 4. 提交 Pull Request

- 目标分支选择 `dev`。
- 在 PR 中清楚描述你解决的问题或新增的功能。
- 如果你暂时不准备直接提交代码，也欢迎先提交 Issue，提出希望新增的角色，以及对题目设计、现有角色映射与结果文案的改进意见。
- 如果相关，请附上截图或录屏。

### 5. 代码审查

- 维护者会在有空时进行审查，请耐心等待。
- 如果需要修改，请直接在原分支上追加提交。

## 贡献新角色 / 新题目

- **新增角色**：在 `src/content/characters/` 下新增 `<id>.json`，完整流程（含 WebP 图片转换、缩略图生成、概率重算等）请参考 [新增角色流程文档](docs/新增角色流程.md)。也可以先提 Issue（有现成的"角色申请"模板）由维护者代做。
- **新增题目**：编辑 `src/data/questions.json`。注意题目翻译按顺序维护在 `src/i18n/messages.ts` 的三份 `quiz.questions` 数组中（zh-TW / en / ja），增删题目时需要同步。

## 行为准则

- 保持友善和尊重。
- 专注于问题本身，不针对个人。
- 建设性的反馈和建议始终欢迎。
