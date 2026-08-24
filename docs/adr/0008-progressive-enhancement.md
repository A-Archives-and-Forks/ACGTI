# 0008. 交互能力渐进增强（View Transitions / Web Share Level 2）

- 状态：已接受（2026-08）

## 背景

路由切换此前是 Vue `<transition>` 的 CSS fade（主线程动画）；移动端分享海报要先下载 PNG 再去聊天软件手动选图。两项都有新的 Web 平台能力可以显著改善，但浏览器支持都不是 100%。

## 候选方案

1. **引入动画/分享库**（GSAP、react-share 类）：能力最全，但违背零依赖原则，且这些原生能力已足够。
2. **等全浏览器支持再做**：保守，浪费已有 85%+ 用户的体验收益。
3. **渐进增强**：能力探测 + 原路径兜底。

## 决定

采用方案 3，两个能力各一条降级链：

- **View Transitions**：在 `src/router/index.ts` 统一包装 `router.push/replace`（`document.startViewTransition` 的回调内完成导航，旧页快照冻结期恰好覆盖懒加载 chunk 的等待）；支持 VT 时 `App.vue` 停用 Vue fade 避免双动画；`prefers-reduced-motion` 用户与不支持的浏览器回落原 fade。**刻意不用 RouterLink 的 `view-transition` prop**——它内部恰好调用被包装的实例方法，prop 会叠加第二层过渡并产生 "Transition was skipped" 噪音。
- **Web Share Level 2**：`useShare.sharePosterFile` 用 `toBlob` 生成 PNG 后经 `canShare({files})` 探测，支持则直接进系统分享面板（移动端一步发图）；用户取消视为成功，其余失败回落原「下载 PNG」路径。

## 后果

- 正面：Chrome 111+/Safari 18+/Firefox 144+ 用户获得合成器线程的页面过渡；移动端分享转化链路从三步变一步；不支持的浏览器零感知。
- 负面：VT 动画与页面内滚动恢复的交互需要留意（scrollBehavior 已处理锚点与历史位置）；分享文件的 `text` 字段在部分平台被忽略（海报图本身承载信息，可接受）。
