import { useCallback, useEffect, useRef } from 'react'
import type { CardInstance } from '../game/types'
import { getTemplate } from '../game/cards'
import { isHiddenCard } from '../game/stateFilter'
import { Card } from './Card'
import './Hand.css'

interface HandProps {
  cards: CardInstance[]
  selectedId: string | null
  newlyDrawnIds?: string[]
  canInspect?: boolean
  previewId: string | null
  onPreviewChange: (instanceId: string | null) => void
  onSelect: (card: CardInstance) => void
  onUsePassive?: () => void
}

export function Hand({
  cards,
  selectedId,
  newlyDrawnIds = [],
  canInspect = false,
  previewId,
  onPreviewChange,
  onSelect,
  onUsePassive,
}: HandProps) {
  const handRef = useRef<HTMLDivElement>(null)
  const hasNewCards = newlyDrawnIds.length > 0
  const previewOpen = previewId != null

  const closePreview = useCallback(() => {
    onPreviewChange(null)
  }, [onPreviewChange])

  useEffect(() => {
    if (!previewOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePreview()
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (handRef.current?.contains(target)) return
      closePreview()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onPointerDown)
    }
  }, [previewOpen, closePreview])

  if (cards.length === 0) {
    return <div className="hand hand--empty">No cards in hand</div>
  }

  return (
    <div
      ref={handRef}
      className={`hand${hasNewCards ? ' hand--refilling' : ''}${previewOpen ? ' hand--preview-open' : ''}`}
    >
      {hasNewCards && (
        <div className="hand__refill-burst" aria-hidden>
          <span className="hand__refill-spark" />
          <span className="hand__refill-spark hand__refill-spark--2" />
          <span className="hand__refill-spark hand__refill-spark--3" />
        </div>
      )}
      {cards.map((card) => {
        const hidden = isHiddenCard(card.templateId)
        const isNew = newlyDrawnIds.includes(card.instanceId)
        const newIndex = newlyDrawnIds.indexOf(card.instanceId)
        const isPreview = !hidden && previewId === card.instanceId
        const template = hidden ? null : getTemplate(card.templateId)

        return (
          <div
            key={card.instanceId}
            className={`hand__card-wrap${isNew ? ' hand__card-wrap--draw' : ''}${isPreview ? ' hand__card-wrap--preview' : ''}`}
            style={isNew ? { animationDelay: `${newIndex * 0.1}s` } : undefined}
          >
            <Card
              card={card}
              selected={!hidden && selectedId === card.instanceId}
              previewing={isPreview}
              onClick={() => {
                if (hidden) return
                if (isPreview) closePreview()
                else if (previewOpen) closePreview()
                onSelect(card)
              }}
              onContextMenu={(event) => {
                if (!canInspect || hidden) return
                event.preventDefault()
                onPreviewChange(isPreview ? null : card.instanceId)
              }}
            />
            {isPreview && template && (
              <div className="hand__card-preview" role="tooltip" aria-live="polite">
                <p className="hand__card-preview-desc">{template.description}</p>
                {template.abilities?.map((ability) => (
                  <p key={ability.id} className="hand__card-preview-ability">
                    <strong>{ability.name}</strong> — {ability.description}
                  </p>
                ))}
              </div>
            )}
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
