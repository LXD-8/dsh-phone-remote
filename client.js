window.__ModuleLoader__.load({
  id: '@local/dsh-phone-remote',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const DICT = {
      zh: {
        sectionLabel: '手机遥控',
        intro: '用同一 Wi-Fi 下的手机浏览器控制这台电脑上的 DSH。',
        running: '运行中',
        stopped: '未运行',
        address: '访问地址',
        pin: '访问码',
        copy: '复制',
        copied: '已复制',
        rotate: '重新生成访问码',
        rotating: '正在生成…',
        rotateNote: '重新生成后，已经连接的手机需要重新输入访问码；已经登记的通知也会被清空。',
        warning: '访问码等同于这台电脑的控制权，请只在自己的手机上使用，不要告诉别人。',
        firewall: '第一次使用时，如果 macOS 询问是否允许传入连接，请选择“允许”。',
        loading: '正在读取…',
        otherAddresses: '其他可用地址',
        pinHint: '在手机浏览器打开上面的地址，输入这 6 位访问码。',
        notifyTitle: '通知',
        notifyIntro: '任务完成、需要回答或需要授权时，在手机上弹出系统通知。',
        notifyStatusOn: '已开启',
        notifyStatusOff: '未开启',
        notifyDevices: '已登记设备',
        notifyEnable: '启用通知',
        notifyEnabling: '正在启用…',
        notifyDisable: '关闭通知',
        notifyTest: '发送测试通知',
        notifyTesting: '正在发送…',
        notifyRegister: '重新登记',
        notifyHttps: 'HTTPS 地址',
        notifyCa: '证书地址',
        notifyCaHint: '先在 iPhone 上安装这个本地 CA 并开启完全信任，否则 HTTPS 和通知都不能用。',
        notifyStepsTitle: 'iPhone 设置顺序',
        notifyStep1: '在 iPhone 上打开证书地址，安装描述文件。',
        notifyStep2: '设置 → 通用 → 关于 → 证书信任设置，开启完全信任。',
        notifyStep3: '用 HTTPS 地址打开 DSH，输入访问码登录。',
        notifyStep4: 'Safari 分享 → 添加到主屏幕，从主屏幕打开。',
        notifyStep5: '回到这里点「启用通知」。',
        notifyHttpsNotReady: 'HTTPS 还没准备好',
        notifyUnsupported: '这个浏览器不支持 Web Push。iPhone 需要 iOS 16.4+，并从主屏幕打开。',
        notifyHome: '请先在 Safari 中分享 → 添加到主屏幕，再从主屏幕打开这个页面。',
        notifyDesktop: '通知需要在手机上设置。',
        notifyHttpsHint: '通知需要 HTTPS。请在手机上用下面的 HTTPS 地址打开并登录。',
        notifyEnabled: '通知已开启。',
        notifyTestSent: '测试通知已发送。',
        notifyNoSubs: '还没有推送订阅，先在手机上启用通知。',
        notifyTestFailed: '测试通知发送失败，请检查推送订阅。',
        diagLabel: '诊断：',
        diagReady: '条件已满足',
        diagNotGateway: '不在手机网关上',
        diagNotSecure: '当前不是 HTTPS',
        diagNotStandalone: '不是从主屏幕打开',
        diagNoPush: '浏览器没有 Push API（iPhone 需 16.4+）',
        diagHttpsNotReady: 'HTTPS 还没就绪',
        diagNoVapid: '推送服务没有 VAPID 公钥',
        notifyPermission: '通知权限被拒绝，请到 iPhone 设置 → 通知 → DSH 中允许。',
        notifyRegistered: '本机已订阅，但 Host 没有记录，请点「启用通知」重新登记。',
        notifyNoVapid: '推送服务不可用，缺少 VAPID 公钥。',
        notifyError: '通知操作失败',
      },
      en: {
        sectionLabel: 'Phone remote',
        intro: 'Control DSH on this computer from a phone browser on the same Wi-Fi.',
        running: 'Running',
        stopped: 'Not running',
        address: 'Address',
        pin: 'Access PIN',
        copy: 'Copy',
        copied: 'Copied',
        rotate: 'New access PIN',
        rotating: 'Generating…',
        rotateNote: 'After rotating, connected phones must enter the new PIN and notification subscriptions are cleared.',
        warning: 'The PIN grants control of this computer. Use it only on your own phone and never share it.',
        firewall: 'On first use, choose “Allow” if macOS asks whether to accept incoming connections.',
        loading: 'Loading…',
        otherAddresses: 'Other addresses',
        pinHint: 'Open the address in a phone browser and enter this 6-digit PIN.',
        notifyTitle: 'Notifications',
        notifyIntro: 'Get a system notification on the phone when a task finishes, or when the agent needs an answer or approval.',
        notifyStatusOn: 'On',
        notifyStatusOff: 'Off',
        notifyDevices: 'registered',
        notifyEnable: 'Enable notifications',
        notifyEnabling: 'Enabling…',
        notifyDisable: 'Disable notifications',
        notifyTest: 'Send test notification',
        notifyTesting: 'Sending…',
        notifyRegister: 'Register again',
        notifyHttps: 'HTTPS address',
        notifyCa: 'Certificate',
        notifyCaHint: 'Install and trust the local CA on the iPhone first; otherwise HTTPS and notifications will not work.',
        notifyStepsTitle: 'iPhone setup order',
        notifyStep1: 'Open the certificate address on the iPhone and install the profile.',
        notifyStep2: 'Settings → General → About → Certificate Trust Settings, enable full trust.',
        notifyStep3: 'Open the HTTPS address, enter the access code.',
        notifyStep4: 'Safari Share → Add to Home Screen, then open it from the Home Screen.',
        notifyStep5: 'Come back here and tap Enable notifications.',
        notifyHttpsNotReady: 'HTTPS is not ready yet',
        notifyUnsupported: 'This browser does not support Web Push. iPhone needs iOS 16.4+ and the Home Screen app.',
        notifyHome: 'In Safari, Share → Add to Home Screen, then open the page from the Home Screen.',
        notifyDesktop: 'Set notifications up on the phone.',
        notifyHttpsHint: 'Notifications need HTTPS. Open the HTTPS address on the phone and log in.',
        notifyEnabled: 'Notifications enabled.',
        notifyTestSent: 'Test notification sent.',
        notifyNoSubs: 'No push subscription yet; enable notifications on the phone first.',
        notifyTestFailed: 'The test notification failed; check the push subscription.',
        diagLabel: 'Diagnosis: ',
        diagReady: 'all conditions met',
        diagNotGateway: 'not on the phone gateway',
        diagNotSecure: 'not HTTPS',
        diagNotStandalone: 'not opened from the Home Screen',
        diagNoPush: 'no Push API (iPhone needs 16.4+)',
        diagHttpsNotReady: 'HTTPS is not ready',
        diagNoVapid: 'the push service has no VAPID key',
        notifyPermission: 'Notification permission was denied. Allow it in iPhone Settings → Notifications → DSH.',
        notifyRegistered: 'This phone is subscribed, but the Host has no record. Tap Enable notifications to register it again.',
        notifyNoVapid: 'Push service unavailable; the VAPID public key is missing.',
        notifyError: 'Notification operation failed',
      },
    }

    const styles = {
      root: { maxWidth: 720, padding: '4px 0 40px', color: 'var(--dsw-alias-label-primary)' },
      title: { margin: '0 0 6px', fontSize: 18, fontWeight: 600 },
      intro: { margin: '0 0 18px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' },
      card: {
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        borderRadius: 14,
        padding: '6px 16px 12px',
      },
      statusRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0 10px' },
      dot: { width: 8, height: 8, borderRadius: 4, flex: 'none' },
      statusText: { fontSize: 13, fontWeight: 500 },
      row: {
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 0', borderTop: '1px solid var(--dsw-alias-border-l1)',
      },
      rowLabel: { width: 92, flex: 'none', fontSize: 13, color: 'var(--dsw-alias-label-secondary)' },
      value: {
        flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 14,
        letterSpacing: '0.02em',
      },
      pinValue: {
        flex: 1, minWidth: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 24, letterSpacing: '0.18em', fontVariantNumeric: 'tabular-nums',
      },
      button: {
        flex: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12.5, fontWeight: 500,
      },
      rotateButton: {
        flex: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'transparent', color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12.5, fontWeight: 500,
      },
      note: { margin: '14px 0 0', fontSize: 12.5, lineHeight: 1.65, color: 'var(--dsw-alias-label-secondary)' },
      warn: { margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.65, color: 'var(--dsw-alias-state-warn-primary)' },
      error: { margin: '10px 0 0', fontSize: 12.5, color: 'var(--dsw-alias-state-error-primary)' },
      other: { margin: '8px 0 0', fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
      notifyCard: {
        marginTop: 16,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        borderRadius: 14,
        padding: '14px 16px 16px',
      },
      notifyTitle: { margin: '0 0 4px', fontSize: 15, fontWeight: 600 },
      notifyIntro: { margin: '0 0 8px', fontSize: 12.5, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' },
      notifyStatus: { display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0 8px' },
      notifyRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '8px 0 0' },
      notifyLabel: { width: 86, flex: 'none', fontSize: 12.5, color: 'var(--dsw-alias-label-secondary)' },
      notifyCode: {
        flex: '1 1 200px', minWidth: 0, wordBreak: 'break-all',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5,
      },
      notifyLink: {
        flex: '1 1 200px', minWidth: 0, wordBreak: 'break-all',
        color: 'var(--dsw-alias-brand-primary)', textDecoration: 'none', fontSize: 12.5,
      },
      notifyStepsTitle: { margin: '12px 0 0', fontSize: 12.5, fontWeight: 600 },
      notifySteps: { margin: '4px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)' },
      notifyActions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 },
      notifyPrimary: {
        padding: '8px 14px', borderRadius: 8, border: 0, cursor: 'pointer',
        background: 'var(--dsw-alias-brand-primary)', color: '#fff', fontSize: 13, fontWeight: 600,
      },
      notifyMessage: { margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' },
      notifyError: { margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.6, color: 'var(--dsw-alias-state-error-primary)' },
      notifyDiag: { margin: '6px 0 0', fontSize: 11.5, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' },
    }

    function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4)
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
      const raw = atob(base64)
      const output = new Uint8Array(raw.length)
      for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index)
      return output
    }

    function makeSection(ctx) {
      const t = ctx.locale.bind('phone-remote')

      function NotificationCard({ data, onRefresh, copy, copied }) {
        const [subscribed, setSubscribed] = React.useState(false)
        const [busy, setBusy] = React.useState(false)
        const [message, setMessage] = React.useState('')
        const [localError, setLocalError] = React.useState('')

        const secure = typeof window !== 'undefined' && window.isSecureContext === true
        const gateway = ctx.connection?.isLoopback === false
        const ios = typeof navigator !== 'undefined' && /iP(hone|ad|od)/i.test(navigator.userAgent)
        const standalone = typeof window !== 'undefined'
          && (window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches)
        const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
        const httpsUrl = typeof data?.httpsUrl === 'string' ? data.httpsUrl : ''
        const caUrl = typeof data?.caProfileUrl === 'string' ? data.caProfileUrl : ''
        const count = typeof data?.pushSubscriptions === 'number' ? data.pushSubscriptions : 0
        const ready = data?.httpsReady === true
        const blockers = []
        if (!gateway) blockers.push(t('diagNotGateway'))
        if (!secure) blockers.push(t('diagNotSecure'))
        if (ios && !standalone) blockers.push(t('diagNotStandalone'))
        if (!supported) blockers.push(t('diagNoPush'))
        if (!ready) blockers.push(t('diagHttpsNotReady'))
        if (typeof data?.vapidPublicKey !== 'string') blockers.push(t('diagNoVapid'))
        const canEnable = blockers.length === 0

        React.useEffect(() => {
          if (!gateway || !secure || !supported) return undefined
          let cancelled = false
          ;(async () => {
            try {
              const registration = await navigator.serviceWorker.getRegistration('/')
              const subscription = registration === undefined ? null : await registration.pushManager.getSubscription()
              if (!cancelled) setSubscribed(subscription !== null)
            } catch {
              // A blocked service-worker check leaves the previous state alone.
            }
          })()
          return () => { cancelled = true }
        }, [gateway, secure, supported, count])

        const enable = React.useCallback(async () => {
          setBusy(true)
          setMessage('')
          setLocalError('')
          try {
            if (typeof data?.vapidPublicKey !== 'string') throw new Error(t('notifyNoVapid'))
            if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
              try { await Notification.requestPermission() } catch { /* iOS may not expose Notification */ }
            }
            const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
            await navigator.serviceWorker.ready
            let subscription = await registration.pushManager.getSubscription()
            if (subscription === null) {
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(data.vapidPublicKey),
              })
            }
            const response = await fetch('/phone-remote/push/subscribe', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ subscription: subscription.toJSON() }),
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            setSubscribed(true)
            setMessage(t('notifyEnabled'))
            await onRefresh()
          } catch (reason) {
            if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
              setLocalError(t('notifyPermission'))
            } else {
              setLocalError(String(reason?.message ?? reason))
            }
          } finally {
            setBusy(false)
          }
        }, [data?.vapidPublicKey, onRefresh])

        const disable = React.useCallback(async () => {
          setBusy(true)
          setMessage('')
          setLocalError('')
          try {
            const registration = await navigator.serviceWorker.getRegistration('/')
            const subscription = registration === undefined ? null : await registration.pushManager.getSubscription()
            if (subscription !== null) {
              await fetch('/phone-remote/push/unsubscribe', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ endpoint: subscription.endpoint }),
              }).catch(() => {})
              await subscription.unsubscribe()
            }
            setSubscribed(false)
            await onRefresh()
          } catch (reason) {
            setLocalError(String(reason?.message ?? reason))
          } finally {
            setBusy(false)
          }
        }, [onRefresh])

        const test = React.useCallback(async () => {
          setBusy(true)
          setMessage('')
          setLocalError('')
          try {
            const response = await fetch('/phone-remote/push/test', { method: 'POST' })
            const body = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
            if ((body.sent ?? 0) > 0) setMessage(t('notifyTestSent'))
            else if ((body.failed ?? 0) > 0) {
              const reason = typeof body.error?.reason === 'string' && body.error.reason !== ''
                ? `（${body.error.reason}）`
                : ''
              setLocalError(`${t('notifyTestFailed')}${reason}`)
            } else setMessage(t('notifyNoSubs'))
          } catch (reason) {
            setLocalError(String(reason?.message ?? reason))
          } finally {
            setBusy(false)
          }
        }, [])

        const statusOn = subscribed && count > 0
        const showSetup = !gateway || !secure || !ready || !supported || (ios && !standalone)

        return h('div', { style: styles.notifyCard },
          h('h3', { style: styles.notifyTitle }, t('notifyTitle')),
          h('p', { style: styles.notifyIntro }, t('notifyIntro')),
          h('div', { style: styles.notifyStatus },
            h('span', {
              style: {
                ...styles.dot,
                background: statusOn
                  ? 'var(--dsw-alias-state-success-primary)'
                  : 'var(--dsw-alias-state-error-primary)',
              },
            }),
            h('span', { style: styles.statusText }, statusOn
              ? `${t('notifyStatusOn')} · ${t('notifyDevices')} ${count}`
              : t('notifyStatusOff')),
          ),
          !ready
            ? h('p', { style: styles.notifyError }, `${t('notifyHttpsNotReady')}${data?.httpsError ? `：${data.httpsError}` : ''}`)
            : null,
          !gateway ? h('p', { style: styles.notifyMessage }, t('notifyDesktop')) : null,
          gateway && !secure ? h('p', { style: styles.notifyMessage }, t('notifyHttpsHint')) : null,
          gateway && secure && ios && !standalone ? h('p', { style: styles.notifyMessage }, t('notifyHome')) : null,
          gateway && secure && !supported ? h('p', { style: styles.notifyMessage }, t('notifyUnsupported')) : null,
          subscribed && count === 0 ? h('p', { style: styles.notifyMessage }, t('notifyRegistered')) : null,
          data?.pushError ? h('p', { style: styles.notifyError }, `${t('notifyError')}：${data.pushError}`) : null,
          h('p', { style: styles.notifyDiag },
            `${t('diagLabel')}${blockers.length === 0 ? t('diagReady') : blockers.join(' · ')}`),
          showSetup
            ? h('div', null,
              h('div', { style: styles.notifyRow },
                h('span', { style: styles.notifyLabel }, t('notifyHttps')),
                h('a', {
                  href: httpsUrl || '#',
                  target: '_blank',
                  rel: 'noreferrer',
                  style: styles.notifyLink,
                }, httpsUrl || '—'),
                h('button', {
                  type: 'button',
                  style: styles.button,
                  disabled: httpsUrl === '',
                  onClick: () => copy(httpsUrl, 'notify-https'),
                }, copied === 'notify-https' ? t('copied') : t('copy')),
              ),
              h('div', { style: styles.notifyRow },
                h('span', { style: styles.notifyLabel }, t('notifyCa')),
                h('a', {
                  href: caUrl || '#',
                  target: '_blank',
                  rel: 'noreferrer',
                  style: styles.notifyLink,
                }, caUrl || '—'),
                h('button', {
                  type: 'button',
                  style: styles.button,
                  disabled: caUrl === '',
                  onClick: () => copy(caUrl, 'notify-ca'),
                }, copied === 'notify-ca' ? t('copied') : t('copy')),
              ),
              h('p', { style: styles.notifyMessage }, t('notifyCaHint')),
              h('p', { style: styles.notifyStepsTitle }, t('notifyStepsTitle')),
              h('ol', { style: styles.notifySteps },
                h('li', null, t('notifyStep1')),
                h('li', null, t('notifyStep2')),
                h('li', null, t('notifyStep3')),
                h('li', null, t('notifyStep4')),
                h('li', null, t('notifyStep5')),
              ),
            )
            : null,
          h('div', { style: styles.notifyActions },
            (!subscribed || count === 0)
              ? h('button', {
                type: 'button',
                style: {
                  ...styles.notifyPrimary,
                  ...(canEnable ? {} : { opacity: 0.45, cursor: 'not-allowed' }),
                },
                disabled: busy || !canEnable,
                title: blockers.join('；'),
                onClick: enable,
              }, busy ? t('notifyEnabling') : (subscribed ? t('notifyRegister') : t('notifyEnable')))
              : null,
            subscribed
              ? h('button', {
                type: 'button',
                style: styles.button,
                disabled: busy,
                onClick: test,
              }, busy ? t('notifyTesting') : t('notifyTest'))
              : null,
            subscribed
              ? h('button', {
                type: 'button',
                style: styles.rotateButton,
                disabled: busy,
                onClick: disable,
              }, t('notifyDisable'))
              : null,
          ),
          message !== '' ? h('p', { style: styles.notifyMessage }, message) : null,
          localError !== '' ? h('p', { style: styles.notifyError }, `${t('notifyError')}：${localError}`) : null,
        )
      }

      return function PhoneRemoteSection() {
        const subscribe = React.useCallback((listener) => ctx.locale.subscribe(listener), [])
        const snapshot = React.useCallback(() => ctx.locale.getSnapshot(), [])
        React.useSyncExternalStore(subscribe, snapshot)

        const [data, setData] = React.useState(null)
        const [error, setError] = React.useState('')
        const [busy, setBusy] = React.useState(false)
        const [copied, setCopied] = React.useState('')
        const copyTimer = React.useRef(null)

        const load = React.useCallback(async () => {
          try {
            const response = await fetch('/phone-remote/status', { cache: 'no-store' })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            setData(await response.json())
            setError('')
          } catch (reason) {
            setError(String(reason))
          }
        }, [])

        React.useEffect(() => { void load() }, [load])

        React.useEffect(() => () => {
          if (copyTimer.current !== null) clearTimeout(copyTimer.current)
        }, [])

        const copy = React.useCallback(async (text, key) => {
          try {
            await navigator.clipboard.writeText(text)
          } catch {
            const area = document.createElement('textarea')
            area.value = text
            area.style.position = 'fixed'
            area.style.opacity = '0'
            document.body.appendChild(area)
            area.select()
            try { document.execCommand('copy') } finally { area.remove() }
          }
          setCopied(key)
          if (copyTimer.current !== null) clearTimeout(copyTimer.current)
          copyTimer.current = setTimeout(() => setCopied(''), 1600)
        }, [])

        const rotate = React.useCallback(async () => {
          setBusy(true)
          try {
            const response = await fetch('/phone-remote/rotate', { method: 'POST' })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            setData(await response.json())
            setError('')
          } catch (reason) {
            setError(String(reason))
          } finally {
            setBusy(false)
          }
        }, [])

        const running = data?.running === true
        const pin = typeof data?.pin === 'string' ? data.pin : ''
        const prettyPin = pin.replace(/(\d{3})(\d{3})/, '$1 $2')
        const url = typeof data?.url === 'string' ? data.url : ''

        const row = (label, value, key, valueStyle) => h('div', { style: styles.row },
          h('div', { style: styles.rowLabel }, label),
          h('code', { style: { ...styles.value, ...(valueStyle ?? {}) } }, value || '—'),
          h('button', {
            type: 'button',
            style: styles.button,
            disabled: value === '',
            onClick: () => copy(value, key),
          }, copied === key ? t('copied') : t('copy')),
        )

        return h('div', { style: styles.root },
          h('h2', { style: styles.title }, t('sectionLabel')),
          h('p', { style: styles.intro }, t('intro')),
          h('div', { style: styles.card },
            h('div', { style: styles.statusRow },
              h('span', {
                style: {
                  ...styles.dot,
                  background: running
                    ? 'var(--dsw-alias-state-success-primary)'
                    : 'var(--dsw-alias-state-error-primary)',
                },
              }),
              h('span', { style: styles.statusText }, running ? t('running') : t('stopped')),
            ),
            row(t('address'), url, 'url', { whiteSpace: 'normal', wordBreak: 'break-all', overflow: 'visible', textOverflow: 'clip' }),
            row(t('pin'), prettyPin, 'pin', styles.pinValue),
            h('p', { style: styles.note }, t('pinHint')),
            Array.isArray(data?.urls) && data.urls.length > 1
              ? h('p', { style: styles.other }, `${t('otherAddresses')}: ${data.urls.slice(1).join('  ')}`)
              : null,
            h('button', {
              type: 'button',
              style: styles.rotateButton,
              disabled: busy,
              onClick: rotate,
            }, busy ? t('rotating') : t('rotate')),
            h('p', { style: styles.note }, t('rotateNote')),
            h('p', { style: styles.warn }, t('warning')),
            h('p', { style: styles.note }, t('firewall')),
            error !== '' ? h('p', { style: styles.error }, error) : null,
            data === null && error === '' ? h('p', { style: styles.note }, t('loading')) : null,
          ),
          h(NotificationCard, { data, onRefresh: load, copy, copied }),
          data?.error ? h('p', { style: styles.error }, String(data.error)) : null,
        )
      }
    }

    return {
      inject: ['slots', 'locale', 'connection'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('phone-remote', 'zh', DICT.zh))
        ctx.effect(() => ctx.locale.register('phone-remote', 'en', DICT.en))
        const t = ctx.locale.bind('phone-remote')
        const Section = makeSection(ctx)
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'phone-remote',
          order: 8,
          label: () => t('sectionLabel'),
        }, Section))
        ctx.effect(() => {
          if (typeof window === 'undefined') return undefined
          const openSessionFromUrl = (href) => {
            try {
              const url = new URL(href, window.location.href)
              const sessionId = url.searchParams.get('phoneRemoteSession')
              if (sessionId === null) return
              const workspace = ctx.get('uiWorkspace')
              if (workspace !== undefined) workspace.openSession(sessionId)
              url.searchParams.delete('phoneRemoteSession')
              window.history.replaceState({}, '', url.pathname + url.search + url.hash)
            } catch {
              // A malformed deep link only costs the navigation.
            }
          }
          const onMessage = (event) => {
            if (event.data?.type === 'dsh-phone-remote-open') openSessionFromUrl(event.data.url)
          }
          window.addEventListener('message', onMessage)
          const timer = window.setTimeout(() => openSessionFromUrl(window.location.href), 1200)
          return () => {
            window.removeEventListener('message', onMessage)
            window.clearTimeout(timer)
          }
        })
      },
    }
  },
})
