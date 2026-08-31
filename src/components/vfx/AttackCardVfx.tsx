import type { CSSProperties } from 'react'
import type { VfxEvent } from '../../game/types'
import { get2x2AoESlots } from '../../game/status'
import { Particles, Slot } from './BoardVfxEffects'
import './AttackCardVfx.css'

type Target = { row: number; col: number; name: string }

export function renderAttackCardVfx(vfx: string, event: VfxEvent) {
  switch (vfx) {
    case 'explosive':
      return <ExplosiveFx event={event} />
    case 'sweep':
      return event.laneCol != null ? <SweepFx col={event.laneCol} targets={event.targets ?? []} /> : null
    default:
      return null
  }
}

function ExplosiveFx({ event }: { event: VfxEvent }) {
  const center = event.aoeCenter ?? { row: 0, col: 0 }
  const slots = get2x2AoESlots(center.row)
  const hits = event.targets ?? []

  return (
    <div className="board-vfx board-vfx--full fx-explosive">
      <div className="fx-explosive__dim" />
      <div className="fx-explosive__shockwave fx-explosive__shockwave--1" />
      <div className="fx-explosive__shockwave fx-explosive__shockwave--2" />
      <div className="fx-explosive__shockwave fx-explosive__shockwave--3" />
      {slots.map(({ row, col }) => (
        <div key={`blast-${row}-${col}`} className={`fx-explosive__cell fx-explosive__cell--${row}-${col}`}>
          <div className="fx-explosive__fire-core" />
          <div className="fx-explosive__fire-ring" />
          <Particles count={14} className="fx-explosive__ember" />
        </div>
      ))}
      <div className="fx-explosive__mushroom">
        <div className="fx-explosive__mushroom-cap" />
        <div className="fx-explosive__mushroom-stem" />
      </div>
      <div className="fx-explosive__debris-field">
        <Particles count={28} className="fx-explosive__debris" />
      </div>
      <div className="fx-explosive__flash" />
      {hits.map((hit) => (
        <Slot key={`${hit.row}-${hit.col}`} row={hit.row} col={hit.col}>
          <div className="fx-explosive__hit">
            <span className="fx-explosive__hit-dmg">−7</span>
            <span className="fx-explosive__hit-name">{hit.name}</span>
          </div>
        </Slot>
      ))}
    </div>
  )
}

function SweepFx({ col, targets }: { col: number; targets: Target[] }) {
  return (
    <div className={`board-vfx board-vfx--full fx-sweep fx-sweep--col-${col}`}>
      <div className="fx-sweep__dim" />
      <div className="fx-sweep__column-glow" />
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className={`fx-sweep__wind-streak fx-sweep__wind-streak--r${row}`} style={{ '--row': row } as CSSProperties} />
      ))}
      <div className="fx-sweep__tornado">
        <div className="fx-sweep__tornado-core" />
        <div className="fx-sweep__tornado-ring fx-sweep__tornado-ring--1" />
        <div className="fx-sweep__tornado-ring fx-sweep__tornado-ring--2" />
        <div className="fx-sweep__tornado-ring fx-sweep__tornado-ring--3" />
      </div>
      <div className="fx-sweep__leaves">
        <Particles count={24} className="fx-sweep__leaf" />
      </div>
      <div className="fx-sweep__gust-lines">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="fx-sweep__gust" style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      {targets.map((hit) => (
        <Slot key={`${hit.row}-${hit.col}`} row={hit.row} col={hit.col}>
          <div className="fx-sweep__hit">
            <span className="fx-sweep__hit-dmg">−5</span>
            <span className="fx-sweep__hit-name">{hit.name}</span>
          </div>
        </Slot>
      ))}
    </div>
  )
}
