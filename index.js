/**
 * Phone remote — a LAN gateway for the DSH Web GUI.
 *
 * The desktop DSH Web server listens on loopback only and requires a per-process
 * launch token. This plugin starts a small HTTP server on the local network,
 * asks the visitor for a PIN, mints a DSH browser session for them through
 * `connection.authenticatedUrl()`, and then transparently proxies the normal
 * DSH Web shell (including its WebSocket RPC channel) to that visitor.
 *
 * It is intentionally loopback-only on the upstream side: the upstream Host and
 * Origin are always rewritten to the real loopback origin, so DSH's browser
 * trust fence keeps working while the phone talks to this gateway.
 */
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import os from 'node:os'
import crypto from 'node:crypto'
import { promises as fs, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { renderErrorPage, renderLoginPage } from './login-page.js'
import { ensureTls } from './tls.js'
import { createPushService } from './push.js'

export const name = 'phone-remote'
export const inject = ['webServer', 'connection']

const STATE_VERSION = 1
const COOKIE_NAME = 'dsh_phone_remote'
const COOKIE_DAYS = 30
const LOGIN_WINDOW_MS = 10 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 8
const MAX_BODY_BYTES = 4096
const PUSH_BODY_LIMIT = 24_000
const PUSH_GRACE_MS = 1200
const CLOSING_SCAN = 8
const APP_TITLE = 'DeepSeek Harness'
/** Served verbatim on every gateway listener; the browser only registers it on HTTPS. */
const SW_SOURCE = readFileSync(new URL('./sw.js', import.meta.url), 'utf8')
/** Notification artwork; served before the access check. */
const ICON_192 = readFileSync(new URL('./icon-192.png', import.meta.url))
const ICON_512 = readFileSync(new URL('./icon-512.png', import.meta.url))
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function dshHome() {
  return process.env.DSH_HOME || join(os.homedir(), '.dsh')
}

function stateFile() {
  return join(dshHome(), 'phone-remote.json')
}

function newPin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

function newSecret() {
  return crypto.randomBytes(32).toString('hex')
}

async function readState() {
  try {
    const raw = await fs.readFile(stateFile(), 'utf8')
    const parsed = JSON.parse(raw)
    if (typeof parsed?.pin !== 'string' || !/^\d{6}$/.test(parsed.pin)) throw new Error('bad pin')
    if (typeof parsed?.secret !== 'string' || parsed.secret.length < 32) throw new Error('bad secret')
    return { pin: parsed.pin, secret: parsed.secret, createdAt: Number(parsed.createdAt) || Date.now() }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      // A corrupt state file is replaced rather than breaking the plugin.
    }
    const state = { pin: newPin(), secret: newSecret(), createdAt: Date.now() }
    await writeState(state)
    return state
  }
}

async function writeState(state) {
  const file = stateFile()
  await fs.mkdir(dirname(file), { recursive: true })
  const body = JSON.stringify({ version: STATE_VERSION, ...state }, null, 2) + '\n'
  const temporary = `${file}.${process.pid}.tmp`
  await fs.writeFile(temporary, body, { mode: 0o600 })
  await fs.rename(temporary, file)
  try {
    await fs.chmod(file, 0o600)
  } catch {
    // Non-POSIX filesystems may not support chmod; the write above still happened.
  }
}

