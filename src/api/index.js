// ═══════════════════════════════════════════
//  api/index.js — Centralized API Client
//  All API calls go through here
// ═══════════════════════════════════════════

import axios from 'axios'

const LIVE_API_ORIGIN = 'https://back.powertradenexus.com'

function trimSlash(value) {
  return String(value || '').replace(/\/$/, '')
}

// Production (`npm run build`): always https://back.powertradenexus.com
// Local (`npm run dev`): VITE_API_BASE from .env.development, else Vite /api proxy
const envBase = trimSlash(import.meta.env.VITE_API_BASE)
const envOrigin = trimSlash(import.meta.env.VITE_API_ORIGIN)
const rawBase = import.meta.env.PROD
  ? (envBase || `${LIVE_API_ORIGIN}/api`)
  : envBase
const apiBase = import.meta.env.PROD
  ? (envOrigin || LIVE_API_ORIGIN)
  : envOrigin

const http = axios.create({
  baseURL: rawBase || '/api',
  timeout: 15000,
  // axios v1: leading-slash URLs stay merged with baseURL (never drop /api)
  allowAbsoluteUrls: false,
})

// ── Request Interceptor: JWT attach ──
http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (err) => Promise.reject(err)
)

// ── Response Interceptor: expired/invalid JWT on protected calls only ──
// (Login endpoints return 401 on wrong password — must NOT redirect or we wipe state / fight the UI.)
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const url = String(err.config?.url || '')
    const isAuthLogin =
      url.includes('/auth/admin/login') ||
      url.includes('/auth/member/login') ||
      url.includes('/auth/member/forgot-password') ||
      url.includes('/auth/member/reset-password')
    if (status === 401 && !isAuthLogin) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      const toAdmin = window.location.pathname.startsWith('/admin')
      window.location.href = toAdmin ? '/admin/login' : '/'
    }
    return Promise.reject(err)
  }
)

// ═══════════════════════════════════════════
//  AUTH APIs
// ═══════════════════════════════════════════
export const authAPI = {
  adminLogin:    (data) => http.post('/auth/admin/login', data),
  memberLogin:   (data) => http.post('/auth/member/login', data),
  memberForgotPassword: (data) => http.post('/auth/member/forgot-password', data),
  memberResetPassword: (data) => http.post('/auth/member/reset-password', data),
  getSettings:   ()     => http.get('/auth/admin-settings'),
  getPackages:   ()     => http.get('/auth/packages'),
  getWeb3Config: ()     => http.get('/auth/web3-config'),
  lookupSponsor: (code) => http.get(`/auth/sponsor/${encodeURIComponent(code)}`),
  updateSettings:(data) => http.put('/admin/settings', data),
  getLoginPopup: () => http.get('/admin/login-popup'),
  updateLoginPopupVideo: (data) => http.put('/admin/login-popup/video', data),
  updateLoginPopupImage: (data) => http.put('/admin/login-popup/image', data),
}

