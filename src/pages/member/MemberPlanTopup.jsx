import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI, memberAPI, fmt } from '../../api/index.js'
import { MemberLayout } from '../../components/layout/index.jsx'
import { TopupPaymentStatsSummary, PlanTopupHistoryList } from '../../components/TopupPaymentStatsSummary.jsx'
import { TrustWalletPaymentPanel } from '../../components/TrustWalletPaymentPanel.jsx'
import { Alert, Btn, Card, FormGroup, Input, Textarea } from '../../components/ui/index.jsx'
import { PAYMENT_TYPE_TRUST } from '../../utils/paymentTypes.js'

/** Trade ladder plan TOP-UP — USDT BEP20; ladder +1 after admin approval. */
export default function MemberPlanTopup() {
  const navigate = useNavigate()
  const [adminSettings, setAdminSettings] = useState({})
  const [info, setInfo] = useState(null)
  const [infoErr, setInfoErr] = useState(null)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [payment, setPayment] = useState({ txn_id: '', remark: '' })
  const [receiptFile, setReceiptFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const setP = (k) => (e) => setPayment((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    authAPI.getSettings().then((r) => setAdminSettings(r.data || {}))
  }, [])

  const loadInfo = async () => {
    setLoadingInfo(true)
    setInfoErr(null)
    try {
      const { data } = await memberAPI.getPlanTopupInfo()
      setInfo(data)
    } catch (e) {
      setInfoErr(e.response?.data?.error || e.message || 'Info load failed')
    }
    setLoadingInfo(false)
  }

  useEffect(() => {
    loadInfo()
  }, [])

  const amountDue = info?.next_payment?.amount_due_usd
  const pending = info?.pending_plan_topup_payment
  const blocked = info?.ladder_blocked
  const notActive = info?.member_status && info.member_status !== 'active'

  const txnFilled = payment.txn_id.trim().length > 0
  const receiptFilled = !!receiptFile
  const remarkFilled = payment.remark.trim().length > 0
  const formComplete = txnFilled && receiptFilled && remarkFilled
  const canSubmit = formComplete && !loading

  const submit = async (e) => {
    e.preventDefault()
    if (!formComplete) {
      setError('Please fill transaction hash, receipt upload, and remark before submitting.')
      return
    }
    if (amountDue == null || !Number.isFinite(Number(amountDue))) {
      setError('Amount did not load from server — refresh and try again')
      return
    }
    const confirmMsg = [
      'Submit plan TOP-UP payment?',
      '',
      `Amount: $${Number(amountDue).toFixed(2)}`,
      `Transaction: ${payment.txn_id.trim()}`,
      remarkFilled ? `Remark: ${payment.remark.trim()}` : '',
      '',
      'Admin will verify before your ladder level increases.',
    ].filter(Boolean).join('\n')
    if (!window.confirm(confirmMsg)) return

    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('payment_type', PAYMENT_TYPE_TRUST)
      fd.append('transaction_id', payment.txn_id.trim())
      fd.append('remark', payment.remark.trim())
      fd.append('amount', String(amountDue))
      if (receiptFile) fd.append('receipt', receiptFile)
      await memberAPI.submitPlanTopupPayment(fd)
      setDone(true)
      loadInfo()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Submit failed')
    }
    setLoading(false)
  }

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Plan TOP-UP payment</div>
        <div className="page-subtitle">
          Submit proof for the next Trade ladder level —{' '}
          Submit proof via <strong>USDT BEP20</strong> (BSC), then <strong>admin approval</strong>. When approved,{' '}
          <strong>plan TOP-UP count increases by 1</strong>.
        </div>
      </div>

      {infoErr && (
        <Alert type="danger" className="mb-4" onClose={() => setInfoErr(null)}>
          {infoErr}
        </Alert>
      )}

      {loadingInfo ? (
        <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</div>
      ) : (
        <>
          {info?.topup_payment_stats ? (
            <div className="mb-8">
              <TopupPaymentStatsSummary stats={info.topup_payment_stats} />
            </div>
          ) : null}
          <div className="mb-8">
            <Card title="Previous plan TOP-UPs — #1, 2, 3… (when & amount)">
              <PlanTopupHistoryList rows={info?.plan_topup_history || []} maxHeight={360} />
            </Card>
          </div>
          {notActive && (
            <Alert type="warning" className="mb-4">
              Account is not active yet — you can submit plan TOP-UP here after admin approval.
            </Alert>
          )}

          {blocked && info?.member_status === 'active' && (
            <Alert type="info" className="mb-4">
              {info?.ladder_message || 'No further plan TOP-UP available (ladder max).'}
              <div style={{ marginTop: 10 }}>
                <Link to="/member/roi" style={{ color: 'var(--cyan)', fontWeight: 500 }}>
                  ← Trade Income
                </Link>
              </div>
            </Alert>
          )}

          {!blocked && pending && (
            <Alert type="warning" className="mb-4">
              Your plan TOP-UP request is <strong>pending</strong> (${Number(pending.amount).toFixed(2)} · ID #
              {pending.id}). Admin will approve or reject soon — do not submit again.
              <div style={{ marginTop: 10 }}>
                <Btn type="button" variant="ghost" size="sm" onClick={() => loadInfo()}>
                  Refresh status
                </Btn>
              </div>
            </Alert>
          )}

          {!blocked && pending == null && !notActive && amountDue != null && (
            <Alert type="success" className="mb-4">
              Fixed amount for this step: <strong>${Number(amountDue).toFixed(2)}</strong> (slot #
              {info?.next_payment?.next_slot_index}). Pay with USDT BEP20 below.
            </Alert>
          )}
        </>
      )}

      {error && (
        <Alert type="danger" onClose={() => setError('')} className="mb-4">
          {error}
        </Alert>
      )}

      {done ? (
        <Alert type="success">
          Request submitted — ladder updates when admin approves (check dashboard / Trade).
          <div style={{ marginTop: 12 }}>
            <Link to="/member/roi" style={{ color: 'var(--cyan)', fontWeight: 500 }}>
              ← Trade Income
            </Link>
            {' · '}
            <Link to="/member/dashboard" style={{ color: 'var(--purple)', fontWeight: 500 }}>
              Dashboard →
            </Link>
          </div>
        </Alert>
      ) : null}

      {!loadingInfo && !done && !blocked && !pending && !notActive && amountDue != null ? (
        <div
          style={{ maxWidth: 560, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}
        >
          <form onSubmit={submit}>
            <TrustWalletPaymentPanel
              settings={adminSettings}
              amountHint={`Send ${fmt.usd2(amountDue)} USDT`}
              amount={amountDue}
            />

            <FormGroup label="Amount (fixed for this TOP-UP step)" required>
              <Input type="text" readOnly value={`$${Number(amountDue).toFixed(2)}`} />
            </FormGroup>
            <FormGroup label="Transaction hash (BSC)" required hint="0x… after USDT BEP20 send">
              <Input value={payment.txn_id} onChange={setP('txn_id')} placeholder="0x…" required />
            </FormGroup>
            <FormGroup label="Upload receipt" required hint="JPG, PNG or PDF">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                required
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
            <FormGroup label="Remark" required hint="Payment note for admin">
              <Textarea rows={2} value={payment.remark} onChange={setP('remark')} placeholder="e.g. USDT BEP20 sent on BSC" required />
            </FormGroup>
            {!formComplete ? (
              <Alert type="info" className="mb-3" style={{ fontSize: 12 }}>
                Fill <strong>transaction hash</strong>, <strong>receipt</strong>, and <strong>remark</strong> to enable Submit.
              </Alert>
            ) : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Btn variant="primary" type="submit" loading={loading} disabled={!canSubmit}>
                Submit plan TOP-UP
              </Btn>
              <Btn variant="ghost" type="button" onClick={() => navigate('/member/roi')}>
                Cancel
              </Btn>
            </div>
          </form>
        </div>
      ) : null}
    </MemberLayout>
  )
}
