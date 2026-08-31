import type { CSSProperties, ReactNode } from 'react'
import type { VfxEvent } from '../../game/types'
import { getPlusAoESlots } from '../../game/status'
import { Particles, Slot } from './BoardVfxEffects'
import { rowClass, slotClass } from './vfxConfig'
import './NewCharacterVfx.css'

type Target = { row: number; col: number; name: string }

function Dim({ className }: { className: string }) {
  return <div className={className} />
}

function Vignette({ className }: { className: string }) {
  return <div className={className} />
}

function ImpactBurst({ className }: { className: string }) {
  return (
    <div className={className}>
      <div className="ncfx-impact__flash" />
      <div className="ncfx-impact__ring" />
      <div className="ncfx-impact__ring ncfx-impact__ring--2" />
      <Particles count={14} className="ncfx-impact__spark" />
    </div>
  )
}

function SlashSvg({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 100 80" className={className} preserveAspectRatio="none" aria-hidden>
      <path
        d="M 8 72 Q 35 38 92 6"
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M 8 72 Q 35 38 92 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        className="ncfx-slash__path"
      />
      <path
        d="M 8 72 Q 35 38 92 6"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        className="ncfx-slash__core"
      />
    </svg>
  )
}

/* ─── Quick Bite ─── */
export function QuickBiteFx({ row, col, name }: { row: number; col: number; name: string }) {
  return (
    <Slot row={row} col={col} extra="fx-quick-bite">
      <Dim className="fx-quick-bite__dim" />
      <Vignette className="fx-quick-bite__vignette" />
      <div className="fx-quick-bite__jaws">
        <div className="fx-quick-bite__jaw fx-quick-bite__jaw--top" />
        <div className="fx-quick-bite__jaw fx-quick-bite__jaw--bottom" />
        <div className="fx-quick-bite__teeth" />
      </div>
      <ImpactBurst className="fx-quick-bite__impact" />
      <Particles count={16} className="fx-quick-bite__droplet" />
      <span className="fx-quick-bite__tag">QUICK BITE</span>
      <span className="fx-quick-bite__dmg">−10</span>
      <span className="fx-quick-bite__name">{name}</span>
    </Slot>
  )
}

/* ─── Boulder Roll ─── */
export function BoulderRollFx({ row, targets }: { row: number; targets: Target[] }) {
  return (
    <div className={`board-vfx board-vfx--lane ${rowClass(row)} fx-boulder-roll`}>
      <Dim className="fx-boulder-roll__dim" />
      <Vignette className="fx-boulder-roll__vignette" />
      <div className="fx-boulder-roll__dust-field" />
      <div className="fx-boulder-roll__lane-track" />
      <div className="fx-boulder-roll__crack" />
      <div className="fx-boulder-roll__boulder-rig">
        <div className="fx-boulder-roll__boulder-shadow" />
        <div className="fx-boulder-roll__boulder">🪨</div>
        <div className="fx-boulder-roll__boulder fx-boulder-roll__boulder--ghost">🪨</div>
        <Particles count={24} className="fx-boulder-roll__debris" />
      </div>
      {targets.map((hit) => (
        <div key={`${hit.row}-${hit.col}`} className={`fx-boulder-roll__hit fx-boulder-roll__hit--c${hit.col}`}>
          <ImpactBurst className="fx-boulder-roll__impact" />
          <div className="fx-boulder-roll__crater" />
          <span className="fx-boulder-roll__hit-dmg">−10</span>
          <span className="fx-boulder-roll__hit-name">{hit.name}</span>
        </div>
      ))}
      <span className="fx-boulder-roll__tag">BOULDER ROLL</span>
    </div>
  )
}

