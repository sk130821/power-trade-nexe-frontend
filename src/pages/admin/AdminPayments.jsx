import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminPaymentAPI, adminMemberAPI, fmt } from '../../api/index.js'
import { paymentTypeLabel } from '../../utils/paymentTypes.js'
import { useApi, useMutation } from '../../hooks/useApi.js'
import { AdminLayout } from '../../components/layout/index.jsx'
import { Card, Btn, Alert, Table, Badge, StatCard, Input, Select, Modal } from '../../components/ui/index.jsx'
import { PaymentReceiptModal } from '../../components/PaymentReceiptModal.jsx'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'registration', label: 'Registration' },
  { value: 'plan_topup', label: 'Plan TOP-UP' },
  { value: 'trading_topup', label: 'Trading wallet add' },
]

function paymentForLabel(v) {
  if (!v || v === 'registration') return 'Registration'
  if (v === 'plan_topup') return 'Plan TOP-UP'
  if (v === 'trading_topup') return 'Trading wallet'
  return v
}

function statusBadgeType(st) {
  if (st === 'approved') return 'approved'
  if (st === 'rejected') return 'rejected'
  return 'pending'
}

export default function AdminPayments() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [toast, setToast] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(() => searchParams.get('status') || '')
  const [paymentFor, setPaymentFor] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [receiptView, setReceiptView] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 380)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [status, paymentFor, search, dateFrom, dateTo, pageSize])

  const listParams = useMemo(() => {
    const p = { page, limit: pageSize }
    if (status) p.status = status
    if (paymentFor) p.payment_for = paymentFor
    if (search.trim()) p.q = search.trim()
    if (dateFrom) p.date_from = dateFrom
    if (dateTo) p.date_to = dateTo
    return p
  }, [status, paymentFor, search, dateFrom, dateTo, page, pageSize])

  const { data, loading, refetch } = useApi(() => adminPaymentAPI.list(listParams), [
    status,
    paymentFor,
    search,
    dateFrom,
    dateTo,
    page,
    pageSize,
  ])

  const { mutate: approveMember, loading: approvingMember } = useMutation(adminMemberAPI.updateStatus)
  const { mutate: approvePlanPay, loading: approvingPlan } = useMutation(adminMemberAPI.approvePlanTopupPayment)
  const { mutate: rejectPlanPay, loading: rejectingPlan } = useMutation(adminMemberAPI.rejectPlanTopupPayment)
  const { mutate: approveTradingPay, loading: approvingTrading } = useMutation(adminMemberAPI.approveTradingTopupPayment)
  const { mutate: rejectTradingPay, loading: rejectingTrading } = useMutation(adminMemberAPI.rejectTradingTopupPayment)

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const summary = data?.summary || {}

  const approveRegistration = async (row) => {
    if (!window.confirm('Approve this member? Direct sponsor income is credited on first activation (only once). Continue?')) return
    try {
      await approveMember(row.member_id, { status: 'active' })
      notify('Member approved — registration payment marked approved')
      refetch()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const approvePlan = async (id) => {
    if (!window.confirm('Approve this Plan TOP-UP payment? The member\'s Trade ladder advances +1 (new cycle). Continue?')) return
    try {
      await approvePlanPay(id)
      notify('Plan TOP-UP approved')
      refetch()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const rejectPlan = async (id) => {
    if (!window.confirm('Reject this Plan TOP-UP payment? The member will not advance. Continue?')) return
    try {
      await rejectPlanPay(id)
      notify('Plan TOP-UP rejected')
      refetch()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const approveTrading = async (id) => {
    if (!window.confirm('Approve this trading wallet payment? Funds will be credited to the member\'s trading wallet. Continue?')) return
    try {
      await approveTradingPay(id)
      notify('Trading wallet credited')
      refetch()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const rejectTrading = async (id) => {
    if (!window.confirm('Reject this trading wallet payment? Nothing will be credited. Continue?')) return
    try {
      await rejectTradingPay(id)
      notify('Trading wallet payment rejected')
      refetch()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const setStatusFilter = (v) => {
    setStatus(v)
    const next = new URLSearchParams(searchParams)
    if (v) next.set('status', v)
    else next.delete('status')
    setSearchParams(next, { replace: true })
  }

  const COLS = [
    { key: 'id', label: 'ID', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>#{v}</span> },
    {
      key: 'created_at',
      label: 'Date / time (IST)',
      render: (v) => <span style={{ fontSize: 12 }}>{fmt.time(v)}</span>,
    },
    {
      key: 'member_name',
      label: 'Member',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.member_email}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>ID {r.member_id} · {r.member_referral_code}</div>
        </div>
      ),
    },
    {
      key: 'payment_for',
      label: 'Type',
      render: (v) => (
        <span style={{ fontSize: 12, fontWeight: 600, color: v === 'trading_topup' ? 'var(--orange)' : v === 'plan_topup' ? 'var(--purple)' : 'var(--cyan)' }}>
          {paymentForLabel(v)}
        </span>
      ),
    },
    {
      key: 'payment_type',
      label: 'Method',
      render: (v) => <Badge type="open">{paymentTypeLabel(v)}</Badge>,
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (v) => (
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 600, color: 'var(--gold)' }}>{fmt.usd2(v)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <Badge type={statusBadgeType(v)}>{String(v || 'pending').toUpperCase()}</Badge>,
    },
    {
      key: 'transaction_id',
      label: 'Tx hash',
      render: (v) =>
        v ? (
          <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, wordBreak: 'break-all' }}>{v}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'receipt_image',
      label: 'Receipt',
      render: (v, row) =>
        v ? (
          <Btn
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setReceiptView({
                image: v,
                title: `Receipt #${row.id} — ${row.member_name || 'Member'}`,
              })
            }
            style={{ fontSize: 12 }}
          >
            📄 View
          </Btn>
        ) : (
          '—'
        ),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => {
        if (row.status !== 'pending') return <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>
        const pf = row.payment_for || 'registration'
        const busy = approvingMember || approvingPlan || rejectingPlan || approvingTrading || rejectingTrading

        if (pf === 'registration' && row.member_status === 'pending') {
          return (
            <Btn variant="success" size="sm" loading={busy} onClick={() => approveRegistration(row)}>
              ✓ Approve member
            </Btn>
          )
        }
        if (pf === 'plan_topup' && row.member_status === 'active') {
          return (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn variant="success" size="sm" loading={busy} onClick={() => approvePlan(row.id)}>
                ✓ Approve
              </Btn>
              <Btn variant="danger" size="sm" loading={busy} onClick={() => rejectPlan(row.id)}>
                ✕ Reject
              </Btn>
            </div>
          )
        }
        if (pf === 'trading_topup' && row.member_status === 'active') {
          return (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn variant="success" size="sm" loading={busy} onClick={() => approveTrading(row.id)}>
                ✓ Credit wallet
              </Btn>
              <Btn variant="danger" size="sm" loading={busy} onClick={() => rejectTrading(row.id)}>
                ✕ Reject
              </Btn>
            </div>
          )
        }
        return <span style={{ fontSize: 11, color: 'var(--orange)' }}>Member not active</span>
      },
    },
  ]

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-title">Payments</div>
        <div className="page-subtitle">
          Sab member payments — registration, plan TOP-UP, trading wallet add. Date filter (IST), approve / reject yahi se.
        </div>
      </div>

      {toast && <Alert type={toast.type} onClose={() => setToast(null)} className="mb-4">{toast.msg}</Alert>}

      <div className="grid-stats mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <StatCard icon="📥" label="In range (count)" value={summary.total_count ?? 0} color="cyan" />
        <StatCard icon="💵" label="Total amount" value={fmt.usd2(summary.total_amount)} color="gold" />
        <StatCard icon="⏳" label="Pending" value={`${summary.pending_count ?? 0} · ${fmt.usd2(summary.pending_amount)}`} color="purple" />
        <StatCard icon="✓" label="Approved" value={`${summary.approved_count ?? 0} · ${fmt.usd2(summary.approved_amount)}`} color="green" />
        <StatCard icon="✕" label="Rejected" value={summary.rejected_count ?? 0} color="orange" />
      </div>

      <Card noPad>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px', minWidth: 200, maxWidth: 360 }}>
            <div className="form-label">Search</div>
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Member, email, payment ID, tx hash…" />
          </div>
          <div style={{ minWidth: 140 }}>
            <div className="form-label">Status</div>
            <Select value={status} onChange={(e) => setStatusFilter(e.target.value)} options={STATUS_OPTIONS} />
          </div>
          <div style={{ minWidth: 160 }}>
            <div className="form-label">Payment type</div>
            <Select value={paymentFor} onChange={(e) => setPaymentFor(e.target.value)} options={TYPE_OPTIONS} />
          </div>
          <div style={{ minWidth: 140 }}>
            <div className="form-label">From date (IST)</div>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div style={{ minWidth: 140 }}>
            <div className="form-label">To date (IST)</div>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div style={{ width: 96 }}>
            <div className="form-label">Page size</div>
            <Select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              options={[
                { value: '10', label: '10' },
                { value: '25', label: '25' },
                { value: '50', label: '50' },
                { value: '100', label: '100' },
              ]}
            />
          </div>
          <Btn
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setStatusFilter('')
              setPaymentFor('')
              setDateFrom('')
              setDateTo('')
            }}
          >
            Clear filters
          </Btn>
        </div>

        <div style={{ padding: '12px 24px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', borderBottom: '1px solid var(--border-sm)', fontSize: 13, color: 'var(--text-2)' }}>
          <Btn type="button" variant="ghost" size="sm" disabled={pageSafe <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ◀ Prev
          </Btn>
          <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>
            Page <strong>{pageSafe}</strong> / {totalPages} · <strong>{total}</strong> payments
          </span>
          <Btn type="button" variant="ghost" size="sm" disabled={pageSafe >= totalPages || loading || total === 0} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next ▶
          </Btn>
        </div>

        <Table cols={COLS} rows={data?.payments} loading={loading} emptyIcon="💳" emptyText="No payments in this range — change filters" />
      </Card>

      <PaymentReceiptModal
        open={!!receiptView}
        onClose={() => setReceiptView(null)}
        receiptImage={receiptView?.image}
        title={receiptView?.title || 'Payment receipt'}
      />
    </AdminLayout>
  )
}
