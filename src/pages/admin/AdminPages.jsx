// ═══════════════════════════════════════════
//  Admin Pages — Trade Income, Live Trades,
//  Salary/Reward, Transactions, Settings
// ═══════════════════════════════════════════

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { roiAPI, dayTradeAPI, adminMemberAPI, txnAPI, authAPI, INCOME_META, WALLET_META, fmt, PACKAGES, uploadUrl } from '../../api/index.js'
import { useApi, useMutation } from '../../hooks/useApi.js'
import { AdminLayout } from '../../components/layout/index.jsx'
import { Card, Btn, Alert, Table, Badge, Modal, FormGroup, Input, Select, Textarea, Spinner, Empty, StatCard, SectionTitle, IncomeBadge } from '../../components/ui/index.jsx'
import { TrustWalletBrandRow } from '../../components/TrustWalletLogo.jsx'
import { downloadRoiSessionExcel } from '../../utils/roiReportExport.js'
import { downloadTransactionsExcel } from '../../utils/transactionExport.js'
import { isDayTradeActivateAllowed, isDayTradeBuyWindowOpen, isSettleableTodayTrade, getTodayIstYmd, dayTradeSessionYmd } from '../../utils/dayTradeIstWindow.js'

function packagePlanLabel(amount) {
  const n = Number(amount)
  const p = PACKAGES.find((x) => x.amount === n)
  return p ? `${p.label} ($${p.amount})` : `$${n}`
}

const ROI_SLOT_MAX = 48
const ROI_SLOT_DEFAULT = 9
const emptySlotRow = (open = '12:00', close = '13:00') => ({
  amount: '0',
  open,
  close,
  tradeName: '',
  slotDesc: '',
})

/** API / MySQL time → HH:MM for <input type="time"> */
function formatTimeHm(v, fallback = '12:00') {
  if (v == null || v === '') return fallback
  if (typeof v === 'string') {
    const m = v.match(/(\d{1,2}):(\d{2})/)
    if (m) return `${String(m[1]).padStart(2, '0')}:${m[2]}`
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const h = v.getUTCHours()
    const min = v.getUTCMinutes()
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }
  const s = String(v)
  const m = s.match(/(\d{1,2}):(\d{2})/)
  return m ? `${String(m[1]).padStart(2, '0')}:${m[2]}` : fallback
}

function slotRowsFromTrade(today) {
  const tiers = Array.isArray(today.topup_tiers) ? today.topup_tiers : Array(ROI_SLOT_DEFAULT).fill(0)
  const wins = Array.isArray(today.slot_windows) ? today.slot_windows : null
  const n = Math.min(ROI_SLOT_MAX, Math.max(1, tiers.length))
  const sessionOpen = formatTimeHm(today.open_time, '12:00')
  const sessionClose = formatTimeHm(today.close_time, '13:00')
  return {
    rows: Array.from({ length: n }, (_, i) => {
      const w = wins?.[i]
      return {
        amount: String(tiers[i] ?? 0),
        open: w ? formatTimeHm(w.open_time, sessionOpen) : sessionOpen,
        close: w ? formatTimeHm(w.close_time, sessionClose) : sessionClose,
        tradeName: typeof w?.trade_name === 'string' ? w.trade_name : '',
        slotDesc: typeof w?.description === 'string' ? w.description : '',
      }
    }),
    n,
    sessionOpen,
    sessionClose,
  }
}

