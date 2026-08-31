import { useCallback, useLayoutEffect, useEffect, useState, type RefObject } from 'react'
import './VictoryCinematic.css'

const ANNOUNCE_DELAY_MS = 2200
const COMPLETE_MS = 4800

type Spotlight = {
  x: number
  y: number
  radius: number
}

import type { PlayerId } from '../game/types'

interface VictoryCinematicProps {
  winnerId: PlayerId
  boardRef: RefObject<HTMLDivElement | null>
  arenaWrapRef: RefObject<HTMLDivElement | null>
  onComplete: () => void
}

function measureBoardSpotlight(
  boardEl: HTMLDivElement,
  arenaWrapEl: HTMLDivElement,
): Spotlight | null {
  const arenaEl = arenaWrapEl.querySelector('.play__arena') as HTMLElement | null
  if (!arenaEl) return null

  const focusEl =
    (boardEl.querySelector('.board__grid') as HTMLElement | null) ?? boardEl
  const boardRect = focusEl.getBoundingClientRect()
  const arenaRect = arenaEl.getBoundingClientRect()

  const originX = boardRect.left + boardRect.width / 2 - arenaRect.left
  const originY = boardRect.top + boardRect.height / 2 - arenaRect.top
  arenaEl.style.transformOrigin = `${originX}px ${originY}px`

  return {
    x: boardRect.left + boardRect.width / 2,
    y: boardRect.top + boardRect.height / 2,
    radius: Math.max(boardRect.width, boardRect.height) * 0.58,
  }
}

export function VictoryCinematic({
  winnerId,
  boardRef,
  arenaWrapRef,
  onComplete,
}: VictoryCinematicProps) {
  const [showAnnounce, setShowAnnounce] = useState(false)
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null)

  const updateSpotlight = useCallback(() => {
    const boardEl = boardRef.current
    const arenaWrapEl = arenaWrapRef.current
    if (!boardEl || !arenaWrapEl) return
    const next = measureBoardSpotlight(boardEl, arenaWrapEl)
    if (next) setSpotlight(next)
  }, [boardRef, arenaWrapRef])

  useLayoutEffect(() => {
    updateSpotlight()
    window.addEventListener('resize', updateSpotlight)
    return () => window.removeEventListener('resize', updateSpotlight)
  }, [updateSpotlight, winnerId])

  useEffect(() => {
    const announceTimer = window.setTimeout(() => setShowAnnounce(true), ANNOUNCE_DELAY_MS)
    const completeTimer = window.setTimeout(() => onComplete(), COMPLETE_MS)
    return () => {
      window.clearTimeout(announceTimer)
      window.clearTimeout(completeTimer)
    }
  }, [onComplete])

  const shadeStyle = spotlight
    ? {
        background: `radial-gradient(circle at ${spotlight.x}px ${spotlight.y}px, rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0.06) ${spotlight.radius * 0.42}px, rgba(0, 0, 0, 0.48) ${spotlight.radius * 0.92}px, rgba(0, 0, 0, 0.8) 100%)`,
      }
    : undefined

  const ringStyle = spotlight
    ? {
        left: spotlight.x,
        top: spotlight.y,
        width: spotlight.radius * 2,
        height: spotlight.radius * 2,
      }
    : undefined

  return (
    <div className="victory-cinematic" role="presentation" aria-hidden={!showAnnounce}>
      <div className="victory-cinematic__shade" style={shadeStyle} />
      {spotlight && (
        <>
          <div className="victory-cinematic__ring" style={ringStyle} />
          <div className="victory-cinematic__ring victory-cinematic__ring--pulse" style={ringStyle} />
        </>
      )}

      {showAnnounce && (
        <div className="victory-cinematic__announce" role="status" aria-live="assertive">
          <p className="victory-cinematic__kicker">Victory</p>
          <h2 className="victory-cinematic__title">Player {winnerId} Won!</h2>
        </div>
      )}
    </div>
  )
}
