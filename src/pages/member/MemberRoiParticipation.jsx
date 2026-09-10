import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { memberAPI, fmt } from '../../api/index.js'
import { MemberLayout } from '../../components/layout/index.jsx'
import { Alert, Btn, Card, Spinner, Table } from '../../components/ui/index.jsx'
import { NonWorking2xWindowPanel } from '../../components/NonWorking2xWindowPanel.jsx'
import { ExchangeRoiLivePanel } from '../../components/ExchangeRoiLivePanel.jsx'

function istDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const pick = (type) => parts.find((p) => p.type === type)?.value || '01'
  return { year: Number(pick('year')), month: Number(pick('month')) }
}

function buildFallbackMonths(count = 12) {
  const out = []
  const { year: startY, month: startM } = istDateParts()
  let y = startY
  let m = startM
  for (let i = 0; i < count; i++) {
    const value = `${y}-${String(m).padStart(2, '0')}`
    const label = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    out.push({ value, label, is_current: i === 0 })
    m -= 1
    if (m < 1) {
      m = 12
      y -= 1
    }
  }
  return out
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-card2)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-sm)' }}>
      <div style={{ fontSize: 24, fontWeight: 600, color, fontFamily: 'JetBrains Mono,monospace' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.4 }}>{label}</div>
    </div>
  )
}

