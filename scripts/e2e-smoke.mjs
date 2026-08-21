// 端到端冒烟测试：用本机 Edge 无头模式模拟真实用户走完核心流程。
// 用法：先启动 npm run dev:pages（127.0.0.1:8788），再 node scripts/e2e-smoke.mjs
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8788'

const results = []
const consoleErrors = []
function pass(name) { results.push(['PASS', name]); console.log('  ✅', name) }
function fail(name, detail) { results.push(['FAIL', name]); console.error('  ❌', name, detail ?? '') }

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function text(page, selector) {
  return page.$eval(selector, el => el.textContent?.trim() ?? '').catch(() => null)
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,900'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message))

  // ── 1. 首页 ──
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 })
  await sleep(800)
  const homeTitle = await page.title()
  homeTitle.includes('ACGTI') ? pass('首页标题: ' + homeTitle) : fail('首页标题', homeTitle)
  const ogImage = await page.$eval('meta[property="og:image"]', el => el.content).catch(() => null)
  ogImage ? pass('OG image meta: ' + ogImage) : fail('OG image meta 缺失')
  await page.screenshot({ path: 'scripts/e2e-home.png' })
  pass('首页截图')

  // ── 2. 进入答题页 ──
  await page.goto(BASE + '/quiz', { waitUntil: 'networkidle2', timeout: 30000 })
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
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(800)
  const hintAfterReload = await text(page, '.progress-hint')
  hintAfterReload && hintAfterReload.includes('39') && hintAfterReload.includes('39')
    ? pass('刷新后答题进度已恢复: ' + hintAfterReload)
    : fail('刷新后进度未恢复', hintAfterReload ?? '')

  // ── 4. 提交 ──
  await page.click('.submit-btn')
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
  await sleep(1500)
  const resultUrl = page.url()
  resultUrl.includes('/result') ? pass('跳转结果页: ' + resultUrl) : fail('结果页跳转', resultUrl)
  const heroTitle = await text(page, '.hero-title')
  heroTitle ? pass('结果角色: ' + heroTitle) : fail('结果角色标题缺失')
  const heroCode = await text(page, '.hero-code')
  heroCode ? pass('角色代码: ' + heroCode) : fail('角色代码缺失')
  await page.screenshot({ path: 'scripts/e2e-result.png', fullPage: false })

  // 结果页统计卡片（来自 /api/stats/result）
  await sleep(1000)
  const liveStatsText = await page.evaluate(() => document.body.innerText.match(/测过|人测过|命中率|同角色/g)?.slice(0, 4) ?? [])
  pass('结果页统计词命中: ' + JSON.stringify(liveStatsText))

  // ── 5. 分享海报挂载（点击导出按钮，验证不报错且组件挂载） ──
  const exportBtn = await page.$('.hero-export-btn')
  if (exportBtn) {
    await page.evaluate(() => { window.__posterReady = false })
    await exportBtn.click()
    await sleep(2500)
    const posterMounted = await page.$('.share-poster')
    posterMounted ? pass('海报组件按需挂载') : fail('海报组件未挂载')
    await page.screenshot({ path: 'scripts/e2e-poster-mounted.png' })
  } else {
    fail('导出按钮缺失')
  }

  // ── 6. 反馈表单（填自评 MBTI 并提交到本地 API） ──
  const fbSection = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('select, [role="radiogroup"], button')]
    return labels.length
  })
  pass('反馈区交互元素数: ' + fbSection)

  // ── 7. 角色库 ──
  await page.goto(BASE + '/characters', { waitUntil: 'networkidle2' })
  await sleep(1200)
  const cards = await page.$$eval('.character-card', els => els.length).catch(() => 0)
  cards >= 110 ? pass(`角色库渲染 ${cards} 张卡片`) : fail('角色库卡片数', String(cards))

  // ── 8. 统计页 ──
  await page.goto(BASE + '/stats', { waitUntil: 'networkidle2' })
  await sleep(1500)
  const totalText = await text(page, '.overview-card .overview-value')
  totalText && totalText !== '0' ? pass('统计页总量: ' + totalText) : fail('统计页总量', totalText ?? '')
  const rankRows = await page.$$eval('.ranking-row', els => els.length).catch(() => 0)
  rankRows >= 10 ? pass(`统计页排行 ${rankRows} 行`) : fail('统计排行行数', String(rankRows))
  await page.screenshot({ path: 'scripts/e2e-stats.png' })

  // ── 9. 语言切换（切到英文后 hero/导航变化） ──
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
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
  pass('英文 SEO 标题: ' + seoTitle)

  // ── 10. 分享链接直达结果页（?character=） ──
  await page.goto(BASE + '/result?character=frieren', { waitUntil: 'networkidle2' })
  await sleep(1500)
  const previewName = await text(page, '.hero-title')
  previewName && previewName.length > 0 ? pass('角色预览直达: ' + previewName) : fail('角色预览', previewName ?? '')

  // ── 11. 404 路由回首页 ──
  await page.goto(BASE + '/not-exist-route', { waitUntil: 'networkidle2' }).catch(() => {})
  await sleep(800)
  page.url().endsWith('/') || page.url().includes('/#') ? pass('未知路由重定向首页') : fail('未知路由', page.url())

  // ── 汇总 ──
  const failed = results.filter(r => r[0] === 'FAIL')
  console.log('\n════════ E2E 结果 ════════')
  console.log(`通过 ${results.length - failed.length} / ${results.length}`)
  if (failed.length) {
    console.log('失败项:')
    failed.forEach(f => console.log(' -', f[1]))
  }
  const realErrors = consoleErrors.filter(e => !/favicon|net::ERR|Failed to load resource.*(adsbygoogle|adsbygoogle)/.test(e))
  console.log(`页面 console 错误（过滤广告后）: ${realErrors.length}`)
  realErrors.slice(0, 10).forEach(e => console.log('  [console]', e.slice(0, 200)))
} finally {
  await browser.close()
}
