import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { memberAPI, INCOME_META, WALLET_META, PACKAGES, fmt, getRoiPercent, getDailyBonusAmount } from '../../api/index.js'
import { useApi } from '../../hooks/useApi.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { isMemberActive } from '../../components/MemberActivationBanner.jsx'
import { MemberLayout } from '../../components/layout/index.jsx'
import { TopupPaymentStatsSummary } from '../../components/TopupPaymentStatsSummary.jsx'
import { NonWorking2xWindowPanel } from '../../components/NonWorking2xWindowPanel.jsx'
import { referralRegisterUrl } from '../../config/site.js'
import {
  Card,
  Table,
  Badge,
  Btn,
  Alert,
  Spinner,
  SectionTitle,
  IncomeBadge,
} from '../../components/ui/index.jsx'

const CHART_COLORS = ['#00e5ff', '#22c55e', '#a855f7', '#ffcc00', '#ff8c00', '#ef4444', '#38bdf8', '#f472b6']

function fillTrendDays(rows) {
  const map = new Map()
  for (const r of rows || []) {
    const key = String(r.day).slice(0, 10)
    map.set(key, Number(r.amount) || 0)
  }
  const out = []
  let cumulative = 0
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const daily = map.get(key) || 0
    cumulative += daily
    out.push({
      date: key,
      label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      daily,
      cumulative,
    })
  }
  return out
}

function ChartTooltip({ active, payload, label, mode = 'daily' }) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value ?? 0
  return (
    <div className="trading-chart-tooltip">
      <div className="trading-chart-tooltip-label">{label}</div>
      <div className="trading-chart-tooltip-value">
        {mode === 'cumulative' ? 'Total' : 'Daily'}: {fmt.usd2(v)}
      </div>
    </div>
  )
}

function planLabel(amount) {
  const pkg = PACKAGES.find((p) => p.amount === Number(amount))
  return pkg ? pkg.label : 'Plan'
}

