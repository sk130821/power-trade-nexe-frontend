import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { memberAPI, fmt } from '../../api/index.js'
import { MemberLayout } from '../../components/layout/index.jsx'
import { Card, Table, Badge, Btn, Alert, Select, Input, SectionTitle, FormGroup } from '../../components/ui/index.jsx'

function cleanParams(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === undefined || v === null) continue
    out[k] = v
  }
  return out
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-card2)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-sm)' }}>
      <div style={{ fontSize: 22, fontWeight: 600, color, fontFamily: 'JetBrains Mono,monospace' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.4 }}>{label}</div>
    </div>
  )
}

function statusLabel(v) {
  if (v === 'doubled') return '2x Win'
  if (v === 'zeroed') return 'Zero'
  if (v === 'active') return 'Pending'
  return v || '—'
}

export function MemberLiveTradingHistory() {
  const [filt, setFilt] = useState({
    status: '',
    date_from: '',
    date_to: '',
    limit: 50,
  })
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const patchFilt = useCallback((patch) => {
    setFilt((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }, [])

  const listParams = useMemo(
    () =>
      cleanParams({
        status: filt.status,
        date_from: filt.date_from,
        date_to: filt.date_to,
        page,
        limit: filt.limit,
      }),
    [filt.status, filt.date_from, filt.date_to, filt.limit, page],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await memberAPI.getMyDayTradeBuys(listParams)
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

  const rows = data?.rows ?? []
  const summary = data?.summary ?? {}
  const total = Number(data?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / Number(filt.limit || 50)))
  const curPage = Math.min(page, totalPages)

  useEffect(() => {
    if (page > totalPages && total > 0) setPage(totalPages)
  }, [page, totalPages, total])

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Live Trading History</div>
        <div className="page-subtitle">
          All live trades you have bought — session date, quantity, amount, and result (2x / zero / pending).
        </div>
      </div>

      {err && <Alert type="danger" className="mb-4">{err}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatBox label="Total trades" value={summary.total_trades ?? 0} color="var(--text-1)" />
        <StatBox label="Total invested" value={fmt.usd2(summary.total_invested ?? 0)} color="var(--gold)" />
        <StatBox label="Total payout (2x)" value={fmt.usd2(summary.total_payout ?? 0)} color="var(--green)" />
        <StatBox label="Wins (2x)" value={summary.wins ?? 0} color="var(--green)" />
        <StatBox label="Losses (zero)" value={summary.losses ?? 0} color="var(--red)" />
        <StatBox label="Pending" value={summary.pending ?? 0} color="var(--orange)" />
      </div>

      <Card className="mb-5">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ minWidth: 140 }}>
            <FormGroup label="Status">
            <Select value={filt.status} onChange={(e) => patchFilt({ status: e.target.value })}>
              <option value="">All</option>
              <option value="active">Pending</option>
              <option value="doubled">2x Win</option>
              <option value="zeroed">Zero</option>
            </Select>
            </FormGroup>
          </div>
          <div style={{ minWidth: 150 }}>
            <FormGroup label="From (session date)">
            <Input type="date" value={filt.date_from} onChange={(e) => patchFilt({ date_from: e.target.value })} />
            </FormGroup>
          </div>
          <div style={{ minWidth: 150 }}>
            <FormGroup label="To (session date)">
            <Input type="date" value={filt.date_to} onChange={(e) => patchFilt({ date_to: e.target.value })} />
            </FormGroup>
          </div>
          <div style={{ minWidth: 100 }}>
            <FormGroup label="Per page">
            <Select value={filt.limit} onChange={(e) => patchFilt({ limit: Number(e.target.value) })}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </Select>
            </FormGroup>
          </div>
          <Btn variant="ghost" size="sm" onClick={() => { patchFilt({ status: '', date_from: '', date_to: '' }) }}>
            Clear filters
          </Btn>
        </div>
      </Card>

      <SectionTitle>All live trades ({total})</SectionTitle>
      <Card noPad className="mb-6">
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>Loading…</div>
        ) : (
          <Table
            cols={[
              {
                key: 'trade_name',
                label: 'Trade',
                render: (v, r) => (
                  <div>
                    <div style={{ fontWeight: 500 }}>{v}</div>
                    {r.trade_symbol && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.trade_symbol}</div>}
                  </div>
                ),
              },
              {
                key: 'trade_date',
                label: 'Session',
                render: (v) => <span style={{ fontSize: 12 }}>{v ? fmt.date(v) : '—'}</span>,
              },
              {
                key: 'invested_at',
                label: 'Bought at',
                render: (v) => <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmt.time(v)}</span>,
              },
              {
                key: 'quantity',
                label: 'Qty',
                render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{v != null ? Number(v) : '—'}</span>,
              },
              {
                key: 'price_at_buy',
                label: 'Price @ buy',
                render: (v) => (
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>
                    {v != null ? Number(v).toFixed(4) : '—'}
                  </span>
                ),
              },
              {
                key: 'invest_amount',
                label: 'Invested',
                render: (v) => (
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--gold)', fontWeight: 500 }}>
                    {fmt.usd2(v)}
                  </span>
                ),
              },
              {
                key: 'result_amount',
                label: 'Payout',
                render: (v, r) =>
                  r.investment_status === 'doubled' ? (
                    <span style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--green)', fontWeight: 600 }}>
                      {fmt.usd2(v || 0)}
                    </span>
                  ) : r.investment_status === 'zeroed' ? (
                    <span style={{ color: 'var(--red)' }}>$0.00</span>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'investment_status',
                label: 'Result',
                render: (v) => <Badge type={v}>{statusLabel(v)}</Badge>,
              },
            ]}
            rows={rows}
            emptyText="No live trades yet — buy from Live Trading page"
            emptyIcon="◎"
          />
        )}

        {total > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              padding: '12px 16px',
              borderTop: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Page {curPage} of {totalPages} · {total} trade{total !== 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" size="sm" disabled={curPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ← Prev
              </Btn>
              <Btn variant="ghost" size="sm" disabled={curPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next →
              </Btn>
            </div>
          </div>
        )}
      </Card>

      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
        Want to buy a new trade?{' '}
        <Link to="/member/trades" style={{ color: 'var(--cyan)', fontWeight: 600, textDecoration: 'none' }}>
          Go to Live Trading →
        </Link>
      </div>
    </MemberLayout>
  )
}
