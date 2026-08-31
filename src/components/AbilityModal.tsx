import { getTemplate } from '../game/cards'
import type { BoardCharacter } from '../game/types'
import './AbilityModal.css'

interface AbilityModalProps {
  character: BoardCharacter
  onSelect: (abilityId: string) => void
  onClose: () => void
}

export function AbilityModal({ character, onSelect, onClose }: AbilityModalProps) {
  const template = getTemplate(character.card.templateId)
  const abilities = template.abilities ?? []

  return (
    <div className="ability-modal-overlay" onClick={onClose}>
      <div className="ability-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ability-modal__header">
          <h3>{template.name}</h3>
          <span className="ability-modal__hp">
            {character.currentHealth}/{character.maxHealth} HP
          </span>
          <button type="button" className="ability-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        {character.statuses.length > 0 && (
          <div className="ability-modal__statuses">
            {character.statuses.map((s) => (
              <span key={s.type} className={`status-badge status-badge--${s.type}`}>
                {s.type}{s.permanent ? '' : ` (${s.turnsRemaining}t)`}
              </span>
            ))}
          </div>
        )}
        <p className="ability-modal__hint">Choose an ability, then pick a target.</p>
        <div className="ability-modal__list">
          {abilities.map((ability) => {
            const onCd = (character.cooldowns[ability.id] ?? 0) > 0
            const used = ability.oneTime && character.usedOneTime.includes(ability.id)
            const needsUses = ability.requiresUses
            const usesShort =
              needsUses &&
              (character.abilityUseCounts[needsUses.abilityId] ?? 0) < needsUses.count
            const disabled = onCd || used || usesShort
            return (
              <button
                key={ability.id}
                type="button"
                className={`ability-modal__ability${disabled ? ' ability-modal__ability--disabled' : ''}`}
                disabled={disabled}
                onClick={() => onSelect(ability.id)}
              >
                <span className="ability-modal__ability-name">{ability.name}</span>
                <span className="ability-modal__ability-desc">{ability.description}</span>
                {ability.damage != null && (
                  <span className="ability-modal__ability-dmg">{ability.damage} dmg</span>
                )}
                {ability.heal != null && (
                  <span className="ability-modal__ability-dmg">{ability.heal} heal</span>
                )}
                {onCd && (
                  <span className="ability-modal__cd">CD: {character.cooldowns[ability.id]}T</span>
                )}
                {used && <span className="ability-modal__cd">Used</span>}
                {usesShort && needsUses && (
                  <span className="ability-modal__cd">
                    Needs {needsUses.count}× {needsUses.abilityId.replace(/_/g, ' ')} (
                    {character.abilityUseCounts[needsUses.abilityId] ?? 0}/{needsUses.count})
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
