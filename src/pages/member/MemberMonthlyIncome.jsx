import { memberAPI, fmt, DAILY_BONUS_BY_PACKAGE } from '../../api/index.js'
import { useApi } from '../../hooks/useApi.js'
import { MemberLayout } from '../../components/layout/index.jsx'
import { Alert, Spinner } from '../../components/ui/index.jsx'

const STATUS_META = {
  active:     { label: 'Active — earning now',     color: 'var(--green)',  bg: 'var(--green-dim)',  border: 'rgba(34,197,94,0.3)',  icon: '✓' },
  achievable: { label: 'Achievable — you can still qualify', color: 'var(--cyan)',   bg: 'var(--cyan-dim)',   border: 'rgba(0,229,255,0.3)',  icon: '◎' },
  achieved:   { label: 'Achieved — completed / upgraded',    color: 'var(--purple)', bg: 'var(--purple-dim)', border: 'rgba(168,85,247,0.3)', icon: '★' },
  expired:    { label: 'Expired — window closed',          color: 'var(--red)',    bg: 'var(--red-dim)',    border: 'rgba(255,64,96,0.3)',  icon: '✕' },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.expired
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
      color: m.color, background: m.bg, border: `1px solid ${m.border}`,
      whiteSpace: 'nowrap',
    }}>
      {m.icon} {m.label}
    </span>
  )
}

function TierRow({ title, subtitle, status, progress, windowInfo, payout }) {
  const m = STATUS_META[status] || STATUS_META.expired
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 10,
      background: m.bg, border: `1px solid ${m.border}`,
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <StatusBadge status={status} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6 }}>
        <div>Progress: <strong style={{ color: m.color }}>{progress}</strong></div>
        {windowInfo && <div>{windowInfo}</div>}
        {payout && <div style={{ color: 'var(--gold)', marginTop: 2 }}>{payout}</div>}
      </div>
    </div>
  )
}

export function MemberMonthlyIncome() {
  const { data, loading } = useApi(() => memberAPI.getDashboard())

  if (loading) return <MemberLayout><Spinner /></MemberLayout>
  if (!data?.monthly_salary) return <MemberLayout><Alert type="danger">Monthly income data not available</Alert></MemberLayout>

  const { monthly_salary: ms } = data
  const directTiers = ms.tier_status?.direct || []

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Monthly Income Status</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
          Direct monthly salary tiers — higher tier replaces lower
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {Object.entries(STATUS_META).map(([key, m]) => (
          <span key={key} style={{ fontSize: 10, color: m.color, padding: '4px 10px', borderRadius: 6, background: m.bg, border: `1px solid ${m.border}` }}>
            {m.icon} {m.label}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>👥 Direct Monthly Salary</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.5 }}>
            Percent of direct team plan volume — not your own plan. Window starts from your join date.
            Higher tier replaces lower (previous stops, new starts). Paid on the same date each month for 3 months to salary wallet.
            Not subject to the 2×/3× income cap.
          </div>
          {ms.progress?.member_since && (
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 12 }}>
              Member since: {fmt.date(ms.progress.member_since)} · Direct team plan: {fmt.usd2(ms.progress.direct_plan_sum ?? 0)}
            </div>
          )}
          {directTiers.map((t) => (
            <TierRow
              key={t.tier}
              title={t.label}
              subtitle={`${t.percent}% of direct team plan · ${t.window_days} day window`}
              status={t.status}
              progress={`${t.current_count} / ${t.min_required} directs · ${fmt.usd2(t.plan_sum ?? 0)} plan`}
              windowInfo={
                t.status === 'achievable'
                  ? `${t.days_left} day(s) left · deadline ${fmt.date(t.window_expires_at)}`
                  : t.status === 'expired'
                    ? `Window ended ${fmt.date(t.window_expires_at)}`
                    : t.next_payout_date
                      ? `Next payout: ${fmt.date(t.next_payout_date)}`
                      : t.entitlement?.expires_at
                        ? `Payout till ${fmt.date(t.entitlement.expires_at)}`
                        : null
              }
              payout={
                t.status === 'active'
                  ? `Currently earning ${t.percent}% monthly (3 payouts max)`
                  : null
              }
            />
          ))}
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gold)', marginBottom: 4 }}>⚡ Daily Growth Income</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 8px' }}>
              Bring <strong>2 direct businesses on the same day between 8 AM – 8 PM India Time (IST)</strong> with the <strong>same package amount</strong> to earn the fixed Daily Growth Income below.
            </p>
            <div style={{ margin: '0 0 8px', fontSize: 11, lineHeight: 1.7 }}>
              {Object.entries(DAILY_BONUS_BY_PACKAGE).map(([pkg, bonus]) => (
                <div key={pkg}>
                  ${pkg} package → <strong>${bonus}</strong> Daily Growth
                </div>
              ))}
            </div>
            <p style={{ margin: 0 }}>
              Example: two $11 directs between 8 AM – 8 PM (India) same day → <strong>$1</strong> Daily Growth Income.
              Mismatched amounts (e.g. $11 + $22) do not qualify. Activation outside 8 AM – 8 PM India Time does not count.
              Credited to exchange wallet when the second direct activates.
            </p>
          </div>
        </div>
      </div>

      {ms.past?.length > 0 && (
        <div style={{ marginTop: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Past Monthly Salary Records</div>
          {ms.past.map((p, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--text-2)', padding: '6px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
              {p.tier_label} · {p.percent_rate}% · {p.status} · {fmt.date(p.started_at)} – {fmt.date(p.expires_at)}
            </div>
          ))}
        </div>
      )}
    </MemberLayout>
  )
}
