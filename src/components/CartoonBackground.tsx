import type { CSSProperties } from 'react'
import type { PlayTheme } from '../theme/playTheme'
import { themeStyle } from '../theme/playTheme'
import './CartoonBackground.css'

function Cloud({ className, style }: { className: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 200 80" className={className} style={style} aria-hidden>
      <ellipse cx="60" cy="48" rx="52" ry="28" fill="currentColor" />
      <ellipse cx="105" cy="38" rx="44" ry="32" fill="currentColor" />
      <ellipse cx="145" cy="50" rx="40" ry="24" fill="currentColor" />
      <ellipse cx="88" cy="52" rx="36" ry="22" fill="currentColor" />
    </svg>
  )
}

function Hill({
  className,
  d,
  fill,
}: {
  className: string
  d: string
  fill: string
}) {
  return (
    <svg viewBox="0 0 1200 200" preserveAspectRatio="none" className={className} aria-hidden>
      <path d={d} fill={fill} stroke="#1a1030" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  )
}

const CLOUD_SLOTS = [
  { top: '8%', left: '-4%', width: 220, opacity: 0.92, reverse: false, delay: '0s' },
  { top: '16%', left: '55%', width: 180, opacity: 0.78, reverse: true, delay: '-12s' },
  { top: '4%', left: '28%', width: 150, opacity: 0.65, reverse: false, delay: '-6s' },
  { top: '22%', left: '78%', width: 140, opacity: 0.7, reverse: true, delay: '-8s' },
  { top: '12%', left: '38%', width: 160, opacity: 0.6, reverse: false, delay: '-4s' },
  { top: '26%', left: '12%', width: 130, opacity: 0.55, reverse: true, delay: '-10s' },
] as const

interface CartoonBackgroundProps {
  theme: PlayTheme
}

export function CartoonBackground({ theme }: CartoonBackgroundProps) {
  const clouds = CLOUD_SLOTS.slice(0, theme.cloudCount)

  return (
    <div className="cartoon-bg" style={themeStyle(theme)} aria-hidden>
      <div className="cartoon-bg__sky" />
      <div className="cartoon-bg__aurora" />

      {theme.showSun && (
        <div className="cartoon-bg__sun">
          <div className="cartoon-bg__sun-core" />
          <div className="cartoon-bg__sun-rays" />
        </div>
      )}

      {theme.showMoon && (
        <div className="cartoon-bg__moon">
          <div className="cartoon-bg__moon-core" />
        </div>
      )}

      <div className="cartoon-bg__stars">
        {Array.from({ length: theme.starCount }).map((_, i) => (
          <span key={i} className="cartoon-bg__star" style={{ '--i': i } as CSSProperties} />
        ))}
      </div>

      {clouds.map((slot, i) => (
        <Cloud
          key={i}
          className={`cartoon-bg__cloud cartoon-bg__cloud--slot${slot.reverse ? ' cartoon-bg__cloud--reverse' : ''}`}
          style={{
            top: slot.top,
            left: slot.left,
            width: slot.width,
            opacity: slot.opacity,
            animationDuration: i % 2 === 0 ? 'var(--cloud-speed-1)' : 'var(--cloud-speed-2)',
            animationDelay: slot.delay,
          }}
        />
      ))}

      <Hill
        className="cartoon-bg__hill cartoon-bg__hill--back"
        fill="var(--bg-hill-back)"
        d={theme.hillPaths.back}
      />
      <Hill
        className="cartoon-bg__hill cartoon-bg__hill--mid"
        fill="var(--bg-hill-mid)"
        d={theme.hillPaths.mid}
      />
      <Hill
        className="cartoon-bg__hill cartoon-bg__hill--front"
        fill="var(--bg-hill-front)"
        d={theme.hillPaths.front}
      />

      <div className="cartoon-bg__ground">
        <div className="cartoon-bg__ground-stripes" />
        <div className="cartoon-bg__ground-sparkles">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="cartoon-bg__spark" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      </div>

      <div className="cartoon-bg__floaters">
        {theme.floaters.map((symbol, i) => (
          <span key={`${symbol}-${i}`} className={`cartoon-bg__floater cartoon-bg__floater--${i + 1}`}>
            {symbol}
          </span>
        ))}
      </div>

      <div className="cartoon-bg__vignette" />
    </div>
  )
}
