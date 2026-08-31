import type { ClientAction } from '../game/applyGameAction'
import type { GameState } from '../game/types'
import { getMultiplayerWsUrl, type ClientMessage, type ServerMessage } from './types'

export type MultiplayerCallbacks = {
  onHosted: (code: string) => void
  onJoined: (code: string) => void
  onGuestJoined: () => void
  onState: (state: GameState) => void
  onWaiting: (message: string) => void
  onError: (message: string) => void
  onDisconnect: () => void
}

export class MultiplayerClient {
  private ws: WebSocket | null = null
  readonly playerId: 1 | 2
  private callbacks: MultiplayerCallbacks

  constructor(playerId: 1 | 2, callbacks: MultiplayerCallbacks) {
    this.playerId = playerId
    this.callbacks = callbacks
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = getMultiplayerWsUrl()
      const ws = new WebSocket(url)
      this.ws = ws

      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error('Could not connect to multiplayer server'))
      ws.onclose = () => this.callbacks.onDisconnect()

      ws.onmessage = (event) => {
        let msg: ServerMessage
        try {
          msg = JSON.parse(event.data as string) as ServerMessage
        } catch {
          this.callbacks.onError('Invalid server message')
          return
        }
        this.handleMessage(msg)
      }
    })
  }

  disconnect() {
    this.ws?.close()
    this.ws = null
  }

  host() {
    this.send({ type: 'host' })
  }

  join(code: string) {
    this.send({ type: 'join', code: code.trim().toUpperCase() })
  }

  sendAction(action: ClientAction) {
    this.send({ type: 'action', action })
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'hosted':
        this.callbacks.onHosted(msg.code)
        break
      case 'joined':
        this.callbacks.onJoined(msg.code)
        break
      case 'guest_joined':
        this.callbacks.onGuestJoined()
        break
      case 'state':
        this.callbacks.onState(msg.state)
        break
      case 'waiting':
        this.callbacks.onWaiting(msg.message)
        break
      case 'error':
        this.callbacks.onError(msg.message)
        break
    }
  }
}
