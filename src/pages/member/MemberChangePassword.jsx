import { useState } from 'react'
import { memberAPI } from '../../api/index.js'
import { MemberLayout } from '../../components/layout/index.jsx'
import { Alert, Btn, Card, FormGroup, Input } from '../../components/ui/index.jsx'

export function MemberChangePassword() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (form.new_password !== form.confirm) {
      setError('New password and confirmation do not match')
      return
    }
    if (form.new_password.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const { data } = await memberAPI.changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      })
      setSuccess(data?.message || 'Password updated.')
      setForm({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Request fail')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Change password</div>
        <div className="page-subtitle">
          Current password, or Aadhaar / Passport number on first login if you have not set a password yet
        </div>
      </div>

      <div style={{ maxWidth: 440 }}>
        <Card title="Member account password">
          {success ? <Alert type="success" className="mb-4">{success}</Alert> : null}
          {error ? <Alert type="danger" className="mb-4" onClose={() => setError('')}>{error}</Alert> : null}
          <Alert type="info" className="mb-4">
            Per login flow: if your password is empty in the database, enter the same Aadhaar / Passport number you used at registration in the <strong>current</strong> field.
          </Alert>
          <form onSubmit={submit}>
            <FormGroup label="Current password / Aadhaar / Passport (first time)" required>
              <Input
                type="password"
                value={form.current_password}
                onChange={set('current_password')}
                autoComplete="current-password"
                required
              />
            </FormGroup>
            <FormGroup label="New password" required hint="Minimum 6 characters">
              <Input
                type="password"
                value={form.new_password}
                onChange={set('new_password')}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </FormGroup>
            <FormGroup label="Confirm new password" required>
              <Input
                type="password"
                value={form.confirm}
                onChange={set('confirm')}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </FormGroup>
            <Btn variant="primary" type="submit" loading={loading} full>
              Update password
            </Btn>
          </form>
        </Card>
      </div>
    </MemberLayout>
  )
}
