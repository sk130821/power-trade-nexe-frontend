import { Link } from 'react-router-dom'
import { BrandLogo } from './BrandLogo.jsx'
import { TradeBackgroundVideo } from './TradingBackground.jsx'

const FEATURES = [
  { icon: '📈', title: 'Trade Income', desc: 'Daily sessions & ladder rewards', color: 'cyan' },
  { icon: '◎', title: 'Live Trades', desc: 'Scripts powered by trading wallet', color: 'orange' },
  { icon: '🔗', title: 'Network Growth', desc: 'Direct, level & salary income', color: 'purple' },
  { icon: '🔒', title: 'Secure Portal', desc: 'Encrypted access & wallet protection', color: 'green' },
]

const STATS = [
  { value: '24/7', label: 'Platform access' },
  { value: '3×', label: 'Wallet types' },
  { value: '100%', label: 'Member secured' },
]

export function AuthPageLayout({
  children,
  heroTitle,
  heroSubtitle,
  backTo,
  backLabel = '← Back to login',
  isLogin = false,
  isRegister = false,
}) {
  return (
    <div className={`auth-page ${isLogin ? 'auth-page--login' : ''} ${isRegister ? 'auth-page--register' : ''}`}>
      <div className="auth-page__bg" aria-hidden>
        <TradeBackgroundVideo videoClassName="auth-page__video" overlayClassName="auth-page__video-overlay" />
        <div className="auth-page__grid-pattern" />
        <div className="auth-page__orb auth-page__orb--1" />
        <div className="auth-page__orb auth-page__orb--2" />
        <div className="auth-page__orb auth-page__orb--3" />
      </div>

      <div className={`auth-page__grid ${isRegister ? 'auth-page__grid--solo' : ''}`}>
        {!isRegister ? (
        <aside className="auth-page__hero">
          <div className="auth-page__hero-inner">
            <div className="auth-page__logo-ring">
              <BrandLogo variant="login" />
            </div>
            <h1 className="auth-page__title">{heroTitle}</h1>
            <p className="auth-page__lead">{heroSubtitle}</p>

            {isLogin ? (
              <div className="auth-page__stats">
                {STATS.map((s) => (
                  <div key={s.label} className="auth-page__stat">
                    <span className="auth-page__stat-value">{s.value}</span>
                    <span className="auth-page__stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <ul className="auth-page__features">
              {FEATURES.map((f) => (
                <li key={f.title} className={`auth-page__feature auth-page__feature--${f.color}`}>
                  <span className="auth-page__feature-icon" aria-hidden>
                    {f.icon}
                  </span>
                  <div>
                    <strong>{f.title}</strong>
                    <span>{f.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        ) : null}

        <main className={`auth-page__main ${isRegister ? 'auth-page__main--wide' : ''}`}>
          <div className={`auth-page__card-wrap ${isRegister ? 'auth-page__card-wrap--wide' : ''}`}>
            <div className="auth-page__card-glow" aria-hidden />
            <div className="auth-page__card fade-in">
              {children}
              {backTo ? (
                <div className="auth-page__back">
                  <Link to={backTo}>{backLabel}</Link>
                </div>
              ) : null}
            </div>
          </div>
          <p className="auth-page__footer-note">
            <span className="auth-page__footer-dot" aria-hidden />
            Power Trade Nexus · Secure member access
          </p>
        </main>
      </div>
    </div>
  )
}
