import { getTemplate } from './cards'
import type { CardType, GameState, PlayerObjective, PlayerState } from './types'
import { OBJECTIVE_POOL, createObjectiveFromDef } from './objectives'

type ObjectiveDef = (typeof OBJECTIVE_POOL)[number]
type ObjectiveTrack = ObjectiveDef['track']

export type MatchResourceLimits = Record<ObjectiveTrack, number>

export function countCardsByType(cards: { templateId: string }[]): Record<CardType, number> {
  const counts: Record<CardType, number> = {
    character: 0,
    attack: 0,
    passive: 0,
    special: 0,
  }
  for (const card of cards) {
    counts[getTemplate(card.templateId).type] += 1
  }
  return counts
}

function playerCardPool(player: PlayerState): { templateId: string }[] {
  const boardChars = player.board
    .filter((slot) => slot.character)
    .map((slot) => slot.character!.card)
  return [...player.deck, ...player.hand, ...boardChars]
}

/** Upper bounds for objective targets given both players' available cards at match start. */
export function getMatchResourceLimits(state: GameState): MatchResourceLimits {
  const [p1, p2] = state.players
  const p1Counts = countCardsByType(playerCardPool(p1))
  const p2Counts = countCardsByType(playerCardPool(p2))

  const minChars = Math.min(p1Counts.character, p2Counts.character)
  const minAttacks = Math.min(p1Counts.attack, p2Counts.attack)
  const minSpecials = Math.min(p1Counts.special, p2Counts.special)
  const totalAttacks = p1Counts.attack + p2Counts.attack

  return {
    eliminations: minChars,
    attacks_played: minAttacks,
    specials_played: minSpecials,
    abilities_used: minChars * 3,
    damage_dealt: Math.max(minAttacks, Math.floor(totalAttacks * 0.6)) * 18,
    chars_placed: minChars,
  }
}

export function isObjectiveDefFeasible(def: ObjectiveDef, limits: MatchResourceLimits): boolean {
  return def.target <= limits[def.track]
}

export function getFeasibleObjectiveDefs(state: GameState): ObjectiveDef[] {
  const limits = getMatchResourceLimits(state)
  return OBJECTIVE_POOL.filter((def) => isObjectiveDefFeasible(def, limits))
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function rollDraftOptions(state: GameState): PlayerObjective[] {
  const feasible = getFeasibleObjectiveDefs(state)
  const pool = feasible.length > 0 ? feasible : [...OBJECTIVE_POOL]
  const shuffled = shuffle(pool)

  const picks: ObjectiveDef[] = []
  for (const def of shuffled) {
    if (picks.length >= 8) break
    if (!picks.some((p) => p.id === def.id)) picks.push(def)
  }

  if (picks.length < 8) {
    const sorted = [...pool].sort((a, b) => a.target - b.target)
    for (const def of sorted) {
      if (picks.length >= 8) break
      if (!picks.some((p) => p.id === def.id)) picks.push(def)
    }
  }

  return picks.map(createObjectiveFromDef)
}
