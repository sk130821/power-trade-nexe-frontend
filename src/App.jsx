import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { PrivateRoute } from './components/layout/index.jsx'
import { TradingBackground } from './components/TradingBackground.jsx'

// Admin pages
import AdminLogin from './pages/admin/AdminLogin.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminMembers from './pages/admin/AdminMembers.jsx'
import AdminPayments from './pages/admin/AdminPayments.jsx'
import AdminRoiReports from './pages/admin/AdminRoiReports.jsx'
import { AdminRoiTrade, AdminDayTrades, AdminSalaryReward, AdminTransactions, AdminSettings } from './pages/admin/AdminPages.jsx'

// Member pages
import { MemberRegister } from './pages/member/MemberAuth.jsx'
import { MemberDashboard, MemberDayTrades, MemberNetwork, MemberRoiTrade, MemberTransactionHistory } from './pages/member/MemberPages.jsx'
import { MemberLiveTradingHistory } from './pages/member/MemberLiveTradingHistory.jsx'
import { MemberRoiParticipation } from './pages/member/MemberRoiParticipation.jsx'
import { MemberIncome } from './pages/member/MemberIncome.jsx'
import { MemberMonthlyIncome } from './pages/member/MemberMonthlyIncome.jsx'
import { MemberAddMember } from './pages/member/MemberAddMember.jsx'
import MemberWalletTopup from './pages/member/MemberWalletTopup.jsx'
import MemberPlanTopup from './pages/member/MemberPlanTopup.jsx'
import { MemberChangePassword } from './pages/member/MemberChangePassword.jsx'
import AdminNotices from './pages/admin/AdminNotices.jsx'
import AdminWithdrawals from './pages/admin/AdminWithdrawals.jsx'
import AdminLoginPopupVideo from './pages/admin/AdminLoginPopupVideo.jsx'
import AdminLoginPopupImage from './pages/admin/AdminLoginPopupImage.jsx'
import Home from './pages/Home.jsx'
import MemberForgotPassword from './pages/member/MemberForgotPassword.jsx'
import MemberResetPassword from './pages/member/MemberResetPassword.jsx'
import { MemberLevelBusiness } from './pages/member/MemberLevelBusiness.jsx'
import MemberWithdraw from './pages/member/MemberWithdraw.jsx'

const AUTH_VIDEO_ROUTES = new Set(['/', '/register', '/forgot-password', '/reset-password'])

function AppBackground() {
  const { pathname } = useLocation()
  if (AUTH_VIDEO_ROUTES.has(pathname)) return null
  return <TradingBackground />
}

function AppRoutes() {
  return (
    <Routes>
          {/* Home — member login (admin: /admin/login only, not linked publicly) */}
          <Route path="/" element={<Home />} />
          <Route path="/portal" element={<Navigate to="/" replace />} />

          {/* Public — member auth */}
          <Route path="/member/login" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<MemberRegister />} />
          <Route path="/forgot-password" element={<MemberForgotPassword />} />
          <Route path="/reset-password" element={<MemberResetPassword />} />
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Admin */}
          <Route path="/admin/dashboard"     element={<PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>} />
          <Route path="/admin/members"       element={<PrivateRoute role="admin"><AdminMembers /></PrivateRoute>} />
          <Route path="/admin/payments"      element={<PrivateRoute role="admin"><AdminPayments /></PrivateRoute>} />
          <Route path="/admin/roi-trade"     element={<PrivateRoute role="admin"><AdminRoiTrade /></PrivateRoute>} />
          <Route path="/admin/roi-reports"   element={<PrivateRoute role="admin"><AdminRoiReports /></PrivateRoute>} />
          <Route path="/admin/day-trades"    element={<PrivateRoute role="admin"><AdminDayTrades /></PrivateRoute>} />
          <Route path="/admin/salary-reward" element={<PrivateRoute role="admin"><AdminSalaryReward /></PrivateRoute>} />
          <Route path="/admin/transactions"  element={<PrivateRoute role="admin"><AdminTransactions /></PrivateRoute>} />
          <Route path="/admin/settings"      element={<PrivateRoute role="admin"><AdminSettings /></PrivateRoute>} />
          <Route path="/admin/login-popup/video" element={<PrivateRoute role="admin"><AdminLoginPopupVideo /></PrivateRoute>} />
          <Route path="/admin/login-popup/image" element={<PrivateRoute role="admin"><AdminLoginPopupImage /></PrivateRoute>} />
          <Route path="/admin/notices"      element={<PrivateRoute role="admin"><AdminNotices /></PrivateRoute>} />
          <Route path="/admin/withdrawals"  element={<PrivateRoute role="admin"><AdminWithdrawals /></PrivateRoute>} />

          {/* Member */}
          <Route path="/member/dashboard" element={<PrivateRoute role="member"><MemberDashboard /></PrivateRoute>} />
          <Route path="/member/income" element={<PrivateRoute role="member"><MemberIncome /></PrivateRoute>} />
          <Route path="/member/monthly-income" element={<PrivateRoute role="member"><MemberMonthlyIncome /></PrivateRoute>} />
          <Route path="/member/add-member" element={<PrivateRoute role="member"><MemberAddMember /></PrivateRoute>} />
          <Route path="/member/transactions" element={<PrivateRoute role="member"><MemberTransactionHistory /></PrivateRoute>} />
          <Route path="/member/roi"       element={<PrivateRoute role="member"><MemberRoiTrade /></PrivateRoute>} />
          <Route path="/member/roi-history" element={<PrivateRoute role="member"><MemberRoiParticipation /></PrivateRoute>} />
          <Route path="/member/trades"    element={<PrivateRoute role="member"><MemberDayTrades /></PrivateRoute>} />
          <Route path="/member/live-trading-history" element={<PrivateRoute role="member"><MemberLiveTradingHistory /></PrivateRoute>} />
          <Route path="/member/add-funds" element={<PrivateRoute role="member"><MemberWalletTopup /></PrivateRoute>} />
          <Route path="/member/plan-topup" element={<PrivateRoute role="member"><MemberPlanTopup /></PrivateRoute>} />
          <Route path="/member/network"   element={<PrivateRoute role="member"><MemberNetwork /></PrivateRoute>} />
          <Route path="/member/level-business" element={<PrivateRoute role="member"><MemberLevelBusiness /></PrivateRoute>} />
          <Route path="/member/genealogy" element={<PrivateRoute role="member"><MemberNetwork /></PrivateRoute>} />
          <Route path="/member/password"  element={<PrivateRoute role="member"><MemberChangePassword /></PrivateRoute>} />
          <Route path="/member/withdraw"  element={<PrivateRoute role="member"><MemberWithdraw /></PrivateRoute>} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppBackground />
        <div className="app-content-layer">
          <AppRoutes />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
