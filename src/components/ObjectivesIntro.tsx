import { useEffect, useState } from 'react'
import { OBJECTIVES_INTRO_MS } from '../game/objectives'
import type { PlayerObjective } from '../game/types'
import './ObjectivesIntro.css'

interface ObjectivesIntroProps {
  myPlayerId: 1 | 2
  draftOptions: PlayerObjective[]
  picks: { 1: string | null; 2: string | null }
  deadlineMs: number | null
  isOnline: boolean
  onPick: (objectiveId: string) => void
}

export function ObjectivesIntro({
  myPlayerId,
  draftOptions,
  picks,
  deadlineMs,
  isOnline,
  onPick,
}: ObjectivesIntroProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    deadlineMs ? Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)) : Math.ceil(OBJECTIVES_INTRO_MS / 1000),
  )

  useEffect(() => {
    if (!deadlineMs) return
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)))
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [deadlineMs])

  const myPick = picks[myPlayerId]
  const oppId: 1 | 2 = myPlayerId === 1 ? 2 : 1
  const oppPick = picks[oppId]
  const takenIds = new Set([picks[1], picks[2]].filter(Boolean) as string[])
  const localPickerId: 1 | 2 | null = isOnline
    ? null
    : !picks[1]
      ? 1
      : !picks[2]
        ? 2
        : null

  return (
    <div className="objectives-intro" role="dialog" aria-modal="true" aria-labelledby="objectives-intro-title">
      <div className="objectives-intro__card objectives-intro__card--draft">
        <h2 id="objectives-intro-title" className="objectives-intro__heading">
          Choose Your Objective
        </h2>
        <p className="objectives-intro__hint">
          <strong>8 options</strong> — Player 1 picks first, then Player 2, then a{' '}
          <strong>random third</strong> is added. First to complete all three wins! Auto-picks in{' '}
          <strong>{secondsLeft}s</strong> if someone hasn&apos;t chosen.
        </p>

        <ul className="objectives-draft__grid">
          {draftOptions.map((obj) => {
            const pickedBy =
              picks[1] === obj.id ? (1 as const) : picks[2] === obj.id ? (2 as const) : null
            const isMine = myPick === obj.id
            const isTaken = takenIds.has(obj.id)
            const isLocalTurn = isOnline || localPickerId === myPlayerId
            const canPick = !myPick && !isTaken && isLocalTurn

            return (
              <li key={obj.id}>
                <button
                  type="button"
                  className={`objectives-draft__option${pickedBy ? ` objectives-draft__option--p${pickedBy}` : ''}${isMine ? ' objectives-draft__option--mine' : ''}${!canPick && !isMine ? ' objectives-draft__option--disabled' : ''}`}
                  disabled={!canPick}
                  onClick={() => canPick && onPick(obj.id)}
                >
                  <span className="objectives-draft__label">{obj.label}</span>
                  {pickedBy != null && (
                    <span className="objectives-draft__badge">P{pickedBy}</span>
                  )}
                  {isMine && <span className="objectives-draft__badge objectives-draft__badge--you">You</span>}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="objectives-intro__ready-row">
          <span
            className={`objectives-intro__player-ready${picks[1] ? ' objectives-intro__player-ready--done' : ''}`}
          >
            Player 1 {picks[1] ? '✓ Picked' : secondsLeft > 0 ? 'Choosing…' : 'Auto-picking…'}
          </span>
          <span
            className={`objectives-intro__player-ready${picks[2] ? ' objectives-intro__player-ready--done' : ''}`}
          >
            Player 2 {picks[2] ? '✓ Picked' : secondsLeft > 0 ? 'Choosing…' : 'Auto-picking…'}
          </span>
        </div>

        {!myPick && (
          <p className="objectives-intro__waiting">
            {isOnline
              ? 'Click an objective above to lock in your pick.'
              : localPickerId === myPlayerId
                ? `Player ${myPlayerId} — choose your objective.`
                : `Waiting for Player ${localPickerId ?? oppId}…`}
          </p>
        )}
        {myPick && !oppPick && (
          <p className="objectives-intro__waiting">Waiting for Player {oppId} to pick…</p>
        )}
        {myPick && oppPick && (
          <p className="objectives-intro__waiting">Revealing match objectives…</p>
        )}
      </div>
    </div>
  )
}
