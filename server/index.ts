import { randomInt } from 'node:crypto'
import { createServer } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import {
  applyMove,
  createGame,
  newGame,
  toSnapshot,
  undoLastMove,
  type GomokuGame,
} from '../src/game/gomoku.ts'
import type { Player } from '../src/types/index.ts'
import {
  parseRoomId,
  ROOM_ID_CHARS,
  ROOM_ID_LENGTH,
} from '../src/net/roomId.ts'

type Role = Player

interface ClientMeta {
  roomId: string
  role: Role
}

interface Room {
  game: GomokuGame
  black: WebSocket | null
  white: WebSocket | null
}

const meta = new WeakMap<WebSocket, ClientMeta>()
const rooms = new Map<string, Room>()

const PORT = Number(process.env.PORT) || 3003

function safeSend(ws: WebSocket, obj: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj))
  }
}

function broadcastRoom(room: Room, obj: unknown, skip?: WebSocket) {
  const payload = JSON.stringify(obj)
  for (const peer of [room.black, room.white]) {
    if (peer && peer !== skip && peer.readyState === WebSocket.OPEN) {
      peer.send(payload)
    }
  }
}

function genRoomId(): string {
  for (;;) {
    let id = ''
    for (let i = 0; i < ROOM_ID_LENGTH; i++) {
      id += ROOM_ID_CHARS[randomInt(ROOM_ID_CHARS.length)]!
    }
    if (!rooms.has(id)) return id
  }
}

function leaveRoom(ws: WebSocket, notifyOther: boolean) {
  const m = meta.get(ws)
  if (!m) return
  const room = rooms.get(m.roomId)
  meta.delete(ws)
  if (!room) return
  if (m.role === 'black') room.black = null
  else room.white = null
  const other = m.role === 'black' ? room.white : room.black
  if (notifyOther && other && other.readyState === WebSocket.OPEN) {
    safeSend(other, { type: 'OPPONENT_DISCONNECTED' })
  }
  if (!room.black && !room.white) {
    rooms.delete(m.roomId)
  }
}

function handleCreate(ws: WebSocket) {
  if (meta.has(ws)) {
    safeSend(ws, { type: 'ERROR', code: 'ALREADY', message: '已在房间中' })
    return
  }
  const id = genRoomId()
  const game = createGame()
  const room: Room = { game, black: ws, white: null }
  rooms.set(id, room)
  meta.set(ws, { roomId: id, role: 'black' })
  safeSend(ws, {
    type: 'CREATED',
    roomId: id,
    color: 'black',
    state: toSnapshot(game),
  })
}

function handleJoin(ws: WebSocket, roomIdRaw: string) {
  if (meta.has(ws)) {
    safeSend(ws, { type: 'ERROR', code: 'ALREADY', message: '已在房间中' })
    return
  }
  const roomId = parseRoomId(roomIdRaw)
  if (!roomId) {
    safeSend(ws, {
      type: 'ERROR',
      code: 'BAD_ROOM',
      message: '房间号须为 4 位数字或小写字母',
    })
    return
  }
  const room = rooms.get(roomId)
  if (!room) {
    safeSend(ws, {
      type: 'ERROR',
      code: 'NOT_FOUND',
      message: '房间不存在',
    })
    return
  }
  if (room.white) {
    safeSend(ws, { type: 'ERROR', code: 'FULL', message: '房间已满' })
    return
  }
  room.white = ws
  meta.set(ws, { roomId, role: 'white' })
  safeSend(ws, {
    type: 'JOINED',
    color: 'white',
    state: toSnapshot(room.game),
  })
  if (room.black && room.black.readyState === WebSocket.OPEN) {
    safeSend(room.black, { type: 'OPPONENT_JOINED' })
  }
}

