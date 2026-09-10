import { useState, useEffect } from 'react'
import { memberAPI, fmt, WALLET_META, WITHDRAWAL_SCHEDULE, WITHDRAWAL_FEE_PERCENT, MIN_WITHDRAWAL_USD } from '../../api/index.js'
import { useApi } from '../../hooks/useApi.js'
import { MemberLayout } from '../../components/layout/index.jsx'
import { Alert, Btn, Card, FormGroup, Input, Textarea, Badge, Table, Spinner } from '../../components/ui/index.jsx'
import { TrustWalletBrandRow } from '../../components/TrustWalletLogo.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

const WALLET_KEYS = ['exchange_wallet', 'trading_wallet', 'salary_wallet']

export default function MemberWithdraw() {
  const { user, login } = useAuth()
  const { data: dash, loading: dashLoading, refetch: refetchDash } = useApi(() => memberAPI.getDashboard())
  const { data: wdata, loading: wLoading, refetch: refetchW } = useApi(() => memberAPI.getWithdrawals())

  const [wallet, setWallet] = useState(user?.wallet_address || '')
  const [savingWallet, setSavingWallet] = useState(false)
  const [form, setForm] = useState({ wallet_type: 'exchange_wallet', amount: '', note: '' })
  const [withdrawOtp, setWithdrawOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (user?.wallet_address) setWallet(user.wallet_address)
  }, [user?.wallet_address])

  const member = dash?.member
  const withdrawals = wdata?.withdrawals || []
  const schedule = wdata?.schedule || {}
  const tradingWalletInfo = wdata?.trading_wallet || dash?.trading_wallet_info || null
  const minWithdraw = wdata?.min_withdrawal_usd ?? MIN_WITHDRAWAL_USD

  const pendingCount = withdrawals.filter((w) => w.status === 'pending').length
  const paidCount = withdrawals.filter((w) => w.status === 'paid').length

  const selectedSchedule = schedule[form.wallet_type]
  const hoursOpen = selectedSchedule?.withdrawal_hours_open !== false
  const canWithdrawToday = selectedSchedule
    ? selectedSchedule.allowed_today !== false && hoursOpen
    : form.wallet_type === 'trading_wallet' && hoursOpen

  const saveWallet = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSavingWallet(true)
    try {
      const { data } = await memberAPI.updateWalletAddress({ wallet_address: wallet.trim() })
      setSuccess(data?.message || 'Wallet address saved')
      const token = localStorage.getItem('token')
      if (token && user) {
        login({ ...user, wallet_address: data.wallet_address }, token)
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSavingWallet(false)
    }
  }

  const sendWithdrawOtp = async () => {
    setError('')
    setSuccess('')
    const amt = Number(form.amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount first')
      return
    }
    if (amt < minWithdraw) {
      setError(`Minimum withdrawal is ${fmt.usd2(minWithdraw)}`)
      return
    }
    setSendingOtp(true)
    try {
      const { data } = await memberAPI.sendWithdrawalOtp({
        wallet_type: form.wallet_type,
        amount: amt,
        note: form.note || null,
      })
      setOtpSent(true)
      setWithdrawOtp('')
      setSuccess(data?.message || 'OTP sent to your registered email')
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSendingOtp(false)
    }
  }

  const submitWithdraw = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const amt = Number(form.amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (amt < minWithdraw) {
      setError(`Minimum withdrawal is ${fmt.usd2(minWithdraw)}`)
      return
    }
    if (!withdrawOtp || withdrawOtp.length < 6) {
      setError('Request OTP and enter the 6-digit code from your email')
      return
    }
    setLoading(true)
    try {
      const { data } = await memberAPI.createWithdrawal({
        wallet_type: form.wallet_type,
        amount: amt,
        note: form.note || null,
        otp: withdrawOtp.trim(),
      })
      setSuccess(data?.message || 'Withdrawal request submitted')
      setForm((f) => ({ ...f, amount: '', note: '' }))
      setWithdrawOtp('')
      setOtpSent(false)
      refetchDash()
      refetchW()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  const bal = member ? Number(member[form.wallet_type] || 0) : 0
  const withdrawableBal =
    form.wallet_type === 'trading_wallet' && tradingWalletInfo
      ? Number(tradingWalletInfo.trading_wallet_withdrawable ?? 0)
      : bal
  const grossAmt = Number(form.amount) || 0
  const hasAmount = form.amount !== '' && Number.isFinite(grossAmt) && grossAmt > 0
  const amountBelowMin = hasAmount && grossAmt < minWithdraw
  const amountValid = hasAmount && grossAmt >= minWithdraw && grossAmt <= withdrawableBal
  const feeAmt = Math.round(grossAmt * WITHDRAWAL_FEE_PERCENT) / 100
  const netAmt = Math.max(0, Math.round((grossAmt - feeAmt) * 10000) / 10000)

  if (dashLoading && !member) {
    return (
      <MemberLayout>
        <Spinner />
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Withdraw to USDT BEP20</div>
        <div className="page-subtitle">
          Save your payout address, submit a request, and track status here. After admin sends crypto and marks{' '}
          <strong>paid</strong>, your in-app wallet balance is deducted.
        </div>
      </div>

      <Alert type="info" className="mb-4">
        <strong>Withdrawal schedule (IST):</strong>{' '}
        All wallets — daily <strong>8:00 AM – 8:00 PM</strong> only · Trading — any day · Salary — <strong>1st</strong> · Exchange — <strong>15th</strong>
        <br />
        <strong>Minimum withdrawal:</strong> {fmt.usd2(minWithdraw)} (all wallets)
      </Alert>

      {error ? (
        <Alert type="danger" className="mb-4" onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert type="success" className="mb-4" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      ) : null}

      {/* Wallet balances */}
      <div className="grid-wallets mb-6">
        {WALLET_KEYS.map((key) => {
          const meta = WALLET_META[key]
          const sch = schedule[key]
          const openToday = sch?.allowed_today !== false
          const hoursOpen = sch?.withdrawal_hours_open !== false
          const fullyOpen = openToday && hoursOpen
          const walletBal = Number(member?.[key] ?? 0)
          const isTrading = key === 'trading_wallet'
          const showWithdrawable = isTrading && tradingWalletInfo
          const avail = showWithdrawable
            ? Number(tradingWalletInfo.trading_wallet_withdrawable ?? 0)
            : walletBal
          return (
            <div key={key} className="wallet-card" style={{ borderTop: `2px solid ${meta.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{meta.icon}</span>
                <span className="wallet-label">{meta.label}</span>
              </div>
              <div className="wallet-balance" style={{ color: meta.color }}>
                {fmt.usd2(walletBal)}
              </div>
              <div className="wallet-sub">
                {showWithdrawable ? (
                  <>
                    Withdrawable winnings: <strong style={{ color: 'var(--green)' }}>{fmt.usd2(avail)}</strong>
                    {Number(tradingWalletInfo.trading_wallet_locked) > 0 ? (
                      <span style={{ display: 'block', marginTop: 4, color: 'var(--text-3)' }}>
                        Locked for trading: {fmt.usd2(tradingWalletInfo.trading_wallet_locked)}
                      </span>
                    ) : null}
                  </>
                ) : (
                  'Available to withdraw'
                )}
              </div>
              <div style={{ fontSize: 10, marginTop: 8, color: fullyOpen ? 'var(--green)' : 'var(--orange)', lineHeight: 1.4 }}>
                {WITHDRAWAL_SCHEDULE[key]?.hint}
                {fullyOpen ? ' · ✓ Open now' : !hoursOpen ? ' · ⏰ Outside 8 AM – 8 PM IST' : sch?.next_date ? ` · Next: ${fmt.date(sch.next_date)}` : ' · Closed today'}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid-2 mb-8" style={{ gap: 20, alignItems: 'start' }}>
        <Card title="Payout address (USDT BEP20 · BSC)">
          <TrustWalletBrandRow
            size={36}
            title="USDT BEP20"
            subtitle="USDT BEP20 on BNB Smart Chain — admin sends approved withdrawals here"
            style={{ marginBottom: 16 }}
          />
          <form onSubmit={saveWallet}>
            <FormGroup label="Your wallet 0x address" required hint="Admin sends approved withdrawals to this address">
              <Input
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="0x..."
                style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}
              />
            </FormGroup>
            <Btn type="submit" variant="primary" loading={savingWallet}>
              Save address
            </Btn>
          </form>
        </Card>

        <Card title="New withdrawal request">
          <form onSubmit={submitWithdraw}>
            <FormGroup label="From wallet" required>
              <select
                className="form-control"
                value={form.wallet_type}
                onChange={(e) => setForm((f) => ({ ...f, wallet_type: e.target.value }))}
              >
                {WALLET_KEYS.map((k) => {
                  const open = schedule[k]?.allowed_today !== false
                  return (
                    <option key={k} value={k}>
                      {WALLET_META[k]?.label || k} — {fmt.usd2(member?.[k] ?? 0)}
                      {open ? ' · open today' : ' · closed today'}
                    </option>
                  )
                })}
              </select>
            </FormGroup>
            {selectedSchedule && !canWithdrawToday ? (
              <Alert type="warning" className="mb-3">
                Withdrawal from {WALLET_META[form.wallet_type]?.label} is not available today.
                {selectedSchedule.next_date ? ` Next date: ${fmt.date(selectedSchedule.next_date)} (IST).` : ''}
              </Alert>
            ) : selectedSchedule?.allowed_today && form.wallet_type !== 'trading_wallet' ? (
              <Alert type="success" className="mb-3">
                Withdrawal window is open today — you can submit a request.
              </Alert>
            ) : null}
            {form.wallet_type === 'trading_wallet' ? (
              <Alert type="info" className="mb-3">
                Live Trade wallet: only <strong>profit from winning (2×) trades</strong> can be withdrawn. Your top-up / invested amount stays in the wallet for re-trading.
              </Alert>
            ) : null}
            <FormGroup
              label="Amount (USD)"
              required
              hint={`Minimum ${fmt.usd2(minWithdraw)} · Available: ${fmt.usd2(withdrawableBal)}`}
            >
              <Input
                type="number"
                min={String(minWithdraw)}
                step="any"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
              {amountBelowMin ? (
                <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8, marginBottom: 0 }}>
                  Minimum withdrawal is {fmt.usd2(minWithdraw)}. Please enter at least {fmt.usd2(minWithdraw)}.
                </p>
              ) : null}
            </FormGroup>
            <FormGroup label="Note (optional)">
              <Textarea rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </FormGroup>
            <div
              style={{
                background: 'var(--bg-2, rgba(255,255,255,0.04))',
                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-3)' }}>Withdrawal amount</span>
                <span className="mono">{fmt.usd2(grossAmt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--orange)' }}>
                <span>Portal fee ({WITHDRAWAL_FEE_PERCENT}%)</span>
                <span className="mono">− {fmt.usd2(feeAmt)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px dashed var(--border, rgba(255,255,255,0.12))',
                  paddingTop: 6,
                  fontWeight: 700,
                }}
              >
                <span>You receive</span>
                <span className="mono" style={{ color: 'var(--green)' }}>{fmt.usd2(netAmt)}</span>
              </div>
            </div>
            <Alert type="info" className="mb-3">
              Email OTP required — click <strong>Send OTP</strong>, then enter the code from your registered email to submit withdrawal.
            </Alert>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
              <Btn
                type="button"
                variant="ghost"
                loading={sendingOtp}
                disabled={!wallet?.trim() || !canWithdrawToday || amountBelowMin || !amountValid}
                onClick={sendWithdrawOtp}
              >
                {otpSent ? 'Resend OTP' : 'Send OTP to email'}
              </Btn>
              <div style={{ flex: '1 1 160px' }}>
                <div className="form-label">Email OTP</div>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={withdrawOtp}
                  onChange={(e) => setWithdrawOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                />
              </div>
            </div>
            <Btn
              type="submit"
              variant="primary"
              loading={loading}
              disabled={!wallet?.trim() || !canWithdrawToday || withdrawOtp.length < 6 || amountBelowMin || !amountValid}
            >
              Submit request
            </Btn>
            {amountBelowMin ? (
              <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 12, marginBottom: 0 }}>
                Minimum withdrawal is {fmt.usd2(minWithdraw)} — button disabled until amount is {fmt.usd2(minWithdraw)} or more.
              </p>
            ) : !wallet?.trim() ? (
              <p style={{ fontSize: 12, color: 'var(--orange)', marginTop: 12, marginBottom: 0 }}>
                Save your USDT BEP20 (BSC) address first before submitting.
              </p>
            ) : !canWithdrawToday ? (
              <p style={{ fontSize: 12, color: 'var(--orange)', marginTop: 12, marginBottom: 0 }}>
                Withdrawal is only between <strong>8:00 AM – 8:00 PM IST</strong> (and on the correct calendar day for Salary / Exchange wallet).
              </p>
            ) : null}
          </form>
        </Card>
      </div>

      <Card
        title="My requests"
        noPad
        className="mb-2"
        action={
          withdrawals.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {pendingCount > 0 ? (
                <span className="badge badge-pending">{pendingCount} pending</span>
              ) : null}
              {paidCount > 0 ? (
                <span className="badge badge-active">{paidCount} paid</span>
              ) : null}
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{withdrawals.length} total</span>
            </div>
          ) : null
        }
      >
        {wLoading ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <Spinner />
          </div>
        ) : (
          <Table
            cols={[
              { key: 'id', label: 'ID' },
              {
                key: 'wallet_type',
                label: 'Wallet',
                render: (v) => WALLET_META[v]?.label || v,
              },
              { key: 'amount', label: 'Amount', render: (v) => <span className="mono">{fmt.usd2(v)}</span> },
              {
                key: 'fee_amount',
                label: `Fee (${WITHDRAWAL_FEE_PERCENT}%)`,
                render: (v, r) => (
                  <span className="mono" style={{ color: 'var(--orange)' }}>
                    {fmt.usd2(v != null ? v : (Number(r.amount) || 0) * (WITHDRAWAL_FEE_PERCENT / 100))}
                  </span>
                ),
              },
              {
                key: 'net_amount',
                label: 'You receive',
                render: (v, r) => (
                  <span className="mono" style={{ color: 'var(--green)' }}>
                    {fmt.usd2(v != null && Number(v) > 0 ? v : (Number(r.amount) || 0) * (1 - WITHDRAWAL_FEE_PERCENT / 100))}
                  </span>
                ),
              },
              {
                key: 'destination_address',
                label: 'Payout address',
                render: (v) => (
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, wordBreak: 'break-all', maxWidth: 160, display: 'inline-block' }}>
                    {v}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (v) => (
                  <Badge type={v === 'paid' ? 'active' : v === 'rejected' ? 'rejected' : 'pending'}>{v}</Badge>
                ),
              },
              {
                key: 'payout_tx_hash',
                label: 'Tx hash',
                render: (v) => (
                  v ? (
                    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, wordBreak: 'break-all' }}>{v}</span>
                  ) : (
                    '—'
                  )
                ),
              },
              { key: 'created_at', label: 'Submitted', render: (v) => fmt.time(v) },
            ]}
            rows={withdrawals}
            emptyText="No withdrawal requests yet"
            emptyIcon="↩"
          />
        )}
      </Card>
    </MemberLayout>
  )
}
