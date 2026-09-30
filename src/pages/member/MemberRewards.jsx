import { useState } from 'react'
import { memberAPI, fmt, uploadUrl } from '../../api/index.js'
import { useApi, useMutation } from '../../hooks/useApi.js'
import { MemberLayout } from '../../components/layout/index.jsx'
import { Alert, Spinner, Btn } from '../../components/ui/index.jsx'
import { isMemberActive } from '../../components/MemberActivationBanner.jsx'

const STATUS_META = {
  locked_previous: { label: 'Previous reward first', color: 'var(--text-2)', bg: 'var(--bg-card2)', border: 'var(--border)', icon: '🔒' },
  in_progress:     { label: 'In progress',           color: 'var(--cyan)',   bg: 'var(--cyan-dim)',   border: 'rgba(0,229,255,0.3)',  icon: '◎' },
  unlocked:        { label: 'Unlocked — choose now', color: 'var(--green)',  bg: 'var(--green-dim)',  border: 'rgba(34,197,94,0.35)', icon: '✓' },
  pending:         { label: 'Request with admin',    color: 'var(--gold)',   bg: 'rgba(255,204,0,0.12)', border: 'rgba(255,204,0,0.35)', icon: '⏳' },
  approved:        { label: 'Approved',              color: 'var(--purple)', bg: 'var(--purple-dim)', border: 'rgba(168,85,247,0.35)', icon: '★' },
  rejected:        { label: 'Rejected — request again', color: 'var(--red)', bg: 'var(--red-dim)',    border: 'rgba(255,64,96,0.3)', icon: '✕' },
  skipped:         { label: 'Skipped — next reward', color: 'var(--text-2)', bg: 'var(--bg-card2)', border: 'var(--border)', icon: '→' },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.in_progress
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
      color: m.color, background: m.bg, border: `1px solid ${m.border}`,
    }}>
      {m.icon} {m.label}
    </span>
  )
}

function Bar({ pct, color }) {
  return (
    <div className="reward-plan-bar">
      <div style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function RewardCard({ tier, program, onClaim, onSkip, claimingId, skippingId, memberActive }) {
  const img = tier.gift_image ? uploadUrl(tier.gift_image) : null
  const busy = claimingId === tier.id
  const skipBusy = skippingId === tier.id
  const showCash = program === 'daily_growth' && tier.allows_cash && Number(tier.cash_amount) > 0

  return (
    <div className={`reward-plan-card ${tier.status}`}>
      <div className="reward-plan-card-img">
        {img ? (
          <img src={img} alt={tier.gift_name} />
        ) : (
          <span style={{ fontSize: 42, opacity: 0.7 }}>{program === 'lifetime' ? '👑' : '🎁'}</span>
        )}
      </div>
      <div className="reward-plan-card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{tier.gift_name}</div>
            {tier.rank_name && (
              <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 2 }}>Rank: {tier.rank_name}</div>
            )}
          </div>
          <StatusBadge status={tier.status} />
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.6 }}>
          <div>Directs: <strong style={{ color: 'var(--text-1)' }}>{tier.directs_done} / {tier.min_directs}</strong>
            {tier.directs_left > 0 ? ` · ${tier.directs_left} left` : ' · done'}
          </div>
          <Bar pct={tier.directs_pct} color="var(--cyan)" />
          <div style={{ marginTop: 8 }}>
            Team business: <strong style={{ color: 'var(--text-1)' }}>{fmt.usd2(tier.business_done)} / {fmt.usd2(tier.team_business)}</strong>
            {tier.cumulative_business && (
              <span style={{ color: 'var(--text-3)' }}> (after previous gifts)</span>
            )}
            {tier.business_left > 0 ? ` · ${fmt.usd2(tier.business_left)} left` : ' · done'}
          </div>
          <Bar pct={tier.business_pct} color="var(--gold)" />
        </div>

        {showCash && (
          <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 10 }}>
            Cash option: <strong>{fmt.usd2(tier.cash_amount)}</strong>
          </div>
        )}

        {tier.claim?.status === 'pending' && (
          <Alert type="info">Waiting for admin — you chose {tier.claim.choice === 'cash' ? `cash ${fmt.usd2(tier.claim.cash_amount)}` : tier.claim.gift_name}.</Alert>
        )}
        {tier.claim?.status === 'approved' && (
          <div style={{ fontSize: 12, color: 'var(--purple)' }}>
            Approved: {tier.claim.choice === 'cash' ? `cash ${fmt.usd2(tier.claim.cash_amount)}` : `${tier.claim.gift_name}${tier.claim.rank_name ? ` · ${tier.claim.rank_name}` : ''}`}
          </div>
        )}
        {tier.claim?.status === 'rejected' && (
          <Alert type="danger">Rejected{tier.claim.admin_note ? `: ${tier.claim.admin_note}` : ''}. You can request again.</Alert>
        )}

        {tier.status === 'skipped' && (
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>You chose the next reward — this gift was skipped.</div>
        )}

        {(tier.can_claim || tier.can_skip) && memberActive && (
          <>
            <div
              className="reward-plan-actions"
              style={{
                display: 'flex',
                flexWrap: 'nowrap',
                gap: 8,
                marginTop: 10,
                alignItems: 'center',
              }}
            >
              {tier.can_claim && showCash && (
                <Btn size="sm" variant="gold" loading={busy} onClick={() => onClaim(tier, 'cash')}>
                  {fmt.usd2(tier.cash_amount)}
                </Btn>
              )}
              {tier.can_claim && (
                <Btn size="sm" variant="purple" loading={busy} onClick={() => onClaim(tier, 'gift')}>
                  {tier.gift_name}
                </Btn>
              )}
              {tier.can_skip && (
                <Btn
                  size="sm"
                  variant="primary"
                  className="reward-plan-skip-btn"
                  loading={skipBusy}
                  onClick={() => onSkip(tier)}
                >
                  Next — skip this gift
                </Btn>
              )}
            </div>
            {tier.can_skip && (
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.5 }}>
                Skip keeps this tier’s own team target for the next gift (e.g. Tablet $10,000). If you take the gift first, the next tier adds targets (e.g. $5,000 + $10,000).
              </div>
            )}
          </>
        )}
        {tier.can_claim && !memberActive && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>Activate your ID to send a request.</div>
        )}
        {tier.can_skip && !memberActive && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>Activate your ID to skip to the next reward.</div>
        )}
      </div>
    </div>
  )
}

