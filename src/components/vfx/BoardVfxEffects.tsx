import type { CSSProperties, ReactNode } from 'react'
import { useId } from 'react'
import type { VfxEvent } from '../../game/types'
import { rowClass, slotClass, VFX_DURATIONS } from './vfxConfig'
import { renderNewCharVfx } from './NewCharacterVfx'
import { renderAttackCardVfx } from './AttackCardVfx'
import './BoardVfx.css'
import './AttackCardVfx.css'

type Target = { row: number; col: number; name: string }

/** Sharp circular-saw tooth outline (tip → gullet → valley per tooth) */
function buildSawBladePath(teeth: number, outerR: number, innerR: number, cx = 50, cy = 50): string {
  const parts: string[] = []
  for (let i = 0; i < teeth; i++) {
    const start = (i / teeth) * Math.PI * 2 - Math.PI / 2
    const end = ((i + 1) / teeth) * Math.PI * 2 - Math.PI / 2
    const span = end - start
    const pt = (a: number, r: number) => ({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
    })
    const tip = pt(start + span * 0.06, outerR)
    const gul = pt(start + span * 0.42, innerR + 4)
    const valley = pt(start + span * 0.88, innerR)

    if (i === 0) parts.push(`M ${tip.x.toFixed(1)} ${tip.y.toFixed(1)}`)
    else parts.push(`L ${tip.x.toFixed(1)} ${tip.y.toFixed(1)}`)
    parts.push(`L ${gul.x.toFixed(1)} ${gul.y.toFixed(1)}`)
    parts.push(`L ${valley.x.toFixed(1)} ${valley.y.toFixed(1)}`)
  }
  parts.push('Z')
  return parts.join(' ')
}

const SAW_OUTER_PATH = buildSawBladePath(20, 48, 37)
const SAW_INNER_PLATE = buildSawBladePath(20, 37, 32)

function SawbladeSvg() {
  return (
    <svg
      className="fx-soul-slice__saw-svg"
      viewBox="0 0 100 100"
      aria-hidden
    >
      <defs>
        <radialGradient id="sawPlate" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#5e35b1" />
          <stop offset="55%" stopColor="#311b92" />
          <stop offset="100%" stopColor="#120524" />
        </radialGradient>
        <linearGradient id="sawToothFace" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9575cd" />
          <stop offset="40%" stopColor="#7e57c2" />
          <stop offset="100%" stopColor="#4a148c" />
        </linearGradient>
        <linearGradient id="sawToothTip" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="45%" stopColor="#e1bee7" />
          <stop offset="100%" stopColor="#b388ff" />
        </linearGradient>
        <radialGradient id="sawHub" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="50%" stopColor="#ce93d8" />
          <stop offset="100%" stopColor="#4a148c" />
        </radialGradient>
        <filter id="sawGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#b388ff" floodOpacity="0.9" />
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#7c4dff" floodOpacity="0.65" />
        </filter>
      </defs>
      <g className="fx-soul-slice__saw-spin-group">
        <path d={SAW_INNER_PLATE} fill="url(#sawPlate)" opacity="0.95" />
        <path d={SAW_OUTER_PATH} fill="url(#sawToothFace)" filter="url(#sawGlow)" />
        <path
          d={SAW_OUTER_PATH}
          fill="none"
          stroke="url(#sawToothTip)"
          strokeWidth="1.8"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
        <circle cx="50" cy="50" r="9" fill="url(#sawHub)" stroke="#fff" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="3" fill="#311b92" stroke="#e1bee7" strokeWidth="0.6" />
      </g>
    </svg>
  )
}

export function Slot({ row, col, children, extra }: { row: number; col: number; children: ReactNode; extra?: string }) {
  return (
    <div className={`board-vfx ${slotClass(row, col)} ${extra ?? ''}`}>{children}</div>
  )
}

export function Particles({ count, className }: { count: number; className: string }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={className} style={{ '--i': i } as CSSProperties} />
      ))}
    </>
  )
}