/* ─── Healing Essence ─── */
export function HealingEssenceFx({ targets }: { targets: Target[] }) {
  return (
    <>
      {targets.map((t) => (
        <Slot key={`${t.row}-${t.col}`} row={t.row} col={t.col} extra="fx-heal-essence">
          <Dim className="fx-heal-essence__dim" />
          <Vignette className="fx-heal-essence__vignette" />
          <div className="fx-heal-essence__pillar" />
          <div className="fx-heal-essence__ring" />
          <div className="fx-heal-essence__ring fx-heal-essence__ring--2" />
          <div className="fx-heal-essence__cross">+</div>
          <Particles count={18} className="fx-heal-essence__mote" />
          <Particles count={8} className="fx-heal-essence__leaf" />
          <span className="fx-heal-essence__tag">+20 HP</span>
        </Slot>
      ))}
    </>
  )
}

/* ─── Sacrifice Heal ─── */
export function SacrificeHealFx({ row, col, name }: { row: number; col: number; name: string }) {
  return (
    <Slot row={row} col={col} extra="fx-sacrifice-heal">
      <Dim className="fx-sacrifice-heal__dim" />
      <Vignette className="fx-sacrifice-heal__vignette" />
      <div className="fx-sacrifice-heal__beam" />
      <div className="fx-sacrifice-heal__beam fx-sacrifice-heal__beam--2" />
      <div className="fx-sacrifice-heal__bloom" />
      <div className="fx-sacrifice-heal__sigil" />
      <Particles count={22} className="fx-sacrifice-heal__leaf" />
      <Particles count={12} className="fx-sacrifice-heal__spark" />
      <span className="fx-sacrifice-heal__tag">FULL HEAL</span>
      <span className="fx-sacrifice-heal__name">{name}</span>
    </Slot>
  )
}

/* ─── Double Hit ─── */
export function DoubleHitFx({ row, col, name }: { row: number; col: number; name: string }) {
  return (
    <Slot row={row} col={col} extra="fx-double-hit">
      <Dim className="fx-double-hit__dim" />
      <Vignette className="fx-double-hit__vignette" />
      <SlashSvg className="fx-double-hit__slash fx-double-hit__slash--1" />
      <SlashSvg className="fx-double-hit__slash fx-double-hit__slash--2" />
      <ImpactBurst className="fx-double-hit__impact" />
      <span className="fx-double-hit__counter">×2</span>
      <span className="fx-double-hit__tag">DOUBLE HIT</span>
      <span className="fx-double-hit__name">{name}</span>
    </Slot>
  )
}

/* ─── Immunity ─── */
export function ImmunityFx({ row, col }: { row: number; col: number }) {
  return (
    <Slot row={row} col={col} extra="fx-immunity">
      <Dim className="fx-immunity__dim" />
      <Vignette className="fx-immunity__vignette" />
      <div className="fx-immunity__hex" />
      <div className="fx-immunity__hex fx-immunity__hex--2" />
      <div className="fx-immunity__shield" />
      <Particles count={16} className="fx-immunity__orb" />
      <span className="fx-immunity__icon">🛡</span>
      <span className="fx-immunity__tag">IMMUNE</span>
    </Slot>
  )
}

/* ─── Peck ─── */
export function PeckFx({ row, col, name }: { row: number; col: number; name: string }) {
  return (
    <Slot row={row} col={col} extra="fx-peck">
      <Dim className="fx-peck__dim" />
      <Vignette className="fx-peck__vignette" />
      <div className="fx-peck__dive-trail" />
      <div className="fx-peck__bird">🐦</div>
      <ImpactBurst className="fx-peck__impact" />
      <Particles count={14} className="fx-peck__feather" />
      <span className="fx-peck__heal">+5</span>
      <span className="fx-peck__tag">PECK</span>
      <span className="fx-peck__name">{name}</span>
    </Slot>
  )
}

