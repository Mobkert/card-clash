import { useEffect, useState } from 'react'
import type { CounterPrompt, PlayerState } from '../game/types'
import { getTemplate } from '../game/cards'
import './CounterPrompt.css'

interface CounterPromptModalProps {
  prompt: CounterPrompt
  defenderHand: PlayerState['hand']
  onMirror: () => void
  onSpellBook: () => void
  onChainLocked: () => void
  onExpire: () => void
}

const DURATION_MS = 5000

export function CounterPromptModal({
  prompt,
  defenderHand,
  onMirror,
  onSpellBook,
  onChainLocked,
  onExpire,
}: CounterPromptModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(5)

  const hasMirror = defenderHand.some((c) => c.templateId === 'spc_mirror')
  const hasSpellBook = defenderHand.some((c) => c.templateId === 'atk_spell_book')
  const hasChainLocked = defenderHand.some((c) => c.templateId === 'atk_chain_locked')

  const playedName = getTemplate(prompt.playedCard.templateId).name

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
    <div className="counter-prompt-overlay">
      <div className="counter-prompt">
        <div className="counter-prompt__ring">
          <svg viewBox="0 0 100 100" className="counter-prompt__svg">
            <circle cx="50" cy="50" r="45" className="counter-prompt__track" />
            <circle
              cx="50"
              cy="50"
              r="45"
              className="counter-prompt__progress"
              style={{ strokeDashoffset: `${283 * (1 - progress / 100)}` }}
            />
          </svg>
          <span className="counter-prompt__timer">{secondsLeft}</span>
        </div>
        <h3 className="counter-prompt__title">Counter Window!</h3>
        <p className="counter-prompt__desc">
          Player {prompt.attackerId} played <strong>{playedName}</strong>
          {prompt.playedKind === 'attack' ? ' on you' : ''}.
        </p>
        <p className="counter-prompt__hint">Choose a counter or let the timer run out.</p>
        <div className="counter-prompt__actions">
          {hasMirror && (
            <button type="button" className="counter-prompt__btn counter-prompt__btn--mirror" onClick={onMirror}>
              🪞 Mirror — reflect back
            </button>
          )}
          {hasSpellBook && (
            <button type="button" className="counter-prompt__btn counter-prompt__btn--spell" onClick={onSpellBook}>
              📖 Spell Book — cancel &amp; steal
            </button>
          )}
          {hasChainLocked && (
            <button type="button" className="counter-prompt__btn counter-prompt__btn--chain" onClick={onChainLocked}>
              ⛓ Chain Locked — cancel &amp; seal
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
