import type { GameSnapshot, Player } from '@/types/index.ts'

export const LOCAL_TURN_MS = 60_000
export const LOCAL_WARN_MS = 15_000

export function localPlayerCornerLabel(p: Player): string {
  return p === 'black' ? '「黑方」' : '「白方」'
}

export function createStandardLocalBoardLayout(): {
  panel: HTMLDivElement
  localBoardColumn: HTMLDivElement
  boardHost: HTMLDivElement
  statusRow: HTMLDivElement
  badgeBlack: HTMLDivElement
  badgeWhite: HTMLDivElement
  countdownEl: HTMLDivElement
  timerHintEl: HTMLDivElement
  timerLine: HTMLDivElement
  endMsg: HTMLDivElement
  btnNew: HTMLButtonElement
  btnUndo: HTMLButtonElement
  turnAboveBoard: HTMLDivElement
} {
  const panel = document.createElement('div')
  panel.className = 'panel'

  const statusRow = document.createElement('div')
  statusRow.className = 'local-status-row'

  const turnGroup = document.createElement('div')
  turnGroup.className = 'local-turn-group'
  turnGroup.setAttribute('role', 'group')
  turnGroup.setAttribute('aria-label', '行棋方')

  const badgeBlack = document.createElement('div')
  badgeBlack.className = 'turn-badge turn-badge--black'
  badgeBlack.textContent = '黑方行棋'
  badgeBlack.setAttribute('aria-label', '黑方行棋')

  const badgeWhite = document.createElement('div')
  badgeWhite.className = 'turn-badge turn-badge--white'
  badgeWhite.textContent = '白方行棋'
  badgeWhite.setAttribute('aria-label', '白方行棋')

  turnGroup.append(badgeBlack, badgeWhite)

  const timerLine = document.createElement('div')
  timerLine.className = 'local-timer-line'

  const countdownEl = document.createElement('div')
  countdownEl.className = 'local-countdown'
  countdownEl.setAttribute('aria-live', 'polite')

  const timerHintEl = document.createElement('div')
  timerHintEl.className = 'local-timer-hint'

  timerLine.append(countdownEl, timerHintEl)

  const endMsg = document.createElement('div')
  endMsg.className = 'local-end-msg'
  endMsg.setAttribute('role', 'status')
  endMsg.setAttribute('aria-live', 'polite')
  endMsg.setAttribute('aria-atomic', 'true')

  statusRow.append(turnGroup, timerLine, endMsg)

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

  const turnAboveBoard = document.createElement('div')
  turnAboveBoard.className = 'local-turn-above-board'
  turnAboveBoard.append(statusRow)

  const localBoardColumn = document.createElement('div')
  localBoardColumn.className = 'local-board-column'
  localBoardColumn.append(turnAboveBoard, boardRow)

  panel.append(localBoardColumn)

  return {
    panel,
    localBoardColumn,
    boardHost,
    statusRow,
    badgeBlack,
    badgeWhite,
    countdownEl,
    timerHintEl,
    timerLine,
    endMsg,
    btnNew,
    btnUndo,
    turnAboveBoard,
  }
}

export function createBoardEndOverlay(options: {
  titleId: string
}): {
  dialog: HTMLDivElement
  panel: HTMLDivElement
  title: HTMLParagraphElement
  btnRestart: HTMLButtonElement
} {
  const dialog = document.createElement('div')
  dialog.className = 'board-local-dialog board-local-dialog--hidden'
  dialog.setAttribute('role', 'alertdialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-labelledby', options.titleId)

  const panel = document.createElement('div')
  panel.className = 'board-local-dialog__panel'

  const title = document.createElement('p')
  title.id = options.titleId
  title.className = 'board-local-dialog__title'
  title.textContent = '「黑方」思考超时'

  const btnRestart = document.createElement('button')
  btnRestart.type = 'button'
  btnRestart.className = 'board-local-dialog__btn'
  btnRestart.textContent = '重新开始'

  panel.append(title, btnRestart)
  dialog.append(panel)

  return { dialog, panel, title, btnRestart }
}