// ─────────────────────────────────────────
//  Trade TRADE
// ─────────────────────────────────────────
export function AdminRoiTrade() {
  const [toast, setToast] = useState(null)
  const [roiTradeName, setRoiTradeName] = useState('Daily Trade Session')
  const [roiDescription, setRoiDescription] = useState('')
  const [roiOpenTime, setRoiOpenTime] = useState('12:00')
  const [roiCloseTime, setRoiCloseTime] = useState('13:00')
  const [slotRows, setSlotRows] = useState(() =>
    Array.from({ length: ROI_SLOT_DEFAULT }, () => emptySlotRow())
  )
  const [savingSlot, setSavingSlot] = useState(null)
  const [savingAllSlots, setSavingAllSlots] = useState(false)
  const [distributingSlot, setDistributingSlot] = useState(null)
  const [reportModal, setReportModal] = useState(null)
  const [reportPayload, setReportPayload] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportPkgFilter, setReportPkgFilter] = useState([])
  const [reportSlotFilter, setReportSlotFilter] = useState([])

  const { data: today, refetch: refetchToday } = useApi(() => roiAPI.getToday())
  const { data: historyRaw, loading: histLoading } = useApi(() => roiAPI.getAll())
  const history = Array.isArray(historyRaw) ? historyRaw : []
  const { mutate: createTrade, loading: creating } = useMutation((p) => roiAPI.create(p))
  const { mutate: updateTodayTrade, loading: savingToday } = useMutation((p) => roiAPI.updateToday(p))
  const { mutate: openTrade, loading: opening } = useMutation((p) => roiAPI.open(p ?? {}))
  const { mutate: closeTrade, loading: closing } = useMutation((id) => roiAPI.close(id))

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const payload = () => ({
    trade_name: roiTradeName.trim() || 'Daily Trade Session',
    description: roiDescription.trim(),
    open_time: roiOpenTime,
    close_time: roiCloseTime,
    topup_tiers: slotRows.map((r) => {
      const n = Number(r.amount)
      return Number.isFinite(n) && n >= 0 ? n : 0
    }),
    slot_windows: slotRows.map((r) => ({
      open_time: r.open,
      close_time: r.close,
      trade_name: String(r.tradeName ?? '').trim() || null,
      description: String(r.slotDesc ?? '').trim() || null,
    })),
  })

  const bodyForSlotRow = (row) => ({
    open_time: row.open,
    close_time: row.close,
    amount: row.amount,
    trade_name: String(row.tradeName ?? '').trim() || null,
    description: String(row.slotDesc ?? '').trim() || null,
  })

  const resizeSlotRows = (target) => {
    const next = Math.min(ROI_SLOT_MAX, Math.max(1, Math.floor(Number(target)) || 1))
    setSlotRows((prev) => {
      if (next === prev.length) return prev
      if (next > prev.length) {
        const extra = Array.from({ length: next - prev.length }, () => emptySlotRow(roiOpenTime, roiCloseTime))
        return [...prev, ...extra]
      }
      return prev.slice(0, next)
    })
    setSlotCountDraft(String(next))
  }
  const bumpSlotCount = (delta) => {
    const parsed = parseInt(String(slotCountDraft).trim(), 10)
    const base = Number.isFinite(parsed) && parsed >= 1 ? parsed : slotRows.length
    resizeSlotRows(base + delta)
  }
  const [slotCountDraft, setSlotCountDraft] = useState(String(ROI_SLOT_DEFAULT))
  const commitSlotCountDraft = () => {
    const v = parseInt(String(slotCountDraft).trim(), 10)
    if (!Number.isFinite(v) || v < 1) {
      setSlotCountDraft(String(slotRows.length))
      return
    }
    resizeSlotRows(v)
  }
  const setSlotRow = (i, field, value) => {
    setSlotRows((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }
  const applyDefaultTimesToAllSlots = () => {
    setSlotRows((prev) => prev.map((r) => ({ ...r, open: roiOpenTime, close: roiCloseTime })))
  }
  const hydratedForTradeId = useRef(null)

  const todayHydrateKey = useMemo(() => {
    if (!today?.id) return null
    return `${today.id}|${JSON.stringify(today.slot_windows ?? [])}|${today.open_time}|${today.close_time}|${(today.topup_tiers ?? []).length}`
  }, [today])

  useEffect(() => {
    if (!todayHydrateKey || !today?.id) {
      hydratedForTradeId.current = null
      return
    }
    if (hydratedForTradeId.current === todayHydrateKey) return
    hydratedForTradeId.current = todayHydrateKey
    setRoiTradeName(today.trade_name || 'Daily Trade Session')
    setRoiDescription(typeof today.description === 'string' ? today.description : '')
    const { rows, n, sessionOpen, sessionClose } = slotRowsFromTrade(today)
    setSlotRows(rows)
    setSlotCountDraft(String(n))
    setRoiOpenTime(sessionOpen)
    setRoiCloseTime(sessionClose)
  }, [todayHydrateKey, today])

  useEffect(() => {
    if (!today?.id) return undefined
    const openSlots = Array.isArray(today.slots)
      ? today.slots.some((s) => s.status === 'open' || s.status === 'scheduled')
      : today.status !== 'closed'
    if (!openSlots && today.status === 'closed') return undefined
    const id = setInterval(() => refetchToday(), 30000)
    return () => clearInterval(id)
  }, [today?.id, today?.status, today?.slots, refetchToday])

  const fmtHm = (t) => formatTimeHm(t, '—')

  const slotStatusBadge = (status) => {
    const s = status || 'scheduled'
    const type = s === 'open' ? 'success' : s === 'closed' ? 'default' : 'warning'
    return <Badge type={type}>{s}</Badge>
  }

  const fetchRoiReport = async (id, filters = { packages: [], slots: [] }) => {
    setReportLoading(true)
    setReportPayload(null)
    try {
      const params = {}
      const pk = filters.packages || []
      const sl = filters.slots || []
      if (pk.length) params.packages = pk.join(',')
      if (sl.length) params.slots = sl.join(',')
      const res = await roiAPI.getReport(id, { params })
      setReportPayload(res.data)
    } catch (e) {
      notify(e.response?.data?.error || e.message, 'danger')
      setReportModal(null)
    } finally {
      setReportLoading(false)
    }
  }

  const openRoiReport = (id) => {
    setReportModal(id)
    setReportPkgFilter([])
    setReportSlotFilter([])
    fetchRoiReport(id, { packages: [], slots: [] })
  }

  const applyRoiReportFilters = () => {
    if (!reportModal) return
    fetchRoiReport(reportModal, { packages: reportPkgFilter, slots: reportSlotFilter })
  }

  const resetRoiReportFilters = () => {
    setReportPkgFilter([])
    setReportSlotFilter([])
    if (reportModal) fetchRoiReport(reportModal, { packages: [], slots: [] })
  }

  const toggleReportPkg = (amt) => {
    setReportPkgFilter((prev) =>
      prev.includes(amt) ? prev.filter((x) => x !== amt) : [...prev, amt].sort((a, b) => a - b)
    )
  }

  const toggleReportSlot = (slot) => {
    setReportSlotFilter((prev) =>
      prev.includes(slot) ? prev.filter((x) => x !== slot) : [...prev, slot].sort((a, b) => a - b)
    )
  }

  const mergeSlotSaveResponse = (i, data) => {
    if (!data) return
    setSlotRows((prev) => {
      const next = [...prev]
      const w = data.slot_window || (Array.isArray(data.slot_windows) ? data.slot_windows[i] : null)
      if (!w) return prev
      next[i] = {
        ...next[i],
        open: formatTimeHm(w.open_time, next[i].open),
        close: formatTimeHm(w.close_time, next[i].close),
        tradeName: typeof w.trade_name === 'string' ? w.trade_name : next[i].tradeName,
        slotDesc: typeof w.description === 'string' ? w.description : next[i].slotDesc,
        amount: data.topup_tiers?.[i] != null ? String(data.topup_tiers[i]) : next[i].amount,
      }
      return next
    })
    if (data.open_time) setRoiOpenTime(formatTimeHm(data.open_time, roiOpenTime))
    if (data.close_time) setRoiCloseTime(formatTimeHm(data.close_time, roiCloseTime))
  }

  const saveSlotsBlockedReason = !today?.id
    ? "Create today's session first — then Save will work."
    : null

  const ensureTodaySessionForSave = async () => {
    if (today?.id) return today
    await createTrade(payload())
    hydratedForTradeId.current = null
    const fresh = await refetchToday()
    if (!fresh?.id) throw new Error('Session was not created — please try again.')
    notify('Session created — you can save slots now.', 'info')
    return fresh
  }

  const handleSaveSlotRow = async (i) => {
    const row = slotRows[i]
    if (!String(row.open || '').trim() || !String(row.close || '').trim()) {
      notify(`Slot ${i}: Enter both Open IST and Close IST times.`, 'danger')
      return
    }
    if (savingAllSlots) return
    setSavingSlot(i)
    try {
      if (!today?.id) await ensureTodaySessionForSave()
      const res = await roiAPI.updateTodaySlot(i, bodyForSlotRow(row))
      mergeSlotSaveResponse(i, res.data)
      notify(res.data?.message || `Slot ${i} saved`)
      hydratedForTradeId.current = null
      await refetchToday()
    } catch (e) {
      notify(e.response?.data?.error || e.message, 'danger')
    } finally {
      setSavingSlot(null)
    }
  }

  const handleSaveAllSlotsSeparate = async () => {
    for (let j = 0; j < slotRows.length; j++) {
      const r = slotRows[j]
      if (!String(r.open || '').trim() || !String(r.close || '').trim()) {
        notify(`Slot ${j}: Enter both Open IST and Close IST times.`, 'danger')
        return
      }
    }
    setSavingAllSlots(true)
    setSavingSlot(null)
    try {
      if (!today?.id) await ensureTodaySessionForSave()
      const session = today?.id ? today : await refetchToday()
      const serverN = Array.isArray(session?.topup_tiers) ? session.topup_tiers.length : 0
      if (slotRows.length !== serverN) {
        await updateTodayTrade(payload())
        hydratedForTradeId.current = null
        await refetchToday()
      }
      for (let i = 0; i < slotRows.length; i++) {
        setSavingSlot(i)
        const res = await roiAPI.updateTodaySlot(i, bodyForSlotRow(slotRows[i]))
        mergeSlotSaveResponse(i, res.data)
      }
      notify(`${slotRows.length} slots saved separately.`)
      hydratedForTradeId.current = null
      await refetchToday()
    } catch (e) {
      notify(e.response?.data?.error || e.message || String(e), 'danger')
    } finally {
      setSavingAllSlots(false)
      setSavingSlot(null)
    }
  }

  const handleSaveTodaySession = async () => {
    try {
      if (!today?.id) {
        await createTrade(payload())
        notify('Session created and saved.')
        hydratedForTradeId.current = null
        await refetchToday()
        return
      }
      const msg = await updateTodayTrade(payload())
      notify(msg?.message || 'Full session saved at once (PUT) — name, tiers, and all slot windows.')
      hydratedForTradeId.current = null
      await refetchToday()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const handleDistributeSlot = async (slotIndex) => {
    if (!today?.id) return
    if (!window.confirm(`Distribute Slot ${slotIndex} now? Trade + level income will be credited to joined members. This runs only once per slot — continue?`)) return
    setDistributingSlot(slotIndex)
    try {
      const res = await roiAPI.distributeSlot(today.id, slotIndex)
      notify(res.data?.message || `Slot ${slotIndex} OK`)
      refetchToday()
    } catch (e) {
      notify(e.response?.data?.error || e.message, 'danger')
    } finally {
      setDistributingSlot(null)
    }
  }

  const handleCreate = async () => {
    try {
      await createTrade(payload())
      notify('Session scheduled. Auto-open / auto-close at IST times (keep the server running).')
      refetchToday()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const handleManualOpen = async () => {
    try {
      await openTrade({})
      notify('Session opened manually.')
      refetchToday()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const handleLegacyOpenOnly = async () => {
    try {
      await openTrade(payload())
      notify('Session open (direct row).')
      refetchToday()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const handleCreateAndOpen = async () => {
    try {
      await createTrade(payload())
      await openTrade({})
      notify('Created and opened — members can join now (auto-close still runs at close time).')
      refetchToday()
    } catch (e) {
      try {
        await openTrade({})
        notify('Session opened')
        refetchToday()
      } catch (e2) {
        notify(e2.message, 'danger')
      }
    }
  }

  const handleClose = async () => {
    if (!window.confirm('Close this session? Members not yet distributed (active + pending) will be paid now; if slot-wise payouts already ran, only remaining balances apply. Continue?')) return
    try {
      const r = await closeTrade(today.id)
      notify(r.message || 'Done')
      refetchToday()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const HIST_COLS = [
    { key: 'trade_date', label: 'Date', render: (v) => fmt.date(v) },
    {
      key: 'trade_name',
      label: 'Trade',
      render: (v) => <span style={{ fontWeight: 600, maxWidth: 140, display: 'inline-block' }}>{v || '—'}</span>,
    },
    { key: 'status', label: 'Status', render: (v) => <Badge type={v}>{v}</Badge> },
    {
      key: 'window',
      label: 'IST window',
      render: (_, r) => (
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>
          {fmtHm(r.open_time)} → {fmtHm(r.close_time)}
        </span>
      ),
    },
    {
      key: 'total_distributed',
      label: 'Distributed',
      render: (v) => (
        <span style={{ color: 'var(--green)', fontWeight: 500, fontFamily: 'JetBrains Mono,monospace' }}>{fmt.usd(v, 2)}</span>
      ),
    },
    { key: 'opened_by_name', label: 'By', render: (v) => v || 'Admin' },
    { key: 'closed_at', label: 'Closed', render: (v) => fmt.time(v) },
    {
      key: '_aud',
      label: 'Report',
      render: (_, r) => (
        <Btn type="button" variant="ghost" size="sm" onClick={() => openRoiReport(r.id)}>
          {r.status === 'closed' ? 'Detail' : 'Live'}
        </Btn>
      ),
    },
  ]

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-title">Trade Income</div>
        <div className="page-subtitle">
          A <strong>vertical timeline</strong>: each box is a ladder slot — USD, IST window, name / note, separate <strong>Save</strong>. Session actions and history below.
        </div>
      </div>
      {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}

      <div className="mb-6">
        <Card
          title="Today's Trade Income"
          action={
            today ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Btn type="button" variant="ghost" size="sm" icon="📊" onClick={() => openRoiReport(today.id)}>
                  Full report / Excel
                </Btn>
                <Badge type={today.status}>{today.status}</Badge>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Draft</span>
            )
          }
        >
          {today ? (
            <div
              style={{
                marginBottom: 20,
                padding: '14px 16px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.07), rgba(168, 85, 247, 0.06))',
                border: '1px solid rgba(0, 229, 255, 0.18)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '14px 22px',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>Date</div>
                <div style={{ fontWeight: 500, marginTop: 4 }}>{fmt.date(today.trade_date)}</div>
              </div>
              <div style={{ width: 1, minHeight: 36, background: 'var(--border-sm)', alignSelf: 'stretch', opacity: 0.85 }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
                  Session IST (auto envelope)
                </div>
                <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, marginTop: 4, color: 'var(--cyan)' }}>
                  {fmtHm(today.open_time)} → {fmtHm(today.close_time)}
                </div>
              </div>
              <div style={{ width: 1, minHeight: 36, background: 'var(--border-sm)', alignSelf: 'stretch', opacity: 0.85 }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>Joined</div>
                <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, marginTop: 4, color: 'var(--green)' }}>
                  {today.participantCount ?? 0}
                </div>
              </div>
              <div style={{ width: 1, minHeight: 36, background: 'var(--border-sm)', alignSelf: 'stretch', opacity: 0.85 }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>Trade (ledger)</div>
                <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, marginTop: 4, color: 'var(--cyan)' }}>
                  {fmt.usd2(today.ledgerRoiPaid ?? 0)}
                </div>
              </div>
              <div style={{ width: 1, minHeight: 36, background: 'var(--border-sm)', alignSelf: 'stretch', opacity: 0.85 }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>Level (ledger)</div>
                <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, marginTop: 4, color: 'var(--purple)' }}>
                  {fmt.usd2(today.ledgerLevelPaid ?? 0)}
                </div>
              </div>
              <div style={{ width: 1, minHeight: 36, background: 'var(--border-sm)', alignSelf: 'stretch', opacity: 0.85 }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>Paid total</div>
                <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, marginTop: 4, color: 'var(--green)' }}>
                  {fmt.usd2(today.ledgerDistributionTotal ?? Number(today.ledgerRoiPaid || 0) + Number(today.ledgerLevelPaid || 0))}
                </div>
              </div>
              <div style={{ width: 1, minHeight: 36, background: 'var(--border-sm)', alignSelf: 'stretch', opacity: 0.85 }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>Batch Trade field</div>
                <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, marginTop: 4, color: 'var(--text-2)' }}>{fmt.usd(today.total_distributed, 2)}</div>
              </div>
              <div style={{ width: 1, minHeight: 36, background: 'var(--border-sm)', alignSelf: 'stretch', opacity: 0.85 }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>Slots</div>
                <div style={{ fontWeight: 500, marginTop: 4 }}>{today.topup_tiers?.length ?? slotRows.length}</div>
              </div>
            </div>
          ) : null}

          {today ? (
            <div
              style={{
                marginBottom: 20,
                padding: 14,
                borderRadius: 12,
                border: '1px dashed var(--border-sm)',
                background: 'linear-gradient(180deg, rgba(0,0,0,0.04), transparent)',
              }}
            >
              <div
                style={{
                  fontWeight: 500,
                  fontSize: 11,
                  color: 'var(--text-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  marginBottom: 10,
                }}
              >
                DB snapshot — current saved state (edit via forms below)
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{today.trade_name || 'Daily Trade Session'}</div>
              {today.description ? (
                <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, maxHeight: 72, overflow: 'hidden' }}>
                  {today.description}
                </p>
              ) : null}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, maxWidth: 560 }}>
                {(Array.isArray(today.topup_tiers) ? today.topup_tiers : []).map((amt, i) => {
                  const w = Array.isArray(today.slot_windows) ? today.slot_windows[i] : null
                  const tw = w ? `${formatTimeHm(w.open_time)}–${formatTimeHm(w.close_time)}` : '—'
                  const st = w?.trade_name ? String(w.trade_name) : ''
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '10px 6px',
                        background: 'var(--bg-card2)',
                        borderRadius: 10,
                        textAlign: 'center',
                        fontSize: 10,
                        border: '1px solid var(--border-sm)',
                      }}
                    >
                      <div style={{ color: 'var(--text-3)', fontWeight: 500, fontFamily: 'JetBrains Mono,monospace' }}>{i}</div>
                      {st ? <div style={{ fontWeight: 600, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.25, fontSize: 10 }}>{st}</div> : null}
                      <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, marginTop: 6, fontSize: 11 }}>{fmt.usd2(Number(amt) || 0)}</div>
                      <div style={{ color: 'var(--cyan)', marginTop: 4, fontFamily: 'JetBrains Mono,monospace', fontSize: 10 }}>{tw}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 16,
                marginBottom: 14,
              }}
            >
              <FormGroup label="Trade name" hint="Full session title — large heading shown to members.">
                <Input value={roiTradeName} onChange={(e) => setRoiTradeName(e.target.value)} placeholder="e.g. Today's Trade — 7 May" />
              </FormGroup>
              <FormGroup label="Description" hint="Note for the whole session (optional).">
                <Textarea value={roiDescription} onChange={(e) => setRoiDescription(e.target.value)} rows={3} placeholder="Full session — short overview..." />
              </FormGroup>
            </div>

            <details
              className="mb-4"
              style={{
                borderRadius: 10,
                border: '1px solid var(--border-sm)',
                background: 'var(--bg-card2)',
                padding: '10px 14px',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 500, fontSize: 13, color: 'var(--text-2)', listStyle: 'none' }}>
                ℹ How it works / save flow
              </summary>
              <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.65 }}>
                Each <strong>timeline card</strong> = one ladder slot (0, 1, 2…). <strong>Open / Close</strong> = that member-slot&apos;s IST join window;
                name / note is shown to members only at that index. Session overall <strong>auto open = earliest</strong> open;
                <strong> auto close = latest</strong> close. Once a session is in the DB, the server <strong>clones</strong> the next IST day&apos;s row (every-minute cron) —
                daily manual Create is not required. Changes: <strong>Save</strong> on a card, or all at once via <strong>PATCH all</strong> / full <strong>PUT</strong>.
              </p>
            </details>

            {today?.status === 'closed' && (
              <Alert type="info" className="mb-4" style={{ fontSize: 13 }}>
                Session <strong>closed</strong> — you can still save slot times. If the new close time is still{' '}
                <strong>after</strong> current IST (e.g. slot 16 → 16:00–20:00), saving will <strong>re-open</strong> the
                session and members can join again.
              </Alert>
            )}

            <FormGroup
              label="Slot timeline (each box = one ladder step)"
              hint="Vertical line below = sequence; each card has only that slot's fields."
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'flex-end',
                  gap: 12,
                  marginBottom: 18,
                  padding: '14px 16px',
                  background: 'var(--bg-card2)',
                  borderRadius: 12,
                  border: '1px solid var(--border-sm)',
                }}
              >
                <div style={{ minWidth: 120 }}>
                  <label className="form-label">Default open (IST)</label>
                  <Input type="time" value={roiOpenTime} onChange={(e) => setRoiOpenTime(e.target.value)} />
                </div>
                <div style={{ minWidth: 120 }}>
                  <label className="form-label">Default close (IST)</label>
                  <Input type="time" value={roiCloseTime} onChange={(e) => setRoiCloseTime(e.target.value)} />
                </div>
                <Btn type="button" variant="ghost" size="sm" onClick={applyDefaultTimesToAllSlots}>
                  Apply to all cards
                </Btn>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', paddingBottom: 8, fontWeight: 600 }}>Total slots</span>
                  <Btn type="button" variant="ghost" size="sm" onClick={() => bumpSlotCount(-1)} disabled={slotRows.length <= 1}>
                    −
                  </Btn>
                  <Input
                    type="number"
                    min={1}
                    max={ROI_SLOT_MAX}
                    value={slotCountDraft}
                    onChange={(e) => setSlotCountDraft(e.target.value)}
                    onBlur={commitSlotCountDraft}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitSlotCountDraft()
                        e.currentTarget.blur()
                      }
                    }}
                    style={{ width: 64, textAlign: 'center' }}
                    title="1–48, Enter or click outside"
                  />
                  <Btn type="button" variant="ghost" size="sm" onClick={() => bumpSlotCount(1)} disabled={slotRows.length >= ROI_SLOT_MAX}>
                    +
                  </Btn>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', paddingBottom: 8 }}>max {ROI_SLOT_MAX}</span>
                </div>
              </div>

              <div style={{ position: 'relative', paddingLeft: 22, maxHeight: 'min(70vh, 640px)', overflowY: 'auto' }}>
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 7,
                    top: 18,
                    bottom: 18,
                    width: 2,
                    borderRadius: 2,
                    background: 'linear-gradient(180deg, var(--cyan), rgba(168,85,247,0.85))',
                    opacity: 0.55,
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {slotRows.map((row, i) => {
                    const hue = (i * 47) % 360
                    return (
                      <div key={i} style={{ position: 'relative', paddingLeft: 8 }}>
                        <div
                          aria-hidden
                          style={{
                            position: 'absolute',
                            left: -19,
                            top: 20,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: `hsl(${hue} 65% 48% / 0.95)`,
                            boxShadow: '0 0 0 3px var(--bg-card)',
                          }}
                        />
                        <div
                          style={{
                            border: '1px solid var(--border-sm)',
                            borderRadius: 12,
                            overflow: 'hidden',
                            background: 'var(--bg-card)',
                            borderLeft: `3px solid hsl(${hue} 60% 45%)`,
                            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              padding: '12px 14px',
                              background: 'var(--bg-card2)',
                              borderBottom: '1px solid var(--border-sm)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontFamily: 'JetBrains Mono,monospace',
                                  fontWeight: 500,
                                  fontSize: 15,
                                  color: 'var(--text-1)',
                                }}
                              >
                                Slot {i}
                              </span>
                              <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: 'var(--cyan)', fontWeight: 500 }}>
                                {String(row.open || '—').slice(0, 5)} – {String(row.close || '—').slice(0, 5)} IST
                              </span>
                              {today?.slots?.[i]?.status ? slotStatusBadge(today.slots[i].status) : null}
                              {row.tradeName?.trim() ? (
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', maxWidth: 220 }} title={row.tradeName}>
                                  {row.tradeName}
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>no slot name</span>
                              )}
                            </div>
                            <Btn
                              type="button"
                              variant="primary"
                              size="sm"
                              loading={savingSlot === i}
                              disabled={savingAllSlots || (savingSlot !== null && savingSlot !== i)}
                              title={saveSlotsBlockedReason || (today?.status === 'closed' ? 'Closed session — config still saves for next day clone' : undefined)}
                              onClick={() => handleSaveSlotRow(i)}
                              icon="💾"
                            >
                              Save slot
                            </Btn>
                          </div>
                          <div style={{ padding: '14px 14px 16px', display: 'grid', gap: 12 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12 }}>
                              <div>
                                <label className="form-label">USD (ladder base)</label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={row.amount}
                                  onChange={(e) => setSlotRow(i, 'amount', e.target.value)}
                                  style={{ fontFamily: 'JetBrains Mono,monospace' }}
                                />
                              </div>
                              <div>
                                <label className="form-label">Open IST</label>
                                <Input type="time" value={row.open} onChange={(e) => setSlotRow(i, 'open', e.target.value)} />
                              </div>
                              <div>
                                <label className="form-label">Close IST</label>
                                <Input type="time" value={row.close} onChange={(e) => setSlotRow(i, 'close', e.target.value)} />
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                              <div>
                                <label className="form-label">Slot name (shown to members)</label>
                                <Input value={row.tradeName} onChange={(e) => setSlotRow(i, 'tradeName', e.target.value)} placeholder="e.g. Morning / Evening window" />
                              </div>
                              <div>
                                <label className="form-label">Short note</label>
                                <Input value={row.slotDesc} onChange={(e) => setSlotRow(i, 'slotDesc', e.target.value)} placeholder="Optional — slot detail" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </FormGroup>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.5 }}>
              Session envelope: <strong>earliest</strong> open + <strong>latest</strong> close (synced on server PATCH/PUT).
            </div>
            {today ? (
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Btn
                  variant="primary"
                  full
                  loading={savingAllSlots}
                  disabled={savingToday}
                  onClick={handleSaveAllSlotsSeparate}
                  icon="▣"
                >
                  Save all slots (one by one)
                </Btn>
                <Btn variant="ghost" full loading={savingToday} disabled={savingAllSlots} onClick={handleSaveTodaySession} icon="💾">
                  Save full session (all slots at once)
                </Btn>
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, lineHeight: 1.45 }}>
                  Use <strong>Save slot</strong> on each card, or the batch buttons above. First save without a session auto-creates one.
                </p>
              </div>
            ) : (
              <div style={{ marginTop: 18 }}>
                <Alert type="warning" className="mb-3">
                  Today&apos;s session is not created yet — pressing <strong>Save slot</strong> creates a session with your settings, or use <strong>Create</strong> below first.
                </Alert>
              </div>
            )}
          </div>

          {!today ? (
            <>
              <Alert type="info" className="mb-4" style={{ fontSize: 13, lineHeight: 1.55 }}>
                <strong>Daily auto:</strong> if yesterday (or any prior) session exists in the DB, today&apos;s <strong>scheduled</strong> row is created by the backend within ~1 minute —
                saved times / slots match the previous session. On first deploy / empty DB, <strong>Create today&apos;s session</strong> below is still required.
              </Alert>
              <Alert type="warning">Today&apos;s session is not visible yet — auto-clone has not run, or there is no prior session in the DB.</Alert>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
                Refresh the page. If it still does not appear, click <strong>Create</strong>. Open/close remain automatic at IST (cron).
                <br />
                <strong>Create &amp; open now:</strong> opens immediately (auto payout still runs at close time).
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Btn variant="primary" full loading={creating} onClick={handleCreate} icon="+">
                  Create today&apos;s session
                </Btn>
                <Btn variant="success" full loading={opening || creating} onClick={handleCreateAndOpen} icon="⬆">
                  Create &amp; open now
                </Btn>
                <Btn variant="ghost" full loading={opening} onClick={handleLegacyOpenOnly}>
                  Open only (no schedule row)
                </Btn>
              </div>
            </>
          ) : (
            <>
              {today.status === 'scheduled' && (
                <>
                  <Alert type="info" className="mb-4">
                    Currently <strong>scheduled</strong> — slots <strong>auto-open</strong> at their IST times; each slot <strong>auto-settles</strong> (Trade + close) at its own close time. Session ends when all slots are settled.
                  </Alert>
                  <Btn variant="success" full loading={opening} onClick={handleManualOpen} icon="⬆">
                    Open now (manual)
                  </Btn>
                </>
              )}
              {today.status === 'open' && (
                <>
                  <Alert type="success" className="mb-4">
                    <strong>Automatic settlement:</strong> each slot opens at its IST open time and{' '}
                    <strong>settles on its own at close time</strong> (Trade paid + slot closed). Keep the backend server running — no admin action needed.
                  </Alert>
                  <details style={{ marginBottom: 12 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>
                      Manual override (optional)
                    </summary>
                    <div
                      style={{
                        marginTop: 12,
                        padding: 14,
                        background: 'var(--bg-card2)',
                        borderRadius: 10,
                        border: '1px solid var(--border-sm)',
                      }}
                    >
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.45 }}>
                        Use only if automation was offline during a slot close window.
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        {(Array.isArray(today.topup_tiers) ? today.topup_tiers : []).map((_, i) => {
                          const pend = Array.isArray(today.slotPendingCounts) ? Number(today.slotPendingCounts[i] ?? 0) : 0
                          const joined = Array.isArray(today.slotJoinedCounts) ? Number(today.slotJoinedCounts[i] ?? 0) : 0
                          const st = today.slots?.[i]?.status
                          return (
                            <Btn
                              key={i}
                              type="button"
                              variant="ghost"
                              size="sm"
                              loading={distributingSlot === i}
                              disabled={st === 'closed' || (distributingSlot !== null && distributingSlot !== i)}
                              onClick={() => handleDistributeSlot(i)}
                              title={`Slot ${i}: ${st || '—'} · joined ${joined}, pending ${pend}`}
                            >
                              Slot {i}
                              {joined > 0 ? (
                                <span style={{ fontFamily: 'JetBrains Mono,monospace', marginLeft: 6 }}>
                                  ({pend > 0 ? `${pend} pending` : 'ok'})
                                </span>
                              ) : null}
                            </Btn>
                          )
                        })}
                      </div>
                      <Btn variant="danger" full loading={closing} disabled={distributingSlot !== null} onClick={handleClose} icon="⊠">
                        Close full session + pay all remaining
                      </Btn>
                    </div>
                  </details>
                </>
              )}
              {today.status === 'closed' && (
                <Alert type="success">
                  Complete — use <strong>Full report / Excel</strong> on the card above or <strong>Detail</strong> in history.
                </Alert>
              )}
            </>
          )}
        </Card>
      </div>

      <Card title="Trade History" noPad>
        <div style={{ padding: '0 0 8px' }}>
          <Table cols={HIST_COLS} rows={history} loading={histLoading} emptyText="No trade history" emptyIcon="📈" />
        </div>
      </Card>

      <Modal
        open={!!reportModal}
        onClose={() => {
          setReportModal(null)
          setReportPayload(null)
          setReportPkgFilter([])
          setReportSlotFilter([])
        }}
        title={reportPayload?.trade?.trade_name ? `${reportPayload.trade.trade_name} (#${reportModal})` : `Trade report · #${reportModal}`}
        maxWidth={960}
      >
        <div style={{ maxHeight: 'min(78vh, 760px)', overflowY: 'auto', paddingRight: 6 }}>
          {reportLoading && <Spinner />}
          {reportPayload && !reportLoading && (
            <div style={{ fontSize: 13 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <StatCard
                  icon="👥"
                  label="Joined (filter below)"
                  value={String(reportPayload.filteredTotals?.participant_count ?? 0)}
                  sub={
                    reportPayload.sessionMeta?.total_participants != null
                      ? `Full session: ${reportPayload.sessionMeta.total_participants}`
                      : undefined
                  }
                  color="cyan"
                />
                <StatCard
                  icon="📈"
                  label="Trade credited (filter)"
                  value={fmt.usd2(reportPayload.filteredTotals?.roi_paid_sum)}
                  sub={`Session ledger: ${fmt.usd2(reportPayload.totalsFromLedger?.roi_to_participants)}`}
                  color="green"
                />
                <StatCard
                  icon="🔗"
                  label="Level (filter)"
                  value={fmt.usd2(reportPayload.filteredTotals?.level_income_sum)}
                  sub={`Session ledger: ${fmt.usd2(reportPayload.totalsFromLedger?.level_income_total)}`}
                  color="purple"
                />
                <StatCard
                  icon="Σ"
                  label="Distribution (filter)"
                  value={fmt.usd2(reportPayload.filteredTotals?.distribution_sum)}
                  sub={`Session trade+level: ${fmt.usd2(reportPayload.totalsFromLedger?.distribution_grand_total)}`}
                  color="gold"
                />
              </div>

              <div
                style={{
                  marginBottom: 16,
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid var(--border-sm)',
                  background: 'var(--bg-card2)',
                }}
              >
                <div style={{ fontWeight: 500, marginBottom: 10, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>
                  Plan &amp; ladder filter
                </div>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.55 }}>
                  Package = member plan USD. Ladder slot = their Trade step when joining the session. Level income = earned from <strong>downline Trade</strong> —
                  filter shows only level rows where <code>from_member_id</code> is in this joined-member set.
                </p>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 8 }}>Plan (tap = on/off)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PACKAGES.map((p) => {
                      const on = reportPkgFilter.includes(p.amount)
                      return (
                        <button
                          key={p.amount}
                          type="button"
                          onClick={() => toggleReportPkg(p.amount)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 999,
                            border: `1px solid ${on ? 'var(--cyan)' : 'var(--border-sm)'}`,
                            background: on ? 'rgba(0,229,255,0.12)' : 'var(--bg-card)',
                            color: 'var(--text-1)',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {p.label} (${p.amount})
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 8 }}>Ladder slot</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {Array.from(
                      {
                        length: Math.min(
                          ROI_SLOT_MAX,
                          Math.max(1, reportPayload.trade?.topup_tiers?.length || 1)
                        ),
                      },
                      (_, i) => {
                        const on = reportSlotFilter.includes(i)
                        return (
                          <label
                            key={i}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: `1px solid ${on ? 'var(--purple)' : 'var(--border-sm)'}`,
                              background: on ? 'rgba(168,85,247,0.1)' : 'var(--bg-card)',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            <input type="checkbox" checked={on} onChange={() => toggleReportSlot(i)} style={{ accentColor: 'var(--purple)' }} />
                            Slot {i}
                          </label>
                        )
                      }
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <Btn type="button" variant="primary" size="sm" onClick={applyRoiReportFilters} icon="🔍">
                    Apply filter / refresh
                  </Btn>
                  <Btn type="button" variant="ghost" size="sm" onClick={resetRoiReportFilters}>
                    Clear all
                  </Btn>
                  <Btn
                    type="button"
                    variant="success"
                    size="sm"
                    icon="⬇"
                    onClick={() => downloadRoiSessionExcel(reportPayload, `live-${reportPayload.trade?.trade_date || reportModal}`)}
                  >
                    Excel download
                  </Btn>
                </div>
                {reportPayload.filter?.active ? (
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--cyan)', fontWeight: 600 }}>
                    Filter ON — tables and Excel below use the filtered data.
                  </div>
                ) : null}
              </div>

              <div style={{ marginBottom: 16, color: 'var(--text-2)', lineHeight: 1.6 }}>
                <strong>Date:</strong> {fmt.date(reportPayload.trade?.trade_date)} · <strong>Status:</strong>{' '}
                {reportPayload.trade?.status} · <strong>Session Trade (ledger):</strong> {fmt.usd2(reportPayload.totalsFromLedger?.roi_to_participants)} ·{' '}
                <strong>Level (ledger):</strong> {fmt.usd2(reportPayload.totalsFromLedger?.level_income_total)}
              </div>
              {reportPayload.trade?.description && (
                <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>{reportPayload.trade.description}</div>
              )}
              {Array.isArray(reportPayload.trade?.topup_tiers) && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 500, marginBottom: 8 }}>Topup slots (0–{reportPayload.trade.topup_tiers.length - 1})</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                    {reportPayload.trade.topup_tiers.map((amt, i) => {
                      const w = reportPayload.trade.slot_windows?.[i]
                      const title = w?.trade_name ? String(w.trade_name) : null
                      return (
                        <div key={i} style={{ padding: 8, background: 'var(--bg-card2)', borderRadius: 8, textAlign: 'center', fontSize: 12 }}>
                          <div style={{ color: 'var(--text-3)' }}>Slot {i}</div>
                          {title ? <div style={{ fontWeight: 600, fontSize: 11, marginTop: 4 }}>{title}</div> : null}
                          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500 }}>{fmt.usd2(Number(amt) || 0)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ fontWeight: 500, marginBottom: 8 }}>Joined members</div>
              <div style={{ maxHeight: 280, overflow: 'auto', marginBottom: 16, borderRadius: 10, border: '1px solid var(--border-sm)' }}>
                <Table
                  cols={[
                    {
                      key: 'name',
                      label: 'Member',
                      render: (v, r) => (
                        <div>
                          <div>{v}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.email}</div>
                        </div>
                      ),
                    },
                    {
                      key: 'package_amount',
                      label: 'Plan',
                      render: (v) => <span style={{ fontSize: 12 }}>{packagePlanLabel(v)}</span>,
                    },
                    {
                      key: 'plan_topup_count',
                      label: 'Topups',
                      render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{v ?? '—'}</span>,
                    },
                    {
                      key: 'topup_slot',
                      label: 'Slot',
                      render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500 }}>{v ?? '—'}</span>,
                    },
                    { key: 'joined_at', label: 'Joined', render: (v) => fmt.time(v) },
                    {
                      key: 'roi_settled_at',
                      label: 'Trade settled',
                      render: (v) => (v ? fmt.time(v) : '—'),
                    },
                  ]}
                  rows={reportPayload.participants}
                  emptyText="No rows"
                />
              </div>

              <div style={{ fontWeight: 500, marginBottom: 8 }}>Trade income credited</div>
              <div style={{ maxHeight: 240, overflow: 'auto', marginBottom: 16, borderRadius: 10, border: '1px solid var(--border-sm)' }}>
                <Table
                  cols={[
                    {
                      key: 'name',
                      label: 'Member',
                      render: (v, r) => (
                        <div>
                          <div>{v}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.email}</div>
                        </div>
                      ),
                    },
                    {
                      key: 'package_amount',
                      label: 'Plan',
                      render: (v) => packagePlanLabel(v),
                    },
                    { key: 'roi_amount', label: 'Trade', render: (v) => <span style={{ color: 'var(--green)', fontWeight: 500 }}>{fmt.usd2(v)}</span> },
                    { key: 'txn_id', label: 'TXN', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10 }}>{v}</span> },
                    { key: 'created_at', label: 'Credited', render: (v) => fmt.time(v) },
                  ]}
                  rows={reportPayload.roiPaidToMembers}
                  emptyText="No Trade rows"
                />
              </div>

              <div style={{ fontWeight: 500, marginBottom: 8 }}>Level income (upline · from this session)</div>
              <div style={{ maxHeight: 220, overflow: 'auto', borderRadius: 10, border: '1px solid var(--border-sm)' }}>
                <Table
                  cols={[
                    {
                      key: 'name',
                      label: 'Earner',
                      render: (v, r) => (
                        <div>
                          <div>{v}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.email}</div>
                        </div>
                      ),
                    },
                    {
                      key: 'package_amount',
                      label: 'Plan',
                      render: (v) => packagePlanLabel(v),
                    },
                    { key: 'level_total', label: 'Total', render: (v) => fmt.usd2(v) },
                  ]}
                  rows={reportPayload.levelIncomeByMember}
                  emptyText="No level rows"
                />
              </div>
            </div>
          )}
        </div>
      </Modal>
    </AdminLayout>
  )
}

