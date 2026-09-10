import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { authAPI, memberAPI, PACKAGES } from '../../api/index.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { MemberLayout } from '../../components/layout/index.jsx'
import { Alert, Btn, FormGroup, Input, Textarea } from '../../components/ui/index.jsx'
import { MemberActivationBanner, isMemberActive } from '../../components/MemberActivationBanner.jsx'
import { TrustWalletPaymentPanel } from '../../components/TrustWalletPaymentPanel.jsx'
import { PAYMENT_TYPE_TRUST, isEvmTxHash } from '../../utils/paymentTypes.js'

const STEPS = [
  { key: 'details', label: 'Member Details', icon: '1' },
  { key: 'package', label: 'Package', icon: '2' },
  { key: 'verify', label: 'Email OTP', icon: '3' },
  { key: 'payment', label: 'Payment', icon: '4' },
  { key: 'done', label: 'Done', icon: '✓' },
]

export function MemberAddMember() {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [memberId, setMemberId] = useState(null)
  const [refCode, setRefCode] = useState('')
  const [adminSettings, setAdminSettings] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [details, setDetails] = useState({ name: '', email: '', contact: '', aadhaar_no: '', dob: '', password: '', confirmPassword: '' })
  const [pkg, setPkg] = useState(null)
  const [aadhaarFile, setAadhaarFile] = useState(null)
  const [payment, setPayment] = useState({ txn_id: '', remark: '' })
  const [receiptFile, setReceiptFile] = useState(null)
  const [regOtp, setRegOtp] = useState('')

  useEffect(() => {
    authAPI.getSettings().then((r) => setAdminSettings(r.data || {}))
  }, [])

  const setD = (k) => (e) => setDetails((f) => ({ ...f, [k]: e.target.value }))
  const setP = (k) => (e) => setPayment((f) => ({ ...f, [k]: e.target.value }))

  const buildFormData = () => {
    const fd = new FormData()
    Object.entries(details).forEach(([k, v]) => {
      if (k === 'confirmPassword') return
      fd.append(k, v)
    })
    fd.append('package_amount', pkg)
    if (aadhaarFile) fd.append('aadhaar_photo', aadhaarFile)
    return fd
  }

  const sendOtp = async () => {
    if (!pkg) { setError('Please select a package'); return }
    setLoading(true)
    setError('')
    try {
      await memberAPI.sendDownlineRegistrationOtp(buildFormData())
      setRegOtp('')
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send OTP')
    }
    setLoading(false)
  }

  const verifyOtp = async (e) => {
    e.preventDefault()
    if (!regOtp || regOtp.length < 6) {
      setError('Enter the 6-digit OTP sent to the member email')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data } = await memberAPI.verifyDownlineRegistrationOtp({
        email: details.email.trim(),
        otp: regOtp.trim(),
      })
      setMemberId(data.member_id)
      setRefCode(data.member_code || data.referral_code)
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.error || 'OTP verification failed')
    }
    setLoading(false)
  }

  const submitPayment = async (e) => {
    e.preventDefault()
    if (!receiptFile && !isEvmTxHash(payment.txn_id)) {
      setError('Payment is required — upload receipt or enter valid BSC transaction hash (0x…)')
      return
    }
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('member_id', memberId)
      fd.append('payment_type', PAYMENT_TYPE_TRUST)
      fd.append('transaction_id', payment.txn_id)
      fd.append('remark', payment.remark)
      fd.append('amount', pkg)
      if (receiptFile) fd.append('receipt', receiptFile)
      await memberAPI.submitPayment(fd)
      setStep(4)
    } catch (err) {
      setError(err.response?.data?.error || 'Payment submission failed')
    }
    setLoading(false)
  }

  const memberActive = isMemberActive(user?.status || user?.member_status)

  if (!memberActive) {
    return (
      <MemberLayout>
        <div className="page-header">
          <div className="page-title">Add New Member</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
            Sponsor new members only after admin sets your account to <strong style={{ color: 'var(--green)' }}>Active</strong>.
          </div>
        </div>
        <MemberActivationBanner status={user?.status || user?.member_status} />
        <div style={{ marginTop: 16 }}>
          <Link to="/member/dashboard"><Btn variant="ghost">← Back to Dashboard</Btn></Link>
        </div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Add New Member</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
          Register a new member under your sponsor ID while logged in
        </div>
      </div>

      <Alert type="info" className="mb-4">
        Sponsor (your ID): <strong style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--cyan)' }}>{user?.referral_code}</strong>
        {' '}— the new member will be added to your direct team automatically.
      </Alert>

      <div style={{ maxWidth: 580, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 500,
                  border: `2px solid ${i < step ? 'var(--green)' : i === step ? 'var(--cyan)' : 'var(--border)'}`,
                  background: i < step ? 'var(--green)' : i === step ? 'var(--cyan-dim)' : 'transparent',
                  color: i < step ? '#050810' : i === step ? 'var(--cyan)' : 'var(--text-3)',
                }}>
                  {i < step ? '✓' : s.icon}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: i === step ? 'var(--cyan)' : i < step ? 'var(--green)' : 'var(--text-3)' }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 1, background: i < step ? 'var(--green)' : 'var(--border)', margin: '0 12px' }} />
              )}
            </div>
          ))}
        </div>

        {error && <Alert type="danger" onClose={() => setError('')}>{error}</Alert>}

        {step < 2 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
            {step === 0 && (
              <>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 20 }}>📝 New Member Details</div>
                <div className="grid-2">
                  <FormGroup label="Full Name" required><Input value={details.name} onChange={setD('name')} placeholder="Ramesh Kumar" required /></FormGroup>
                  <FormGroup label="Date of Birth" required><Input type="date" value={details.dob} onChange={setD('dob')} required /></FormGroup>
                </div>
                <FormGroup label="Email Address" required><Input type="email" value={details.email} onChange={setD('email')} placeholder="ramesh@gmail.com" required /></FormGroup>
                <FormGroup label="Contact Number" required><Input type="tel" value={details.contact} onChange={setD('contact')} placeholder="9876543210" required /></FormGroup>
                <FormGroup label="Aadhaar / Passport Number" required><Input value={details.aadhaar_no} onChange={setD('aadhaar_no')} placeholder="Aadhaar or Passport number" maxLength={20} required /></FormGroup>
                <div className="grid-2">
                  <FormGroup label="Login Password" required hint="Minimum 6 characters"><Input type="password" value={details.password} onChange={setD('password')} placeholder="Member login password" required autoComplete="new-password" /></FormGroup>
                  <FormGroup label="Confirm Password" required><Input type="password" value={details.confirmPassword} onChange={setD('confirmPassword')} placeholder="Repeat password" required autoComplete="new-password" /></FormGroup>
                </div>
                <FormGroup label="Aadhaar / Passport Photo" required hint="JPG, PNG or PDF — max 5MB">
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => setAadhaarFile(e.target.files[0])} required
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-2)', fontSize: 13, cursor: 'pointer' }} />
                </FormGroup>
                <Btn variant="primary" size="lg" full onClick={() => {
                  if (!details.name || !details.email || !details.contact || !details.aadhaar_no || !details.dob || !aadhaarFile) { setError('Please fill all required fields'); return }
                  if (!details.password || details.password.length < 6) { setError('Password must be at least 6 characters'); return }
                  if (details.password !== details.confirmPassword) { setError('Passwords do not match'); return }
                  setError('')
                  setStep(1)
                }}>Next: Select Package →</Btn>
              </>
            )}

            {step === 1 && (
              <>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>💎 Select Package</div>
                <div className="grid-pkgs mb-5">
                  {PACKAGES.map((p) => (
                    <div key={p.amount} className={`pkg-card ${pkg === p.amount ? 'selected' : ''}`} onClick={() => setPkg(p.amount)}>
                      <div className="pkg-amount">${p.amount}</div>
                      <div className="pkg-roi">{p.roi}% daily</div>
                      <div className="pkg-label">{p.label}</div>
                    </div>
                  ))}
                </div>
                {!pkg && <Alert type="warning">Please select a package to continue</Alert>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="ghost" onClick={() => setStep(0)}>← Back</Btn>
                  <Btn variant="primary" size="lg" style={{ flex: 1 }} onClick={sendOtp} loading={loading} disabled={!pkg}>
                    Send OTP to member email →
                  </Btn>
                </div>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>✉ Verify member email</div>
            <Alert type="info" className="mb-4">
              OTP sent to <strong>{details.email}</strong>. Member must enter it here (or share with you) to confirm registration.
            </Alert>
            <form onSubmit={verifyOtp}>
              <FormGroup label="6-digit OTP" required>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={regOtp}
                  onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  required
                />
              </FormGroup>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="ghost" type="button" onClick={() => setStep(1)}>← Back</Btn>
                <Btn variant="ghost" type="button" loading={loading} onClick={sendOtp}>Resend OTP</Btn>
                <Btn variant="primary" type="submit" loading={loading} disabled={regOtp.length < 6} style={{ flex: 1 }}>
                  Verify & continue →
                </Btn>
              </div>
            </form>
          </div>
        )}

        {step === 3 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>💳 Payment Details</div>
            <Alert type="warning" className="mb-4">
              <strong>Payment required.</strong> Registration is not complete until payment proof is submitted.
            </Alert>
            <Alert type="info" className="mb-4">
              Package: <strong>${pkg}</strong> | New Member ID: <strong style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--cyan)' }}>{refCode}</strong>
            </Alert>
            <form onSubmit={submitPayment}>
              <TrustWalletPaymentPanel settings={adminSettings} amountHint={`Send $${pkg} USDT`} amount={pkg} />

              <FormGroup label="Transaction hash (BSC)">
                <Input value={payment.txn_id} onChange={setP('txn_id')} placeholder="0x…" />
              </FormGroup>
              <FormGroup label="Upload Payment Receipt" hint="Required unless valid BSC tx hash entered" required={!isEvmTxHash(payment.txn_id)}>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptFile(e.target.files[0])} required={!isEvmTxHash(payment.txn_id)}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-2)', fontSize: 13, cursor: 'pointer' }} />
              </FormGroup>
              <FormGroup label="Remark"><Textarea rows={2} value={payment.remark} onChange={setP('remark')} placeholder="Any additional info..." /></FormGroup>
              <Btn variant="success" size="lg" full type="submit" loading={loading}>✓ Submit Registration</Btn>
            </form>
          </div>
        )}

        {step === 4 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>Member Registered!</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 24 }}>
              Registration submitted under your ID <strong>{user?.referral_code}</strong>.<br />
              The member will become active after admin approval.
            </div>
            <div style={{ background: 'var(--bg-card2)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 14, padding: 20, marginBottom: 16, display: 'inline-block', minWidth: 240 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6 }}>New Member ID</div>
              <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 22, fontWeight: 500, color: 'var(--cyan)' }}>{refCode}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
              <Link to="/member/network"><Btn variant="ghost">⊛ My Team</Btn></Link>
              <Btn variant="primary" onClick={() => { setStep(0); setMemberId(null); setRefCode(''); setDetails({ name: '', email: '', contact: '', aadhaar_no: '', dob: '', password: '', confirmPassword: '' }); setPkg(null); setAadhaarFile(null) }}>+ Add Another</Btn>
            </div>
          </div>
        )}
      </div>
    </MemberLayout>
  )
}
