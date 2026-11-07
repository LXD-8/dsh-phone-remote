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
import net from 'node:net'
import os from 'node:os'
import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { renderErrorPage, renderLoginPage } from './login-page.js'

export const name = 'phone-remote'
export const inject = ['webServer', 'connection']

const STATE_VERSION = 1
const COOKIE_NAME = 'dsh_phone_remote'
const COOKIE_DAYS = 30
const LOGIN_WINDOW_MS = 10 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 8
const MAX_BODY_BYTES = 4096
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

function makeAccessCookie(secret) {
  const expires = Date.now() + COOKIE_DAYS * 24 * 60 * 60 * 1000
  const payload = `v1.${expires}`
  return `${COOKIE_NAME}=${payload}.${sign(secret, payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_DAYS * 24 * 60 * 60}`
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
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
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ port?: number }} config
 */
export function apply(ctx, config) {
  const configuredPort = Number.isInteger(config?.port) && config.port >= 0 && config.port <= 65535 ? config.port : 17890
  const targetOrigin = ctx.webServer.getOrigin()
  const target = new URL(targetOrigin)
  const targetAuthority = target.host
  const targetHost = target.hostname.replace(/^\[|\]$/g, '')
  const targetPort = Number(target.port || 80)

  let state
  const statePromise = readState().then((loaded) => {
    state = loaded
    return loaded
  }).catch((error) => {
    console.error('[phone-remote] state:', error)
    state = { pin: newPin(), secret: newSecret(), createdAt: Date.now() }
    return state
  })

  const limiter = createLimiter()
  const sockets = new Set()
  let actualPort = null
  let listenError = null
  let server = null

  const addresses = () => lanAddresses()

  function status() {
    const port = actualPort ?? configuredPort
    const list = addresses().map((entry) => `http://${entry.address}:${port}`)
    const hostName = os.hostname()
    if (hostName.endsWith('.local')) {
      const byName = `http://${hostName}:${port}`
      if (!list.includes(byName)) list.push(byName)
    }
    return {
      running: server?.listening === true,
      port,
      pin: state?.pin ?? '',
      url: list[0] ?? `http://127.0.0.1:${port}`,
      urls: list,
      error: listenError,
      target: targetOrigin,
      hostName,
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

  function forwardedHeaders(req) {
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
    headers['x-forwarded-proto'] = 'http'
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

  function proxy(req, res) {
    const requestOrigin = `http://${req.headers.host ?? `127.0.0.1:${actualPort}`}`
    const upstream = http.request({
      host: targetHost,
      port: targetPort,
      method: req.method,
      path: req.url,
      headers: forwardedHeaders(req),
    }, (response) => {
      if (response.statusCode === 401
        && (req.method === 'GET' || req.method === 'HEAD')
        && String(req.headers.accept ?? '').includes('text/html')) {
        response.resume()
        res.writeHead(303, {
          location: '/',
          'cache-control': 'no-store',
          'set-cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
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

  async function handle(req, res) {
    await statePromise
    const url = new URL(req.url ?? '/', 'http://localhost')
    const pathname = url.pathname

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
        'set-cookie': [makeAccessCookie(state.secret), ...upstreamCookies],
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

  server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error('[phone-remote] request:', error)
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('internal error')
      } else {
        res.destroy()
      }
    })
  })

  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })

  server.on('upgrade', (req, socket, head) => {
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
  })

  server.on('error', (error) => {
    listenError = error.message
    console.error('[phone-remote] listen:', error)
  })

  server.on('listening', () => {
    const address = server.address()
    if (address !== null && typeof address === 'object') actualPort = address.port
    console.log(`[phone-remote] listening on 0.0.0.0:${actualPort ?? configuredPort} -> ${targetOrigin}`)
  })

  server.listen(configuredPort, '0.0.0.0')

  ctx.effect(() => {
    const disposeStatus = ctx.webServer.register({
      kind: 'exact',
      path: '/phone-remote/status',
      handler: async (req, res) => {
        await statePromise
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
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(status()))
      },
    })
    const disposeRotate = ctx.webServer.register({
      kind: 'exact',
      path: '/phone-remote/rotate',
      handler: async (req, res) => {
        await statePromise
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
        writeState(next).then(() => {
          state = next
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          res.end(JSON.stringify(status()))
        }, (error) => {
          console.error('[phone-remote] rotate:', error)
          res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: '无法保存新的访问码' }))
        })
      },
    })
    return () => {
      disposeStatus()
      disposeRotate()
      for (const socket of sockets) socket.destroy()
      sockets.clear()
      try {
        server?.close()
      } catch (error) {
        console.error('[phone-remote] close:', error)
      }
    }
  })
}