function handleResume(ws: WebSocket, roomIdRaw: string, role: Role) {
  if (meta.has(ws)) {
    safeSend(ws, { type: 'ERROR', code: 'ALREADY', message: '已在房间中' })
    return
  }
  const roomId = parseRoomId(roomIdRaw)
  if (!roomId) {
    safeSend(ws, {
      type: 'ERROR',
      code: 'BAD_ROOM',
      message: '房间号须为 4 位数字或小写字母',
    })
    return
  }
  const room = rooms.get(roomId)
  if (!room) {
    safeSend(ws, {
      type: 'ERROR',
      code: 'NOT_FOUND',
      message: '房间不存在或已过期',
    })
    return
  }
  const slot = role === 'black' ? room.black : room.white
  if (slot && slot.readyState === WebSocket.OPEN) {
    safeSend(ws, {
      type: 'ERROR',
      code: 'TAKEN',
      message: '该座位仍被占用，请稍后再试',
    })
    return
  }
  if (role === 'black') room.black = ws
  else room.white = ws
  meta.set(ws, { roomId, role })
  safeSend(ws, {
    type: 'JOINED',
    color: role,
    state: toSnapshot(room.game),
  })
  const other = role === 'black' ? room.white : room.black
  if (other && other.readyState === WebSocket.OPEN) {
    safeSend(other, { type: 'OPPONENT_REJOINED' })
  }
}

function handleMove(ws: WebSocket, x: number, y: number) {
  const m = meta.get(ws)
  if (!m) {
    safeSend(ws, { type: 'ERROR', code: 'NO_ROOM', message: '请先加入房间' })
    return
  }
  const room = rooms.get(m.roomId)
  if (!room) return
  const r = applyMove(room.game, x, y, m.role)
  if (!r.ok) {
    safeSend(ws, {
      type: 'ERROR',
      code: r.reason ?? 'MOVE',
      message: '非法落子',
    })
    return
  }
  broadcastRoom(room, { type: 'STATE', state: r.snapshot })
}

function handleNewGame(ws: WebSocket) {
  const m = meta.get(ws)
  if (!m) return
  const room = rooms.get(m.roomId)
  if (!room) return
  newGame(room.game)
  broadcastRoom(room, { type: 'STATE', state: toSnapshot(room.game) })
}

function handleUndo(ws: WebSocket) {
  const m = meta.get(ws)
  if (!m) {
    safeSend(ws, { type: 'ERROR', code: 'NO_ROOM', message: '请先加入房间' })
    return
  }
  const room = rooms.get(m.roomId)
  if (!room) return
  const ok = undoLastMove(room.game)
  if (!ok) {
    safeSend(ws, {
      type: 'ERROR',
      code: 'UNDO',
      message: '无法悔棋',
    })
    return
  }
  broadcastRoom(room, { type: 'STATE', state: toSnapshot(room.game) })
}

function handleMessage(ws: WebSocket, raw: string) {
  let msg: { type: string }
  try {
    msg = JSON.parse(raw) as { type: string }
  } catch {
    safeSend(ws, { type: 'ERROR', code: 'BAD_JSON', message: 'JSON 无效' })
    return
  }

  switch (msg.type) {
    case 'PING':
      safeSend(ws, { type: 'PONG' })
      return
    case 'CREATE':
      handleCreate(ws)
      return
    case 'JOIN':
      handleJoin(ws, String((msg as { roomId: string }).roomId).trim())
      return
    case 'RESUME':
      handleResume(
        ws,
        String((msg as { roomId: string }).roomId).trim(),
        (msg as { role: Role }).role,
      )
      return
    case 'MOVE': {
      const m = msg as { x: number; y: number }
      handleMove(ws, m.x, m.y)
      return
    }
    case 'NEW_GAME':
      handleNewGame(ws)
      return
    case 'UNDO':
      handleUndo(ws)
      return
    default:
      safeSend(ws, { type: 'ERROR', code: 'UNKNOWN', message: '未知消息' })
  }
}

const httpServer = createServer((_req, res) => {
  res.writeHead(404).end()
})

const wss = new WebSocketServer({ server: httpServer, path: '/socket' })

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    handleMessage(ws, data.toString())
  })
  ws.on('close', () => {
    leaveRoom(ws, true)
  })
})

httpServer.listen(PORT, () => {
  console.error(`[gomoku] ws://127.0.0.1:${PORT}/socket`)
})
