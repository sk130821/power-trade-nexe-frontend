import { memberAPI, fmt, LEVEL_PERCENTS } from '../../api/index.js'
import { useApi } from '../../hooks/useApi.js'
import { MemberLayout } from '../../components/layout/index.jsx'
import { Alert, Spinner } from '../../components/ui/index.jsx'

export function MemberLevelBusiness() {
  const { data, loading, error } = useApi(() => memberAPI.getLevelBusiness())

  if (loading) return <MemberLayout><Spinner /></MemberLayout>
  if (error) return <MemberLayout><Alert type="danger">{error}</Alert></MemberLayout>
  if (!data?.levels) return <MemberLayout><Alert type="danger">Level business data not available</Alert></MemberLayout>

  const maxBusiness = Math.max(...data.levels.map((l) => l.business_volume), 1)

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Level Business</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
          Member count and active plan business volume at each network level (L1 = your direct team)
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Total downline</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--cyan)' }}>
            {data.total_members?.toLocaleString() ?? 0}
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Total active business</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--gold)' }}>
            {fmt.usd2(data.total_business)}
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Levels tracked</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--purple)' }}>
            L1 – L{data.max_levels ?? LEVEL_PERCENTS.length}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(60px, 0.6fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(100px, 1fr) minmax(120px, 1.2fr)',
          gap: 8,
          padding: '12px 16px',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-card2)',
        }}>
          <span>Level</span>
          <span>Members</span>
          <span>Active</span>
          <span>Level %</span>
          <span>Business volume</span>
        </div>

        {data.levels.map((row) => {
          const pct = maxBusiness > 0 ? Math.round((row.business_volume / maxBusiness) * 100) : 0
          return (
            <div
              key={row.level}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(60px, 0.6fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(100px, 1fr) minmax(120px, 1.2fr)',
                gap: 8,
                padding: '14px 16px',
                alignItems: 'center',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
              }}
            >
              <span className="mono" style={{ fontWeight: 600, color: row.level === 1 ? 'var(--green)' : 'var(--purple)' }}>
                L{row.level}
              </span>
              <span className="mono">{row.member_count.toLocaleString()}</span>
              <span className="mono" style={{ color: 'var(--cyan)' }}>{row.active_count.toLocaleString()}</span>
              <span className="mono" style={{ color: 'var(--text-2)' }}>{row.level_percent ?? LEVEL_PERCENTS[row.level - 1]}%</span>
              <div>
                <div className="mono" style={{ fontWeight: 600, color: 'var(--gold)', marginBottom: 4 }}>
                  {fmt.usd2(row.business_volume)}
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-card2)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    borderRadius: 2,
                    background: row.level === 1
                      ? 'linear-gradient(90deg, var(--green), var(--cyan))'
                      : 'linear-gradient(90deg, var(--purple), var(--cyan))',
                  }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
        Business volume is the sum of active members&apos; plan amounts at that level.
        L1 is your direct referrals; L2 is their directs, and so on through L11.
      </div>
    </MemberLayout>
  )
}