/* ─── Turd Bomb ─── */
export function TurdBombFx({
  center,
  targets,
}: {
  center: { row: number; col: number }
  targets: Target[]
}) {
  const aoeSlots = getPlusAoESlots(center.row, center.col)
  const hitSet = new Set(targets.map((t) => `${t.row}-${t.col}`))

  return (
    <div className="board-vfx board-vfx--full fx-turd-bomb-blast">
      <Dim className="fx-turd-bomb-blast__dim" />
      <Vignette className="fx-turd-bomb-blast__vignette" />

      <div className={`fx-turd-bomb-blast__bomb-rig ${slotClass(center.row, center.col)}`}>
        <div className="fx-turd-bomb-blast__bomb-shadow" />
        <div className="fx-turd-bomb-blast__bomb">💩</div>
        <div className="fx-turd-bomb-blast__bomb-trail" />
      </div>

      <div className={`fx-turd-bomb-blast__shockwave ${slotClass(center.row, center.col)}`} />

      {aoeSlots.map(({ row, col }, i) => (
        <div
          key={`aoe-${row}-${col}`}
          className={`fx-turd-bomb-blast__zone ${slotClass(row, col)}${row === center.row && col === center.col ? ' fx-turd-bomb-blast__zone--center' : ''}`}
          style={{ '--aoe-i': i } as CSSProperties}
        />
      ))}

      {aoeSlots.map(({ row, col }, i) => {
        const hit = targets.find((t) => t.row === row && t.col === col)
        return (
          <div
            key={`splatter-${row}-${col}`}
            className={`fx-turd-bomb-blast__slot ${slotClass(row, col)}${hitSet.has(`${row}-${col}`) ? ' fx-turd-bomb-blast__slot--hit' : ''}`}
            style={{ '--aoe-i': i } as CSSProperties}
          >
            <div className="fx-turd-bomb-blast__toxic-cloud" />
            <div className="fx-turd-bomb-blast__splatter" />
            <Particles count={10} className="fx-turd-bomb-blast__goop" />
            {hit && (
              <>
                <span className="fx-turd-bomb-blast__dmg">−20</span>
                <span className="fx-turd-bomb-blast__name">{hit.name}</span>
              </>
            )}
          </div>
        )
      })}

      <span className="fx-turd-bomb-blast__tag">TURD BOMB</span>
    </div>
  )
}

/* ─── Stare ─── */
export function StareFx({ row, col, name }: { row: number; col: number; name: string }) {
  return (
    <Slot row={row} col={col} extra="fx-stare">
      <Dim className="fx-stare__dim" />
      <Vignette className="fx-stare__vignette" />
      <div className="fx-stare__hypno-ring" />
      <div className="fx-stare__hypno-ring fx-stare__hypno-ring--2" />
      <div className="fx-stare__beam" />
      <div className="fx-stare__eye">👁</div>
      <div className="fx-stare__chains">
        <span /><span /><span />
      </div>
      <ImpactBurst className="fx-stare__impact" />
      <Particles count={16} className="fx-stare__particle" />
      <span className="fx-stare__tag">STARE</span>
      <span className="fx-stare__silence">SILENCED</span>
      <span className="fx-stare__name">{name}</span>
    </Slot>
  )
}

/* ─── Haunt ─── */
export function HauntFx({ row, col, name }: { row: number; col: number; name: string }) {
  return (
    <Slot row={row} col={col} extra="fx-haunt">
      <Dim className="fx-haunt__dim" />
      <Vignette className="fx-haunt__vignette" />
      <div className="fx-haunt__mist" />
      <div className="fx-haunt__seal" />
      <div className="fx-haunt__ghost">👻</div>
      <Particles count={20} className="fx-haunt__wisp" />
      <span className="fx-haunt__tag">HAUNTED</span>
      <span className="fx-haunt__name">{name}</span>
    </Slot>
  )
}

export function HauntRecoilFx({ row, col, name }: { row: number; col: number; name: string }) {
  return (
    <Slot row={row} col={col} extra="fx-haunt-recoil">
      <Dim className="fx-haunt-recoil__dim" />
      <div className="fx-haunt-recoil__backlash" />
      <ImpactBurst className="fx-haunt-recoil__impact" />
      <span className="fx-haunt-recoil__tag">HAUNT −10</span>
      <span className="fx-haunt-recoil__name">{name}</span>
    </Slot>
  )
}

