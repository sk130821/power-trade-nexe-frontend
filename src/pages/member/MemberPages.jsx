import { useState, useMemo, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { memberAPI, INCOME_META, WALLET_META, LEVEL_PERCENTS, levelIncomeDirectsRequired, fmt } from '../../api/index.js'
import { useApi, useMutation } from '../../hooks/useApi.js'
import { MemberLayout } from '../../components/layout/index.jsx'
import { TopupPaymentStatsSummary } from '../../components/TopupPaymentStatsSummary.jsx'
import { Card, Table, Badge, Btn, Alert, Modal, FormGroup, Input, Spinner, Empty, WalletCard, StatCard, SectionTitle, IncomeBadge } from '../../components/ui/index.jsx'
import { TradeIntradayChart } from '../../components/TradeIntradayChart.jsx'
import { GenealogyTree, GenealogyLevelTable, GenealogyMemberDetailModal, GenealogyLevelSummary, buildDirectCountMap } from '../../components/GenealogyTree.jsx'
import { NonWorking2xWindowPanel } from '../../components/NonWorking2xWindowPanel.jsx'
import { ExchangeRoiLivePanel, ExchangeRoiLiveBadge } from '../../components/ExchangeRoiLivePanel.jsx'
import { MemberActivationBanner } from '../../components/MemberActivationBanner.jsx'
import { referralRegisterUrl } from '../../config/site.js'
import { getIstHourMinute, isDayTradeVisibleToMember, isDayTradeBuyWindowOpen, MEMBER_DAY_TRADE_VISIBLE_HOUR, MEMBER_DAY_TRADE_BUY_END_HOUR } from '../../utils/dayTradeIstWindow.js'

export { MemberDashboard } from './MemberDashboard.jsx'

// ═════════════════════════════════════════
//  MEMBER Trade TRADE — join session while open
// ═════════════════════════════════════════
export function MemberRoiTrade() {
  const [toast, setToast] = useState(null)
  const [joiningSlot, setJoiningSlot] = useState(null)
  const { data, loading, error, refetch } = useApi(() => memberAPI.getRoiStatus())
  const { mutate: join, loading: joinLoading } = useMutation(memberAPI.joinRoiSession)

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleJoin = async (slot) => {
    try {
      setJoiningSlot(slot)
      const r = await join({ slot })
      notify(r.message || `Slot ${slot} joined successfully`)
      refetch({ silent: true })
    } catch (e) {
      notify(e.message, 'danger')
    } finally {
      setJoiningSlot(null)
    }
  }

  const trade = data?.trade
  const joinedSlots = Array.isArray(data?.joined_slots) ? data.joined_slots : []
  const joined = joinedSlots.length > 0 || !!data?.joined
  const eligible = !!data?.eligible
  const memberStatus = data?.member_status
  const accountStatusLabel =
    memberStatus === 'active'
      ? 'Active — buy allowed'
      : memberStatus === 'pending'
        ? 'Pending — Buy after admin approval'
        : memberStatus === 'rejected'
          ? 'Rejected — contact support'
          : 'Pending / not active'
  const participantCount = Number(data?.participantCount ?? 0)
  const roiPercent = Number(data?.roiPercent ?? 0)
  const estimatedRoi = Number(data?.estimatedRoi ?? 0)
  const estimatedRoiAllSlots = Number(data?.estimated_roi_all_slots ?? 0)
  const pkg = data?.package_amount
  const LADDER_SLOTS = Number(data?.ladder_slots ?? 12)
  const slotCount = Number(data?.slot_count ?? LADDER_SLOTS)
  const planTopups = Number(data?.plan_topup_count ?? 0)
  const inSlotJoinWindow = !!data?.in_slot_join_window
  const slotWindow = data?.slot_window
  const slotJoinList = Array.isArray(data?.slot_join_list) ? data.slot_join_list : []
  const participation = data?.participation_stats
  const nonWorking2x = data?.non_working_2x_window
  const isWeekend = !!data?.is_weekend
  const roiTradingToday = data?.is_roi_trading_day !== false
  const premiumPlan = !!data?.premium_plan
  const premiumSlots = Array.isArray(data?.premium_join_slots) ? data.premium_join_slots : [0, 6]
  const premiumSlotSharePct = data?.premium_slot_roi_share != null
    ? Math.round(Number(data.premium_slot_roi_share) * 100)
    : Math.round(100 / Math.max(1, premiumSlots.length))
  const premiumSlotsLabel = premiumSlots.join(', ')
  const premiumJoinedToday = joinedSlots.filter((s) => premiumSlots.includes(s)).length
  const istClock = data?.ist_clock
  const joinHint = data?.join_hint

  const effectiveSlotJoinList = useMemo(() => {
    if (slotJoinList.length > 0) return slotJoinList
    if (!trade?.slot_windows) return []
    const sw = trade.slot_windows
    const n = Math.min(LADDER_SLOTS, sw.length)
    const rows = []
    for (let s = 0; s < n; s++) {
      const w = sw[s]
      rows.push({
        slot: s,
        open_time: w?.open_time ?? null,
        close_time: w?.close_time ?? null,
        trade_name: w?.trade_name ?? null,
        description: w?.description ?? null,
        joined: joinedSlots.includes(s),
        in_window: false,
        can_join: s === 0 && planTopups === 0,
        cap_closed: false,
        open_cycles_count: 0,
      })
    }
    return rows
  }, [slotJoinList, trade, planTopups, joinedSlots, LADDER_SLOTS])

  const joinableSlots = effectiveSlotJoinList.filter((r) => r.can_join !== false && !r.cap_closed && (!premiumPlan || r.premium_slot !== false))
  const allJoinableSlotsJoined =
    joinableSlots.length > 0 && joinableSlots.every((r) => r.joined)
  const premiumAllJoined = premiumPlan && premiumJoinedToday >= premiumSlots.length
  const liveRoiSlots = Array.isArray(data?.live_roi_slots) && data.live_roi_slots.length
    ? data.live_roi_slots
    : effectiveSlotJoinList.filter((r) => r.roi_running || (r.joined && r.in_window))
  const hasActiveJoinWindow =
    !!inSlotJoinWindow ||
    effectiveSlotJoinList.some((r) => r.in_window && r.can_join !== false && !r.cap_closed && !r.joined)

  useEffect(() => {
    if (!joined) return undefined
    const shouldPoll = liveRoiSlots.length > 0 || hasActiveJoinWindow
    if (!shouldPoll) return undefined
    const id = setInterval(() => refetch({ silent: true }), 45000)
    return () => clearInterval(id)
  }, [joined, liveRoiSlots.length, hasActiveJoinWindow, refetch])

  if (loading && !data) return <MemberLayout><Spinner /></MemberLayout>

  /** Join + slot window flow: any slot open/scheduled or join window currently active. */
  const sessionActiveForJoin =
    trade?.status === 'open' ||
    trade?.status === 'scheduled' ||
    hasActiveJoinWindow ||
    (Array.isArray(trade?.slots) && trade.slots.some((s) => s.status === 'open' || s.status === 'scheduled'))

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Trade Income</div>
        <div className="page-subtitle">
          {premiumPlan ? (
            <>
              <strong>${pkg} plan</strong> — slots <strong>{premiumSlotsLabel}</strong> open daily ({premiumSlotSharePct}% Trade each). All {premiumSlots.length} buys = full daily trade income. Unused slot ROI lapses against your cap.
              Mon–Fri only — <strong>Saturday & Sunday closed</strong>.
            </>
          ) : (
            <>
              <strong>12 slots</strong> (0–11) — each slot has its own IST window. Retopup is <strong>unlimited</strong>.
              Mon–Fri trading — <strong>no trade income on Saturday & Sunday</strong>.
            </>
          )}
        </div>
      </div>

      {isWeekend && (
        <Alert type="warning" className="mb-4">
          Today is <strong>{data?.ist_weekday || 'weekend'}</strong> — Trade trading is closed. Buy is not available on Saturday & Sunday; weekends are not counted as lapsed days.
        </Alert>
      )}

      {liveRoiSlots.length > 0 && (
        <ExchangeRoiLivePanel
          slots={liveRoiSlots}
          sessionDate={trade?.trade_date}
          anchorPrice={pkg}
          compact
        />
      )}

      {nonWorking2x?.applies && (
        <Card className="mb-6" title="2× participation (non-working)">
          <NonWorking2xWindowPanel window={nonWorking2x} compact />
        </Card>
      )}

      {nonWorking2x?.applies && nonWorking2x.window_expired && (
        <Alert type="danger" className="mb-4">
          Your <strong>2× participation window</strong> ended on {nonWorking2x.window_end_date}. You cannot buy trade for this cycle anymore — you received Trade only for{' '}
          <strong>{nonWorking2x.days_joined_in_window}</strong> day(s) you bought.
        </Alert>
      )}

      {participation && (
        <Card
          className="mb-6"
          title={`This month — ${participation.month_label || participation.month}`}
          action={<Link to="/member/roi-history"><Btn variant="ghost" size="sm">Full history →</Btn></Link>}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {[
                { label: 'Days bought', value: participation.days_with_join, color: 'var(--green)' },
                { label: 'Days lapsed', value: participation.days_lapsed, color: 'var(--red)' },
                { label: 'Unused-slot lapse', value: participation.days_partial_lapsed ?? 0, color: 'var(--orange)' },
                { label: 'Lapsed amount', value: fmt.usd2(participation.lapsed_amount ?? 0), color: 'var(--red)' },
                { label: 'Buys', value: participation.total_joins, color: 'var(--cyan)' },
              ].map((s) => (
                <div key={s.label} style={{ fontSize: 13 }}>
                  <span style={{ color: 'var(--text-3)' }}>{s.label}: </span>
                  <strong style={{ color: s.color, fontFamily: 'JetBrains Mono,monospace' }}>{s.value}</strong>
                </div>
              ))}
            </div>
            <Link to="/member/roi-history"><Btn variant="primary" size="sm">📅 Trade Participation History</Btn></Link>
          </div>
        </Card>
      )}

      {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}
      {error && (
        <Alert type="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {istClock && (
        <Alert type="info" className="mb-4">
          Server time (IST): <strong>{istClock.date}</strong> · <strong>{istClock.time}</strong>
          {data?.ist_weekday ? ` · ${data.ist_weekday}` : ''}
          {' '}— Buy buttons open only inside each slot&apos;s IST window (Mon–Fri).
        </Alert>
      )}

      {joinHint === 'no_session' && (
        <Alert type="warning" className="mb-4">
          <strong>No session was created on the server for today.</strong> The admin must create the first session via{' '}
          <strong>Admin → Exchange Trading Income → Create</strong>; after that, each weekday is auto-copied.
          The backend process (PM2/node) must be running.
        </Alert>
      )}

      {joinHint === 'session_closed' && !inSlotJoinWindow && (
        <Alert type="warning" className="mb-4">
          All slots for today are closed (IST close time has passed). A new session will be created automatically tomorrow morning — then use <strong>Buy Trade</strong> at your slot time.
        </Alert>
      )}

      {joinHint === 'wait_for_window' && eligible && roiTradingToday && trade && (
        <Alert type="info" className="mb-4">
          The session is active — your slot&apos;s IST window is not open yet. Check each slot&apos;s time below; the <strong>Buy Trade</strong> button will appear during the window.
        </Alert>
      )}

      {joinHint === 'no_unlocked_slots' && eligible && trade && (
        <Alert type="warning" className="mb-4">
          No buyable slots are unlocked — check retopup / 2× cap, or verify plan status with admin.
        </Alert>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 22,
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          <div className="grid-2 mb-6" style={{ marginBottom: data?.topup_payment_stats ? 0 : undefined }}>
        <Card title="Your eligibility">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-sm)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Account status</span>
              <Badge type={eligible ? 'active' : memberStatus === 'rejected' ? 'rejected' : 'pending'}>
                {accountStatusLabel}
              </Badge>
            </div>
            {!eligible ? (
              <div className="member-activation-banner member-activation-banner--compact" style={{ margin: '10px 0 4px' }}>
                <div className="member-activation-banner__icon">⏳</div>
                <div className="member-activation-banner__body">
                  <div className="member-activation-banner__text">
                    Trade buy blocked until status is{' '}
                    <span className="member-activation-banner__active-pill">Active</span>.
                  </div>
                </div>
              </div>
            ) : null}
            <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-sm)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Package</span>
              <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, color: 'var(--gold)' }}>{fmt.usd2(pkg)}</span>
            </div>
            <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-sm)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Retopup count</span>
              <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500 }}>{planTopups} (unlimited)</span>
            </div>
            {eligible && memberStatus === 'active' && !data?.topup_payment_stats ? (
              <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border-sm)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
                  Payment for next ladder level (admin approval)
                </span>
                <Link to="/member/plan-topup" style={{ fontSize: 13, fontWeight: 500, color: 'var(--purple)' }}>
                  Plan TOP-UP payment page →
                </Link>
              </div>
            ) : null}
            {premiumPlan ? (
              <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-sm)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>${pkg} slots bought today ({premiumSlotSharePct}% each)</span>
                <Badge type={premiumAllJoined ? 'active' : 'open'}>{premiumJoinedToday} / {premiumSlots.length}</Badge>
              </div>
            ) : trade ? (
              <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-sm)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Open Trade cycles (buyable slots)</span>
                <Badge type="open">{joinableSlots.length} / {LADDER_SLOTS}</Badge>
              </div>
            ) : null}
            {trade && slotWindow ? (
              <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-sm)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Your buy window (IST)</span>
                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, fontSize: 13 }}>
                  {String(slotWindow.open_time).slice(0, 5)} – {String(slotWindow.close_time).slice(0, 5)}
                </span>
              </div>
            ) : null}
            <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-sm)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Trade % (based on your ladder)</span>
              <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, color: 'var(--green)' }}>{roiPercent}%</span>
            </div>
            {sessionActiveForJoin && liveRoiSlots.length === 0 && (
              <>
                <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-sm)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Estimated Trade — bought slots (today)</span>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, color: 'var(--cyan)' }}>
                    {fmt.usd2(estimatedRoi)}
                  </span>
                </div>
                <div className="flex-between" style={{ padding: '8px 0' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    Max if you buy all open slots (Trade per open cycle)
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, color: 'var(--text-2)' }}>
                    {fmt.usd2(estimatedRoiAllSlots)}
                  </span>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card title="Today's session">
          {!trade ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0, marginBottom: 12 }}>
                Today&apos;s Exchange session has not been created on the server yet (or the first session was never created).
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
                <strong>Fix:</strong> Admin login → Exchange Trading Income → <strong>Create</strong> (once in production).
                After a backend restart, sessions auto-copy Mon–Fri. When status is <strong>scheduled / open</strong>, <strong>Buy Trade</strong> will appear during the slot window.
              </p>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 500, fontSize: 15 }}>{trade.trade_name || 'Trade Session'}</div>
                {slotWindow?.trade_name ? (
                  <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--cyan)' }}>Your slot: {slotWindow.trade_name}</div>
                ) : null}
                {slotWindow?.description ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{slotWindow.description}</p>
                ) : trade.description ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{trade.description}</p>
                ) : null}
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                    12 slots — open cycles per slot:{' '}
                    <strong style={{ color: 'var(--cyan)' }}>{joinableSlots.length} buyable</strong>
                    {' '}· retopup #{planTopups}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                      gap: 8,
                      maxHeight: 320,
                      overflowY: 'auto',
                    }}
                  >
                    {(Array.isArray(trade.topup_tiers) ? trade.topup_tiers : []).slice(0, LADDER_SLOTS).map((amt, i) => {
                      if (premiumPlan && !premiumSlots.includes(i)) return null
                      const w = Array.isArray(trade.slot_windows) ? trade.slot_windows[i] : null
                      const row = effectiveSlotJoinList.find((r) => r.slot === i)
                      const tw = w ? `${String(w.open_time).slice(0, 5)}–${String(w.close_time).slice(0, 5)}` : ''
                      const st = w?.trade_name ? String(w.trade_name) : ''
                      const sd = w?.description ? String(w.description) : ''
                      const canJoin = row?.can_join !== false && !row?.cap_closed
                      const slotJoined = joinedSlots.includes(i)
                      const slotRunning = row?.roi_running || liveRoiSlots.some((l) => l.slot === i)
                      const dim = !canJoin && !slotJoined
                      const openN = row?.open_cycles_count ?? 0
                      return (
                        <div
                          key={i}
                          style={{
                            padding: '10px 8px',
                            background: dim
                              ? 'var(--bg-card2)'
                              : slotRunning
                                ? 'rgba(0,255,136,0.2)'
                                : slotJoined
                                  ? 'rgba(34, 197, 94, 0.18)'
                                  : row?.in_window
                                    ? 'rgba(34, 197, 94, 0.1)'
                                    : 'var(--bg-card2)',
                            opacity: dim ? 0.45 : 1,
                            borderRadius: 8,
                            textAlign: 'center',
                            outline: slotRunning
                              ? '2px solid var(--green)'
                              : slotJoined
                                ? '2px solid var(--green)'
                                : row?.in_window
                                  ? '1px dashed var(--border)'
                                  : 'none',
                            boxShadow: slotRunning ? '0 0 12px rgba(0,255,136,0.25)' : 'none',
                          }}
                        >
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Slot {i}</div>
                          {premiumPlan ? (
                            <div style={{ fontSize: 9, color: 'var(--gold)', marginTop: 2 }}>{premiumSlotSharePct}% Trade</div>
                          ) : openN > 0 ? (
                            <div style={{ fontSize: 9, color: 'var(--cyan)', marginTop: 2 }}>{openN} cycle trade income</div>
                          ) : row?.cap_closed ? (
                            <div style={{ fontSize: 9, color: 'var(--red)', marginTop: 2 }}>2×/3× cap</div>
                          ) : null}
                          {st ? <div style={{ fontWeight: 500, fontSize: 12, marginTop: 4, lineHeight: 1.25 }}>{st}</div> : null}
                          {sd ? (
                            <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.35 }}>{sd}</div>
                          ) : null}
                          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, fontSize: 13, marginTop: 6 }}>
                            {fmt.usd2(Number(amt) || 0)}
                          </div>
                          {tw ? (
                            <div style={{ fontSize: 10, color: 'var(--cyan)', marginTop: 4, fontFamily: 'JetBrains Mono,monospace' }}>{tw}</div>
                          ) : null}
                          {slotJoined ? (
                            slotRunning ? (
                              <div style={{ marginTop: 4 }}><ExchangeRoiLiveBadge /></div>
                            ) : (
                              <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 4, fontWeight: 500 }}>Bought</div>
                            )
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-sm)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Status</span>
                  <Badge type={trade.status}>{trade.status}</Badge>
                </div>
                <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-sm)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Session date</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt.date(trade.trade_date)}</span>
                </div>
                {sessionActiveForJoin && (
                  <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-sm)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Members bought</span>
                    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500 }}>{participantCount}</span>
                  </div>
                )}
              </div>

              {trade.status === 'scheduled' && (
                <Alert type="warning">
                  Session is <strong>scheduled</strong> — buys start after the first slot&apos;s IST time. One <strong>Buy per unlocked</strong>
                  slot (0–{planTopups}) — only inside that slot&apos;s open–close window.
                  Full session <strong>auto-closes</strong> around <strong>{String(trade.close_time).slice(0, 5)} IST</strong>.
                </Alert>
              )}

              {trade.status === 'closed' && !sessionActiveForJoin && (
                <Alert type="success">
                  Today&apos;s session is closed. Members who bought should have received Trade — check Exchange wallet
                  history.
                </Alert>
              )}

              {trade.status === 'closed' && sessionActiveForJoin && (
                <Alert type="info">
                  Session is marked <strong>closed</strong>, but some slots are still in their IST window — <strong>Buy</strong> appears below when your slot opens.
                </Alert>
              )}

              {!eligible && (
                <MemberActivationBanner status={memberStatus} compact />
              )}

              {!roiTradingToday && (
                <Alert type="warning">Weekend — Trade buy is closed. You can buy again from Monday.</Alert>
              )}

              {sessionActiveForJoin && eligible && premiumPlan && premiumAllJoined && (
                <Alert type="success">
                  All ${pkg} slots ({premiumSlotsLabel}) bought today — full daily trade income will be paid when the session closes.
                </Alert>
              )}

              {sessionActiveForJoin && eligible && allJoinableSlotsJoined && !premiumPlan && (
                <Alert type="success">
                  You bought all unlocked slots today (0–{planTopups}). When the session closes around{' '}
                  <strong>~{String(trade.close_time).slice(0, 5)} IST</strong>, Trade + team level income
                  auto-credits via the ledger (separate base per slot).
                </Alert>
              )}

              {sessionActiveForJoin && eligible && joined && !allJoinableSlotsJoined && (
                <Alert type="info">
                  Bought slots: <strong>{joinedSlots.join(', ') || '—'}</strong>. For remaining slots, click <strong>Buy</strong> during their IST window — each slot is separate daily participation.
                </Alert>
              )}

              {sessionActiveForJoin && eligible && !allJoinableSlotsJoined && !inSlotJoinWindow && (
                <Alert type="warning" className="mb-4">
                  No remaining <strong>unlocked</strong> slot is in its buy window — see each slot&apos;s IST time above; click Buy when the window opens.
                </Alert>
              )}

              {sessionActiveForJoin && eligible && roiTradingToday && !allJoinableSlotsJoined && effectiveSlotJoinList.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  {effectiveSlotJoinList.filter((row) => {
                    if (premiumPlan && !premiumSlots.includes(row.slot)) return false
                    return row.can_join !== false || row.joined
                  }).map((row) => (
                    <div
                      key={row.slot}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border-sm)',
                        background: 'var(--bg-card2)',
                        opacity: row.cap_closed && !row.joined ? 0.5 : 1,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>
                          Slot {row.slot}
                          {premiumPlan ? (
                            <span style={{ fontSize: 11, color: 'var(--gold)', marginLeft: 8 }}>{premiumSlotSharePct}% daily trade income</span>
                          ) : row.open_cycles_count > 0 ? (
                            <span style={{ fontSize: 11, color: 'var(--cyan)', marginLeft: 8 }}>
                              {row.open_cycles_count} cycle trade income
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono,monospace' }}>
                          {row.open_time && row.close_time
                            ? `${String(row.open_time).slice(0, 5)} – ${String(row.close_time).slice(0, 5)} IST`
                            : '—'}
                        </div>
                      </div>
                      {row.joined ? (
                        row.roi_running ? (
                          <ExchangeRoiLiveBadge />
                        ) : (
                          <Badge type="active">Bought</Badge>
                        )
                      ) : row.cap_closed ? (
                        <span style={{ fontSize: 12, color: 'var(--red)' }}>2×/3× cap</span>
                      ) : row.in_window ? (
                        <Btn
                          type="button"
                          variant="primary"
                          loading={joinLoading && joiningSlot === row.slot}
                          onClick={() => handleJoin(row.slot)}
                          icon="⬆"
                        >
                          Buy Trade {row.slot}
                        </Btn>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Window — wait</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </>
          )}
        </Card>
      </div>
        </div>

        {data?.topup_payment_stats ? (
          <aside
            style={{
              flex: '0 1 308px',
              width: '100%',
              maxWidth: 340,
              position: 'sticky',
              top: 14,
              alignSelf: 'flex-start',
            }}
          >
            <TopupPaymentStatsSummary
              stats={data.topup_payment_stats}
              roiSidePanel
              ladderCap={LADDER_SLOTS}
              planTopupHistory={data.plan_topup_history || []}
              showPlanTopupCta={eligible && memberStatus === 'active'}
            />
          </aside>
        ) : null}
      </div>

      <Card title="Steps (how to participate)">
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.85 }}>
          {premiumPlan ? (
            <>
              <li><strong>${pkg} plan</strong>: buy slots <strong>{premiumSlotsLabel}</strong> each day — <strong>{premiumSlotSharePct}%</strong> daily trade income per slot.</li>
              <li>All {premiumSlots.length} slots = <strong>100%</strong> full trade income. If you buy only one slot, the unused slot&apos;s ROI lapses against your cap.</li>
            </>
          ) : (
            <>
              <li><strong>12 slots</strong> (0–11). Plan = slot 0; each retopup starts a new cycle — after 12, restart at slot 0.</li>
              <li>Retopup is <strong>unlimited</strong>. Each slot has its own IST window — click <strong>Buy</strong> during that window.</li>
            </>
          )}
          <li><strong>Saturday & Sunday</strong> — Trade closed. Lapse counts apply on Mon–Fri trading days only.</li>
          <li>Check <strong>Trade History</strong> for monthly participation — days bought vs lapsed.</li>
          <li>No buy = no trade income — missed days are tracked as lapsed.</li>
          <li>Funds go to the <strong>Exchange wallet</strong>; view history in Transactions.</li>
        </ol>
      </Card>
    </MemberLayout>
  )
}

// ═════════════════════════════════════════
//  MEMBER DAY TRADES
// ═════════════════════════════════════════
export function MemberDayTrades() {
  const navigate = useNavigate()
  const { data: dashData, refetch: refetchDash } = useApi(() => memberAPI.getDashboard())
  const { data: tradesRaw, loading, refetch } = useApi(() => memberAPI.getDayTrades())
  const trades = Array.isArray(tradesRaw) ? tradesRaw : []
  const { data: myBuysRaw, refetch: refetchMyBuys } = useApi(() => memberAPI.getMyDayTradeBuys({ limit: 20 }))
  const myBuys = Array.isArray(myBuysRaw) ? myBuysRaw : (myBuysRaw?.rows ?? [])
  const [buyModal, setBuyModal] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [toast, setToast] = useState(null)
  const [clockTick, setClockTick] = useState(0)
  const { mutate: buy, loading: buying } = useMutation(memberAPI.buyTrade)

  useEffect(() => {
    const id = setInterval(() => setClockTick((x) => x + 1), 30000)
    return () => clearInterval(id)
  }, [])
  void clockTick

  const memberCanSeeTrades = isDayTradeVisibleToMember()
  const inWindow = isDayTradeBuyWindowOpen()
  const { hour: istHour } = getIstHourMinute()
  const beforeTradeOpen = istHour < MEMBER_DAY_TRADE_VISIBLE_HOUR
  const afterTradeClose = istHour >= MEMBER_DAY_TRADE_BUY_END_HOUR
  const visibleTrades = memberCanSeeTrades ? trades : []

  useEffect(() => {
    if (!memberCanSeeTrades) return undefined
    const id = setInterval(() => {
      refetch({ silent: true })
    }, 60000)
    return () => clearInterval(id)
  }, [memberCanSeeTrades, refetch])

  const notify = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  const tradeWallet = dashData?.member?.trading_wallet || 0
  const memberActive = dashData?.member?.status === 'active'

  const openBuy = (t) => {
    if (!memberActive) {
      notify('Only Active members can buy live trades. Wait for admin approval.', 'danger')
      return
    }
    setBuyModal(t)
    setQuantity('1')
  }

  const setQuantityInt = (raw) => {
    const s = String(raw).replace(/[^\d]/g, '')
    if (s === '') {
      setQuantity('')
      return
    }
    const n = Math.max(1, parseInt(s, 10) || 1)
    setQuantity(String(n))
  }

  const handleBuy = async (e) => {
    e.preventDefault()
    const lp = Number(buyModal?.last_price || 0)
    const qty = parseInt(String(quantity), 10)
    if (!lp || !Number.isFinite(qty) || qty < 1) { notify('Quantity must be at least 1', 'danger'); return }
    const total = qty * lp
    const minInv = Number(buyModal?.min_invest || 1)
    if (total < minInv) { notify(`Minimum order is ${fmt.usd2(minInv)} (qty × LTP)`, 'danger'); return }
    if (total > Number(tradeWallet)) { notify('Not enough Trading wallet balance — add funds first', 'danger'); return }
    try {
      await buy({ trade_id: buyModal.id, quantity: qty })
      notify(`Paid from Trading wallet: ${fmt.usd2(total)} · ${qty} qty @ ${fmt.usd(lp, 4)}`)
      setBuyModal(null)
      setQuantity('')
      refetchDash()
      refetch()
      refetchMyBuys()
    } catch(e) { notify(e.message, 'danger') }
  }

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Live Trades</div>
        <div className="page-subtitle">
          Admin activates scripts in the morning (any time). Members see them from <strong>9:00 AM IST</strong>. Choose <strong>quantity</strong> — total = qty × price. Paid from <strong>Trading wallet</strong> only. Buying stays open until admin settles (no 5 PM auto-close).
        </div>
      </div>

      {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}

      {!memberActive && <MemberActivationBanner status={dashData?.member?.status} compact />}

      <div style={{ display:'flex',gap:16,marginBottom:24,flexWrap:'wrap' }}>
        <WalletCard icon="🎯" label="Trading Wallet" balance={fmt.usd(tradeWallet)} desc="Buying power" color="var(--orange)" />
        <div style={{ flex:1,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,padding:20,display:'flex',flexDirection:'column',justifyContent:'center' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
            <div style={{ width:8,height:8,borderRadius:'50%',background:inWindow?'var(--green)':'var(--red)',animation:inWindow?'pulse 2s infinite':'none' }} />
            <span style={{ fontSize:13,fontWeight:700,color:inWindow?'var(--green)':'var(--red)' }}>
              Session {inWindow ? 'LIVE' : 'CLOSED'}
            </span>
          </div>
          <div style={{ fontSize:12,color:'var(--text-2)',lineHeight:1.7 }}>
            <strong>How it works:</strong> Open a trade → enter quantity → see total. If your Trading wallet has enough, confirm; otherwise use <strong>Fund trading wallet</strong> to add balance, then buy.
          </div>
        </div>
      </div>

      {!memberCanSeeTrades && beforeTradeOpen && (
        <Alert type="info" className="mb-5">
          Live trades appear from <strong>9:00 AM IST</strong>. Admin may activate earlier — please check back after 9 AM.
        </Alert>
      )}
      {!memberCanSeeTrades && afterTradeClose && (
        <Alert type="warning" className="mb-5">
          Live trades are closed until admin activates the next session.
        </Alert>
      )}

      <SectionTitle>My trades (bought)</SectionTitle>
      <Card noPad className="mb-6">
        <Table
          cols={[
            { key: 'trade_name', label: 'Trade', render: (v, r) => (
              <div>
                <div style={{ fontWeight: 500 }}>{v}</div>
                {r.trade_symbol && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.trade_symbol}</div>}
              </div>
            ) },
            { key: 'invested_at', label: 'Bought', render: (v) => <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmt.time(v)}</span> },
            { key: 'trade_date', label: 'Session', render: (v) => <span style={{ fontSize: 11 }}>{v ? fmt.date(v) : '—'}</span> },
            { key: 'quantity', label: 'Qty', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{v != null ? Number(v) : '—'}</span> },
            { key: 'price_at_buy', label: 'Price @ buy', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{v != null ? Number(v).toFixed(4) : '—'}</span> },
            { key: 'invest_amount', label: 'Total', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--gold)', fontWeight: 500 }}>{fmt.usd2(v)}</span> },
            { key: 'investment_status', label: 'Status', render: (v) => <Badge type={v}>{v === 'doubled' ? '2x' : v === 'zeroed' ? 'Zero' : v}</Badge> },
          ]}
          rows={myBuys}
          emptyText="You have not bought any live trade yet"
          emptyIcon="🛒"
        />
        {myBuys.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
            <Link to="/member/live-trading-history" style={{ fontSize: 12, color: 'var(--cyan)', textDecoration: 'none', fontWeight: 600 }}>
              View full Live Trading History →
            </Link>
          </div>
        )}
      </Card>

      {loading ? <Spinner /> : (
        <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
          {visibleTrades.map(t => {
            const lp = Number(t.last_price || 0)
            const chg = Number(t.change_pct || 0)
            const pos = chg >= 0
            return (
              <div key={t.id} className="day-trade-card">
                <div className="day-trade-card-grid">
                  <div className="day-trade-card-cell">
                    <div className="day-trade-card-label">Scrip</div>
                    <div className="day-trade-card-scrip">{t.trade_name}</div>
                    <div className="day-trade-card-symbol">{t.trade_symbol || '—'}</div>
                  </div>
                  <div className="day-trade-card-cell">
                    <div className="day-trade-card-label">LTP</div>
                    <div className="day-trade-card-ltp">{lp ? lp.toFixed(4) : '—'}</div>
                    <div className={`day-trade-card-chg${pos ? ' day-trade-card-chg--up' : ' day-trade-card-chg--down'}`}>
                      {pos ? '+' : ''}{chg.toFixed(2)}%
                    </div>
                  </div>
                  <div className="day-trade-card-cell">
                    <div className="day-trade-card-label">O / H / L</div>
                    <div className="day-trade-card-ohl">
                      O <span>{t.open_price != null ? Number(t.open_price).toFixed(4) : '—'}</span><br/>
                      H <span>{t.day_high != null ? Number(t.day_high).toFixed(4) : '—'}</span>{' '}
                      L <span>{t.day_low != null ? Number(t.day_low).toFixed(4) : '—'}</span>
                    </div>
                  </div>
                </div>
                {t.description && <div className="day-trade-card-desc">{t.description}</div>}
                <div className="day-trade-chart-section">
                  <TradeIntradayChart
                    symbol={t.trade_symbol || t.trade_name}
                    height={220}
                    live={!!lp}
                    anchorPrice={lp}
                    compact
                  />
                </div>
                <div className="day-trade-buy-bar">
                  <div className="day-trade-buy-bar__info">
                    <span>Min order <strong>{fmt.usd2(t.min_invest)}</strong></span>
                    <span>LTP <strong>{lp ? lp.toFixed(4) : '—'}</strong></span>
                  </div>
                  <Btn
                    variant="primary"
                    className="day-trade-buy-bar__btn"
                    disabled={!inWindow || !lp || !memberActive}
                    onClick={() => openBuy(t)}
                  >
                    {inWindow ? 'Buy Live Trade' : 'Closed'}
                  </Btn>
                </div>
              </div>
            )
          })}
          {!visibleTrades.length && (
            <Empty
              icon="🎯"
              title={memberCanSeeTrades ? 'No Active Trades' : 'Opens at 9 AM IST'}
              desc={memberCanSeeTrades ? "Admin hasn't activated any scripts for today." : beforeTradeOpen ? 'Live trades will appear here from 9:00 AM IST.' : 'No live trades right now.'}
            />
          )}
        </div>
      )}

      <Modal open={!!buyModal} onClose={() => setBuyModal(null)} title={`Buy Live Trade · ${buyModal?.trade_name} (${buyModal?.trade_symbol || '—'})`}>
        {buyModal && (() => {
          const lp = Number(buyModal.last_price || 0)
          const qtyNum = parseInt(String(quantity), 10)
          const validQty = Number.isFinite(qtyNum) && qtyNum >= 1
          const total = validQty && lp > 0 ? qtyNum * lp : 0
          const w = Number(tradeWallet)
          const minInv = Number(buyModal.min_invest || 1)
          const meetsMin = total >= minInv
          const canPay = validQty && meetsMin && total > 0 && total <= w
          const shortfall = Math.max(0, total - w)
          const minQtyForOrder = lp > 0 ? Math.max(1, Math.ceil(minInv / lp)) : 1
          return (
            <>
              <Alert type="info" className="mb-4">
                Trading wallet balance:{' '}
                <strong style={{ fontFamily:'JetBrains Mono,monospace' }}>{fmt.usd(w)}</strong>
              </Alert>
              <div style={{ background:'var(--bg-card2)', borderRadius:12, padding:14, marginBottom:16, fontSize:13, lineHeight:1.6 }}>
                <div className="flex-between" style={{ marginBottom:6 }}>
                  <span style={{ color:'var(--text-2)' }}>LTP (price per unit)</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:800, color:'var(--gold)' }}>{lp.toFixed(4)}</span>
                </div>
                <div className="flex-between" style={{ marginBottom:6 }}>
                  <span style={{ color:'var(--text-2)' }}>Quantity × LTP</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace' }}>
                    {Number.isFinite(qtyNum) ? qtyNum : '—'} × {lp.toFixed(4)}
                  </span>
                </div>
                <div className="flex-between">
                  <span style={{ color:'var(--text-2)', fontWeight:700 }}>Order total</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontWeight:900, fontSize:16, color:'var(--cyan)' }}>{fmt.usd2(total)}</span>
                </div>
                <div style={{ fontSize:11, color:'var(--text-3)', marginTop:8 }}>
                  Minimum order value: {fmt.usd2(minInv)}
                  {minQtyForOrder > 1 ? ` · use qty ${minQtyForOrder}+ if LTP is low` : ' · quantity min 1'}
                </div>
              </div>

              {validQty && qtyNum < minQtyForOrder && (
                <Alert type="warning" className="mb-4">
                  For this price, use at least <strong>{minQtyForOrder}</strong> qty to meet minimum order {fmt.usd2(minInv)}.
                </Alert>
              )}

              {canPay && (
                <Alert type="success" className="mb-4">
                  This amount will be <strong>deducted from your Trading wallet</strong> only (not bank / USDT BEP20 in this step).
                </Alert>
              )}
              {total > 0 && validQty && !meetsMin && (
                <Alert type="warning" className="mb-4">Increase quantity (min 1) — total must be at least {fmt.usd2(minInv)}.</Alert>
              )}
              {meetsMin && total > w && (
                <Alert type="danger" className="mb-4">
                  You need <strong>{fmt.usd2(shortfall)}</strong> more in your Trading wallet for this order.
                  <div style={{ marginTop:12 }}>
                    <Btn variant="primary" type="button" onClick={() => navigate('/member/add-funds')}>
                      Add money to trading wallet
                    </Btn>
                  </div>
                </Alert>
              )}

              <Alert type="warning" className="mb-4">Winner script 2x payout; others zero. Buy-only; no sell.</Alert>
              <form onSubmit={handleBuy}>
                <FormGroup label="Quantity" required hint="Whole numbers only — min 1 (e.g. 1, 2, 3, 4…)">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setQuantity(String(n))}
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 13,
                          fontWeight: 600,
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: qtyNum === n ? '1px solid var(--cyan)' : '1px solid var(--border)',
                          background: qtyNum === n ? 'rgba(0,229,255,0.12)' : 'var(--bg-card2)',
                          color: qtyNum === n ? 'var(--cyan)' : 'var(--text-2)',
                          cursor: 'pointer',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={quantity}
                    onChange={(e) => setQuantityInt(e.target.value)}
                    onBlur={() => {
                      if (!quantity || parseInt(quantity, 10) < 1) setQuantity('1')
                    }}
                    required
                  />
                </FormGroup>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <Btn variant="primary" type="submit" loading={buying} disabled={!canPay}>Confirm buy</Btn>
                  <Btn variant="ghost" type="button" onClick={() => setBuyModal(null)}>Cancel</Btn>
                </div>
              </form>
            </>
          )
        })()}
      </Modal>
    </MemberLayout>
  )
}

