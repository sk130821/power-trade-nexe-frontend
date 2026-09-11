import { useState } from 'react'
import { rewardPlanAPI, fmt, uploadUrl } from '../../api/index.js'
import { useApi, useMutation } from '../../hooks/useApi.js'
import { AdminLayout } from '../../components/layout/index.jsx'
import { Card, Btn, Alert, Table, Badge, FormGroup, Input, Spinner } from '../../components/ui/index.jsx'

function programLabel(p) {
  return p === 'lifetime' ? 'Life Time' : 'Daily Growth'
}

function TierEditor({ tier, onSaved }) {
  const [form, setForm] = useState({
    title: tier.title,
    gift_name: tier.gift_name,
    rank_name: tier.rank_name || '',
    min_directs: tier.min_directs,
    team_business: tier.team_business,
    cash_amount: tier.cash_amount,
    allows_cash: Number(tier.allows_cash) === 1,
    is_active: Number(tier.is_active) === 1,
  })
  const [file, setFile] = useState(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [toast, setToast] = useState(null)
  const { mutate: save, loading } = useMutation((fd) => rewardPlanAPI.updateTier(tier.id, fd))

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }

  const submit = async (e) => {
    e.preventDefault()
    const fd = new FormData()
    fd.append('title', form.title)
    fd.append('gift_name', form.gift_name)
    fd.append('rank_name', form.rank_name)
    fd.append('min_directs', form.min_directs)
    fd.append('team_business', form.team_business)
    fd.append('cash_amount', form.cash_amount)
    fd.append('allows_cash', form.allows_cash ? '1' : '0')
    fd.append('is_active', form.is_active ? '1' : '0')
    if (file) fd.append('gift_image', file)
    if (removeImage) fd.append('remove_image', '1')
    try {
      await save(fd)
      notify('Saved')
      setFile(null)
      setRemoveImage(false)
      onSaved()
    } catch (err) {
      notify(err.message, 'danger')
    }
  }

  const img = !removeImage && tier.gift_image ? uploadUrl(tier.gift_image) : null

  return (
    <Card title={`${tier.title} · ${tier.gift_name}`}>
      {toast && <Alert type={toast.type} className="mb-4" onClose={() => setToast(null)}>{toast.msg}</Alert>}
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          <FormGroup label="Title" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </FormGroup>
          <FormGroup label="Gift name" required>
            <Input value={form.gift_name} onChange={(e) => setForm((f) => ({ ...f, gift_name: e.target.value }))} required />
          </FormGroup>
          {tier.program === 'lifetime' && (
            <FormGroup label="Rank">
              <Input value={form.rank_name} onChange={(e) => setForm((f) => ({ ...f, rank_name: e.target.value }))} />
            </FormGroup>
          )}
          <FormGroup label="Directs target" required>
            <Input type="number" min="0" value={form.min_directs} onChange={(e) => setForm((f) => ({ ...f, min_directs: e.target.value }))} required />
          </FormGroup>
          <FormGroup label="Team business ($)" required>
            <Input type="number" min="0" step="0.01" value={form.team_business} onChange={(e) => setForm((f) => ({ ...f, team_business: e.target.value }))} required />
          </FormGroup>
          {tier.program === 'daily_growth' && (
            <FormGroup label="Cash amount ($)">
              <Input type="number" min="0" step="0.01" value={form.cash_amount} onChange={(e) => setForm((f) => ({ ...f, cash_amount: e.target.value }))} />
            </FormGroup>
          )}
        </div>
        <FormGroup label="Gift image">
          {img && (
            <div style={{ marginBottom: 8 }}>
              <img src={img} alt="" style={{ maxHeight: 90, borderRadius: 8, border: '1px solid var(--border)' }} />
            </div>
          )}
          <Input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0] || null); setRemoveImage(false) }} />
          {tier.gift_image && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 12 }}>
              <input type="checkbox" checked={removeImage} onChange={(e) => setRemoveImage(e.target.checked)} />
              Remove current image
            </label>
          )}
        </FormGroup>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 12 }}>
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
          Active (shown to members)
        </label>
        <Btn type="submit" loading={loading} variant="primary">Save settings</Btn>
      </form>
    </Card>
  )
}

