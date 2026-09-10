import { Link } from 'react-router-dom'
import { fmt } from '../api/index.js'
import { Alert, Btn } from './ui/index.jsx'

/**
 * Non-working member 2× Trade participation window — join daily or lapse; fixed trading-day period.
 */
export function NonWorking2xWindowPanel({ window: w, compact = false }) {
  if (!w?.applies || w.working) return null

  const pct =
    w.trading_days_allowed > 0
      ? Math.min(100, Math.round((w.trading_days_elapsed / w.trading_days_allowed) * 100))
      : 0

  return (
    <div
      className="non-working-2x-panel"
      style={{
        marginTop: compact ? 0 : 16,
        padding: compact ? 14 : 18,
        borderRadius: 12,
        border: w.window_expired
          ? '1px solid rgba(255,64,96,0.35)'
          : '1px solid rgba(251,191,36,0.35)',
        background: w.window_expired ? 'var(--red-dim)' : 'rgba(251,191,36,0.08)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: compact ? 14 : 15, color: 'var(--text-1)' }}>
            2× Trade participation window
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>
            Buy trade each trading day (Mon–Fri) — missed days and unused slots lapse and count against your 2× cap. After the window ends you cannot buy; you keep Trade only for days you bought.
          </div>
        </div>
        {w.window_expired ? (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)' }}>Window ended</span>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)' }}>
            {w.trading_days_remaining} trading day{w.trading_days_remaining === 1 ? '' : 's'} left
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 12,
          color: 'var(--text-2)',
          marginBottom: 14,
          padding: '10px 12px',
          background: 'var(--bg-card2)',
          borderRadius: 8,
          lineHeight: 1.55,
        }}
      >
        <strong>Calculation:</strong> {w.calculation_summary}
        <br />
        <span style={{ color: 'var(--text-3)' }}>{w.daily_roi_formula}</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        {[
          { label: 'Trading days allowed', value: w.trading_days_allowed, color: 'var(--gold)' },
          { label: 'Days elapsed', value: w.trading_days_elapsed, color: 'var(--text-2)' },
          { label: 'Days bought', value: w.days_joined_in_window, color: 'var(--green)' },
          { label: 'Days lapsed', value: w.days_lapsed_in_window, color: 'var(--red)' },
          { label: 'Unused-slot days', value: w.days_partial_lapsed_in_window ?? 0, color: 'var(--orange)' },
          { label: 'Lapsed amount', value: fmt.usd2(w.lapsed_roi_amount ?? 0), color: 'var(--red)' },
          { label: 'Trade earned', value: fmt.usd2(w.roi_earned_in_window ?? 0), color: 'var(--cyan)' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: '10px 12px',
              background: 'var(--bg-card)',
              borderRadius: 8,
              border: '1px solid var(--border-sm)',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 600, color: s.color, fontSize: 15 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
        Window: <span className="mono">{w.window_start_date}</span> → <span className="mono">{w.window_end_date}</span> (IST, Mon–Fri only)
      </div>

      {w.trading_days_allowed > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: 'var(--bg-card2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: w.window_expired
                  ? 'var(--red)'
                  : 'linear-gradient(90deg, var(--gold), var(--cyan))',
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      )}

      {w.window_expired && (
        <Alert type="warning" style={{ marginBottom: 0, fontSize: 12 }}>
          Participation period finished on <strong>{w.window_end_date}</strong>. No more Trade buys for this cycle — total earned:{' '}
          <strong>{fmt.usd2(w.roi_earned_in_window ?? 0)}</strong>. Use <strong>Plan TOP-UP</strong> for a new 2× window.
        </Alert>
      )}

      {!compact && (
        <div style={{ marginTop: 12 }}>
          <Link to="/member/roi-history">
            <Btn variant="ghost" size="sm">
              View buy / lapse history →
            </Btn>
          </Link>
        </div>
      )}
    </div>
  )
}
