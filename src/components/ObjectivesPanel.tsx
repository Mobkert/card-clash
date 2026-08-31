import type { PlayerObjective } from '../game/types'
import './ObjectivesPanel.css'

interface ObjectivesPanelProps {
  objectives: PlayerObjective[]
  side: 'left' | 'right'
  compact?: boolean
  showRaceHint?: boolean
}

export function ObjectivesPanel({ objectives, side, compact = false, showRaceHint = false }: ObjectivesPanelProps) {
  if (objectives.length === 0) return null

  return (
    <aside
      className={`objectives-panel objectives-panel--${side}${compact ? ' objectives-panel--compact' : ''}`}
      aria-label="Match objectives"
    >
      <h3 className="objectives-panel__title">Objectives</h3>
      {showRaceHint && (
        <p className="objectives-panel__race-hint">First to complete all three wins the match.</p>
      )}
      <ul className="objectives-panel__list">
        {objectives.map((obj) => {
          const pct = obj.target > 0 ? Math.round((obj.progress / obj.target) * 100) : 0
          return (
            <li
              key={obj.id}
              className={`objectives-panel__item${obj.completed ? ' objectives-panel__item--done' : ''}`}
            >
              <span className="objectives-panel__label">{obj.label}</span>
              <div className="objectives-panel__bar-wrap">
                <div className="objectives-panel__bar" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <span className="objectives-panel__progress">
                {obj.progress}/{obj.target}
                {obj.completed ? ' ✓' : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
