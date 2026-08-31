import { getTemplate } from '../game/cards'
import { isHiddenCard } from '../game/stateFilter'
import type { CardInstance } from '../game/types'
import './Card.css'

interface CardProps {
  card: CardInstance
  selected?: boolean
  onClick?: () => void
  small?: boolean
}

export function Card({ card, selected, onClick, small }: CardProps) {
  if (isHiddenCard(card.templateId)) {
    return (
      <div
        className={`card card--hidden${small ? ' card--small' : ''}`}
        title="Hidden card"
        aria-label="Hidden card"
      >
        <span className="card__type">???</span>
        <span className="card__name">Hidden</span>
      </div>
    )
  }

  const template = getTemplate(card.templateId)

  const typeClass = `card card--${template.type}${selected ? ' card--selected' : ''}${small ? ' card--small' : ''}`

  return (
    <button type="button" className={typeClass} onClick={onClick} title={template.description}>
      <span className="card__type">{template.type}</span>
      <span className="card__name">{template.name}</span>
      {template.type === 'character' && template.abilities && (
        <span className="card__detail">{template.health} HP · {template.abilities.length} abilities</span>
      )}
      {template.type === 'attack' && (
        <span className="card__detail">{template.effect?.replace(/_/g, ' ')}</span>
      )}
      {template.type === 'special' && (
        <span className="card__detail">{template.buff ?? template.effect?.replace(/_/g, ' ')}</span>
      )}
      {template.type === 'passive' && (
        <span className="card__detail">{template.buff}</span>
      )}
    </button>
  )
}
