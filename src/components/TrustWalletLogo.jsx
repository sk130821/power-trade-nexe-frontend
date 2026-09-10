export const USDT_BEP20_LABEL = 'USDT BEP20'

/** @deprecated Logo removed — kept for imports that still reference it. */
export function TrustWalletLogo() {
  return null
}

/** Title row for payment / settings screens (text only, no logo). */
export function TrustWalletBrandRow({ title = USDT_BEP20_LABEL, subtitle, style }) {
  return (
    <div className="usdt-bep20-brand-row" style={{ minWidth: 0, ...style }}>
      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-1)', lineHeight: 1.3 }}>{title}</div>
      {subtitle ? (
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.45 }}>{subtitle}</div>
      ) : null}
    </div>
  )
}
