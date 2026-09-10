import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../../api/index.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Alert, Btn, FormGroup, Input } from '../../components/ui/index.jsx'
import { BrandLogo } from '../../components/BrandLogo.jsx'

export default function AdminLogin() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await authAPI.adminLogin(form)
      login(data.user, data.token)
      navigate('/admin/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--bg-base)', padding:24, position:'relative',
    }}>
      {/* Background glow orbs */}
      <div style={{ position:'fixed', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, rgba(0,229,255,0.05) 0%, transparent 70%)', top:-200, right:-100, pointerEvents:'none' }} />
      <div style={{ position:'fixed', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)', bottom:-100, left:0, pointerEvents:'none' }} />

      <div className="fade-in" style={{ width:'100%', maxWidth:420 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <BrandLogo
            variant="auth"
            subtitle="Authorized access only"
          />
        </div>

        {/* Card */}
        <div style={{
          background:'var(--bg-card)',
          border:'1px solid rgba(0,229,255,0.2)',
          borderRadius:20, padding:32,
          boxShadow:'0 24px 64px rgba(0,0,0,0.5)',
        }}>
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:18, fontWeight:500 }}>Sign in</div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginTop:4 }}>Use your authorized credentials.</div>
          </div>

          {error && <Alert type="danger" onClose={() => setError('')}>{error}</Alert>}

          <form onSubmit={submit}>
            <FormGroup label="Email Address" required>
              <Input type="email" value={form.email} onChange={set('email')} placeholder="admin@cryptomlm.com" required autoFocus />
            </FormGroup>
            <FormGroup label="Password" required>
              <Input type="password" value={form.password} onChange={set('password')} placeholder="••••••••••" required />
            </FormGroup>
            <Btn variant="primary" size="lg" full loading={loading} type="submit" className="mt-4">
              {!loading && '⬒'} Sign In
            </Btn>
          </form>
        </div>
      </div>
    </div>
  )
}
