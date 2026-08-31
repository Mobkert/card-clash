import './Deck.css'

interface DeckProps {
  count: number
  onClick: () => void
  label: string
  disabled?: boolean
  hint?: string
}

export function Deck({ count, onClick, label, disabled, hint }: DeckProps) {
  return (
    <button
      type="button"
      className={`deck${disabled ? ' deck--disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={hint ?? 'Click deck'}
    >
      <div className="deck__stack">
        <div className="deck__card deck__card--back" />
        <div className="deck__card deck__card--back deck__card--offset" />
      </div>
      <span className="deck__label">{label}</span>
      <span className="deck__count">{count} left</span>
    </button>
  )
}