export function attachBoardEndDialogDrag(
  boardEndPanel: HTMLElement,
  boardHost: HTMLElement,
): {
  resetDrag: () => void
  cleanup: () => void
} {
  let endPanelDragX = 0
  let endPanelDragY = 0
  let endPanelDragging = false
  let endPanelDragPointerId: number | null = null
  let endPanelDragStartClientX = 0
  let endPanelDragStartClientY = 0
  let endPanelDragOriginX = 0
  let endPanelDragOriginY = 0

  function applyEndPanelTransform() {
    boardEndPanel.style.transform =
      endPanelDragX === 0 && endPanelDragY === 0
        ? ''
        : `translate(${endPanelDragX}px, ${endPanelDragY}px)`
  }

  function clampEndPanelToBoardHost() {
    const margin = 6
    const hr = boardHost.getBoundingClientRect()
    const pr = boardEndPanel.getBoundingClientRect()
    let dx = 0
    let dy = 0
    if (pr.left < hr.left + margin) dx = hr.left + margin - pr.left
    if (pr.right > hr.right - margin) dx = hr.right - margin - pr.right
    if (pr.top < hr.top + margin) dy = hr.top + margin - pr.top
    if (pr.bottom > hr.bottom - margin) dy = hr.bottom - margin - pr.bottom
    if (dx !== 0) endPanelDragX += dx
    if (dy !== 0) endPanelDragY += dy
    if (dx !== 0 || dy !== 0) applyEndPanelTransform()
  }

  function resetDrag() {
    endPanelDragging = false
    endPanelDragPointerId = null
    endPanelDragX = 0
    endPanelDragY = 0
    boardEndPanel.classList.remove('board-local-dialog__panel--dragging')
    applyEndPanelTransform()
  }

  function onEndPanelPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = e.target
    if (!(el instanceof Element) || el.closest('button')) return
    endPanelDragging = true
    endPanelDragPointerId = e.pointerId
    endPanelDragStartClientX = e.clientX
    endPanelDragStartClientY = e.clientY
    endPanelDragOriginX = endPanelDragX
    endPanelDragOriginY = endPanelDragY
    boardEndPanel.classList.add('board-local-dialog__panel--dragging')
    boardEndPanel.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function onEndPanelPointerMove(e: PointerEvent) {
    if (!endPanelDragging || endPanelDragPointerId !== e.pointerId) {
      return
    }
    endPanelDragX =
      endPanelDragOriginX + (e.clientX - endPanelDragStartClientX)
    endPanelDragY =
      endPanelDragOriginY + (e.clientY - endPanelDragStartClientY)
    applyEndPanelTransform()
    clampEndPanelToBoardHost()
  }

  function onEndPanelPointerUp(e: PointerEvent) {
    if (endPanelDragPointerId !== e.pointerId) return
    endPanelDragging = false
    endPanelDragPointerId = null
    boardEndPanel.classList.remove('board-local-dialog__panel--dragging')
    try {
      boardEndPanel.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  boardEndPanel.addEventListener('pointerdown', onEndPanelPointerDown)
  boardEndPanel.addEventListener('pointermove', onEndPanelPointerMove)
  boardEndPanel.addEventListener('pointerup', onEndPanelPointerUp)
  boardEndPanel.addEventListener('pointercancel', onEndPanelPointerUp)

  return {
    resetDrag,
    cleanup() {
      boardEndPanel.removeEventListener('pointerdown', onEndPanelPointerDown)
      boardEndPanel.removeEventListener('pointermove', onEndPanelPointerMove)
      boardEndPanel.removeEventListener('pointerup', onEndPanelPointerUp)
      boardEndPanel.removeEventListener('pointercancel', onEndPanelPointerUp)
    },
  }
}

export interface LocalStyleTurnTimerConfig {
  getSnapshot: () => GameSnapshot
  isAwaitingTimeoutRestart: () => boolean
  /** 为 false 时不显示倒计时（例如 AI 思考或终局冻结） */
  shouldRunCountdown: (snap: GameSnapshot) => boolean
  onTurnTimeout: () => void
  els: {
    countdownEl: HTMLElement
    timerHintEl: HTMLElement
    timerLine: HTMLElement
  }
  turnMs?: number
  warnMs?: number
}

export function createLocalStyleTurnTimer(config: LocalStyleTurnTimerConfig) {
  const turnMs = config.turnMs ?? LOCAL_TURN_MS
  const warnMs = config.warnMs ?? LOCAL_WARN_MS

  let turnTimerId: ReturnType<typeof setInterval> | null = null
  let timerTrackedPlayer: Player | null = null
  let turnStartMs = 0
  let warnedSoon = false
  let timeoutHintClearId: ReturnType<typeof setTimeout> | null = null

  function stopTurnTimer() {
    if (turnTimerId !== null) {
      clearInterval(turnTimerId)
      turnTimerId = null
    }
  }

  function clearTimeoutHintLater() {
    if (timeoutHintClearId !== null) {
      clearTimeout(timeoutHintClearId)
      timeoutHintClearId = null
    }
  }

  function ensureTurnTimer() {
    const snap = config.getSnapshot()
    if (
      snap.status !== 'playing' ||
      config.isAwaitingTimeoutRestart() ||
      !config.shouldRunCountdown(snap)
    ) {
      stopTurnTimer()
      timerTrackedPlayer = null
      config.els.countdownEl.textContent = ''
      config.els.timerHintEl.textContent = ''
      config.els.timerLine.classList.remove('local-timer-warn')
      clearTimeoutHintLater()
      return
    }

    if (
      timerTrackedPlayer === snap.currentPlayer &&
      turnTimerId !== null
    ) {
      return
    }

    stopTurnTimer()
    timerTrackedPlayer = snap.currentPlayer
    warnedSoon = false
    config.els.timerLine.classList.remove('local-timer-warn')
    config.els.countdownEl.textContent = ''
    config.els.timerHintEl.textContent = ''
    clearTimeoutHintLater()

    turnStartMs = Date.now()
    turnTimerId = window.setInterval(() => {
      const s = config.getSnapshot()
      if (
        s.status !== 'playing' ||
        !config.shouldRunCountdown(s) ||
        s.currentPlayer !== timerTrackedPlayer
      ) {
        stopTurnTimer()
        timerTrackedPlayer = null
        return
      }
      const left = turnMs - (Date.now() - turnStartMs)
      if (left <= 0) {
        stopTurnTimer()
        timerTrackedPlayer = null
        config.onTurnTimeout()
        return
      }
      const sec = Math.ceil(left / 1000)
      config.els.countdownEl.textContent = `剩余 ${sec} 秒`
      if (left <= warnMs && !warnedSoon) {
        warnedSoon = true
        config.els.timerHintEl.textContent = '请尽快落子！'
        config.els.timerLine.classList.add('local-timer-warn')
      }
    }, 200)
  }

  return {
    stopTurnTimer,
    clearTimeoutHintLater,
    ensureTurnTimer,
  }
}
