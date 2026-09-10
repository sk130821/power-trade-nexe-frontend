import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { adminMemberAPI, roiAPI, fmt, PACKAGES } from '../../api/index.js'
import { paymentTypeLabel } from '../../utils/paymentTypes.js'
import { useApi, useMutation } from '../../hooks/useApi.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { AdminLayout } from '../../components/layout/index.jsx'
import { Card, Table, Badge, Btn, Alert, Spinner, Modal, Input, Select } from '../../components/ui/index.jsx'
import { PaymentReceiptModal } from '../../components/PaymentReceiptModal.jsx'
import { PlanTopupHistoryList } from '../../components/TopupPaymentStatsSummary.jsx'
import { downloadMembersExcel } from '../../utils/memberExport.js'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending registration' },
  { value: 'active', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
]

const PAYMENT_QUEUE_OPTIONS = [
  { value: 'all', label: 'All members (payment submitted)' },
  { value: 'pending_pay', label: 'Pending payments only' },
  { value: 'unpaid_reg', label: 'Registration — payment NOT submitted' },
]

function paymentStatusBadge(st) {
  if (st === 'approved') return 'approved'
  if (st === 'rejected') return 'rejected'
  return 'pending'
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 0', borderBottom: '1px solid var(--border-sm)' }}>
      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
      <div style={{ fontSize: 14, color: 'var(--text-1)', wordBreak: 'break-word' }}>{value ?? '—'}</div>
    </div>
  )
}

function emptyEditForm() {
  return {
    name: '',
    email: '',
    contact: '',
    aadhaar_no: '',
    dob: '',
    package_amount: '',
    sponsor_referral_code: '',
    wallet_address: '',
    plan_topup_count: '0',
  }
}

