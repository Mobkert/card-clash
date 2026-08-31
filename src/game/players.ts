import type { PlayerCount, PlayerId, PlayerState } from './types'

export type { PlayerCount, PlayerId }

export function playerIds(count: PlayerCount): PlayerId[] {
  return count === 3 ? [1, 2, 3] : [1, 2]
}

export function nextPlayerId(current: PlayerId, count: PlayerCount): PlayerId {
  if (count === 2) return current === 1 ? 2 : 1
  if (current === 1) return 2
  if (current === 2) return 3
  return 1
}

export function getPlayer(players: PlayerState[], playerId: PlayerId): PlayerState {
  const player = players.find((p) => p.id === playerId)
  if (!player) throw new Error(`Player ${playerId} not found`)
  return player
}

export function updatePlayer(
  players: PlayerState[],
  playerId: PlayerId,
  updated: PlayerState,
): PlayerState[] {
  return players.map((p) => (p.id === playerId ? updated : p))
}

export function opponentIds(playerId: PlayerId, count: PlayerCount): PlayerId[] {
  return playerIds(count).filter((id) => id !== playerId)
}

export function randomOpponentId(playerId: PlayerId, count: PlayerCount): PlayerId {
  const opponents = opponentIds(playerId, count)
  return opponents[Math.floor(Math.random() * opponents.length)]!
}

export function emptyPlayerPicks(count: PlayerCount): Record<PlayerId, string | null> {
  return { 1: null, 2: null, 3: count === 3 ? null : null }
}

export function emptyObjectivesAck(count: PlayerCount): Record<PlayerId, boolean> {
  return { 1: false, 2: false, 3: count === 3 ? false : false }
}

export function allPlayersSatisfied(count: PlayerCount, record: Record<PlayerId, boolean>): boolean {
  return playerIds(count).every((id) => record[id])
}

export function allPlayersPickedObjectives(
  count: PlayerCount,
  picks: Record<PlayerId, string | null>,
): boolean {
  return playerIds(count).every((id) => picks[id] != null)
}

export function matchObjectiveCount(count: PlayerCount): number {
  return count === 3 ? 4 : 3
}

export function objectiveDifficultyScale(count: PlayerCount): number {
  return count === 3 ? 1.25 : 1
}