export function renderBoardVfx(event: VfxEvent): ReactNode {
  const t = event.targets?.[0]

  switch (event.vfx) {
    case 'soul_slice':
      return event.laneRow != null ? (
        <SoulSliceFx row={event.laneRow} targets={event.targets ?? []} />
      ) : null

    case 'soul_slash':
      return t ? <SoulSlashFx row={t.row} col={t.col} name={t.name} /> : null

    case 'banana_boom':
      return t ? <BananaBoomFx row={t.row} col={t.col} /> : null

    case 'banana_peel':
      return t ? <BananaPeelFx row={t.row} col={t.col} name={t.name} /> : null

    case 'web':
      return t ? <WebFx row={t.row} col={t.col} /> : null

    case 'infect':
      return t ? <InfectFx row={t.row} col={t.col} /> : null

    case 'freeze':
      return t ? <FreezeFx row={t.row} col={t.col} name={t.name} /> : null

    case 'burn':
      return t ? <BurnFx row={t.row} col={t.col} /> : null

    case 'tree':
      return t ? <TreeFx row={t.row} col={t.col} /> : null

    case 'tornado': {
      const from = event.targets?.[0]
      const to = event.targets?.[1]
      return from && to ? <TornadoFx from={from} to={to} /> : null
    }

    case 'double_trouble':
      return t ? <DoubleTroubleFx row={t.row} col={t.col} name={t.name} /> : null

    case 'character_deploy':
      return t ? <DeployFx row={t.row} col={t.col} name={t.name} /> : null

    case 'shard_strike':
      return t ? <ShardStrikeFx row={t.row} col={t.col} /> : null

    case 'damage':
      return t ? <GenericHitFx row={t.row} col={t.col} /> : null

    case 'cannon_hit':
      return t ? <BananaBoomFx row={t.row} col={t.col} /> : null

    case 'ice_cream_lane':
      return event.laneRow != null ? (
        <IceCreamLaneFx row={event.laneRow} targets={event.targets ?? []} />
      ) : null

    case 'explosive':
    case 'sweep':
    case 'chaos':
      return renderAttackCardVfx(event.vfx === 'chaos' ? 'explosive' : event.vfx, event)

    default:
      return renderNewCharVfx(event.vfx, event)
  }
}

export function getBoardVfxDuration(vfx: string) {
  return VFX_DURATIONS[vfx] ?? 1200
}

/* ─── Soul Slice ─── */
function SoulSliceFx({ row, targets }: { row: number; targets: Target[] }) {
  return (
    <div className={`board-vfx board-vfx--lane ${rowClass(row)} fx-soul-slice`}>
      <div className="fx-soul-slice__dim" />
      <div className="fx-soul-slice__vignette" />
      <div className="fx-soul-slice__pulse fx-soul-slice__pulse--1" />
      <div className="fx-soul-slice__pulse fx-soul-slice__pulse--2" />
      <div className="fx-soul-slice__energy-streak" />
      <div className="fx-soul-slice__energy-streak fx-soul-slice__energy-streak--2" />
      <div className="fx-soul-slice__lane-slash" />
      <div className="fx-soul-slice__lane-slash fx-soul-slice__lane-slash--after" />

      <div className="fx-soul-slice__saw-rig">
        <div className="fx-soul-slice__saw-shadow" />
        <div className="fx-soul-slice__saw-tilt">
          <div className="fx-soul-slice__saw-trail" />
          <div className="fx-soul-slice__saw-trail fx-soul-slice__saw-trail--ghost" />
          <div className="fx-soul-slice__saw">
            <div className="fx-soul-slice__saw-aura" />
            <div className="fx-soul-slice__saw-blade-wrap">
              <SawbladeSvg />
            </div>
            <div className="fx-soul-slice__saw-bite" aria-hidden />
          </div>
          <div className="fx-soul-slice__spark-field">
            <Particles count={32} className="fx-soul-slice__spark" />
          </div>
          <div className="fx-soul-slice__spark-field">
            <Particles count={20} className="fx-soul-slice__spark fx-soul-slice__spark--streak" />
          </div>
          <div className="fx-soul-slice__spark-field fx-soul-slice__spark-field--wide">
            <Particles count={16} className="fx-soul-slice__spark fx-soul-slice__spark--ember" />
          </div>
        </div>
      </div>

      <div className="fx-soul-slice__residual-sparks">
        <Particles count={18} className="fx-soul-slice__residual" />
      </div>

      {targets.map((hit) => (
        <div key={`${hit.row}-${hit.col}`} className={`fx-soul-slice__hit fx-soul-slice__hit--c${hit.col}`}>
          <div className="fx-soul-slice__hit-burst">
            <Particles count={10} className="fx-soul-slice__hit-spark" />
          </div>
          <div className="fx-soul-slice__hit-ring" />
          <div className="fx-soul-slice__hit-ring fx-soul-slice__hit-ring--2" />
          <div className="fx-soul-slice__hit-splash" />
          <span className="fx-soul-slice__hit-name">{hit.name}</span>
          <span className="fx-soul-slice__hit-dmg">SLICED</span>
        </div>
      ))}
    </div>
  )
}

