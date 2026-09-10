import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { memberAPI, uploadUrl } from '../api/index.js'

/**
 * After a member logs in (or opens/refreshes the app while logged in):
 * always show the welcome video popup first, then the image popup when the
 * video is closed. Shown once per full page-load so it does NOT re-trigger on
 * every in-app (SPA) navigation between member pages.
 */
let shownThisPageLoad = false

export function MemberLoginPopups() {
  const { user } = useAuth()
  const [videoFile, setVideoFile] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [phase, setPhase] = useState(null)

  useEffect(() => {
    if (!user || user.role !== 'member') {
      shownThisPageLoad = false
      return undefined
    }
    const paymentGated =
      user.registration_payment_pending !== false &&
      user.status !== 'active' &&
      user.member_status !== 'active'
    if (paymentGated) return undefined
    if (shownThisPageLoad) return undefined

    let cancelled = false
    memberAPI
      .getLoginPopups()
      .then((res) => {
        if (cancelled) return
        const v = res.data?.video || null
        const i = res.data?.image || null
        if (!v && !i) return
        shownThisPageLoad = true
        setVideoFile(v)
        setImageFile(i)
        if (v) setPhase('video')
        else setPhase('image')
      })
      .catch(() => {
        /* ignore — no popups to show */
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, user?.role, user?.status, user?.member_status, user?.registration_payment_pending])

  const finish = () => {
    setPhase(null)
  }

  const closeVideo = () => {
    if (imageFile) setPhase('image')
    else finish()
  }

  if (!phase) return null

  return (
    <>
      {phase === 'video' && videoFile ? (
        <div
          className="login-popup-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome video"
          onClick={(e) => e.target === e.currentTarget && closeVideo()}
        >
          <div className="login-popup-card login-popup-card--video">
            <button type="button" className="login-popup-close" onClick={closeVideo} aria-label="Close video">
              ✕
            </button>
            <video
              className="login-popup-video"
              src={uploadUrl(videoFile)}
              controls
              autoPlay
              playsInline
            />
            <div className="login-popup-hint">Close to continue</div>
          </div>
        </div>
      ) : null}

      {phase === 'image' && imageFile ? (
        <div
          className="login-popup-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome image"
          onClick={(e) => e.target === e.currentTarget && finish()}
        >
          <div className="login-popup-card login-popup-card--image">
            <button type="button" className="login-popup-close" onClick={finish} aria-label="Close image">
              ✕
            </button>
            <img className="login-popup-image" src={uploadUrl(imageFile)} alt="Power Trade Nexus" />
          </div>
        </div>
      ) : null}
    </>
  )
}
