import { forwardRef, useEffect, useState } from 'react'
import type { BoardSlot, VfxEvent } from '../game/types'
import { getTemplate } from '../game/cards'
import { get2x2AoESlots, getPlusAoESlots, isTargetBlockedByCharacter } from '../game/status'
import { BoardVfxLayer } from './vfx/BoardVfxLayer'
import './Board.css'

interface BoardProps {
  slots: BoardSlot[]
  playerId: 1 | 2
  label: string
  targeting?: boolean
  laneTargeting?: boolean
  aoeTargeting?: boolean
  explosiveTargeting?: boolean
  columnTargeting?: boolean
  allyTargeting?: boolean
  treeTargeting?: boolean
  lineOfSightAttackerId?: 1 | 2
  boardVfx?: VfxEvent[]
  onBoardVfxDone?: (id: string) => void
  onSlotClick: (row: number, col: number) => void
}

export const Board = forwardRef<HTMLDivElement, BoardProps>(function Board(
  {
  slots,
  playerId,
  label,
  targeting,
  laneTargeting,
  aoeTargeting,
  explosiveTargeting,
  columnTargeting,
  allyTargeting,
  treeTargeting,
  lineOfSightAttackerId,
  boardVfx = [],
  onBoardVfxDone,
  onSlotClick,
  },
  ref,
) {
  const rows = [0, 1, 2, 3]
  const cols = [0, 1]
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [hoveredAoe, setHoveredAoe] = useState<{ row: number; col: number } | null>(null)
  const [hoveredCol, setHoveredCol] = useState<number | null>(null)

  const aoePreviewSlots = hoveredAoe ? getPlusAoESlots(hoveredAoe.row, hoveredAoe.col) : []
  const explosivePreviewSlots = hoveredAoe ? get2x2AoESlots(hoveredAoe.row) : []
  const columnPreviewSlots =
    hoveredCol != null
      ? [0, 1, 2, 3].map((row) => ({ row, col: hoveredCol }))
      : []

  const previewSlots = explosiveTargeting
    ? explosivePreviewSlots
    : columnTargeting
      ? columnPreviewSlots
      : aoePreviewSlots

  const isInAoePreview = (row: number, col: number) =>
    previewSlots.some((s) => s.row === row && s.col === col)

  const isAoeCenter = (row: number, col: number) =>
    explosiveTargeting
      ? previewSlots.some((s) => s.row === row && s.col === col)
      : hoveredAoe?.row === row && hoveredAoe?.col === col

  const activeLaneRow =
    boardVfx.find(
      (v) =>
        v.laneRow != null &&
        (v.vfx === 'soul_slice' || v.vfx === 'boulder_roll' || v.vfx === 'redliner_shot'),
    )?.laneRow ?? null

  useEffect(() => {
    if (!laneTargeting) setHoveredRow(null)
  }, [laneTargeting])

  useEffect(() => {
    if (!aoeTargeting && !explosiveTargeting) setHoveredAoe(null)
  }, [aoeTargeting, explosiveTargeting])

  useEffect(() => {
    if (!columnTargeting) setHoveredCol(null)
  }, [columnTargeting])

  return (
    <div ref={ref} className={`board board--p${playerId}${targeting ? ' board--targeting' : ''}`}>
      <h3 className="board__label">{label}</h3>
      {laneTargeting && (
        <p className="board__lane-hint">Hover a row — entire lane glows</p>
      )}
      {treeTargeting && (
        <p className="board__lane-hint">Click an empty slot</p>
      )}
      {explosiveTargeting && (
        <p className="board__lane-hint">Hover to preview 2×2 blast — click to detonate</p>
      )}
      {columnTargeting && (
        <p className="board__lane-hint">Hover a column — wind sweeps upward</p>
      )}
      {aoeTargeting && (
        <p className="board__lane-hint">Hover to preview + blast — click to fire</p>
      )}
      <div className="board__grid">
        {rows.map((row) => {
          const rowAttackGlow = activeLaneRow === row

          return (
            <div
              key={row}
              className={`board__row${hoveredRow === row && laneTargeting ? ' board__row--lane-hover' : ''}${rowAttackGlow ? ' board__row--lane-strike' : ''}`}
              onMouseEnter={() => laneTargeting && setHoveredRow(row)}
              onMouseLeave={() => laneTargeting && setHoveredRow(null)}
            >
              <div className="board__row-glow" aria-hidden />
              {cols.map((col) => {
                const slot = slots.find((s) => s.row === row && s.col === col)!
                const char = slot.character
                const template = char ? getTemplate(char.card.templateId) : null
                const hpPercent = char ? (char.currentHealth / char.maxHealth) * 100 : 0
                const obscured = slot.obscured != null

                const inAoePreview = (aoeTargeting || explosiveTargeting || columnTargeting) && isInAoePreview(row, col)
                const isPlusCenter =
                  aoeTargeting && hoveredAoe?.row === row && hoveredAoe?.col === col
                const aoeCenter =
                  isPlusCenter ||
                  ((explosiveTargeting || columnTargeting) && isAoeCenter(row, col))
                const willBeHit = inAoePreview && !!char

                const blockedByLineOfSight =
                  targeting &&
                  char &&
                  lineOfSightAttackerId != null &&
                  isTargetBlockedByCharacter(slots, row, col, lineOfSightAttackerId, playerId)

                const isTargetable =
                  ((targeting && char && !blockedByLineOfSight) ||
                    aoeTargeting ||
                    explosiveTargeting ||
                    columnTargeting ||
                    (allyTargeting && char) ||
                    (treeTargeting && !char && !obscured))

                return (
                  <button
                    key={`${row}-${col}`}
                    type="button"
                    className={`board__slot${char ? ' board__slot--filled' : ''}${obscured ? ' board__slot--obscured' : ''}${isTargetable ? ' board__slot--targetable' : ''}${blockedByLineOfSight ? ' board__slot--blocked' : ''}${inAoePreview ? ' board__slot--aoe-preview' : ''}${willBeHit ? ' board__slot--aoe-will-hit' : ''}${aoeCenter ? ' board__slot--aoe-center' : ''}`}
                    onMouseEnter={() => {
                      if (laneTargeting) setHoveredRow(row)
                      if (aoeTargeting || explosiveTargeting) setHoveredAoe({ row, col })
                      if (columnTargeting) setHoveredCol(col)
                    }}
                    onMouseLeave={() => {
                      if (laneTargeting) setHoveredRow(null)
                      if (aoeTargeting || explosiveTargeting) setHoveredAoe(null)
                      if (columnTargeting) setHoveredCol(null)
                    }}
                    onClick={() => onSlotClick(row, col)}
                  >
                    {obscured && !char && <span className="board__tree">🌲</span>}
                    {char && template && willBeHit && (
                      <span className="board__aoe-hit-tag">HIT</span>
                    )}
                    {char && template ? (
                      <div className="board__character">
                        <span className="board__char-name">{template.name}</span>
                        <div className="board__hp-bar">
                          <div className="board__hp-fill" style={{ width: `${hpPercent}%` }} />
                        </div>
                        <span className="board__hp-text">
                          {char.currentHealth}/{char.maxHealth}
                        </span>
                        {char.statuses.length > 0 && (
                          <div className="board__status-dots">
                            {char.statuses.map((s) => (
                              <span key={s.type} className={`dot dot--${s.type}`} title={s.type} />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : !obscured ? (
                      <span className="board__empty">+</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )
        })}
        {(aoeTargeting || explosiveTargeting || columnTargeting) && (hoveredAoe || hoveredCol != null) && (
          <div className="board__aoe-overlay" aria-hidden>
            {previewSlots.map(({ row: r, col: c }) => (
              <div
                key={`aoe-${r}-${c}`}
                className={`board__aoe-cell board__aoe-cell--${r}-${c}${explosiveTargeting ? ' board__aoe-cell--explosive' : ''}${columnTargeting ? ' board__aoe-cell--column' : ''}${aoeTargeting ? ' board__aoe-cell--plus' : ''}${aoeTargeting && hoveredAoe?.row === r && hoveredAoe?.col === c ? ' board__aoe-cell--center' : ''}`}
              />
            ))}
            {aoeTargeting && hoveredAoe && (
              <div className={`board__aoe-cross board__aoe-cross--${hoveredAoe.row}-${hoveredAoe.col}`} />
            )}
          </div>
        )}
        <BoardVfxLayer events={boardVfx} onDone={onBoardVfxDone} />
      </div>
    </div>
  )
})