/* ─── Ice Cream — frost wave + rolling cone (lane freeze) ─── */
function IceCreamLaneFx({ row, targets }: { row: number; targets: Target[] }) {
  return (
    <div className={`board-vfx board-vfx--lane ${rowClass(row)} fx-ice-cream-lane`}>
      <div className="fx-ice-cream-lane__dim" />
      <div className="fx-ice-cream-lane__vignette" />
      <div className="fx-ice-cream-lane__cold-mist" />
      <div className="fx-ice-cream-lane__cold-mist fx-ice-cream-lane__cold-mist--2" />
      <div className="fx-ice-cream-lane__wave" />
      <div className="fx-ice-cream-lane__wave fx-ice-cream-lane__wave--2" />
      <div className="fx-ice-cream-lane__wave fx-ice-cream-lane__wave--3" />
      <div className="fx-ice-cream-lane__syrup" />
      <div className="fx-ice-cream-lane__syrup fx-ice-cream-lane__syrup--2" />

      <div className="fx-ice-cream-lane__cone-rig">
        <div className="fx-ice-cream-lane__cone-trail" />
        <div className="fx-ice-cream-lane__cone-trail fx-ice-cream-lane__cone-trail--2" />
        <span className="fx-ice-cream-lane__cone" aria-hidden>
          🍦
        </span>
        <div className="fx-ice-cream-lane__cone-glow" />
      </div>

      <div className="fx-ice-cream-lane__flake-field">
        <Particles count={36} className="fx-ice-cream-lane__flake" />
      </div>
      <div className="fx-ice-cream-lane__flake-field">
        <Particles count={20} className="fx-ice-cream-lane__sparkle" />
      </div>
      <div className="fx-ice-cream-lane__flake-field fx-ice-cream-lane__flake-field--wide">
        <Particles count={14} className="fx-ice-cream-lane__shard" />
      </div>

      {targets.map((hit) => (
        <div
          key={`${hit.row}-${hit.col}`}
          className={`fx-ice-cream-lane__hit fx-ice-cream-lane__hit--c${hit.col}`}
        >
          <div className="fx-ice-cream-lane__hit-dome" />
          <div className="fx-ice-cream-lane__hit-dome fx-ice-cream-lane__hit-dome--inner" />
          <div className="fx-ice-cream-lane__hit-burst">
            <Particles count={12} className="fx-ice-cream-lane__hit-flake" />
          </div>
          <span className="fx-ice-cream-lane__hit-scoop" aria-hidden>
            🍨
          </span>
          <span className="fx-ice-cream-lane__hit-name">{hit.name}</span>
          <span className="fx-ice-cream-lane__hit-dmg">FROST</span>
        </div>
      ))}

      <span className="fx-ice-cream-lane__lane-tag">ICE CREAM</span>
    </div>
  )
}

