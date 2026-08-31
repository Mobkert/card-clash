import { useEffect, useState } from 'react'
import { OBJECTIVES_INTRO_MS } from '../game/objectives'
import { playerIds } from '../game/players'
import type { PlayerCount, PlayerId, PlayerObjective } from '../game/types'
import './ObjectivesIntro.css'

interface ObjectivesIntroProps {
  myPlayerId: PlayerId
  playerCount: PlayerCount
  draftOptions: PlayerObjective[]
  picks: Record<PlayerId, string | null>
  deadlineMs: number | null
  isOnline: boolean
  onPick: (objectiveId: string) => void
}

export function ObjectivesIntro({
  myPlayerId,
  playerCount,
  draftOptions,
  picks,
  deadlineMs,
  isOnline,
  onPick,
}: ObjectivesIntroProps) {
  const ids = playerIds(playerCount)
  const matchObjectives = playerCount === 3 ? 4 : 3
  const draftSize = playerCount === 3 ? 10 : 8

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
  const takenIds = new Set(ids.map((id) => picks[id]).filter(Boolean) as string[])
  const localPickerId: PlayerId | null = isOnline
    ? null
    : ids.find((id) => !picks[id]) ?? null
  const waitingForId = ids.find((id) => !picks[id] && id !== myPlayerId)
  const allPicked = ids.every((id) => picks[id])

  return (
    <div className="objectives-intro" role="dialog" aria-modal="true" aria-labelledby="objectives-intro-title">
      <div className="objectives-intro__card objectives-intro__card--draft">
        <h2 id="objectives-intro-title" className="objectives-intro__heading">
          Choose Your Objective
        </h2>
        <p className="objectives-intro__hint">
          <strong>{draftSize} options</strong> — players pick in order, then a{' '}
          <strong>random {playerCount === 3 ? 'fourth' : 'third'}</strong> is added. First to complete
          all {matchObjectives} wins! Auto-picks in <strong>{secondsLeft}s</strong> if someone
          hasn&apos;t chosen.
        </p>

        <ul className="objectives-draft__grid">
          {draftOptions.map((obj) => {
            const pickedBy = ids.find((id) => picks[id] === obj.id) ?? null
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
          {ids.map((id) => (
            <span
              key={id}
              className={`objectives-intro__player-ready${picks[id] ? ' objectives-intro__player-ready--done' : ''}`}
            >
              Player {id} {picks[id] ? '✓ Picked' : secondsLeft > 0 ? 'Choosing…' : 'Auto-picking…'}
            </span>
          ))}
        </div>

        {!myPick && (
          <p className="objectives-intro__waiting">
            {isOnline
              ? 'Click an objective above to lock in your pick.'
              : localPickerId === myPlayerId
                ? `Player ${myPlayerId} — choose your objective.`
                : `Waiting for Player ${localPickerId ?? waitingForId ?? ids[0]}…`}
          </p>
        )}
        {myPick && waitingForId && (
          <p className="objectives-intro__waiting">Waiting for Player {waitingForId} to pick…</p>
        )}
        {myPick && allPicked && (
          <p className="objectives-intro__waiting">Revealing match objectives…</p>
        )}
      </div>
    </div>
  )
}
