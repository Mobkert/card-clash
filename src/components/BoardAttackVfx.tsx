import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { VfxEvent } from '../game/types'
import './BoardAttackVfx.css'

interface BoardAttackVfxProps {
  events: VfxEvent[]
  onDone?: (id: string) => void
}

const DURATIONS: Record<string, number> = {
  soul_slice: 1400,
  soul_slash: 900,
  banana_boom: 1200,
}

export function BoardAttackVfx({ events, onDone }: BoardAttackVfxProps) {
  useEffect(() => {
    const timers = events.map((event) => {
      const ms = DURATIONS[event.vfx] ?? 1000
      return setTimeout(() => onDone?.(event.id), ms)
    })
    return () => timers.forEach(clearTimeout)
  }, [events, onDone])

  if (events.length === 0) return null

  return (
    <div className="board-attack-vfx">
      {events.map((event) => {
        if (event.vfx === 'soul_slice' && event.laneRow != null) {
          return <SoulSliceVfx key={event.id} row={event.laneRow} targets={event.targets ?? []} />
        }
        if (event.vfx === 'soul_slash' && event.targets?.[0]) {
          const t = event.targets[0]
          return <SoulSlashVfx key={event.id} row={t.row} col={t.col} name={t.name} />
        }
        if (event.vfx === 'banana_boom' && event.targets?.[0]) {
          const t = event.targets[0]
          return <BananaBoomVfx key={event.id} row={t.row} col={t.col} />
        }
        return null
      })}
    </div>
  )
}

function SoulSliceVfx({
  row,
  targets,
}: {
  row: number
  targets: { row: number; col: number; name: string }[]
}) {
  return (
    <div className={`board-vfx board-vfx--soul-slice board-vfx--row-${row}`}>
      <div className="soul-slice-trail" />
      <div className="soul-slice-blade">
        <div className="soul-slice-blade__arc" />
        <div className="soul-slice-blade__core" />
      </div>
      <div className="soul-slice-sparks">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="soul-slice-spark" style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      {targets.map((t) => (
        <div
          key={`${t.row}-${t.col}`}
          className={`soul-slice-hit soul-slice-hit--col-${t.col}`}
        >
          <span className="soul-slice-hit__burst" />
          <span className="soul-slice-hit__text">{t.name}</span>
        </div>
      ))}
    </div>
  )
}

function SoulSlashVfx({ row, col, name }: { row: number; col: number; name: string }) {
  return (
    <div className={`board-vfx board-vfx--soul-slash board-vfx--slot-${row}-${col}`}>
      <div className="soul-slash-line" />
      <div className="soul-slash-ghost">{name}</div>
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="soul-slash-particle" style={{ '--i': i } as CSSProperties} />
      ))}
    </div>
  )
}

function BananaBoomVfx({ row, col }: { row: number; col: number }) {
  return (
    <div className={`board-vfx board-vfx--banana-boom board-vfx--slot-${row}-${col}`}>
      <div className="banana-boom__flash" />
      <div className="banana-boom__banana">🍌</div>
      <div className="banana-boom__splat">SPLAT!</div>
      <div className="banana-boom__ring" />
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} className="banana-boom__peel" style={{ '--i': i } as CSSProperties}>
          🍌
        </span>
      ))}
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={`s-${i}`} className="banana-boom__star" style={{ '--i': i } as CSSProperties}>
          ✦
        </span>
      ))}
    </div>
  )
}