function SoulSlashArcSvg() {
  const uid = useId()
  const gradMain = `${uid}-slashMain`
  const gradGlow = `${uid}-slashGlow`

  const sparks = Array.from({ length: 12 }, (_, i) => {
    const t = (i + 1) / 13
    const x = 4 + t * 92
    const y = 62 - Math.sin(t * Math.PI) * 50 - t * 8
    return { x, y, i }
  })

  return (
    <svg viewBox="0 0 100 80" className="fx-soul-slash__trail-svg" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradMain} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="20%" stopColor="#7c4dff" />
          <stop offset="50%" stopColor="#fff" />
          <stop offset="80%" stopColor="#b388ff" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <linearGradient id={gradGlow} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(179,136,255,0)" />
          <stop offset="50%" stopColor="rgba(179,136,255,0.5)" />
          <stop offset="100%" stopColor="rgba(124,77,255,0)" />
        </linearGradient>
      </defs>
      <path
        className="fx-soul-slash__trail-path fx-soul-slash__trail-path--aura"
        d="M 0 72 Q 38 6, 100 34"
        fill="none"
        stroke={`url(#${gradGlow})`}
        strokeWidth="18"
        strokeLinecap="round"
      />
      <path
        className="fx-soul-slash__trail-path fx-soul-slash__trail-path--wide"
        d="M 0 68 Q 38 8, 100 38"
        fill="none"
        stroke="rgba(124, 77, 255, 0.45)"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        className="fx-soul-slash__trail-path"
        d="M 2 64 Q 40 12, 98 36"
        fill="none"
        stroke={`url(#${gradMain})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        className="fx-soul-slash__trail-path fx-soul-slash__trail-path--core"
        d="M 4 62 Q 42 14, 96 34"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        className="fx-soul-slash__trail-path fx-soul-slash__trail-path--after"
        d="M 6 66 Q 44 18, 94 40"
        fill="none"
        stroke="rgba(225, 190, 231, 0.55)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {sparks.map(({ x, y, i }) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={1.2 + (i % 3) * 0.3}
          className="fx-soul-slash__trail-spark"
          style={{ '--i': i } as CSSProperties}
        />
      ))}
    </svg>
  )
}

function SoulSlashFx({ row, col, name }: { row: number; col: number; name: string }) {
  return (
    <Slot row={row} col={col} extra="fx-soul-slash">
      <div className="fx-soul-slash__dim" />
      <div className="fx-soul-slash__vignette" />

      <SoulSlashArcSvg />

      <div className="fx-soul-slash__slash-band fx-soul-slash__slash-band--1" />
      <div className="fx-soul-slash__slash-band fx-soul-slash__slash-band--2" />
      <div className="fx-soul-slash__slash-band fx-soul-slash__slash-band--3" />
      <div className="fx-soul-slash__after-swipe" />

      <div className="fx-soul-slash__impact">
        <div className="fx-soul-slash__impact-flash" />
        <div className="fx-soul-slash__impact-ring" />
        <div className="fx-soul-slash__impact-ring fx-soul-slash__impact-ring--2" />
        <div className="fx-soul-slash__wound" />
        <Particles count={20} className="fx-soul-slash__soul-mote" />
        <Particles count={12} className="fx-soul-slash__soul-streak" />
        <Particles count={8} className="fx-soul-slash__soul-shard" />
      </div>

      <span className="fx-soul-slash__tag">SOUL SLASH</span>
      <span className="fx-soul-slash__label">{name}</span>
    </Slot>
  )
}

function DimLayer({ className }: { className: string }) {
  return <div className={className} />
}

function BananaBoomFx({ row, col }: { row: number; col: number }) {
  return (
    <Slot row={row} col={col} extra="fx-banana-boom">
      <DimLayer className="fx-banana-boom__dim" />
      <DimLayer className="fx-banana-boom__vignette" />
      <div className="fx-banana-boom__shockwave" />
      <div className="fx-banana-boom__shockwave fx-banana-boom__shockwave--2" />
      <div className="fx-banana-boom__shockwave fx-banana-boom__shockwave--3" />
      <div className="fx-banana-boom__flash" />
      <div className="fx-banana-boom__flash fx-banana-boom__flash--core" />
      <div className="fx-banana-boom__crater" />
      <div className="fx-banana-boom__banana-rig">
        <div className="fx-banana-boom__banana">🍌</div>
        <div className="fx-banana-boom__banana fx-banana-boom__banana--ghost">🍌</div>
      </div>
      <div className="fx-banana-boom__splat">SPLAT!</div>
      <div className="fx-banana-boom__pow">BOOM!</div>
      <div className="fx-banana-boom__tag">BANANA BOOM</div>
      <Particles count={18} className="fx-banana-boom__peel" />
      <Particles count={20} className="fx-banana-boom__star" />
      <Particles count={12} className="fx-banana-boom__goop" />
      <Particles count={10} className="fx-banana-boom__splatter" />
    </Slot>
  )
}

function BananaPeelFx({ row, col, name }: { row: number; col: number; name: string }) {
  return (
    <Slot row={row} col={col} extra="fx-banana-peel">
      <DimLayer className="fx-banana-peel__dim" />
      <div className="fx-banana-peel__zone" />
      <div className="fx-banana-peel__zone fx-banana-peel__zone--pulse" />
      <div className="fx-banana-peel__hazard-stripe" />
      <div className="fx-banana-peel__peel-rig fx-banana-peel__peel-rig--1">
        <div className="fx-banana-peel__peel">🍌</div>
        <div className="fx-banana-peel__peel-trail" />
      </div>
      <div className="fx-banana-peel__peel-rig fx-banana-peel__peel-rig--2">
        <div className="fx-banana-peel__peel">🍌</div>
      </div>
      <div className="fx-banana-peel__slip">SLIP!</div>
      <div className="fx-banana-peel__debuff-ring" />
      <div className="fx-banana-peel__debuff">½ DMG</div>
      <span className="fx-banana-peel__target">{name}</span>
      <span className="fx-banana-peel__tag">BANANA PEEL</span>
      <Particles count={14} className="fx-banana-peel__dot" />
      <Particles count={8} className="fx-banana-peel__spark" />
    </Slot>
  )
}

function WebPatternSvg() {
  const uid = useId()
  const gradId = `${uid}-webGrad`
  return (
    <svg viewBox="0 0 100 100" className="fx-web__svg" aria-hidden>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(180,180,180,0.05)" />
        </radialGradient>
      </defs>
      {[18, 32, 46].map((r, i) => (
        <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={`rgba(255,255,255,${0.25 - i * 0.05})`} strokeWidth="0.8" className="fx-web__ring-path" style={{ '--i': i } as CSSProperties} />
      ))}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2
        const x2 = 50 + Math.cos(angle) * 48
        const y2 = 50 + Math.sin(angle) * 48
        return (
          <line key={i} x1="50" y1="50" x2={x2} y2={y2} stroke="rgba(255,255,255,0.3)" strokeWidth="0.6" className="fx-web__spoke" style={{ '--i': i } as CSSProperties} />
        )
      })}
      <circle cx="50" cy="50" r="48" fill={`url(#${gradId})`} opacity="0.4" />
    </svg>
  )
}

function WebFx({ row, col }: { row: number; col: number }) {
  return (
    <Slot row={row} col={col} extra="fx-web">
      <DimLayer className="fx-web__dim" />
      <DimLayer className="fx-web__vignette" />
      <WebPatternSvg />
      <div className="fx-web__net" />
      <div className="fx-web__net fx-web__net--2" />
      <div className="fx-web__cocoon" />
      <div className="fx-web__silk" />
      <div className="fx-web__spider-rig">
        <div className="fx-web__thread" />
        <div className="fx-web__spider">🕷</div>
      </div>
      <div className="fx-web__strands">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="fx-web__strand" style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <Particles count={10} className="fx-web__mote" />
      <span className="fx-web__text">WEBBED</span>
    </Slot>
  )
}

function InfectFx({ row, col }: { row: number; col: number }) {
  return (
    <Slot row={row} col={col} extra="fx-infect">
      <DimLayer className="fx-infect__dim" />
      <DimLayer className="fx-infect__vignette" />
      <div className="fx-infect__cloud" />
      <div className="fx-infect__cloud fx-infect__cloud--2" />
      <div className="fx-infect__cloud fx-infect__cloud--3" />
      <div className="fx-infect__veins" />
      <div className="fx-infect__skull-rig">
        <div className="fx-infect__skull-aura" />
        <div className="fx-infect__skull">☠</div>
      </div>
      <Particles count={16} className="fx-infect__bubble" />
      <Particles count={12} className="fx-infect__drip" />
      <Particles count={10} className="fx-infect__spore" />
      <span className="fx-infect__text">INFECTED</span>
    </Slot>
  )
}

function IceCrystalSvg() {
  return (
    <svg viewBox="0 0 40 50" className="fx-freeze__crystal-svg" aria-hidden>
      <defs>
        <linearGradient id="iceCrystal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="50%" stopColor="#4fc3f7" />
          <stop offset="100%" stopColor="#0288d1" />
        </linearGradient>
      </defs>
      <polygon points="20,2 38,48 2,48" fill="url(#iceCrystal)" stroke="#fff" strokeWidth="1" opacity="0.9" />
    </svg>
  )
}

function FreezeFx({ row, col, name }: { row: number; col: number; name: string }) {
  return (
    <Slot row={row} col={col} extra="fx-freeze">
      <DimLayer className="fx-freeze__dim" />
      <DimLayer className="fx-freeze__vignette" />
      <div className="fx-freeze__surge" />
      <div className="fx-freeze__surge fx-freeze__surge--2" />
      <div className="fx-freeze__shell" />
      <div className="fx-freeze__shell fx-freeze__shell--inner" />
      <div className="fx-freeze__shell fx-freeze__shell--shard" />
      <div className="fx-freeze__frost-bg" />
      <div className="fx-freeze__crack" />
      <div className="fx-freeze__crack fx-freeze__crack--2" />
      <div className="fx-freeze__crystal-field">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="fx-freeze__crystal-wrap" style={{ '--i': i } as CSSProperties}>
            <IceCrystalSvg />
          </div>
        ))}
      </div>
      <Particles count={24} className="fx-freeze__crystal" />
      <Particles count={14} className="fx-freeze__snow" />
      <Particles count={8} className="fx-freeze__mist" />
      <span className="fx-freeze__text">FROZEN</span>
      <span className="fx-freeze__target">{name}</span>
      <span className="fx-freeze__tag">ICE SURGE</span>
    </Slot>
  )
}

