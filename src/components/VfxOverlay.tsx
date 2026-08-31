import type { CSSProperties } from 'react'
import type { VfxEvent } from '../game/types'
import './VfxOverlay.css'

/** VFX rendered on the board itself — overlay shows compact toast only */
export const BOARD_VFX_TYPES = new Set(['soul_slice', 'soul_slash', 'banana_boom'])

interface VfxOverlayProps {
  events: VfxEvent[]
  onDone: (id: string) => void
}

const VFX_CLASS: Record<string, string> = {
  soul_slice: 'vfx--soul-slice',
  soul_slash: 'vfx--soul-slash',
  banana_boom: 'vfx--banana',
  shard: 'vfx--shard',
  freeze: 'vfx--freeze',
  burn: 'vfx--burn',
  infect: 'vfx--infect',
  web: 'vfx--web',
  tree: 'vfx--tree',
  tornado: 'vfx--tornado',
  soul_revive: 'vfx--revive',
  mirror: 'vfx--mirror',
  quantity: 'vfx--quantity',
  double_trouble: 'vfx--double',
  trade: 'vfx--trade',
  banana: 'vfx--banana',
  reaper: 'vfx--reaper',
  spider: 'vfx--spider',
  damage: 'vfx--damage',
}

export function VfxOverlay({ events, onDone }: VfxOverlayProps) {
  const overlayEvents = events.filter((e) => !BOARD_VFX_TYPES.has(e.vfx))

  if (overlayEvents.length === 0) return null

  return (
    <div className="vfx-overlay">
      {overlayEvents.map((event) => (
        <VfxBanner key={event.id} event={event} onDone={() => onDone(event.id)} />
      ))}
    </div>
  )
}

function VfxBanner({ event, onDone }: { event: VfxEvent; onDone: () => void }) {
  const cls = VFX_CLASS[event.vfx] ?? 'vfx--default'
  const isToast = BOARD_VFX_TYPES.has(event.vfx)

  return (
    <div
      className={`vfx-banner ${cls}${isToast ? ' vfx-banner--toast' : ''}`}
      onAnimationEnd={onDone}
    >
      <div className="vfx-banner__particles">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="vfx-banner__particle" style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <div className="vfx-banner__content">
        <span className="vfx-banner__label">{event.vfx.replace(/_/g, ' ').toUpperCase()}</span>
        <span className="vfx-banner__message">{event.message}</span>
      </div>
    </div>
  )
}
