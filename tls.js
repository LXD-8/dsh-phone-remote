/**
 * Local TLS material for the phone gateway.
 *
 * Web Push needs a secure context, and a home LAN has no public certificate.
 * This module creates one local CA (once) and a server certificate for the
 * current LAN address (every start), then builds the iOS configuration
 * profile that installs the CA. The phone trusts the CA once; the server
 * certificate can rotate freely.
 */
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const OPENSSL = 'openssl'
const OPENSSL_TIMEOUT_MS = 20_000

const CA_CONFIG = `[req]
distinguished_name = dn
x509_extensions = v3_ca
prompt = no

[dn]
CN = DSH Phone Remote Local CA
O = DSH Phone Remote

[v3_ca]
basicConstraints = critical,CA:TRUE
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
`

async function exists(path) {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function write(path, data, mode = 0o600) {
  await fs.writeFile(path, data, { mode })
}

async function openssl(args) {
  try {
    const { stdout } = await run(OPENSSL, args, {
      timeout: OPENSSL_TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024,
    })
    return stdout
  } catch (error) {
    const detail = typeof error?.stderr === 'string' && error.stderr.trim() !== ''
      ? error.stderr.trim().split('\n').pop()
      : error instanceof Error ? error.message : String(error)
    throw new Error(`openssl ${args[0]} failed: ${detail}`)
  }
}

function stableUuid(seed) {
  const hash = createHash('sha256').update(seed).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
}

function profileXml(derBase64, fingerprint) {
  const caUuid = stableUuid(`ca:${fingerprint}`)
  const profileUuid = stableUuid(`profile:${fingerprint}`)
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadCertificateFileName</key>
      <string>DSH-Phone-Remote-CA.cer</string>
      <key>PayloadContent</key>
      <data>${derBase64}</data>
      <key>PayloadDescription</key>
      <string>Trusts the local DSH Phone Remote gateway certificate.</string>
      <key>PayloadDisplayName</key>
      <string>DSH Phone Remote Local CA</string>
      <key>PayloadIdentifier</key>
      <string>local.dsh.phone-remote.ca</string>
      <key>PayloadOrganization</key>
      <string>DSH Phone Remote</string>
      <key>PayloadType</key>
      <string>com.apple.security.root</string>
      <key>PayloadUUID</key>
      <string>${caUuid}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Installs the local CA used by the DSH Phone Remote plugin.</string>
  <key>PayloadDisplayName</key>
  <string>DSH Phone Remote Local CA</string>
  <key>PayloadIdentifier</key>
  <string>local.dsh.phone-remote.profile</string>
  <key>PayloadOrganization</key>
  <string>DSH Phone Remote</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${profileUuid}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
`
}

/**
 * Ensure the local CA and a current server certificate exist.
 *
 * @param {object} options
 * @param {string} options.home - DSH home directory.
 * @param {string} options.hostName - the machine host name (usually `*.local`).
 * @param {string[]} options.addresses - LAN IPv4 addresses to include as SANs.
 * @returns {Promise<object>} key/cert PEM, CA material and the iOS profile.
 */
export async function ensureTls({ home, hostName, addresses }) {
  const directory = join(home, 'phone-remote-tls')
  await fs.mkdir(directory, { recursive: true, mode: 0o700 })
  if (process.platform !== 'win32') {
    try { await fs.chmod(directory, 0o700) } catch { /* best effort */ }
  }

  const caKeyPath = join(directory, 'ca.key')
  const caCertPath = join(directory, 'ca.crt')
  const caDerPath = join(directory, 'ca.der')
  const caConfigPath = join(directory, 'ca.cnf')
  const serverKeyPath = join(directory, 'server.key')
  const serverCertPath = join(directory, 'server.crt')
  const serverCsrPath = join(directory, 'server.csr')
  const serverConfigPath = join(directory, 'server-ext.cnf')
  const profilePath = join(directory, 'ca.mobileconfig')

  if (!(await exists(caKeyPath)) || !(await exists(caCertPath))) {
    await write(caConfigPath, CA_CONFIG)
    await openssl(['genrsa', '-out', caKeyPath, '2048'])
    await openssl(['req', '-x509', '-new', '-nodes', '-key', caKeyPath, '-sha256', '-days', '3650', '-config', caConfigPath, '-out', caCertPath])
    try { await fs.chmod(caKeyPath, 0o600) } catch { /* best effort */ }
  }

  const sanList = []
  if (typeof hostName === 'string' && hostName !== '') sanList.push(`DNS:${hostName}`)
  for (const address of addresses) {
    if (typeof address === 'string' && address !== '') sanList.push(`IP:${address}`)
  }
  if (sanList.length === 0) sanList.push('DNS:localhost')

  const serverConfig = `[v3_req]
basicConstraints = CA:FALSE
keyUsage = digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = ${sanList.join(',')}
`
  await write(serverConfigPath, serverConfig)
  if (!(await exists(serverKeyPath))) {
    await openssl(['genrsa', '-out', serverKeyPath, '2048'])
    try { await fs.chmod(serverKeyPath, 0o600) } catch { /* best effort */ }
  }
  const commonName = typeof hostName === 'string' && hostName !== '' ? hostName : 'phone-remote.local'
  await openssl(['req', '-new', '-key', serverKeyPath, '-subj', `/CN=${commonName}`, '-out', serverCsrPath])
  await openssl(['x509', '-req', '-in', serverCsrPath, '-CA', caCertPath, '-CAkey', caKeyPath,
    '-CAcreateserial', '-out', serverCertPath, '-days', '825', '-sha256',
    '-extfile', serverConfigPath, '-extensions', 'v3_req'])

  await openssl(['x509', '-in', caCertPath, '-outform', 'der', '-out', caDerPath])
  const [key, cert, caCertPem, caDer] = await Promise.all([
    fs.readFile(serverKeyPath, 'utf8'),
    fs.readFile(serverCertPath, 'utf8'),
    fs.readFile(caCertPath, 'utf8'),
    fs.readFile(caDerPath),
  ])
  const fingerprint = createHash('sha256').update(caDer).digest('hex')
  const caDerBase64 = caDer.toString('base64')
  const caProfileXml = profileXml(caDerBase64, fingerprint)
  await write(profilePath, caProfileXml, 0o644)

  await write(join(directory, 'meta.json'), JSON.stringify({
    caFingerprint: fingerprint,
    sans: sanList,
    hostName,
    addresses,
    updatedAt: new Date().toISOString(),
  }, null, 2) + '\n', 0o644)

  return {
    key,
    cert,
    caCertPem,
    caDerBase64,
    caProfileXml,
    caProfilePath: profilePath,
    caCertPath,
    fingerprint,
    sans: sanList,
  }
}
