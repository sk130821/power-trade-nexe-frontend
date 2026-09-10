import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authAPI } from '../../api/index.js'
import { AuthPageLayout } from '../../components/AuthPageLayout.jsx'
import { Alert, Btn, FormGroup, Input } from '../../components/ui/index.jsx'

export default function MemberResetPassword() {
  const [searchParams] = useSearchParams()
  const tokenFromUrl = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (!tokenFromUrl) {
      setError('Invalid reset link — request a new one from forgot password')
      return
    }
    setLoading(true)
    setError('')
    try {
      await authAPI.memberResetPassword({ token: tokenFromUrl, new_password: password })
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Reset failed')
    }
    setLoading(false)
  }

  return (
    <AuthPageLayout
      heroTitle="New password"
      heroSubtitle="Choose a strong password you haven't used here before."
      backTo="/forgot-password"
      backLabel="← Request new link"
    >
      <div className="auth-page__card-head">
        <h2>Set new password</h2>
        <p>Minimum 6 characters.</p>
      </div>

      {error && (
        <Alert type="danger" onClose={() => setError('')} className="mb-4">
          {error}
        </Alert>
      )}

      {!tokenFromUrl && !done ? (
        <Alert type="warning">
          Missing reset token. Use the link from your email or{' '}
          <Link to="/forgot-password" style={{ color: 'var(--cyan)' }}>
            request a new one
          </Link>
          .
        </Alert>
      ) : null}

      {done ? (
        <Alert type="success">
          Password updated successfully.
          <div style={{ marginTop: 14 }}>
            <Link to="/">
              <Btn variant="purple" size="lg" full type="button">
                Sign in now
              </Btn>
            </Link>
          </div>
        </Alert>
      ) : tokenFromUrl ? (
        <form onSubmit={submit}>
          <FormGroup label="New password" required>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoFocus
              autoComplete="new-password"
            />
          </FormGroup>
          <FormGroup label="Confirm password" required>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </FormGroup>
          <Btn variant="purple" size="lg" full loading={loading} type="submit" className="mt-2">
            Update password
          </Btn>
        </form>
      ) : null}
    </AuthPageLayout>
  )
}
