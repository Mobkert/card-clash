import { WebSocketServer, type WebSocket } from 'ws'
import { applyGameAction, type ClientAction } from '../src/game/applyGameAction.ts'
import { createInitialGame } from '../src/game/engine.ts'
import { filterGameStateForPlayer } from '../src/game/stateFilter.ts'
import type { GameState } from '../src/game/types.ts'

const PORT = Number(process.env.PORT ?? 3001)

type Room = {
  code: string
  state: GameState
  host: WebSocket
  guest: WebSocket | null
}

const rooms = new Map<string, Room>()
const socketRoom = new WeakMap<WebSocket, { code: string; playerId: 1 | 2 }>()

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  if (rooms.has(code)) return generateCode()
  return code
}

function send(ws: WebSocket, msg: object) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

function broadcastState(room: Room) {
  send(room.host, { type: 'state', state: filterGameStateForPlayer(room.state, 1) })
  if (room.guest) {
    send(room.guest, { type: 'state', state: filterGameStateForPlayer(room.state, 2) })
  }
}

function handleAction(room: Room, playerId: 1 | 2, action: ClientAction) {
  room.state = applyGameAction(room.state, playerId, action)
  broadcastState(room)
}

const wss = new WebSocketServer({ port: PORT })

console.log(`Card Clash multiplayer server on ws://localhost:${PORT}`)

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg: { type: string; code?: string; action?: ClientAction }
    try {
      msg = JSON.parse(raw.toString()) as { type: string; code?: string; action?: ClientAction }
    } catch {
      send(ws, { type: 'error', message: 'Invalid message' })
      return
    }

    if (msg.type === 'host') {
      const code = generateCode()
      const room: Room = {
        code,
        state: createInitialGame(),
        host: ws,
        guest: null,
      }
      rooms.set(code, room)
      socketRoom.set(ws, { code, playerId: 1 })
      send(ws, { type: 'hosted', code, playerId: 1 })
      send(ws, { type: 'waiting', message: 'Share the code — waiting for guest…' })
      send(ws, { type: 'state', state: filterGameStateForPlayer(room.state, 1) })
      return
    }

    if (msg.type === 'join') {
      const code = (msg.code ?? '').trim().toUpperCase()
      const room = rooms.get(code)
      if (!room) {
        send(ws, { type: 'error', message: 'Invalid room code.' })
        return
      }
      if (room.guest) {
        send(ws, { type: 'error', message: 'Room is full.' })
        return
      }
      room.guest = ws
      socketRoom.set(ws, { code, playerId: 2 })
      send(ws, { type: 'joined', code, playerId: 2 })
      send(room.host, { type: 'guest_joined' })
      send(room.host, { type: 'waiting', message: 'Guest connected!' })
      broadcastState(room)
      return
    }

    if (msg.type === 'action') {
      const info = socketRoom.get(ws)
      if (!info || !msg.action) {
        send(ws, { type: 'error', message: 'Not in a room.' })
        return
      }
      const room = rooms.get(info.code)
      if (!room) {
        send(ws, { type: 'error', message: 'Room expired.' })
        return
      }
      handleAction(room, info.playerId, msg.action)
    }
  })

  ws.on('close', () => {
    const info = socketRoom.get(ws)
    if (!info) return
    const room = rooms.get(info.code)
    if (!room) return

    if (info.playerId === 1) {
      room.guest?.close()
      rooms.delete(info.code)
    } else {
      room.guest = null
      send(room.host, { type: 'waiting', message: 'Guest disconnected — waiting…' })
    }
    socketRoom.delete(ws)
  })
})
