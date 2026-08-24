#!/usr/bin/env node
// 本地 AI 联调启动器：wrangler pages dev + 网关/REST 直连模式。
//
// 为什么需要它（诊断结论见 scripts/wrangler-proxy-preload.cjs 头注）：
// 本地 pages dev 的 AI binding 走 wrangler 远程代理会话（*.workers.dev），
// 在受限网络下既有 DNS 投毒又有 SNI 阻断，远程绑定 RPC 会 internal error。
// 本脚本：
//   1. 临时剥离 wrangler.jsonc 的 ai binding，退出时还原；
//      /api/insight 由此走网关或 REST 回退（functions/api/insight.ts 的 runModel）。
//      注：wrangler pages dev 不支持 --config 自定义配置路径（实测 4.83 报错），
//      只能原地改写，配套两层防护：
//        - 崩溃自愈：剥离前备份原文到 .wrangler（gitignored），强杀/崩溃后
//          下次启动检测到备份即先还原，避免在脏配置上二次剥离；
//        - 运行期守护：同步软件等外部程序可能把运行中的 wrangler.jsonc
//          还原成原文，触发 wrangler 热重载（窗口内请求 503）。定时校验、
//          被还原成启动时原文就立即重新剥离，把影响压到一次重载；
//   2. 复用 wrangler 本地 OAuth 凭据作为 REST token（账号 ID 从 whoami 解析），
//      无需手动申请 API token；
//   3. 注入代理预加载（若设置了代理环境变量），修复 Node 侧出站连接。
//
// 用法：先 npm run build，再 node scripts/dev-pages.mjs（或 npm run dev:pages）。
import { execSync, spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const WRANGLER_CONFIG = 'wrangler.jsonc'
const DEV_VARS = '.dev.vars'
const CONFIG_BACKUP = join('.wrangler', 'dev-pages-wrangler.jsonc.orig')
// .dev.vars 追加段用标记围起来便于还原
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

// 异常退出后 wrangler 可能残留并占用 8788，挡住本次启动；
// 从 netstat 找出监听进程整树清理（仅在确认有残留时调用）
function freePort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
      encoding: 'utf-8',
      windowsHide: true,
    })
    const pids = [
      ...new Set(
        out
          .split('\n')
          .map((line) => line.trim().split(/\s+/).pop())
          .filter((p) => /^\d+$/.test(p)),
      ),
    ]
    for (const pid of pids) killTree(pid)
    if (pids.length) console.warn(`已清理端口 ${port} 的残留进程：${pids.join(', ')}`)
  } catch {}
}

let child = null
let configStripped = false
let devVarsTouched = false
let guard = null

function cleanup() {
  if (guard) clearInterval(guard)
  if (configStripped) {
    try {
      writeFileSync(WRANGLER_CONFIG, originalConfig, 'utf-8')
      rmSync(CONFIG_BACKUP, { force: true })
    } catch {}
    configStripped = false
  }
  if (devVarsTouched) {
    // 标记及其后内容都是本脚本追加的凭据段，整体移除
    try {
      const current = readFileSync(DEV_VARS, 'utf-8')
      if (current.includes(DEV_VARS_MARK)) {
        writeFileSync(DEV_VARS, current.slice(0, current.indexOf(DEV_VARS_MARK)).replace(/\n*$/, '\n'), 'utf-8')
      }
    } catch {}
    devVarsTouched = false
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

  // 运行期守护：只在内容精确等于启动时原文时才重剥离（外部还原的典型特征），
  // 不覆盖运行中的其他手动编辑
  guard = setInterval(() => {
    try {
      if (readFileSync(WRANGLER_CONFIG, 'utf-8') === originalConfig) {
        console.warn('\n[dev-pages] wrangler.jsonc 被外部还原，已重新剥离 ai binding')
        writeFileSync(WRANGLER_CONFIG, strippedConfig, 'utf-8')
      }
    } catch {}
  }, 2000)
  guard.unref?.()
}

const token = readWranglerToken()
// 已手动配置完整网关通道（KEY + BASE_URL + MODEL 三项齐备，与 insight.ts 的
// 启用条件保持一致）时优先走网关模型，无需注入 wrangler 凭据；
// 只配了残缺的 KEY 时不再剥离 ai binding，仍可走 REST 回退联调
let gatewayConfigured = false
try {
  const devVars = readFileSync(DEV_VARS, 'utf-8')
  gatewayConfigured = ['AIGW', 'AIGW2'].some((prefix) =>
    ['API_KEY', 'BASE_URL', 'MODEL'].every((suffix) =>
      new RegExp(`^${prefix}_${suffix}\\s*=\\s*\\S`, 'm').test(devVars),
    ),
  )
} catch {}
const accountId = token && !gatewayConfigured ? resolveAccountId() : null

// 上次异常退出（强杀/崩溃）的残留：先按备份还原配置并释放端口，
// 避免在已剥离的配置上二次剥离、或被残留 wrangler 挡住端口
try {
  const backup = readFileSync(CONFIG_BACKUP, 'utf-8')
  writeFileSync(WRANGLER_CONFIG, backup, 'utf-8')
  console.warn('检测到上次 dev:pages 异常退出的残留，已恢复 wrangler.jsonc')
  freePort(8788)
} catch {}

// 无论走网关还是 REST：本地远程绑定在受限网络下必崩，一律剥离 ai binding。
// 原文必须在还原之后读取（残留场景下启动时的文件是脏的）
const originalConfig = readFileSync(WRANGLER_CONFIG, 'utf-8')
const strippedConfig = originalConfig.replace(/,?\s*\/\/[^\n]*\n\s*"ai":\s*\{[^}]*\}/, '')
mkdirSync('.wrangler', { recursive: true })
writeFileSync(CONFIG_BACKUP, originalConfig, 'utf-8')
writeFileSync(WRANGLER_CONFIG, strippedConfig, 'utf-8')
configStripped = true

const preload = join(process.cwd(), 'scripts', 'wrangler-proxy-preload.cjs').replace(/\\/g, '/')

if (gatewayConfigured) {
  console.log('AI 本地联调模式：网关直连（.dev.vars 已配置 AIGW_API_KEY），已临时剥离 ai binding')
  startPagesDev({ NODE_OPTIONS: `--require "${preload}"` })
} else if (token && accountId) {
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
  startPagesDev({ NODE_OPTIONS: `--require "${preload}"` })
} else {
  console.warn('未取得网关配置或 wrangler 凭据（npx wrangler login），AI 解读将走降级隐藏')
  startPagesDev({ NODE_OPTIONS: `--require "${preload}"` })
}
