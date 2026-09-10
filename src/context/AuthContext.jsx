import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { memberAPI } from '../api/index.js'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = localStorage.getItem('user')
    const t = localStorage.getItem('token')
    if (u && t) setUser(JSON.parse(u))
    setLoading(false)
  }, [])

  const regPaySyncRef = useRef(false)
  useEffect(() => {
    if (!user || user.role !== 'member' || user.registration_payment_pending === false) return
    if (regPaySyncRef.current) return
    regPaySyncRef.current = true

    const applyPatch = (patch) => {
      setUser((prev) => {
        if (!prev) return prev
        const next = { ...prev, ...patch }
        localStorage.setItem('user', JSON.stringify(next))
        return next
      })
    }

    memberAPI
      .getRegistrationPaymentInfo()
      .then((res) => {
        applyPatch({
          registration_payment_pending: !!res.data?.payment_required,
          package_amount: res.data?.package_amount ?? user.package_amount,
          referral_code: res.data?.referral_code ?? user.referral_code,
        })
      })
      .catch(async () => {
        try {
          const dash = await memberAPI.getDashboard()
          const m = dash.data?.member
          if (m) {
            const payPending =
              dash.data?.registration_payment_pending ??
              (m.status === 'active' ? false : user?.registration_payment_pending ?? true)
            applyPatch({
              registration_payment_pending: !!payPending,
              package_amount: m.package_amount,
              referral_code: m.referral_code || m.member_code,
            })
            return
          }
        } catch {
          /* keep login payload */
        }
      })
  }, [user?.id, user?.role, user?.registration_payment_pending])

  const login = (userData, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const updateUser = (patch) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      localStorage.setItem('user', JSON.stringify(next))
      return next
    })
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('ptn-show-login-popups')
    sessionStorage.removeItem('admin_impersonation_backup')
    setUser(null)
  }

  const impersonateMember = (memberUser, memberToken) => {
    const adminToken = localStorage.getItem('token')
    const adminUserRaw = localStorage.getItem('user')
    if (adminToken && adminUserRaw) {
      try {
        const adminUser = JSON.parse(adminUserRaw)
        if (adminUser?.role === 'admin') {
          sessionStorage.setItem(
            'admin_impersonation_backup',
            JSON.stringify({ token: adminToken, user: adminUser }),
          )
        }
      } catch (_) { /* ignore */ }
    }
    login(memberUser, memberToken)
  }

  const endImpersonation = () => {
    const raw = sessionStorage.getItem('admin_impersonation_backup')
    if (!raw) return false
    try {
      const { token, user: adminUser } = JSON.parse(raw)
      sessionStorage.removeItem('admin_impersonation_backup')
      login(adminUser, token)
      return true
    } catch (_) {
      sessionStorage.removeItem('admin_impersonation_backup')
      return false
    }
  }

  const isImpersonating = () => !!sessionStorage.getItem('admin_impersonation_backup')

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#050810' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <AuthCtx.Provider value={{ user, login, logout, updateUser, impersonateMember, endImpersonation, isImpersonating }}>
      {children}
    </AuthCtx.Provider>
  )
}
