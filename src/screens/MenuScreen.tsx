import './MenuScreen.css'

interface MenuScreenProps {
  onPlay: () => void
  onMultiplayer: () => void
}

export function MenuScreen({ onPlay, onMultiplayer }: MenuScreenProps) {
  return (
    <div className="menu">
      <div className="menu__content">
        <h1 className="menu__title">Card Clash</h1>
        <p className="menu__subtitle">
          Place character cards on your board. Attack with attack &amp; special cards.
          Passives buff you without using a turn.
        </p>
        <button type="button" className="menu__play-btn" onClick={onPlay}>
          Local Play
        </button>
        <button type="button" className="menu__mp-btn" onClick={onMultiplayer}>
          Multiplayer
        </button>
      </div>
    </div>
  )
}
