import type { CSSProperties, ReactNode } from 'react'
import type { VfxEvent } from '../../game/types'
import { VFX_DURATIONS } from './vfxConfig'
import './ScreenVfx.css'
import './SpecialScreenVfx.css'

interface ScreenVfxProps {
  events: VfxEvent[]
  onDone: (id: string) => void
}

export function ScreenVfx({ events, onDone }: ScreenVfxProps) {
  if (events.length === 0) return null

  return (
    <div className="screen-vfx">
      {events.map((event) => (
        <ScreenVfxItem key={event.id} event={event} onDone={() => onDone(event.id)} />
      ))}
    </div>
  )
}

function ScreenVfxItem({ event, onDone }: { event: VfxEvent; onDone: () => void }) {
  const duration = VFX_DURATIONS[event.vfx] ?? 2000
  const isGamble = event.vfx === 'gamble' || event.vfx === 'gamble_heads' || event.vfx === 'gamble_tails'

  return (
    <div
      className={`screen-vfx__item screen-vfx__item--${event.vfx} screen-vfx__item--p${event.playerId ?? 0}${isGamble ? ' screen-vfx__item--gamble' : ''}`}
      style={{ '--dur': `${duration}ms` } as CSSProperties}
      onAnimationEnd={(e) => {
        if (e.animationName === 'screen-vfx-fade' || e.animationName === 'screen-vfx-fade-gamble') onDone()
      }}
    >
      {renderScreenVfx(event)}
      <div className="screen-vfx__banner">
        <span className="screen-vfx__title">{event.vfx.replace(/_/g, ' ')}</span>
        <span className="screen-vfx__msg">{event.message}</span>
      </div>
    </div>
  )
}

