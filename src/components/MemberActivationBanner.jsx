/** Shown site-wide when member is not yet Active (pending / rejected). */
export function MemberActivationBanner({ status, compact = false }) {
  if (!status || status === 'active') return null

  const isRejected = status === 'rejected'

  return (
    <div
      className={`member-activation-banner${isRejected ? ' member-activation-banner--rejected' : ''}${compact ? ' member-activation-banner--compact' : ''}`}
      role="alert"
    >
      <div className="member-activation-banner__icon">{isRejected ? '✕' : '⏳'}</div>
      <div className="member-activation-banner__body">
        <div className="member-activation-banner__title">
          {isRejected ? 'Account rejected' : 'Account NOT ACTIVE yet'}
        </div>
        <div className="member-activation-banner__text">
          {isRejected ? (
            <>Your registration was rejected. Contact support if you need help.</>
          ) : (
            <>
              Admin approval is <strong>pending</strong>. You can log in and view your dashboard, but{' '}
              <strong>Exchange Trading</strong>, <strong>Live Trades</strong>, and{' '}
              <strong>sponsoring / Add Member</strong> stay disabled until status becomes{' '}
              <span className="member-activation-banner__active-pill">Active</span>.
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function isMemberActive(status) {
  return status === 'active'
}
