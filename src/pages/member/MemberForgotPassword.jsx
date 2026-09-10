import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '../../api/index.js'
import { AuthPageLayout } from '../../components/AuthPageLayout.jsx'
import { Alert, Btn, FormGroup, Input } from '../../components/ui/index.jsx'

export default function MemberForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await authAPI.memberForgotPassword({ email: email.trim() })
      setSent(true)
      if (data?.message) setError('')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Request failed')
    }
    setLoading(false)
  }

  return (
    <AuthPageLayout
      heroTitle="Forgot password?"
      heroSubtitle="Enter your registered email — we'll send a secure reset link if your account is active."
      backTo="/"
    >
      <div className="auth-page__card-head">
        <h2>Reset password</h2>
        <p>Link expires in 1 hour. Check spam if you don't see the email.</p>
      </div>

      {error && (
        <Alert type="danger" onClose={() => setError('')} className="mb-4">
          {error}
        </Alert>
      )}

      {sent ? (
        <Alert type="success">
          If an active account exists for <strong>{email}</strong>, you will receive a reset link shortly.
          <div style={{ marginTop: 14 }}>
            <Link to="/" style={{ color: 'var(--cyan)', fontWeight: 500 }}>
              Return to login →
            </Link>
          </div>
        </Alert>
      ) : (
        <form onSubmit={submit}>
          <FormGroup label="Email address" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              autoFocus
              autoComplete="email"
            />
          </FormGroup>
          <Btn variant="purple" size="lg" full loading={loading} type="submit" className="mt-2">
            Send reset link
          </Btn>
        </form>
      )}
    </AuthPageLayout>
  )
}
