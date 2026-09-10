// ═══════════════════════════════════════════
//  Admin Trade Reports — day-wise members + monthly daily totals
// ═══════════════════════════════════════════

import { useMemo, useState, useEffect } from 'react'
import { roiAPI, PACKAGES, fmt } from '../../api/index.js'
import { AdminLayout } from '../../components/layout/index.jsx'
import { Card, Btn, Alert, Table, Badge, Spinner, Input, Select } from '../../components/ui/index.jsx'
import { downloadDailyRoiRecipientsExcel, downloadMonthlyRoiDailyExcel } from '../../utils/roiReportExport.js'

function istTodayISO() {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = f.formatToParts(new Date())
  const g = (t) => parts.find((p) => p.type === t)?.value
  return `${g('year')}-${g('month')}-${g('day')}`
}

function packageLabel(usd) {
  const n = Number(usd)
  const p = PACKAGES.find((x) => x.amount === n)
  return p ? `${p.label} ($${p.amount})` : `$${n}`
}

function initialMonthParts() {
  const p = istTodayISO().split('-').map(Number)
  return { y: p[0], m: p[1] || 5 }
}

/** Only days where trade income payout (txn) occurred */
function filterDaysWithRoiPayout(days) {
  return (days || []).filter((d) => Number(d.payout_count) > 0 || Number(d.roi_total) > 0)
}

const UNKNOWN_SLOT = -1

function slotBucket(row) {
  const s = row?.topup_slot
  if (s == null || s === '') return UNKNOWN_SLOT
  const n = Number(s)
  return Number.isInteger(n) && n >= 0 ? n : UNKNOWN_SLOT
}

