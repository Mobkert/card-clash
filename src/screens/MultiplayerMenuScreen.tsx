import { useState } from 'react'
import './MultiplayerMenuScreen.css'

interface MultiplayerMenuScreenProps {
  onBack: () => void
  onHost: () => void
  onJoin: (code: string) => void
  status: string
  roomCode: string | null
  isConnecting: boolean
  error: string | null
}

export function MultiplayerMenuScreen({
  onBack,
  onHost,
  onJoin,
  status,
  roomCode,
  isConnecting,
  error,
}: MultiplayerMenuScreenProps) {
  const [joinCode, setJoinCode] = useState('')
  const [mode, setMode] = useState<'pick' | 'join'>('pick')

  return (
    <div className="mp-menu">
      <div className="mp-menu__content">
        <button type="button" className="mp-menu__back" onClick={onBack}>
          ← Back
        </button>
        <h1 className="mp-menu__title">Multiplayer</h1>
        <p className="mp-menu__subtitle">
          Host a game and share your code, or join with a friend&apos;s code. You won&apos;t see each
          other&apos;s cards.
        </p>

        {error && <p className="mp-menu__error">{error}</p>}
        {status && <p className="mp-menu__status">{status}</p>}

        {roomCode && (
          <div className="mp-menu__code-box">
            <span className="mp-menu__code-label">Room code</span>
            <span className="mp-menu__code">{roomCode}</span>
            <span className="mp-menu__code-hint">Share this with Player 2</span>
          </div>
        )}

        {mode === 'pick' && !roomCode && (
          <div className="mp-menu__actions">
            <button
              type="button"
              className="mp-menu__btn mp-menu__btn--host"
              disabled={isConnecting}
              onClick={onHost}
            >
              Host Game
            </button>
            <button
              type="button"
              className="mp-menu__btn mp-menu__btn--join"
              disabled={isConnecting}
              onClick={() => setMode('join')}
            >
              Join Game
            </button>
          </div>
        )}

        {mode === 'join' && !roomCode && (
          <div className="mp-menu__join">
            <input
              className="mp-menu__input"
              type="text"
              maxLength={6}
              placeholder="Enter code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button
              type="button"
              className="mp-menu__btn mp-menu__btn--join"
              disabled={isConnecting || joinCode.trim().length < 4}
              onClick={() => onJoin(joinCode.trim())}
            >
              Connect
            </button>
            <button type="button" className="mp-menu__link" onClick={() => setMode('pick')}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
