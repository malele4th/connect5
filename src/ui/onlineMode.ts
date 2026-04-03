import type { GameSnapshot, Player } from '@/types/index.ts'
import { createBoardView, statusMessage } from '@/ui/boardView.ts'
import { getWsUrl } from '@/net/wsUrl.ts'
import {
  parseRoomId,
  ROOM_ID_HTML_PATTERN,
  ROOM_ID_LENGTH,
} from '@/net/roomId.ts'

type OnlineSession = { roomId: string; role: Player }

export interface OnlineModeDeps {
  readSession: () => OnlineSession | null
  writeSession: (s: OnlineSession | null) => void
}

export function attachOnlineMode(
  root: HTMLElement,
  deps: OnlineModeDeps,
): () => void {
  const panel = document.createElement('div')
  panel.className = 'panel'

  const connBanner = document.createElement('div')
  connBanner.className = 'conn-banner ok'
  connBanner.setAttribute('role', 'status')
  connBanner.setAttribute('aria-live', 'polite')
  connBanner.textContent = '未连接服务器。建房或加入房间后将自动连接。'

  const statusEl = document.createElement('div')
  statusEl.className = 'status-bar'
  statusEl.setAttribute('role', 'status')
  statusEl.setAttribute('aria-live', 'polite')
  statusEl.setAttribute('aria-atomic', 'true')

  const toolbar = document.createElement('div')
  toolbar.className = 'toolbar'

  const fieldRoom = document.createElement('div')
  fieldRoom.className = 'field'
  const labRoom = document.createElement('label')
  labRoom.htmlFor = 'room-id'
  labRoom.textContent = '房间号'
  const inputRoom = document.createElement('input')
  inputRoom.id = 'room-id'
  inputRoom.type = 'text'
  inputRoom.autocomplete = 'off'
  inputRoom.maxLength = ROOM_ID_LENGTH
  inputRoom.spellcheck = false
  inputRoom.setAttribute('autocapitalize', 'off')
  inputRoom.setAttribute('inputmode', 'text')
  inputRoom.pattern = ROOM_ID_HTML_PATTERN
  inputRoom.title = `${ROOM_ID_LENGTH} 位数字或小写字母`
  inputRoom.placeholder = '如 a1b2'
  fieldRoom.append(labRoom, inputRoom)

  inputRoom.addEventListener('input', () => {
    const v = inputRoom.value
      .toLowerCase()
      .replace(/[^0-9a-z]/g, '')
      .slice(0, ROOM_ID_LENGTH)
    if (v !== inputRoom.value) inputRoom.value = v
  })

  const btnCreate = document.createElement('button')
  btnCreate.type = 'button'
  btnCreate.textContent = '创建房间'

  const btnJoin = document.createElement('button')
  btnJoin.type = 'button'
  btnJoin.textContent = '加入房间'

  const btnReconnect = document.createElement('button')
  btnReconnect.type = 'button'
  btnReconnect.textContent = '重新连接'

  toolbar.append(fieldRoom, btnCreate, btnJoin, btnReconnect)

  const boardRow = document.createElement('div')
  boardRow.className = 'board-with-side'

  const centerRow = document.createElement('div')
  centerRow.className = 'board-center-row'

  const boardHost = document.createElement('div')
  boardHost.className = 'board-scroll'

  const sideRail = document.createElement('div')
  sideRail.className = 'board-side-rail'

  const sideActions = document.createElement('div')
  sideActions.className = 'board-side-actions'

  const btnNew = document.createElement('button')
  btnNew.type = 'button'
  btnNew.textContent = '重新开始'

  const btnUndo = document.createElement('button')
  btnUndo.type = 'button'
  btnUndo.textContent = '悔棋'

  sideActions.append(btnNew, btnUndo)
  sideRail.append(sideActions)

  centerRow.append(boardHost, sideRail)
  boardRow.append(centerRow)

  panel.append(toolbar, connBanner, statusEl, boardRow)
  root.append(panel)

  const board = createBoardView(15)
  board.mount(boardHost)

  let ws: WebSocket | null = null
  let session: OnlineSession | null = deps.readSession()
  let lastState: GameSnapshot | null = null
  let myRole: Player | null = session?.role ?? null
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let intentionalClose = false
  /** 落子类错误无后续 STATE 时自动收起提示 */
  let errorDismissTimer: ReturnType<typeof setTimeout> | null = null
  /** 为真时不因 STATE 覆盖「对手断开」类提示 */
  let opponentMarkedDisconnected = false

  const TRANSIENT_MOVE_ERROR_CODES = new Set([
    'occupied',
    'wrong_player',
    'game_over',
    'out_of_bounds',
    'MOVE',
    'UNDO',
  ])

  function countStones(s: GameSnapshot): number {
    let n = 0
    for (let y = 0; y < s.size; y++) {
      for (let x = 0; x < s.size; x++) {
        if (s.board[y]![x] !== 'empty') n++
      }
    }
    return n
  }

  function clearErrorDismissTimer() {
    if (errorDismissTimer) {
      clearTimeout(errorDismissTimer)
      errorDismissTimer = null
    }
  }

  function connectedNotice(): string {
    if (session) return `已连接。房间号：${session.roomId}`
    return '已连接服务器。'
  }

  function setConn(ok: boolean, text: string) {
    connBanner.className = `conn-banner ${ok ? 'ok' : 'warn'}`
    connBanner.textContent = text
  }

  function onlineLabel(p: Player): string {
    if (!myRole) return p === 'black' ? '黑方' : '白方'
    if (p === myRole) return '你'
    return '对手'
  }

  function refreshUi() {
    const connected =
      ws !== null && ws.readyState === WebSocket.OPEN

    if (!lastState) {
      statusEl.textContent = session
        ? `已加入房间 ${session.roomId}，你是${myRole === 'black' ? '黑' : '白'}方。等待同步…`
        : '创建或加入房间开始对弈。'
      board.setInteractive(false)
      btnNew.disabled = !connected || !session
      btnUndo.disabled = true
      return
    }
    board.setSnapshot(lastState)
    statusEl.textContent = statusMessage(lastState, onlineLabel)
    const canMove =
      lastState.status === 'playing' &&
      myRole !== null &&
      lastState.currentPlayer === myRole &&
      connected
    board.setInteractive(canMove)

    btnNew.disabled = !connected || !session
    btnUndo.disabled =
      !connected || !session || countStones(lastState) === 0
  }

  function stopPing() {
    if (pingTimer) {
      clearInterval(pingTimer)
      pingTimer = null
    }
  }

  function startPing() {
    stopPing()
    pingTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PING' }))
      }
    }, 25000)
  }

  function send(obj: object) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj))
  }

  function handleMessage(raw: string) {
    let msg: { type: string }
    try {
      msg = JSON.parse(raw) as { type: string }
    } catch {
      return
    }
    switch (msg.type) {
      case 'CREATED': {
        clearErrorDismissTimer()
        opponentMarkedDisconnected = false
        const m = msg as {
          type: 'CREATED'
          roomId: string
          color: Player
          state: GameSnapshot
        }
        session = { roomId: m.roomId, role: m.color }
        myRole = m.color
        deps.writeSession(session)
        inputRoom.value = m.roomId
        lastState = m.state
        setConn(true, `已创建房间 ${m.roomId}，你是黑方。把房间号发给对手。`)
        refreshUi()
        break
      }
      case 'JOINED': {
        clearErrorDismissTimer()
        opponentMarkedDisconnected = false
        const m = msg as {
          type: 'JOINED'
          color: Player
          state: GameSnapshot
        }
        if (session) {
          myRole = m.color
          deps.writeSession(session)
        }
        lastState = m.state
        setConn(true, '已加入对局，等待双方落子。')
        refreshUi()
        break
      }
      case 'STATE': {
        clearErrorDismissTimer()
        const m = msg as { type: 'STATE'; state: GameSnapshot }
        lastState = m.state
        if (
          ws?.readyState === WebSocket.OPEN &&
          !opponentMarkedDisconnected
        ) {
          setConn(true, connectedNotice())
        }
        refreshUi()
        break
      }
      case 'OPPONENT_JOINED':
        opponentMarkedDisconnected = false
        setConn(true, '对手已加入，黑方先行。')
        break
      case 'OPPONENT_REJOINED':
        opponentMarkedDisconnected = false
        setConn(true, '对手已重新连接。')
        break
      case 'OPPONENT_DISCONNECTED':
        opponentMarkedDisconnected = true
        setConn(false, '对手已断开连接，可等待其重连。')
        board.setInteractive(false)
        refreshUi()
        break
      case 'ERROR': {
        clearErrorDismissTimer()
        const m = msg as { type: 'ERROR'; message?: string; code?: string }
        if (
          m.code === 'NOT_FOUND' ||
          m.code === 'TAKEN' ||
          m.code === 'FULL' ||
          m.code === 'BAD_ROOM'
        ) {
          deps.writeSession(null)
          session = null
          myRole = null
          lastState = null
        }
        setConn(false, `错误：${m.message ?? m.code ?? 'unknown'}`)
        refreshUi()
        if (
          m.code &&
          TRANSIENT_MOVE_ERROR_CODES.has(m.code) &&
          ws?.readyState === WebSocket.OPEN
        ) {
          errorDismissTimer = setTimeout(() => {
            errorDismissTimer = null
            if (ws?.readyState === WebSocket.OPEN) {
              setConn(true, connectedNotice())
            }
          }, 4500)
        }
        break
      }
      case 'PONG':
        break
      default:
        break
    }
  }

  function connect(afterOpen?: () => void) {
    intentionalClose = false
    clearErrorDismissTimer()
    ws?.close()
    stopPing()
    setConn(true, '正在连接…')
    const url = getWsUrl()
    const socket = new WebSocket(url)
    ws = socket

    socket.addEventListener('open', () => {
      setConn(true, '已连接服务器。')
      startPing()
      afterOpen?.()
    })

    socket.addEventListener('message', (ev) => {
      if (typeof ev.data === 'string') handleMessage(ev.data)
    })

    socket.addEventListener('close', () => {
      stopPing()
      if (!intentionalClose) {
        setConn(false, '连接已断开。可点击「重新连接」恢复（需房间仍在服务器上）。')
        board.setInteractive(false)
        refreshUi()
      }
    })

    socket.addEventListener('error', () => {
      setConn(false, '网络错误，请检查 WebSocket 服务是否已启动。')
    })
  }

  board.setOnMove((x, y) => {
    send({ type: 'MOVE', x, y })
  })

  btnCreate.addEventListener('click', () => {
    session = null
    myRole = null
    lastState = null
    deps.writeSession(null)
    connect(() => {
      send({ type: 'CREATE' })
    })
  })

  btnJoin.addEventListener('click', () => {
    const id = parseRoomId(inputRoom.value)
    if (!id) {
      setConn(false, '房间号须为 4 位数字或小写字母。')
      return
    }
    session = { roomId: id, role: 'white' }
    myRole = 'white'
    deps.writeSession(session)
    connect(() => {
      send({ type: 'JOIN', roomId: id })
    })
  })

  btnNew.addEventListener('click', () => {
    send({ type: 'NEW_GAME' })
  })

  btnUndo.addEventListener('click', () => {
    send({ type: 'UNDO' })
  })

  btnReconnect.addEventListener('click', () => {
    if (session && myRole) {
      connect(() => {
        send({ type: 'RESUME', roomId: session!.roomId, role: myRole! })
      })
    } else {
      setConn(false, '没有可恢复的会话，请先创建或加入房间。')
    }
  })

  if (session && myRole) {
    const saved = { roomId: session.roomId, role: myRole }
    connect(() => {
      send({ type: 'RESUME', roomId: saved.roomId, role: saved.role })
    })
  } else {
    refreshUi()
  }

  return () => {
    intentionalClose = true
    clearErrorDismissTimer()
    stopPing()
    ws?.close()
    ws = null
    board.unmount()
    panel.remove()
  }
}
