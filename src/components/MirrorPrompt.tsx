import { useEffect, useState } from 'react'
import type { MirrorPrompt } from '../game/types'
import './MirrorPrompt.css'

interface MirrorPromptModalProps {
  prompt: MirrorPrompt
  attackName: string
  onMirror: () => void
  onExpire: () => void
}

const DURATION_MS = 5000

export function MirrorPromptModal({ prompt, attackName, onMirror, onExpire }: MirrorPromptModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(5)

  useEffect(() => {
    let expired = false
    const tick = () => {
      const remaining = Math.max(0, prompt.deadlineMs - Date.now())
      setSecondsLeft(Math.ceil(remaining / 1000))
      if (remaining <= 0 && !expired) {
        expired = true
        onExpire()
      }
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [prompt.deadlineMs, onExpire])

  const progress = Math.max(0, (prompt.deadlineMs - Date.now()) / DURATION_MS) * 100

  return (
    <div className="mirror-prompt-overlay">
      <div className="mirror-prompt">
        <div className="mirror-prompt__ring">
          <svg viewBox="0 0 100 100" className="mirror-prompt__svg">
            <circle cx="50" cy="50" r="45" className="mirror-prompt__track" />
            <circle
              cx="50"
              cy="50"
              r="45"
              className="mirror-prompt__progress"
              style={{ strokeDashoffset: `${283 * (1 - progress / 100)}` }}
            />
          </svg>
          <span className="mirror-prompt__timer">{secondsLeft}</span>
        </div>
        <h3 className="mirror-prompt__title">Mirror Counter!</h3>
        <p className="mirror-prompt__desc">
          Player {prompt.attackerId} used <strong>{attackName}</strong> on you.
        </p>
        <p className="mirror-prompt__hint">
          Use Mirror to reflect it back (skips your next turn), or let the timer run out.
        </p>
        <button type="button" className="mirror-prompt__btn" onClick={onMirror}>
          Use Mirror
        </button>
      </div>
    </div>
  )
}
