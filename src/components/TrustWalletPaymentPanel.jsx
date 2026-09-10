import { Alert } from './ui/index.jsx'
import { TrustWalletQrBlock } from './TrustWalletQrBlock.jsx'
import { TrustWalletBrandRow, USDT_BEP20_LABEL } from './TrustWalletLogo.jsx'

/** Member payment: USDT BEP20 on BSC (admin address + QR). */
export function TrustWalletPaymentPanel({ settings, amountHint, amount }) {
  return (
    <Alert type="info" className="mb-4">
      <TrustWalletBrandRow
        title={USDT_BEP20_LABEL}
        subtitle={
          <>
            Send <strong>USDT BEP20</strong> on <strong>BNB Smart Chain (BSC)</strong>
            {amountHint ? <> · {amountHint}</> : null}
          </>
        }
        style={{ marginBottom: 14 }}
      />
      <TrustWalletQrBlock settings={settings} amount={amount}>
        <div style={{ fontSize: 11, color: 'var(--text-2)' }}>Send to this address:</div>
      </TrustWalletQrBlock>
      {!settings?.metamask_address ? (
        <div style={{ color: 'var(--orange)', marginTop: 10, fontSize: 12 }}>
          Admin has not set USDT BEP20 payout address yet — contact support or wait for Admin → Settings.
        </div>
      ) : null}
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12, lineHeight: 1.5 }}>
        After payment, enter the <strong>transaction hash (0x…)</strong> below and upload receipt screenshot.
      </div>
    </Alert>
  )
}