/** Aggregate per member (txn rows) — for one day / filtered group */
function summarizeMembersFromPayoutRows(payoutRows) {
  const map = new Map()
  for (const r of payoutRows || []) {
    const id = r.member_id
    const amt = Number(r.roi_amount || 0)
    if (!map.has(id)) {
      map.set(id, {
        member_id: id,
        name: r.name,
        email: r.email,
        package_amount: Number(r.package_amount),
        plan_topup_count: r.plan_topup_count,
        roi_total_usd: 0,
        credit_rows: 0,
      })
    }
    const x = map.get(id)
    x.roi_total_usd = parseFloat((x.roi_total_usd + amt).toFixed(6))
    x.credit_rows += 1
  }
  return [...map.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

function groupLedgerToDays(led) {
  const by = {}
  for (const row of led || []) {
    const d = row.ist_date
    if (!by[d]) by[d] = []
    by[d].push({
      member_id: row.member_id,
      name: row.name,
      email: row.email,
      package_amount: row.package_amount,
      plan_topup_count: row.plan_topup_count,
      topup_slot: row.topup_slot,
      roi_amount: row.roi_amount,
      txn_id: row.txn_id,
      credited_at: row.credited_at,
      roi_trade_id: row.roi_trade_id,
      session_trade_date: row.session_trade_date,
      session_name: row.session_name,
    })
  }
  const keys = Object.keys(by).sort()
  return keys.map((ds) => {
    const members = by[ds]
    const roi_total = parseFloat(members.reduce((s, x) => s + Number(x.roi_amount), 0).toFixed(6))
    return {
      date: ds,
      roi_total,
      payout_count: members.length,
      unique_members: new Set(members.map((m) => m.member_id)).size,
      members,
      member_summary: summarizeMembersFromPayoutRows(members),
    }
  })
}

function rollupBySlot(rows) {
  const m = new Map()
  for (const r of rows || []) {
    const key = slotBucket(r)
    if (!m.has(key))
      m.set(key, {
        ladder_slot: key === UNKNOWN_SLOT ? null : key,
        roi_total_usd: 0,
        payout_count: 0,
        memberIds: new Set(),
      })
    const x = m.get(key)
    x.roi_total_usd += Number(r.roi_amount ?? r.roi_total_usd ?? 0)
    x.payout_count += 1
    x.memberIds.add(r.member_id)
  }
  return [...m.values()]
    .map((x) => ({
      ladder_slot: x.ladder_slot,
      label: x.ladder_slot == null ? '— slot / link missing' : `Slot ${x.ladder_slot}`,
      roi_total_usd: parseFloat(x.roi_total_usd.toFixed(6)),
      payout_count: x.payout_count,
      unique_members: x.memberIds.size,
    }))
    .sort((a, b) => {
      const as = a.ladder_slot == null ? 999 : a.ladder_slot
      const bs = b.ladder_slot == null ? 999 : b.ladder_slot
      return as - bs
    })
}

/** Search by name, email, member id, or TXN id (substring, case-insensitive). */
function matchesRoiSearch(row, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  const name = String(row.name ?? '').toLowerCase()
  const email = String(row.email ?? '').toLowerCase()
  const mid = String(row.member_id ?? '')
  const txn = String(row.txn_id ?? '').toLowerCase()
  return name.includes(q) || email.includes(q) || mid.includes(q) || txn.includes(q)
}

function rollupByPlan(rows) {
  const m = new Map()
  for (const r of rows || []) {
    const pkg = Number(r.package_amount)
    const key = Number.isFinite(pkg) ? pkg : -1
    if (!m.has(key))
      m.set(key, {
        package_amount: key === -1 ? null : key,
        roi_total_usd: 0,
        payout_count: 0,
        memberIds: new Set(),
      })
    const x = m.get(key)
    x.roi_total_usd += Number(r.roi_amount ?? r.roi_total_usd ?? 0)
    x.payout_count += 1
    x.memberIds.add(r.member_id)
  }
  return [...m.values()]
    .map((x) => ({
      package_amount: x.package_amount,
      roi_total_usd: parseFloat(x.roi_total_usd.toFixed(6)),
      payout_count: x.payout_count,
      unique_members: x.memberIds.size,
    }))
    .sort((a, b) => Number(a.package_amount ?? -999999) - Number(b.package_amount ?? -999999))
}

export default function AdminRoiReports() {
  const [toast, setToast] = useState(null)
  const [dayPick, setDayPick] = useState(istTodayISO)
  const [dayLoading, setDayLoading] = useState(false)
  const [dayData, setDayData] = useState(null)

  const [monthParts, setMonthParts] = useState(initialMonthParts)
  const [monthLoading, setMonthLoading] = useState(false)
  const [monthData, setMonthData] = useState(null)
  const [monthPlanFilter, setMonthPlanFilter] = useState([])
  const [monthSlotFilter, setMonthSlotFilter] = useState([])

  const [dayPlanFilter, setDayPlanFilter] = useState([])
  const [daySlotFilter, setDaySlotFilter] = useState([])
  const [daySearch, setDaySearch] = useState('')
  const [dayPage, setDayPage] = useState(1)
  const [dayPageSize, setDayPageSize] = useState(50)

  const [monthSearch, setMonthSearch] = useState('')
  const [monthDayPage, setMonthDayPage] = useState(1)
  const [monthDayPageSize, setMonthDayPageSize] = useState(10)

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4500)
  }

  const monthOptions = useMemo(() => {
    const out = []
    for (let m = 1; m <= 12; m++) {
      const label = new Date(2000, m - 1, 1).toLocaleString('en-IN', { month: 'long' })
      out.push({ value: m, label: `${label}` })
    }
    return out
  }, [])

  const monthLedgerRows = useMemo(() => {
    if (Array.isArray(monthData?.ledger)) return monthData.ledger
    const out = []
    for (const d of filterDaysWithRoiPayout(monthData?.days || [])) {
      for (const m of d.members || []) {
        out.push({
          ist_date: d.date,
          member_id: m.member_id,
          name: m.name,
          email: m.email,
          package_amount: m.package_amount,
          plan_topup_count: m.plan_topup_count,
          topup_slot: m.topup_slot ?? null,
          roi_amount: m.roi_amount,
          txn_id: m.txn_id,
          credited_at: m.credited_at,
          roi_trade_id: m.roi_trade_id,
          session_trade_date: m.session_trade_date,
          session_name: m.session_name,
        })
      }
    }
    return out
  }, [monthData?.ledger, monthData?.days])

  const filteredMonthlyLedger = useMemo(() => {
    let rows = monthLedgerRows || []
    if (monthPlanFilter.length) rows = rows.filter((r) => monthPlanFilter.includes(Number(r.package_amount)))
    if (monthSlotFilter.length) rows = rows.filter((r) => monthSlotFilter.includes(slotBucket(r)))
    return rows
  }, [monthLedgerRows, monthPlanFilter, monthSlotFilter])

  const searchFilteredMonthlyLedger = useMemo(() => {
    const q = monthSearch.trim()
    let rows = filteredMonthlyLedger || []
    if (q) rows = rows.filter((r) => matchesRoiSearch(r, q))
    return rows
  }, [filteredMonthlyLedger, monthSearch])

  const displayDaysWithPayout = useMemo(
    () => filterDaysWithRoiPayout(groupLedgerToDays(searchFilteredMonthlyLedger)),
    [searchFilteredMonthlyLedger],
  )

  const monthDayPageCount = Math.max(1, Math.ceil(displayDaysWithPayout.length / monthDayPageSize))
  const monthDayPageSafe = Math.min(monthDayPage, monthDayPageCount)
  const pagedMonthDays = useMemo(
    () => {
      const start = (monthDayPageSafe - 1) * monthDayPageSize
      return displayDaysWithPayout.slice(start, start + monthDayPageSize)
    },
    [displayDaysWithPayout, monthDayPageSafe, monthDayPageSize],
  )

  const monthFilteredSlotRollup = useMemo(() => rollupBySlot(searchFilteredMonthlyLedger), [searchFilteredMonthlyLedger])
  const monthFilteredPlanRollup = useMemo(() => rollupByPlan(searchFilteredMonthlyLedger), [searchFilteredMonthlyLedger])

  const monthSlotChoices = useMemo(() => {
    const s = new Set()
    for (const r of monthLedgerRows || []) s.add(slotBucket(r))
    return [...s].sort((a, b) => {
      if (a === UNKNOWN_SLOT) return 1
      if (b === UNKNOWN_SLOT) return -1
      return a - b
    })
  }, [monthLedgerRows])

  const monthFilterActive =
    monthPlanFilter.length > 0 || monthSlotFilter.length > 0 || Boolean(monthSearch.trim())
  const filteredMonthRoiSum = useMemo(
    () => parseFloat(searchFilteredMonthlyLedger.reduce((s, r) => s + Number(r.roi_amount || 0), 0).toFixed(6)),
    [searchFilteredMonthlyLedger],
  )

  const ledgerHasRows = useMemo(() => (monthLedgerRows || []).length > 0, [monthLedgerRows])

  const toggleMonthPlan = (amt) => {
    setMonthPlanFilter((p) =>
      p.includes(amt) ? p.filter((x) => x !== amt) : [...p, amt].sort((a, b) => a - b),
    )
  }
  const toggleMonthSlot = (sl) => {
    setMonthSlotFilter((p) =>
      p.includes(sl) ? p.filter((x) => x !== sl) : [...p, sl].sort((a, b) => a - b),
    )
  }

  const toggleDayPlan = (amt) => {
    setDayPlanFilter((p) =>
      p.includes(amt) ? p.filter((x) => x !== amt) : [...p, amt].sort((a, b) => a - b),
    )
  }
  const toggleDaySlot = (sl) => {
    setDaySlotFilter((p) =>
      p.includes(sl) ? p.filter((x) => x !== sl) : [...p, sl].sort((a, b) => a - b),
    )
  }

  const filteredDayMembers = useMemo(() => {
    let rows = dayData?.members || []
    if (dayPlanFilter.length) rows = rows.filter((r) => dayPlanFilter.includes(Number(r.package_amount)))
    if (daySlotFilter.length) rows = rows.filter((r) => daySlotFilter.includes(slotBucket(r)))
    return rows
  }, [dayData?.members, dayPlanFilter, daySlotFilter])

  const dayMembersAfterSearch = useMemo(() => {
    const q = daySearch.trim()
    if (!q) return filteredDayMembers
    return filteredDayMembers.filter((r) => matchesRoiSearch(r, q))
  }, [filteredDayMembers, daySearch])

  const dayPageCount = Math.max(1, Math.ceil(dayMembersAfterSearch.length / dayPageSize))
  const dayPageSafe = Math.min(dayPage, dayPageCount)
  const pagedDayMembers = useMemo(() => {
    const start = (dayPageSafe - 1) * dayPageSize
    return dayMembersAfterSearch.slice(start, start + dayPageSize)
  }, [dayMembersAfterSearch, dayPageSafe, dayPageSize])

  useEffect(() => {
    setDayPage(1)
  }, [daySearch, dayPlanFilter, daySlotFilter, dayPageSize])

  useEffect(() => {
    setMonthDayPage(1)
  }, [monthSearch, monthPlanFilter, monthSlotFilter, monthDayPageSize, displayDaysWithPayout.length])

  const dayFilterActive = dayPlanFilter.length > 0 || daySlotFilter.length > 0 || Boolean(daySearch.trim())
  const dayRollupSlot = useMemo(() => rollupBySlot(filteredDayMembers), [filteredDayMembers])
  const dayRollupPlan = useMemo(() => rollupByPlan(filteredDayMembers), [filteredDayMembers])
  const daySlotChoices = useMemo(() => {
    const s = new Set()
    for (const r of dayData?.members || []) s.add(slotBucket(r))
    return [...s].sort((a, b) => {
      if (a === UNKNOWN_SLOT) return 1
      if (b === UNKNOWN_SLOT) return -1
      return a - b
    })
  }, [dayData?.members])
  const filteredDayRoiSum = useMemo(
    () => parseFloat(dayMembersAfterSearch.reduce((s, r) => s + Number(r.roi_amount || 0), 0).toFixed(6)),
    [dayMembersAfterSearch],
  )
  const filteredDayUnique = useMemo(
    () => new Set(dayMembersAfterSearch.map((r) => r.member_id)).size,
    [dayMembersAfterSearch],
  )

  const loadDay = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayPick)) {
      notify('Use date in YYYY-MM-DD format', 'danger')
      return
    }
    setDayLoading(true)
    setDayData(null)
    try {
      const res = await roiAPI.reportDay({ date: dayPick })
      setDayData(res.data)
      setDayPlanFilter([])
      setDaySlotFilter([])
      setDaySearch('')
      setDayPage(1)
    } catch (e) {
      notify(e.response?.data?.error || e.message, 'danger')
    } finally {
      setDayLoading(false)
    }
  }

  const loadMonth = async () => {
    setMonthLoading(true)
    setMonthData(null)
    try {
      const res = await roiAPI.reportMonthly({ year: monthParts.y, month: monthParts.m })
      setMonthData(res.data)
      setMonthPlanFilter([])
      setMonthSlotFilter([])
      setMonthSearch('')
      setMonthDayPage(1)
    } catch (e) {
      notify(e.response?.data?.error || e.message, 'danger')
    } finally {
      setMonthLoading(false)
    }
  }

  const dayCols = [
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
    { key: 'member_id', label: 'ID', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{v}</span> },
    {
      key: 'package_amount',
      label: 'Plan',
      render: (v) => packageLabel(v),
    },
    {
      key: 'topup_slot',
      label: 'Slot',
      render: (v) => (
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, color: 'var(--purple)' }}>
          {v != null && v !== '' && Number.isInteger(Number(v)) ? Number(v) : '—'}
        </span>
      ),
    },
    {
      key: 'roi_amount',
      label: 'Trade',
      render: (v) => <span style={{ color: 'var(--green)', fontWeight: 500 }}>{fmt.usd2(v)}</span>,
    },
    {
      key: 'session_trade_date',
      label: 'Session date',
      render: (v) => (v ? fmt.date(v) : '—'),
    },
    {
      key: 'credited_at',
      label: 'Credit time',
      render: (v) => fmt.time(v),
    },
  ]

  const memberDaySummaryCols = [
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
    { key: 'member_id', label: 'ID', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{v}</span> },
    { key: 'package_amount', label: 'Plan', render: (v) => packageLabel(v) },
    {
      key: 'roi_total_usd',
      label: 'Trade that day (combined)',
      render: (v) => <span style={{ color: 'var(--green)', fontWeight: 500 }}>{fmt.usd2(v)}</span>,
    },
    {
      key: 'credit_rows',
      label: 'Credits',
      render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{v ?? 0}</span>,
    },
  ]

  const monthTxnCols = [
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
    { key: 'package_amount', label: 'Plan', render: (v) => packageLabel(v) },
    {
      key: 'topup_slot',
      label: 'Slot',
      render: (v) => (
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, fontWeight: 500, color: 'var(--purple)' }}>
          {v != null && v !== '' && Number.isInteger(Number(v)) ? Number(v) : '—'}
        </span>
      ),
    },
    { key: 'roi_amount', label: 'Amount', render: (v) => <span style={{ color: 'var(--cyan)', fontWeight: 500 }}>{fmt.usd2(v)}</span> },
    { key: 'txn_id', label: 'TXN', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10 }}>{v}</span> },
    { key: 'credited_at', label: 'Time', render: (v) => fmt.time(v) },
  ]

  const slotRollupCols = [
    {
      key: 'label',
      label: 'Ladder slot',
      render: (v) => <span style={{ fontWeight: 500, color: 'var(--purple)' }}>{v}</span>,
    },
    {
      key: 'roi_total_usd',
      label: 'Total trade income',
      render: (v) => <span style={{ fontWeight: 500, color: 'var(--green)' }}>{fmt.usd2(v)}</span>,
    },
    { key: 'payout_count', label: 'Credits', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{v}</span> },
    {
      key: 'unique_members',
      label: 'Members',
      render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{v}</span>,
    },
  ]

  const planRollupCols = [
    {
      key: 'package_amount',
      label: 'Plan',
      render: (v) => packageLabel(v == null ? 0 : v),
    },
    {
      key: 'roi_total_usd',
      label: 'Total trade income',
      render: (v) => <span style={{ fontWeight: 500, color: 'var(--cyan)' }}>{fmt.usd2(v)}</span>,
    },
    { key: 'payout_count', label: 'Credits', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{v}</span> },
    {
      key: 'unique_members',
      label: 'Members',
      render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{v}</span>,
    },
  ]

  /** One row per calendar day in the month — daily trade income (without expand) */
  const monthDailySummaryCols = [
    {
      key: 'date',
      label: 'Day (IST)',
      render: (v, row) => (
        <span
          style={{
            fontFamily: 'JetBrains Mono,monospace',
            fontWeight: 500,
            color: Number(row.roi_total) > 0 ? 'var(--cyan)' : 'var(--text-3)',
            fontSize: 13,
          }}
        >
          {v}
        </span>
      ),
    },
    {
      key: 'roi_total',
      label: 'That day total trade income',
      render: (v, row) => (
        <span style={{ fontWeight: 500, color: Number(row.roi_total) > 0 ? 'var(--green)' : 'var(--text-3)' }}>
          {fmt.usd2(v)}
        </span>
      ),
    },
    {
      key: 'unique_members',
      label: 'Members',
      render: (v, row) => (
        <span style={{ fontFamily: 'JetBrains Mono,monospace', color: Number(row.unique_members) > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>
          {Number(row.unique_members) > 0 ? row.unique_members : '—'}
        </span>
      ),
    },
    {
      key: 'payout_count',
      label: 'Credits',
      render: (v) => (
        <span style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--text-2)' }}>{Number(v) > 0 ? v : '—'}</span>
      ),
    },
  ]

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-title">Trade Reports</div>
        <div className="page-subtitle">
          <strong>One day:</strong> which members received trade income (live income) credits ·{' '}
          <strong>Month:</strong> only days with trade payout; expand each for member / txn detail.
        </div>
      </div>
      {toast && (
        <Alert type={toast.type} onClose={() => setToast(null)}>
          {toast.msg}
        </Alert>
      )}

      <div className="mb-6">
        <Card title="One day — who received how much trade income">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="form-label">Day (IST credit date)</label>
              <input
                type="date"
                value={dayPick}
                onChange={(e) => setDayPick(e.target.value)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--border-sm)',
                  background: 'var(--bg-card2)',
                  color: 'var(--text-1)',
                }}
              />
            </div>
            <Btn type="button" variant="primary" loading={dayLoading} onClick={loadDay} icon="↻">
              Load
            </Btn>
            <Btn
              type="button"
              variant="success"
              disabled={!dayData?.members?.length}
              icon="⬇"
              onClick={() => {
                downloadDailyRoiRecipientsExcel(dayData)
                notify('Excel downloaded.')
              }}
            >
              Excel — members who got trade income
            </Btn>
          </div>
          <Alert type="info" className="mb-4" style={{ fontSize: 12, lineHeight: 1.6 }}>
            Data comes from <code>transactions</code>: <strong>Trade Income session</strong> joiner payouts only —
            daily totals use <strong>wallet credit timestamp</strong> grouped by calendar day in Asia/Kolkata.
          </Alert>
          {dayData ? (
            <>
              <div style={{ marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <Badge type="cyan">{fmt.date(dayData.date)}</Badge>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  {dayFilterActive ? (
                    <>
                      Filtered · Members: <strong>{filteredDayUnique}</strong> · Credits: <strong>{dayMembersAfterSearch.length}</strong> · Trade:{' '}
                      <strong style={{ color: 'var(--green)' }}>{fmt.usd2(filteredDayRoiSum)}</strong>
                    </>
                  ) : (
                    <>
                      Members: <strong>{dayData.uniqueMembers}</strong> · Rows: <strong>{dayData.payoutRows}</strong> · Total Trade:{' '}
                      <strong style={{ color: 'var(--green)' }}>{fmt.usd2(dayData.roiTotalUsd)}</strong>
                    </>
                  )}
                </span>
              </div>
              {(dayData?.members || []).length ? (
                <div
                  style={{
                    marginBottom: 14,
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid var(--border-sm)',
                    background: 'var(--bg-card2)',
                  }}
                >
                  <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 13 }}>Plan / slot filter (daily)</div>
                  <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-3)' }}>Plan</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {PACKAGES.map((p) => {
                      const on = dayPlanFilter.includes(p.amount)
                      return (
                        <button
                          key={p.amount}
                          type="button"
                          onClick={() => toggleDayPlan(p.amount)}
                          style={{
                            cursor: 'pointer',
                            padding: '6px 12px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 500,
                            border: `2px solid ${on ? 'var(--cyan)' : 'var(--border-sm)'}`,
                            background: on ? 'rgba(0,229,255,0.08)' : 'var(--bg-card)',
                            color: 'var(--text-1)',
                          }}
                        >
                          {p.label} (${p.amount})
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-3)' }}>Slot</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                    {daySlotChoices.map((sl) => {
                      const on = daySlotFilter.includes(sl)
                      const lab = sl === UNKNOWN_SLOT ? '— / unknown' : `Slot ${sl}`
                      return (
                        <label key={`ds-${sl}`} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                          <input type="checkbox" checked={on} onChange={() => toggleDaySlot(sl)} />
                          <span>{lab}</span>
                        </label>
                      )
                    })}
                    <Btn
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDayPlanFilter([])
                        setDaySlotFilter([])
                        setDaySearch('')
                      }}
                    >
                      Clear all
                    </Btn>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                    <div>
                      <div
                        style={{
                          fontWeight: 500,
                          marginBottom: 8,
                          fontSize: 11,
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          color: 'var(--text-3)',
                        }}
                      >
                        Slot-wise
                      </div>
                      <div style={{ borderRadius: 10, overflow: 'auto', border: '1px solid var(--border-sm)', maxHeight: 220 }}>
                        <Table cols={slotRollupCols} rows={dayRollupSlot} emptyText="—" />
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: 500,
                          marginBottom: 8,
                          fontSize: 11,
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          color: 'var(--text-3)',
                        }}
                      >
                        Plan-wise
                      </div>
                      <div style={{ borderRadius: 10, overflow: 'auto', border: '1px solid var(--border-sm)', maxHeight: 220 }}>
                        <Table cols={planRollupCols} rows={dayRollupPlan} emptyText="—" />
                      </div>
                    </div>
                  </div>
                  {dayFilterActive ? (
                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
                      Table and roll-ups reflect filtered members only.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
          {dayData?.members?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
              <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                <div className="form-label">Search (name · email · member ID · TXN)</div>
                <Input
                  value={daySearch}
                  onChange={(e) => setDaySearch(e.target.value)}
                  placeholder="Type to filter..."
                />
              </div>
              <div style={{ width: 100 }}>
                <div className="form-label">Page size</div>
                <Select
                  value={String(dayPageSize)}
                  onChange={(e) => setDayPageSize(Number(e.target.value))}
                  options={[
                    { value: '25', label: '25' },
                    { value: '50', label: '50' },
                    { value: '100', label: '100' },
                    { value: '200', label: '200' },
                  ]}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4, fontSize: 13, color: 'var(--text-2)' }}>
                <Btn type="button" variant="ghost" size="sm" disabled={dayPageSafe <= 1} onClick={() => setDayPage((p) => Math.max(1, p - 1))}>
                  ◀
                </Btn>
                <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>
                  {dayPageSafe}/{dayPageCount} · rows {pagedDayMembers.length}/{dayMembersAfterSearch.length}
                </span>
                <Btn type="button" variant="ghost" size="sm" disabled={dayPageSafe >= dayPageCount} onClick={() => setDayPage((p) => Math.min(dayPageCount, p + 1))}>
                  ▶
                </Btn>
              </div>
            </div>
          ) : null}
          <div style={{ maxHeight: 480, overflow: 'auto', borderRadius: 12, border: '1px solid var(--border-sm)' }}>
            <Table
              cols={dayCols}
              rows={pagedDayMembers}
              loading={dayLoading}
              emptyText={
                dayData && !dayMembersAfterSearch.length
                  ? 'Nothing matches filter / search — clear and try again'
                  : 'Click Load — or no trade income credits on this day'
              }
            />
          </div>
        </Card>
      </div>

      <Card title="Full month — daily trade income totals">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="form-label">Year</label>
            <input
              type="number"
              min={2020}
              max={2100}
              value={monthParts.y}
              onChange={(e) => setMonthParts((p) => ({ ...p, y: Number(e.target.value) }))}
              style={{
                width: 104,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--border-sm)',
                background: 'var(--bg-card2)',
                color: 'var(--text-1)',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="form-label">Month</label>
            <select
              value={monthParts.m}
              onChange={(e) => setMonthParts((p) => ({ ...p, m: Number(e.target.value) }))}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--border-sm)',
                background: 'var(--bg-card2)',
                color: 'var(--text-1)',
                minWidth: 160,
              }}
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Btn type="button" variant="primary" loading={monthLoading} onClick={loadMonth} icon="↻">
            Load month
          </Btn>
          <Btn
            type="button"
            variant="success"
            disabled={!monthData || displayDaysWithPayout.length === 0}
            icon="⬇"
            onClick={() => {
              const payload = monthData ? { ...monthData, days: displayDaysWithPayout } : monthData
              downloadMonthlyRoiDailyExcel(payload)
              notify('Excel downloaded.')
            }}
          >
            Excel — daily + members + txns
          </Btn>
        </div>
        {monthData && !monthLoading ? (
          <div
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.06), rgba(168, 85, 247, 0.05))',
              border: '1px solid rgba(0, 229, 255, 0.15)',
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: 8 }}>{monthData.monthLabel}</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Full month Trade (trade payouts):{' '}
              <strong style={{ color: 'var(--green)', fontSize: 17 }}>{fmt.usd2(monthData.monthSummary?.roi_total_usd)}</strong>
              <span style={{ color: 'var(--text-3)', marginLeft: 10 }}>
                credits {monthData.monthSummary?.payout_row_count ?? 0} · days with payout{' '}
                {monthData.monthSummary?.days_with_payout ?? 0}
              </span>
            </div>
            {monthFilterActive ? (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(0, 229, 255, 0.12)',
                  fontSize: 13,
                  color: 'var(--text-2)',
                }}
              >
                <strong style={{ color: 'var(--cyan)' }}>Current filter:</strong> trade income{' '}
                <strong style={{ color: 'var(--green)' }}>{fmt.usd2(filteredMonthRoiSum)}</strong>
                <span style={{ color: 'var(--text-3)', marginLeft: 10 }}>
                  credits {searchFilteredMonthlyLedger.length} · payout days {displayDaysWithPayout.length}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {monthData && !monthLoading && ledgerHasRows ? (
          <div
            style={{
              marginBottom: 18,
              padding: 14,
              borderRadius: 12,
              border: '1px solid var(--border-sm)',
              background: 'var(--bg-card2)',
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 13 }}>Search · plan · slot</div>
            <div style={{ marginBottom: 14 }}>
              <div className="form-label">Search (name · email · member ID · TXN)</div>
              <Input value={monthSearch} onChange={(e) => setMonthSearch(e.target.value)} placeholder="Type to filter..." />
            </div>
            <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-3)' }}>Plan</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {PACKAGES.map((p) => {
                const on = monthPlanFilter.includes(p.amount)
                return (
                  <button
                    key={p.amount}
                    type="button"
                    onClick={() => toggleMonthPlan(p.amount)}
                    style={{
                      cursor: 'pointer',
                      padding: '6px 12px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 500,
                      border: `2px solid ${on ? 'var(--cyan)' : 'var(--border-sm)'}`,
                      background: on ? 'rgba(0,229,255,0.08)' : 'var(--bg-card)',
                      color: 'var(--text-1)',
                    }}
                  >
                    {p.label} (${p.amount})
                  </button>
                )
              })}
            </div>
            <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-3)' }}>Ladder slot</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
              {monthSlotChoices.map((sl) => {
                const on = monthSlotFilter.includes(sl)
                const lab = sl === UNKNOWN_SLOT ? '— / missing' : `Slot ${sl}`
                return (
                  <label key={`ms-${sl}`} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => toggleMonthSlot(sl)} />
                    <span>{lab}</span>
                  </label>
                )
              })}
              <Btn
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMonthPlanFilter([])
                  setMonthSlotFilter([])
                  setMonthSearch('')
                }}
              >
                Clear all
              </Btn>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div>
                <div
                  style={{
                    fontWeight: 500,
                    marginBottom: 8,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: 'var(--text-3)',
                  }}
                >
                  Slot-wise
                </div>
                <div style={{ borderRadius: 10, border: '1px solid var(--border-sm)', overflow: 'auto', maxHeight: 280 }}>
                  <Table cols={slotRollupCols} rows={monthFilteredSlotRollup} emptyText="—" />
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 500,
                    marginBottom: 8,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: 'var(--text-3)',
                  }}
                >
                  Plan-wise
                </div>
                <div style={{ borderRadius: 10, border: '1px solid var(--border-sm)', overflow: 'auto', maxHeight: 280 }}>
                  <Table cols={planRollupCols} rows={monthFilteredPlanRollup} emptyText="—" />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!monthLoading && ledgerHasRows ? (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontWeight: 500,
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'var(--text-3)',
                marginBottom: 12,
              }}
            >
              {`Days with Trade payout only (${displayDaysWithPayout.length} day${
                displayDaysWithPayout.length !== 1 ? 's' : ''
              }${
                displayDaysWithPayout.length > monthDayPageSize ? ` · page ${monthDayPageSafe}/${monthDayPageCount}` : ''
              })`}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
              <div style={{ width: 100 }}>
                <div className="form-label">Days / page</div>
                <Select
                  value={String(monthDayPageSize)}
                  onChange={(e) => setMonthDayPageSize(Number(e.target.value))}
                  options={[
                    { value: '5', label: '5' },
                    { value: '10', label: '10' },
                    { value: '15', label: '15' },
                    { value: '31', label: '31' },
                  ]}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
                <Btn type="button" variant="ghost" size="sm" disabled={monthDayPageSafe <= 1} onClick={() => setMonthDayPage((p) => Math.max(1, p - 1))}>
                  ◀ Prev page
                </Btn>
                <span style={{ fontSize: 13, color: 'var(--text-2)', fontFamily: 'JetBrains Mono,monospace' }}>
                  {monthDayPageSafe}/{monthDayPageCount}
                </span>
                <Btn
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={monthDayPageSafe >= monthDayPageCount}
                  onClick={() => setMonthDayPage((p) => Math.min(monthDayPageCount, p + 1))}
                >
                  Next page ▶
                </Btn>
              </div>
            </div>
            {displayDaysWithPayout.length === 0 ? (
              <Alert type="warning" className="mb-0">
                {monthSearch.trim() || monthPlanFilter.length || monthSlotFilter.length
                  ? 'No days match filter / search — clear and try again.'
                  : 'No trade income (credit) records found for this month.'}
              </Alert>
            ) : (
              <>
                <div
                  style={{
                    borderRadius: 12,
                    border: '1px solid var(--border-sm)',
                    maxHeight: 'min(52vh, 520px)',
                    overflow: 'auto',
                    background: 'var(--bg-card2)',
                  }}
                >
                  <Table cols={monthDailySummaryCols} rows={pagedMonthDays} emptyText="—" />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.55 }}>
                  Expand details below for days on this page only — change days-per-page above.
                </div>
              </>
            )}
          </div>
        ) : null}

        {monthData && displayDaysWithPayout.length > 0 ? (
          <Alert type="info" className="mb-4" style={{ fontSize: 12, lineHeight: 1.65 }}>
            Expand any <strong>day</strong> below for <strong>all members (combined Trade)</strong> and{' '}
            <strong>each credit txn</strong>. Excel: Daily_live, Daily_member_Trade, Each_credit_row (these days only).
          </Alert>
        ) : null}
        {monthLoading ? <Spinner /> : null}
        {!monthLoading && monthData && displayDaysWithPayout.length > 0 ? (
          <div
            style={{
              fontWeight: 500,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--text-3)',
              marginBottom: 12,
            }}
          >
            Day-wise detail — {pagedMonthDays.length} day(s) on this page (tap / click)
          </div>
        ) : null}
        {!monthLoading && monthData && displayDaysWithPayout.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              maxHeight: 'min(72vh, 840px)',
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {pagedMonthDays.map((d) => (
              <details
                key={d.date}
                style={{
                  borderRadius: 12,
                  border: '1px solid var(--border-sm)',
                  background: 'var(--bg-card2)',
                  overflow: 'hidden',
                }}
              >
                <summary
                  style={{
                    listStyle: 'none',
                    cursor: 'pointer',
                    padding: '12px 14px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px 18px',
                    fontSize: 13,
                  }}
                >
                  <strong style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--cyan)', minWidth: 108 }}>
                    {d.date}
                  </strong>
                  <span style={{ color: 'var(--text-2)' }}>
                    Total Trade: <strong style={{ color: 'var(--green)' }}>{fmt.usd2(d.roi_total)}</strong>
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    members <strong>{d.unique_members ?? 0}</strong> · credits <strong>{d.payout_count ?? 0}</strong>
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>▼ expand</span>
                </summary>
                <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border-sm)', background: 'rgba(0,0,0,0.03)' }}>
                  <div style={{ fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', margin: '14px 0 8px' }}>
                    All members — Trade that day (multiple credits combined)
                  </div>
                  <div style={{ borderRadius: 10, border: '1px solid var(--border-sm)', overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
                    <Table
                      cols={memberDaySummaryCols}
                      rows={d.member_summary || []}
                      emptyText={d.payout_count > 0 ? '(summary empty — see raw credits below)' : 'No Trade payout this day'}
                    />
                  </div>
                  {d.members?.length > 0 ? (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', margin: '16px 0 8px' }}>
                        Each credit row (txn)
                      </div>
                      <div style={{ borderRadius: 10, border: '1px solid var(--border-sm)', maxHeight: 220, overflowY: 'auto' }}>
                        <Table cols={monthTxnCols} rows={d.members} emptyText="—" />
                      </div>
                    </>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        ) : !monthLoading && !monthData ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Click Load month.</p>
        ) : null}
      </Card>
    </AdminLayout>
  )
}
