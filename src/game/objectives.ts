import type { GameState, PlayerCount, PlayerId, PlayerObjective, PlayerState } from './types'
import {
  allPlayersPickedObjectives,
  allPlayersSatisfied,
  matchObjectiveCount,
  objectiveDifficultyScale,
  playerIds,
} from './players'

export type ObjectiveTrack =
  | 'eliminations'
  | 'attacks_played'
  | 'specials_played'
  | 'damage_dealt'
  | 'abilities_used'
  | 'chars_placed'

type ObjectiveDef = {
  id: string
  label: string
  target: number
  track: ObjectiveTrack
}

export const OBJECTIVE_POOL: ObjectiveDef[] = [
  { id: 'eliminate_4', label: 'Eliminate 4 enemy characters', target: 4, track: 'eliminations' },
  { id: 'eliminate_3', label: 'Eliminate 3 enemy characters', target: 3, track: 'eliminations' },
  { id: 'play_4_attacks', label: 'Play 4 attack cards', target: 4, track: 'attacks_played' },
  { id: 'play_3_attacks', label: 'Play 3 attack cards', target: 3, track: 'attacks_played' },
  { id: 'play_2_specials', label: 'Play 2 special cards', target: 2, track: 'specials_played' },
  { id: 'deal_180_damage', label: 'Deal 180 total damage', target: 180, track: 'damage_dealt' },
  { id: 'deal_150_damage', label: 'Deal 150 total damage', target: 150, track: 'damage_dealt' },
  { id: 'use_8_abilities', label: 'Use 8 character abilities', target: 8, track: 'abilities_used' },
  { id: 'use_7_abilities', label: 'Use 7 character abilities', target: 7, track: 'abilities_used' },
]

export const OBJECTIVES_INTRO_MS = 20_000
export const OBJECTIVE_REVEAL_ANIM_MS = 4_500

export function objectiveDraftCount(playerCount: PlayerCount): number {
  return playerCount === 3 ? 10 : 8
}

export function createObjectiveFromDef(def: ObjectiveDef, playerCount: PlayerCount = 2): PlayerObjective {
  const scale = objectiveDifficultyScale(playerCount)
  const target = Math.ceil(def.target * scale)
  return {
    id: def.id,
    label: def.label,
    target,
    progress: 0,
    completed: false,
  }
}

export function cloneObjectivesForPlayer(objectives: PlayerObjective[]): PlayerObjective[] {
  return objectives.map((obj) => ({ ...obj, progress: 0, completed: false }))
}

export function emptyObjectiveStats(): PlayerState['objectiveStats'] {
  return {
    eliminations: 0,
    attacks_played: 0,
    specials_played: 0,
    damage_dealt: 0,
    abilities_used: 0,
    chars_placed: 0,
  }
}

function syncObjectiveProgress(objectives: PlayerObjective[], stats: PlayerState['objectiveStats']): PlayerObjective[] {
  return objectives.map((obj) => {
    const def = OBJECTIVE_POOL.find((d) => d.id === obj.id)
    const track = def?.track
    const progress = track ? stats[track] : 0
    const completed = progress >= obj.target
    return { ...obj, progress: Math.min(progress, obj.target), completed }
  })
}

export function syncPlayerObjectives(player: PlayerState): PlayerState {
  return {
    ...player,
    objectives: syncObjectiveProgress(player.objectives, player.objectiveStats),
  }
}

export function allObjectivesCompleted(objectives: PlayerObjective[]): boolean {
  return objectives.length > 0 && objectives.every((obj) => obj.completed)
}

export function applyObjectiveEvent(
  state: GameState,
  playerId: PlayerId,
  track: ObjectiveTrack,
  amount = 1,
): GameState {
  if (state.phase !== 'playing' || state.winner != null) return state

  const player = state.players.find((p) => p.id === playerId)
  if (!player) return state

  const stats = { ...player.objectiveStats, [track]: player.objectiveStats[track] + amount }
  const updated = syncPlayerObjectives({ ...player, objectiveStats: stats })
  const players = state.players.map((p) => (p.id === playerId ? updated : p))

  let next: GameState = { ...state, players }

  if (allObjectivesCompleted(updated.objectives)) {
    next = {
      ...next,
      phase: 'finished',
      winner: playerId,
      message: `Player ${playerId} completed all objectives and wins!`,
    }
  }

  return next
}

export function bothPlayersPicked(state: GameState): boolean {
  return allPlayersPickedObjectives(state.playerCount, state.objectivePicks)
}

export function objectivesIntroExpired(state: GameState, now = Date.now()): boolean {
  return state.objectivesDeadlineMs != null && now >= state.objectivesDeadlineMs
}

export function canFinalizeObjectiveDraft(state: GameState, now = Date.now()): boolean {
  return bothPlayersPicked(state) || objectivesIntroExpired(state, now)
}

function autoPickObjectiveId(options: PlayerObjective[], excluded: Set<string>): string | null {
  const available = options.filter((obj) => !excluded.has(obj.id))
  if (available.length === 0) return null
  return available[Math.floor(Math.random() * available.length)]!.id
}

function resolvePicksWithAuto(state: GameState): Record<PlayerId, string> & { random: string } {
  const options = state.objectiveDraftOptions
  const excluded = new Set<string>()
  const picks: Record<PlayerId, string> = { 1: '', 2: '', 3: '' }

  for (const id of playerIds(state.playerCount)) {
    let pick = state.objectivePicks[id]
    if (!pick || excluded.has(pick)) {
      pick = autoPickObjectiveId(options, excluded) ?? options[0]?.id ?? 'eliminate_3'
    }
    picks[id] = pick
    excluded.add(pick)
  }

  const random =
    autoPickObjectiveId(options, excluded) ??
    options.find((obj) => !excluded.has(obj.id))?.id ??
    picks[1]

  return { ...picks, random }
}

export function resolveObjectiveDraftPicks(state: GameState): Record<PlayerId, string> & { random: string } {
  return resolvePicksWithAuto(state)
}

export function buildMatchObjectives(state: GameState): PlayerObjective[] {
  const resolved = resolvePicksWithAuto(state)
  const ids = [...playerIds(state.playerCount).map((id) => resolved[id]), resolved.random]
  return ids.map((id) => {
    const def = OBJECTIVE_POOL.find((d) => d.id === id)
    const draft = state.objectiveDraftOptions.find((o) => o.id === id)
    if (def) return createObjectiveFromDef(def, state.playerCount)
    if (draft) return { ...draft, progress: 0, completed: false }
    return { id, label: id, target: 1, progress: 0, completed: false }
  })
}

export function emptyObjectivePicks(count: PlayerCount): GameState['objectivePicks'] {
  return { 1: null, 2: null, 3: count === 3 ? null : null }
}

export function emptyObjectivesAck(count: PlayerCount): GameState['objectivesAck'] {
  return { 1: false, 2: false, 3: count === 3 ? false : false }
}

export function bothPlayersAckedReveal(state: GameState): boolean {
  return allPlayersSatisfied(state.playerCount, state.objectivesAck)
}

export function canProceedFromObjectiveReveal(state: GameState, now = Date.now()): boolean {
  return bothPlayersAckedReveal(state) || objectivesIntroExpired(state, now)
}

export { matchObjectiveCount }