function IncomeCapHighlight({ member, income_cap, non_working_2x_window }) {
  if (!income_cap) return null

  const mult = income_cap.multiplier
  const pct =
    income_cap.cap_limit > 0
      ? Math.min(100, Math.round((income_cap.earned_in_cycle / income_cap.cap_limit) * 100))
      : 0
  const planName = planLabel(member.package_amount)
  const openCycles = (income_cap.cycles || []).filter((c) => !c.cap_closed)
  const activeCycle = openCycles[0] || income_cap.cycles?.[income_cap.cycles.length - 1]

  return (
    <div className={`trading-cap-highlight mb-8${income_cap.capped_out ? ' capped-out' : ''}`}>
      <div className="trading-cap-highlight-head">
        <div>
          <div className="trading-cap-highlight-badge">INCOME CAP LIMIT</div>
          <div className="trading-cap-highlight-title">
            {planName} Plan · <span className="mono gold">${Number(member.package_amount).toLocaleString()}</span>
          </div>
          <div className="trading-cap-highlight-sub">
            Trade, direct, level, salary, reward & daily growth count toward cap — live trades do <strong>not</strong>.
            Missed Trade days and unused slots (lapsed) also reduce your remaining cap.
          </div>
        </div>
        <div className={`trading-cap-mult-pill${income_cap.working ? ' working' : ''}`}>
          {income_cap.working ? 'Working 3×' : 'Non-working 2×'}
        </div>
      </div>

      <div className="trading-cap-formula">
        <div className="trading-cap-formula-box">
          <span className="trading-cap-formula-label">Total investment</span>
          <span className="trading-cap-formula-value mono">{fmt.usd2(income_cap.total_investment ?? income_cap.cap_base)}</span>
        </div>
        <span className="trading-cap-formula-op">×</span>
        <div className="trading-cap-formula-box accent">
          <span className="trading-cap-formula-label">{mult}× cap</span>
          <span className="trading-cap-formula-value mono gold">{mult}×</span>
        </div>
        <span className="trading-cap-formula-op">=</span>
        <div className="trading-cap-formula-box total">
          <span className="trading-cap-formula-label">Total income limit</span>
          <span className="trading-cap-formula-value mono gold">{fmt.usd2(income_cap.cap_limit)}</span>
        </div>
      </div>

      <div className="trading-cap-stats-row">
        <div className="trading-cap-stat earned">
          <span className="trading-cap-stat-label">Credited</span>
          <span className="trading-cap-stat-value mono cyan">{fmt.usd2(income_cap.credited_in_cycle ?? income_cap.earned_in_cycle)}</span>
        </div>
        {(income_cap.lapsed_amount ?? 0) > 0 && (
          <div className="trading-cap-stat earned">
            <span className="trading-cap-stat-label">Lapsed Trade</span>
            <span className="trading-cap-stat-value mono red">{fmt.usd2(income_cap.lapsed_amount)}</span>
            <span className="trading-cap-stat-label" style={{ fontSize: 10, marginTop: 2 }}>
              {income_cap.days_lapsed ?? 0} missed day{(income_cap.days_lapsed ?? 0) === 1 ? '' : 's'}
            </span>
          </div>
        )}
        {(income_cap.unused_slot_lapsed_amount ?? 0) > 0 && (
          <div className="trading-cap-stat earned">
            <span className="trading-cap-stat-label">Unused slot lapse</span>
            <span className="trading-cap-stat-value mono" style={{ color: 'var(--orange)' }}>
              {fmt.usd2(income_cap.unused_slot_lapsed_amount)}
            </span>
            <span className="trading-cap-stat-label" style={{ fontSize: 10, marginTop: 2 }}>
              {income_cap.days_partial_lapsed ?? 0} day{(income_cap.days_partial_lapsed ?? 0) === 1 ? '' : 's'} · 1 of 2 slots not bought
            </span>
          </div>
        )}
        <div className="trading-cap-stat earned">
          <span className="trading-cap-stat-label">Total used</span>
          <span className="trading-cap-stat-value mono cyan">{fmt.usd2(income_cap.earned_in_cycle)}</span>
        </div>
        <div className="trading-cap-stat remaining">
          <span className="trading-cap-stat-label">Remaining</span>
          <span className={`trading-cap-stat-value mono ${income_cap.capped_out ? 'red' : 'green'}`}>
            {income_cap.capped_out ? 'Cap used' : fmt.usd2(income_cap.remaining)}
          </span>
        </div>
        <div className="trading-cap-stat progress-stat">
          <span className="trading-cap-stat-label">Used</span>
          <span className="trading-cap-stat-value mono">{pct}%</span>
        </div>
      </div>

      {income_cap.cap_limit > 0 && (
        <div className="trading-cap-progress-wrap">
          <div className="trading-cap-progress-track">
            <div
              className="trading-cap-progress-fill"
              style={{
                width: `${pct}%`,
                background: income_cap.capped_out
                  ? 'linear-gradient(90deg, var(--red), #f87171)'
                  : 'linear-gradient(90deg, var(--gold), var(--cyan))',
              }}
            />
          </div>
        </div>
      )}

      {activeCycle && (
        <div className="trading-cap-active-cycle">
          <span className="trading-cap-active-label">Active cycle:</span>
          <strong>{activeCycle.label}</strong>
          <span className="mono" style={{ color: 'var(--text-3)', fontSize: 12 }}>
            {fmt.usd2(activeCycle.cap_base)} × {mult} = {fmt.usd2(activeCycle.cap_limit)}
            {' · '}earned {fmt.usd2(activeCycle.earned_in_cycle)}
            {!activeCycle.cap_closed && <> · left <span className="mono green">{fmt.usd2(activeCycle.remaining)}</span></>}
          </span>
        </div>
      )}

      {(income_cap.cycles?.length ?? 0) > 1 && (
        <details className="trading-cap-cycles-details">
          <summary>All plan / retopup cycles ({income_cap.cycles.length})</summary>
          <div className="trading-cap-cycles-list">
            {income_cap.cycles.map((c) => (
              <div key={c.cycle_level} className={`trading-cap-cycle-row${c.cap_closed ? ' closed' : ''}`}>
                <span className="trading-cap-cycle-name">{c.label}</span>
                <span className="mono trading-cap-cycle-math">
                  {fmt.usd2(c.cap_base)} × {mult} = {fmt.usd2(c.cap_limit)}
                </span>
                <span className="mono trading-cap-cycle-earned">{fmt.usd2(c.earned_in_cycle)} credited</span>
                {(c.lapsed_in_cycle ?? 0) > 0 && (
                  <span className="mono trading-cap-cycle-earned" style={{ color: 'var(--red)' }}>
                    {fmt.usd2(c.lapsed_in_cycle)} lapsed
                  </span>
                )}
                <span className={`mono ${c.cap_closed ? 'red' : 'green'}`}>
                  {c.cap_closed ? 'Closed' : `${fmt.usd2(c.remaining)} left`}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {!income_cap.working && (
        <NonWorking2xWindowPanel window={non_working_2x_window} compact />
      )}

      {!income_cap.working && (
        <div className="trading-cap-tip">
          Activate <strong>one direct member</strong> to unlock <strong>3×</strong> instead of 2×.
        </div>
      )}

      {income_cap.capped_out && (
        <Alert type="warning" className="mt-3">
          Income cap fully used. New <strong>Plan TOP-UP</strong> starts a fresh {mult}× limit.
        </Alert>
      )}
    </div>
  )
}

function LiveTradeWinCard({ wins = [] }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ptn_live_win_dismissed') || '[]')
    } catch {
      return []
    }
  })

  const visible = (wins || []).filter((w) => !dismissed.includes(Number(w.day_trade_id || w.id)))
  if (!visible.length) return null

  const totalPayout = visible.reduce((s, w) => s + Number(w.result_amount || 0), 0)
  const totalInvested = visible.reduce((s, w) => s + Number(w.invest_amount || 0), 0)
  const profit = parseFloat((totalPayout - totalInvested).toFixed(4))
  const names = visible.map((w) => w.trade_name || `Trade #${w.day_trade_id}`)
  const headline = names.length === 1
    ? names[0]
    : names.length === 2
      ? `${names[0]} & ${names[1]}`
      : `${names[0]} + ${names.length - 1} more`

  const dismiss = () => {
    const ids = [...new Set([...dismissed, ...visible.map((w) => Number(w.day_trade_id || w.id))])]
    setDismissed(ids)
    try {
      localStorage.setItem('ptn_live_win_dismissed', JSON.stringify(ids))
    } catch { /* ignore */ }
  }

  return (
    <div className="live-trade-win-card mb-8">
      <button type="button" className="live-trade-win-card-close" onClick={dismiss} aria-label="Dismiss">×</button>
      <div className="live-trade-win-card-badge">TODAY’S WINNER</div>
      <div className="live-trade-win-card-title">Congratulations!</div>
      <p className="live-trade-win-card-sub">
        {visible.length === 1 ? (
          <>
            Your trade <strong>{headline}</strong> is today’s winner.
            {' '}2× payout of <strong className="mono" style={{ color: 'var(--gold)' }}>{fmt.usd2(totalPayout)}</strong> is credited to your Trading wallet.
          </>
        ) : (
          <>
            These are today’s winning trades. 2× payout of{' '}
            <strong className="mono" style={{ color: 'var(--gold)' }}>{fmt.usd2(totalPayout)}</strong> is credited to your Trading wallet.
          </>
        )}
      </p>
      {visible.length > 1 && (
        <div className="live-trade-win-card-list">
          {visible.map((w) => (
            <div key={w.day_trade_id || w.id} className="live-trade-win-card-row">
              <span className="live-trade-win-card-name">{w.trade_name || `Trade #${w.day_trade_id}`}</span>
              <span className="mono" style={{ color: 'var(--gold)', fontWeight: 700 }}>{fmt.usd2(w.result_amount)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="live-trade-win-card-total">
        <span>Profit credited</span>
        <strong className="mono">{fmt.usd2(profit)}</strong>
      </div>
      <Link to="/member/day-trades" className="live-trade-win-card-link">View Live Trades →</Link>
    </div>
  )
}

function DailyGrowthIncomeCard({ member, daily_growth_income }) {
  const total = Number(daily_growth_income?.total ?? member?.total_daily_bonus_income) || 0
  const today = Number(daily_growth_income?.today) || 0
  const pairAmount = getDailyBonusAmount(member?.package_amount)

  return (
    <div className="trading-growth-strip mb-8">
      <div className="trading-growth-strip-head">
        <div>
          <div className="trading-growth-strip-badge">DAILY GROWTH INCOME</div>
          <div className="trading-growth-strip-title">⚡ Daily Growth Income</div>
          <div className="trading-growth-strip-sub">
            Bring 2 same-package directs between <strong>8 AM – 8 PM IST</strong> to earn a fixed credit in Exchange wallet.
            {pairAmount != null ? (
              <>
                {' '}Your ${Number(member.package_amount)} package pays <strong>${pairAmount}</strong> per matched pair.
              </>
            ) : null}
          </div>
        </div>
        <Link to="/member/monthly-income" className="trading-growth-strip-link">How it works →</Link>
      </div>
      <div className="trading-growth-strip-stats">
        <div className="trading-growth-stat">
          <span className="trading-growth-stat-label">Today</span>
          <span className="trading-growth-stat-value mono gold">{fmt.usd2(today)}</span>
        </div>
        <div className="trading-growth-stat">
          <span className="trading-growth-stat-label">Total earned</span>
          <span className="trading-growth-stat-value mono gold">{fmt.usd2(total)}</span>
        </div>
        <div className="trading-growth-stat">
          <span className="trading-growth-stat-label">Wallet</span>
          <span className="trading-growth-stat-value">Exchange</span>
        </div>
      </div>
    </div>
  )
}

function TradingPanel({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`trading-panel ${className}`.trim()}>
      <div className="trading-panel-head">
        <div>
          <div className="trading-panel-title">{title}</div>
          {subtitle ? <div className="trading-panel-sub">{subtitle}</div> : null}
        </div>
        {action}
      </div>
      <div className="trading-panel-body">{children}</div>
    </div>
  )
}

export function MemberDashboard() {
  const { data, loading } = useApi(() => memberAPI.getDashboard())
  const { updateUser } = useAuth()
  const [tab, setTab] = useState('all')
  const [chartMode, setChartMode] = useState('cumulative')
  const [copyHint, setCopyHint] = useState(null)
  const referralCode = data?.member?.referral_code
  const inviteRegisterUrl = useMemo(
    () => referralRegisterUrl(referralCode),
    [referralCode],
  )

  const copyInviteLink = async () => {
    if (!inviteRegisterUrl) return
    try {
      await navigator.clipboard.writeText(inviteRegisterUrl)
      setCopyHint('success')
      setTimeout(() => setCopyHint(null), 2800)
    } catch {
      setCopyHint('fail')
      setTimeout(() => setCopyHint(null), 4000)
    }
  }

  const shareWhatsApp = () => {
    if (!inviteRegisterUrl) return
    const msg = encodeURIComponent(
      `Join Power Trade Nexus — register with this link (sponsor code auto-filled): ${inviteRegisterUrl}`,
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer')
  }

  const chartData = useMemo(() => fillTrendDays(data?.income_trend), [data?.income_trend])

  useEffect(() => {
    if (data?.member?.status) {
      updateUser({ status: data.member.status, member_status: data.member.status })
    }
  }, [data?.member?.status, updateUser])

  const incomePie = useMemo(() => {
    return (data?.incomeByType || [])
      .filter((i) => INCOME_META[i.income_type] && Number(i.total) > 0)
      .map((i) => ({
        name: INCOME_META[i.income_type].label,
        value: Number(i.total),
        type: i.income_type,
      }))
      .sort((a, b) => b.value - a.value)
  }, [data?.incomeByType])

  const walletBars = useMemo(() => {
    const m = data?.member
    if (!m) return []
    return Object.entries(WALLET_META).map(([key, w]) => ({
      name: w.label.replace(' Wallet', ''),
      full: w.label,
      value: Number(m[key]) || 0,
      color: w.color,
      icon: w.icon,
    }))
  }, [data?.member])

  const totalWallet = walletBars.reduce((s, w) => s + w.value, 0)

  if (loading) return <MemberLayout><Spinner /></MemberLayout>
  if (!data) return <MemberLayout><Alert type="danger">Error loading dashboard</Alert></MemberLayout>

  const {
    member,
    transactions,
    myReferrals,
    rewards,
    topup_payment_stats,
    income_cap,
    non_working_2x_window,
    monthly_salary,
    live_trade_wins,
    daily_growth_income,
  } = data

  const memberActive = isMemberActive(member?.status)
  const roiDaily = getRoiPercent(member.package_amount)
  const directCount = myReferrals?.length ?? 0
  const activeDirects = myReferrals?.filter((r) => r.status === 'active').length ?? 0
  const filteredTxns = tab === 'all' ? transactions : transactions?.filter((t) => t.income_type === tab)
  const INCOME_TABS = [
    { key: 'all', icon: '◈', label: 'All' },
    ...Object.entries(INCOME_META).map(([k, v]) => ({ key: k, icon: v.icon, label: v.label })),
  ]

  const last30Total = chartData.reduce((s, d) => s + d.daily, 0)
  const chartKey = chartMode === 'cumulative' ? 'cumulative' : 'daily'

  const QUICK_LINKS = [
    { to: '/member/roi-trade', icon: '📈', label: 'Trade Income', sub: 'Buy session', color: 'var(--cyan)' },
    { to: '/member/day-trades', icon: '◎', label: 'Live Trades', sub: 'Live market', color: 'var(--orange)' },
    { to: '/member/income', icon: '💰', label: 'Income', sub: 'Full breakdown', color: 'var(--gold)' },
    { to: '/member/withdraw', icon: '↩', label: 'Withdraw', sub: 'Wallets', color: 'var(--green)' },
    { to: '/member/network', icon: '🔗', label: 'Network', sub: `${directCount} directs`, color: 'var(--purple)' },
    { to: '/member/roi-history', icon: '📊', label: 'Trade History', sub: 'Participation', color: 'var(--cyan)' },
  ]

  return (
    <MemberLayout>
      {/* Trading terminal header */}
      <div className="trading-dash-hero">
        <div className="trading-dash-hero-top">
          <div>
            <div className="trading-dash-badge">LIVE PORTFOLIO</div>
            <h1 className="trading-dash-title">Trading Dashboard</h1>
            <p className="trading-dash-welcome">
              Welcome back, <strong>{member.name}</strong>
              {' · '}
              <span className="mono">{member.referral_code}</span>
            </p>
          </div>
          <div className="trading-dash-status">
            <Badge type={member.status}>{member.status}</Badge>
            <span className="trading-dash-pkg mono">${member.package_amount}</span>
            {Number(member.plan_topup_count) > 0 ? (
              <span className="trading-dash-roi" style={{ color: 'var(--purple)' }}>
                TOP-UP ×{Number(member.plan_topup_count)}
              </span>
            ) : null}
            <span className="trading-dash-roi">Trade {roiDaily}%/day</span>
          </div>
        </div>

        <div className="trading-ticker">
          <div className="trading-ticker-item">
            <span className="trading-ticker-label">Total Income</span>
            <span className="trading-ticker-value gold mono">{fmt.usd2(member.total_income)}</span>
          </div>
          {Number(member.plan_topup_count) > 0 ? (
            <>
              <div className="trading-ticker-divider" />
              <div className="trading-ticker-item">
                <span className="trading-ticker-label">Plan TOP-UP</span>
                <span className="trading-ticker-value purple mono">
                  {Number(member.plan_topup_count)}× retopup
                </span>
              </div>
            </>
          ) : null}
          <div className="trading-ticker-divider" />
          <div className="trading-ticker-item">
            <span className="trading-ticker-label">30D Earnings</span>
            <span className="trading-ticker-value green mono">{fmt.usd2(last30Total)}</span>
          </div>
          <div className="trading-ticker-divider" />
          <div className="trading-ticker-item">
            <span className="trading-ticker-label">Exchange</span>
            <span className="trading-ticker-value cyan mono">{fmt.usd2(member.exchange_wallet)}</span>
          </div>
          <div className="trading-ticker-divider" />
          <div className="trading-ticker-item">
            <span className="trading-ticker-label">Trading</span>
            <span className="trading-ticker-value orange mono">{fmt.usd2(member.trading_wallet)}</span>
          </div>
          <div className="trading-ticker-divider" />
          <div className="trading-ticker-item">
            <span className="trading-ticker-label">Salary</span>
            <span className="trading-ticker-value gold mono">{fmt.usd2(member.salary_wallet)}</span>
          </div>
          <div className="trading-ticker-divider" />
          <div className="trading-ticker-item">
            <span className="trading-ticker-label">Daily Growth</span>
            <span className="trading-ticker-value gold mono">
              {fmt.usd2(daily_growth_income?.total ?? member.total_daily_bonus_income)}
            </span>
          </div>
          {income_cap ? (
            <>
              <div className="trading-ticker-divider" />
              <div className="trading-ticker-item">
                <span className="trading-ticker-label">Cap Left</span>
                <span className={`trading-ticker-value mono ${income_cap.capped_out ? 'red' : 'green'}`}>
                  {income_cap.capped_out ? 'MAXED' : fmt.usd2(income_cap.remaining)}
                </span>
              </div>
            </>
          ) : null}
          {(income_cap?.unused_slot_lapsed_amount ?? 0) > 0 ? (
            <>
              <div className="trading-ticker-divider" />
              <div className="trading-ticker-item">
                <span className="trading-ticker-label">Unused slot lapse</span>
                <span className="trading-ticker-value orange mono">{fmt.usd2(income_cap.unused_slot_lapsed_amount)}</span>
              </div>
            </>
          ) : (income_cap?.lapsed_amount ?? 0) > 0 ? (
            <>
              <div className="trading-ticker-divider" />
              <div className="trading-ticker-item">
                <span className="trading-ticker-label">Lapsed Trade</span>
                <span className="trading-ticker-value red mono">{fmt.usd2(income_cap.lapsed_amount)}</span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <LiveTradeWinCard wins={live_trade_wins} />

      <DailyGrowthIncomeCard member={member} daily_growth_income={daily_growth_income} />

      {member?.referral_code ? (
        <div className="trading-referral-strip mb-8">
          <div className="trading-referral-head">
            <div>
              <div className="trading-referral-title">Referral invite link</div>
              <div className="trading-referral-sub">
                {memberActive ? (
                  <>
                    Share link — sponsor code <strong className="mono cyan">{member.referral_code}</strong> auto-fills on register
                  </>
                ) : (
                  <>
                    <strong style={{ color: 'var(--gold)' }}>Disabled until Active</strong> — you cannot sponsor new members until admin approves your account.
                  </>
                )}
              </div>
            </div>
            {memberActive ? (
              <div className="trading-referral-actions">
                <Btn type="button" variant="primary" size="sm" onClick={copyInviteLink}>📋 Copy</Btn>
                <Btn type="button" variant="success" size="sm" onClick={shareWhatsApp}>WhatsApp</Btn>
                <Link to="/member/add-member"><Btn type="button" variant="purple" size="sm">➕ Add Member</Btn></Link>
              </div>
            ) : null}
          </div>
          {memberActive ? (
            <>
              {copyHint === 'success' ? <Alert type="success" className="mb-3">Link copied.</Alert> : null}
              {copyHint === 'fail' ? <Alert type="warning" className="mb-3">Copy manually from the link below.</Alert> : null}
              <div className="trading-invite-url mono">{inviteRegisterUrl}</div>
            </>
          ) : null}
        </div>
      ) : null}

      <IncomeCapHighlight
        member={member}
        income_cap={income_cap}
        non_working_2x_window={non_working_2x_window}
      />

      {/* Quick trade links */}
      <div className="trading-quick-grid mb-8">
        {QUICK_LINKS.map((q) => (
          <Link key={q.to} to={q.to} className="trading-quick-card">
            <span className="trading-quick-icon">{q.icon}</span>
            <div>
              <div className="trading-quick-label">{q.label}</div>
              <div className="trading-quick-sub">{q.sub}</div>
            </div>
            <span className="trading-quick-arrow" style={{ color: q.color }}>›</span>
          </Link>
        ))}
      </div>

      {/* Charts row */}
      <div className="trading-charts-grid mb-8">
        <TradingPanel
          title="Income Performance"
          subtitle="Last 30 days — daily credits & equity curve"
          action={
            <div className="trading-chart-toggle">
              <button
                type="button"
                className={chartMode === 'cumulative' ? 'active' : ''}
                onClick={() => setChartMode('cumulative')}
              >
                Equity
              </button>
              <button
                type="button"
                className={chartMode === 'daily' ? 'active' : ''}
                onClick={() => setChartMode('daily')}
              >
                Daily
              </button>
            </div>
          }
        >
          <div className="trading-chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#00e5ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-3)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: 'var(--text-3)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                />
                <Tooltip content={<ChartTooltip mode={chartMode} />} />
                <Area
                  type="monotone"
                  dataKey={chartKey}
                  stroke="#00e5ff"
                  strokeWidth={2}
                  fill="url(#incomeGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#00e5ff', stroke: '#050810', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="trading-chart-foot">
            <span>30D volume: <strong className="mono green">{fmt.usd2(last30Total)}</strong></span>
            <span>Directs: <strong>{activeDirects}</strong> active / {directCount}</span>
          </div>
        </TradingPanel>

        <div className="trading-side-stack">
          <TradingPanel title="Income Mix" subtitle="All-time by type">
            {incomePie.length ? (
              <>
                <div className="trading-pie-wrap">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={incomePie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {incomePie.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => fmt.usd2(v)}
                        contentStyle={{
                          background: 'var(--bg-card2)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="trading-pie-legend">
                  {incomePie.slice(0, 5).map((item, i) => (
                    <div key={item.type} className="trading-pie-legend-row">
                      <span className="trading-pie-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="trading-pie-name">{item.name}</span>
                      <span className="trading-pie-amt mono">{fmt.usd2(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="trading-empty-chart">No income recorded yet</div>
            )}
          </TradingPanel>

          <TradingPanel title="Wallet Allocation" subtitle="Current balances">
            <div className="trading-wallet-bars">
              {walletBars.map((w) => {
                const pct = totalWallet > 0 ? (w.value / totalWallet) * 100 : 0
                return (
                  <div key={w.full} className="trading-wallet-row">
                    <div className="trading-wallet-row-head">
                      <span>{w.icon} {w.name}</span>
                      <span className="mono" style={{ color: w.color }}>{fmt.usd2(w.value)}</span>
                    </div>
                    <div className="trading-wallet-track">
                      <div
                        className="trading-wallet-fill"
                        style={{ width: `${Math.max(pct, w.value > 0 ? 4 : 0)}%`, background: w.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <Link to="/member/withdraw" className="trading-wallet-link">Manage withdrawals →</Link>
          </TradingPanel>
        </div>
      </div>

      {/* Income type bar chart */}
      {incomePie.length > 0 && (
        <TradingPanel title="Income Breakdown" subtitle="All-time distribution" className="mb-8">
          <div className="trading-bar-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={incomePie} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fill: 'var(--text-2)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => fmt.usd2(v)}
                  contentStyle={{
                    background: 'var(--bg-card2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={18}>
                  {incomePie.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TradingPanel>
      )}

      {topup_payment_stats ? (
        <div className="mb-8">
          <TopupPaymentStatsSummary stats={topup_payment_stats} />
        </div>
      ) : null}

      {monthly_salary?.active?.length > 0 && (
        <div className="trading-salary-strip mb-8">
          {monthly_salary.active.map((a) => (
            <div key={`${a.program}-${a.tier_label}`} className="trading-salary-pill">
              <span className="trading-salary-pill-label">👥 Direct Salary</span>
              <strong>{a.tier_label}</strong>
              <span>{a.percent_rate}% · till {fmt.date(a.expires_at)}</span>
            </div>
          ))}
          <Link to="/member/monthly-income" className="trading-salary-more">View tiers →</Link>
        </div>
      )}

      {/* Recent transactions */}
      <SectionTitle action={<Link to="/member/transactions"><Btn variant="ghost" size="sm">View all →</Btn></Link>}>
        Recent Credits
      </SectionTitle>
      <Card noPad className="mb-8">
        <div className="trading-txn-tabs">
          {INCOME_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`trading-txn-tab${tab === t.key ? ' active' : ''}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <Table
          cols={[
            { key: 'txn_id', label: 'TXN', render: (v) => <span className="mono cyan" style={{ fontSize: 10 }}>{v}</span> },
            { key: 'created_at', label: 'Time', render: (v) => <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmt.time(v)}</span> },
            { key: 'income_type', label: 'Type', render: (v) => <IncomeBadge type={v} /> },
            { key: 'amount', label: 'Amount', render: (v) => <span className="mono green" style={{ fontWeight: 700 }}>+{fmt.usd(v, 4)}</span> },
          ]}
          rows={filteredTxns?.slice(0, 8)}
          emptyText="No transactions yet"
          emptyIcon="📊"
        />
      </Card>

      {rewards?.length > 0 && (
        <>
          <SectionTitle>Rewards & Gifts</SectionTitle>
          <div className="trading-rewards-grid mb-8">
            {rewards.map((r) => (
              <div key={r.id} className="trading-reward-card">
                <span style={{ fontSize: 22 }}>{r.reward_type === 'cash' ? '💵' : '🎁'}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.reward_title}</div>
                  {r.reward_value > 0 && <div className="mono green">{fmt.usd2(r.reward_value)}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </MemberLayout>
  )
}
