// 生成 public/og-image.png（1200x630 分享卡片）
// 用法：本地服务运行中执行 node scripts/generate-og-image.mjs
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:8788'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1200,630'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 })
  await page.waitForSelector('h1', { timeout: 10000 }).catch(() => {})
  await new Promise(r => setTimeout(r, 1500))
  await page.screenshot({ path: 'public/og-image.png', clip: { x: 0, y: 0, width: 1200, height: 630 } })
  console.log('og-image.png saved')
} finally {
  await browser.close()
}