// ═════════════════════════════════════════
//  MEMBER NETWORK
// ═════════════════════════════════════════
export function MemberNetwork() {
  const [genealogyView, setGenealogyView] = useState('tree')
  const [activeLevel, setActiveLevel] = useState(1)
  const [detailMember, setDetailMember] = useState(null)
  const [copyHint, setCopyHint] = useState(false)
  const { data, loading } = useApi(() => memberAPI.getDashboard())
  const { data: gen, loading: genLoading, error: genError } = useApi(() => memberAPI.getGenealogy())

  const directCountById = useMemo(() => buildDirectCountMap(gen?.flat_members), [gen?.flat_members])

  if (loading) return <MemberLayout><Spinner /></MemberLayout>

  const { member, myReferrals } = data || {}
  const refLink = referralRegisterUrl(member?.referral_code)

  const openMemberDetail = (m) => {
    if (!m) return
    setDetailMember(m)
  }

  const detailDirectCount = detailMember
    ? directCountById.get(detailMember.id) ?? 0
    : 0

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(refLink)
      setCopyHint(true)
      setTimeout(() => setCopyHint(false), 2500)
    } catch { /* ignore */ }
  }

  const activeDownline = gen?.flat_members?.filter((m) => m.status === 'active').length ?? 0
  const activeDirectCount = gen?.levels?.[0]?.count ?? myReferrals?.filter((r) => r.status === 'active').length ?? 0
  const memberActive = member?.status === 'active'

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Genealogy</div>
        <div className="page-subtitle">Tree view — see how many members are at each level · click a member for details</div>
      </div>

      <GenealogyMemberDetailModal
        member={detailMember}
        directCount={detailDirectCount}
        open={!!detailMember}
        onClose={() => setDetailMember(null)}
      />

      {/* Referral strip */}
      <Card className="mb-6" noPad>
        <div style={{ padding: '20px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Your Member ID</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 28, fontWeight: 500, color: 'var(--cyan)', letterSpacing: '0.04em' }}>{member?.referral_code}</div>
          </div>
          <div style={{ flex: 1, minWidth: 220, maxWidth: 480 }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Invite link</div>
            {memberActive ? (
              <div style={{ fontSize: 11, wordBreak: 'break-all', background: 'var(--bg-card2)', borderRadius: 10, padding: '10px 12px', fontFamily: 'JetBrains Mono,monospace', color: 'var(--text-2)', border: '1px solid var(--border-sm)' }}>{refLink}</div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--gold)', lineHeight: 1.5 }}>
                Sponsoring is disabled until your account is <strong>Active</strong>.
              </div>
            )}
          </div>
          {memberActive ? <Btn variant="outline-cyan" onClick={copyLink} icon="📋">Copy link</Btn> : null}
        </div>
        {copyHint ? <div style={{ padding: '0 24px 16px' }}><Alert type="success">Link copied to clipboard</Alert></div> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          {[
            { label: 'Direct (L1)', value: activeDirectCount, color: 'var(--cyan)' },
            { label: 'Total team', value: gen?.total_downline ?? 0, color: 'var(--purple)' },
            { label: 'Active', value: activeDownline, color: 'var(--green)' },
            { label: 'Deepest level', value: gen?.deepest_level ? `L${gen.deepest_level}` : '—', color: 'var(--gold)' },
          ].map((s) => (
            <div key={s.label} style={{ padding: '16px 12px', borderRight: '1px solid var(--border-sm)' }}>
              <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 22, fontWeight: 500, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Genealogy */}
      <div className="mb-8">
        <SectionTitle>Team tree</SectionTitle>
        {genLoading ? (
          <Card><Spinner /></Card>
        ) : genError ? (
          <Alert type="danger">{genError}</Alert>
        ) : (
          <>
            {gen?.levels?.length ? (
              <GenealogyLevelSummary
                levels={gen.levels}
                activeLevel={genealogyView === 'list' ? activeLevel : null}
                onLevelClick={(lv) => {
                  setActiveLevel(lv)
                  setGenealogyView('list')
                }}
              />
            ) : null}

            <div className="flex-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)', maxWidth: 480, lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--cyan)' }}>Tree</strong> — sponsor chain · click member for details.{' '}
                <strong style={{ color: 'var(--purple)' }}>By level</strong> — level-wise list.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn type="button" size="sm" variant={genealogyView === 'tree' ? 'primary' : 'ghost'} onClick={() => setGenealogyView('tree')}>
                  🌳 Tree view
                </Btn>
                <Btn type="button" size="sm" variant={genealogyView === 'list' ? 'primary' : 'ghost'} onClick={() => setGenealogyView('list')}>
                  📋 By level
                </Btn>
              </div>
            </div>

            {genealogyView === 'tree' && member ? (
              <Card noPad className="mb-4">
                <GenealogyTree
                  rootMember={member}
                  flatMembers={gen?.flat_members || []}
                  defaultOpenDepth={2}
                  onMemberSelect={openMemberDetail}
                />
              </Card>
            ) : null}

            {genealogyView === 'list' && gen?.levels?.length ? (
              <Card noPad>
                <div style={{ padding: '16px 20px 0' }}>
                  <div className="gen-level-tabs">
                    {gen.levels.map((L) => (
                      <button
                        key={L.level}
                        type="button"
                        className={`gen-level-tab${activeLevel === L.level ? ' active' : ''}`}
                        onClick={() => setActiveLevel(L.level)}
                      >
                        Level {L.level} · {L.count}
                      </button>
                    ))}
                  </div>
                </div>
                <GenealogyLevelTable
                  level={activeLevel}
                  members={gen.levels.find((L) => L.level === activeLevel)?.members ?? []}
                  onMemberSelect={openMemberDetail}
                />
              </Card>
            ) : genealogyView === 'list' ? (
              <Card>
                <Empty icon="🌳" title="No downline yet" desc="Share your referral link — levels will appear here." />
              </Card>
            ) : null}

            {!gen?.levels?.length && genealogyView === 'tree' && member ? (
              <Alert type="info" className="mt-4">
                No downline in your team yet — share your referral link and the tree will grow here.
              </Alert>
            ) : null}
          </>
        )}
      </div>

      <div className="grid-2 mb-6">
        <Card title="Earnings from network">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, textAlign: 'center', padding: '8px 0' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--green)', fontFamily: 'JetBrains Mono,monospace' }}>{fmt.usd2(member?.total_direct_income)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Direct income (5%)</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--purple)', fontFamily: 'JetBrains Mono,monospace' }}>{fmt.usd2(member?.total_level_income)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Level income (Trade %)</div>
            </div>
          </div>
        </Card>

        <Card title="Level income structure">
          <Alert type="info" className="mb-3" style={{ margin: '0 0 12px' }}>
            <strong>Rule:</strong> To earn income at a given level, you need that many <strong>active direct</strong> referrals
            (L1 → 1 direct, L3 → 3 directs, L11 → 11 directs). Your active directs now: <strong>{activeDirectCount}</strong>.
          </Alert>
          <div style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
            {LEVEL_PERCENTS.map((pct, i) => {
              const levelNo = i + 1
              const required = levelIncomeDirectsRequired(levelNo)
              const unlocked = activeDirectCount >= required
              return (
              <div key={i} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-sm)', opacity: unlocked ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--bg-card2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, color: 'var(--text-2)', flexShrink: 0 }}>L{levelNo}</div>
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Level {levelNo}</span>
                    <div style={{ fontSize: 10, color: unlocked ? 'var(--green)' : 'var(--orange)', marginTop: 2 }}>
                      {required} active direct{required === 1 ? '' : 's'} required {unlocked ? '· ✓ qualified' : '· locked'}
                    </div>
                  </div>
                </div>
                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, color: 'var(--green)', fontSize: 13 }}>{pct}% of Trade</span>
              </div>
            )})}
          </div>
        </Card>
      </div>

      <Card title={`Direct referrals (${myReferrals?.length || 0})`} noPad>
        <Table
          cols={[
            { key: 'name', label: 'Member', render: (v, r) => <div><div style={{ fontWeight: 500 }}>{v}</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.email}</div></div> },
            { key: 'referral_code', label: 'Member ID', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: 'var(--cyan)' }}>{v || '—'}</span> },
            { key: 'package_amount', label: 'Package', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--gold)', fontWeight: 500 }}>${v}</span> },
            { key: 'status', label: 'Status', render: (v) => <Badge type={v}>{v}</Badge> },
            { key: 'created_at', label: 'Joined', render: (v) => fmt.date(v) },
            { key: 'package_amount', label: 'Your earning', render: (v, r) => r.status === 'active' ? <span style={{ color: 'var(--green)', fontFamily: 'JetBrains Mono,monospace', fontWeight: 500 }}>{fmt.usd2(v * 0.05)} (5%)</span> : <span style={{ color: 'var(--text-3)' }}>Pending</span> },
          ]}
          rows={myReferrals}
          emptyText="No referrals yet"
          emptyIcon="👥"
        />
      </Card>
    </MemberLayout>
  )
}

export { MemberTransactionHistory } from './MemberTransactionHistory.jsx'

