// 端到端冒烟测试：用本机 Edge 无头模式模拟真实用户走完核心流程。
// 用法：直接 node scripts/e2e-smoke.mjs —— 脚本会自管本地 Pages 服务器
// （启动前临时剥离 wrangler.jsonc 的 ai binding：本地网络到 Workers AI
//  远程网关不可达时该 binding 会拖垮 workerd；测试结束自动恢复配置）。
import { execSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:8788'
const WRANGLER_CONFIG = 'wrangler.jsonc'

const results = []
const consoleErrors = []
function pass(name) { results.push(['PASS', name]); console.log('  ✅', name) }
function fail(name, detail) {
  results.push(['FAIL', name])
  console.error('  ❌', name, detail ?? '')
  // 任何失败都必须让进程以非零码退出，否则 CI 拿到"假绿"
  process.exitCode = 1
}

// ── 浏览器可执行文件解析 ──
// 优先级：环境变量 ACGTI_E2E_BROWSER > 按平台探测常见安装位置。
// 都找不到时给出明确的配置说明后非零退出（服务器可能已自启，需先清理）。
const BROWSER_CANDIDATES =
  process.platform === 'win32'
    ? [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
        ]

function resolveBrowserExecutable() {
  const fromEnv = process.env.ACGTI_E2E_BROWSER
  if (fromEnv) {
    if (existsSync(fromEnv)) return fromEnv
    console.error(`ACGTI_E2E_BROWSER 指定的浏览器不存在: ${fromEnv}`)
    console.error('请检查路径是否正确（应为浏览器可执行文件，如 msedge.exe / chrome），')
    console.error('Windows 路径示例: set ACGTI_E2E_BROWSER="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"')
    return null
  }
  const found = BROWSER_CANDIDATES.find((p) => existsSync(p))
  if (found) return found
  console.error('未找到可用的浏览器（puppeteer-core 不自带 Chromium）。已尝试以下位置:')
  BROWSER_CANDIDATES.forEach((p) => console.error(`  - ${p}`))
  console.error('请安装 Chrome / Edge / Chromium，或通过环境变量显式指定:')
  console.error('  ACGTI_E2E_BROWSER=<浏览器可执行文件路径> node scripts/e2e-smoke.mjs')
  return null
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function pingServer(timeoutMs) {
  try {
    const resp = await fetch(BASE + '/api/ping', { signal: AbortSignal.timeout(timeoutMs) })
    return resp.ok
  } catch {
    return false
  }
}

// ── 服务器生命周期 ──
// 已有服务器在跑（用户手动开的 dev:pages）则直接复用；否则临时去掉
// ai binding 后自启一个，测试完恢复配置并结束进程树。
const originalConfig = readFileSync(WRANGLER_CONFIG, 'utf-8')
let serverProcess = null

function cleanupServer() {
  if (serverProcess?.pid) {
    try {
      // Windows 下需要按进程树结束，否则 workerd 子进程残留占住端口
      execSync(`taskkill /pid ${serverProcess.pid} /T /F`, { stdio: 'ignore' })
    } catch {}
    serverProcess = null
  }
  writeFileSync(WRANGLER_CONFIG, originalConfig, 'utf-8')
}

if (!(await pingServer(1500))) {
  const stripped = originalConfig.replace(/,?\s*\/\/[^\n]*\n\s*"ai":\s*\{[^}]*\}/, '')
  writeFileSync(WRANGLER_CONFIG, stripped, 'utf-8')
  serverProcess = spawn('npx', ['wrangler', 'pages', 'dev', 'dist', '--port', '8788'], {
    shell: true,
    stdio: 'ignore',
  })
  let ready = false
  for (let i = 0; i < 40; i++) {
    if (await pingServer(1000)) { ready = true; break }
    await sleep(1000)
  }
  if (!ready) {
    cleanupServer()
    console.error('本地 Pages 服务器启动失败（先跑 npm run build 生成 dist/）')
    process.exit(1)
  }
  console.log('已启动本地 Pages 服务器（无 ai binding）')
}

// Ctrl+C / 终止信号下 finally 不会执行，这里显式恢复配置并清理进程
process.on('SIGINT', () => { cleanupServer(); process.exit(130) })
process.on('SIGTERM', () => { cleanupServer(); process.exit(143) })

async function text(page, selector) {
  return page.$eval(selector, el => el.textContent?.trim() ?? '').catch(() => null)
}

const browserPath = resolveBrowserExecutable()
if (!browserPath) {
  cleanupServer()
  process.exit(1)
}

let browser = null
try {
  browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,900'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message))
  // AI 解读依赖远程 Workers AI（冒烟环境网络不可达，且额度宝贵）：
  // 统一拦截为不可用，顺带验证「后端不可用时卡片隐藏」的降级路径
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    if (req.url().includes('/api/insight')) {
      req.respond({ status: 200, contentType: 'application/json', body: '{"text":null,"available":false}' })
    } else {
      req.continue()
    }
  })

  // ── 1. 首页 ──
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(800)
  const homeTitle = await page.title()
  homeTitle.includes('ACGTI') ? pass('首页标题: ' + homeTitle) : fail('首页标题', homeTitle)
  const ogImage = await page.$eval('meta[property="og:image"]', el => el.content).catch(() => null)
  ogImage ? pass('OG image meta: ' + ogImage) : fail('OG image meta 缺失')
  await page.screenshot({ path: 'scripts/e2e-home.png' })
  pass('首页截图')

  // ── 2. 进入答题页 ──
  await page.goto(BASE + '/quiz', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('.question-block', { timeout: 15000 })
  await sleep(500)
  let blocks = await page.$$eval('.question-block', els => els.length).catch(() => 0)
  blocks === 39 ? pass('答题页渲染 39 题') : fail('答题页题目数', String(blocks))

  // 未答题置灰：第 2 题应有 upcoming-dimmed
  const dimmed = await page.$eval('.question-block:nth-child(2)', el => el.classList.contains('upcoming-dimmed')).catch(() => false)
  dimmed ? pass('未答题置灰生效') : fail('未答题置灰未生效')

  // 键盘导航：聚焦第 1 题第 1 个选项，按右方向键
  await page.focus('.question-block .scale-buttons button')
  await page.keyboard.press('ArrowRight')
  const checkedIdx = await page.$$eval('.question-block:nth-child(1) .scale-btn[aria-checked="true"]', els => els.length)
  checkedIdx === 1 ? pass('方向键选中选项') : fail('方向键选中', String(checkedIdx))

  // ── 3. 答完 39 题（每题点一个选项，模拟真实用户） ──
  for (let q = 1; q <= 39; q++) {
    // 按题序交替选择不同档位，制造有区分度的作答
    const optionIdx = [7, 1, 4, 2, 6, 3, 5, 1, 7, 2][q % 10]
    const clicked = await page.evaluate((q, idx) => {
      const block = document.querySelectorAll('.question-block')[q - 1]
      if (!block) return false
      const btn = block.querySelectorAll('.scale-btn')[idx - 1]
      if (!btn) return false
      btn.click()
      return true
    }, q, optionIdx)
    if (!clicked) { fail(`第 ${q} 题点击失败`); break }
  }
  await sleep(500)
  const progressHint = await text(page, '.progress-hint')
  progressHint && progressHint.includes('39') ? pass('进度提示: ' + progressHint) : fail('进度提示', progressHint ?? '')

  // 刷新验证进度恢复
  await page.reload({ waitUntil: 'domcontentloaded' })
  await sleep(800)
  const hintAfterReload = await text(page, '.progress-hint')
  hintAfterReload && hintAfterReload.includes('39 / 39')
    ? pass('刷新后答题进度已恢复: ' + hintAfterReload)
    : fail('刷新后进度未恢复', hintAfterReload ?? '')

  // ── 4. 提交 ──
  await page.click('.submit-btn')
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
  await sleep(1500)
  const resultUrl = page.url()
  resultUrl.includes('/result') ? pass('跳转结果页: ' + resultUrl) : fail('结果页跳转', resultUrl)
  const heroTitle = await text(page, '.hero-title')
  heroTitle ? pass('结果角色: ' + heroTitle) : fail('结果角色标题缺失')
  const heroCode = await text(page, '.hero-code')
  heroCode ? pass('角色代码: ' + heroCode) : fail('角色代码缺失')
  await page.screenshot({ path: 'scripts/e2e-result.png', fullPage: false })

  // 结果页统计卡片（来自 /api/stats/result）：必须真的命中至少一个统计词，
  // 否则说明统计卡片未渲染或文案缺失（此前空数组也被当 pass 的假绿）
  await sleep(1000)
  const liveStatsText = await page.evaluate(() => document.body.innerText.match(/测过|人测过|命中率|同角色/g)?.slice(0, 4) ?? [])
  liveStatsText.length >= 1
    ? pass('结果页统计词命中: ' + JSON.stringify(liveStatsText))
    : fail('结果页统计词未命中（统计卡片缺失或未渲染）')

  // AI 解读卡片降级：后端不可用时整卡隐藏、不留空白
  const aiCard = await page.$('.ai-insight-section')
  aiCard ? fail('AI 解读卡片应在不可用时隐藏') : pass('AI 解读卡片降级隐藏')

  // ── 5. 分享海报挂载（点击导出按钮，验证不报错且组件挂载） ──
  const exportBtn = await page.$('.hero-export-btn')
  if (exportBtn) {
    await exportBtn.click()
    await sleep(2500)
    const posterMounted = await page.$('.share-poster')
    posterMounted ? pass('海报组件按需挂载') : fail('海报组件未挂载')
    await page.screenshot({ path: 'scripts/e2e-poster-mounted.png' })
  } else {
    fail('导出按钮缺失')
  }

  // ── 6. 反馈表单（真实交互：选自评 MBTI + 置信度，提交到本地 API） ──
  // 此前只数元素个数就 pass：这里校验控件齐备、按钮禁用态流转、提交成功态
  const fbControls = await page.evaluate(() => ({
    dimBtns: document.querySelectorAll('.feedback-section .dim-btn').length,
    confidenceBtns: document.querySelectorAll('.feedback-section .confidence-btn').length,
    inputs: document.querySelectorAll('.feedback-section .feedback-input').length,
    submitBtns: document.querySelectorAll('.feedback-section .feedback-submit-btn').length,
    submitDisabled: document.querySelector('.feedback-section .feedback-submit-btn')?.disabled ?? null,
  }))
  fbControls.dimBtns >= 8 && fbControls.confidenceBtns === 5 && fbControls.inputs === 1 && fbControls.submitBtns === 1
    ? pass(`反馈表单控件齐备（dim=${fbControls.dimBtns} confidence=${fbControls.confidenceBtns} input=${fbControls.inputs}）`)
    : fail('反馈表单控件缺失', JSON.stringify(fbControls))
  fbControls.submitDisabled === true
    ? pass('反馈提交按钮初始为禁用态')
    : fail('反馈提交按钮初始态异常（应为禁用）', JSON.stringify(fbControls))

  // 依次点选 E / S / T / J（第 1/3/5/7 个 dim-btn）与置信度 4，按钮应解禁
  for (const idx of [0, 2, 4, 6]) {
    await page.evaluate((i) => {
      document.querySelectorAll('.feedback-section .dim-btn')[i]?.click()
    }, idx)
  }
  await page.evaluate(() => {
    document.querySelectorAll('.feedback-section .confidence-btn')[3]?.click()
  })
  await sleep(400)
  const submitEnabled = await page.evaluate(() => {
    const btn = document.querySelector('.feedback-section .feedback-submit-btn')
    return btn ? !btn.disabled : false
  })
  submitEnabled ? pass('反馈表单填写完整后提交按钮解禁') : fail('反馈表单填写后按钮仍禁用')

  await page.evaluate(() => document.querySelector('.feedback-section .feedback-submit-btn')?.click())
  const feedbackDone = await page.waitForSelector('.feedback-done', { timeout: 8000 }).then(() => true).catch(() => false)
  feedbackDone ? pass('反馈提交成功（本地 API 写入 200）') : fail('反馈提交后未出现成功态')

  // ── 7. 角色库 ──
  await page.goto(BASE + '/characters', { waitUntil: 'domcontentloaded' })
  await sleep(1200)
  const cards = await page.$$eval('.character-card', els => els.length).catch(() => 0)
  cards >= 110 ? pass(`角色库渲染 ${cards} 张卡片`) : fail('角色库卡片数', String(cards))

  // ── 8. 统计页 ──
  await page.goto(BASE + '/stats', { waitUntil: 'domcontentloaded' })
  await sleep(1500)
  const totalText = await text(page, '.overview-card .overview-value')
  totalText && totalText !== '0' ? pass('统计页总量: ' + totalText) : fail('统计页总量', totalText ?? '')
  const rankRows = await page.$$eval('.ranking-row', els => els.length).catch(() => 0)
  rankRows >= 10 ? pass(`统计页排行 ${rankRows} 行`) : fail('统计排行行数', String(rankRows))
  await page.screenshot({ path: 'scripts/e2e-stats.png' })

  // ── 9. 语言切换（切到英文后 hero/导航变化） ──
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await sleep(500)
  await page.click('.lang-dropdown-trigger')
  await sleep(400)
  const enBtn = await page.$$eval('.lang-option-btn', els => {
    const b = els.find(el => el.textContent.trim() === 'English')
    if (b) { b.click(); return true }
    return false
  })
  await sleep(800)
  const navText = await text(page, '.site-nav')
  enBtn && navText && /Characters|Stats|About/.test(navText) ? pass('语言切换为英文生效: ' + navText.slice(0, 40)) : fail('语言切换', navText ?? '')
  const seoTitle = await page.title()
  // 此前无条件 pass：这里真正校验标题已切换为英文（含英文字母且不含中文字符）
  const isEnglishTitle = /[A-Za-z]/.test(seoTitle) && !/[\u4e00-\u9fff]/.test(seoTitle)
  isEnglishTitle
    ? pass('英文 SEO 标题: ' + seoTitle)
    : fail('SEO 标题未切换为英文', seoTitle)

  // ── 10. 分享链接直达结果页（?character=） ──
  await page.goto(BASE + '/result?character=frieren', { waitUntil: 'domcontentloaded' })
  await sleep(1500)
  const previewName = await text(page, '.hero-title')
  previewName && previewName.length > 0 ? pass('角色预览直达: ' + previewName) : fail('角色预览', previewName ?? '')

  // ── 11. 404 路由回首页 ──
  await page.goto(BASE + '/not-exist-route', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(800)
  page.url().endsWith('/') || page.url().includes('/#') ? pass('未知路由重定向首页') : fail('未知路由', page.url())

  // ── 12. 移动端视口（375x812）核心冒烟 ──
  // 复用同一个 page：切换视口即可触发 <=768px 的移动端布局
  await page.setViewport({ width: 375, height: 812 })
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(800)
  const mobileTitle = await page.title()
  mobileTitle.includes('ACGTI') ? pass('移动端首页标题: ' + mobileTitle) : fail('移动端首页标题', mobileTitle)
  await page.screenshot({ path: 'scripts/e2e-mobile-home.png' })

  // 汉堡菜单：仅移动端显示，点击展开 .site-nav.is-open，再点收起
  const toggleVisible = await page.$eval('.mobile-nav-toggle', (el) => getComputedStyle(el).display !== 'none').catch(() => false)
  toggleVisible ? pass('移动端汉堡菜单按钮可见') : fail('移动端汉堡菜单按钮不可见')
  await page.evaluate(() => document.querySelector('.mobile-nav-toggle')?.click())
  await sleep(400)
  const navOpen = await page.$eval('.site-nav', (el) => el.classList.contains('is-open')).catch(() => false)
  navOpen ? pass('移动端导航菜单展开（is-open）') : fail('移动端导航菜单未展开')
  await page.evaluate(() => document.querySelector('.mobile-nav-toggle')?.click())
  await sleep(400)
  const navClosed = await page.$eval('.site-nav', (el) => !el.classList.contains('is-open')).catch(() => true)
  navClosed ? pass('移动端导航菜单可收起') : fail('移动端导航菜单二次点击未收起')

  // 移动端答题页：进入并选一题，验证触控布局下作答可用
  await page.goto(BASE + '/quiz', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('.question-block', { timeout: 15000 })
  await sleep(500)
  const mobileAnswered = await page.evaluate(() => {
    const btn = document.querySelector('.question-block .scale-btn')
    if (!btn) return false
    btn.click()
    return true
  })
  mobileAnswered ? pass('移动端答题页进入并点击选项') : fail('移动端答题页选项点击失败')
  await sleep(500)
  const mobileChecked = await page.$$eval('.question-block:nth-child(1) .scale-btn[aria-checked="true"]', (els) => els.length).catch(() => 0)
  mobileChecked === 1 ? pass('移动端选项选中态生效') : fail('移动端选项选中态异常', String(mobileChecked))
  const mobileProgress = await text(page, '.progress-hint')
  mobileProgress && mobileProgress.includes('1 / 39')
    ? pass('移动端进度提示: ' + mobileProgress)
    : fail('移动端进度提示异常', mobileProgress ?? '')
  await page.screenshot({ path: 'scripts/e2e-mobile-quiz.png' })

  // ── 汇总 ──
  const failed = results.filter(r => r[0] === 'FAIL')
  console.log('\n════════ E2E 结果 ════════')
  console.log(`通过 ${results.length - failed.length} / ${results.length}`)
  if (failed.length) {
    // fail() 里已逐项设置，这里再兜底一次，确保任何失败都不会以 0 退出
    process.exitCode = 1
    console.log('失败项:')
    failed.forEach(f => console.log(' -', f[1]))
  }
  const realErrors = consoleErrors.filter(e => !/favicon|net::ERR|Failed to load resource.*(adsbygoogle|adsbygoogle)/.test(e))
  console.log(`页面 console 错误（过滤广告后）: ${realErrors.length}`)
  realErrors.slice(0, 10).forEach(e => console.log('  [console]', e.slice(0, 200)))
} finally {
  // 浏览器启动失败（browser 为 null）时也要恢复 wrangler 配置与服务器
  if (browser) await browser.close().catch(() => {})
  cleanupServer()
}
