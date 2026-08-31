import Peer, { type DataConnection } from 'peerjs'
import { applyGameAction, type ClientAction } from '../game/applyGameAction'
import { createInitialGame } from '../game/engine'
import { filterGameStateForPlayer } from '../game/stateFilter'
import type { GameState } from '../game/types'
import { generateRoomCode, peerIdFromCode, type WireMessage } from './types'

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
  private peer: Peer | null = null
  private conn: DataConnection | null = null
  private hostState: GameState | null = null
  private closing = false
  private connected = false
  readonly playerId: 1 | 2
  private callbacks: MultiplayerCallbacks

  constructor(playerId: 1 | 2, callbacks: MultiplayerCallbacks) {
    this.playerId = playerId
    this.callbacks = callbacks
  }

  host(): Promise<string> {
    return this.hostWithRetries(0)
  }

  private hostWithRetries(attempt: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (attempt >= 8) {
        const message = 'Could not create a room. Try again.'
        this.callbacks.onError(message)
        reject(new Error(message))
        return
      }

      this.closing = false
      this.connected = false
      const code = generateRoomCode()
      const peer = new Peer(peerIdFromCode(code), { debug: 0 })
      this.peer = peer

      peer.on('open', () => {
        this.hostState = createInitialGame()
        this.callbacks.onHosted(code)
        this.callbacks.onWaiting('Share the code — waiting for guest…')
        this.callbacks.onState(this.hostState)
        resolve(code)
      })

      peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          peer.destroy()
          void this.hostWithRetries(attempt + 1).then(resolve).catch(reject)
          return
        }
        const message = err.message || 'Could not host a game.'
        this.callbacks.onError(message)
        reject(err)
      })

      peer.on('connection', (incoming) => {
        if (this.conn?.open) {
          incoming.close()
          return
        }
        this.bindConnection(incoming)
        incoming.on('open', () => {
          this.connected = true
          this.callbacks.onGuestJoined()
          this.sendStateToGuest()
        })
      })
    })
  }

  join(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.closing = false
      this.connected = false
      const normalized = code.trim().toUpperCase()

      if (normalized.length < 4) {
        const message = 'Enter a valid room code.'
        this.callbacks.onError(message)
        reject(new Error(message))
        return
      }

      const peer = new Peer({ debug: 0 })
      this.peer = peer
      let settled = false

      const fail = (message: string) => {
        if (settled) return
        settled = true
        this.callbacks.onError(message)
        reject(new Error(message))
      }

      peer.on('open', () => {
        const conn = peer.connect(peerIdFromCode(normalized), { reliable: true })
        this.bindConnection(conn)

        const timeout = setTimeout(() => {
          fail("Couldn't connect. Check the code and try again.")
        }, 15000)

        conn.on('open', () => {
          clearTimeout(timeout)
          this.connected = true
          this.callbacks.onJoined(normalized)
          if (!settled) {
            settled = true
            resolve()
          }
        })

        conn.on('error', () => {
          clearTimeout(timeout)
          fail("Couldn't connect. Check the code and try again.")
        })
      })

      peer.on('error', (err) => {
        fail(err.message || 'Could not join the game.')
      })
    })
  }

  sendAction(action: ClientAction) {
    if (this.playerId === 1) {
      if (!this.hostState) return
      this.hostState = applyGameAction(this.hostState, 1, action)
      this.callbacks.onState(this.hostState)
      this.sendStateToGuest()
      return
    }

    if (this.conn?.open) {
      this.conn.send({ type: 'action', action, playerId: 2 } satisfies WireMessage)
    }
  }

  disconnect() {
    this.closing = true
    this.connected = false
    try {
      this.conn?.close()
    } catch {
      /* ignore */
    }
    try {
      this.peer?.destroy()
    } catch {
      /* ignore */
    }
    this.conn = null
    this.peer = null
    this.hostState = null
  }

  private bindConnection(conn: DataConnection) {
    this.conn = conn

    conn.on('data', (raw) => {
      const msg = raw as WireMessage
      if (msg.type === 'state' && this.playerId === 2) {
        this.callbacks.onState(msg.state)
        return
      }
      if (msg.type === 'action' && this.playerId === 1 && this.hostState) {
        this.hostState = applyGameAction(this.hostState, msg.playerId, msg.action)
        this.callbacks.onState(this.hostState)
        this.sendStateToGuest()
      }
    })

    conn.on('close', () => {
      if (!this.closing && this.connected) {
        this.callbacks.onDisconnect()
      }
    })
  }

  private sendStateToGuest() {
    if (!this.hostState || !this.conn?.open) return
    this.conn.send({
      type: 'state',
      state: filterGameStateForPlayer(this.hostState, 2),
    } satisfies WireMessage)
  }
}
