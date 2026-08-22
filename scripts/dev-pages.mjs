#!/usr/bin/env node
// 本地 AI 联调启动器：wrangler pages dev + Workers AI 的 REST 直连模式。
//
// 为什么需要它（诊断结论见 scripts/wrangler-proxy-preload.cjs 头注）：
// 本地 pages dev 的 AI binding 走 wrangler 远程代理会话（*.workers.dev），
// 在受限网络下既有 DNS 投毒又有 SNI 阻断，远程绑定 RPC 会 internal error。
// 本脚本：
//   1. 临时剥离 wrangler.jsonc 的 ai binding（结束后自动恢复），
//      /api/insight 由此走 REST 回退（functions/api/insight.ts 的 runModel）；
//   2. 复用 wrangler 本地 OAuth 凭据作为 REST token（账号 ID 从 whoami 解析），
//      无需手动申请 API token；
//   3. 注入代理预加载（若设置了代理环境变量），修复 Node 侧出站连接。
//
// 用法：先 npm run build，再 node scripts/dev-pages.mjs（或 npm run dev:pages）。
import { execSync, spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const WRANGLER_CONFIG = 'wrangler.jsonc'
const DEV_VARS = '.dev.vars'
const originalConfig = readFileSync(WRANGLER_CONFIG, 'utf-8')
// .dev.vars 已被 .gitignore 忽略且本机存在；追加段用标记围起来便于还原
const DEV_VARS_MARK = '# --- acgti-ai-rest (auto, will be removed) ---'

function readWranglerToken() {
  // wrangler 的配置目录遵循 XDG：优先 AppData/Roaming/xdg.config（本项目实测）
  const candidates = [
    join(process.env.APPDATA ?? '', 'xdg.config', '.wrangler', 'config', 'default.toml'),
    join(homedir(), '.wrangler', 'config', 'default.toml'),
    join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), '.wrangler', 'config', 'default.toml'),
  ]
  for (const p of candidates) {
    try {
      const token = readFileSync(p, 'utf-8').match(/oauth_token\s*=\s*"([^"]+)"/)?.[1]
      if (token) return token
    } catch {}
  }
  return null
}

function resolveAccountId() {
  try {
    const out = execSync('npx wrangler whoami', { encoding: 'utf-8', timeout: 60000, windowsHide: true })
    return out.match(/\b[0-9a-f]{32}\b/g)?.[0] ?? null
  } catch {
    return null
  }
}

function killTree(pid) {
  try {
    execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
  } catch {}
}

let child = null
let configStripped = false

function cleanup() {
  if (configStripped) {
    writeFileSync(WRANGLER_CONFIG, originalConfig, 'utf-8')
    configStripped = false
  }
  if (child?.pid) killTree(child.pid)
}

function startPagesDev(extraEnv) {
  child = spawn('npx', ['wrangler', 'pages', 'dev', 'dist', '--port', '8788'], {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  })
  process.on('SIGINT', () => { cleanup(); process.exit(130) })
  process.on('SIGTERM', () => { cleanup(); process.exit(143) })
  child.on('exit', (code) => { cleanup(); process.exit(code ?? 0) })
}

const token = readWranglerToken()
const accountId = token ? resolveAccountId() : null

if (token && accountId) {
  const stripped = originalConfig.replace(/,?\s*\/\/[^\n]*\n\s*"ai":\s*\{[^}]*\}/, '')
  writeFileSync(WRANGLER_CONFIG, stripped, 'utf-8')
  configStripped = true

  const preload = join(process.cwd(), 'scripts', 'wrangler-proxy-preload.cjs').replace(/\\/g, '/')
  // pages dev 的变量只认 .dev.vars（忽略进程环境注入），追加临时凭据段，
  // cleanup 时按标记移除
  try {
    const current = readFileSync(DEV_VARS, 'utf-8')
    if (!current.includes(DEV_VARS_MARK)) {
      const extra = `${DEV_VARS_MARK}\nACGTI_AI_TOKEN=${token}\nACGTI_AI_ACCOUNT_ID=${accountId}\n`
      writeFileSync(DEV_VARS, current.replace(/\n*$/, '\n') + extra, 'utf-8')
      devVarsTouched = true
    }
  } catch {
    console.warn('无法写入 .dev.vars，AI REST 模式可能不生效')
  }
  console.log(`AI 本地联调模式：REST 直连（账号 ${accountId.slice(0, 8)}…），已临时剥离 ai binding`)
  startPagesDev({
    NODE_OPTIONS: `--require "${preload}"`,
  })
} else {
  console.warn('未取得 wrangler 凭据或账号 ID（需 npx wrangler login），以普通模式启动')
  startPagesDev({})
}
