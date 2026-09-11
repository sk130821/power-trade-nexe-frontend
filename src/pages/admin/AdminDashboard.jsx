import { useNavigate } from 'react-router-dom'
import { adminMemberAPI, INCOME_META, fmt } from '../../api/index.js'
import { useApi } from '../../hooks/useApi.js'
import { AdminLayout } from '../../components/layout/index.jsx'
import { StatCard, Card, Spinner, SectionTitle } from '../../components/ui/index.jsx'

export default function AdminDashboard() {
  const { data: stats, loading } = useApi(() => adminMemberAPI.getStats())
  const navigate = useNavigate()

  if (loading) return <AdminLayout><Spinner /></AdminLayout>

  const incomeMap = {}
  stats?.incomeBreakdown?.forEach(r => { incomeMap[r.income_type] = r.total })

  const STATS = [
    { icon:'👥', label:'Active Members',    value: stats?.totalMembers || 0,                   color:'cyan'  },
    { icon:'⏳', label:'Pending Approvals', value: stats?.pendingMembers || 0,                  color:'gold'  },
    { icon:'📝', label:'Unpaid Registration', value: stats?.unpaidRegistrations || 0,           color:'orange'},
    { icon:'💰', label:'Total Business',    value: fmt.usd2(stats?.totalBusiness),              color:'green' },
    { icon:'💳', label:'Pending Payments',  value: stats?.pendingPayments || 0,                 color:'purple'},
    { icon:'📈', label:"Today's Trade Out",   value: fmt.usd(stats?.todayRoi, 2),                 color:'cyan'  },
    { icon:'🎯', label:'Active Live Trades', value: stats?.activeTrades || 0,                    color:'purple'},
  ]

  const QUICK = [
    { label:'Review Pending Members', icon:'⏳', to:'/admin/members?status=pending', color:'gold',   desc:`${stats?.pendingMembers} paid — awaiting admin approve` },
    { label:'Unpaid Registrations', icon:'📝', to:'/admin/members?unpaid_registration=1', color:'orange', desc:`${stats?.unpaidRegistrations || 0} OTP done — payment not submitted` },
    { label:'Approve Pending Payments', icon:'💳', to:'/admin/payments?status=pending', color:'purple', desc:`${stats?.pendingPayments} TOP-UP / wallet payments` },
    { label:'Trade Reports (Excel)',  icon:'📊', to:'/admin/roi-reports',           color:'cyan',   desc:'Day-wise members · monthly daily trade income' },
    { label:'Manage Live Trades',      icon:'◎',  to:'/admin/day-trades',             color:'purple', desc:'Open from 9 AM · settle anytime' },
    { label:'Salary & Rewards',       icon:'★',  to:'/admin/salary-reward',          color:'green',  desc:'Assign income' },
    { label:'Reward Plan',            icon:'🏆', to:'/admin/reward-plan',            color:'gold',   desc:'Daily Growth + Life Time settings' },
    { label:'Website Banners',        icon:'🖼', to:'/admin/website-banners',        color:'cyan',   desc:'Hero slider on marketing site' },
    { label:'All Transactions',       icon:'≡',  to:'/admin/transactions',           color:'orange', desc:'Full ledger' },
  ]

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-subtitle">Platform overview — {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</div>
      </div>

      {/* Stats Grid */}
      <SectionTitle>Platform Stats</SectionTitle>
      <div className="grid-stats mb-8">
        {STATS.map(s => {
          const clickable = s.label === 'Pending Approvals' || s.label === 'Pending Payments' || s.label === 'Unpaid Registration'
          const to =
            s.label === 'Pending Approvals'
              ? '/admin/members?status=pending'
              : s.label === 'Pending Payments'
                ? '/admin/payments?status=pending'
                : s.label === 'Unpaid Registration'
                  ? '/admin/members?unpaid_registration=1'
                  : null
          return (
            <div
              key={s.label}
              onClick={clickable ? () => navigate(to) : undefined}
              style={clickable ? { cursor: 'pointer' } : undefined}
              title={clickable ? 'Click to review' : undefined}
            >
              <StatCard icon={s.icon} label={s.label} value={s.value} color={s.color} />
            </div>
          )
        })}
      </div>

      {/* Income Breakdown */}
      <SectionTitle>Income Distributed (All Time)</SectionTitle>
      <div className="grid-income mb-8">
        {Object.entries(INCOME_META).map(([key, meta]) => (
          <div key={key} style={{
            background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12,
            padding:16, borderLeft:`3px solid ${meta.color}`,
          }}>
            <div style={{ fontSize:20, marginBottom:8 }}>{meta.icon}</div>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:18, fontWeight:700, color:meta.color }}>
              {fmt.usd2(incomeMap[key] || 0)}
            </div>
            <div style={{ fontSize:11, color:'var(--text-2)', marginTop:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>
              {meta.label}
            </div>
            <div style={{ fontSize:10, color:'var(--text-3)', marginTop:3 }}>→ {meta.wallet} Wallet</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <SectionTitle>Quick Actions</SectionTitle>
      <div className="grid-2">
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {QUICK.map(q => (
            <button key={q.label} onClick={() => navigate(q.to)} style={{
              background:'var(--bg-card)', border:'1px solid var(--border)',
              borderRadius:12, padding:'14px 16px',
              display:'flex', alignItems:'center', gap:12,
              cursor:'pointer', transition:'all 0.15s', textAlign:'left', width:'100%',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=`rgba(${q.color === 'cyan' ? '0,229,255' : q.color === 'gold' ? '255,204,0' : q.color === 'green' ? '0,255,136' : q.color === 'purple' ? '168,85,247' : '255,140,0'},0.3)` ; e.currentTarget.style.transform='translateX(4px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none' }}
            >
              <div style={{ width:38, height:38, borderRadius:10, background:`var(--${q.color}-dim)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                {q.icon}
              </div>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>{q.label}</div>
                <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{q.desc}</div>
              </div>
              <span style={{ marginLeft:'auto', color:'var(--text-3)', fontSize:18 }}>›</span>
            </button>
          ))}
        </div>

        {/* System info */}
        <Card title="⚙ System Info">
          {[
            ['Trade Income Window', '12:00 PM – 1:00 PM'],
            ['Live Trade Window', '9:00 AM IST until admin settles (no 5 PM auto-close)'],
            ['Level Depth', '11 Levels'],
            ['Direct Sponsor', '5% of package'],
            ['Trade Range', '0.3% – 1.0% daily'],
            ['Income Types', '8 types tracked'],
            ['Wallets', 'Exchange / Trading / Salary'],
          ].map(([k, v]) => (
            <div key={k} className="flex-between" style={{ padding:'10px 0', borderBottom:'1px solid var(--border-sm)' }}>
              <span style={{ fontSize:13, color:'var(--text-2)' }}>{k}</span>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-1)' }}>{v}</span>
            </div>
          ))}
        </Card>
      </div>
    </AdminLayout>
  )
}
