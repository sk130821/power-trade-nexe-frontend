import { Link } from 'react-router-dom'
import { memberAPI, INCOME_META, fmt } from '../../api/index.js'
import { useApi } from '../../hooks/useApi.js'
import { MemberLayout } from '../../components/layout/index.jsx'
import { Alert, Spinner, Btn } from '../../components/ui/index.jsx'

export function MemberIncome() {
  const { data, loading } = useApi(() => memberAPI.getDashboard())

  if (loading) return <MemberLayout><Spinner /></MemberLayout>
  if (!data) return <MemberLayout><Alert type="danger">Error loading income</Alert></MemberLayout>

  const { incomeByType } = data
  const getIncTotal = (type) => Number(incomeByType?.find((i) => i.income_type === type)?.total || 0)

  return (
    <MemberLayout>
      <div className="page-header" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="page-title">Income</div>
        <Link to="/member/monthly-income"><Btn variant="ghost" size="sm">📅 Monthly Income Status →</Btn></Link>
      </div>

      <div className="grid-income-eight">
        {Object.entries(INCOME_META).map(([key, meta]) => (
          <div
            key={key}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 14,
              borderLeft: `3px solid ${meta.color}`,
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 8 }}>{meta.icon}</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 18, fontWeight: 500, color: meta.color }}>
              {fmt.usd2(getIncTotal(key))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {meta.label}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>→ {meta.wallet} Wallet</div>
          </div>
        ))}
      </div>
    </MemberLayout>
  )
}
