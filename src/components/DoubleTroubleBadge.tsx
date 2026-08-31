import './DoubleTroubleBadge.css'

interface DoubleTroubleBadgeProps {
  active?: boolean
}

export function DoubleTroubleBadge({ active }: DoubleTroubleBadgeProps) {
  if (!active) return null

  return (
    <div className="double-trouble-badge" aria-label="Double Trouble active — next attack hits twice">
      <span className="double-trouble-badge__glow" aria-hidden />
      <span className="double-trouble-badge__ring" aria-hidden />
      <span className="double-trouble-badge__label">2×</span>
      <span className="double-trouble-badge__text">DOUBLE TROUBLE</span>
    </div>
  )
}
