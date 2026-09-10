import { useState, useEffect, useMemo, useCallback } from 'react'
import { memberAPI, INCOME_META, WALLET_META, fmt } from '../../api/index.js'
import { MemberLayout } from '../../components/layout/index.jsx'
import { Card, Table, Btn, Alert, Select, Input, SectionTitle, IncomeBadge } from '../../components/ui/index.jsx'
import { downloadTransactionsExcel } from '../../utils/transactionExport.js'

function cleanParams(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === undefined || v === null) continue
    out[k] = v
  }
  return out
}

export function MemberTransactionHistory() {
  const [filt, setFilt] = useState({
    income_type: '',
    wallet_type: '',
    date_from: '',
    date_to: '',
    limit: 50,
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
      cleanParams({
        income_type: filt.income_type,
        wallet_type: filt.wallet_type,
        date_from: filt.date_from,
        date_to: filt.date_to,
        page,
        limit: filt.limit,
      }),
    [filt.income_type, filt.wallet_type, filt.date_from, filt.date_to, filt.limit, page],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await memberAPI.getTransactions(listParams)
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

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleExcel = async () => {
    const p = cleanParams({
      income_type: filt.income_type,
      wallet_type: filt.wallet_type,
      date_from: filt.date_from,
      date_to: filt.date_to,
      export: 1,
    })
    setExcelBusy(true)
    try {
      const res = await memberAPI.getTransactions(p, { timeout: 120000 })
      const rows = res.data?.transactions ?? []
      const meta = [
        `Filter: IST date ${filt.date_from || '—'} to ${filt.date_to || '—'}`,
        `Rows in file: ${rows.length} (total matching: ${res.data?.total ?? 0})`,
        res.data?.exportTruncated ? `Max ${res.data?.exportMax} rows — truncated.` : '',
      ].filter(Boolean)
      downloadTransactionsExcel(rows, `member-transactions_${filt.date_from || 'start'}_${filt.date_to || 'end'}`, {
        includeMember: false,
        metaLines: meta,
      })
      notify('Excel downloaded.')
    } catch (e) {
      notify(e.response?.data?.error || e.message || 'Excel fail', 'danger')
    } finally {
      setExcelBusy(false)
    }
  }

  const grandTotal = data?.summary?.reduce((s, r) => s + Number(r.total), 0) || 0

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Transaction History</div>
        <div className="page-subtitle">All your credits — IST date filter, pagination, Excel export</div>
      </div>
      {toast ? <Alert type={toast.type}>{toast.msg}</Alert> : null}
      {err ? (
        <Alert type="danger" className="mb-4">
          {err}
        </Alert>
      ) : null}

      <SectionTitle>Filtered totals (same filters as table)</SectionTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {Object.entries(INCOME_META).map(([key, meta]) => {
          const row = data?.summary?.find((s) => s.income_type === key)
          return (
            <div
              key={key}
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                border: `1px solid ${filt.income_type === key ? meta.color : 'var(--border-sm)'}`,
                background: filt.income_type === key ? 'var(--cyan-dim)' : 'var(--bg-card2)',
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 8 }}>{meta.icon}</span>
              <span style={{ fontWeight: 500, color: meta.color }}>{fmt.usd2(row?.total || 0)}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>{meta.label}</span>
            </div>
          )
        })}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(245,214,163,0.35)',
            background: 'linear-gradient(135deg,rgba(0,229,255,0.06),rgba(168,85,247,0.06))',
          }}
        >
          <span style={{ fontWeight: 500, color: 'var(--gold)' }}>{fmt.usd2(grandTotal)}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>combined</span>
        </div>
      </div>

      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div className="form-label">From (IST calendar)</div>
            <Input type="date" value={filt.date_from} onChange={(e) => patchFilt({ date_from: e.target.value })} />
          </div>
          <div>
            <div className="form-label">To (IST calendar)</div>
            <Input type="date" value={filt.date_to} onChange={(e) => patchFilt({ date_to: e.target.value })} />
          </div>
          <div style={{ minWidth: 180 }}>
            <div className="form-label">Income type</div>
            <Select
              value={filt.income_type}
              onChange={(e) => patchFilt({ income_type: e.target.value })}
              placeholder="All"
              options={Object.entries(INCOME_META).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }))}
            />
          </div>
          <div style={{ minWidth: 160 }}>
            <div className="form-label">Wallet</div>
            <Select
              value={filt.wallet_type}
              onChange={(e) => patchFilt({ wallet_type: e.target.value })}
              placeholder="All"
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
            onClick={() => {
              patchFilt({ income_type: '', wallet_type: '', date_from: '', date_to: '' })
            }}
          >
            Clear dates &amp; type
          </Btn>
          <Btn type="button" variant="success" loading={excelBusy} onClick={handleExcel} disabled={loading || excelBusy}>
            ⬇ Excel (filtered range)
          </Btn>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            marginBottom: 14,
            fontSize: 13,
            color: 'var(--text-2)',
          }}
        >
          <Btn type="button" variant="ghost" size="sm" disabled={curPage <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ◀ Prev
          </Btn>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            Page <strong>{curPage}</strong> / {totalPages} · <strong>{total}</strong> credits
          </span>
          <Btn type="button" variant="ghost" size="sm" disabled={curPage >= totalPages || loading || total === 0} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next ▶
          </Btn>
        </div>

        <Table
          cols={[
            { key: 'txn_id', label: 'TXN ID', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: 'var(--cyan)' }}>{v}</span> },
            { key: 'created_at', label: 'Credit (your time)', render: (v) => <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmt.time(v)}</span> },
            {
              key: 'income_type',
              label: 'Type',
              render: (v, r) => (
                <div>
                  <IncomeBadge type={v} />
                  {r.level_no ? <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>Level {r.level_no}</div> : null}
                  {r.from_name ? <div style={{ fontSize: 10, color: 'var(--text-3)' }}>From: {r.from_name}</div> : null}
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
            {
              key: 'amount',
              label: 'Amount',
              render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 500, color: 'var(--green)', fontSize: 14 }}>+{fmt.usd(v, 4)}</span>,
            },
            {
              key: 'description',
              label: 'Description',
              render: (v) => <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{v}</span>,
            },
          ]}
          rows={data?.transactions}
          loading={loading}
          emptyText="No transactions match this filter"
          emptyIcon="📊"
        />
      </Card>
    </MemberLayout>
  )
}
