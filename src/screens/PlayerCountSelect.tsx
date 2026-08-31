import type { PlayerCount } from '../game/types'
import './PlayerCountSelect.css'

interface PlayerCountSelectProps {
  title: string
  subtitle: string
  onBack: () => void
  onSelect: (count: PlayerCount) => void
}

export function PlayerCountSelect({ title, subtitle, onBack, onSelect }: PlayerCountSelectProps) {
  return (
    <div className="player-count-select">
      <div className="player-count-select__card">
        <button type="button" className="player-count-select__back" onClick={onBack}>
          ← Back
        </button>
        <h1 className="player-count-select__title">{title}</h1>
        <p className="player-count-select__subtitle">{subtitle}</p>
        <div className="player-count-select__options">
          <button type="button" className="player-count-select__option" onClick={() => onSelect(2)}>
            <span className="player-count-select__option-title">2 Players</span>
            <span className="player-count-select__option-desc">Classic duel — side-by-side boards</span>
          </button>
          <button type="button" className="player-count-select__option player-count-select__option--triple" onClick={() => onSelect(3)}>
            <span className="player-count-select__option-title">3 Players</span>
            <span className="player-count-select__option-desc">
              Triple clash — two boards on the sides, one across the top · 4 harder objectives
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
