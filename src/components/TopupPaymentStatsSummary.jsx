import { Link } from 'react-router-dom'
import { Card, Badge } from './ui/index.jsx'
import { fmt } from '../api/index.js'
import { paymentTypeLabel } from '../utils/paymentTypes.js'

function formatPlanTopupWhen(v) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function paymentStatusBadgeType(st) {
  if (st === 'approved') return 'approved'
  if (st === 'admin_manual') return 'purple'
  if (st === 'rejected') return 'rejected'
  return 'pending'
}

function retopupStatusLabel(st) {
  if (st === 'admin_manual') return 'ADMIN MANUAL'
  return String(st || 'pending').toUpperCase()
}

/**
 * Ordered list: TOP-UP #1, #2, #3… with amount + date/time (payments table).
 */
export function PlanTopupHistoryList({ rows, maxHeight = 320, emptyHint }) {
  if (!rows?.length) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '12px 8px', textAlign: 'center', lineHeight: 1.55 }}>
        {emptyHint ||
          'No plan TOP-UP receipt records yet — after you submit payment, #1, #2… and date/time will appear here'}
      </div>
    )
  }
  return (
    <div
      style={{
        maxHeight,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingRight: 4,
      }}
    >
      {rows.map((row) => (
        <div
          key={row.id}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--bg-card2)',
            border: '1px solid var(--border-sm)',
            opacity: row.status === 'rejected' ? 0.75 : 1,
          }}
        >
          <div className="flex-between" style={{ alignItems: 'flex-start', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, fontSize: 15, color: 'var(--purple)' }}>
              {row.seq != null ? `TOP-UP #${row.seq}` : 'TOP-UP (submitted)'}
            </span>
            <Badge type={paymentStatusBadgeType(row.status)}>{retopupStatusLabel(row.status)}</Badge>
          </div>
          {row.slot_index != null ? (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
              Unlocks slot <strong style={{ color: 'var(--gold)' }}>{row.slot_index}</strong>
              {row.cycle_level != null ? ` · cycle ${row.cycle_level}` : ''}
            </div>
          ) : null}
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, fontSize: 16, color: 'var(--cyan)', marginBottom: 6 }}>
            {fmt.usd2(row.amount)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>When: </span>
            {formatPlanTopupWhen(row.created_at)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
            🔐 {paymentTypeLabel(row.payment_type)}
            {row.transaction_id ? (
              <span style={{ display: 'block', marginTop: 4, wordBreak: 'break-all', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
                Ref / UTR: {row.transaction_id}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Member dashboard / plan TOP-UP — totals from API `topup_payment_stats`. */
export function TopupPaymentStatsSummary({
  stats,
  compact,
  roiSidePanel,
  ladderCap,
  showPlanTopupCta = true,
  planTopupHistory = [],
}) {
  if (!stats) return null
  const ladder = stats.plan_topup_ladder_level ?? 0
  const p = stats.plan_topup || {}
  const tw = stats.trading_wallet_funding || {}

  /** Trade Income: side column — numbered TOP-UPs + date/time. */
  if (roiSidePanel) {
    const cap = ladderCap != null && Number.isFinite(Number(ladderCap)) ? Number(ladderCap) : null
    return (
      <Card title="Plan TOP-UP — #1, 2, 3…">
        <div
          className="flex-between"
          style={{
            flexWrap: 'wrap',
            gap: 8,
            paddingBottom: 12,
            marginBottom: 12,
            borderBottom: '1px solid var(--border-sm)',
            fontSize: 13,
            color: 'var(--text-2)',
          }}
        >
          <span style={{ fontWeight: 500 }}>Current ladder level</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, color: 'var(--purple)', fontSize: 18 }}>
            {ladder}
            {cap != null ? <span style={{ color: 'var(--text-3)', fontWeight: 500 }}> / {cap}</span> : null}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.45 }}>
          Each entry below shows the payment submit/record <strong>date-time</strong> (1 = first TOP-UP). Manual admin TOP-UPs are not listed here.
        </div>
        <PlanTopupHistoryList rows={planTopupHistory} maxHeight={380} />
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--border-sm)',
            fontSize: 12,
            color: 'var(--text-3)',
            display: 'grid',
            gap: 6,
          }}
        >
          <div className="flex-between" style={{ flexWrap: 'wrap', gap: 6 }}>
            <span>Approve total (payments)</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, color: 'var(--cyan)' }}>
              {p.approved_count ?? 0}× · {fmt.usd2(p.approved_total_usd ?? 0)}
            </span>
          </div>
          {(p.pending_count ?? 0) > 0 ? (
            <div className="flex-between" style={{ flexWrap: 'wrap', gap: 6 }}>
              <span>Pending</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, color: 'var(--gold)' }}>
                {p.pending_count} · {fmt.usd2(p.pending_total_usd ?? 0)}
              </span>
            </div>
          ) : null}
        </div>
        {showPlanTopupCta ? (
          <Link
            to="/member/plan-topup"
            style={{
              display: 'block',
              textAlign: 'center',
              marginTop: 14,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(168,85,247,0.15)',
              border: '1px solid rgba(168,85,247,0.35)',
              color: 'var(--purple)',
              fontWeight: 500,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Submit new plan TOP-UP →
          </Link>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0 4px' }}>
            Ladder max — no further payment steps
          </div>
        )}
      </Card>
    )
  }

  const inner = (
    <div style={{ display: 'grid', gap: compact ? 8 : 12, fontSize: compact ? 12 : 13, color: 'var(--text-2)', lineHeight: 1.55 }}>
      <div className="flex-between" style={{ paddingBottom: 8, borderBottom: '1px solid var(--border-sm)', flexWrap: 'wrap', gap: 8 }}>
        <span>
          <strong style={{ color: 'var(--text-1)' }}>Trade plan TOP-UP level</strong> (ladder count)
        </span>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, color: 'var(--purple)' }}>{ladder}</span>
      </div>
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span>Plan TOP-UP — approved payments (count / total $)</span>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, color: 'var(--cyan)', textAlign: 'right' }}>
          {p.approved_count ?? 0} payment(s) · total {fmt.usd2(p.approved_total_usd ?? 0)}
        </span>
      </div>
      {(p.pending_count ?? 0) > 0 ? (
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span>Plan TOP-UP — pending (admin wait)</span>
          <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, color: 'var(--gold)', textAlign: 'right' }}>
            {p.pending_count} · {fmt.usd2(p.pending_total_usd ?? 0)}
          </span>
        </div>
      ) : null}
      <div className="flex-between" style={{ paddingTop: 4, borderTop: '1px solid var(--border-sm)', flexWrap: 'wrap', gap: 8 }}>
        <span>Trading wallet add — approved (payments)</span>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, color: 'var(--green)', textAlign: 'right' }}>
          {tw.approved_count ?? 0}× · total {fmt.usd2(tw.approved_total_usd ?? 0)}
        </span>
      </div>
      {(tw.pending_count ?? 0) > 0 ? (
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span>Trading wallet add — pending (admin wait)</span>
          <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, color: 'var(--gold)', textAlign: 'right' }}>
            {tw.pending_count} · {fmt.usd2(tw.pending_total_usd ?? 0)}
          </span>
        </div>
      ) : null}
      {!compact ? (
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
          Note: ladder count may increase from manual admin TOP-UPs — payment count is shown separately.
        </div>
      ) : null}
    </div>
  )

  if (compact) return <div style={{ marginBottom: 16 }}>{inner}</div>

  return (
    <Card title="Your TOP-UP overview">
      {inner}
    </Card>
  )
}
