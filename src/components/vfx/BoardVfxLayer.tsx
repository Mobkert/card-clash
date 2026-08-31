import { useEffect } from 'react'
import type { VfxEvent } from '../../game/types'
import { getBoardVfxDuration, renderBoardVfx } from './BoardVfxEffects'
import './BoardVfx.css'
import './BoardVfxHorizontal.css'

interface BoardVfxLayerProps {
  events: VfxEvent[]
  layout?: 'vertical' | 'horizontal'
  onDone?: (id: string) => void
}

export function BoardVfxLayer({ events, layout = 'vertical', onDone }: BoardVfxLayerProps) {
  useEffect(() => {
    const timers = events.map((event) =>
      setTimeout(() => onDone?.(event.id), getBoardVfxDuration(event.vfx)),
    )
    return () => timers.forEach(clearTimeout)
  }, [events, onDone])

  if (events.length === 0) return null

  return (
    <div className={`board-vfx-layer${layout === 'horizontal' ? ' board-vfx-layer--horizontal' : ''}`}>
      {events.map((e) => (
        <div key={e.id}>{renderBoardVfx(e)}</div>
      ))}
    </div>
  )
}