// ═══════════════════════════════════════════
//  MEMBER APIs
// ═══════════════════════════════════════════
export const memberAPI = {
  register:       (formData) => http.post('/member/register', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  sendRegistrationOtp: (formData) => http.post('/member/register/send-otp', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  verifyRegistrationOtp: (data) => http.post('/member/register/verify', data),
  registerDownline: (formData) => http.post('/member/register-downline', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  sendDownlineRegistrationOtp: (formData) => http.post('/member/register-downline/send-otp', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  verifyDownlineRegistrationOtp: (data) => http.post('/member/register-downline/verify', data),
  submitPayment:  (formData) => http.post('/member/payment',  formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  submitRegistrationPayment: (formData) =>
    http.post('/member/registration-payment', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getRegistrationPaymentInfo: () => http.get('/member/registration-payment/info'),
  getDashboard:   ()         => http.get('/member/dashboard'),
  getGenealogy:   (params)   => http.get('/member/genealogy', { params }),
  getLevelBusiness: ()       => http.get('/member/level-business'),
  getTransactions: (params, axiosConfig = {}) => http.get('/member/transactions', { params, ...axiosConfig }),
  getDayTrades:   ()         => http.get('/member/day-trades'),
  getMyDayTradeBuys: (params) => http.get('/member/day-trades/my-buys', { params }),
  buyTrade:       (data)     => http.post('/member/buy-trade', data),
  getRoiToday:    ()         => http.get('/member/roi/today'),
  getRoiStatus:   ()         => http.get('/member/roi/status'),
  getRoiParticipation: (params) => http.get('/member/roi/participation', { params }),
  joinRoiSession: (payload)  => http.post('/member/roi/join', payload ?? {}),
  submitTradingTopup: (formData) =>
    http.post('/member/trading-wallet/topup', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getPlanTopupInfo: () => http.get('/member/plan-topup/info'),
  submitPlanTopupPayment: (formData) =>
    http.post('/member/plan-topup/payment', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  changePassword: (data) => http.post('/member/change-password', data),
  updateWalletAddress: (data) => http.patch('/member/wallet-address', data),
  getWithdrawals: () => http.get('/member/withdrawals'),
  sendWithdrawalOtp: (data) => http.post('/member/withdrawals/send-otp', data),
  createWithdrawal: (data) => http.post('/member/withdrawals', data),
  getLoginPopups: () => http.get('/member/login-popups'),
}

// ═══════════════════════════════════════════
//  NOTICES (admin → members)
// ═══════════════════════════════════════════
export const noticeAPI = {
  memberList: () => http.get('/member/notices'),
  adminList: () => http.get('/admin/notices'),
  adminCreate: (data) => http.post('/admin/notices', data),
  adminUpdate: (id, data) => http.patch(`/admin/notices/${id}`, data),
  adminDelete: (id) => http.delete(`/admin/notices/${id}`),
}

export const withdrawalAPI = {
  adminList: (params) => http.get('/admin/withdrawals', { params }),
  adminReject: (id, data) => http.post(`/admin/withdrawals/${id}/reject`, data ?? {}),
  adminMarkPaid: (id, data) => http.post(`/admin/withdrawals/${id}/mark-paid`, data ?? {}),
}

// ═══════════════════════════════════════════
//  ADMIN — MEMBER MANAGEMENT APIs
// ═══════════════════════════════════════════
export const adminPaymentAPI = {
  list: (params) => http.get('/admin/payments', { params }),
}

export const adminMemberAPI = {
  getAll:        (params, axiosConfig = {}) => http.get('/admin/members', { params, ...axiosConfig }),
  getById:       (id) => http.get(`/admin/members/${id}`),
  update:        (id, data) => http.put(`/admin/members/${id}`, data),
  setPassword:   (id, data) => http.put(`/admin/members/${id}/password`, data),
  impersonate:   (id) => http.post(`/admin/members/${id}/impersonate`),
  updateStatus:  (id, data) => http.put(`/admin/members/${id}/status`, data),
  incrementPlanTopup: (id) => http.post(`/admin/members/${id}/plan-topup`),
  approvePlanTopupPayment: (paymentId) => http.post(`/admin/payments/${paymentId}/approve-plan-topup`),
  rejectPlanTopupPayment: (paymentId) => http.post(`/admin/payments/${paymentId}/reject-plan-topup`),
  approveTradingTopupPayment: (paymentId) => http.post(`/admin/payments/${paymentId}/approve-trading-topup`),
  rejectTradingTopupPayment: (paymentId) => http.post(`/admin/payments/${paymentId}/reject-trading-topup`),
  getStats:      ()         => http.get('/admin/stats'),
  giveSalary:    (data)     => http.post('/admin/salary', data),
  getAllSalaries: ()         => http.get('/admin/salaries'),
  giveReward:    (data)     => http.post('/admin/reward', data),
  getAllRewards:  ()         => http.get('/admin/rewards'),
  fundTrading:   (data)     => http.post('/admin/trading-wallet/fund', data),
}

// ═══════════════════════════════════════════
//  ADMIN — Trade TRADE APIs
// ═══════════════════════════════════════════
export const roiAPI = {
  create:     (data)  => http.post('/admin/roi/create', data),
  updateToday:(data)  => http.put('/admin/roi/today', data),
  updateTodaySlot: (slot, data) => http.put(`/admin/roi/today/slot/${slot}`, data),
  open:       (data)  => http.post('/admin/roi/open', data),
  close:      (id)    => http.post(`/admin/roi/close/${id}`),
  distributeSlot: (tradeId, slot) => http.post(`/admin/roi/${tradeId}/distribute-slot/${slot}`),
  getAll:     ()      => http.get('/admin/roi/trades'),
  getToday:   ()      => http.get('/admin/roi/today'),
  getReport:  (id, config) => http.get(`/admin/roi/${id}/report`, config),
  reportDay:  (params) => http.get('/admin/roi/reports/day', { params }),
  reportMonthly: (params) => http.get('/admin/roi/reports/monthly', { params }),
}

// ═══════════════════════════════════════════
//  ADMIN — DAY TRADE APIs
// ═══════════════════════════════════════════
export const dayTradeAPI = {
  create:         (data)     => http.post('/admin/day-trades', data),
  update:         (id, data)  => http.put(`/admin/day-trades/${id}`, data),
  remove:         (id)       => http.delete(`/admin/day-trades/${id}`),
  activate:       (id)       => http.put(`/admin/day-trades/${id}/activate`),
  deactivate:     (id)       => http.put(`/admin/day-trades/${id}/deactivate`),
  settle:         (data)     => http.post('/admin/day-trades/settle', data),
  getAll:         (params)   => http.get('/admin/day-trades', { params }),
  getInvestors:   (id)       => http.get(`/admin/day-trades/${id}/investors`),
}

// ═══════════════════════════════════════════
//  ADMIN — TRANSACTIONS APIs
// ═══════════════════════════════════════════
export const txnAPI = {
  getAll: (params, axiosConfig = {}) => http.get('/admin/transactions', { params, ...axiosConfig }),
}

// ═══════════════════════════════════════════
//  CONSTANTS (for UI)
// ═══════════════════════════════════════════
export const PACKAGES = [
  { amount: 11,   roi: 0.3, label: 'Starter' },
  { amount: 22,   roi: 0.3, label: 'Basic' },
  { amount: 51,   roi: 0.3, label: 'Bronze' },
  { amount: 101,  roi: 0.4, label: 'Silver' },
  { amount: 201,  roi: 0.4, label: 'Gold' },
  { amount: 501,  roi: 0.4, label: 'Platinum' },
  { amount: 1001, roi: 0.5, label: 'Diamond' },
]

export function getRoiPercent(amount) {
  const a = Number(amount) || 0
  if (a >= 1001) return 0.5
  if (a >= 101) return 0.4
  return 0.3
}

/** Fixed Daily Growth Income when 2 matched directs activate same IST day (8 AM–8 PM). */
export const DAILY_BONUS_BY_PACKAGE = {
  11: 1,
  22: 2,
  51: 5,
  101: 10,
  201: 20,
  501: 50,
  1001: 100,
}

export function getDailyBonusAmount(packageAmount) {
  const bonus = DAILY_BONUS_BY_PACKAGE[Number(packageAmount)]
  return bonus != null ? bonus : null
}

export const INCOME_META = {
  roi_income:     { label: 'Exchange Trading Income',     icon: '📈', color: 'var(--cyan)',   badgeClass: 'badge-roi',     wallet: 'Exchange' },
  direct_income:  { label: 'Direct Income',  icon: '👤', color: 'var(--green)',  badgeClass: 'badge-direct',  wallet: 'Exchange' },
  level_income:   { label: 'Level Income',   icon: '🔗', color: 'var(--purple)', badgeClass: 'badge-level',   wallet: 'Exchange' },
  salary_income:  { label: 'Salary Income',  icon: '💼', color: 'var(--gold)',   badgeClass: 'badge-salary',  wallet: 'Salary'  },
  trading_income: { label: 'Live Trading Income', icon: '🎯', color: 'var(--orange)', badgeClass: 'badge-trading', wallet: 'Trading' },
  reward_income:  { label: 'Reward Income',  icon: '🏆', color: 'var(--red)',    badgeClass: 'badge-reward',  wallet: 'Exchange' },
  direct_monthly_salary: { label: 'Direct Monthly Salary', icon: '👥', color: 'var(--green)',  badgeClass: 'badge-direct-monthly', wallet: 'Salary' },
  daily_bonus_income:    { label: 'Daily Growth Income',    icon: '⚡', color: 'var(--gold)',   badgeClass: 'badge-daily-bonus',    wallet: 'Exchange' },
}

/** Direct monthly salary tiers (upgrade replaces lower; 3 anniversary payouts each). */
export const DIRECT_MONTHLY_TIERS = [
  { tier: 1, minDirects: 5,  windowDays: 7,  percent: 1,  label: '5 Direct · 7 Days → 1%' },
  { tier: 2, minDirects: 10, windowDays: 15, percent: 2,  label: '10 Direct · 15 Days → 2%' },
  { tier: 3, minDirects: 15, windowDays: 30, percent: 3,  label: '15 Direct · 30 Days → 3%' },
  { tier: 4, minDirects: 20, windowDays: 60, percent: 4,  label: '20 Direct · 60 Days → 4%' },
]

export const WALLET_META = {
  exchange_wallet: { label: 'Exchange Wallet', icon: '💱', color: 'var(--cyan)',   desc: 'Trade + Direct + Level + Reward + Daily Growth' },
  trading_wallet:  { label: 'Trading Wallet',  icon: '🎯', color: 'var(--orange)', desc: 'Live Trade winnings only (profit)' },
  salary_wallet:   { label: 'Salary Wallet',   icon: '💼', color: 'var(--gold)',   desc: 'Admin Salary Credits' },
}

/** When members can request withdrawal from each wallet (IST). */
export const WITHDRAWAL_SCHEDULE = {
  trading_wallet:  { hint: 'Any day · 8:00 AM – 8:00 PM IST', allowedDay: null },
  salary_wallet:   { hint: '1st of month · 8:00 AM – 8:00 PM IST', allowedDay: 1 },
  exchange_wallet: { hint: '15th of month · 8:00 AM – 8:00 PM IST', allowedDay: 15 },
}

/** Portal fee deducted from every withdrawal (member receives amount - fee). */
export const WITHDRAWAL_FEE_PERCENT = 12

/** Minimum gross withdrawal amount (USD). */
export const MIN_WITHDRAWAL_USD = 10

export const LEVEL_PERCENTS = [5, 3, 2, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
export const MAX_NETWORK_LEVELS = LEVEL_PERCENTS.length

/** Active directs required to earn level N income (L3 → 3 directs). */
export function levelIncomeDirectsRequired(levelNo) {
  return levelNo
}

// ── Utility Helpers ──
/** Backend upload file URL — use in production when VITE_API_BASE points to the API server. */
export function uploadUrl(filename) {
  if (filename == null || filename === '') return ''
  const name = String(filename).replace(/^\/+/, '')
  
  if (apiBase) {
    const origin = apiBase.replace(/\/api\/?$/i, '')
    return `${origin}/uploads/${name}`
  }
  return `/uploads/${name}`
}

export const fmt = {
  usd:  (v, d=4) => { const n = Number(v||0); return Number(n.toFixed(d)) === 0 ? '$0' : `$${n.toFixed(d)}` },
  usd2: (v)      => { const n = Number(v||0); return Number(n.toFixed(2)) === 0 ? '$0' : `$${n.toFixed(2)}` },
  pct:  (v)      => `${v}%`,
  date: (v)      => v ? new Date(v).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—',
  time: (v)      => v ? new Date(v).toLocaleString('en-IN',  { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—',
}
