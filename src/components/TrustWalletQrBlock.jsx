import { useState } from 'react'
import { uploadUrl } from '../api/index.js'
import { USDT_BEP20_LABEL } from './TrustWalletLogo.jsx'
import { Btn } from './ui/index.jsx'
import { buildTrustWalletPayUrl, copyToClipboard } from '../utils/trustWalletPay.js'

/** Admin USDT BEP20 address + QR (stored in admins.metamask_address / metamask_qr_image). */
export function TrustWalletQrBlock({ settings, amount, children }) {
  const [copied, setCopied] = useState(false)
  const address = settings?.metamask_address?.trim()

  if (!address) return null

  const payUrl = buildTrustWalletPayUrl({ address, settings, amount })

  const copyAddress = async () => {
    const ok = await copyToClipboard(address)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    }
  }

  return (
    <>
      {children}
      <div style={{ marginTop: children ? 10 : 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, fontWeight: 600 }}>
          My Public Address to Receive USDT BEP20
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              flex: '1 1 200px',
              fontFamily: 'JetBrains Mono,monospace',
              fontSize: 12,
              color: 'var(--cyan)',
              wordBreak: 'break-all',
              lineHeight: 1.5,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--bg-card2)',
              border: '1px solid var(--border-sm)',
            }}
          >
            {address}
          </div>
          <Btn type="button" variant="outline-cyan" size="sm" onClick={copyAddress} icon="📋">
            {copied ? 'Copied!' : 'Copy'}
          </Btn>
        </div>
      </div>

      {payUrl ? (
        <a
          href={payUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginTop: 14,
            width: '100%',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Pay with {USDT_BEP20_LABEL}
        </a>
      ) : null}
      {payUrl ? (
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.45, textAlign: 'center' }}>
          On mobile this opens your wallet app with {USDT_BEP20_LABEL} pre-filled
          {amount != null && amount !== '' && Number(amount) > 0 ? ` · amount ${amount} USDT` : ''}
        </div>
      ) : null}

      {settings.metamask_qr_image ? (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
            Scan QR — {USDT_BEP20_LABEL} · BNB Smart Chain (BSC)
          </div>
          <img
            src={uploadUrl(settings.metamask_qr_image)}
            alt={`${USDT_BEP20_LABEL} QR`}
            style={{
              maxWidth: 240,
              maxHeight: 240,
              width: '100%',
              objectFit: 'contain',
              borderRadius: 12,
              border: '1px solid var(--border-sm)',
              background: '#fff',
            }}
          />
        </div>
      ) : null}
    </>
  )
}