export default function AdminRewardPlan() {
  const [tab, setTab] = useState('daily_growth')
  const [reqFilter, setReqFilter] = useState('pending')
  const [toast, setToast] = useState(null)

  const { data: tiersData, loading: tiersLoading, refetch: refTiers } = useApi(() => rewardPlanAPI.getTiers())
  const { data: reqData, loading: reqLoading, refetch: refReq } = useApi(
    () => rewardPlanAPI.getRequests(reqFilter ? { status: reqFilter } : {}),
    [reqFilter],
  )
  const { data: achData, loading: achLoading, refetch: refAch } = useApi(() => rewardPlanAPI.getAchievers())
  const { mutate: approve, loading: approving } = useMutation(({ id, note }) => rewardPlanAPI.approveRequest(id, { admin_note: note }))
  const { mutate: reject, loading: rejecting } = useMutation(({ id, note }) => rewardPlanAPI.rejectRequest(id, { admin_note: note }))

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  const tiers = (tiersData?.tiers || []).filter((t) => t.program === tab)

  const doApprove = async (row) => {
    const extra = row.choice === 'cash' ? ` Credit ${fmt.usd2(row.cash_amount)} to Exchange wallet.` : ` Mark gift "${row.gift_name}" delivered.`
    if (!window.confirm(`Approve ${row.member_name} — ${row.tier_title}?${extra}`)) return
    try {
      await approve({ id: row.id, note: '' })
      notify('Approved')
      refReq()
      refAch()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  const doReject = async (row) => {
    const note = window.prompt(`Reject ${row.member_name} — ${row.tier_title}? Optional note:`, '')
    if (note === null) return
    try {
      await reject({ id: row.id, note })
      notify('Rejected')
      refReq()
    } catch (e) {
      notify(e.message, 'danger')
    }
  }

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-title">Reward Plan</div>
        <div className="page-subtitle">Daily Growth (cash or gift) and Life Time (gift + rank). Targets and images are editable.</div>
      </div>
      {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          ['daily_growth', '⚡', 'Daily Growth'],
          ['lifetime', '👑', 'Life Time'],
          ['requests', '⏳', 'Requests'],
          ['achievers', '★', 'Achievers'],
        ].map(([k, i, l]) => (
          <Btn key={k} variant={tab === k ? 'primary' : 'ghost'} onClick={() => setTab(k)}>{i} {l}</Btn>
        ))}
      </div>

      {(tab === 'daily_growth' || tab === 'lifetime') && (
        <>
          {tiersLoading ? <Spinner /> : (
            <div style={{ display: 'grid', gap: 14 }}>
              {tiers.map((tier) => (
                <TierEditor key={`${tier.id}-${tier.updated_at || ''}`} tier={tier} onSaved={refTiers} />
              ))}
              {!tiers.length && <Alert type="info">No tiers found. Restart the API so default rewards can seed.</Alert>}
            </div>
          )}
        </>
      )}

      {tab === 'requests' && (
        <Card title="Reward requests" noPad>
          <div style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['pending', 'approved', 'rejected', ''].map((s) => (
              <Btn key={s || 'all'} size="sm" variant={reqFilter === s ? 'primary' : 'ghost'} onClick={() => setReqFilter(s)}>
                {s || 'All'}
              </Btn>
            ))}
          </div>
          {reqLoading ? <Spinner /> : (
            <Table
              cols={[
                { key: 'member_name', label: 'Member', render: (v, r) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{v}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.referral_code} · {r.member_email}</div>
                  </div>
                ) },
                { key: 'program', label: 'Plan', render: (v) => programLabel(v) },
                { key: 'tier_title', label: 'Reward', render: (v, r) => (
                  <div>
                    <div>{v}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{r.choice === 'cash' ? `Cash ${fmt.usd2(r.cash_amount)}` : r.gift_name}{r.rank_name ? ` · ${r.rank_name}` : ''}</div>
                  </div>
                ) },
                { key: 'directs_at_claim', label: 'At claim', render: (v, r) => (
                  <span className="mono" style={{ fontSize: 11 }}>{v} dir · {fmt.usd2(r.team_business_at_claim)}</span>
                ) },
                { key: 'status', label: 'Status', render: (v) => <Badge type={v === 'approved' ? 'active' : v === 'pending' ? 'open' : 'rejected'}>{v}</Badge> },
                { key: 'created_at', label: 'Requested', render: (v) => <span style={{ fontSize: 12 }}>{fmt.time(v)}</span> },
                { key: 'id', label: '', render: (_, r) => r.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn size="sm" variant="primary" loading={approving} onClick={() => doApprove(r)}>Approve</Btn>
                    <Btn size="sm" variant="ghost" loading={rejecting} onClick={() => doReject(r)}>Reject</Btn>
                  </div>
                ) : <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.reviewed_by_name || '—'}</span> },
              ]}
              rows={reqData?.requests || []}
              emptyText="No requests"
            />
          )}
        </Card>
      )}

      {tab === 'achievers' && (
        <Card title="Achievers report" noPad>
          {achLoading ? <Spinner /> : (
            <Table
              cols={[
                { key: 'member_name', label: 'Member', render: (v, r) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{v}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.referral_code} · #{r.member_id}</div>
                  </div>
                ) },
                { key: 'program', label: 'Plan', render: (v) => programLabel(v) },
                { key: 'tier_title', label: 'Reward', render: (v, r) => (
                  <div>
                    <div>{r.gift_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gold)' }}>{r.rank_name || v}</div>
                  </div>
                ) },
                { key: 'choice', label: 'Choice', render: (v, r) => v === 'cash' ? <span className="mono green">{fmt.usd2(r.cash_amount)}</span> : <Badge type="open">Gift</Badge> },
                { key: 'directs_at_claim', label: 'Directs', render: (v) => v },
                { key: 'team_business_at_claim', label: 'Team biz', render: (v) => <span className="mono">{fmt.usd2(v)}</span> },
                { key: 'reviewed_at', label: 'Approved', render: (v) => <span style={{ fontSize: 12 }}>{fmt.time(v)}</span> },
              ]}
              rows={achData?.achievers || []}
              emptyText="No achievers yet"
            />
          )}
        </Card>
      )}
    </AdminLayout>
  )
}
