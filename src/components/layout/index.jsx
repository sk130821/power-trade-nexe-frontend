import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { MemberLoginPopups } from '../MemberLoginPopups.jsx'
import { MemberActivationBanner } from '../MemberActivationBanner.jsx'
import { PendingRegistrationPaymentGate } from '../PendingRegistrationPaymentGate.jsx'
import { BrandLogo } from '../BrandLogo.jsx'

// ═══════════════════════════════════════
//  ADMIN SIDEBAR
// ═══════════════════════════════════════
const ADMIN_NAV = [
  { to: '/admin/dashboard',    icon: '▦',  label: 'Dashboard'       },
  { to: '/admin/members',      icon: '⊞',  label: 'Members'         },
  { to: '/admin/payments',     icon: '💳', label: 'Payments'        },
  { to: '/admin/roi-trade',    icon: '⬆',  label: 'Trade Income'       },
  { to: '/admin/roi-reports', icon: '📊', label: 'Trade Reports'     },
  { to: '/admin/day-trades',   icon: '◎',  label: 'Live Trades'      },
  { to: '/admin/salary-reward',icon: '★',  label: 'Salary & Reward' },
  { to: '/admin/transactions', icon: '🧾',  label: 'Transaction History' },
  { to: '/admin/notices',     icon: '📣',  label: 'Member notices'    },
  { to: '/admin/withdrawals', icon: '↩',   label: 'Withdrawals'       },
  { to: '/admin/login-popup/video', icon: '🎬', label: 'Login video popup' },
  { to: '/admin/login-popup/image', icon: '🖼', label: 'Login image popup' },
  { to: '/admin/settings',    icon: '⚙',   label: 'Settings'         },
]

function Logo() {
  return (
    <div style={{ padding: '16px 14px 14px', borderBottom: '1px solid var(--border)' }}>
      <BrandLogo variant="sidebar" align="left" />
    </div>
  )
}

function NavItem({ to, icon, label, onNavigate }) {
  return (
    <NavLink to={to} style={{ textDecoration: 'none' }} onClick={() => onNavigate?.()}>
      {({ isActive }) => (
        <div className={`sidebar-nav-item${isActive ? ' active' : ''}`}>
          <span style={{ fontSize: 14, width: 18, textAlign: 'center', opacity: isActive ? 1 : 0.55 }}>{icon}</span>
          {label}
        </div>
      )}
    </NavLink>
  )
}

export function AdminSidebar({ onNavigate }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <aside className="sidebar-panel" style={{ background: 'var(--bg-card)', display: 'flex', flexDirection: 'column' }}>
      <Logo />

      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg,rgba(0,229,255,0.2),rgba(168,85,247,0.2))',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 500, color: 'var(--cyan)'
          }}>
            {user?.username?.[0]?.toUpperCase() || 'A'}
          </div>
          <div>
            <div className="sidebar-user-name">{user?.username || 'Admin'}</div>
            <div className="sidebar-user-role">Administrator</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, paddingTop: 6, overflowY: 'auto' }}>
        <div className="sidebar-nav-label">Navigation</div>
        {ADMIN_NAV.map(item => <NavItem key={item.to} {...item} onNavigate={onNavigate} />)}
      </nav>

      <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          className="sidebar-logout-btn"
          onClick={() => { logout(); navigate('/admin/login') }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-dim)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(255,64,96,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          ⎋ Logout
        </button>
      </div>
    </aside>
  )
}

// ═══════════════════════════════════════
//  MEMBER SIDEBAR
// ═══════════════════════════════════════
const MEMBER_NAV = [
  { to: '/member/dashboard', icon: '▦', label: 'Dashboard' },
  { to: '/member/income', icon: '💰', label: 'Income' },
  { to: '/member/monthly-income', icon: '📅', label: 'Monthly Income' },
  { to: '/member/add-member', icon: '➕', label: 'Add Member' },
  { to: '/member/transactions', icon: '🧾', label: 'Transaction History' },
  { to: '/member/roi',       icon: '📈', label: 'Exchange Trading' },
  { to: '/member/roi-history', icon: '📅', label: 'Exchange Trading History' },
  { to: '/member/trades',    icon: '◎', label: 'Live Trading' },
  { to: '/member/live-trading-history', icon: '📋', label: 'Live Trading History' },
  { to: '/member/add-funds', icon: '💵', label: 'Fund trading wallet' },
  { to: '/member/plan-topup', icon: '⬆', label: 'Plan TOP-UP (Trade)' },
  { to: '/member/level-business', icon: '📊', label: 'Level Business' },
  { to: '/member/network',   icon: '🌳', label: 'Genealogy' },
  { to: '/member/password',  icon: '🔑', label: 'Change password' },
  { to: '/member/withdraw',  icon: '↩',  label: 'Withdraw (USDT BEP20)' },
]

