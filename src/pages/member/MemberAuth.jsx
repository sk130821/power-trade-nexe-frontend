import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authAPI, memberAPI, PACKAGES } from '../../api/index.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Alert, Btn, FormGroup, Input, Select, Textarea } from '../../components/ui/index.jsx'
import { TrustWalletPaymentPanel } from '../../components/TrustWalletPaymentPanel.jsx'
import { PAYMENT_TYPE_TRUST, isEvmTxHash } from '../../utils/paymentTypes.js'
import { AuthPageLayout } from '../../components/AuthPageLayout.jsx'
import { BrandLogo } from '../../components/BrandLogo.jsx'

function PasswordEyeIcon({ visible }) {
  if (visible) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

// ═════════════════════════════
//  MEMBER LOGIN
// ═════════════════════════════
export function MemberLogin() {
  const [form, setForm] = useState({ email:'', password:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const registerRef = searchParams.get('ref')
  const registerTo = registerRef
    ? `/register?ref=${encodeURIComponent(registerRef)}`
    : '/register'
  const set = k => e => setForm(f => ({ ...f, [k]:e.target.value }))

  const doLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const { data } = await authAPI.memberLogin(form)
      sessionStorage.setItem('ptn-show-login-popups', '1')
      login(data.user, data.token)
      navigate('/member/dashboard')
    } catch(err) { setError(err.response?.data?.error || 'Invalid credentials') }
    setLoading(false)
  }

  return (
    <AuthPageLayout
      isLogin
      heroTitle="Trade. Earn. Grow."
      heroSubtitle="Your all-in-one hub for live trades, trade income, network rewards, and wallet management."
    >
      <div className="auth-page__card-head">
        <div className="auth-page__card-icon" aria-hidden>🔐</div>
        <h2>Welcome To Login</h2>
        <p>Sign in with your registered email and password.</p>
      </div>

      {error && <Alert type="danger" onClose={() => setError('')} className="mb-4">{error}</Alert>}

      <form onSubmit={doLogin} className="auth-page__form">
        <FormGroup label="Email address" required>
          <div className="auth-field">
            <span className="auth-field__icon" aria-hidden>✉</span>
            <Input
              className="auth-field__input"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@email.com"
              required
              autoFocus
              autoComplete="email"
            />
          </div>
        </FormGroup>
        <FormGroup label="Password" required>
          <div className="auth-field">
            <span className="auth-field__icon" aria-hidden>🔑</span>
            <Input
              className="auth-field__input"
              type={showPw ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="auth-field__toggle"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              <PasswordEyeIcon visible={showPw} />
            </button>
          </div>
        </FormGroup>
        <div className="auth-page__forgot">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <button type="submit" className="auth-submit-btn" disabled={loading}>
          <span className="auth-submit-btn__shine" aria-hidden />
          <span className="auth-submit-btn__text">
            {loading ? 'Signing in…' : 'Sign in to dashboard'}
          </span>
          {!loading && <span className="auth-submit-btn__arrow" aria-hidden>→</span>}
        </button>
      </form>

      <div className="auth-page__register">
        <span>Don&apos;t have an account?</span>
        <Link to={registerTo} className="auth-page__register-cta">Join now →</Link>
      </div>
    </AuthPageLayout>
  )
}

// ═════════════════════════════
//  MEMBER REGISTER
// ═════════════════════════════
const STEPS = [
  { key:'details',  label:'Personal Details', icon:'1' },
  { key:'package',  label:'Select Package',   icon:'2' },
  { key:'payment',  label:'Payment',          icon:'3' },
  { key:'done',     label:'Complete',         icon:'✓' },
]

function RegisterPasswordField({ label, value, onChange, required, hint, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <FormGroup label={label} required={required} hint={hint}>
      <div className="auth-field">
        <span className="auth-field__icon" aria-hidden>🔑</span>
        <Input
          className="auth-field__input"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder="••••••••"
          required={required}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="auth-field__toggle"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          <PasswordEyeIcon visible={show} />
        </button>
      </div>
    </FormGroup>
  )
}

function RegisterSteps({ step }) {
  return (
    <div className="auth-register-steps">
      {STEPS.map((s, i) => (
        <div key={s.key} className="auth-register-steps__item">
          <div className={`auth-register-step ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`}>
            <div className="auth-register-step__dot">{i < step ? '✓' : s.icon}</div>
            <span className="auth-register-step__label">{s.label}</span>
          </div>
          {i < STEPS.length - 1 ? (
            <div className={`auth-register-step__connector ${i < step ? 'done' : ''}`} />
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function MemberRegister() {
  const [step, setStep] = useState(0)
  const [memberId, setMemberId] = useState(null)
  const [refCode, setRefCode] = useState('')
  const [adminSettings, setAdminSettings] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()

  const [details, setDetails] = useState({ name:'', email:'', contact:'', aadhaar_no:'', dob:'', password:'', confirmPassword:'' })
  const [sponsorCode, setSponsorCode] = useState('')
  const [sponsorLookup, setSponsorLookup] = useState({ status: 'idle', name: '' })
  const [pkg, setPkg] = useState(null)
  const [aadhaarFile, setAadhaarFile] = useState(null)
  const [payment, setPayment] = useState({ txn_id:'', remark:'' })
  const [receiptFile, setReceiptFile] = useState(null)

  useEffect(() => {
    authAPI.getSettings().then(r => setAdminSettings(r.data || {}))
  }, [])

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) setSponsorCode(ref.trim().toUpperCase())
  }, [searchParams])

  // Resolve sponsor code → name (debounced) so the user can confirm the sponsor.
  useEffect(() => {
    const code = sponsorCode.trim()
    if (!code) {
      setSponsorLookup({ status: 'idle', name: '' })
      return undefined
    }
    setSponsorLookup({ status: 'loading', name: '' })
    let cancelled = false
    const t = setTimeout(() => {
      authAPI
        .lookupSponsor(code)
        .then((r) => {
          if (cancelled) return
          if (r.data?.found) setSponsorLookup({ status: 'found', name: r.data.name })
          else setSponsorLookup({ status: 'notfound', name: '' })
        })
        .catch(() => {
          if (!cancelled) setSponsorLookup({ status: 'idle', name: '' })
        })
    }, 450)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [sponsorCode])

  const refFromLink = searchParams.get('ref')
  const setD = k => e => setDetails(f => ({ ...f, [k]:e.target.value }))
  const setP = k => e => setPayment(f => ({ ...f, [k]:e.target.value }))

  const buildRegistrationFormData = () => {
    const fd = new FormData()
    Object.entries(details).forEach(([k, v]) => {
      if (k === 'confirmPassword') return
      fd.append(k, v)
    })
    fd.append('sponsor_code', sponsorCode)
    fd.append('package_amount', pkg)
    if (aadhaarFile) fd.append('aadhaar_photo', aadhaarFile)
    return fd
  }

  const continueToPayment = async () => {
    if (!pkg) { setError('Please select a package'); return }
    setLoading(true); setError('')
    try {
      const { data } = await memberAPI.sendRegistrationOtp(buildRegistrationFormData())
      setMemberId(data.member_id)
      setRefCode(data.member_code || data.referral_code)
      setStep(2)
    } catch(err) { setError(err.response?.data?.error || 'Could not start registration') }
    setLoading(false)
  }

  const submitPayment = async (e) => {
    e.preventDefault()
    if (!receiptFile && !isEvmTxHash(payment.txn_id)) {
      setError('Payment is required — upload receipt or enter valid BSC transaction hash (0x…)')
      return
    }
    setLoading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('member_id', memberId)
      fd.append('payment_type', PAYMENT_TYPE_TRUST)
      fd.append('transaction_id', payment.txn_id)
      fd.append('remark', payment.remark)
      fd.append('amount', pkg)
      if (receiptFile) fd.append('receipt', receiptFile)
      await memberAPI.submitPayment(fd)
      setStep(3)
    } catch(err) { setError(err.response?.data?.error || 'Payment submission failed') }
    setLoading(false)
  }

  const loginLink = refFromLink ? `/?ref=${encodeURIComponent(refFromLink)}` : '/'

  return (
    <AuthPageLayout
      isRegister
      backTo={loginLink}
      backLabel="← Already registered? Sign in"
    >
      <div className="auth-register-header">
        <BrandLogo
          variant="login"
          subtitle="Register as a member and start trading with your network."
        />
      </div>

      <RegisterSteps step={step} />

      {error && <Alert type="danger" onClose={() => setError('')} className="mb-4">{error}</Alert>}

      {step < 2 && (
        <div className="auth-register-body">
          {step === 0 && (
            <>
              {refFromLink && (
                <Alert type="success" className="mb-4">
                  Sponsor Member ID auto-filled from your referral link.
                  {sponsorLookup.status === 'found' && (
                    <> Sponsor: <strong>{sponsorLookup.name}</strong></>
                  )}
                </Alert>
              )}
              <h3 className="auth-register-section-title">Personal details</h3>
              <p className="auth-register-section-desc">Tell us about yourself — all fields are required.</p>
              <div className="grid-2 auth-register-grid">
                <FormGroup label="Full name" required>
                  <Input className="auth-register-input" value={details.name} onChange={setD('name')} placeholder="Your full name" required />
                </FormGroup>
                <FormGroup label="Date of birth" required>
                  <Input className="auth-register-input" type="date" value={details.dob} onChange={setD('dob')} required />
                </FormGroup>
              </div>
              <FormGroup label="Email address" required>
                <Input className="auth-register-input" type="email" value={details.email} onChange={setD('email')} placeholder="you@email.com" required />
              </FormGroup>
              <FormGroup label="Contact number" required>
                <Input
                  className="auth-register-input"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={details.contact}
                  onChange={(e) => setDetails((f) => ({ ...f, contact: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  placeholder="10-digit mobile"
                  required
                />
              </FormGroup>
              <div className="grid-2 auth-register-grid">
                <FormGroup label="Aadhaar / Passport number" required>
                  <Input className="auth-register-input" value={details.aadhaar_no} onChange={setD('aadhaar_no')} placeholder="Aadhaar or Passport number" maxLength={20} required />
                </FormGroup>
                <FormGroup label="Sponsor Member ID" hint={refFromLink ? 'From referral link' : 'Optional — e.g. PTN0JHG5662'}>
                  <Input className="auth-register-input" value={sponsorCode} onChange={e => setSponsorCode(e.target.value.toUpperCase())} placeholder="PTN0JHG5662" />
                  {sponsorCode.trim() && (
                    <div className={`sponsor-lookup sponsor-lookup--${sponsorLookup.status}`}>
                      {sponsorLookup.status === 'loading' && <span>Checking sponsor…</span>}
                      {sponsorLookup.status === 'found' && (
                        <span>✓ Sponsor: <strong>{sponsorLookup.name}</strong></span>
                      )}
                      {sponsorLookup.status === 'notfound' && (
                        <span>✕ No member found with this Sponsor ID</span>
                      )}
                    </div>
                  )}
                </FormGroup>
              </div>
              <div className="grid-2 auth-register-grid">
                <RegisterPasswordField
                  label="Password"
                  value={details.password}
                  onChange={setD('password')}
                  required
                  hint="Minimum 6 characters"
                  autoComplete="new-password"
                />
                <RegisterPasswordField
                  label="Confirm password"
                  value={details.confirmPassword}
                  onChange={setD('confirmPassword')}
                  required
                  autoComplete="new-password"
                />
              </div>
              <FormGroup label="Aadhaar / Passport photo" required hint="JPG, PNG or PDF — max 5MB">
                <input
                  type="file"
                  className="auth-file-input"
                  accept="image/*,application/pdf"
                  onChange={e => setAadhaarFile(e.target.files[0])}
                  required
                />
              </FormGroup>
              <button
                type="button"
                className="auth-submit-btn"
                onClick={() => {
                  if (!details.name||!details.email||!details.contact||!details.aadhaar_no||!details.dob||!aadhaarFile) {
                    setError('Please fill all required fields'); return
                  }
                  if (details.contact.length !== 10) {
                    setError('Contact number must be exactly 10 digits'); return
                  }
                  if (!details.password || details.password.length < 6) {
                    setError('Password must be at least 6 characters'); return
                  }
                  if (details.password !== details.confirmPassword) {
                    setError('Passwords do not match'); return
                  }
                  setError(''); setStep(1)
                }}
              >
                <span className="auth-submit-btn__shine" aria-hidden />
                <span className="auth-submit-btn__text">Next: Select package</span>
                <span className="auth-submit-btn__arrow" aria-hidden>→</span>
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <h3 className="auth-register-section-title">Select your package</h3>
              <p className="auth-register-section-desc">Choose the investment plan that fits your goals.</p>
              <div className="grid-pkgs auth-register-pkgs mb-5">
                {PACKAGES.map(p => (
                  <div key={p.amount} className={`pkg-card auth-register-pkg ${pkg===p.amount?'selected':''}`} onClick={() => setPkg(p.amount)}>
                    <div className="pkg-amount">${p.amount}</div>
                    <div className="pkg-roi">{p.roi}% daily</div>
                    <div className="pkg-label">{p.label}</div>
                  </div>
                ))}
              </div>
              {!pkg && <Alert type="warning">Please select a package to continue</Alert>}
              <div className="auth-register-actions">
                <Btn variant="ghost" size="lg" onClick={() => setStep(0)}>← Back</Btn>
                <button type="button" className="auth-submit-btn auth-submit-btn--flex" disabled={!pkg || loading} onClick={continueToPayment}>
                  <span className="auth-submit-btn__shine" aria-hidden />
                  <span className="auth-submit-btn__text">{loading ? 'Please wait…' : 'Continue to payment'}</span>
                  {!loading && <span className="auth-submit-btn__arrow" aria-hidden>→</span>}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="auth-register-body">
          <h3 className="auth-register-section-title">Payment details</h3>
          <Alert type="warning" className="mb-4">
            <strong>Payment required.</strong> Registration is not complete until you submit payment proof below. You cannot sign in without it.
          </Alert>
          <Alert type="info" className="mb-4 auth-register-info">
            Package: <strong>${pkg}</strong>
            <span className="auth-register-info-sep">·</span>
            Your Member ID: <strong className="auth-register-code">{refCode}</strong>
          </Alert>
          <form onSubmit={submitPayment}>
            <TrustWalletPaymentPanel
              settings={adminSettings}
              amountHint={`Send $${pkg} USDT`}
              amount={pkg}
            />

            <FormGroup label="Transaction hash (BSC)">
              <Input className="auth-register-input" value={payment.txn_id} onChange={setP('txn_id')} placeholder="0x… after USDT BEP20 send" />
            </FormGroup>
            <FormGroup label="Payment receipt" hint="Required unless you entered a valid BSC tx hash above" required={!isEvmTxHash(payment.txn_id)}>
              <input
                type="file"
                className="auth-file-input"
                accept="image/*,application/pdf"
                onChange={e => setReceiptFile(e.target.files[0])}
                required={!isEvmTxHash(payment.txn_id)}
              />
            </FormGroup>
            <FormGroup label="Remark">
              <Textarea className="auth-register-input" rows={3} value={payment.remark} onChange={setP('remark')} placeholder="Optional note for admin" />
            </FormGroup>
            <button type="submit" className="auth-submit-btn auth-submit-btn--success" disabled={loading}>
              <span className="auth-submit-btn__shine" aria-hidden />
              <span className="auth-submit-btn__text">{loading ? 'Submitting…' : 'Complete registration'}</span>
              {!loading && <span className="auth-submit-btn__arrow" aria-hidden>✓</span>}
            </button>
          </form>
        </div>
      )}

      {step === 3 && (
        <div className="auth-register-done">
          <div className="auth-register-done__icon" aria-hidden>🎉</div>
          <h3 className="auth-register-done__title">Registration submitted!</h3>
          <p className="auth-register-done__text">
            Your registration and payment are submitted. Admin approval usually within 24 hours. You can sign in now (trading unlocks after activation).
          </p>
          <div className="auth-register-refbox">
            <div className="auth-register-refbox__label">Your Member ID</div>
            <div className="auth-register-refbox__code">{refCode}</div>
            <div className="auth-register-refbox__hint">Share this ID — others use it as Sponsor Member ID</div>
          </div>
          <Alert type="info" className="auth-register-done__alert">
            <strong>Login:</strong> use your email and the password you set during registration. A confirmation email was sent after payment.
          </Alert>
          <Link to="/" className="auth-register-done__link">
            <button type="button" className="auth-submit-btn">
              <span className="auth-submit-btn__text">Go to sign in</span>
              <span className="auth-submit-btn__arrow" aria-hidden>→</span>
            </button>
          </Link>
        </div>
      )}
    </AuthPageLayout>
  )
}
