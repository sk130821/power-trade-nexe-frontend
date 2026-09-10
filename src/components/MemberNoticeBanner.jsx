import { useApi } from '../hooks/useApi.js'
import { noticeAPI } from '../api/index.js'

export function MemberNoticeBanner() {
  const { data, error } = useApi(() => noticeAPI.memberList(), [])

  if (error) return null
  const notices = data?.notices || []
  if (!notices.length) return null

  return (
    <div className="member-notice-banner" style={{ marginBottom: 20 }}>
      {notices.map((n) => (
        <div
          key={n.id}
          role="region"
          aria-label="Admin notice"
          style={{
            marginBottom: 12,
            padding: '14px 18px',
            borderRadius: 14,
            border: '1px solid rgba(0, 229, 255, 0.28)',
            background: 'linear-gradient(135deg, rgba(0,229,255,0.09), rgba(168,85,247,0.06))',
            boxShadow: '0 8px 28px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>📣</span>
            <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--cyan)', letterSpacing: '0.02em' }}>{n.title}</span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-2)',
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {n.body}
          </div>
        </div>
      ))}
    </div>
  )
}
