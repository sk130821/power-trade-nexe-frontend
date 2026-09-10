import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { authAPI, memberAPI } from '../api/index.js'
import { Alert, FormGroup, Input, Textarea } from './ui/index.jsx'
import { TrustWalletPaymentPanel } from './TrustWalletPaymentPanel.jsx'
import { PAYMENT_TYPE_TRUST, isEvmTxHash } from '../utils/paymentTypes.js'

function paymentInfoFromUser(user) {
  if (!user || user.role !== 'member' || !user.id) return null
  return {
    member_id: user.id,
    referral_code: user.referral_code || user.member_code || '—',
    package_amount: user.package_amount,
    payment_required: user.registration_payment_pending !== false,
  }
}

/**
 * Blocks the entire member portal until registration package payment is submitted.
 */
export function PendingRegistrationPaymentGate() {
  const { user, updateUser } = useAuth()
  const [info, setInfo] = useState(null)
  const [adminSettings, setAdminSettings] = useState(null)
  const [payment, setPayment] = useState({ txn_id: '', remark: '' })
  const [receiptFile, setReceiptFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [infoLoading, setInfoLoading] = useState(true)

  const userFallback = useMemo(() => paymentInfoFromUser(user), [user])

  const pending =
    user?.role === 'member' &&
    user?.status !== 'active' &&
    user?.member_status !== 'active' &&
    user.registration_payment_pending !== false &&
    (user.registration_payment_pending === true ||
      user.registration_payment_pending == null ||
      info?.payment_required === true) &&
    !done

  useEffect(() => {
    if (!user || user.role !== 'member') {
      setInfoLoading(false)
      return undefined
    }
    if (user.registration_payment_pending === false) {
      setInfoLoading(false)
      return undefined
    }

    if (userFallback) setInfo((prev) => prev ?? userFallback)

    let cancelled = false
    setInfoLoading(true)

    authAPI
      .getSettings()
      .then((settingsRes) => {
        if (!cancelled) setAdminSettings(settingsRes.data)
      })
      .catch(() => {
        /* Trust Wallet panel optional if settings fail */
      })

    const loadPaymentInfo = async () => {
      try {
        const payRes = await memberAPI.getRegistrationPaymentInfo()
        if (cancelled) return
        setInfo(payRes.data)
        if (!payRes.data?.payment_required) {
          updateUser({ registration_payment_pending: false })
        }
      } catch {
        if (cancelled) return
        try {
          const dash = await memberAPI.getDashboard()
          if (cancelled) return
          const m = dash.data?.member
          if (m) {
            const payPending =
              dash.data?.registration_payment_pending ??
              (m.status === 'active' ? false : user?.registration_payment_pending ?? true)
            setInfo({
              member_id: m.id,
              referral_code: m.referral_code || m.member_code,
              package_amount: m.package_amount,
              payment_required: !!payPending,
            })
            updateUser({
              package_amount: m.package_amount,
              referral_code: m.referral_code || m.member_code,
              ...(payPending === false ? { registration_payment_pending: false } : {}),
            })
            return
          }
        } catch {
          /* use login user fallback */
        }
        if (userFallback) {
          setInfo(userFallback)
        }
      } finally {
        if (!cancelled) setInfoLoading(false)
      }
    }

    loadPaymentInfo()

    return () => {
      cancelled = true
    }
    // Depend only on stable identity/flags — NOT the whole `user` object or
    // `updateUser`, otherwise calling updateUser() inside re-triggers this
    // effect endlessly (ERR_INSUFFICIENT_RESOURCES request flood).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, user?.registration_payment_pending])

  if (!pending) return null

  const pkg = info?.package_amount ?? user?.package_amount
  const canSubmit = Boolean(pkg && info?.member_id)
  const setP = (k) => (e) => setPayment((f) => ({ ...f, [k]: e.target.value }))

  const submitPayment = async (e) => {
    e.preventDefault()
    if (!canSubmit) {
      setError('Package amount missing — log out and sign in again, or contact support.')
      return
    }
    if (!receiptFile && !isEvmTxHash(payment.txn_id)) {
      setError('Upload receipt or enter valid BSC transaction hash (0x…)')
      return
    }
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('payment_type', PAYMENT_TYPE_TRUST)
      fd.append('transaction_id', payment.txn_id)
      fd.append('remark', payment.remark)
      fd.append('amount', pkg)
      fd.append('member_id', info.member_id)
      if (receiptFile) fd.append('receipt', receiptFile)

      try {
        await memberAPI.submitRegistrationPayment(fd)
      } catch (err) {
        const status = err.response?.status
        if (status === 404 || status === 405) {
          await memberAPI.submitPayment(fd)
        } else {
          throw err
        }
      }

      setDone(true)
      updateUser({
        registration_payment_pending: false,
        registration_payment_status: 'pending',
        package_amount: pkg,
      })
      sessionStorage.removeItem('ptn-show-login-popups')
      window.location.reload()
    } catch (err) {
      setError(err.response?.data?.error || 'Payment submission failed')
    }
    setLoading(false)
  }

  return (
    <div className="login-popup-overlay pending-reg-payment-overlay" role="dialog" aria-modal="true" aria-label="Registration payment required">
      <div className="login-popup-card pending-reg-payment-card">
        <div className="pending-reg-payment-head">
          <div className="pending-reg-payment-badge">Payment required</div>
          <h2 className="pending-reg-payment-title">Complete your registration</h2>
          <p className="pending-reg-payment-sub">
            Submit package payment proof to finish signup. Until payment is submitted, the member portal stays locked.
          </p>
        </div>

        {infoLoading && !info ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-2)' }}>Loading payment details…</div>
        ) : null}

        {info ? (
          <Alert type="info" className="mb-4">
            Package: <strong>${pkg}</strong>
            <span className="auth-register-info-sep"> · </span>
            Member ID: <strong className="auth-register-code">{info.referral_code}</strong>
          </Alert>
        ) : !infoLoading ? (
          <Alert type="warning" className="mb-4">
            Could not refresh payment details from server — you can still submit if your package amount is shown below.
          </Alert>
        ) : null}

        {error ? <Alert type="danger" className="mb-4">{error}</Alert> : null}

        <form onSubmit={submitPayment}>
          <TrustWalletPaymentPanel settings={adminSettings} amountHint={pkg ? `Send $${pkg} USDT` : 'Send package USDT'} amount={pkg} />

          <FormGroup label="Transaction hash (BSC)">
            <Input value={payment.txn_id} onChange={setP('txn_id')} placeholder="0x… after USDT BEP20 send" />
          </FormGroup>
          <FormGroup label="Payment receipt" hint="Required unless valid BSC tx hash above" required={!isEvmTxHash(payment.txn_id)}>
            <input
              type="file"
              className="auth-file-input"
              accept="image/*,application/pdf"
              onChange={(e) => setReceiptFile(e.target.files[0])}
              required={!isEvmTxHash(payment.txn_id)}
            />
          </FormGroup>
          <FormGroup label="Remark">
            <Textarea rows={2} value={payment.remark} onChange={setP('remark')} placeholder="Optional note for admin" />
          </FormGroup>
          <button type="submit" className="auth-submit-btn auth-submit-btn--success" disabled={loading || !canSubmit}>
            <span className="auth-submit-btn__shine" aria-hidden />
            {loading ? 'Submitting…' : 'Submit payment & unlock portal'}
          </button>
        </form>
      </div>
    </div>
  )
}
