import type { CardInstance } from '../game/types'
import { isHiddenCard } from '../game/stateFilter'
import { Card } from './Card'
import './Hand.css'

interface HandProps {
  cards: CardInstance[]
  selectedId: string | null
  newlyDrawnIds?: string[]
  onSelect: (card: CardInstance) => void
  onUsePassive?: () => void
}

export function Hand({ cards, selectedId, newlyDrawnIds = [], onSelect, onUsePassive }: HandProps) {
  const hasNewCards = newlyDrawnIds.length > 0

  if (cards.length === 0) {
    return <div className="hand hand--empty">No cards in hand</div>
  }

  return (
    <div className={`hand${hasNewCards ? ' hand--refilling' : ''}`}>
      {hasNewCards && (
        <div className="hand__refill-burst" aria-hidden>
          <span className="hand__refill-spark" />
          <span className="hand__refill-spark hand__refill-spark--2" />
          <span className="hand__refill-spark hand__refill-spark--3" />
        </div>
      )}
      {cards.map((card) => {
        const isNew = newlyDrawnIds.includes(card.instanceId)
        const newIndex = newlyDrawnIds.indexOf(card.instanceId)
        return (
          <div
            key={card.instanceId}
            className={`hand__card-wrap${isNew ? ' hand__card-wrap--draw' : ''}`}
            style={isNew ? { animationDelay: `${newIndex * 0.1}s` } : undefined}
          >
            <Card
              card={card}
              selected={!isHiddenCard(card.templateId) && selectedId === card.instanceId}
              onClick={() => {
                if (!isHiddenCard(card.templateId)) onSelect(card)
              }}
            />
          </div>
        )
      })}
      {onUsePassive && selectedId && cards.find((c) => c.instanceId === selectedId) && (
        <button type="button" className="hand__passive-btn" onClick={onUsePassive}>
          Use Passive
        </button>
      )}
    </div>
  )
}