function BurnFx({ row, col }: { row: number; col: number }) {
  return (
    <Slot row={row} col={col} extra="fx-burn">
      <DimLayer className="fx-burn__dim" />
      <DimLayer className="fx-burn__vignette" />
      <div className="fx-burn__heat" />
      <div className="fx-burn__heat fx-burn__heat--core" />
      <div className="fx-burn__ember-base" />
      <Particles count={20} className="fx-burn__flame" />
      <Particles count={14} className="fx-burn__flame fx-burn__flame--inner" />
      <Particles count={16} className="fx-burn__spark" />
      <Particles count={8} className="fx-burn__smoke" />
      <div className="fx-burn__pepper-rig">
        <div className="fx-burn__pepper-glow" />
        <div className="fx-burn__pepper">🌶️</div>
      </div>
      <span className="fx-burn__text">BURN!</span>
      <span className="fx-burn__tag">PEPPER</span>
    </Slot>
  )
}

function TreeFx({ row, col }: { row: number; col: number }) {
  return (
    <Slot row={row} col={col} extra="fx-tree">
      <DimLayer className="fx-tree__dim" />
      <DimLayer className="fx-tree__vignette" />
      <div className="fx-tree__fog" />
      <div className="fx-tree__roots" />
      <div className="fx-tree__roots fx-tree__roots--2" />
      <div className="fx-tree__canopy-rig">
        <div className="fx-tree__canopy-glow" />
        <div className="fx-tree__canopy">🌳</div>
      </div>
      <div className="fx-tree__vine fx-tree__vine--top" />
      <div className="fx-tree__vine fx-tree__vine--right" />
      <div className="fx-tree__vine fx-tree__vine--bottom" />
      <div className="fx-tree__vine fx-tree__vine--left" />
      <div className="fx-tree__leaves">
        <Particles count={18} className="fx-tree__leaf" />
      </div>
      <Particles count={10} className="fx-tree__pollen" />
      <span className="fx-tree__text">OBSCURED</span>
      <span className="fx-tree__tag">TREE</span>
    </Slot>
  )
}

