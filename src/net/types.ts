import type { ClientAction } from '../game/applyGameAction'
import type { GameState } from '../game/types'

export type ServerMessage =
  | { type: 'hosted'; code: string; playerId: 1 }
  | { type: 'joined'; code: string; playerId: 2 }
  | { type: 'guest_joined' }
  | { type: 'waiting'; message: string }
  | { type: 'state'; state: GameState }
  | { type: 'error'; message: string }

export type ClientMessage =
  | { type: 'host' }
  | { type: 'join'; code: string }
  | { type: 'action'; action: ClientAction }

export function getMultiplayerWsUrl(): string {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined
  if (envUrl) return envUrl
  if (import.meta.env.DEV) return 'ws://localhost:3001'
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.hostname}:3001`
}
