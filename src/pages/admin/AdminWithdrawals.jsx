import { useState } from 'react'
import { withdrawalAPI, authAPI, fmt, WALLET_META, WITHDRAWAL_FEE_PERCENT } from '../../api/index.js'
import { useApi, useMutation } from '../../hooks/useApi.js'
import { AdminLayout } from '../../components/layout/index.jsx'
import { Card, Btn, Alert, Table, Badge, Modal, FormGroup, Input, Textarea } from '../../components/ui/index.jsx'
import { buildTrustWalletPayUrl, copyToClipboard } from '../../utils/trustWalletPay.js'
import { USDT_BEP20_LABEL } from '../../components/TrustWalletLogo.jsx'

function CopyAddressBtn({ address, onCopied }) {
  const [copied, setCopied] = useState(false)
  if (!address) return null
  const copy = async () => {
    const ok = await copyToClipboard(address)
    if (ok) {
      setCopied(true)
      onCopied?.('Address copied')
      window.setTimeout(() => setCopied(false), 2000)
    }
  }
  return (
    <Btn type="button" size="sm" variant="ghost" onClick={copy}>
      {copied ? 'Copied!' : 'Copy'}
    </Btn>
  )
}

export default function AdminWithdrawals() {
  const [toast, setToast] = useState(null)
  const [filter, setFilter] = useState('pending')
  const [paidModal, setPaidModal] = useState(null)
  const [rejectModal, setRejectModal] = useState(null)
  const [payoutTx, setPayoutTx] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')

  const { data: web3Settings } = useApi(() => authAPI.getWeb3Config())

  const { data, loading, refetch } = useApi(
    () => withdrawalAPI.adminList(filter ? { status: filter } : {}),
    [filter],
  )
  const { mutate: callMarkPaid, loading: paying } = useMutation(({ id, body }) =>
    withdrawalAPI.adminMarkPaid(id, body),
  )
  const { mutate: callReject, loading: rejecting } = useMutation(({ id, body }) =>
    withdrawalAPI.adminReject(id, body),
  )

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  const rows = data?.withdrawals || []

  const feeOf = (r) =>
    r?.fee_amount != null ? Number(r.fee_amount) : (Number(r?.amount) || 0) * (WITHDRAWAL_FEE_PERCENT / 100)
  const netOf = (r) =>
    r?.net_amount != null && Number(r.net_amount) > 0
      ? Number(r.net_amount)
      : (Number(r?.amount) || 0) * (1 - WITHDRAWAL_FEE_PERCENT / 100)

  const doPaid = async (e) => {
    e.preventDefault()
    try {
      await callMarkPaid({
        id: paidModal.id,
        body: { payout_tx_hash: payoutTx.trim() || null, admin_note: adminNote.trim() || null },
      })
      notify('Marked paid — amount deducted from member wallet')
      setPaidModal(null)
      setPayoutTx('')
      setAdminNote('')
      refetch()
    } catch (err) {
      notify(err.message, 'danger')
    }
  }

  const doReject = async (e) => {
    e.preventDefault()
    try {
      await callReject({ id: rejectModal.id, body: { admin_note: rejectNote.trim() || null } })
      notify('Rejected')
      setRejectModal(null)
      setRejectNote('')
      refetch()
    } catch (err) {
      notify(err.message, 'danger')
    }
  }

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-title">Withdrawals</div>
        <div className="page-subtitle">
          Member withdrawal requests — send <strong>USDT BEP20 (BSC)</strong> to their <strong>destination</strong> address,
          then <strong>Mark paid</strong> here (optional payout tx hash).
        </div>
      </div>
      {toast ? <Alert type={toast.type}>{toast.msg}</Alert> : null}

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['pending', 'paid', 'rejected', ''].map((k) => (
          <Btn
            key={k || 'all'}
            type="button"
            size="sm"
            variant={filter === k ? 'primary' : 'ghost'}
            onClick={() => setFilter(k)}
          >
            {k || 'All'}
          </Btn>
        ))}
      </div>

      <Card noPad title={`Requests (${rows.length})`}>
        <Table
          cols={[
            { key: 'id', label: 'ID' },
            {
              key: 'member_name',
              label: 'Member',
              render: (v, r) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.member_email}</div>
                </div>
              ),
            },
            {
              key: 'wallet_type',
              label: 'From',
              render: (v) => WALLET_META[v]?.label || v,
            },
            { key: 'amount', label: 'Amt', render: (v) => fmt.usd2(v) },
            {
              key: 'fee_amount',
              label: `Fee ${WITHDRAWAL_FEE_PERCENT}%`,
              render: (_, r) => <span style={{ color: 'var(--orange)' }}>{fmt.usd2(feeOf(r))}</span>,
            },
            {
              key: 'net_amount',
              label: 'Send (net)',
              render: (_, r) => <strong style={{ color: 'var(--green)' }}>{fmt.usd2(netOf(r))}</strong>,
            },
            {
              key: 'destination_address',
              label: 'Send to (member)',
              render: (v) =>
                v ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, wordBreak: 'break-all', flex: '1 1 120px' }}>
                      {v}
                    </span>
                    <CopyAddressBtn address={v} onCopied={(msg) => notify(msg)} />
                  </div>
                ) : (
                  '—'
                ),
            },
            {
              key: 'status',
              label: 'St',
              render: (v) => <Badge type={v === 'paid' ? 'active' : v === 'rejected' ? 'rejected' : 'pending'}>{v}</Badge>,
            },
            {
              key: 'id',
              label: 'Actions',
              render: (_, r) =>
                r.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {r.destination_address && buildTrustWalletPayUrl({
                      address: r.destination_address,
                      settings: web3Settings,
                      amount: netOf(r),
                    }) ? (
                      <a
                        href={buildTrustWalletPayUrl({
                          address: r.destination_address,
                          settings: web3Settings,
                          amount: netOf(r),
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-primary"
                        style={{ textDecoration: 'none', fontWeight: 600 }}
                        title={`Open wallet to send ${fmt.usd2(netOf(r))} USDT`}
                      >
                        Pay
                      </a>
                    ) : null}
                    <Btn type="button" size="sm" variant="primary" onClick={() => setPaidModal(r)}>
                      Mark paid
                    </Btn>
                    <Btn type="button" size="sm" variant="ghost" onClick={() => setRejectModal(r)}>
                      Reject
                    </Btn>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.payout_tx_hash || '—'}</span>
                ),
            },
          ]}
          rows={rows}
          loading={loading}
          emptyText="No requests"
        />
      </Card>

      <Modal open={!!paidModal} onClose={() => setPaidModal(null)} title="Mark paid (deducts from wallet)">
        {paidModal ? (
          <form onSubmit={doPaid}>
            <Alert type="warning" className="mb-3">
              Member requested <strong>{fmt.usd2(paidModal.amount)}</strong>. Portal fee {WITHDRAWAL_FEE_PERCENT}% ={' '}
              <strong>{fmt.usd2(feeOf(paidModal))}</strong>. Send only the net{' '}
              <strong style={{ color: 'var(--green)' }}>{fmt.usd2(netOf(paidModal))}</strong> to member address below.
              Marking paid deducts the full {fmt.usd2(paidModal.amount)} from{' '}
              <strong>{WALLET_META[paidModal.wallet_type]?.label}</strong> balance in the app.
            </Alert>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 16,
                padding: 12,
                borderRadius: 8,
                background: 'var(--bg-card2)',
                border: '1px solid var(--border-sm)',
              }}
            >
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Send to (member)</div>
                <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, wordBreak: 'break-all' }}>
                  {paidModal.destination_address}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <CopyAddressBtn address={paidModal.destination_address} onCopied={(msg) => notify(msg)} />
                {buildTrustWalletPayUrl({
                  address: paidModal.destination_address,
                  settings: web3Settings,
                  amount: netOf(paidModal),
                }) ? (
                  <a
                    href={buildTrustWalletPayUrl({
                      address: paidModal.destination_address,
                      settings: web3Settings,
                      amount: netOf(paidModal),
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ textDecoration: 'none', fontWeight: 600 }}
                  >
                    Pay {fmt.usd2(netOf(paidModal))} · {USDT_BEP20_LABEL}
                  </a>
                ) : null}
              </div>
            </div>
            <FormGroup label="Payout tx hash (optional)">
              <Input value={payoutTx} onChange={(e) => setPayoutTx(e.target.value)} placeholder="0x…" />
            </FormGroup>
            <FormGroup label="Admin note">
              <Textarea rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
            </FormGroup>
            <Btn type="submit" variant="primary" loading={paying}>
              Confirm paid
            </Btn>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject withdrawal">
        {rejectModal ? (
          <form onSubmit={doReject}>
            <FormGroup label="Reason (optional)">
              <Textarea rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
            </FormGroup>
            <Btn type="submit" variant="ghost" loading={rejecting} style={{ color: 'var(--red)' }}>
              Reject request
            </Btn>
          </form>
        ) : null}
      </Modal>
    </AdminLayout>
  )
}