// ─────────────────────────────────────────
//  DAY TRADES
// ─────────────────────────────────────────
export function AdminDayTrades() {
  const [toast, setToast] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detailTrade, setDetailTrade] = useState(null)
  const [editTradeId, setEditTradeId] = useState(null)
  const [winnerIds, setWinnerIds] = useState([])
  const [istTick, setIstTick] = useState(0)
  /** null = list all scripts with today's investor stats; string YYYY-MM-DD = filter admin view to that session */
  const [sessionFilter, setSessionFilter] = useState(null)
  const [form, setForm] = useState({
    trade_name: '',
    description: '',
    trade_price: '',
  })
  const [editForm, setEditForm] = useState({
    trade_name: '',
    description: '',
    trade_price: '',
    min_invest: '1',
  })

  const { data: tradesRaw, loading, refetch } = useApi(
    () => dayTradeAPI.getAll(sessionFilter ? { date: sessionFilter } : {}),
    [sessionFilter]
  )
  const trades = Array.isArray(tradesRaw) ? tradesRaw : []
  const { data: investDetail } = useApi(() => detailTrade ? dayTradeAPI.getInvestors(detailTrade) : Promise.resolve({ data: null }), [detailTrade])
  const { mutate: create,   loading: creating  } = useMutation(dayTradeAPI.create)
  const { mutate: updateExisting, loading: updating } = useMutation(({ id, ...data }) => dayTradeAPI.update(id, data))
  const { mutate: removeTrade, loading: deleting } = useMutation((id) => dayTradeAPI.remove(id))
  const { mutate: activate, loading: activating } = useMutation((id) => dayTradeAPI.activate(id))
  const { mutate: deactivate, loading: deactivating } = useMutation((id) => dayTradeAPI.deactivate(id))
  const { mutate: settle,   loading: settling  } = useMutation(dayTradeAPI.settle)

  useEffect(() => {
    const id = setInterval(() => setIstTick((x) => x + 1), 30000)
    return () => clearInterval(id)
  }, [])

  void istTick
  const activateAllowed = isDayTradeActivateAllowed()

  const notify = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setEdit = k => e => setEditForm(f => ({ ...f, [k]: e.target.value }))

  const isCatalogRemoved = (t) => !!t.deleted_at
  const canEditTrade = (t) => !isCatalogRemoved(t) && t.status !== 'active'
  const canDeleteTrade = (t) => !isCatalogRemoved(t) && t.status !== 'active'
  const editBlockReason = (t) => {
    if (isCatalogRemoved(t)) return 'Already removed from catalog'
    if (t.status === 'active') return 'Mark inactive first — member history keeps purchase snapshot'
    return null
  }
  const deleteBlockReason = (t) => {
    if (isCatalogRemoved(t)) return 'Already removed from catalog'
    if (t.status === 'active') return 'Mark inactive first — member history is preserved'
    return null
  }

  const isActiveTodayTrade = (t) =>
    t.status === 'active' && dayTradeSessionYmd(t.trade_date) === getTodayIstYmd()
  /** Previous session still marked active — offer re-activate for today */
  const isStaleActiveDayTrade = (t) =>
    t.status === 'active' && !isActiveTodayTrade(t)
  const canActivateForToday = (t) => {
    if (isActiveTodayTrade(t)) return false
    return t.status === 'inactive' || t.status === 'completed' || isStaleActiveDayTrade(t)
  }
  const canDeactivateTrade = (t) => t.status === 'active'

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await create({
        trade_name: form.trade_name.trim(),
        description: form.description.trim() || undefined,
        last_price: form.trade_price,
        min_invest: 1,
      })
      notify('Trade created')
      setShowCreate(false)
      setForm({ trade_name: '', description: '', trade_price: '' })
      refetch()
    } catch (e) { notify(e.message, 'danger') }
  }

  const openEdit = (t) => {
    setEditTradeId(t.id)
    setEditForm({
      trade_name: t.trade_name || '',
      description: t.description || '',
      trade_price: t.last_price != null ? String(t.last_price) : '',
      min_invest: t.min_invest != null ? String(t.min_invest) : '1',
    })
  }

  const handleUpdateEdit = async (e) => {
    e.preventDefault()
    const minN = Number(editForm.min_invest)
    try {
      await updateExisting({
        id: editTradeId,
        trade_name: editForm.trade_name.trim(),
        description: editForm.description.trim() || undefined,
        last_price: editForm.trade_price,
        min_invest: Number.isFinite(minN) && minN > 0 ? minN : 1,
      })
      notify('Trade updated')
      setEditTradeId(null)
      refetch()
    } catch (err) { notify(err.message, 'danger') }
  }

  const handleDeleteTrade = async (t) => {
    if (!window.confirm(`Delete “${t.trade_name}” permanently? This cannot be undone.`)) return
    try {
      await removeTrade(t.id)
      notify('Trade deleted')
      refetch()
    } catch (err) { notify(err.message, 'danger') }
  }

  const handleActivate = async (id) => {
    try { await activate(id); notify('Activated for today — members can buy until you settle or mark inactive'); refetch() }
    catch(e) { notify(e.message, 'danger') }
  }

  const handleDeactivate = async (t) => {
    const label = t.trade_name ? `"${t.trade_name}"` : `Trade #${t.id}`
    if (!window.confirm(`Mark ${label} inactive? Members will stop seeing it for buying.`)) return
    try {
      await deactivate(t.id)
      notify('Trade marked inactive')
      refetch()
    } catch (e) { notify(e.message, 'danger') }
  }

  const toggleWinnerId = (id) => {
    const n = Number(id)
    setWinnerIds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))
  }

  const activeTrades = trades.filter((t) => isActiveTodayTrade(t))
  const settleableTrades = trades.filter((t) => isSettleableTodayTrade(t))
  const inMemberWindow = isDayTradeBuyWindowOpen()

  const payoutIfWinner = (t) => {
    const invested = Number(t.total_invested ?? 0)
    return parseFloat((invested * 2).toFixed(4))
  }

  const settlementReportRows = [...settleableTrades]
    .sort((a, b) => {
      const invDiff = Number(b.total_investors ?? 0) - Number(a.total_investors ?? 0)
      if (invDiff !== 0) return invDiff
      return Number(b.total_invested ?? 0) - Number(a.total_invested ?? 0)
    })
    .map((t, idx) => ({ ...t, _reportRank: idx + 1 }))

  const topInvestorCount =
    settlementReportRows.length > 0 ? Number(settlementReportRows[0]?.total_investors ?? 0) : 0

  const settleableIdSet = new Set(settleableTrades.map((t) => Number(t.id)))
  const selectedWinnerIds = winnerIds.filter((id) => settleableIdSet.has(Number(id)))
  const selectedSettleTrades = settleableTrades.filter((t) => selectedWinnerIds.includes(Number(t.id)))
  const selectedBuyers = selectedSettleTrades.reduce((s, t) => s + Number(t.total_investors ?? 0), 0)
  const selectedInvested = selectedSettleTrades.reduce((s, t) => s + Number(t.total_invested ?? 0), 0)
  const selectedPayout = parseFloat(
    selectedSettleTrades.reduce((s, t) => s + payoutIfWinner(t), 0).toFixed(4),
  )

  const handleSettle = async () => {
    if (!selectedWinnerIds.length) {
      notify('Select at least one winning trade', 'danger')
      return
    }
    const names = selectedSettleTrades.map((t) => t.trade_name).join(', ')
    const confirmMsg =
      `Mark ${selectedWinnerIds.length} trade(s) as WINNER?\n\n` +
      `${names}\n\n` +
      `Buyers (selected): ${selectedBuyers}\n` +
      `Amount bought: ${fmt.usd2(selectedInvested)}\n` +
      `Payout to pay (2×): ${fmt.usd2(selectedPayout)}\n\n` +
      `Unselected trades will be zeroed. Cannot undo!`
    if (!window.confirm(confirmMsg)) return
    try {
      const r = await settle({ winner_trade_ids: selectedWinnerIds })
      notify(r.message || 'Settled!')
      setWinnerIds([])
      refetch()
    } catch (e) { notify(e.message, 'danger') }
  }

  const SETTLE_REPORT_COLS = [
    {
      key: '_pick',
      label: 'Win',
      render: (_v, r) => (
        <input
          type="checkbox"
          checked={selectedWinnerIds.includes(Number(r.id))}
          onChange={() => toggleWinnerId(r.id)}
          aria-label={`Select ${r.trade_name} as winner`}
        />
      ),
    },
    {
      key: '_reportRank',
      label: '#',
      render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--text-3)' }}>{v}</span>,
    },
    {
      key: 'trade_name',
      label: 'Trade',
      render: (v, r) => (
        <span style={{ fontWeight: 500 }}>
          #{r.id} {v}
          <span style={{ marginLeft: 8, fontFamily: 'JetBrains Mono,monospace', fontWeight: 600, color: 'var(--gold)' }}>
            {r.last_price != null && Number.isFinite(Number(r.last_price)) ? fmt.usd2(r.last_price) : '—'}
          </span>
        </span>
      ),
    },
    {
      key: 'total_investors',
      label: 'Investors (today)',
      render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500 }}>{Number(v ?? 0)}</span>,
    },
    {
      key: 'total_invested',
      label: 'Invested today',
      render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--gold)' }}>{fmt.usd2(v)}</span>,
    },
    {
      key: '_payout',
      label: 'Payout if WIN (2×)',
      render: (_v, r) => (
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, color: 'var(--green)' }}>
          {fmt.usd2(payoutIfWinner(r))}
        </span>
      ),
    },
    {
      key: '_note',
      label: 'Note',
      render: (_v, r) => {
        const n = Number(r.total_investors ?? 0)
        if (selectedWinnerIds.includes(Number(r.id))) {
          return <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>Winner (2×)</span>
        }
        if (selectedWinnerIds.length > 0) {
          return <span style={{ fontSize: 12, color: 'var(--red)' }}>Will be zeroed</span>
        }
        if (n === 0) return <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No buyers today</span>
        if (topInvestorCount > 0 && n === topInvestorCount)
          return <span style={{ fontSize: 12, color: 'var(--cyan)' }}>Most participants</span>
        return null
      },
    },
  ]

  return (
    <AdminLayout>
      <div className="page-header flex-between">
        <div>
          <div className="page-title">Live Trades</div>
          <div className="page-subtitle">Create <strong>unlimited</strong> scripts. <strong>Activate anytime</strong> — members see them from <strong>9:00 AM IST</strong>. Edit/delete is safe — each member purchase stores a <strong>snapshot</strong> (name, price, session); history &amp; payouts never change when you edit the catalog.</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-2)', whiteSpace:'nowrap' }}>
            Session filter
            <input
              type="date"
              className="form-control"
              style={{ width:'auto' }}
              value={sessionFilter ?? ''}
              onChange={(e) => { const v = e.target.value; setSessionFilter(v || null) }}
              title="Filter the list to one session date (YYYY-MM-DD)"
            />
          </label>
          {sessionFilter && (
            <Btn variant="ghost" size="sm" onClick={() => setSessionFilter(null)}>Clear</Btn>
          )}
          <Btn variant="primary" icon="+" onClick={() => setShowCreate(true)}>Create Trade</Btn>
        </div>
      </div>

      {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}

      <Alert type="info" className="mb-4">
        Members can buy from <strong>9:00 AM IST</strong> until you click <strong>Settle session</strong>. There is <strong>no 5 PM auto-close</strong> — you can settle any time (including after 5 PM).
      </Alert>

      {settleableTrades.length > 0 && (
        <Alert type="success" className="mb-4">
          <strong>{settleableTrades.length} trade(s) pending</strong> — tick one or more winners and click <strong>Settle session</strong>. Unselected trades go to zero. Session stays open until you settle.
        </Alert>
      )}

      {activeTrades.length === 0 && inMemberWindow && (
        <Alert type="warning" className="mb-4">
          <strong>No scripts active for today ({getTodayIstYmd()})</strong> — members see an empty Live Trades page until you activate at least one script below.
        </Alert>
      )}

      <Card title="Settlement — pick today’s winners" className="mb-4">
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
          Tick <strong>one or more</strong> trades as winners. Selected scripts pay <strong>2×</strong> to buyers; unselected trades go to <strong>zero</strong>. You can settle after 5 PM — the session does not auto-close. This cannot be undone.
        </p>
        <Table cols={SETTLE_REPORT_COLS} rows={settlementReportRows} emptyText="No trades to settle for today — activate scripts first" emptyIcon="🎯" />
        {settleableTrades.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 14 }}>
            <Btn
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setWinnerIds(settleableTrades.map((t) => Number(t.id)))}
            >
              Select all
            </Btn>
            <Btn
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setWinnerIds([])}
              disabled={!selectedWinnerIds.length}
            >
              Clear
            </Btn>
            <Btn variant="danger" loading={settling} onClick={handleSettle} disabled={!selectedWinnerIds.length}>
              Settle session ({selectedWinnerIds.length} winner{selectedWinnerIds.length === 1 ? '' : 's'})
            </Btn>
          </div>
        )}
        {selectedSettleTrades.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10,
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              border: '1px solid var(--border-sm)',
              background: 'var(--bg-card2)',
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Winners selected</div>
              <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 600 }}>{selectedWinnerIds.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>People bought</div>
              <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 600 }}>{selectedBuyers}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount bought</div>
              <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 600, color: 'var(--gold)' }}>{fmt.usd2(selectedInvested)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payout to pay (2×)</div>
              <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 600, color: 'var(--green)' }}>{fmt.usd2(selectedPayout)}</div>
            </div>
          </div>
        )}
      </Card>

      {/* Trades Grid */}
      {loading ? <Spinner /> : (
        <div className="grid-trades">
          {trades.map(t => (
            <div key={t.id} className={`trade-card ${t.is_winner ? 'winner' : ''}`}>
              <div className="flex-between mb-3">
                <div>
                  <div style={{ fontWeight:800, fontSize:15 }}>{t.trade_name}</div>
                  {t.trade_symbol && <div style={{ fontSize:12, color:'var(--cyan)', marginTop:2 }}>{t.trade_symbol}</div>}
                </div>
                <Badge type={t.status}>{t.status}</Badge>
              </div>
              {t.description && <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:12, lineHeight:1.5 }}>{t.description}</div>}
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                {[
                  ['LTP', t.last_price != null ? Number(t.last_price).toFixed(4) : '—', 'var(--gold)'],
                  ['Change %', t.change_pct != null ? `${Number(t.change_pct) >= 0 ? '+' : ''}${Number(t.change_pct).toFixed(2)}%` : '—', Number(t.change_pct) >= 0 ? 'var(--green)' : 'var(--red)'],
                  ['Open / High / Low',
                    [t.open_price, t.day_high, t.day_low].every(x => x == null) ? '—'
                      : `${t.open_price != null ? Number(t.open_price).toFixed(2) : '—'} / ${t.day_high != null ? Number(t.day_high).toFixed(2) : '—'} / ${t.day_low != null ? Number(t.day_low).toFixed(2) : '—'}`,
                    'var(--text-2)'],
                  ['Investors (today)', t.total_investors, 'var(--text-1)'],
                  ['Total bought (today)', fmt.usd2(t.total_invested), 'var(--gold)'],
                  ['Min order $', fmt.usd2(t.min_invest), 'var(--text-2)'],
                  ...(isActiveTodayTrade(t)
                    ? [['Payout if WIN (2×)', fmt.usd2(payoutIfWinner(t)), 'var(--green)']]
                    : []),
                ].map(([l,v,c]) => (
                  <div key={l} className="flex-between">
                    <span style={{ fontSize:12, color:'var(--text-2)' }}>{l}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:c, fontFamily:'JetBrains Mono,monospace' }}>{v}</span>
                  </div>
                ))}
                {t.result !== 'pending' && (
                  <div className="flex-between">
                    <span style={{ fontSize:12, color:'var(--text-2)' }}>Result</span>
                    <Badge type={t.result}>{t.result === 'doubled' ? '2x WIN' : 'ZEROED'}</Badge>
                  </div>
                )}
              </div>
              <div className="trade-card-actions" style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                {canActivateForToday(t) && (
                  <Btn variant="success" size="sm" loading={activating} onClick={() => handleActivate(t.id)}>
                    {isStaleActiveDayTrade(t) ? '▶ Re-activate for today' : '▶ Activate for today'}
                  </Btn>
                )}
                {isStaleActiveDayTrade(t) && (
                  <span style={{ fontSize: 11, color: 'var(--orange)', maxWidth: 240, lineHeight: 1.35 }}>
                    Still active from a previous session — re-activate to open for today.
                  </span>
                )}
                {canDeactivateTrade(t) && (
                  <Btn variant="ghost" size="sm" loading={deactivating} onClick={() => handleDeactivate(t)}>
                    ⏸ Mark inactive
                  </Btn>
                )}
                {canEditTrade(t) ? (
                  <Btn variant="outline-cyan" size="sm" onClick={() => openEdit(t)}>Edit</Btn>
                ) : (
                  <Btn variant="outline-cyan" size="sm" disabled title={editBlockReason(t) || 'Cannot edit'}>Edit</Btn>
                )}
                {canDeleteTrade(t) ? (
                  <Btn variant="danger" size="sm" loading={deleting} onClick={() => handleDeleteTrade(t)}>Delete</Btn>
                ) : (
                  <Btn variant="danger" size="sm" disabled title={deleteBlockReason(t) || 'Cannot delete'}>Delete</Btn>
                )}
                <Btn variant="ghost" size="sm" onClick={() => setDetailTrade(t.id)}>👁 Investors</Btn>
              </div>
            </div>
          ))}
          {!trades.length && (
            <Empty
              icon="🎯"
              title={sessionFilter ? 'No trades for that session date' : 'No day-trade scripts yet'}
              desc={sessionFilter ? 'Try clearing the date filter or pick another day.' : 'Create a script — it stays in this list. Use Activate when you want members to buy today.'}
            />
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create live trade">
        <form onSubmit={handleCreate}>
          <FormGroup label="Trade name" required>
            <Input value={form.trade_name} onChange={set('trade_name')} placeholder="e.g. Reliance" required />
          </FormGroup>
          <FormGroup label="Description" hint="Optional note for members">
            <Textarea value={form.description} onChange={set('description')} placeholder="Short details…" rows={3} />
          </FormGroup>
          <FormGroup label="Trade price ($)" required hint="Members: order total = quantity × this price. Minimum order $1 by default.">
            <Input type="number" min="0.0001" step="any" value={form.trade_price} onChange={set('trade_price')} placeholder="e.g. 245.50" required />
          </FormGroup>
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <Btn variant="primary" type="submit" loading={creating}>Create</Btn>
            <Btn variant="ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</Btn>
          </div>
        </form>
      </Modal>

      <Modal
        open={editTradeId != null}
        onClose={() => { setEditTradeId(null) }}
        title="Edit live trade"
      >
        <form onSubmit={handleUpdateEdit}>
          <FormGroup label="Trade name" required>
            <Input value={editForm.trade_name} onChange={setEdit('trade_name')} placeholder="e.g. Reliance" required />
          </FormGroup>
          <FormGroup label="Description" hint="Optional note for members">
            <Textarea value={editForm.description} onChange={setEdit('description')} placeholder="Short details…" rows={3} />
          </FormGroup>
          <FormGroup label="Trade price ($)" required hint="Members: order total = quantity × this price.">
            <Input type="number" min="0.0001" step="any" value={editForm.trade_price} onChange={setEdit('trade_price')} placeholder="e.g. 245.50" required />
          </FormGroup>
          <FormGroup label="Min order ($)" required>
            <Input type="number" min="0.01" step="any" value={editForm.min_invest} onChange={setEdit('min_invest')} required />
          </FormGroup>
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <Btn variant="primary" type="submit" loading={updating}>Save</Btn>
            <Btn variant="ghost" type="button" onClick={() => { setEditTradeId(null) }}>Cancel</Btn>
          </div>
        </form>
      </Modal>

      {/* Investors Modal */}
      <Modal open={!!detailTrade} onClose={() => setDetailTrade(null)} title={`Investors — ${investDetail?.trade?.trade_name || ''}`} maxWidth={640}>
        {investDetail && (
          <>
            <div style={{ display:'flex', gap:24, marginBottom:16, fontSize:13 }}>
              <div><span style={{ color:'var(--text-2)' }}>Total Investors: </span><strong>{investDetail.investors?.length}</strong></div>
              <div><span style={{ color:'var(--text-2)' }}>Total Amount: </span><strong style={{ color:'var(--gold)' }}>{fmt.usd2(investDetail.investors?.reduce((s,i) => s+Number(i.invest_amount),0))}</strong></div>
            </div>
            <Table
              cols={[
                { key:'name', label:'Member', render:(v,r) => <div><div>{v}</div><div style={{ fontSize:11,color:'var(--text-3)' }}>{r.email}</div></div> },
                { key:'quantity', label:'Qty', render: v => <span style={{ fontFamily:'JetBrains Mono,monospace' }}>{v != null ? Number(v) : '—'}</span> },
                { key:'price_at_buy', label:'LTP @ buy', render: v => <span style={{ fontFamily:'JetBrains Mono,monospace',fontSize:12 }}>{v != null ? Number(v).toFixed(4) : '—'}</span> },
                { key:'invest_amount', label:'Total $', render: v => <span style={{ fontFamily:'JetBrains Mono,monospace', color:'var(--gold)' }}>{fmt.usd2(v)}</span> },
                { key:'result_amount', label:'Result', render:(v,r) => <span style={{ color: r.status==='doubled' ? 'var(--green)' : r.status==='zeroed' ? 'var(--red)' : 'var(--text-3)' }}>{r.status==='doubled' ? `+${fmt.usd2(v)}` : r.status==='zeroed' ? '$0' : '—'}</span> },
                { key:'status', label:'Status', render: v => <Badge type={v}>{v}</Badge> },
              ]}
              rows={investDetail.investors}
              emptyText="No investors yet"
            />
          </>
        )}
      </Modal>
    </AdminLayout>
  )
}

