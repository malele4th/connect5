import './style.css'
import {
  applyMove,
  createGame,
  newGame,
  toSnapshot,
  undoLastMove,
  type GomokuGame,
} from '@/game/index.ts'
import type { Player } from '@/types/index.ts'
import { createBoardView } from '@/ui/boardView.ts'
import {
  attachBoardEndDialogDrag,
  createBoardEndOverlay,
  createLocalStyleTurnTimer,
  createStandardLocalBoardLayout,
  localPlayerCornerLabel,
} from '@/ui/boardLocalShared.ts'
import { mountPvE } from '@/ui/pveMode.ts'
import { attachOnlineMode } from '@/ui/onlineMode.ts'
import { parseRoomId } from '@/net/roomId.ts'

const STORAGE_KEY = 'connect5-online-session'

type OnlineSession = { roomId: string; role: Player }

function readSession(): OnlineSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as OnlineSession
    const roomId = typeof o.roomId === 'string' ? parseRoomId(o.roomId) : null
    if (roomId && (o.role === 'black' || o.role === 'white'))
      return { roomId, role: o.role }
  } catch {
    /* ignore */
  }
  return null
}

function writeSession(s: OnlineSession | null) {
  if (!s) sessionStorage.removeItem(STORAGE_KEY)
  else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

function mountLocal(root: HTMLElement): () => void {
  const {
    panel,
    boardHost,
    badgeBlack,
    badgeWhite,
    countdownEl,
    timerHintEl,
    timerLine,
    endMsg,
    btnNew,
    btnUndo,
  } = createStandardLocalBoardLayout()

  let game: GomokuGame = createGame()
  const board = createBoardView(game.size)

  const {
    dialog: boardEndDialog,
    panel: boardEndPanel,
    title: boardEndTitle,
    btnRestart: btnBoardRestart,
  } = createBoardEndOverlay({ titleId: 'local-board-end-title' })

  btnBoardRestart.addEventListener('click', () => {
    awaitingLocalTimeoutRestart = false
    newGame(game)
    refresh()
  })

  const endDrag = attachBoardEndDialogDrag(boardEndPanel, boardHost)

  let awaitingLocalTimeoutRestart = false

  const {
    stopTurnTimer,
    clearTimeoutHintLater,
    ensureTurnTimer,
  } = createLocalStyleTurnTimer({
    getSnapshot: () => toSnapshot(game),
    isAwaitingTimeoutRestart: () => awaitingLocalTimeoutRestart,
    shouldRunCountdown: () => true,
    onTurnTimeout: () => {
      awaitingLocalTimeoutRestart = true
      refresh()
    },
    els: { countdownEl, timerHintEl, timerLine },
  })

  function refresh() {
    const snap = toSnapshot(game)
    board.setSnapshot(snap)
    const playing = snap.status === 'playing'
    const canPlay = playing && !awaitingLocalTimeoutRestart
    const showBoardEndDialog =
      awaitingLocalTimeoutRestart ||
      snap.status === 'black_win' ||
      snap.status === 'white_win'

    if (awaitingLocalTimeoutRestart) {
      boardEndTitle.textContent = `${localPlayerCornerLabel(snap.currentPlayer)}思考超时`
    } else if (snap.status === 'black_win') {
      boardEndTitle.textContent = '恭喜「黑方」胜出'
    } else if (snap.status === 'white_win') {
      boardEndTitle.textContent = '恭喜「白方」胜出'
    }

    badgeBlack.classList.remove(
      'turn-badge--active',
      'turn-badge--winner',
      'turn-badge--idle',
    )
    badgeWhite.classList.remove(
      'turn-badge--active',
      'turn-badge--winner',
      'turn-badge--idle',
    )

    badgeBlack.removeAttribute('aria-current')
    badgeWhite.removeAttribute('aria-current')

    if (playing) {
      if (awaitingLocalTimeoutRestart) {
        badgeBlack.classList.add('turn-badge--idle')
        badgeWhite.classList.add('turn-badge--idle')
        endMsg.textContent = ''
      } else if (snap.currentPlayer === 'black') {
        badgeBlack.classList.add('turn-badge--active')
        badgeWhite.classList.add('turn-badge--idle')
        badgeBlack.setAttribute('aria-current', 'true')
        endMsg.textContent = ''
      } else {
        badgeWhite.classList.add('turn-badge--active')
        badgeBlack.classList.add('turn-badge--idle')
        badgeWhite.setAttribute('aria-current', 'true')
        endMsg.textContent = ''
      }
    } else if (snap.status === 'black_win') {
      badgeBlack.classList.add('turn-badge--winner')
      badgeWhite.classList.add('turn-badge--idle')
      badgeBlack.setAttribute('aria-current', 'true')
      endMsg.textContent = ''
    } else if (snap.status === 'white_win') {
      badgeWhite.classList.add('turn-badge--winner')
      badgeBlack.classList.add('turn-badge--idle')
      badgeWhite.setAttribute('aria-current', 'true')
      endMsg.textContent = ''
    } else {
      badgeBlack.classList.add('turn-badge--idle')
      badgeWhite.classList.add('turn-badge--idle')
      endMsg.textContent = '和棋。'
    }

    board.setInteractive(canPlay)
    btnUndo.disabled =
      showBoardEndDialog || game.moveHistory.length === 0

    if (showBoardEndDialog) {
      boardEndDialog.classList.remove('board-local-dialog--hidden')
      queueMicrotask(() => btnBoardRestart.focus())
    } else {
      boardEndDialog.classList.add('board-local-dialog--hidden')
      endDrag.resetDrag()
    }

    ensureTurnTimer()
  }

  board.setOnMove((x, y) => {
    applyMove(game, x, y)
    refresh()
  })

  btnNew.addEventListener('click', () => {
    awaitingLocalTimeoutRestart = false
    newGame(game)
    refresh()
  })

  btnUndo.addEventListener('click', () => {
    undoLastMove(game)
    refresh()
  })

  board.mount(boardHost)
  boardHost.append(boardEndDialog)
  root.append(panel)
  refresh()

  return () => {
    stopTurnTimer()
    clearTimeoutHintLater()
    endDrag.cleanup()
    board.unmount()
    boardEndDialog.remove()
  }
}

function main() {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  app.innerHTML = ''

  const titleRow = document.createElement('div')
  titleRow.className = 'app-title-row'

  const titleIcon = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg',
  )
  titleIcon.setAttribute('class', 'app-title-icon')
  titleIcon.setAttribute('aria-hidden', 'true')
  titleIcon.setAttribute('focusable', 'false')
  const titleUse = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'use',
  )
  titleUse.setAttribute('href', `${import.meta.env.BASE_URL}icons.svg#gomoku-icon`)
  titleIcon.append(titleUse)

  const h1 = document.createElement('h1')
  h1.textContent = '五子棋'

  titleRow.append(titleIcon, h1)

  const sub = document.createElement('p')
  sub.className = 'subtitle'
  sub.textContent = '本地双人、人机对战或联网房间对局'

  const tabs = document.createElement('div')
  tabs.className = 'mode-tabs'
  tabs.setAttribute('role', 'tablist')
  tabs.setAttribute('aria-label', '对局模式')

  const btnPvE = document.createElement('button')
  btnPvE.type = 'button'
  btnPvE.setAttribute('role', 'tab')
  btnPvE.setAttribute('aria-selected', 'true')
  btnPvE.id = 'tab-pve'
  btnPvE.textContent = '人机对战'

  const btnLocal = document.createElement('button')
  btnLocal.type = 'button'
  btnLocal.setAttribute('role', 'tab')
  btnLocal.setAttribute('aria-selected', 'false')
  btnLocal.id = 'tab-local'
  btnLocal.textContent = '本地双人对弈'

  const btnOnline = document.createElement('button')
  btnOnline.type = 'button'
  btnOnline.setAttribute('role', 'tab')
  btnOnline.setAttribute('aria-selected', 'false')
  btnOnline.id = 'tab-online'
  btnOnline.textContent = '联网房间'

  tabs.append(btnPvE, btnLocal, btnOnline)

  const panelHost = document.createElement('div')
  panelHost.setAttribute('role', 'tabpanel')
  panelHost.setAttribute('aria-labelledby', 'tab-pve')

  app.append(titleRow, sub, tabs, panelHost)

  let onlineCleanup: (() => void) | null = null
  let localCleanup: (() => void) | null = null
  let pveCleanup: (() => void) | null = null

  function showLocal() {
    onlineCleanup?.()
    onlineCleanup = null
    pveCleanup?.()
    pveCleanup = null
    localCleanup?.()
    localCleanup = null
    btnLocal.setAttribute('aria-selected', 'true')
    btnPvE.setAttribute('aria-selected', 'false')
    btnOnline.setAttribute('aria-selected', 'false')
    panelHost.innerHTML = ''
    panelHost.setAttribute('aria-labelledby', 'tab-local')
    localCleanup = mountLocal(panelHost)
  }

  function showPvE() {
    onlineCleanup?.()
    onlineCleanup = null
    localCleanup?.()
    localCleanup = null
    pveCleanup?.()
    pveCleanup = null
    btnLocal.setAttribute('aria-selected', 'false')
    btnPvE.setAttribute('aria-selected', 'true')
    btnOnline.setAttribute('aria-selected', 'false')
    panelHost.innerHTML = ''
    panelHost.setAttribute('aria-labelledby', 'tab-pve')
    pveCleanup = mountPvE(panelHost)
  }

  function showOnline() {
    localCleanup?.()
    localCleanup = null
    pveCleanup?.()
    pveCleanup = null
    btnLocal.setAttribute('aria-selected', 'false')
    btnPvE.setAttribute('aria-selected', 'false')
    btnOnline.setAttribute('aria-selected', 'true')
    panelHost.innerHTML = ''
    panelHost.setAttribute('aria-labelledby', 'tab-online')
    onlineCleanup = attachOnlineMode(panelHost, {
      readSession,
      writeSession,
    })
  }

  btnLocal.addEventListener('click', showLocal)
  btnPvE.addEventListener('click', showPvE)
  btnOnline.addEventListener('click', showOnline)

  showPvE()
}

main()