function TornadoFx({
  from,
  to,
}: {
  from: { row: number; col: number; name: string }
  to: { row: number; col: number; name: string }
}) {
  return (
    <div className="board-vfx board-vfx--full fx-tornado">
      <DimLayer className="fx-tornado__dim" />
      <DimLayer className="fx-tornado__vignette" />

      <div className={`fx-tornado__origin ${slotClass(from.row, from.col)}`}>
        <div className="fx-tornado__funnel" />
        <div className="fx-tornado__funnel fx-tornado__funnel--2" />
        <div className="fx-tornado__eye">🌪</div>
        <Particles count={22} className="fx-tornado__debris" />
      </div>

      <div className={`fx-tornado__lift ${slotClass(from.row, from.col)}`}>
        <span className="fx-tornado__lift-name">{from.name}</span>
      </div>

      <div className={`fx-tornado__landing ${slotClass(to.row, to.col)}`}>
        <div className="fx-tornado__impact-ring" />
        <div className="fx-tornado__impact-ring fx-tornado__impact-ring--2" />
        <Particles count={18} className="fx-tornado__dust" />
      </div>

      <span className="fx-tornado__tag">TORNADO</span>
      <span className="fx-tornado__label">{from.name} relocated</span>
    </div>
  )
}

function DoubleTroubleFx({ row, col, name }: { row: number; col: number; name: string }) {
  return (
    <Slot row={row} col={col} extra="fx-double">
      <DimLayer className="fx-double__dim" />
      <DimLayer className="fx-double__vignette" />
      <div className="fx-double__flash" />
      <div className="fx-double__echo" />
      <div className="fx-double__echo fx-double__echo--2" />
      <div className="fx-double__strike" />
      <div className="fx-double__strike fx-double__strike--2" />
      <div className="fx-double__strike fx-double__strike--3" />
      <div className="fx-double__x2-rig">
        <div className="fx-double__x2-glow" />
        <div className="fx-double__x2">×2</div>
      </div>
      <div className="fx-double__ring" />
      <div className="fx-double__ring fx-double__ring--2" />
      <Particles count={16} className="fx-double__spark" />
      <Particles count={8} className="fx-double__shard" />
      <span className="fx-double__name">{name}</span>
      <span className="fx-double__tag">DOUBLE STRIKE</span>
    </Slot>
  )
}