// ─────────────────────────────────────────
//  SALARY & REWARD
// ─────────────────────────────────────────
export function AdminSalaryReward() {
  const [tab, setTab] = useState('salary')
  const [toast, setToast] = useState(null)
  const [sf, setSf] = useState({ member_id:'', amount:'', month_year: new Date().toISOString().slice(0,7), remark:'' })
  const [rf, setRf] = useState({ member_id:'', reward_title:'', reward_description:'', reward_value:'', reward_type:'gift' })

  const { data: membersData } = useApi(() => adminMemberAPI.getAll({ status:'active', limit:200 }))
  const { data: salariesRaw, refetch: refS } = useApi(() => adminMemberAPI.getAllSalaries())
  const { data: rewardsRaw, refetch: refR } = useApi(() => adminMemberAPI.getAllRewards())
  const salaries = Array.isArray(salariesRaw) ? salariesRaw : []
  const rewards = Array.isArray(rewardsRaw) ? rewardsRaw : []
  const { mutate: salary, loading: sl } = useMutation(adminMemberAPI.giveSalary)
  const { mutate: reward, loading: rl } = useMutation(adminMemberAPI.giveReward)

  const notify = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  const members = membersData?.members || []

  const submitSalary = async (e) => {
    e.preventDefault()
    const mem = members.find(m => String(m.id) === String(sf.member_id))
    const who = mem ? `${mem.name} (#${mem.id})` : `member #${sf.member_id}`
    if (!window.confirm(`Credit salary of ${fmt.usd2(sf.amount)} to ${who} for ${sf.month_year}? Only one salary per month is allowed.`)) return
    try { await salary(sf); notify('Salary credited to salary wallet!'); setSf(f => ({ ...f, member_id:'', amount:'', remark:'' })); refS() }
    catch(e) { notify(e.message, 'danger') }
  }

  const submitReward = async (e) => {
    e.preventDefault()
    const mem = members.find(m => String(m.id) === String(rf.member_id))
    const who = mem ? `${mem.name} (#${mem.id})` : `member #${rf.member_id}`
    const cash = Number(rf.reward_value) > 0 ? ` Cash value ${fmt.usd2(rf.reward_value)} will be credited to the exchange wallet.` : ''
    if (!window.confirm(`Assign reward "${rf.reward_title}" to ${who}?${cash}`)) return
    try { await reward(rf); notify('Reward assigned successfully!'); setRf(f => ({ ...f, member_id:'', reward_title:'', reward_description:'', reward_value:'' })); refR() }
    catch(e) { notify(e.message, 'danger') }
  }

  const memberOptions = members.map(m => ({ value: m.id, label: `#${m.id} ${m.name} (${m.email})` }))

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-title">Salary & Reward</div>
        <div className="page-subtitle">Assign salary income (salary wallet) and rewards/gifts to members</div>
      </div>
      {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}

      <div style={{ display:'flex', gap:8, marginBottom:24 }}>
        {[['salary','💼','Salary'],['reward','🏆','Reward'],['history','📋','History']].map(([k,i,l]) => (
          <Btn key={k} variant={tab===k ? 'primary' : 'ghost'} onClick={() => setTab(k)}>{i} {l}</Btn>
        ))}
      </div>

      {tab === 'salary' && (
        <div className="grid-2">
          <Card title="💼 Give Salary">
            <Alert type="info" className="mb-4">Salary goes to member's <strong>Salary Wallet</strong></Alert>
            <form onSubmit={submitSalary}>
              <FormGroup label="Member" required><Select value={sf.member_id} onChange={e => setSf(f => ({ ...f, member_id:e.target.value }))} options={memberOptions} placeholder="— Select Member —" required /></FormGroup>
              <FormGroup label="Month" required><Input type="month" value={sf.month_year} onChange={e => setSf(f => ({ ...f, month_year:e.target.value }))} required /></FormGroup>
              <FormGroup label="Amount ($)" required><Input type="number" min="0.01" step="0.01" value={sf.amount} onChange={e => setSf(f => ({ ...f, amount:e.target.value }))} placeholder="50.00" required /></FormGroup>
              <FormGroup label="Remark"><Input value={sf.remark} onChange={e => setSf(f => ({ ...f, remark:e.target.value }))} placeholder="Monthly salary, bonus etc." /></FormGroup>
              <Btn variant="gold" full type="submit" loading={sl}>💼 Credit Salary</Btn>
            </form>
          </Card>
          <Card title="Recent Salaries">
            {salaries.slice(0,15).map(s => (
              <div key={s.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--border-sm)' }}>
                <div className="flex-between mb-1"><span style={{ fontWeight:700,fontSize:14 }}>{s.member_name}</span><span style={{ color:'var(--green)',fontWeight:700,fontFamily:'JetBrains Mono,monospace' }}>{fmt.usd2(s.amount)}</span></div>
                <div style={{ fontSize:12, color:'var(--text-2)' }}>{s.month_year}{s.remark && ` — ${s.remark}`}</div>
              </div>
            ))}
            {!salaries.length && <Empty icon="💼" title="No salary records" />}
          </Card>
        </div>
      )}

      {tab === 'reward' && (
        <div className="grid-2">
          <Card title="🏆 Give Reward">
            <Alert type="info" className="mb-4">Cash rewards go to <strong>Exchange Wallet</strong>. Non-cash gifts tracked separately.</Alert>
            <form onSubmit={submitReward}>
              <FormGroup label="Member" required><Select value={rf.member_id} onChange={e => setRf(f => ({ ...f, member_id:e.target.value }))} options={memberOptions} placeholder="— Select Member —" required /></FormGroup>
              <FormGroup label="Reward Type" required>
                <Select value={rf.reward_type} onChange={e => setRf(f => ({ ...f, reward_type:e.target.value }))} options={[{value:'cash',label:'💵 Cash'},{value:'gift',label:'🎁 Gift'},{value:'voucher',label:'🎟️ Voucher'},{value:'trophy',label:'🏆 Trophy'}]} />
              </FormGroup>
              <FormGroup label="Reward Title" required><Input value={rf.reward_title} onChange={e => setRf(f => ({ ...f, reward_title:e.target.value }))} placeholder="Top Performer Award, Gold Watch..." required /></FormGroup>
              <FormGroup label="Description"><Textarea rows={2} value={rf.reward_description} onChange={e => setRf(f => ({ ...f, reward_description:e.target.value }))} placeholder="For outstanding performance..." /></FormGroup>
              <FormGroup label="Cash Value ($)" hint="Leave 0 for non-cash gifts"><Input type="number" min="0" step="0.01" value={rf.reward_value} onChange={e => setRf(f => ({ ...f, reward_value:e.target.value }))} placeholder="0" /></FormGroup>
              <Btn variant="purple" full type="submit" loading={rl}>🏆 Assign Reward</Btn>
            </form>
          </Card>
          <Card title="Recent Rewards">
            {rewards.slice(0,15).map(r => (
              <div key={r.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--border-sm)' }}>
                <div className="flex-between mb-1">
                  <span style={{ fontWeight:700,fontSize:14 }}>{r.member_name}</span>
                  <Badge type={r.reward_type === 'cash' ? 'active' : 'open'}>{r.reward_type}</Badge>
                </div>
                <div style={{ fontSize:13 }}>{r.reward_title}</div>
                {r.reward_value > 0 && <div style={{ fontSize:12, color:'var(--green)', marginTop:2 }}>{fmt.usd2(r.reward_value)}</div>}
              </div>
            ))}
            {!rewards.length && <Empty icon="🏆" title="No rewards yet" />}
          </Card>
        </div>
      )}

      {tab === 'history' && (
        <div className="grid-2">
          <Card title="All Salaries" noPad>
            <Table cols={[
              { key:'member_name', label:'Member', render:(v,r) => <div><div style={{ fontWeight:600 }}>{v}</div><div style={{ fontSize:11,color:'var(--text-3)' }}>{r.member_email}</div></div> },
              { key:'month_year', label:'Month' },
              { key:'amount', label:'Amount', render: v => <span style={{ color:'var(--green)',fontFamily:'JetBrains Mono,monospace',fontWeight:700 }}>{fmt.usd2(v)}</span> },
              { key:'remark', label:'Remark', render: v => <span style={{ color:'var(--text-2)',fontSize:12 }}>{v||'—'}</span> },
            ]} rows={salaries} emptyText="No salary records" />
          </Card>
          <Card title="All Rewards" noPad>
            <Table cols={[
              { key:'member_name', label:'Member', render:(v,r) => <div><div style={{ fontWeight:600 }}>{v}</div><div style={{ fontSize:11,color:'var(--text-3)' }}>{r.member_email}</div></div> },
              { key:'reward_title', label:'Reward' },
              { key:'reward_type', label:'Type', render: v => <Badge type={v === 'cash' ? 'active' : 'open'}>{v}</Badge> },
              { key:'reward_value', label:'Value', render: v => Number(v) > 0 ? <span style={{ color:'var(--green)',fontFamily:'JetBrains Mono,monospace',fontWeight:700 }}>{fmt.usd2(v)}</span> : <span style={{ color:'var(--text-3)' }}>Gift</span> },
            ]} rows={rewards} emptyText="No rewards yet" />
          </Card>
        </div>
      )}
    </AdminLayout>
  )
}

