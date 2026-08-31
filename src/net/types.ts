import type { ClientAction } from '../game/applyGameAction'
import type { GameState, PlayerCount, PlayerId } from '../game/types'

export type WireMessage =
  | { type: 'state'; state: GameState }
  | { type: 'action'; action: ClientAction; playerId: PlayerId }
  | { type: 'welcome'; playerId: PlayerId; playerCount: PlayerCount }

const PEER_PREFIX = 'cardclash-'
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export function peerIdFromCode(code: string): string {
  return `${PEER_PREFIX}${code.trim().toUpperCase()}`
}
