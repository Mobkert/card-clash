import { useEffect, useMemo, useState } from 'react'
import { OBJECTIVES_INTRO_MS } from '../game/objectives'
import { playerIds } from '../game/players'
import type { PlayerCount, PlayerId, PlayerObjective } from '../game/types'
import './ObjectivesReveal.css'

const REVEAL_STEP_MS = 1400

type RevealSlot = {
  objective: PlayerObjective
  source: 'p1' | 'p2' | 'p3' | 'random'
  title: string
}

interface ObjectivesRevealProps {
  myPlayerId: PlayerId
  playerCount: PlayerCount
  matchObjectives: PlayerObjective[]
  picks: Record<PlayerId, string | null>
  randomPickId: string | null
  objectivesAck: Record<PlayerId, boolean>
  deadlineMs: number | null
  isOnline: boolean
  onAck: () => void
}

export function ObjectivesReveal({
  myPlayerId,
  playerCount,
  matchObjectives,
  picks,
  randomPickId,
  objectivesAck,
  deadlineMs,
  isOnline,
  onAck,
}: ObjectivesRevealProps) {
  const ids = playerIds(playerCount)
  const matchObjectiveTotal = playerCount === 3 ? 4 : 3

  const revealSlots = useMemo((): RevealSlot[] => {
    const slots: RevealSlot[] = []
    const sourceFor = (id: PlayerId): RevealSlot['source'] =>
      id === 1 ? 'p1' : id === 2 ? 'p2' : 'p3'

    for (const id of ids) {
      const obj = matchObjectives.find((o) => o.id === picks[id])
      if (obj) slots.push({ objective: obj, source: sourceFor(id), title: `Player ${id} chose` })
    }

    const randomObj =
      matchObjectives.find((o) => o.id === randomPickId) ??
      matchObjectives.find((o) => !ids.some((id) => picks[id] === o.id))

    if (randomObj) slots.push({ objective: randomObj, source: 'random', title: 'Random objective!' })

    if (slots.length === 0) {
      return matchObjectives.slice(0, matchObjectiveTotal).map((objective, i) => ({
        objective,
        source: (i === 0 ? 'p1' : i === 1 ? 'p2' : i === 2 ? 'p3' : 'random') as RevealSlot['source'],
        title:
          i === 0
            ? 'Player 1 chose'
            : i === 1
              ? 'Player 2 chose'
              : i === 2 && playerCount === 3
                ? 'Player 3 chose'
                : 'Random objective!',
      }))
    }
    return slots
  }, [matchObjectives, picks, randomPickId, ids, matchObjectiveTotal, playerCount])

  const [step, setStep] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(() =>
    deadlineMs ? Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)) : Math.ceil(OBJECTIVES_INTRO_MS / 1000),
  )

  const revealComplete = step >= revealSlots.length
  const currentSlot = !revealComplete ? revealSlots[step] : null

  useEffect(() => {
    setStep(0)
  }, [revealSlots.length, picks[1], picks[2], picks[3], randomPickId])

  useEffect(() => {
    if (step >= revealSlots.length) return undefined
    const id = window.setTimeout(() => {
      setStep((s) => s + 1)
    }, REVEAL_STEP_MS)
    return () => window.clearTimeout(id)
  }, [step, revealSlots.length])

  useEffect(() => {
    if (!deadlineMs || !revealComplete) return undefined
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)))
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [deadlineMs, revealComplete])

  const myReady = objectivesAck[myPlayerId]
  const waitingAckId = ids.find((id) => !objectivesAck[id] && id !== myPlayerId)
  const localAckPlayer: PlayerId | null = isOnline ? null : ids.find((id) => !objectivesAck[id]) ?? null
  const canAck = isOnline || localAckPlayer === myPlayerId
  const allReady = ids.every((id) => objectivesAck[id])

  return (
    <div className="objectives-reveal" role="dialog" aria-modal="true" aria-labelledby="objectives-reveal-title">
      <div className="objectives-reveal__backdrop" />

      {!revealComplete && currentSlot && (
        <div
          key={`${currentSlot.objective.id}-${step}`}
          className={`objectives-reveal__pop objectives-reveal__pop--${currentSlot.source}`}
        >
          <span className="objectives-reveal__pop-star objectives-reveal__pop-star--1">★</span>
          <span className="objectives-reveal__pop-star objectives-reveal__pop-star--2">✦</span>
          <span className="objectives-reveal__pop-star objectives-reveal__pop-star--3">★</span>
          <p className="objectives-reveal__pop-kicker">{currentSlot.title}</p>
          <h2 id="objectives-reveal-title" className="objectives-reveal__pop-label">
            {currentSlot.objective.label}
          </h2>
          <p className="objectives-reveal__pop-target">Target: {currentSlot.objective.target}</p>
          <p className="objectives-reveal__pop-counter">
            {step + 1} / {revealSlots.length}
          </p>
        </div>
      )}

      {revealComplete && (
        <div className="objectives-reveal__summary">
          <h2 className="objectives-reveal__summary-title">Match Objectives</h2>
          <p className="objectives-reveal__summary-hint">
            Complete all {matchObjectiveTotal} before your opponents to win! Press Next — or auto-start in{' '}
            <strong>{secondsLeft}s</strong>.
          </p>

          <ul className="objectives-reveal__list">
            {revealSlots.map((slot) => (
              <li key={slot.objective.id} className={`objectives-reveal__item objectives-reveal__item--${slot.source}`}>
                <span className="objectives-reveal__item-tag">{slot.title}</span>
                <span className="objectives-reveal__item-label">{slot.objective.label}</span>
              </li>
            ))}
          </ul>

          <div className="objectives-reveal__ready-row">
            {ids.map((id) => (
              <span key={id} className={`objectives-reveal__ready${objectivesAck[id] ? ' objectives-reveal__ready--done' : ''}`}>
                Player {id} {objectivesAck[id] ? '✓ Ready' : '…'}
              </span>
            ))}
          </div>

          {!myReady && canAck && (
            <button type="button" className="objectives-reveal__next" onClick={onAck}>
              Next {isOnline ? '' : `(Player ${myPlayerId})`}
            </button>
          )}
          {!myReady && !canAck && !isOnline && (
            <p className="objectives-reveal__waiting">Waiting for Player {localAckPlayer}…</p>
          )}
          {myReady && waitingAckId && (
            <p className="objectives-reveal__waiting">Waiting for Player {waitingAckId}…</p>
          )}
          {myReady && allReady && <p className="objectives-reveal__waiting">Starting game…</p>}
        </div>
      )}
    </div>
  )
}