function cleanTxnParams(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === undefined || v === null) continue
    if (typeof v === 'number' && !Number.isFinite(v)) continue
    out[k] = v
  }
  return out
}

// ─────────────────────────────────────────
//  TRANSACTIONS
// ─────────────────────────────────────────
export function AdminTransactions() {
  const [filt, setFilt] = useState({
    income_type: '',
    wallet_type: '',
    member_id: '',
    date_from: '',
    date_to: '',
    limit: 100,
  })
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [excelBusy, setExcelBusy] = useState(false)
  const [toast, setToast] = useState(null)

  const patchFilt = useCallback((patch) => {
    setFilt((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }, [])

  const listParams = useMemo(
    () =>
      cleanTxnParams({
        income_type: filt.income_type,
        wallet_type: filt.wallet_type,
        member_id: filt.member_id ? Number(filt.member_id) : '',
        date_from: filt.date_from,
        date_to: filt.date_to,
        page,
        limit: filt.limit,
      }),
    [filt.income_type, filt.wallet_type, filt.member_id, filt.date_from, filt.date_to, filt.limit, page],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await txnAPI.getAll(listParams)
      setData(res.data)
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Load failed')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [listParams])

  useEffect(() => {
    load()
  }, [load])

  const total = Number(data?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / Number(filt.limit || 50)))
  const curPage = Math.min(page, totalPages)

  useEffect(() => {
    if (page > totalPages && total > 0) setPage(totalPages)
  }, [page, totalPages, total])

  const grandTotal = data?.summary?.reduce((s, r) => s + Number(r.total), 0) || 0

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleExcel = async () => {
    const p = cleanTxnParams({
      income_type: filt.income_type,
      wallet_type: filt.wallet_type,
      member_id: filt.member_id ? Number(filt.member_id) : '',
      date_from: filt.date_from,
      date_to: filt.date_to,
      export: 1,
    })
    setExcelBusy(true)
    try {
      const res = await txnAPI.getAll(p, { timeout: 120000 })
      const rows = res.data?.transactions ?? []
      const meta = [
        `IST date ${filt.date_from || '—'} to ${filt.date_to || '—'}`,
        filt.member_id ? `Member filter id: ${filt.member_id}` : 'All members',
        `Rows: ${rows.length} (matching total ${res.data?.total ?? 0})`,
        res.data?.exportTruncated ? `Max ${res.data?.exportMax} rows — truncated.` : '',
      ].filter(Boolean)
      downloadTransactionsExcel(rows, `admin-transactions_${filt.date_from || 'start'}_${filt.date_to || 'end'}`, {
        includeMember: true,
        metaLines: meta,
      })
      notify('Excel downloaded.')
    } catch (e) {
      notify(e.response?.data?.error || e.message || 'Excel fail', 'danger')
    } finally {
      setExcelBusy(false)
    }
  }

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-title">Transaction History</div>
        <div className="page-subtitle">All members ledger — IST date filter, pagination, Excel</div>
      </div>
      {toast ? <Alert type={toast.type}>{toast.msg}</Alert> : null}
      {err ? (
        <Alert type="danger" className="mb-4">
          {err}
        </Alert>
      ) : null}

      {/* Income Summary Cards */}
      <SectionTitle>Income totals (filtered range)</SectionTitle>
      <div className="grid-income mb-6">
        {Object.entries(INCOME_META).map(([key, meta]) => {
          const row = data?.summary?.find((s) => s.income_type === key)
          return (
            <div
              key={key}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${filt.income_type === key ? meta.color : 'var(--border)'}`,
                borderRadius: 12,
                padding: 14,
                borderLeft: `3px solid ${meta.color}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onClick={() =>
                patchFilt({
                  income_type: filt.income_type === key ? '' : key,
                })
              }
            >
              <div style={{ fontSize: 18, marginBottom: 6 }}>{meta.icon}</div>
              <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 16, fontWeight: 500, color: meta.color }}>{fmt.usd2(row?.total || 0)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{meta.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{row?.count || 0} txns</div>
            </div>
          )
        })}
        <div style={{ background: 'linear-gradient(135deg,rgba(0,229,255,0.08),rgba(168,85,247,0.08))', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 18, marginBottom: 6 }}>💰</div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 16, fontWeight: 500, color: 'var(--gold)' }}>{fmt.usd2(grandTotal)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Combined (filtered)</div>
        </div>
      </div>

      {/* Wallet Summary */}
      <SectionTitle>Wallet distribution (filtered)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {Object.entries(WALLET_META).map(([key, w]) => {
          const tot = data?.summary?.filter((s) => s.wallet_type === key).reduce((s, r) => s + Number(r.total), 0) || 0
          return (
            <div key={key} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, borderTop: `3px solid ${w.color}` }}>
              <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 20, fontWeight: 500, color: w.color }}>{fmt.usd2(tot)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
                {w.icon} {w.label}
              </div>
            </div>
          )
        })}
      </div>

      {/* Filter + Table */}
      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div className="form-label">From (IST)</div>
            <Input type="date" value={filt.date_from} onChange={(e) => patchFilt({ date_from: e.target.value })} />
          </div>
          <div>
            <div className="form-label">To (IST)</div>
            <Input type="date" value={filt.date_to} onChange={(e) => patchFilt({ date_to: e.target.value })} />
          </div>
          <div style={{ minWidth: 100 }}>
            <div className="form-label">Member ID</div>
            <Input
              type="number"
              min={1}
              value={filt.member_id}
              onChange={(e) => patchFilt({ member_id: e.target.value })}
              placeholder="All"
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <div className="form-label">Income Type</div>
            <Select
              value={filt.income_type}
              onChange={(e) => patchFilt({ income_type: e.target.value })}
              placeholder="All Types"
              options={Object.entries(INCOME_META).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }))}
            />
          </div>
          <div style={{ minWidth: 160 }}>
            <div className="form-label">Wallet</div>
            <Select
              value={filt.wallet_type}
              onChange={(e) => patchFilt({ wallet_type: e.target.value })}
              placeholder="All Wallets"
              options={Object.entries(WALLET_META).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }))}
            />
          </div>
          <div style={{ width: 88 }}>
            <div className="form-label">Page size</div>
            <Select
              value={String(filt.limit)}
              onChange={(e) => patchFilt({ limit: Number(e.target.value) })}
              options={[
                { value: '25', label: '25' },
                { value: '50', label: '50' },
                { value: '100', label: '100' },
                { value: '200', label: '200' },
              ]}
            />
          </div>
          <Btn variant="primary" type="button" onClick={() => load()} disabled={loading}>
            ↻ Refresh
          </Btn>
          <Btn
            type="button"
            variant="ghost"
            onClick={() => patchFilt({ income_type: '', wallet_type: '', member_id: '', date_from: '', date_to: '' })}
          >
            Clear filters
          </Btn>
          <Btn type="button" variant="success" loading={excelBusy} onClick={handleExcel} disabled={loading || excelBusy}>
            ⬇ Excel
          </Btn>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)' }}>
            Page {curPage}/{totalPages} · {data?.transactions?.length ?? 0} shown / {total} total
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <Btn type="button" variant="ghost" size="sm" disabled={curPage <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ◀ Prev
          </Btn>
          <Btn type="button" variant="ghost" size="sm" disabled={curPage >= totalPages || loading || total === 0} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next ▶
          </Btn>
        </div>

        <Table
          cols={[
            { key: 'txn_id', label: 'TXN ID', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: 'var(--cyan)' }}>{v}</span> },
            { key: 'created_at', label: 'Date', render: (v) => <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmt.time(v)}</span> },
            { key: 'member_name', label: 'Member', render: (v, r) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.member_email}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'JetBrains Mono,monospace' }}>id {r.member_id}</div>
                </div>
              ) },
            {
              key: 'income_type',
              label: 'Type',
              render: (v, r) => (
                <div>
                  <IncomeBadge type={v} />
                  {r.level_no && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>Level {r.level_no}</div>}
                  {r.from_name && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>From: {r.from_name}</div>}
                </div>
              ),
            },
            {
              key: 'wallet_type',
              label: 'Wallet',
              render: (v) => {
                const w = WALLET_META[v] || {}
                return (
                  <span style={{ fontSize: 12, color: w.color }}>
                    {w.icon} {w.label}
                  </span>
                )
              },
            },
            { key: 'amount', label: 'Amount', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, color: 'var(--green)', fontSize: 15 }}>+{fmt.usd(v, 4)}</span> },
            { key: 'description', label: 'Description', render: (v) => <span style={{ fontSize: 11, color: 'var(--text-2)', maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span> },
          ]}
          rows={data?.transactions}
          loading={loading}
          emptyText="No transactions match filters"
          emptyIcon="📊"
        />
      </Card>
    </AdminLayout>
  )
}