export function MemberSidebar({ onNavigate }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <aside className="sidebar-panel" style={{ background: 'var(--bg-card)', display: 'flex', flexDirection: 'column' }}>
      <Logo />

      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(0,229,255,0.15))',
            border: '1px solid rgba(168,85,247,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 500, color: 'var(--purple)'
          }}>
            {user?.name?.[0]?.toUpperCase() || 'M'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div className="sidebar-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div className="sidebar-user-role">
              {user?.status === 'active' || user?.member_status === 'active'
                ? 'Active Member'
                : user?.status === 'rejected' || user?.member_status === 'rejected'
                  ? 'Rejected'
                  : 'Pending approval'}
            </div>
          </div>
        </div>
        <div style={{
          background: 'var(--bg-card2)', borderRadius: 8, padding: '8px 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span className="sidebar-user-role" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Member ID</span>
          <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--cyan)' }}>
            {user?.referral_code}
          </span>
        </div>
      </div>

      <nav style={{ flex: 1, paddingTop: 6, overflowY: 'auto' }}>
        <div className="sidebar-nav-label">Menu</div>
        {MEMBER_NAV.map(item => <NavItem key={item.to} {...item} onNavigate={onNavigate} />)}
      </nav>

      <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          className="sidebar-logout-btn"
          onClick={() => { logout(); navigate('/') }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-dim)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(255,64,96,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          ⎋ Logout
        </button>
      </div>
    </aside>
  )
}

// ═══════════════════════════════════════
//  PAGE WRAPPER
// ═══════════════════════════════════════
export function AdminLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className={`app-layout${menuOpen ? ' sidebar-open' : ''}`}>
      <button
        type="button"
        className="mobile-nav-btn"
        aria-label="Open navigation"
        onClick={() => setMenuOpen(true)}
      >
        ☰
      </button>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close navigation"
        onClick={() => setMenuOpen(false)}
      />
      <AdminSidebar onNavigate={() => setMenuOpen(false)} />
      <div className="page-body">
        <main className="page-main page-enter">{children}</main>
      </div>
    </div>
  )
}

export function MemberLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, endImpersonation, isImpersonating } = useAuth()
  const navigate = useNavigate()
  const impersonating = isImpersonating() || user?.impersonated
  const paymentGateActive =
    user?.role === 'member' &&
    user?.registration_payment_pending !== false &&
    user?.status !== 'active' &&
    user?.member_status !== 'active'

  const returnToAdmin = () => {
    if (endImpersonation()) navigate('/admin/members')
    else navigate('/admin/login')
  }

  return (
    <div className={`app-layout${menuOpen ? ' sidebar-open' : ''}${paymentGateActive ? ' member-payment-gate-active' : ''}`}>
      {!paymentGateActive ? (
        <>
          <button
            type="button"
            className="mobile-nav-btn"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          />
          <MemberSidebar onNavigate={() => setMenuOpen(false)} />
        </>
      ) : null}
      {!paymentGateActive ? <MemberLoginPopups /> : null}
      <PendingRegistrationPaymentGate />
      <div className="page-body">
        {!paymentGateActive && impersonating ? (
          <div
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(90deg, rgba(168,85,247,0.2), rgba(0,229,255,0.12))',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--text-1)' }}>
              Admin view — logged in as <strong>{user?.name}</strong>
              {user?.member_status && user.member_status !== 'active' ? ` (${user.member_status})` : ''}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={returnToAdmin}
              style={{ whiteSpace: 'nowrap' }}
            >
              ← Back to Admin
            </button>
          </div>
        ) : null}
        {!paymentGateActive ? (
          <main className="page-main page-enter">
            <MemberActivationBanner status={user?.status || user?.member_status} />
            {children}
          </main>
        ) : null}
      </div>
    </div>
  )
}

// ── Auth Guard ──
import { Navigate } from 'react-router-dom'
export function PrivateRoute({ children, role }) {
  const { user } = useAuth()
  if (!user) return <Navigate to={role === 'admin' ? '/admin/login' : '/'} replace />
  if (user.role !== role) return <Navigate to="/" replace />
  return children
}