export function MemberRewards() {
  const [tab, setTab] = useState('daily_growth')
  const [toast, setToast] = useState(null)
  const [claimingId, setClaimingId] = useState(null)
  const [skippingId, setSkippingId] = useState(null)
  const { data, loading, error, refetch } = useApi(() => memberAPI.getRewards())
  const { mutate: claim } = useMutation(memberAPI.claimReward)
  const { mutate: skip } = useMutation(memberAPI.skipReward)

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const onClaim = async (tier, choice) => {
    const label = choice === 'cash' ? `${fmt.usd2(tier.cash_amount)} cash` : tier.gift_name
    if (!window.confirm(`Send request for ${label}? Admin will review it.`)) return
    setClaimingId(tier.id)
    try {
      const res = await claim({ tier_id: tier.id, choice })
      notify(res.message || 'Request sent')
      refetch()
    } catch (e) {
      notify(e.message, 'danger')
    } finally {
      setClaimingId(null)
    }
  }

  const onSkip = async (tier) => {
    if (!window.confirm(`Skip ${tier.gift_name} and move to the next reward? Team target for the next gift stays at that tier’s own amount (not added to skipped gifts).`)) return
    setSkippingId(tier.id)
    try {
      const res = await skip({ tier_id: tier.id })
      notify(res.message || 'Skipped')
      refetch()
    } catch (e) {
      notify(e.message, 'danger')
    } finally {
      setSkippingId(null)
    }
  }

  if (loading) return <MemberLayout><Spinner /></MemberLayout>
  if (error || !data) return <MemberLayout><Alert type="danger">{error || 'Rewards not available'}</Alert></MemberLayout>

  const memberActive = isMemberActive(data.member_status)
  const tiers = tab === 'lifetime' ? data.lifetime : data.daily_growth

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Rewards</div>
        <div className="page-subtitle">
          Qualify with active directs <strong>and</strong> team business. Use <strong>Next — skip</strong> to jump ahead (next tier uses its own target, e.g. Tablet $10,000). If you take each gift in order, targets add up (e.g. Tablet $15,000 after Smart Phone).
        </div>
      </div>
      {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18,
        padding: 14, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)',
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>Active directs</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{data.stats.active_directs}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>Team business</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>{fmt.usd2(data.stats.team_business)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>Life Time rank</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--purple)' }}>{data.lifetime_rank || '—'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <Btn variant={tab === 'daily_growth' ? 'primary' : 'ghost'} onClick={() => setTab('daily_growth')}>⚡ Daily Growth Reward</Btn>
        <Btn variant={tab === 'lifetime' ? 'primary' : 'ghost'} onClick={() => setTab('lifetime')}>👑 Life Time Reward</Btn>
      </div>

      <div className="reward-plan-grid">
        {tiers.map((tier) => (
          <RewardCard
            key={tier.id}
            tier={tier}
            program={tab}
            onClaim={onClaim}
            onSkip={onSkip}
            claimingId={claimingId}
            skippingId={skippingId}
            memberActive={memberActive}
          />
        ))}
      </div>
      {!tiers.length && <Alert type="info">No reward tiers configured yet.</Alert>}
    </MemberLayout>
  )
}