// ─────────────────────────────────────────
//  SETTINGS
// ─────────────────────────────────────────
export function AdminSettings() {
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({
    metamask_address: '',
    web3_chain_id: '56',
    web3_payment_token: '0x55d398326f99059fF775485246999027B3197955',
    web3_token_decimals: '18',
    web3_native_usd_price: '',
  })
  const [qrFile, setQrFile] = useState(null)
  const { data, loading: fetching, refetch } = useApi(() => authAPI.getSettings(), [], { initialData: {} })
  const { mutate: save, loading: saving } = useMutation(authAPI.updateSettings)

  useEffect(() => {
    if (data && typeof data.metamask_address !== 'undefined') {
      setForm({
        metamask_address: data.metamask_address || '',
        web3_chain_id: data.web3_chain_id != null && data.web3_chain_id !== '' ? String(data.web3_chain_id) : '56',
        web3_payment_token:
          data.web3_payment_token || '0x55d398326f99059fF775485246999027B3197955',
        web3_token_decimals:
          data.web3_token_decimals != null && data.web3_token_decimals !== ''
            ? String(data.web3_token_decimals)
            : '18',
        web3_native_usd_price:
          data.web3_native_usd_price != null && data.web3_native_usd_price !== ''
            ? String(data.web3_native_usd_price)
            : '',
      })
    }
  }, [data])

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      const fd = new FormData()
      fd.append('metamask_address', form.metamask_address)
      fd.append('cod_details', '')
      fd.append('web3_chain_id', form.web3_chain_id)
      fd.append('web3_payment_token', form.web3_payment_token)
      fd.append('web3_token_decimals', form.web3_token_decimals)
      fd.append('web3_native_usd_price', form.web3_native_usd_price)
      if (qrFile) fd.append('metamask_qr', qrFile)
      await save(fd)
      setQrFile(null)
      notify('Settings saved — members will see the QR if you uploaded one')
      refetch()
    } catch (err) {
      notify(err.message, 'danger')
    }
  }

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-subtitle">
          USDT BEP20 — on BNB Smart Chain (BSC). Members see this address and QR on registration / TOP-UP screens.
          Chain ID <strong>56</strong> and USDT contract below are defaults; leave blank to use backend <code style={{ fontSize: 12 }}>.env</code>.
        </div>
      </div>
      {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}
      <div style={{ maxWidth: 640 }}>
        <Card>
          {fetching ? (
            <div style={{ padding: 24 }}>Loading…</div>
          ) : (
            <form onSubmit={submit}>
              <TrustWalletBrandRow
                size={48}
                title="USDT BEP20 · BSC"
                subtitle="Members see this address and QR on registration / TOP-UP screens"
                style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border-sm)' }}
              />
              <FormGroup
                label="USDT BEP20 address (BSC)"
                hint="Members send USDT (BEP-20) on BNB Smart Chain to this address"
              >
                <Input
                  value={form.metamask_address}
                  onChange={(e) => setForm((f) => ({ ...f, metamask_address: e.target.value }))}
                  placeholder="0x742d35Cc6634..."
                  style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13 }}
                />
              </FormGroup>
              <FormGroup
                label="USDT BEP20 QR image"
                hint="PNG or JPG — scan in wallet app; a new file replaces the previous one"
              >
                {data?.metamask_qr_image ? (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Currently saved:</div>
                    <img
                      src={uploadUrl(data.metamask_qr_image)}
                      alt="USDT BEP20 QR"
                      style={{
                        maxWidth: 200,
                        maxHeight: 200,
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: '#fff',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                ) : null}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,application/pdf"
                  onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'var(--bg-card2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    cursor: 'pointer',
                  }}
                />
                {qrFile ? (
                  <div style={{ fontSize: 12, color: 'var(--cyan)', marginTop: 8 }}>New: {qrFile.name}</div>
                ) : null}
              </FormGroup>
              <div
                style={{
                  marginTop: 20,
                  marginBottom: 12,
                  paddingTop: 20,
                  borderTop: '1px solid var(--border)',
                  fontWeight: 500,
                  fontSize: 14,
                  color: 'var(--text-1)',
                }}
              >
                USDT on BNB Smart Chain (BSC)
              </div>
              <FormGroup
                label="Chain ID"
                hint="56 = BNB Smart Chain (BSC). Blank = .env WEB3_CHAIN_ID"
              >
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={form.web3_chain_id}
                  onChange={(e) => setForm((f) => ({ ...f, web3_chain_id: e.target.value }))}
                  placeholder="e.g. 56"
                  style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13 }}
                />
              </FormGroup>
              <FormGroup
                label="USDT token contract (BEP-20)"
                hint="Default: 0x55d3…97955 on BSC; blank = .env WEB3_PAYMENT_TOKEN"
              >
                <Input
                  value={form.web3_payment_token}
                  onChange={(e) => setForm((f) => ({ ...f, web3_payment_token: e.target.value }))}
                  placeholder="0x55d398326f99059fF775485246999027B3197955"
                  style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13 }}
                />
              </FormGroup>
              <FormGroup label="Token decimals" hint="USDT on BSC uses 18; blank = .env or 18">
                <Input
                  type="number"
                  min="0"
                  max="36"
                  value={form.web3_token_decimals}
                  onChange={(e) => setForm((f) => ({ ...f, web3_token_decimals: e.target.value }))}
                  placeholder="e.g. 18"
                />
              </FormGroup>
              <FormGroup
                label="BNB USD price (optional)"
                hint="Reference only if using native BNB; USDT payments ignore this"
              >
                <Input
                  type="number"
                  min="0.00000001"
                  step="any"
                  value={form.web3_native_usd_price}
                  onChange={(e) => setForm((f) => ({ ...f, web3_native_usd_price: e.target.value }))}
                  placeholder="e.g. 600"
                />
              </FormGroup>
              <Btn variant="primary" type="submit" loading={saving} icon="💾">
                Save settings
              </Btn>
            </form>
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}
