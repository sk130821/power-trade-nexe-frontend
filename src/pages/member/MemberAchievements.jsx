import { memberAPI, uploadUrl } from '../../api/index.js'
import { useApi } from '../../hooks/useApi.js'
import { MemberLayout } from '../../components/layout/index.jsx'
import { Alert, Spinner } from '../../components/ui/index.jsx'

function AchievementCard({ item }) {
  const img = item.photo ? uploadUrl(item.photo) : null
  return (
    <article className="member-achievement-card">
      <div className="member-achievement-card-photo">
        {img ? (
          <img src={img} alt={item.display_name} />
        ) : (
          <span style={{ fontSize: 48, opacity: 0.5 }}>★</span>
        )}
      </div>
      <div className="member-achievement-card-body">
        <div className="member-achievement-card-name">{item.display_name}</div>
        <p className="member-achievement-card-text">{item.achievement}</p>
      </div>
    </article>
  )
}

export function MemberAchievements() {
  const { data, loading, error } = useApi(() => memberAPI.getAchievements())
  const list = data?.achievements || []

  if (loading) {
    return (
      <MemberLayout>
        <Spinner />
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Achievements</div>
        <div className="page-subtitle">
          Company achievers and milestones — updated by admin. Newest first.
        </div>
      </div>

      {error ? <Alert type="danger">{error}</Alert> : null}

      {!list.length && !error ? (
        <Alert type="info">No achievements posted yet. Check back later.</Alert>
      ) : null}

      <div className="member-achievement-grid">
        {list.map((item) => (
          <AchievementCard key={item.id} item={item} />
        ))}
      </div>
    </MemberLayout>
  )
}
