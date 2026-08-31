import type { GameState, PlayerObjective, PlayerState } from './types'

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
export const OBJECTIVE_DRAFT_COUNT = 8
export const MATCH_OBJECTIVE_COUNT = 3

export function createObjectiveFromDef(def: ObjectiveDef): PlayerObjective {
  return {
    id: def.id,
    label: def.label,
    target: def.target,
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
    if (!def) return obj
    const progress = stats[def.track]
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
  playerId: 1 | 2,
  track: ObjectiveTrack,
  amount = 1,
): GameState {
  if (state.phase !== 'playing' || state.winner != null) return state

  const player = state.players[playerId === 1 ? 0 : 1]
  const stats = { ...player.objectiveStats, [track]: player.objectiveStats[track] + amount }
  const updated = syncPlayerObjectives({ ...player, objectiveStats: stats })
  const players = state.players.map((p) => (p.id === playerId ? updated : p)) as [PlayerState, PlayerState]

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
  return state.objectivePicks[1] != null && state.objectivePicks[2] != null
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

function resolvePicksWithAuto(state: GameState): { 1: string; 2: string; random: string } {
  const options = state.objectiveDraftOptions
  const excluded = new Set<string>()
  let pick1 = state.objectivePicks[1]
  let pick2 = state.objectivePicks[2]

  if (!pick1) {
    pick1 = autoPickObjectiveId(options, excluded)
  }
  if (!pick1) {
    pick1 = options[0]?.id ?? 'eliminate_3'
  }
  excluded.add(pick1)

  if (!pick2 || pick2 === pick1) {
    pick2 = autoPickObjectiveId(options, excluded)
  }
  if (!pick2) {
    pick2 = options.find((obj) => obj.id !== pick1)?.id ?? pick1
  }
  excluded.add(pick2)

  const random =
    autoPickObjectiveId(options, excluded) ??
    options.find((obj) => !excluded.has(obj.id))?.id ??
    pick1

  return { 1: pick1, 2: pick2, random }
}

export function resolveObjectiveDraftPicks(state: GameState): { 1: string; 2: string; random: string } {
  return resolvePicksWithAuto(state)
}

export function buildMatchObjectives(state: GameState): PlayerObjective[] {
  const resolved = resolvePicksWithAuto(state)
  return [resolved[1], resolved[2], resolved.random].map((id) => {
    const def = OBJECTIVE_POOL.find((d) => d.id === id)
    const draft = state.objectiveDraftOptions.find((o) => o.id === id)
    if (def) return createObjectiveFromDef(def)
    if (draft) return { ...draft, progress: 0, completed: false }
    return { id, label: id, target: 1, progress: 0, completed: false }
  })
}

export function emptyObjectivePicks(): GameState['objectivePicks'] {
  return { 1: null, 2: null }
}

export function emptyObjectivesAck(): GameState['objectivesAck'] {
  return { 1: false, 2: false }
}

export function bothPlayersAckedReveal(state: GameState): boolean {
  return state.objectivesAck[1] && state.objectivesAck[2]
}

export function canProceedFromObjectiveReveal(state: GameState, now = Date.now()): boolean {
  return bothPlayersAckedReveal(state) || objectivesIntroExpired(state, now)
}
