import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI, memberAPI, fmt } from '../../api/index.js'
import { useApi } from '../../hooks/useApi.js'
import { MemberLayout } from '../../components/layout/index.jsx'
import { TopupPaymentStatsSummary } from '../../components/TopupPaymentStatsSummary.jsx'
import { TrustWalletPaymentPanel } from '../../components/TrustWalletPaymentPanel.jsx'
import { Alert, Btn, FormGroup, Input, Textarea } from '../../components/ui/index.jsx'
import { PAYMENT_TYPE_TRUST, isEvmTxHash } from '../../utils/paymentTypes.js'

export default function MemberWalletTopup() {
  const navigate = useNavigate()
  const { data: statsPayload, refetch } = useApi(() => memberAPI.getPlanTopupInfo())
  const pendingTrading = statsPayload?.pending_trading_topup_payment
  const [adminSettings, setAdminSettings] = useState({})
  const [payment, setPayment] = useState({ txn_id: '', remark: '', amount: '' })
  const [receiptFile, setReceiptFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    authAPI.getSettings().then((r) => setAdminSettings(r.data || {}))
  }, [])

  const setP = (k) => (e) => setPayment((f) => ({ ...f, [k]: e.target.value }))

  const receiptRequired = !isEvmTxHash(payment.txn_id)

  const submit = async (e) => {
    e.preventDefault()
    const amt = Number(payment.amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount you paid')
      return
    }
    if (receiptRequired && !receiptFile) {
      setError('Upload payment receipt or enter BSC transaction hash (0x…)')
      return
    }
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('payment_type', PAYMENT_TYPE_TRUST)
      fd.append('transaction_id', payment.txn_id)
      fd.append('remark', payment.remark)
      fd.append('amount', String(amt))
      if (receiptFile) fd.append('receipt', receiptFile)
      await memberAPI.submitTradingTopup(fd)
      refetch()
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Submission failed')
    }
    setLoading(false)
  }

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Add to Trading wallet</div>
        <div className="page-subtitle">
          Pay with <strong>USDT BEP20</strong> (BNB Smart Chain). After <strong>admin approval</strong> the amount is credited to your Trading wallet.
        </div>
      </div>

      {statsPayload?.topup_payment_stats ? (
        <div className="mb-6">
          <TopupPaymentStatsSummary stats={statsPayload.topup_payment_stats} compact />
        </div>
      ) : null}

      {error && (
        <Alert type="danger" onClose={() => setError('')} className="mb-4">
          {error}
        </Alert>
      )}

      {done ? (
        <Alert type="success">
          Payment submitted. Admin will review — once approved, your Trading wallet will be credited.
          <div style={{ marginTop: 12 }}>
            <Link to="/member/trades" style={{ color: 'var(--cyan)', fontWeight: 500 }}>
              ← Back to Live Trades
            </Link>
          </div>
        </Alert>
      ) : pendingTrading ? (
        <Alert type="warning">
          A trading wallet payment of <strong>{fmt.usd2(pendingTrading.amount)}</strong> is pending admin approval (ref #{pendingTrading.id}).
        </Alert>
      ) : (
        <div style={{ maxWidth: 560, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
          <TrustWalletPaymentPanel settings={adminSettings} amount={payment.amount} />
          <form onSubmit={submit}>
            <FormGroup label="Amount (USD) you paid" required hint="USDT amount sent on BSC">
              <Input type="number" min="0.01" step="any" value={payment.amount} onChange={setP('amount')} placeholder="100" required />
            </FormGroup>
            <FormGroup label="Transaction hash (BSC)" hint="0x… after USDT BEP20 send">
              <Input value={payment.txn_id} onChange={setP('txn_id')} placeholder="0x…" />
            </FormGroup>
            <FormGroup
              label="Upload receipt"
              required={receiptRequired}
              hint={receiptRequired ? 'JPG, PNG or PDF' : 'Optional if tx hash entered'}
            >
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                required={receiptRequired}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-card2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              />
            </FormGroup>
            <FormGroup label="Remark">
              <Textarea rows={2} value={payment.remark} onChange={setP('remark')} placeholder="Optional note" />
            </FormGroup>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Btn variant="primary" type="submit" loading={loading}>
                Submit payment
              </Btn>
              <Btn variant="ghost" type="button" onClick={() => navigate('/member/trades')}>
                Cancel
              </Btn>
            </div>
          </form>
        </div>
      )}
    </MemberLayout>
  )
}
