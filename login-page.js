import { WHALE_PATH } from './whale.js'

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif'

const SHELL_CSS = `
  :root {
    color-scheme: light dark;
    --bg: #f6f7f9;
    --fg: #15171a;
    --muted: #6b7280;
    --line: #e3e6ea;
    --card: #ffffff;
    --ink: #1d2129;
    --brand: #4d6bfe;
    --brand-press: #3f5bef;
    --on-brand: #ffffff;
    --ring: rgba(77, 107, 254, 0.16);
    --error: #e5484d;
    --shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 12px 32px rgba(16, 24, 40, 0.06);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1113;
      --fg: #eceef2;
      --muted: #9aa2ad;
      --line: #262a30;
      --card: #17191d;
      --ink: #f2f4f8;
      --brand: #6f8bff;
      --brand-press: #5b78ff;
      --on-brand: #0f1113;
      --ring: rgba(111, 139, 255, 0.22);
      --error: #ff6b70;
      --shadow: none;
    }
  }
  * { box-sizing: border-box; }
  html, body { min-height: 100%; }
  body {
    margin: 0;
    min-height: 100dvh;
    background:
      radial-gradient(900px 480px at 50% -18%, rgba(77, 107, 254, 0.10), transparent 62%),
      var(--bg);
    color: var(--fg);
    font-family: ${FONT_STACK};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  main {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: max(28px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom));
  }
  .wrap { width: min(400px, 100%); text-align: center; }
  .mark {
    width: 64px; height: 64px; margin: 0 auto 16px;
    border-radius: 18px;
    background: linear-gradient(180deg, #ffffff, #f7f8fb);
    border: 1px solid var(--line);
    display: grid; place-items: center;
    box-shadow: var(--shadow);
    color: var(--ink);
  }
  @media (prefers-color-scheme: dark) {
    .mark { background: linear-gradient(180deg, #1d2026, #17191d); }
  }
  .mark svg { width: 46px; height: 46px; display: block; }
  .wordmark { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; color: var(--fg); }
  .wordmark em { font-style: normal; color: var(--brand); }
  h1 { margin: 20px 0 6px; font-size: 22px; line-height: 1.3; font-weight: 600; letter-spacing: -0.02em; }
  .sub { margin: 0 auto 22px; max-width: 340px; font-size: 13.5px; line-height: 1.65; color: var(--muted); }
  .card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 18px 18px 16px;
    text-align: left;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.03);
  }
  label { display: block; margin: 0 0 8px 2px; font-size: 12px; font-weight: 600; color: var(--muted); letter-spacing: 0.02em; }
  .pin {
    width: 100%; height: 58px; padding: 0 10px;
    border-radius: 13px;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--fg);
    font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace;
    font-size: 27px;
    letter-spacing: 0.34em;
    text-indent: 0.34em;
    text-align: center;
    font-variant-numeric: tabular-nums;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    -webkit-appearance: none;
    appearance: none;
  }
  .pin::placeholder { color: var(--muted); opacity: 0.35; }
  .pin:focus { border-color: var(--brand); box-shadow: 0 0 0 4px var(--ring); }
  button, .back {
    display: grid; place-items: center;
    width: 100%; height: 46px; margin-top: 12px;
    border: 0; border-radius: 12px;
    background: var(--brand);
    color: var(--on-brand);
    font-family: inherit; font-size: 14.5px; font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.15s, transform 0.05s;
  }
  button:hover, .back:hover { background: var(--brand-press); }
  button:active, .back:active { transform: translateY(0.5px); }
  button:disabled { opacity: 0.65; cursor: default; transform: none; }
  .err { min-height: 18px; margin: 9px 2px 0; font-size: 12.5px; line-height: 1.5; color: var(--error); }
  .hint {
    display: flex; gap: 9px; align-items: flex-start;
    margin: 16px 2px 0;
    text-align: left;
    font-size: 12px; line-height: 1.65;
    color: var(--muted);
  }
  .hint svg { flex: none; margin-top: 1px; opacity: 0.75; }
  .back { margin-top: 18px; }
  footer { margin-top: 22px; font-size: 11.5px; color: var(--muted); opacity: 0.8; }
`

const LOCK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]))
}

function documentShell({ title, body }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f6f7f9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f1113" media="(prefers-color-scheme: dark)">
<title>${escapeHtml(title)}</title>
<style>${SHELL_CSS}</style>
</head>
<body>
<main>
  <div class="wrap">
    <div class="mark" aria-hidden="true">
      <svg viewBox="0 0 50 50"><path d="${WHALE_PATH}" fill="currentColor"/></svg>
    </div>
    <div class="wordmark">DeepSeek <em>Harness</em></div>
    ${body}
    <footer>DeepSeek Harness · 手机遥控</footer>
  </div>
</main>
</body>
</html>`
}

export function renderLoginPage({ error = '', pin = '' } = {}) {
  return documentShell({
    title: 'DeepSeek Harness · 手机遥控',
    body: `<h1>连接到这台电脑</h1>
    <p class="sub">输入访问码，在手机上继续使用 DSH。</p>
    <form class="card" method="post" action="/_phone/login">
      <label for="pin">访问码</label>
      <input id="pin" class="pin" name="pin" type="text" inputmode="numeric" autocomplete="off"
             pattern="[0-9 ]*" maxlength="7" placeholder="000000" autofocus value="${escapeHtml(pin)}">
      <button type="submit">连接</button>
      <p class="err" role="alert">${escapeHtml(error)}</p>
    </form>
    <div class="hint">
      ${LOCK_ICON}
      <span>访问码在 DSH 的「设置 → 手机遥控」中查看。仅限同一 Wi-Fi 下的设备使用。</span>
    </div>
    <script>
      document.querySelector('form').addEventListener('submit', function () {
        var button = this.querySelector('button')
        button.disabled = true
        button.textContent = '正在连接…'
      })
    </script>`,
  })
}

export function renderErrorPage(title, detail, status) {
  return {
    status,
    body: documentShell({
      title: `${title} · DeepSeek Harness`,
      body: `<h1>${escapeHtml(title)}</h1>
      <p class="sub">${escapeHtml(detail)}</p>
      <a class="back" href="/">返回登录页</a>`,
    }),
  }
}
