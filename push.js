/**
 * Web Push subscriptions for the phone gateway.
 *
 * The Host owns the VAPID key pair and the phone's PushSubscription records.
 * Sending is delegated to `web-push`; a subscription the push service reports
 * as gone (404/410) is dropped so the list does not grow stale.
 */
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'

const MAX_SUBSCRIPTIONS = 20
const TTL_SECONDS = 600

async function readJson(path) {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8'))
  } catch {
    return undefined
  }
}

function describePushError(error) {
  let reason = ''
  if (typeof error?.body === 'string') {
    try {
      const parsed = JSON.parse(error.body)
      if (typeof parsed?.reason === 'string') reason = parsed.reason
    } catch {
      reason = error.body.slice(0, 160)
    }
  }
  return {
    status: Number(error?.statusCode) || 0,
    reason: reason === '' && error instanceof Error ? error.message : reason,
  }
}

function validSubscription(value) {
  if (value === null || typeof value !== 'object') return false
  if (typeof value.endpoint !== 'string' || !value.endpoint.startsWith('https://')) return false
  const keys = value.keys
  if (keys === null || typeof keys !== 'object') return false
  if (typeof keys.p256dh !== 'string' || keys.p256dh.length < 32) return false
  if (typeof keys.auth !== 'string' || keys.auth.length < 8) return false
  return true
}

/**
 * Create the push service, loading or creating the VAPID pair and subscriptions.
 *
 * @param {object} options
 * @param {string} options.home - DSH home directory.
 * @param {object} options.webpush - the `web-push` module namespace.
 * @returns {Promise<object>} push service with public key, count and send helpers.
 */
export async function createPushService({ home, webpush }) {
  const file = join(home, 'phone-remote-push.json')
  await fs.mkdir(dirname(file), { recursive: true })

  let state = await readJson(file)
  if (state === null || typeof state !== 'object' || Array.isArray(state)) state = {}
  if (state.vapid === null || typeof state.vapid !== 'object'
    || typeof state.vapid.publicKey !== 'string' || typeof state.vapid.privateKey !== 'string') {
    state.vapid = webpush.generateVAPIDKeys()
  }
  if (!Array.isArray(state.subscriptions)) state.subscriptions = []
  state.subscriptions = state.subscriptions.filter(validSubscription).slice(-MAX_SUBSCRIPTIONS)

  const save = async () => {
    const temporary = `${file}.${process.pid}.tmp`
    await fs.writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 })
    await fs.rename(temporary, file)
    try { await fs.chmod(file, 0o600) } catch { /* best effort */ }
  }
  await save()

  webpush.setVapidDetails('https://github.com/LXD-8/dsh-phone-remote', state.vapid.publicKey, state.vapid.privateKey)

  const remove = async (endpoint) => {
    const before = state.subscriptions.length
    state.subscriptions = state.subscriptions.filter((entry) => entry.endpoint !== endpoint)
    if (state.subscriptions.length !== before) await save()
    return state.subscriptions.length !== before
  }

  return {
    get publicKey() { return state.vapid.publicKey },
    get count() { return state.subscriptions.length },
    async add(subscription) {
      if (!validSubscription(subscription)) throw new Error('无效的推送订阅')
      const entry = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
        expirationTime: typeof subscription.expirationTime === 'number' ? subscription.expirationTime : null,
        createdAt: Date.now(),
      }
      state.subscriptions = state.subscriptions.filter((item) => item.endpoint !== entry.endpoint)
      state.subscriptions.push(entry)
      if (state.subscriptions.length > MAX_SUBSCRIPTIONS) {
        state.subscriptions = state.subscriptions.slice(-MAX_SUBSCRIPTIONS)
      }
      await save()
      return state.subscriptions.length
    },
    remove,
    async removeAll() {
      const count = state.subscriptions.length
      state.subscriptions = []
      if (count > 0) await save()
      return count
    },
    async send(payload) {
      if (state.subscriptions.length === 0) return { sent: 0, failed: 0, removed: 0 }
      const body = JSON.stringify(payload)
      let sent = 0
      let failed = 0
      let removed = 0
      let firstError = null
      for (const subscription of [...state.subscriptions]) {
        try {
          await webpush.sendNotification(subscription, body, { TTL: TTL_SECONDS })
          sent += 1
        } catch (error) {
          const status = Number(error?.statusCode)
          if (status === 404 || status === 410) {
            await remove(subscription.endpoint)
            removed += 1
          } else {
            failed += 1
            if (firstError === null) firstError = describePushError(error)
          }
        }
      }
      if (firstError !== null) console.error('[phone-remote] push:', firstError)
      return { sent, failed, removed, ...(firstError === null ? {} : { error: firstError }) }
    },
    async test() {
      return await this.send({
        title: 'DSH 通知测试',
        body: '任务完成、需要回答和需要授权时，会通过这条通道提醒你。',
        url: '/',
        tag: 'dsh-phone-remote-test',
        force: true,
      })
    },
    file,
  }
}
