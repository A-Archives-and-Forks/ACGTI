// 用途：NODE_OPTIONS="--require <此文件绝对路径>" npx wrangler ...
//
// 背景（诊断结论，2026-08）：
// 本机网络对 *.workers.dev 存在两层封锁——
//   1) 系统 DNS 解析被随机投毒（workers.dev 系域名返回被墙站点的 IP，
//      每次不同：157.240.x / 108.160.x / 128.121.x 等）；
//   2) 即便解析到真实 Cloudflare IP，workers.dev 的 TLS 流量仍会被按
//      SNI 重置（ECONNRESET）。
// wrangler 的远程绑定（Workers AI 的远程代理 worker 部署在
// <随机hash>.<账号>.workers.dev）在 Node 侧有三类出站路径，且互相独立：
//   a) 内嵌 ws 库把直连版 createConnection（即 tls.connect(host)）塞进
//      https.request 的 options，绕过一切 Agent；
//   b) 各库自建 https.Agent 实例，走 Agent.prototype.createConnection；
//   c) undici fetch/WebSocket，走全局 dispatcher。
// 三条路径都不遵守 https_proxy 环境变量，本地 pages dev 一触发 AI 调用
// 就直连污染 IP 超时，并拖垮整个进程。
//
// 方案（仅当设置了代理环境变量时启用，对三条路径逐一接管）：
//   a) hook https.request/https.get：外网域名目标强制改写
//      options.createConnection 为 CONNECT 隧道实现（node 原生支持
//      createConnection(options, oncreate) 的 callback 契约）；
//   b) 覆盖 https.Agent.prototype.createConnection，Agent 路径同样建隧道；
//   c) undici 全局 dispatcher 指向 EnvHttpProxyAgent。
//   本地地址（127.0.0.1/localhost/字面 IP）一律回退原生直连；明文
//   http.Agent 不动（miniflare 内部大量 http://127.0.0.1 通信）。
const net = require('node:net')
const tls = require('node:tls')
const https = require('node:https')

const PROXY =
  process.env.https_proxy ||
  process.env.HTTPS_PROXY ||
  process.env.all_proxy ||
  process.env.ALL_PROXY

function parseProxy(proxy) {
  try {
    const url = new URL(proxy)
    return { host: url.hostname, port: Number(url.port) || 80 }
  } catch {
    return null
  }
}

const PROXY_ADDR = PROXY ? parseProxy(PROXY) : null

function shouldTunnel(host) {
  return (
    PROXY_ADDR &&
    typeof host === 'string' &&
    host !== 'localhost' &&
    host !== '127.0.0.1' &&
    host !== '::1' &&
    net.isIP(host) === 0
  )
}

function requestHostOf(options, urlArg) {
  if (urlArg) {
    try {
      return new URL(urlArg, 'http://x').hostname
    } catch {}
  }
  return options?.host || options?.hostname || ''
}

// CONNECT 隧道版 createConnection：签名符合 node 的 callback 契约，
// 返回 undefined 让调用方等待 oncreate(null, tlsSocket)。
function tunnelCreateConnection(options, oncreate) {
  const host = options.host || options.hostname
  const port = options.port || 443
  const socket = net.connect({ host: PROXY_ADDR.host, port: PROXY_ADDR.port })
  socket.once('connect', () => {
    socket.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n\r\n`)
    let header = ''
    const onData = (chunk) => {
      header += chunk.toString('latin1')
      if (!header.includes('\r\n\r\n')) return
      socket.off('data', onData)
      if (!/^HTTP\/1\.[01] 200/.test(header)) {
        socket.destroy()
        oncreate(new Error(`proxy CONNECT failed: ${header.split('\r\n')[0]}`))
        return
      }
      // 隧道就绪，在其上完成 TLS；servername 保持原域名以通过证书校验
      oncreate(null, tls.connect({
        ...options,
        socket,
        servername: options.servername || host,
      }))
    }
    socket.on('data', onData)
  })
  socket.once('error', (err) => {
    socket.destroy()
    oncreate(err)
  })
  return undefined
}

if (PROXY_ADDR) {
  // 路径 a：https.request / https.get 层改写 createConnection
  const origRequest = https.request
  const origGet = https.get
  https.request = function (...args) {
    const options = args.find((a) => typeof a === 'object' && a !== null && typeof a !== 'function')
    const urlArg = args.find((a) => typeof a === 'string')
    const host = requestHostOf(options, urlArg)
    if (options && shouldTunnel(host)) {
      options.createConnection = tunnelCreateConnection
    }
    return origRequest.apply(https, args)
  }
  https.get = function (...args) {
    const options = args.find((a) => typeof a === 'object' && a !== null && typeof a !== 'function')
    const urlArg = args.find((a) => typeof a === 'string')
    const host = requestHostOf(options, urlArg)
    if (options && shouldTunnel(host)) {
      options.createConnection = tunnelCreateConnection
    }
    return origGet.apply(https, args)
  }

  // 路径 b：Agent 原型层兜底（createConnection 未被 options 覆盖时）
  const origAgentCreate = https.Agent.prototype.createConnection
  https.Agent.prototype.createConnection = function (options, callback) {
    const host = options.host || options.hostname
    if (!shouldTunnel(host)) {
      return origAgentCreate.call(this, options, callback)
    }
    return tunnelCreateConnection(options, callback)
  }

  // 路径 c：undici 全局 dispatcher（fetch / WebSocket 类出站）
  try {
    const undici = require('undici')
    undici.setGlobalDispatcher(new undici.EnvHttpProxyAgent())
  } catch {}

  console.error(`[proxy-preload] https tunnel armed via ${PROXY}`)
}
