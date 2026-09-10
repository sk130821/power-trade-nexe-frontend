// ═══════════════════════════════════════════
//  components/ui/index.jsx
//  All reusable UI primitives
// ═══════════════════════════════════════════

import { INCOME_META, PACKAGES } from '../../api/index.js'

// ── Spinner ──────────────────────────────
export function Spinner({ size = 'md', className = '' }) {
  const cls = size === 'sm' ? 'spinner spinner-sm' : 'spinner'
  return (
    <div className={size === 'md' ? `spinner-wrap ${className}` : className}>
      <div className={cls} />
    </div>
  )
}

// ── Alert ────────────────────────────────
const ALERT_ICONS = { danger: '⚠', success: '✓', warning: '⚡', info: 'ℹ' }
export function Alert({ type = 'info', children, onClose, className = '' }) {
  return (
    <div className={`alert alert-${type} ${className}`}>
      <span className="alert-icon">{ALERT_ICONS[type]}</span>
      <div style={{ flex: 1 }}>{children}</div>
      {onClose && (
        <button onClick={onClose} style={{ background:'none',border:'none',color:'inherit',cursor:'pointer',opacity:0.6,fontSize:16 }}>✕</button>
      )}
    </div>
  )
}

// ── Badge ────────────────────────────────
export function Badge({ type, children }) {
  return <span className={`badge badge-${type}`}>{children}</span>
}

// ── Button ───────────────────────────────
export function Btn({ variant='primary', size='', full=false, loading=false, icon, children, className='', ...props }) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size  && `btn-${size}`,
    full  && 'btn-full',
    className
  ].filter(Boolean).join(' ')

  return (
    <button className={cls} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="spinner spinner-sm" /> : icon && <span>{icon}</span>}
      {children}
    </button>
  )
}

// ── Card ─────────────────────────────────
export function Card({ title, action, children, className = '', noPad = false }) {
  return (
    <div className={`card${noPad ? ' card--flush' : ''} ${className}`.trim()}>
      {title && (
        <div className="card-header">
          <span className="card-title">{title}</span>
          {action}
        </div>
      )}
      {noPad ? <div className="card-body-flush">{children}</div> : children}
    </div>
  )
}

// ── Stat Card ────────────────────────────
export function StatCard({ icon, label, value, sub, color = 'cyan', className = '' }) {
  return (
    <div className={`stat-card ${color} ${className}`}>
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

// ── Wallet Card ──────────────────────────
export function WalletCard({ icon, label, balance, desc, color }) {
  return (
    <div className="wallet-card" style={{ borderTop: `2px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18, opacity: 0.9 }}>{icon}</span>
        <span className="wallet-label">{label}</span>
      </div>
      <div className="wallet-balance" style={{ color }}>{balance}</div>
      {desc && <div className="wallet-sub">{desc}</div>}
    </div>
  )
}

// ── Modal ────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth = 520 }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        {title && <div className="modal-title">{title}</div>}
        {children}
      </div>
    </div>
  )
}

// ── Table ────────────────────────────────
export function Table({ cols, rows, loading, emptyText = 'No data found', emptyIcon = '📭' }) {
  if (loading) return <Spinner />
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{cols.map(c => <th key={c.key || c.label} className={c.cellClass || undefined}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows?.length
            ? rows.map((row, i) => (
                <tr key={row.id || i}>
                  {cols.map(c => (
                    <td key={c.key || c.label} className={c.cellClass || undefined}>
                      {c.render ? c.render(row[c.key], row) : row[c.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            : (
              <tr>
                <td colSpan={cols.length}>
                  <div className="empty-state">
                    <div className="empty-icon">{emptyIcon}</div>
                    <div className="empty-title">{emptyText}</div>
                  </div>
                </td>
              </tr>
            )
          }
        </tbody>
      </table>
    </div>
  )
}

// ── FormGroup ────────────────────────────
export function FormGroup({ label, hint, children, required }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && ' *'}</label>
      {children}
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  )
}

// ── Input ────────────────────────────────
export function Input({ className = '', ...props }) {
  return <input className={`form-control ${className}`} {...props} />
}

// ── Select ───────────────────────────────
export function Select({ options = [], placeholder, className = '', ...props }) {
  return (
    <select className={`form-control ${className}`} {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ── Textarea ─────────────────────────────
export function Textarea({ className = '', ...props }) {
  return <textarea className={`form-control ${className}`} {...props} />
}

// ── Tabs ─────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tab-bar">
      {tabs.map(t => (
        <button
          key={t.key}
          className={`tab-item ${active === t.key ? 'active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.icon && <span>{t.icon}</span>}
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Divider ──────────────────────────────
export function Divider({ className = '' }) {
  return <div className={`divider ${className}`} />
}

// ── Empty State ──────────────────────────
export function Empty({ icon = '📭', title, desc, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {desc  && <div className="empty-desc">{desc}</div>}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}

// ── Section Title ────────────────────────
export function SectionTitle({ children, action }) {
  return (
    <div className="flex-between section-title" style={{ marginBottom: 'var(--sp-4)' }}>
      <div>{children}</div>
      {action}
    </div>
  )
}

// ── TxnBadge (income type) ───────────────
export function IncomeBadge({ type }) {
  const m = INCOME_META[type] || { label: type, badgeClass: '', icon: '•' }
  return <span className={`badge ${m.badgeClass}`}>{m.icon} {m.label}</span>
}

// ── Package Selector ─────────────────────
export function PackageSelector({ value, onChange }) {
  return (
    <div className="grid-pkgs">
      {PACKAGES.map(pkg => (
        <div
          key={pkg.amount}
          className={`pkg-card ${value == pkg.amount ? 'selected' : ''}`}
          onClick={() => onChange(pkg.amount)}
        >
          <div className="pkg-amount">${pkg.amount}</div>
          <div className="pkg-roi">{pkg.roi}% daily</div>
          <div className="pkg-label">{pkg.label}</div>
        </div>
      ))}
    </div>
  )
}
