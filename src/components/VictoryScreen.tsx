import { Confetti } from './Confetti'
import './VictoryScreen.css'

interface VictoryScreenProps {
  winnerId: 1 | 2
  isOnline: boolean
  myPlayerId: 1 | 2
  canRematch: boolean
  onRematch: () => void
  onLeave: () => void
}

export function VictoryScreen({
  winnerId,
  isOnline,
  myPlayerId,
  canRematch,
  onRematch,
  onLeave,
}: VictoryScreenProps) {
  const youWon = winnerId === myPlayerId

  return (
    <div className="victory-screen" role="dialog" aria-modal="true" aria-labelledby="victory-title">
      <Confetti />
      <div className="victory-screen__card">
        <div className="victory-screen__trophy" aria-hidden="true">
          🏆
        </div>
        <h2 id="victory-title" className="victory-screen__title">
          Player {winnerId} Won!
        </h2>
        <p className="victory-screen__subtitle">
          {isOnline
            ? youWon
              ? 'You completed all objectives first!'
              : 'Your opponent completed all objectives first.'
            : `Player ${winnerId} completed all objectives first!`}
        </p>
        <div className="victory-screen__actions">
          {canRematch && (
            <button type="button" className="victory-screen__btn victory-screen__btn--rematch" onClick={onRematch}>
              Rematch
            </button>
          )}
          <button type="button" className="victory-screen__btn victory-screen__btn--leave" onClick={onLeave}>
            Leave
          </button>
        </div>
        {isOnline && !canRematch && (
          <p className="victory-screen__host-hint">Waiting for the host to start a rematch…</p>
        )}
      </div>
    </div>
  )
}