function DeployFx({ row, col, name }: { row: number; col: number; name: string }) {
  return (
    <Slot row={row} col={col} extra="fx-deploy">
      <DimLayer className="fx-deploy__dim" />
      <div className="fx-deploy__ground" />
      <div className="fx-deploy__portal" />
      <div className="fx-deploy__portal fx-deploy__portal--2" />
      <div className="fx-deploy__portal fx-deploy__portal--3" />
      <div className="fx-deploy__beam" />
      <div className="fx-deploy__beam fx-deploy__beam--core" />
      <div className="fx-deploy__runes">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="fx-deploy__rune" style={{ '--i': i } as CSSProperties}>✦</span>
        ))}
      </div>
      <Particles count={18} className="fx-deploy__spark" />
      <Particles count={10} className="fx-deploy__mote" />
      <span className="fx-deploy__name">{name}</span>
      <span className="fx-deploy__tag">DEPLOY</span>
    </Slot>
  )
}

function ShardStrikeFx({ row, col }: { row: number; col: number }) {
  return (
    <Slot row={row} col={col} extra="fx-shard-strike">
      <DimLayer className="fx-shard-strike__dim" />
      <DimLayer className="fx-shard-strike__vignette" />
      <div className="fx-shard-strike__beam" />
      <div className="fx-shard-strike__beam fx-shard-strike__beam--core" />
      <div className="fx-shard-strike__prism" />
      <div className="fx-shard-strike__prism fx-shard-strike__prism--2" />
      <div className="fx-shard-strike__prism fx-shard-strike__prism--3" />
      <div className="fx-shard-strike__flash" />
      <div className="fx-shard-strike__ring" />
      <div className="fx-shard-strike__ring fx-shard-strike__ring--2" />
      <Particles count={24} className="fx-shard-strike__shard" />
      <Particles count={12} className="fx-shard-strike__bit" />
      <span className="fx-shard-strike__text">2× SHARD</span>
    </Slot>
  )
}

function GenericHitFx({ row, col }: { row: number; col: number }) {
  return (
    <Slot row={row} col={col} extra="fx-hit">
      <DimLayer className="fx-hit__dim" />
      <div className="fx-hit__flash" />
      <div className="fx-hit__flash fx-hit__flash--core" />
      <div className="fx-hit__ring" />
      <div className="fx-hit__ring fx-hit__ring--2" />
      <div className="fx-hit__slash" />
      <div className="fx-hit__slash fx-hit__slash--2" />
      <Particles count={14} className="fx-hit__bit" />
      <Particles count={8} className="fx-hit__spark" />
    </Slot>
  )
}