function safeEqualString(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function sign(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

function makeAccessCookie(secret, secure = false) {
  const expires = Date.now() + COOKIE_DAYS * 24 * 60 * 60 * 1000
  const payload = `v1.${expires}`
  return `${COOKIE_NAME}=${payload}.${sign(secret, payload)}; Path=/; HttpOnly; SameSite=Lax;${secure ? ' Secure;' : ''} Max-Age=${COOKIE_DAYS * 24 * 60 * 60}`
}

function parseCookies(header) {
  const result = Object.create(null)
  if (typeof header !== 'string') return result
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    const key = part.slice(0, index).trim()
    if (key === '') continue
    result[key] = part.slice(index + 1).trim()
  }
  return result
}

function accessCookieValid(secret, header) {
  const value = parseCookies(header)[COOKIE_NAME]
  if (typeof value !== 'string') return false
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return false
  const payload = value.slice(0, dot)
  if (!payload.startsWith('v1.')) return false
  const expires = Number(payload.slice(3))
  if (!Number.isFinite(expires) || expires <= Date.now()) return false
  return safeEqualString(value.slice(dot + 1), sign(secret, payload))
}

function loginPage(options = {}) {
  return renderLoginPage(options)
}

function errorPage(title, detail, status) {
  return renderErrorPage(title, detail, status)
}

function lanAddresses() {
  const found = []
  const interfaces = os.networkInterfaces()
  for (const [name, list] of Object.entries(interfaces)) {
    for (const entry of list ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue
      if (found.some((item) => item.address === entry.address)) continue
      found.push({ name, address: entry.address })
    }
  }
  const rank = (name) => {
    if (name === 'en0') return 0
    if (name === 'en1') return 1
    if (name.startsWith('en')) return 2
    if (name.startsWith('utun') || name.startsWith('tun') || name.startsWith('tap')) return 9
    return 5
  }
  return found.sort((a, b) => rank(a.name) - rank(b.name))
}

function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function createLimiter() {
  const attempts = new Map()
  return {
    allow(ip) {
      const now = Date.now()
      if (attempts.size > 256) {
        for (const [key, record] of attempts) {
          if (record.resetAt <= now) attempts.delete(key)
        }
        if (attempts.size > 2048) attempts.clear()
      }
      const record = attempts.get(ip)
      if (record === undefined || record.resetAt <= now) {
        attempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
        return true
      }
      if (record.count >= LOGIN_MAX_ATTEMPTS) return false
      record.count += 1
      return true
    },
    reset(ip) {
      attempts.delete(ip)
    },
  }
}

/**
 * Collapse text to one line and cap it.
 * @param {unknown} value - candidate text.
 * @param {number} limit - maximum characters.
 * @returns the normalized text, or an empty string.
 */
function compact(value, limit) {
  if (typeof value !== 'string') return ''
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= limit) return text
  return `${text.slice(0, Math.max(1, limit - 1)).trimEnd()}…`
}

/** Whether one Session belongs to a subagent run rather than the user's own work. */
function isSubagent(session) {
  return session?.header?.origin === 'subagent'
}

/** Compose a short label for one Session. */
function sessionLabel(ctx, session) {
  try {
    const title = ctx.get('sessionTitle')?.get(session)?.title
    if (typeof title === 'string' && title.trim() !== '') return compact(title, 80)
  } catch {
    // Title folding is optional; the folder below is always available.
  }
  const cwd = session?.header?.cwd
  if (typeof cwd === 'string' && cwd !== '') return basename(cwd)
  return APP_TITLE
}

/** Recover the text of the answer that closed the turn. */
function closingAnswer(session, endSeq) {
  try {
    for (let seq = endSeq - 1; seq > 0 && seq > endSeq - CLOSING_SCAN; seq -= 1) {
      const previous = session.eventAt(seq)
      if (previous === undefined) continue
      if (previous.type === 'assistant/message') {
        const content = previous.data?.message?.content
        if (!Array.isArray(content)) return undefined
        const text = content
          .filter(block => block?.type === 'text' && typeof block.text === 'string')
          .map(block => block.text)
          .join(' ')
        const answer = compact(text, 160)
        return answer === '' ? undefined : answer
      }
      if (previous.type === 'tool/result' || previous.type === 'user/message') return undefined
    }
  } catch {
    // A projection miss only costs the preview text.
  }
  return undefined
}

/** Complete one JSON response. */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/** Read one JSON request body with a byte limit. */
async function readJson(req, limit) {
  const text = await readBody(req, limit)
  if (text.trim() === '') return {}
  return JSON.parse(text)
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ port?: number }} config
 */
