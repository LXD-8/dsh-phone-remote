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
        rotateNote: '重新生成后，已经连接的手机需要重新输入访问码。',
        warning: '访问码等同于这台电脑的控制权，请只在自己的手机上使用，不要告诉别人。',
        firewall: '第一次使用时，如果 macOS 询问是否允许传入连接，请选择“允许”。',
        loading: '正在读取…',
        otherAddresses: '其他可用地址',
        pinHint: '在手机浏览器打开上面的地址，输入这 6 位访问码。',
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
        rotateNote: 'After rotating, connected phones must enter the new PIN.',
        warning: 'The PIN grants control of this computer. Use it only on your own phone and never share it.',
        firewall: 'On first use, choose “Allow” if macOS asks whether to accept incoming connections.',
        loading: 'Loading…',
        otherAddresses: 'Other addresses',
        pinHint: 'Open the address in a phone browser and enter this 6-digit PIN.',
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
        marginTop: 12, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'transparent', color: 'var(--dsw-alias-brand-primary)',
        fontSize: 13, fontWeight: 500,
      },
      note: { margin: '14px 0 0', fontSize: 12.5, lineHeight: 1.65, color: 'var(--dsw-alias-label-secondary)' },
      warn: { margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.65, color: 'var(--dsw-alias-state-warn-primary)' },
      error: { margin: '10px 0 0', fontSize: 12.5, color: 'var(--dsw-alias-state-error-primary)' },
      other: { margin: '8px 0 0', fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
    }

    function makeSection(ctx) {
      const t = ctx.locale.bind('phone-remote')

      return function PhoneRemoteSection() {
        const subscribe = React.useCallback((listener) => ctx.locale.subscribe(listener), [])
        const snapshot = React.useCallback(() => ctx.locale.getSnapshot(), [])
        React.useSyncExternalStore(subscribe, snapshot)

        const [data, setData] = React.useState(null)
        const [error, setError] = React.useState('')
        const [busy, setBusy] = React.useState(false)
        const [copied, setCopied] = React.useState('')
        const copyTimer = React.useRef(null)

        React.useEffect(() => {
          let cancelled = false
          fetch('/phone-remote/status', { cache: 'no-store' })
            .then((response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`)
              return response.json()
            })
            .then((value) => {
              if (!cancelled) setData(value)
            })
            .catch((reason) => {
              if (!cancelled) setError(String(reason))
            })
          return () => { cancelled = true }
        }, [])

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
            row(t('address'), url, 'url'),
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
          data?.error ? h('p', { style: styles.error }, String(data.error)) : null,
        )
      }
    }

    return {
      inject: ['slots', 'locale'],
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
      },
    }
  },
})