function renderScreenVfx(event: VfxEvent): ReactNode {
  switch (event.vfx) {
    case 'shard':
    case 'shard_consume':
      return (
        <div className="fx-screen-shard">
          <div className="fx-screen-shard__dim" />
          <div className="fx-screen-shard__aura" />
          <div className="fx-screen-shard__aura fx-screen-shard__aura--2" />
          <div className="fx-screen-shard__beam" />
          <div className="fx-screen-shard__prism" />
          <div className="fx-screen-shard__prism fx-screen-shard__prism--2" />
          <div className="fx-screen-shard__prism fx-screen-shard__prism--3" />
          <div className="fx-screen-shard__ring" />
          <div className="fx-screen-shard__ring fx-screen-shard__ring--2" />
          {Array.from({ length: 32 }).map((_, i) => (
            <span key={i} className="fx-screen-shard__bit" style={{ '--i': i } as CSSProperties} />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={`s-${i}`} className="fx-screen-shard__streak" style={{ '--i': i } as CSSProperties} />
          ))}
          <span className="fx-screen-shard__label">2×</span>
          <span className="fx-screen-shard__tag">SHARD</span>
        </div>
      )
    case 'double_trouble':
    case 'double_trouble_ready':
      return (
        <div className="fx-screen-double">
          <div className="fx-screen-double__dim" />
          <div className="fx-screen-double__flash" />
          <div className="fx-screen-double__clone" />
          <div className="fx-screen-double__clone fx-screen-double__clone--2" />
          <div className="fx-screen-double__clone fx-screen-double__clone--echo" />
          <div className="fx-screen-double__slash" />
          <div className="fx-screen-double__slash fx-screen-double__slash--2" />
          <span className="fx-screen-double__x2">×2</span>
          <span className="fx-screen-double__tag">DOUBLE TROUBLE</span>
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="fx-screen-double__bolt" style={{ '--i': i } as CSSProperties} />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={`p-${i}`} className="fx-screen-double__spark" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )
    case 'trade':
    case 'trade_damage':
      return (
        <div className="fx-screen-trade fx-screen-trade--damage">
          <div className="fx-screen-trade__dim" />
          <div className="fx-screen-trade__aura" />
          <div className="fx-screen-trade__scales">⚖</div>
          <div className="fx-screen-trade__fire">🔥</div>
          <div className="fx-screen-trade__fire fx-screen-trade__fire--2">🔥</div>
          <span className="fx-screen-trade__pct">1.5×</span>
          <span className="fx-screen-trade__tag">DAMAGE PACT</span>
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="fx-screen-trade__ember" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )
    case 'trade_cooldown':
      return (
        <div className="fx-screen-trade fx-screen-trade--cd">
          <div className="fx-screen-trade__dim" />
          <div className="fx-screen-trade__aura fx-screen-trade__aura--cd" />
          <div className="fx-screen-trade__clock">⏱</div>
          <div className="fx-screen-trade__gear">⚙</div>
          <span className="fx-screen-trade__pct">−1 CD</span>
          <span className="fx-screen-trade__tag">COOLDOWN PACT</span>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="fx-screen-trade__tick" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )
    case 'soul_revive':
      return (
        <div className="fx-screen-revive">
          <div className="fx-screen-revive__dim" />
          <div className="fx-screen-revive__light" />
          <div className="fx-screen-revive__light fx-screen-revive__light--2" />
          <div className="fx-screen-revive__beam" />
          <div className="fx-screen-revive__ghost">👻</div>
          <div className="fx-screen-revive__hands">🙌</div>
          <div className="fx-screen-revive__ring" />
          <span className="fx-screen-revive__tag">SOUL REVIVE</span>
          {Array.from({ length: 28 }).map((_, i) => (
            <span key={i} className="fx-screen-revive__mote" style={{ '--i': i } as CSSProperties} />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={`w-${i}`} className="fx-screen-revive__wisp" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )
    case 'quantity':
      return (
        <div className="fx-screen-quantity">
          <div className="fx-screen-quantity__dim" />
          <div className="fx-screen-quantity__glow" />
          <div className="fx-screen-quantity__card fx-screen-quantity__card--1" />
          <div className="fx-screen-quantity__card fx-screen-quantity__card--2" />
          <div className="fx-screen-quantity__card fx-screen-quantity__card--3" />
          <span className="fx-screen-quantity__num">2×</span>
          <span className="fx-screen-quantity__tag">QUANTITY</span>
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="fx-screen-quantity__plus" style={{ '--i': i } as CSSProperties}>+</span>
          ))}
        </div>
      )
    case 'mirror':
    case 'mirror_reflect':
      return (
        <div className="fx-screen-mirror">
          <div className="fx-screen-mirror__dim" />
          <div className="fx-screen-mirror__glass" />
          <div className="fx-screen-mirror__frame" />
          <div className="fx-screen-mirror__shine" />
          <div className="fx-screen-mirror__shine fx-screen-mirror__shine--2" />
          <span className="fx-screen-mirror__icon">🪞</span>
          <div className="fx-screen-mirror__ripple" />
          <div className="fx-screen-mirror__ripple fx-screen-mirror__ripple--2" />
          <div className="fx-screen-mirror__ripple fx-screen-mirror__ripple--3" />
          <span className="fx-screen-mirror__tag">MIRROR</span>
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="fx-screen-mirror__shard" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )
    case 'spell_book':
      return (
        <div className="fx-screen-spellbook">
          <div className="fx-screen-spellbook__dim" />
          <div className="fx-screen-spellbook__aura" />
          <div className="fx-screen-spellbook__book">
            <div className="fx-screen-spellbook__cover" />
            <div className="fx-screen-spellbook__pages" />
            <div className="fx-screen-spellbook__rune">✦</div>
          </div>
          <div className="fx-screen-spellbook__card fx-screen-spellbook__card--out">📖</div>
          <div className="fx-screen-spellbook__card fx-screen-spellbook__card--in">🃏</div>
          <div className="fx-screen-spellbook__swap-ring" />
          {Array.from({ length: 20 }).map((_, i) => (
            <span key={i} className="fx-screen-spellbook__spark" style={{ '--i': i } as CSSProperties} />
          ))}
          <span className="fx-screen-spellbook__tag">SPELL BOOK</span>
        </div>
      )
    case 'caffeinated':
      return (
        <div className="fx-screen-caffeine">
          <div className="fx-screen-caffeine__dim" />
          <div className="fx-screen-caffeine__pulse fx-screen-caffeine__pulse--1" />
          <div className="fx-screen-caffeine__pulse fx-screen-caffeine__pulse--2" />
          <div className="fx-screen-caffeine__cup">
            <div className="fx-screen-caffeine__liquid" />
            <div className="fx-screen-caffeine__steam" />
            <div className="fx-screen-caffeine__steam fx-screen-caffeine__steam--2" />
            <div className="fx-screen-caffeine__steam fx-screen-caffeine__steam--3" />
          </div>
          <span className="fx-screen-caffeine__bolt">⚡</span>
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="fx-screen-caffeine__drop" style={{ '--i': i } as CSSProperties} />
          ))}
          <span className="fx-screen-caffeine__tag">CAFFEINATED</span>
          <span className="fx-screen-caffeine__sub">CD −1 for 3 rounds</span>
        </div>
      )
    case 'chain_locked':
      return (
        <div className="fx-screen-chain">
          <div className="fx-screen-chain__dim" />
          <div className="fx-screen-chain__vault" />
          <div className="fx-screen-chain__chain fx-screen-chain__chain--1" />
          <div className="fx-screen-chain__chain fx-screen-chain__chain--2" />
          <div className="fx-screen-chain__lock">🔒</div>
          <div className="fx-screen-chain__seal" />
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="fx-screen-chain__link" style={{ '--i': i } as CSSProperties} />
          ))}
          <span className="fx-screen-chain__tag">CHAIN LOCKED</span>
        </div>
      )
    case 'thorn_mail':
      return (
        <div className="fx-screen-thorn-mail">
          <div className="fx-screen-thorn-mail__dim" />
          <span className="fx-screen-thorn-mail__icon">🛡️</span>
          <span className="fx-screen-thorn-mail__spike">⚡</span>
          <span className="fx-screen-thorn-mail__spike fx-screen-thorn-mail__spike--2">⚡</span>
          <span className="fx-screen-thorn-mail__tag">THORN MAIL</span>
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="fx-screen-thorn-mail__mote" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )
    case 'regrowth':
      return (
        <div className="fx-screen-regrowth">
          <div className="fx-screen-regrowth__dim" />
          <div className="fx-screen-regrowth__glow" />
          <span className="fx-screen-regrowth__tree">🌱</span>
          <span className="fx-screen-regrowth__leaf">🍃</span>
          <span className="fx-screen-regrowth__leaf fx-screen-regrowth__leaf--2">🍃</span>
          <span className="fx-screen-regrowth__tag">REGROWTH</span>
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="fx-screen-regrowth__mote" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )
    case 'gamble':
    case 'gamble_heads':
      return (
        <div className="fx-screen-gamble fx-screen-gamble--heads">
          <div className="fx-screen-gamble__dim" />
          <span className="fx-screen-gamble__coin">🪙</span>
          <span className="fx-screen-gamble__result">HEADS</span>
          <span className="fx-screen-gamble__mult">2×</span>
          <span className="fx-screen-gamble__tag">GAMBLE</span>
        </div>
      )
    case 'gamble_tails':
      return (
        <div className="fx-screen-gamble fx-screen-gamble--tails">
          <div className="fx-screen-gamble__dim" />
          <span className="fx-screen-gamble__coin">🪙</span>
          <span className="fx-screen-gamble__result">TAILS</span>
          <span className="fx-screen-gamble__mult">½</span>
          <span className="fx-screen-gamble__tag">GAMBLE</span>
        </div>
      )
    case 'cannon':
      return (
        <div className="fx-screen-cannon">
          <div className="fx-screen-cannon__dim" />
          <div className="fx-screen-cannon__flash" />
          <div className="fx-screen-cannon__smoke" />
          <div className="fx-screen-cannon__smoke fx-screen-cannon__smoke--2" />
          <span className="fx-screen-cannon__barrel">💣</span>
          <span className="fx-screen-cannon__ball">🔥</span>
          <div className="fx-screen-cannon__shockwave" />
          <div className="fx-screen-cannon__shockwave fx-screen-cannon__shockwave--2" />
          <span className="fx-screen-cannon__dmg">75</span>
          <span className="fx-screen-cannon__tag">CANNON</span>
          {Array.from({ length: 36 }).map((_, i) => (
            <span key={i} className="fx-screen-cannon__debris" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )
    case 'cobweb':
      return (
        <div className="fx-screen-cobweb">
          <div className="fx-screen-cobweb__dim" />
          <div className="fx-screen-cobweb__web fx-screen-cobweb__web--1" />
          <div className="fx-screen-cobweb__web fx-screen-cobweb__web--2" />
          <div className="fx-screen-cobweb__web fx-screen-cobweb__web--3" />
          <span className="fx-screen-cobweb__spider">🕷️</span>
          <span className="fx-screen-cobweb__tag">COBWEB</span>
          {Array.from({ length: 28 }).map((_, i) => (
            <span key={i} className="fx-screen-cobweb__strand" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )
    case 'ice_cream':
      return (
        <div className="fx-screen-ice-cream">
          <div className="fx-screen-ice-cream__dim" />
          <div className="fx-screen-ice-cream__frost" />
          <div className="fx-screen-ice-cream__frost fx-screen-ice-cream__frost--2" />
          <span className="fx-screen-ice-cream__cone">🍦</span>
          <span className="fx-screen-ice-cream__snow">❄️</span>
          <span className="fx-screen-ice-cream__snow fx-screen-ice-cream__snow--2">❄️</span>
          <span className="fx-screen-ice-cream__tag">ICE CREAM</span>
          {Array.from({ length: 32 }).map((_, i) => (
            <span key={i} className="fx-screen-ice-cream__flake" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )
    case 'clock':
      return (
        <div className="fx-screen-clock">
          <div className="fx-screen-clock__dim" />
          <div className="fx-screen-clock__pulse" />
          <div className="fx-screen-clock__ring" />
          <div className="fx-screen-clock__ring fx-screen-clock__ring--2" />
          <span className="fx-screen-clock__face">🕰️</span>
          <span className="fx-screen-clock__gear">⚙️</span>
          <span className="fx-screen-clock__gear fx-screen-clock__gear--2">⚙️</span>
          <span className="fx-screen-clock__tag">TIME STOP</span>
          {Array.from({ length: 20 }).map((_, i) => (
            <span key={i} className="fx-screen-clock__tick" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )
    case 'pickpocket':
      return (
        <div className="fx-screen-pickpocket">
          <div className="fx-screen-pickpocket__dim" />
          <div className="fx-screen-pickpocket__smoke" />
          <span className="fx-screen-pickpocket__hand">🤏</span>
          <span className="fx-screen-pickpocket__card">🃏</span>
          <span className="fx-screen-pickpocket__card fx-screen-pickpocket__card--stolen">🃏</span>
          <div className="fx-screen-pickpocket__trail" />
          <span className="fx-screen-pickpocket__tag">PICKPOCKET</span>
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="fx-screen-pickpocket__spark" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )
    default:
      return (
        <div className="fx-screen-default">
          <div className="fx-screen-default__dim" />
          <div className="fx-screen-default__ring" />
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="fx-screen-default__spark" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      )
  }
}
