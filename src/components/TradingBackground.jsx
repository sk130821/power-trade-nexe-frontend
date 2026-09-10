import { useEffect, useRef } from 'react'

export const TRADE_VIDEO_SRC = '/trade_video.mp4'

export function useAutoplayVideo() {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      video.pause()
      return undefined
    }

    const play = () => {
      video.play().catch(() => {})
    }

    play()
    video.addEventListener('loadeddata', play)
    return () => video.removeEventListener('loadeddata', play)
  }, [])

  return videoRef
}

export function TradeBackgroundVideo({ videoClassName, overlayClassName }) {
  const videoRef = useAutoplayVideo()

  return (
    <>
      <video
        ref={videoRef}
        className={videoClassName}
        src={TRADE_VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      {overlayClassName ? <div className={overlayClassName} /> : null}
    </>
  )
}

export function TradingBackground() {
  return (
    <div className="trading-bg-layer" aria-hidden="true">
      <TradeBackgroundVideo videoClassName="trading-bg-video" overlayClassName="trading-bg-vignette" />
    </div>
  )
}