/* ─── Katana Strike ─── */
export function KatanaStrikeFx({ row, col, name }: { row: number; col: number; name: string }) {
  return (
    <Slot row={row} col={col} extra="fx-katana">
      <Dim className="fx-katana__dim" />
      <Vignette className="fx-katana__vignette" />
      <SlashSvg className="fx-katana__slash" />
      <SlashSvg className="fx-katana__slash fx-katana__slash--after" />
      <div className="fx-katana__flash" />
      <div className="fx-katana__blood-mist" />
      <ImpactBurst className="fx-katana__impact" />
      <Particles count={16} className="fx-katana__spark" />
      <span className="fx-katana__tag">KATANA</span>
      <span className="fx-katana__name">{name}</span>
    </Slot>
  )
}

/* ─── Redliner Shot ─── */
export function RedlinerShotFx({ row, targets }: { row: number; targets: Target[] }) {
  return (
    <div className={`board-vfx board-vfx--lane ${rowClass(row)} fx-redliner-shot`}>
      <Dim className="fx-redliner-shot__dim" />
      <Vignette className="fx-redliner-shot__vignette" />
      <div className="fx-redliner-shot__smoke" />
      <div className="fx-redliner-shot__lane-line" />
      <div className="fx-redliner-shot__bullet-rig">
        <div className="fx-redliner-shot__muzzle-flash" />
        <div className="fx-redliner-shot__bullet" />
        <div className="fx-redliner-shot__bullet-trail" />
      </div>
      <Particles count={20} className="fx-redliner-shot__shell" />
      {targets.map((hit) => (
        <div key={`${hit.row}-${hit.col}`} className={`fx-redliner-shot__hit fx-redliner-shot__hit--c${hit.col}`}>
          <ImpactBurst className="fx-redliner-shot__impact" />
          <div className="fx-redliner-shot__explosion" />
          <span className="fx-redliner-shot__hit-dmg">−30</span>
          <span className="fx-redliner-shot__hit-name">{hit.name}</span>
        </div>
      ))}
      <span className="fx-redliner-shot__tag">SHOT</span>
    </div>
  )
}

export function renderNewCharVfx(vfx: string, event: VfxEvent): ReactNode {
  const t = event.targets?.[0]
  switch (vfx) {
    case 'quick_bite':
      return t ? <QuickBiteFx row={t.row} col={t.col} name={t.name} /> : null
    case 'boulder_roll':
      return event.laneRow != null ? <BoulderRollFx row={event.laneRow} targets={event.targets ?? []} /> : null
    case 'healing_essence':
      return event.targets?.length ? <HealingEssenceFx targets={event.targets} /> : null
    case 'sacrifice_heal':
      return t ? <SacrificeHealFx row={t.row} col={t.col} name={t.name} /> : null
    case 'double_hit':
      return t ? <DoubleHitFx row={t.row} col={t.col} name={t.name} /> : null
    case 'immunity':
      return t ? <ImmunityFx row={t.row} col={t.col} /> : null
    case 'peck':
      return t ? <PeckFx row={t.row} col={t.col} name={t.name} /> : null
    case 'turd_bomb': {
      const center = event.aoeCenter ?? (t ? { row: t.row, col: t.col } : null)
      return center ? <TurdBombFx center={center} targets={event.targets ?? []} /> : null
    }
    case 'stare':
      return t ? <StareFx row={t.row} col={t.col} name={t.name} /> : null
    case 'haunt':
      return t ? <HauntFx row={t.row} col={t.col} name={t.name} /> : null
    case 'haunt_recoil':
      return t ? <HauntRecoilFx row={t.row} col={t.col} name={t.name} /> : null
    case 'katana_strike':
      return t ? <KatanaStrikeFx row={t.row} col={t.col} name={t.name} /> : null
    case 'redliner_shot':
      return event.laneRow != null ? <RedlinerShotFx row={event.laneRow} targets={event.targets ?? []} /> : null
    default:
      return null
  }
}