export function apply(ctx, config) {
  const configuredPort = Number.isInteger(config?.port) && config.port >= 0 && config.port <= 65535 ? config.port : 17890
  const configuredHttpsPort = Number.isInteger(config?.httpsPort) && config.httpsPort >= 0 && config.httpsPort <= 65535
    ? config.httpsPort
    : 17891
  const targetOrigin = ctx.webServer.getOrigin()
  const target = new URL(targetOrigin)
  const targetAuthority = target.host
  const targetHost = target.hostname.replace(/^\[|\]$/g, '')
  const targetPort = Number(target.port || 80)
  const machineName = os.hostname()

  let state
  const statePromise = readState().then((loaded) => {
    state = loaded
    return loaded
  }).catch((error) => {
    console.error('[phone-remote] state:', error)
    state = { pin: newPin(), secret: newSecret(), createdAt: Date.now() }
    return state
  })

  let pushService = null
  let pushError = null
  const pushPromise = (async () => {
    try {
      const webpush = await import('web-push')
      pushService = await createPushService({ home: dshHome(), webpush })
    } catch (error) {
      pushError = error instanceof Error ? error.message : String(error)
      console.error('[phone-remote] push:', error)
    }
  })()

  const limiter = createLimiter()
  const sockets = new Set()
  let httpServer = null
  let httpsServer = null
  let actualPort = null
  let actualHttpsPort = null
  let httpError = null
  let httpsError = null
  let tls = null
  let tlsError = null
  let disposed = false

  const addresses = () => lanAddresses()

  function status() {
    const port = actualPort ?? configuredPort
    const securePort = actualHttpsPort ?? configuredHttpsPort
    const list = addresses().map((entry) => `http://${entry.address}:${port}`)
    const secureList = addresses().map((entry) => `https://${entry.address}:${securePort}`)
    const hostName = os.hostname()
    if (hostName.endsWith('.local')) {
      const byName = `http://${hostName}:${port}`
      if (!list.includes(byName)) list.push(byName)
      const byNameSecure = `https://${hostName}:${securePort}`
      if (!secureList.includes(byNameSecure)) secureList.push(byNameSecure)
    }
    const primaryHttp = list[0] ?? `http://127.0.0.1:${port}`
    const primaryHttps = secureList[0] ?? `https://127.0.0.1:${securePort}`
    return {
      running: httpServer?.listening === true || httpsServer?.listening === true,
      port,
      httpsPort: securePort,
      httpsReady: tls !== null,
      httpsRunning: httpsServer?.listening === true,
      httpsError: tlsError ?? httpsError,
      url: primaryHttp,
      urls: list,
      httpsUrl: primaryHttps,
      httpsUrls: secureList,
      caProfileUrl: `${primaryHttp}/_phone/ca.mobileconfig`,
      caCertUrl: `${primaryHttp}/_phone/ca.crt`,
      pin: state?.pin ?? '',
      error: httpError,
      target: targetOrigin,
      hostName,
      pushSubscriptions: pushService?.count ?? 0,
      vapidPublicKey: pushService?.publicKey ?? null,
      pushError,
    }
  }

  async function exchangeDshAuth() {
    const authenticated = ctx.connection.authenticatedUrl(targetOrigin + '/')
    const url = new URL(authenticated)
    return await new Promise((resolve, reject) => {
      const request = http.get({
        host: url.hostname.replace(/^\[|\]$/g, ''),
        port: Number(url.port || 80),
        path: url.pathname + url.search,
        headers: { host: targetAuthority, accept: 'text/html' },
      }, (response) => {
        const cookies = response.headers['set-cookie'] ?? []
        response.resume()
        if (cookies.length === 0) {
          reject(new Error(`DSH 主程序返回 ${response.statusCode}，但没有签发登录凭证`))
          return
        }
        resolve(cookies.map((cookie) => cookie
          .replace(/;\s*secure\b/gi, '')
          .replace(/;\s*domain=[^;]*/gi, '')))
      })
      request.on('error', reject)
      request.setTimeout(5000, () => request.destroy(new Error('连接 DSH 主程序超时')))
    })
  }

  function schemeOf(req) {
    return req.socket.encrypted === true ? 'https' : 'http'
  }

  function forwardedHeaders(req, scheme) {
    const headers = { ...req.headers }
    for (const key of HOP_BY_HOP) delete headers[key]
    headers.host = targetAuthority
    if (headers.origin !== undefined) headers.origin = targetOrigin
    if (typeof headers.referer === 'string' && headers.referer.startsWith('http')) {
      try {
        const referer = new URL(headers.referer)
        if (referer.host !== targetAuthority) headers.referer = targetOrigin + referer.pathname + referer.search
      } catch {
        delete headers.referer
      }
    }
    headers['x-forwarded-host'] = req.headers.host ?? ''
    headers['x-forwarded-proto'] = scheme
    const remote = req.socket.remoteAddress ?? ''
    headers['x-forwarded-for'] = headers['x-forwarded-for'] === undefined
      ? remote
      : `${headers['x-forwarded-for']}, ${remote}`
    return headers
  }

  function rewriteLocation(value, requestOrigin) {
    if (typeof value !== 'string') return value
    if (value.startsWith(targetOrigin)) return requestOrigin + value.slice(targetOrigin.length)
    return value
  }

  function clearCookie(scheme) {
    return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${scheme === 'https' ? '; Secure' : ''}`
  }

  function proxy(req, res) {
    const scheme = schemeOf(req)
    const requestOrigin = `${scheme}://${req.headers.host ?? `127.0.0.1:${actualPort}`}`
    const upstream = http.request({
      host: targetHost,
      port: targetPort,
      method: req.method,
      path: req.url,
      headers: forwardedHeaders(req, scheme),
    }, (response) => {
      if (response.statusCode === 401
        && (req.method === 'GET' || req.method === 'HEAD')
        && String(req.headers.accept ?? '').includes('text/html')) {
        response.resume()
        res.writeHead(303, {
          location: '/',
          'cache-control': 'no-store',
          'set-cookie': clearCookie(scheme),
        })
        res.end()
        return
      }
      const headers = { ...response.headers }
      for (const key of HOP_BY_HOP) delete headers[key]
      if (headers.location !== undefined) headers.location = rewriteLocation(headers.location, requestOrigin)
      if (headers['set-cookie'] !== undefined) headers['set-cookie'] = headers['set-cookie'].map((cookie) => cookie
        .replace(/;\s*secure\b/gi, '')
        .replace(/;\s*domain=[^;]*/gi, ''))
      res.writeHead(response.statusCode ?? 502, headers)
      response.pipe(res)
    })
    upstream.on('error', (error) => {
      console.error('[phone-remote] upstream:', error.message)
      if (!res.headersSent) {
        const page = errorPage('无法连接 DSH', '电脑上的 DSH 主程序没有响应。请确认 DSH 仍在运行。', 502)
        res.writeHead(page.status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(page.body)
      } else {
        res.destroy()
      }
    })
    req.pipe(upstream)
  }

  function serveInline(res, status, type, body, extra = {}) {
    res.writeHead(status, {
      'content-type': type,
      'cache-control': 'no-store',
      ...extra,
    })
    res.end(body)
  }

  async function handle(req, res) {
    await statePromise
    const url = new URL(req.url ?? '/', 'http://localhost')
    const pathname = url.pathname
    const scheme = schemeOf(req)

    if (pathname === '/sw.js') {
      serveInline(res, 200, 'application/javascript; charset=utf-8', SW_SOURCE, {
        'service-worker-allowed': '/',
        'cache-control': 'no-cache',
      })
      return
    }
    if (pathname === '/_phone/icon-192.png') {
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' })
      res.end(ICON_192)
      return
    }
    if (pathname === '/_phone/icon-512.png') {
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' })
      res.end(ICON_512)
      return
    }
    if (pathname === '/_phone/ca.mobileconfig') {
      if (tls === null) {
        serveInline(res, 503, 'text/plain; charset=utf-8', 'certificate not ready; reload in a moment')
        return
      }
      res.writeHead(200, {
        'content-type': 'application/x-apple-aspen-config',
        'content-disposition': 'attachment; filename="DSH-Phone-Remote-CA.mobileconfig"',
        'cache-control': 'no-store',
      })
      res.end(tls.caProfileXml)
      return
    }
    if (pathname === '/_phone/ca.crt') {
      if (tls === null) {
        serveInline(res, 503, 'text/plain; charset=utf-8', 'certificate not ready; reload in a moment')
        return
      }
      serveInline(res, 200, 'application/x-x509-ca-cert', tls.caCertPem)
      return
    }

    if (pathname === '/_phone/login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress ?? 'unknown'
      if (!limiter.allow(ip)) {
        const page = errorPage('尝试次数过多', '请等待十分钟后再试。', 429)
        res.writeHead(page.status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(page.body)
        return
      }
      let form
      try {
        form = new URLSearchParams(await readBody(req))
      } catch {
        res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('bad request')
        return
      }
      const submitted = (form.get('pin') ?? '').replace(/\s+/g, '')
      if (!safeEqualString(submitted, state.pin)) {
        res.writeHead(401, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(loginPage({ error: '访问码不正确，请再试一次。', pin: submitted }))
        return
      }
      let upstreamCookies
      try {
        upstreamCookies = await exchangeDshAuth()
      } catch (error) {
        console.error('[phone-remote] auth exchange:', error)
        res.writeHead(502, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(loginPage({ error: '无法为这台手机建立 DSH 会话。请确认电脑上的 DSH 开着，然后重试。' }))
        return
      }
      limiter.reset(ip)
      res.writeHead(303, {
        location: '/',
        'cache-control': 'no-store',
        'set-cookie': [makeAccessCookie(state.secret, scheme === 'https'), ...upstreamCookies],
      })
      res.end()
      return
    }

    if (accessCookieValid(state.secret, req.headers.cookie)) {
      proxy(req, res)
      return
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      if (req.method === 'HEAD') res.end()
      else res.end(loginPage())
      return
    }

    res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    res.end('DSH phone remote: authentication required')
  }

  function upgrade(req, socket, head) {
    if (!accessCookieValid(state?.secret ?? '', req.headers.cookie)) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
      return
    }
    const upstream = net.connect(targetPort, targetHost, () => {
      const lines = [`GET ${req.url ?? '/'} HTTP/1.1`]
      const raw = req.rawHeaders
      for (let index = 0; index + 1 < raw.length; index += 2) {
        const key = raw[index]
        let value = raw[index + 1]
        const lower = key.toLowerCase()
        if (lower === 'host') value = targetAuthority
        else if (lower === 'origin') value = targetOrigin
        else if (lower === 'referer' && value.startsWith('http')) {
          try {
            const referer = new URL(value)
            if (referer.host !== targetAuthority) value = targetOrigin + referer.pathname + referer.search
          } catch {
            value = targetOrigin
          }
        }
        lines.push(`${key}: ${value}`)
      }
      upstream.write(lines.join('\r\n') + '\r\n\r\n')
      if (head?.length) upstream.write(head)
      socket.pipe(upstream)
      upstream.pipe(socket)
      sockets.add(upstream)
      upstream.on('close', () => sockets.delete(upstream))
    })
    upstream.on('error', () => socket.destroy())
    socket.on('error', () => upstream.destroy())
  }

  function attach(server, kind) {
    server.on('connection', (socket) => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
    })
    server.on('upgrade', upgrade)
    server.on('error', (error) => {
      if (kind === 'https') httpsError = error.message
      else httpError = error.message
      console.error(`[phone-remote] ${kind} listen:`, error)
    })
    server.on('listening', () => {
      const address = server.address()
      if (address !== null && typeof address === 'object') {
        if (kind === 'https') actualHttpsPort = address.port
        else actualPort = address.port
      }
      const port = kind === 'https' ? actualHttpsPort : actualPort
      console.log(`[phone-remote] ${kind} listening on 0.0.0.0:${port ?? ''} -> ${targetOrigin}`)
    })
  }

  const handler = (req, res) => {
    handle(req, res).catch((error) => {
      console.error('[phone-remote] request:', error)
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('internal error')
      } else {
        res.destroy()
      }
    })
  }

  httpServer = http.createServer(handler)
  attach(httpServer, 'http')
  httpServer.listen(configuredPort, '0.0.0.0')

  void (async () => {
    try {
      tls = await ensureTls({
        home: dshHome(),
        hostName: machineName,
        addresses: addresses().map((entry) => entry.address),
      })
      if (disposed) return
      httpsServer = https.createServer({ key: tls.key, cert: tls.cert }, handler)
      attach(httpsServer, 'https')
      httpsServer.listen(configuredHttpsPort, '0.0.0.0')
    } catch (error) {
      tlsError = error instanceof Error ? error.message : String(error)
      console.error('[phone-remote] tls:', error)
    }
  })()

  function sendPush(payload) {
    if (disposed) return
    void pushPromise.then(() => {
      if (disposed || pushService === null) return
      return pushService.send(payload).catch((error) => console.error('[phone-remote] push send:', error))
    })
  }

  function notifyIfPending(describe, pending) {
    let settled = false
    void Promise.resolve(pending).then(() => { settled = true }, () => { settled = true })
    const timer = setTimeout(() => {
      if (settled || disposed) return
      const payload = describe()
      if (payload !== undefined) sendPush(payload)
    }, PUSH_GRACE_MS)
    timer.unref?.()
  }

  function sessionUrl(session) {
    return session?.id === undefined
      ? '/'
      : `/?phoneRemoteSession=${encodeURIComponent(session.id)}`
  }

  ctx.on('session/event', (session, event) => {
    if (event?.type !== 'turn/end') return
    const kind = event.data?.reason?.kind
    if (kind !== 'completed' && kind !== 'max-tokens' && kind !== 'error') return
    if (isSubagent(session)) return
    const answer = kind === 'completed' ? closingAnswer(session, event.seq) : undefined
    const body = kind === 'completed'
      ? (answer === undefined ? '这一轮已完成，可以查看结果。' : `任务完成：${answer}`)
      : kind === 'max-tokens'
        ? '输出达到上限，可以让它继续。'
        : '这一轮出错，请打开会话查看。'
    sendPush({
      title: sessionLabel(ctx, session),
      body,
      url: sessionUrl(session),
      tag: session?.id ?? 'dsh-phone-remote-task',
    })
  })

  ctx.on('user-questions/request', (request, next) => {
    const pending = next()
    notifyIfPending(() => {
      const question = Array.isArray(request?.questions) ? request.questions[0] : undefined
      if (question === undefined) return undefined
      const session = request?.agent?.id === undefined ? undefined : ctx.get('sessions')?.get(request.agent.id)
      const text = compact([question.header, question.question]
        .filter((part) => typeof part === 'string' && part !== '')
        .join('：'), 160)
      return {
        title: session === undefined ? APP_TITLE : sessionLabel(ctx, session),
        body: `需要你的回答：${text === '' ? 'Agent 正在等待你的回答。' : text}`,
        url: sessionUrl(session),
        tag: session?.id ?? 'dsh-phone-remote-question',
      }
    }, pending)
    return pending
  })

  ctx.on('approval/request', (request, next) => {
    const pending = next()
    notifyIfPending(() => {
      const session = request?.agent?.id === undefined ? undefined : ctx.get('sessions')?.get(request.agent.id)
      const reason = compact(request?.displayReason?.zh ?? request?.displayReason?.en ?? request?.reason, 160)
      const tool = typeof request?.toolName === 'string' ? request.toolName : ''
      return {
        title: session === undefined ? APP_TITLE : sessionLabel(ctx, session),
        body: `需要你的授权：${reason === '' ? `工具 ${tool || '调用'} 正在等待你的批准。` : `${tool === '' ? '' : `${tool}：`}${reason}`}`,
        url: sessionUrl(session),
        tag: session?.id ?? 'dsh-phone-remote-approval',
      }
    }, pending)
    return pending
  })

  ctx.effect(() => {
    const disposeStatus = ctx.webServer.register({
      kind: 'exact',
      path: '/phone-remote/status',
      handler: async (req, res) => {
        await statePromise
        await pushPromise
        if (req.method !== 'GET') {
          res.writeHead(405, { allow: 'GET' })
          res.end()
          return
        }
        const rejection = ctx.connection.requestRejection(req)
        if (rejection !== undefined) {
          res.writeHead(rejection)
          res.end()
          return
        }
        sendJson(res, 200, status())
      },
    })
    const disposeRotate = ctx.webServer.register({
      kind: 'exact',
      path: '/phone-remote/rotate',
      handler: async (req, res) => {
        await statePromise
        await pushPromise
        if (req.method !== 'POST') {
          res.writeHead(405, { allow: 'POST' })
          res.end()
          return
        }
        const rejection = ctx.connection.requestRejection(req)
        if (rejection !== undefined) {
          res.writeHead(rejection)
          res.end()
          return
        }
        const next = { pin: newPin(), secret: newSecret(), createdAt: Date.now() }
        try {
          await writeState(next)
          state = next
          if (pushService !== null) await pushService.removeAll()
          sendJson(res, 200, status())
        } catch (error) {
          console.error('[phone-remote] rotate:', error)
          sendJson(res, 500, { error: '无法保存新的访问码' })
        }
      },
    })
    const disposeSubscribe = ctx.webServer.register({
      kind: 'exact',
      path: '/phone-remote/push/subscribe',
      handler: async (req, res) => {
        await pushPromise
        if (req.method !== 'POST') {
          res.writeHead(405, { allow: 'POST' })
          res.end()
          return
        }
        const rejection = ctx.connection.requestRejection(req)
        if (rejection !== undefined) {
          res.writeHead(rejection)
          res.end()
          return
        }
        if (pushService === null) {
          sendJson(res, 503, { error: pushError ?? '推送服务不可用' })
          return
        }
        let body
        try {
          body = await readJson(req, PUSH_BODY_LIMIT)
        } catch {
          sendJson(res, 400, { error: '无效的请求体' })
          return
        }
        const subscription = body?.subscription ?? body
        try {
          const count = await pushService.add(subscription)
          sendJson(res, 200, { ok: true, count })
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : '无效的推送订阅' })
        }
      },
    })
    const disposeUnsubscribe = ctx.webServer.register({
      kind: 'exact',
      path: '/phone-remote/push/unsubscribe',
      handler: async (req, res) => {
        await pushPromise
        if (req.method !== 'POST') {
          res.writeHead(405, { allow: 'POST' })
          res.end()
          return
        }
        const rejection = ctx.connection.requestRejection(req)
        if (rejection !== undefined) {
          res.writeHead(rejection)
          res.end()
          return
        }
        if (pushService === null) {
          sendJson(res, 503, { error: pushError ?? '推送服务不可用' })
          return
        }
        let body
        try {
          body = await readJson(req, PUSH_BODY_LIMIT)
        } catch {
          sendJson(res, 400, { error: '无效的请求体' })
          return
        }
        const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : ''
        if (endpoint === '') {
          sendJson(res, 400, { error: '缺少 endpoint' })
          return
        }
        await pushService.remove(endpoint)
        sendJson(res, 200, { ok: true, count: pushService.count })
      },
    })
    const disposeTest = ctx.webServer.register({
      kind: 'exact',
      path: '/phone-remote/push/test',
      handler: async (req, res) => {
        await pushPromise
        if (req.method !== 'POST') {
          res.writeHead(405, { allow: 'POST' })
          res.end()
          return
        }
        const rejection = ctx.connection.requestRejection(req)
        if (rejection !== undefined) {
          res.writeHead(rejection)
          res.end()
          return
        }
        if (pushService === null) {
          sendJson(res, 503, { error: pushError ?? '推送服务不可用' })
          return
        }
        try {
          sendJson(res, 200, await pushService.test())
        } catch (error) {
          console.error('[phone-remote] push test:', error)
          sendJson(res, 500, { error: '测试通知发送失败' })
        }
      },
    })
    return () => {
      disposed = true
      disposeStatus()
      disposeRotate()
      disposeSubscribe()
      disposeUnsubscribe()
      disposeTest()
      for (const socket of sockets) socket.destroy()
      sockets.clear()
      try {
        httpServer?.close()
      } catch (error) {
        console.error('[phone-remote] close http:', error)
      }
      try {
        httpsServer?.close()
      } catch (error) {
        console.error('[phone-remote] close https:', error)
      }
    }
  })
}
