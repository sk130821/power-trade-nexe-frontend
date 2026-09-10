export const BRAND_NAME = 'Power Trade Nexus'

const LOGO_SRC = '/power-trade-nexus-logo.png'

/** Square logo display sizes (source asset is 800×800). */
const VARIANTS = {
  sidebar: { size: 80, src: LOGO_SRC },
  auth: { size: 160, src: LOGO_SRC },
  login: { size: 120, src: LOGO_SRC },
  portal: { size: 240, src: LOGO_SRC },
  compact: { size: 160, src: LOGO_SRC },
}

export function BrandLogo({ variant = 'auth', subtitle, align = 'center', style, className = '' }) {
  const { size, src } = VARIANTS[variant] || VARIANTS.auth

  return (
    <div
      className={`brand-logo-wrap brand-logo-wrap--${variant} ${className}`.trim()}
      style={{ textAlign: align, ...style }}
    >
      <img
        src={src}
        alt={BRAND_NAME}
        className="brand-logo-img"
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          maxWidth: '100%',
          objectFit: 'contain',
          display: 'block',
          marginLeft: align === 'center' ? 'auto' : 0,
          marginRight: align === 'center' ? 'auto' : undefined,
        }}
      />
      {subtitle && (
        <div className="brand-logo-subtitle" style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 14, lineHeight: 1.55 }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}
