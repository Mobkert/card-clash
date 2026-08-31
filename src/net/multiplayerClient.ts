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

const PEER_OPTIONS = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  secure: true,
  debug: 0,
} as const

function formatPeerError(err: { type?: string; message?: string }): string {
  switch (err.type) {
    case 'network':
      return 'Could not reach the online lobby. Check your internet and try again.'
    case 'peer-unavailable':
      return "Couldn't find that room. Check the code — the host must click Host first."
    case 'unavailable-id':
      return 'Room code conflict — click Host again.'
    case 'browser-incompatible':
      return 'Your browser does not support online play. Try Chrome, Edge, or Firefox.'
    case 'disconnected':
      return 'Connection lost. Try again.'
    case 'server-error':
      return 'Online lobby is busy. Wait a moment and try again.'
    case 'socket-error':
    case 'socket-closed':
      return 'Could not connect to the online lobby. Try again in a few seconds.'
    default:
      if (err.message?.includes('Could not connect to peer')) {
        return "Couldn't find that room. Check the code and make sure the host is waiting."
      }
      if (err.message?.includes('Lost connection to server')) {
        return 'Could not connect to the online lobby. Check your internet and try again.'
      }
      return err.message || 'Multiplayer connection failed.'
  }
}

let activeClient: MultiplayerClient | null = null

export function setActiveMultiplayerClient(client: MultiplayerClient | null) {
  if (activeClient && activeClient !== client) {
    activeClient.disconnect()
  }
  activeClient = client
}

export class MultiplayerClient {
  private peer: Peer | null = null
  private conn: DataConnection | null = null
  private hostState: GameState | null = null
  private closing = false
  private connected = false
  private alive = true
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
        this.emitError(message)
        reject(new Error(message))
        return
      }

      this.closing = false
      this.connected = false
      const code = generateRoomCode()
      let settled = false
      const peer = new Peer(peerIdFromCode(code), PEER_OPTIONS)
      this.peer = peer

      const fail = (err: { type?: string; message?: string }) => {
        if (!this.alive || settled) return
        settled = true
        const message = formatPeerError(err)
        this.emitError(message)
        reject(new Error(message))
      }

      peer.on('open', () => {
        if (!this.alive || settled) return
        this.hostState = createInitialGame()
        this.callbacks.onHosted(code)
        this.callbacks.onWaiting('Share the code — waiting for guest…')
        this.pushState(1)
        settled = true
        resolve(code)
      })

      peer.on('error', (err) => {
        if (!this.alive) return
        if (err.type === 'unavailable-id') {
          peer.removeAllListeners()
          try {
            peer.destroy()
          } catch {
            /* ignore */
          }
          void this.hostWithRetries(attempt + 1).then(resolve).catch(reject)
          return
        }
        fail(err)
      })

      peer.on('connection', (incoming) => {
        if (!this.alive) return
        if (this.conn?.open) {
          incoming.close()
          return
        }
        this.bindConnection(incoming)
        incoming.on('open', () => {
          if (!this.alive) return
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
        const message = 'Enter the full room code from the host.'
        this.emitError(message)
        reject(new Error(message))
        return
      }

      const peer = new Peer(PEER_OPTIONS)
      this.peer = peer
      let settled = false

      const fail = (err: { type?: string; message?: string }) => {
        if (!this.alive || settled) return
        settled = true
        const message = formatPeerError(err)
        this.emitError(message)
        reject(new Error(message))
      }

      peer.on('open', () => {
        if (!this.alive) return
        const conn = peer.connect(peerIdFromCode(normalized), { reliable: true })
        this.bindConnection(conn)

        const timeout = setTimeout(() => {
          fail({ type: 'peer-unavailable' })
        }, 15000)

        conn.on('open', () => {
          if (!this.alive) return
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
          fail({ type: 'peer-unavailable' })
        })
      })

      peer.on('error', (err) => fail(err))
    })
  }

  sendAction(action: ClientAction) {
    if (this.playerId === 1) {
      if (!this.hostState) return
      this.hostState = applyGameAction(this.hostState, 1, action)
      this.pushState(1)
      this.sendStateToGuest()
      return
    }

    if (this.conn?.open) {
      this.conn.send({ type: 'action', action, playerId: 2 } satisfies WireMessage)
    }
  }

  disconnect() {
    this.alive = false
    this.closing = true
    this.connected = false
    try {
      this.conn?.close()
    } catch {
      /* ignore */
    }
    try {
      this.peer?.removeAllListeners()
      this.peer?.destroy()
    } catch {
      /* ignore */
    }
    this.conn = null
    this.peer = null
    this.hostState = null
    if (activeClient === this) activeClient = null
  }

  private emitError(message: string) {
    if (this.alive) this.callbacks.onError(message)
  }

  private bindConnection(conn: DataConnection) {
    this.conn = conn

    conn.on('data', (raw) => {
      if (!this.alive) return
      const msg = raw as WireMessage
      if (msg.type === 'state' && this.playerId === 2) {
        this.callbacks.onState(msg.state)
        return
      }
      if (msg.type === 'action' && this.playerId === 1 && this.hostState) {
        this.hostState = applyGameAction(this.hostState, msg.playerId, msg.action)
        this.pushState(1)
        this.sendStateToGuest()
      }
    })

    conn.on('close', () => {
      if (!this.closing && this.connected && this.alive) {
        this.callbacks.onDisconnect()
      }
    })
  }

  private pushState(viewerId: 1 | 2) {
    if (!this.hostState) return
    this.callbacks.onState(filterGameStateForPlayer(this.hostState, viewerId))
  }

  private sendStateToGuest() {
    if (!this.hostState || !this.conn?.open) return
    this.conn.send({
      type: 'state',
      state: filterGameStateForPlayer(this.hostState, 2),
    } satisfies WireMessage)
  }
}