export default function AdminMembers() {
  const navigate = useNavigate()
  const { impersonateMember } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlStatus = searchParams.get('status')
  const urlPendingPay = searchParams.get('pending_payment') === '1'
  const urlUnpaidReg = searchParams.get('unpaid_registration') === '1'
  const [status, setStatus] = useState(() => {
    if (urlUnpaidReg) return 'all'
    if (urlStatus && ['pending', 'active', 'rejected'].includes(urlStatus)) return urlStatus
    return 'all'
  })
  const [paymentQueue, setPaymentQueue] = useState(() => {
    if (urlUnpaidReg) return 'unpaid_reg'
    if (urlPendingPay) return 'pending_pay'
    return 'all'
  })
  const [toast, setToast] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [excelBusy, setExcelBusy] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [viewMember, setViewMember] = useState(null)
  const [viewDetailLoading, setViewDetailLoading] = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [revealedPassword, setRevealedPassword] = useState(null)
  const [loginAsLoading, setLoginAsLoading] = useState(false)
  const [confirmTopup, setConfirmTopup] = useState(null)
  const [receiptView, setReceiptView] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 380)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [status, search, planFilter, paymentQueue, dateFrom, dateTo])

  const listParams = useMemo(() => {
    const p = { page, limit: pageSize }
    if (status && status !== 'all' && paymentQueue !== 'unpaid_reg') p.status = status
    if (paymentQueue === 'pending_pay') p.pending_payment = '1'
    if (paymentQueue === 'unpaid_reg') p.unpaid_registration = '1'
    const sq = search.trim()
    if (sq) p.q = sq
    if (planFilter !== '' && planFilter != null) p.package_amount = Number(planFilter)
    if (dateFrom) p.date_from = dateFrom
    if (dateTo) p.date_to = dateTo
    return p
  }, [status, search, planFilter, paymentQueue, dateFrom, dateTo, page, pageSize])

  const { data, loading, refetch } = useApi(() => adminMemberAPI.getAll(listParams), [
    status,
    search,
    planFilter,
    paymentQueue,
    dateFrom,
    dateTo,
    page,
    pageSize,
  ])
  const { data: todayRoi } = useApi(() => roiAPI.getToday(), [])
  const { data: adminStats } = useApi(() => adminMemberAPI.getStats(), [])
  useEffect(() => {
    if (urlUnpaidReg) {
      setPaymentQueue('unpaid_reg')
      setStatus('all')
    } else if (urlPendingPay) {
      setPaymentQueue('pending_pay')
    }
  }, [urlUnpaidReg, urlPendingPay])

  const unpaidCount = Number(adminStats?.unpaidRegistrations ?? 0)
  const showUnpaidList = unpaidCount > 0 || paymentQueue === 'unpaid_reg'
  const { data: unpaidListData, loading: unpaidListLoading, refetch: refetchUnpaidList } = useApi(
    () => adminMemberAPI.getAll({ unpaid_registration: '1', page: 1, limit: 100 }),
    [unpaidCount, paymentQueue],
    { immediate: showUnpaidList },
  )

  const ladderSlots = (() => {
    const t = todayRoi?.topup_tiers
    if (Array.isArray(t) && t.length > 0) return Math.min(12, t.length)
    return 12
  })()
  const { mutate, loading: updating } = useMutation(adminMemberAPI.updateStatus)
  const { mutate: incrTopup, loading: topping } = useMutation(adminMemberAPI.incrementPlanTopup)
  const { mutate: approvePlanPayment, loading: approvingPlanPay } = useMutation(adminMemberAPI.approvePlanTopupPayment)
  const { mutate: rejectPlanPayment, loading: rejectingPlanPay } = useMutation(adminMemberAPI.rejectPlanTopupPayment)
  const { mutate: approveTradingPayment, loading: approvingTradingPay } = useMutation(adminMemberAPI.approveTradingTopupPayment)
  const { mutate: rejectTradingPayment, loading: rejectingTradingPay } = useMutation(adminMemberAPI.rejectTradingTopupPayment)

  const handleStatusChange = (e) => {
    const next = e.target.value
    setStatus(next)
    if (next === 'all') {
      searchParams.delete('status')
      setSearchParams(searchParams, { replace: true })
    } else {
      setSearchParams({ status: next }, { replace: true })
    }
  }

  const handlePaymentQueueChange = (e) => {
    const next = e.target.value
    setPaymentQueue(next)
    const nextParams = new URLSearchParams(searchParams)
    if (next === 'pending_pay') nextParams.set('pending_payment', '1')
    else nextParams.delete('pending_payment')
    if (next === 'unpaid_reg') {
      nextParams.set('unpaid_registration', '1')
      nextParams.delete('status')
      setStatus('all')
    } else {
      nextParams.delete('unpaid_registration')
    }
    setSearchParams(nextParams, { replace: true })
  }

  const scrollToUnpaidList = () => {
    handlePaymentQueueChange({ target: { value: 'unpaid_reg' } })
    requestAnimationFrame(() => {
      document.getElementById('admin-unpaid-reg-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? 'All statuses'

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const bumpTopup = async (id) => {
    try {
      await incrTopup(id)
      notify('Plan top-up +1 (Trade ladder)')
      refetch()
    } catch (e) {
      notify(e.message, 'danger')
    } finally {
      setConfirmTopup(null)
    }
  }

  const askTopupConfirm = (row) => {
    setConfirmTopup({
      id: row.id,
      name: row.name,
      referral_code: row.referral_code,
      plan_topup_count: Number(row.plan_topup_count ?? 0),
      package_amount: row.package_amount,
    })
  }

  const approvePlanTopPay = async (paymentId) => {
    if (!window.confirm('Approve this Plan TOP-UP payment? The member\'s Trade ladder advances +1 (new cycle). This runs once — continue?')) return
    try {
      await approvePlanPayment(paymentId)
      notify('Plan TOP-UP payment approve — ladder +1')
      refetch()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const rejectPlanTopPay = async (paymentId) => {
    if (!window.confirm('Reject this Plan TOP-UP payment? The member will not advance. Continue?')) return
    try {
      await rejectPlanPayment(paymentId)
      notify('Plan TOP-UP payment reject')
      refetch()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const approveTradingTopPay = async (paymentId) => {
    if (!window.confirm('Approve this trading wallet payment? Funds will be credited to the member\'s trading wallet. Continue?')) return
    try {
      await approveTradingPayment(paymentId)
      notify('Trading wallet payment approved — wallet credited')
      refetch()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const rejectTradingTopPay = async (paymentId) => {
    if (!window.confirm('Reject this trading wallet payment? Nothing will be credited. Continue?')) return
    try {
      await rejectTradingPayment(paymentId)
      notify('Trading wallet payment rejected')
      refetch()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const updateStatus = async (id, newStatus) => {
    const confirmMsg = newStatus === 'active'
      ? `Activate member #${id}? Direct sponsor income is credited on first activation (only once). Continue?`
      : `Set member #${id} to "${newStatus}"? They will lose access. Continue?`
    if (!window.confirm(confirmMsg)) return
    try {
      await mutate(id, { status: newStatus })
      notify(`Member ${newStatus} successfully`)
      refetch()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const openViewMember = async (row) => {
    setViewMember(row)
    setViewDetailLoading(true)
    try {
      const res = await adminMemberAPI.getById(row.id)
      setViewMember({
        ...res.data.member,
        plan_topup_history: res.data.plan_topup_history || [],
      })
    } catch (e) {
      notify(e.message, 'danger')
    } finally {
      setViewDetailLoading(false)
    }
  }

  const openEdit = async (row) => {
    setEditMember(row)
    setRevealedPassword(null)
    setNewPassword('')
    setEditLoading(true)
    try {
      const res = await adminMemberAPI.getById(row.id)
      const m = res.data.member
      setEditForm({
        name: m.name || '',
        email: m.email || '',
        contact: m.contact || '',
        aadhaar_no: m.aadhaar_no || '',
        dob: m.dob ? String(m.dob).slice(0, 10) : '',
        package_amount: String(m.package_amount ?? ''),
        sponsor_referral_code: m.sponsor_referral_code || '',
        wallet_address: m.wallet_address || '',
        plan_topup_count: String(m.plan_topup_count ?? 0),
      })
      setEditMember({ ...m, plan_topup_history: res.data.plan_topup_history || [] })
    } catch (e) {
      notify(e.message, 'danger')
      setEditMember(null)
    } finally {
      setEditLoading(false)
    }
  }

  const closeEdit = () => {
    setEditMember(null)
    setEditForm(emptyEditForm())
    setNewPassword('')
    setRevealedPassword(null)
  }

  const saveEdit = async () => {
    if (!editMember?.id) return
    setEditSaving(true)
    try {
      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        contact: editForm.contact.trim(),
        aadhaar_no: editForm.aadhaar_no.trim(),
        dob: editForm.dob,
        package_amount: Number(editForm.package_amount),
        sponsor_referral_code: editForm.sponsor_referral_code.trim(),
        wallet_address: editForm.wallet_address.trim(),
        plan_topup_count: Number(editForm.plan_topup_count),
      }
      const res = await adminMemberAPI.update(editMember.id, payload)
      notify('Member details saved')
      setEditMember(res.data.member)
      if (viewMember?.id === editMember.id) setViewMember(res.data.member)
      refetch()
    } catch (e) {
      notify(e.message, 'danger')
    } finally {
      setEditSaving(false)
    }
  }

  const savePassword = async () => {
    if (!editMember?.id || newPassword.length < 6) {
      notify('Password must be at least 6 characters', 'danger')
      return
    }
    setPasswordSaving(true)
    try {
      const res = await adminMemberAPI.setPassword(editMember.id, { new_password: newPassword })
      setRevealedPassword(res.data.password)
      setNewPassword('')
      notify('Password set — copy and share with member')
      const fresh = await adminMemberAPI.getById(editMember.id)
      setEditMember(fresh.data.member)
    } catch (e) {
      notify(e.message, 'danger')
    } finally {
      setPasswordSaving(false)
    }
  }

  const loginAsMember = async (memberId) => {
    setLoginAsLoading(true)
    try {
      const res = await adminMemberAPI.impersonate(memberId)
      impersonateMember(res.data.user, res.data.token)
      notify(`Logged in as ${res.data.user.name}`)
      navigate('/member/dashboard')
    } catch (e) {
      notify(e.message, 'danger')
    } finally {
      setLoginAsLoading(false)
    }
  }

  const handleExcel = async () => {
    const p = { ...listParams, export: 1 }
    delete p.page
    delete p.limit
    setExcelBusy(true)
    try {
      const res = await adminMemberAPI.getAll(p, { timeout: 120000 })
      const rows = res.data?.members ?? []
      const meta = [
        `IST registration date ${dateFrom || '—'} to ${dateTo || '—'}`,
        status !== 'all' ? `Status: ${status}` : 'All statuses',
        search.trim() ? `Search: ${search.trim()}` : '',
        `Rows: ${rows.length} (matching total ${res.data?.total ?? 0})`,
        res.data?.exportTruncated ? `Max ${res.data?.exportMax} rows — truncated.` : '',
      ].filter(Boolean)
      downloadMembersExcel(rows, `admin-members_${dateFrom || 'start'}_${dateTo || 'end'}`, { metaLines: meta })
      notify('Excel downloaded.')
    } catch (e) {
      notify(e.response?.data?.error || e.message || 'Excel download failed', 'danger')
    } finally {
      setExcelBusy(false)
    }
  }

  const packageEditOptions = useMemo(
    () => PACKAGES.map((p) => ({ value: String(p.amount), label: `${p.label} ($${p.amount})` })),
    [],
  )

  const total = Number(data?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageSafe = Math.min(page, totalPages)

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(total / pageSize))
    if (total > 0 && page > tp) setPage(tp)
  }, [total, pageSize, page])

  const planOptions = useMemo(
    () => [{ value: '', label: 'All packages' }, ...PACKAGES.map((p) => ({ value: String(p.amount), label: `${p.label} ($${p.amount})` }))],
    [],
  )

  const snOffset = (pageSafe - 1) * pageSize
  const tableRows = useMemo(
    () => (data?.members || []).map((row, i) => ({ ...row, _sno: snOffset + i + 1 })),
    [data?.members, snOffset],
  )

  const unpaidListRows = useMemo(
    () => (unpaidListData?.members || []).map((row, i) => ({ ...row, _sno: i + 1 })),
    [unpaidListData?.members],
  )

  const unpaidListTotal = Number(unpaidListData?.total ?? unpaidListRows.length)

  const renderActions = (row) => (
    <div className="admin-members-actions">
      <div className="admin-members-actions-row">
        <Btn variant="primary" size="sm" onClick={() => openViewMember(row)}>View</Btn>
        <Btn variant="ghost" size="sm" onClick={() => openEdit(row)}>Edit</Btn>
      </div>
      {row.status !== 'rejected' && (
        <div className="admin-members-actions-row">
          <Btn variant="ghost" size="sm" loading={loginAsLoading} onClick={() => loginAsMember(row.id)}>
            Login as
          </Btn>
        </div>
      )}
      {row.status === 'pending' && (row.latest_payment_id || row.payment_status) && (
        <div className="admin-members-actions-row">
          <Btn variant="success" size="sm" loading={updating} onClick={() => updateStatus(row.id, 'active')}>Approve</Btn>
          <Btn variant="danger" size="sm" loading={updating} onClick={() => updateStatus(row.id, 'rejected')}>Reject</Btn>
        </div>
      )}
      {row.status === 'active' && (
        <>
          {row.pending_payment_for === 'plan_topup' && row.pending_payment_id ? (
            <div className="admin-members-actions-row">
              <Btn variant="success" size="sm" loading={approvingPlanPay} onClick={() => approvePlanTopPay(row.pending_payment_id)}>TOP-UP ✓</Btn>
              <Btn variant="danger" size="sm" loading={rejectingPlanPay} onClick={() => rejectPlanTopPay(row.pending_payment_id)}>TOP-UP ✕</Btn>
            </div>
          ) : null}
          {row.pending_payment_for === 'trading_topup' && row.pending_payment_id ? (
            <div className="admin-members-actions-row">
              <Btn variant="success" size="sm" loading={approvingTradingPay} onClick={() => approveTradingTopPay(row.pending_payment_id)}>Wallet ✓</Btn>
              <Btn variant="danger" size="sm" loading={rejectingTradingPay} onClick={() => rejectTradingTopPay(row.pending_payment_id)}>Wallet ✕</Btn>
            </div>
          ) : null}
          <div className="admin-members-actions-row">
            <Btn variant="ghost" size="sm" loading={topping} onClick={() => askTopupConfirm(row)}>+ TOP-UP</Btn>
            <Btn variant="danger" size="sm" onClick={() => updateStatus(row.id, 'rejected')}>Block</Btn>
          </div>
        </>
      )}
      {row.status === 'rejected' && (
        <div className="admin-members-actions-row">
          <Btn variant="success" size="sm" onClick={() => updateStatus(row.id, 'active')}>Activate</Btn>
        </div>
      )}
    </div>
  )

  const COLS = [
    {
      key: '_sno',
      label: 'S.No',
      cellClass: 'col-sno',
      render: (v) => <span>{v}</span>,
    },
    {
      key: 'name',
      label: 'Member',
      render: (_, row) => (
        <div className="admin-member-cell">
          <div className="admin-member-avatar" aria-hidden>
            {(row.name || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="admin-member-name">{row.name}</div>
            <div className="admin-member-meta">{row.email}</div>
            {row.contact ? <div className="admin-member-meta">{row.contact}</div> : null}
            <div className="admin-member-code">{row.referral_code || '—'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'package_amount',
      label: 'Plan',
      render: (v, row) => (
        <div className="admin-plan-cell">
          <span className="admin-plan-amount">${v}</span>
          <span className="admin-plan-topups">TOP-UP: {Number(row.plan_topup_count ?? 0)}</span>
        </div>
      ),
    },
    {
      key: 'sponsor_name',
      label: 'Sponsor',
      render: (v) => (
        <span style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 120, display: 'block' }}>{v || '—'}</span>
      ),
    },
    {
      key: 'payment_type',
      label: 'Payment',
      render: (v, row) => (
        <div className="admin-payment-cell">
          {!row.latest_payment_id && !row.payment_status ? (
            <Badge type="pending">Not submitted</Badge>
          ) : null}
          {v ? <Badge type={v === 'trust_wallet' || v === 'metamask' ? 'open' : 'pending'}>{paymentTypeLabel(v)}</Badge> : null}
          {(row.payment_status || row.pending_payment_id) ? (
            <>
              <Badge type={paymentStatusBadge(row.pending_payment_id ? 'pending' : row.payment_status)}>
                {(row.pending_payment_id ? 'pending' : row.payment_status || 'pending').toUpperCase()}
              </Badge>
              {(row.pending_payment_amount ?? row.latest_payment_amount) != null ? (
                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: 'var(--gold)' }}>
                  {fmt.usd2(row.pending_payment_amount ?? row.latest_payment_amount)}
                </span>
              ) : null}
            </>
          ) : null}
          {(row.pending_payment_for || row.payment_for) === 'plan_topup' ? (
            <span style={{ fontSize: 10, color: 'var(--purple)', fontWeight: 500 }}>Plan TOP-UP</span>
          ) : null}
          {(row.pending_payment_for || row.payment_for) === 'trading_topup' ? (
            <span style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 500 }}>Wallet add</span>
          ) : null}
          {row.receipt_image ? (
            <Btn
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReceiptView({ image: row.receipt_image, title: `Receipt — ${row.name}` })}
              style={{ fontSize: 11, padding: '2px 6px', alignSelf: 'flex-start' }}
            >
              Receipt
            </Btn>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v, row) => (
        <div className="admin-status-date">
          <Badge type={v}>{v}</Badge>
          <time dateTime={row.created_at}>{fmt.date(row.created_at)}</time>
        </div>
      ),
    },
    {
      key: 'id',
      label: 'Actions',
      cellClass: 'col-actions',
      render: (_, row) => renderActions(row),
    },
  ]

  const UNPAID_LIST_COLS = [
    {
      key: '_sno',
      label: 'S.No',
      cellClass: 'col-sno',
      render: (v) => <span>{v}</span>,
    },
    {
      key: 'name',
      label: 'Member',
      render: (_, row) => (
        <div>
          <div className="admin-member-name">{row.name}</div>
          <div className="admin-member-meta">{row.email}</div>
          {row.contact ? <div className="admin-member-meta">{row.contact}</div> : null}
        </div>
      ),
    },
    {
      key: 'referral_code',
      label: 'Member ID',
      render: (v) => (
        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 600, color: 'var(--cyan)' }}>{v || '—'}</span>
      ),
    },
    {
      key: 'package_amount',
      label: 'Package',
      render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--gold)' }}>${v}</span>,
    },
    {
      key: 'sponsor_name',
      label: 'Sponsor',
      render: (v) => <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{v || '—'}</span>,
    },
    {
      key: 'created_at',
      label: 'Registered',
      render: (v) => <time dateTime={v} style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmt.date(v)}</time>,
    },
    {
      key: 'id',
      label: 'Actions',
      cellClass: 'col-actions',
      render: (_, row) => (
        <div className="admin-members-actions">
          <div className="admin-members-actions-row">
            <Btn variant="primary" size="sm" onClick={() => openViewMember(row)}>View</Btn>
            <Btn variant="ghost" size="sm" loading={loginAsLoading} onClick={() => loginAsMember(row.id)}>Login as</Btn>
          </div>
        </div>
      ),
    },
  ]

  const m = viewMember

  return (
    <AdminLayout>
      <div className="page-header admin-members-page">
        <div className="page-title">Members</div>
        <div className="page-subtitle">
          Manage registrations, approvals, and member profiles. IST date filter & Excel export. Payment history is under <strong>Payments</strong>.
        </div>
      </div>

      <div className="admin-members-stats">
        <div className="admin-members-stat-pill">
          <span className="admin-members-stat-label">Total (this filter)</span>
          <span className="admin-members-stat-value">{total}</span>
        </div>
        <div
          className="admin-members-stat-pill admin-members-stat-pill--clickable"
          role="button"
          tabIndex={0}
          onClick={() => handleStatusChange({ target: { value: 'pending' } })}
          onKeyDown={(e) => e.key === 'Enter' && handleStatusChange({ target: { value: 'pending' } })}
        >
          <span className="admin-members-stat-label">Pending approve</span>
          <span className="admin-members-stat-value" style={{ color: 'var(--gold)' }}>{adminStats?.pendingMembers ?? '—'}</span>
        </div>
        <div
          className="admin-members-stat-pill admin-members-stat-pill--clickable"
          role="button"
          tabIndex={0}
          onClick={scrollToUnpaidList}
          onKeyDown={(e) => e.key === 'Enter' && scrollToUnpaidList()}
        >
          <span className="admin-members-stat-label">Unpaid registration</span>
          <span className="admin-members-stat-value" style={{ color: 'var(--orange)' }}>{adminStats?.unpaidRegistrations ?? 0}</span>
        </div>
        <div className="admin-members-stat-pill">
          <span className="admin-members-stat-label">Active members</span>
          <span className="admin-members-stat-value" style={{ color: 'var(--cyan)' }}>{adminStats?.totalMembers ?? '—'}</span>
        </div>
      </div>

      {(Number(adminStats?.unpaidRegistrations) > 0 || paymentQueue === 'unpaid_reg') && (
        <Alert
          type={paymentQueue === 'unpaid_reg' ? 'warning' : 'info'}
          className="mb-4"
        >
          <strong>
            {paymentQueue === 'unpaid_reg' ? total : adminStats?.unpaidRegistrations ?? 0} registration(s) — payment not submitted
          </strong>
          {' '}— OTP verified, Member ID created, but package payment proof not uploaded yet. Member must log in and submit payment.
          {paymentQueue !== 'unpaid_reg' ? (
            <>
              {' '}
              <button
                type="button"
                onClick={scrollToUnpaidList}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--cyan)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                View unpaid list →
              </button>
            </>
          ) : null}
        </Alert>
      )}

      {showUnpaidList && (
        <div id="admin-unpaid-reg-list">
        <Card
          className="mb-6"
          title={`Unpaid registration list (${unpaidListTotal})`}
          action={
            paymentQueue !== 'unpaid_reg' ? (
              <Btn type="button" variant="ghost" size="sm" onClick={scrollToUnpaidList}>
                Filter all members ↓
              </Btn>
            ) : null
          }
        >
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 14px', lineHeight: 1.55 }}>
            OTP verified and Member ID created — waiting for package payment proof. Member must log in and submit payment on the registration payment page.
          </p>
          <Table
            cols={UNPAID_LIST_COLS}
            rows={unpaidListRows}
            loading={unpaidListLoading}
            emptyIcon="📝"
            emptyText="No unpaid registrations in this list"
          />
        </Card>
        </div>
      )}

      {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}

      <Card noPad className="admin-members-card">
        <div className="admin-members-filters">
          <div>
            <div className="form-label">Search</div>
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Name, email, phone, member ID…" />
          </div>
          <div>
            <div className="form-label">Status</div>
            <Select value={status} onChange={handleStatusChange} options={STATUS_OPTIONS} disabled={paymentQueue === 'unpaid_reg'} />
          </div>
          <div>
            <div className="form-label">Payments</div>
            <Select value={paymentQueue} onChange={handlePaymentQueueChange} options={PAYMENT_QUEUE_OPTIONS} />
          </div>
          <div>
            <div className="form-label">Package</div>
            <Select value={planFilter === '' ? '' : String(planFilter)} onChange={(e) => setPlanFilter(e.target.value === '' ? '' : Number(e.target.value))} options={planOptions} placeholder="All packages" />
          </div>
          <div>
            <div className="form-label">From date (IST)</div>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <div className="form-label">To date (IST)</div>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <div className="form-label">Per page</div>
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
              setPlanFilter('')
              setDateFrom('')
              setDateTo('')
              setStatus('all')
              setPaymentQueue('all')
              setSearchParams({}, { replace: true })
            }}
          >
            Clear
          </Btn>
          <Btn type="button" variant="success" loading={excelBusy} onClick={handleExcel} disabled={loading || excelBusy}>
            ⬇ Excel
          </Btn>
        </div>
        <div className="admin-members-pagination">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Btn type="button" variant="ghost" size="sm" disabled={pageSafe <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ◀ Prev
            </Btn>
            <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>
              Page <strong>{pageSafe}</strong> / {totalPages}
            </span>
            <Btn type="button" variant="ghost" size="sm" disabled={pageSafe >= totalPages || loading || total === 0} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next ▶
            </Btn>
          </div>
          <span>
            Showing <strong>{snOffset + 1}–{snOffset + (tableRows.length || 0)}</strong> of <strong>{total}</strong>
          </span>
        </div>
        <div className="admin-members-table-wrap">
          <Table cols={COLS} rows={tableRows} loading={loading} emptyIcon="👥" emptyText={paymentQueue === 'unpaid_reg' ? 'No unpaid registrations — all OTP signups have submitted payment' : `No members — change ${statusLabel} or search`} />
        </div>
        {total > 0 && (
          <div className="admin-members-footer">
            S.No continues across pages · {tableRows.length} row(s) on this page
          </div>
        )}
      </Card>

      <Modal open={!!m} onClose={() => setViewMember(null)} title={m ? `Member #${m.id} — ${m.name}` : ''} maxWidth={640}>
        {m ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <DetailRow label="Status" value={<Badge type={m.status}>{m.status}</Badge>} />
            </div>
            <DetailRow label="Email" value={m.email} />
            <DetailRow label="Contact" value={m.contact} />
            <DetailRow label="Aadhaar / Passport" value={m.aadhaar_no} />
            <DetailRow label="DOB" value={fmt.date(m.dob)} />
            <DetailRow label="DB ID" value={`#${m.id}`} />
            <DetailRow label="Member ID" value={m.referral_code} />
            <DetailRow label="Sponsor" value={m.sponsor_referral_code ? `${m.sponsor_name || '—'} (${m.sponsor_referral_code})` : m.sponsor_name || '—'} />
            <DetailRow label="Package (USD)" value={`$${m.package_amount}`} />
            <DetailRow label="Plan top-ups (retopup)" value={`${Number(m.plan_topup_count ?? 0)} — unlimited (12 slots cycle)`} />
            <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
              <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--purple)', letterSpacing: '0.06em', marginBottom: 10 }}>
                Retopup history (kab kab hua)
              </div>
              {viewDetailLoading ? (
                <div style={{ padding: 16, textAlign: 'center' }}><Spinner size="sm" /></div>
              ) : (
                <PlanTopupHistoryList
                  rows={m.plan_topup_history || []}
                  maxHeight={280}
                  emptyHint="No retopup yet — member payment ya admin + TOP-UP ke baad yahan date dikhegi"
                />
              )}
            </div>
            <DetailRow label="Joined" value={fmt.date(m.created_at)} />
            <div style={{ gridColumn: '1 / -1', marginTop: 8, fontWeight: 500, fontSize: 12, color: 'var(--cyan)', letterSpacing: '0.06em' }}>Wallets & income (DB)</div>
            <DetailRow label="Exchange wallet" value={fmt.usd2(m.exchange_wallet)} />
            <DetailRow label="Trading wallet" value={fmt.usd2(m.trading_wallet)} />
            <DetailRow label="Salary wallet" value={fmt.usd2(m.salary_wallet)} />
            <DetailRow label="Total income (all)" value={fmt.usd2(m.total_income)} />
            <DetailRow label="Trade / Direct / Level" value={`${fmt.usd2(m.total_roi_income)} · ${fmt.usd2(m.total_direct_income)} · ${fmt.usd2(m.total_level_income)}`} />
            <DetailRow label="Salary / Trading / Reward" value={`${fmt.usd2(m.total_salary_income)} · ${fmt.usd2(m.total_trading_income)} · ${fmt.usd2(m.total_reward_income)}`} />
            <div style={{ gridColumn: '1 / -1', marginTop: 8, fontWeight: 500, fontSize: 12, color: 'var(--purple)', letterSpacing: '0.06em' }}>Payment (latest record)</div>
            <DetailRow label="Payment category" value={m.payment_for || 'registration'} />
            {m.latest_payment_amount != null && m.latest_payment_amount !== '' ? (
              <DetailRow label="Latest payment amount" value={`$${m.latest_payment_amount}`} />
            ) : null}
            <DetailRow label="Payment type" value={m.payment_type ? String(m.payment_type).toUpperCase() : '—'} />
            <DetailRow label="Payment status" value={m.payment_status ?? '—'} />
            {m.receipt_image ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <Btn
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setReceiptView({ image: m.receipt_image, title: `Receipt — ${m.name}` })}
                >
                  📄 View receipt
                </Btn>
              </div>
            ) : null}
            {m.aadhaar_photo ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <a href={`/uploads/${m.aadhaar_photo}`} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)', fontWeight: 500 }}>
                  📷 Aadhaar / Passport photo
                </a>
              </div>
            ) : null}
            {m.payment_remark ? <DetailRow label="Payment remark" value={m.payment_remark} /> : null}
            <div style={{ gridColumn: '1 / -1', marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={() => openEdit(m)}>
                ✎ Edit member
              </Btn>
              {m.status !== 'rejected' && (
                <Btn variant="primary" loading={loginAsLoading} onClick={() => loginAsMember(m.id)}>
                  ⤷ Login as member
                </Btn>
              )}
              <Btn variant="ghost" onClick={() => setViewMember(null)}>
                Close
              </Btn>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!editMember} onClose={closeEdit} title={editMember ? `Edit — ${editMember.name} (#${editMember.id})` : ''} maxWidth={720}>
        {editLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
        ) : editMember ? (
          <div>
            <Alert type="info" className="mb-4">
              Passwords are encrypted in the database — the old password cannot be read. Set a new password below; it will be shown after save.
            </Alert>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
              <div>
                <div className="form-label">Name</div>
                <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <div className="form-label">Email</div>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <div className="form-label">Contact</div>
                <Input value={editForm.contact} onChange={(e) => setEditForm((f) => ({ ...f, contact: e.target.value }))} />
              </div>
              <div>
                <div className="form-label">Aadhaar / Passport</div>
                <Input value={editForm.aadhaar_no} onChange={(e) => setEditForm((f) => ({ ...f, aadhaar_no: e.target.value }))} />
              </div>
              <div>
                <div className="form-label">Date of birth</div>
                <Input type="date" value={editForm.dob} onChange={(e) => setEditForm((f) => ({ ...f, dob: e.target.value }))} />
              </div>
              <div>
                <div className="form-label">Package (USD)</div>
                <Select
                  value={editForm.package_amount}
                  onChange={(e) => setEditForm((f) => ({ ...f, package_amount: e.target.value }))}
                  options={packageEditOptions}
                />
              </div>
              <div>
                <div className="form-label">Sponsor Member ID</div>
                <Input
                  value={editForm.sponsor_referral_code}
                  onChange={(e) => setEditForm((f) => ({ ...f, sponsor_referral_code: e.target.value.toUpperCase() }))}
                  placeholder="PTN code or empty = no sponsor"
                />
              </div>
              <div>
                <div className="form-label">USDT BEP20 address</div>
                <Input
                  value={editForm.wallet_address}
                  onChange={(e) => setEditForm((f) => ({ ...f, wallet_address: e.target.value }))}
                  placeholder="0x…"
                />
              </div>
              <div>
                <div className="form-label">Plan top-up count</div>
                <Input
                  type="number"
                  min={0}
                  value={editForm.plan_topup_count}
                  onChange={(e) => setEditForm((f) => ({ ...f, plan_topup_count: e.target.value }))}
                />
              </div>
              <div>
                <div className="form-label">Member ID</div>
                <Input value={editMember.referral_code || ''} disabled />
              </div>
              <div>
                <div className="form-label">Status</div>
                <Input value={editMember.status || ''} disabled />
              </div>
            </div>

            <div style={{ marginTop: 20, padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card2)' }}>
              <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 13 }}>Password</div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 12px' }}>
                {editMember.password_info?.login_hint || '—'}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <div className="form-label">Set new password</div>
                  <Input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                  />
                </div>
                <Btn variant="ghost" loading={passwordSaving} onClick={savePassword}>
                  Set password
                </Btn>
              </div>
              {revealedPassword ? (
                <Alert type="success" className="mt-3">
                  New password: <strong style={{ fontFamily: 'JetBrains Mono,monospace' }}>{revealedPassword}</strong>
                  {' '}
                  <Btn
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard?.writeText(revealedPassword)}
                  >
                    Copy
                  </Btn>
                </Alert>
              ) : null}
            </div>

            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <DetailRow label="Exchange wallet" value={fmt.usd2(editMember.exchange_wallet)} />
              <DetailRow label="Trading wallet" value={fmt.usd2(editMember.trading_wallet)} />
              <DetailRow label="Salary wallet" value={fmt.usd2(editMember.salary_wallet)} />
              <DetailRow label="Total income" value={fmt.usd2(editMember.total_income)} />
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="primary" loading={editSaving} onClick={saveEdit}>
                Save changes
              </Btn>
              {editMember.status !== 'rejected' && (
                <Btn variant="ghost" loading={loginAsLoading} onClick={() => loginAsMember(editMember.id)}>
                  ⤷ Login as member
                </Btn>
              )}
              <Btn variant="ghost" onClick={closeEdit}>
                Cancel
              </Btn>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!confirmTopup}
        onClose={() => !topping && setConfirmTopup(null)}
        title="Confirm plan TOP-UP"
        maxWidth={480}
      >
        {confirmTopup ? (
          <div>
            <Alert type="warning" className="mb-4">
              Manual TOP-UP increases the member&apos;s ladder count by <strong>+1</strong>. Direct sponsor income is <strong>not</strong> created on TOP-UP.
            </Alert>
            <DetailRow label="Member" value={`${confirmTopup.name} (${confirmTopup.referral_code})`} />
            <DetailRow label="Current TOP-UP count" value={String(confirmTopup.plan_topup_count)} />
            <DetailRow label="After confirm" value={String(confirmTopup.plan_topup_count + 1)} />
            <DetailRow label="Package" value={`$${confirmTopup.package_amount}`} />
            <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="success" loading={topping} onClick={() => bumpTopup(confirmTopup.id)}>
                ✓ Confirm TOP-UP
              </Btn>
              <Btn variant="ghost" disabled={topping} onClick={() => setConfirmTopup(null)}>
                Cancel
              </Btn>
            </div>
          </div>
        ) : null}
      </Modal>

      <PaymentReceiptModal
        open={!!receiptView}
        onClose={() => setReceiptView(null)}
        receiptImage={receiptView?.image}
        title={receiptView?.title || 'Payment receipt'}
      />
    </AdminLayout>
  )
}