function ParticipationCalendar({ calendar, premiumSlots }) {
  if (!calendar?.length) return <div style={{ fontSize: 13, color: 'var(--text-3)' }}>No data for this month.</div>

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, fontSize: 10, color: 'var(--text-3)' }}>
        <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--green-dim)', color: 'var(--green)' }}>✓ Bought day</span>
        <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(0,229,255,0.12)', color: 'var(--cyan)' }}>$ Trade paid</span>
        <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(0,255,136,0.12)', color: 'var(--green)' }}>● Live</span>
        <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--red-dim)', color: 'var(--red)' }}>✕ Lapsed</span>
        <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(249,115,22,0.15)', color: 'var(--orange)' }}>½ Unused slot</span>
        <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(100,100,100,0.15)' }}>— Weekend</span>
        <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--bg-card2)', border: '1px solid var(--border-sm)' }}>· No session</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
        {calendar.map((d) => {
          let bg = 'var(--bg-card2)';
          let border = '1px solid var(--border-sm)';
          let status = '·';
          let statusColor = 'var(--text-3)';
          if (d.is_weekend) {
            bg = 'rgba(100,100,100,0.12)';
            status = '—';
          } else if (d.roi_live) {
            bg = 'rgba(0,255,136,0.12)';
            border = '1px solid rgba(0,255,136,0.35)';
            status = '●';
            statusColor = 'var(--green)';
          } else if (d.lapsed) {
            bg = 'var(--red-dim)';
            border = '1px solid rgba(255,64,96,0.25)';
            status = '✕';
            statusColor = 'var(--red)';
          } else if (d.partial_lapsed) {
            bg = 'rgba(249,115,22,0.15)';
            border = '1px solid rgba(249,115,22,0.35)';
            status = '½';
            statusColor = 'var(--orange)';
          } else if (d.join_count > 0 || d.had_roi_income) {
            bg = d.had_roi_income && !d.join_count ? 'rgba(0,229,255,0.1)' : 'var(--green-dim)';
            border = d.had_roi_income && !d.join_count ? '1px solid rgba(0,229,255,0.25)' : '1px solid rgba(34,197,94,0.25)';
            status = d.had_roi_income && !d.join_count ? '$' : '✓';
            statusColor = d.had_roi_income && !d.join_count ? 'var(--cyan)' : 'var(--green)';
          }
          const titleParts = [d.weekday]
          if (d.roi_live) titleParts.push('Live now')
          if (d.joined_slots?.length) titleParts.push(`Buy slots: ${d.joined_slots.join(', ')}`)
          if (d.missed_slots?.length) titleParts.push(`Lapsed slots: ${d.missed_slots.join(', ')}`)
          if (d.lapsed_amount > 0) titleParts.push(`Lapsed: ${fmt.usd2(d.lapsed_amount)}`)
          if (d.had_roi_income) titleParts.push(`Trade: ${fmt.usd2(d.roi_amount || 0)}`)
          return (
            <div
              key={d.date}
              style={{ padding: '10px 8px', borderRadius: 10, textAlign: 'center', background: bg, border }}
              title={titleParts.join(' · ')}
            >
              <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{d.weekday}</div>
              <div style={{ fontSize: 16, fontWeight: 600, margin: '4px 0' }}>{d.date.slice(8)}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: statusColor }}>{status}</div>
              {(d.join_count > 0 || d.had_roi_income) && (
                <div style={{ fontSize: 9, color: 'var(--cyan)', marginTop: 4, fontFamily: 'JetBrains Mono,monospace' }}>
                  {d.join_count > 0 ? `${d.join_count} buy${d.join_count > 1 ? 's' : ''}` : null}
                  {d.had_roi_income ? (
                    <div style={{ marginTop: d.join_count > 0 ? 2 : 0, color: 'var(--gold)' }}>{fmt.usd2(d.roi_amount || 0)}</div>
                  ) : null}
                  {premiumSlots && d.joined_slots?.length ? (
                    <div style={{ marginTop: 2 }}>S{d.joined_slots.join(',')}</div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MemberRoiParticipation() {
  const fallbackMonths = useMemo(() => buildFallbackMonths(12), [])
  const [month, setMonth] = useState(fallbackMonths[0]?.value || '')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async (m) => {
    setLoading(true)
    setError('')
    try {
      const { data: res } = await memberAPI.getRoiParticipation(m ? { month: m } : {})
      setData(res)
      if (res?.participation?.month) setMonth(res.participation.month)
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (month) load(month)
  }, [month])

  useEffect(() => {
    const onFocus = () => {
      if (month) load(month)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [month])

  const p = data?.participation
  const nonWorking2x = data?.non_working_2x_window
  const apiMonths = data?.available_months || []
  const months = apiMonths.length > 0 ? apiMonths : fallbackMonths
  const premiumSlots = data?.premium_join_slots
  const premiumSlotSharePct = data?.premium_slot_roi_share != null
    ? Math.round(Number(data.premium_slot_roi_share) * 100)
    : premiumSlots?.length
      ? Math.round(100 / premiumSlots.length)
      : 25
  const premiumSlotsLabel = Array.isArray(premiumSlots) ? premiumSlots.join(', ') : '0, 6'
  const pkg = Number(data?.package_amount) || 0

  const dayRows = useMemo(() => {
    if (!p?.calendar) return []
    return [...p.calendar].reverse()
  }, [p?.calendar])

  if (loading && !p) {
    return (
      <MemberLayout>
        <Spinner />
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="page-header" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="page-title">Trade Participation History</div>
          <div className="page-subtitle">
            Shows buy records and Trade income from your transaction history. Weekends are excluded from lapse counts.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="ghost" size="sm" onClick={() => month && load(month)} loading={loading}>
            Refresh
          </Btn>
          <Link to="/member/roi"><Btn variant="ghost" size="sm">← Trade Income</Btn></Link>
        </div>
      </div>

      {error ? <Alert type="danger" className="mb-4">{error}</Alert> : null}

      {nonWorking2x?.applies && (
        <Card className="mb-6" title="2× Trade window (non-working member)">
          <NonWorking2xWindowPanel window={nonWorking2x} />
        </Card>
      )}

      <Card className="mb-6">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label htmlFor="roi-month-select" style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>
            Select month
          </label>
          <select
            id="roi-month-select"
            className="form-control"
            style={{ maxWidth: 240, minWidth: 180 }}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}{m.is_current ? ' (current)' : ''}
              </option>
            ))}
          </select>
          {p?.is_complete_month ? (
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Full month</span>
          ) : p?.range_end ? (
            <span style={{ fontSize: 11, color: 'var(--orange)' }}>Data through {p.range_end}</span>
          ) : null}
        </div>
      </Card>

      {p && (
        <>
          {(p.live_roi_now?.length ?? 0) > 0 && (
            <ExchangeRoiLivePanel
              slots={p.live_roi_now}
              sessionDate={p.range_end}
              anchorPrice={data?.package_amount}
              compact
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
            <StatBox label="Bought days" value={p.days_with_join} color="var(--green)" />
            <StatBox label="Trade income days" value={p.days_with_roi_income ?? 0} color="var(--cyan)" />
            <StatBox label="Days lapsed" value={p.days_lapsed} color="var(--red)" />
            <StatBox label="Unused-slot days" value={p.days_partial_lapsed ?? 0} color="var(--orange)" />
            <StatBox label="Lapsed amount" value={fmt.usd2(p.lapsed_amount ?? 0)} color="var(--red)" />
            <StatBox label="Total buys" value={p.total_joins} color="var(--text-2)" />
            <StatBox label="Trade received" value={fmt.usd2(p.total_roi_amount ?? 0)} color="var(--gold)" />
            <StatBox label="Sessions (Mon–Fri)" value={p.sessions_available} color="var(--text-2)" />
            <StatBox label="Participation %" value={`${p.participation_rate}%`} color="var(--gold)" />
            {data?.premium_plan ? (
              <StatBox label={`Full days (${premiumSlots?.length || 2} slots)`} value={p.days_full_participation} color="var(--purple)" />
            ) : null}
          </div>

          {data?.premium_plan && (
            <Alert type="info" className="mb-4">
              ${pkg} plan: slots <strong>{premiumSlotsLabel}</strong> — {premiumSlotSharePct}% Trade per slot. All {premiumSlots?.length || 2} slots = 100% daily trade income. If you buy only one slot, the unused slot&apos;s ROI lapses against your cap.
            </Alert>
          )}

          <Card title={`Calendar — ${p.month_label || p.month}`} className="mb-6">
            <ParticipationCalendar calendar={p.calendar} premiumSlots={premiumSlots} />
          </Card>

          <Card title="Day-by-day detail" noPad>
            <Table
              cols={[
                { key: 'date', label: 'Date', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{v}</span> },
                { key: 'weekday', label: 'Day' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (_, r) => {
                    if (r.is_weekend) return <span style={{ color: 'var(--text-3)' }}>Weekend</span>
                    if (!r.session_exists) return <span style={{ color: 'var(--text-3)' }}>No session</span>
                    if (r.lapsed) return <span style={{ color: 'var(--red)', fontWeight: 600 }}>Lapsed</span>
                    if (r.roi_live) return <span style={{ color: 'var(--green)', fontWeight: 600 }}>● Live</span>
                    if (r.partial_lapsed) {
                      const missed = r.missed_slots?.length ? ` slot ${r.missed_slots.join(', ')}` : ' unused slot'
                      return <span style={{ color: 'var(--orange)', fontWeight: 600 }}>Partial buy —{missed} lapsed</span>
                    }
                    if (r.had_roi_income && r.join_count > 0) return <span style={{ color: 'var(--green)', fontWeight: 600 }}>Buy + Trade</span>
                    if (r.had_roi_income) return <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>Trade paid</span>
                    if (r.full_participation) return <span style={{ color: 'var(--green)', fontWeight: 600 }}>Bought</span>
                    if (r.join_count > 0) return <span style={{ color: 'var(--orange)', fontWeight: 600 }}>Partial buy</span>
                    return '—'
                  },
                },
                {
                  key: 'joined_slots',
                  label: 'Slots bought',
                  render: (v) => (v?.length ? v.join(', ') : '—'),
                },
                { key: 'join_count', label: 'Buys' },
                {
                  key: 'lapsed_amount',
                  label: 'Lapsed',
                  render: (v, r) => (Number(v) > 0
                    ? <span style={{ color: 'var(--red)', fontFamily: 'JetBrains Mono,monospace' }}>{fmt.usd2(v)}{r.missed_slots?.length ? ` (slot ${r.missed_slots.join(', ')})` : ''}</span>
                    : '—'),
                },
                {
                  key: 'roi_amount',
                  label: 'Trade income',
                  render: (v, r) => (r.had_roi_income ? <span style={{ color: 'var(--gold)', fontFamily: 'JetBrains Mono,monospace' }}>{fmt.usd2(v || 0)}</span> : '—'),
                },
              ]}
              rows={dayRows}
              emptyText="No days in range"
              emptyIcon="📅"
            />
          </Card>
        </>
      )}
    </MemberLayout>
  )
}
