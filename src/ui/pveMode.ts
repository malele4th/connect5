import {
  applyMove,
  createGame,
  newGame,
  pickMove,
  toSnapshot,
  undoLastMove,
  type AiDifficulty,
  type GomokuGame,
} from '@/game/index.ts'
import type { Player } from '@/types/index.ts'
import { createBoardView } from '@/ui/boardView.ts'
import {
  attachBoardEndDialogDrag,
  createBoardEndOverlay,
  createStandardLocalBoardLayout,
} from '@/ui/boardLocalShared.ts'

const OTHER: Record<Player, Player> = { black: 'white', white: 'black' }

export function mountPvE(root: HTMLElement): () => void {
  const {
    panel,
    boardHost,
    badgeBlack,
    badgeWhite,
    timerLine,
    endMsg,
    btnNew,
    btnUndo,
    turnAboveBoard,
  } = createStandardLocalBoardLayout()

  timerLine.style.display = 'none'

  const pveBar = document.createElement('div')
  pveBar.className = 'pve-options-bar'

  const fieldColor = document.createElement('fieldset')
  fieldColor.className = 'pve-field'
  const legColor = document.createElement('legend')
  legColor.textContent = '执子'
  const labelHb = document.createElement('label')
  const radioHumanBlack = document.createElement('input')
  radioHumanBlack.type = 'radio'
  radioHumanBlack.name = 'pve-human-color'
  radioHumanBlack.value = 'black'
  radioHumanBlack.checked = true
  labelHb.append(radioHumanBlack, document.createTextNode('我执黑（先手）'))
  const labelHw = document.createElement('label')
  const radioHumanWhite = document.createElement('input')
  radioHumanWhite.type = 'radio'
  radioHumanWhite.name = 'pve-human-color'
  radioHumanWhite.value = 'white'
  labelHw.append(radioHumanWhite, document.createTextNode('我执白（后手）'))
  fieldColor.append(legColor, labelHb, labelHw)

  const fieldDiff = document.createElement('fieldset')
  fieldDiff.className = 'pve-field'
  const legDiff = document.createElement('legend')
  legDiff.textContent = '难度'
  const labelEasy = document.createElement('label')
  const radioEasy = document.createElement('input')
  radioEasy.type = 'radio'
  radioEasy.name = 'pve-difficulty'
  radioEasy.value = 'easy'
  labelEasy.append(radioEasy, document.createTextNode('简单'))
  const labelNormal = document.createElement('label')
  const radioNormal = document.createElement('input')
  radioNormal.type = 'radio'
  radioNormal.name = 'pve-difficulty'
  radioNormal.value = 'normal'
  radioNormal.checked = true
  labelNormal.append(radioNormal, document.createTextNode('普通'))
  fieldDiff.append(legDiff, labelEasy, labelNormal)

  pveBar.append(fieldColor, fieldDiff)
  turnAboveBoard.prepend(pveBar)

  let humanPlayer: Player = 'black'
  let difficulty: AiDifficulty = 'normal'

  function aiPlayer(): Player {
    return OTHER[humanPlayer]
  }

  function readDifficultyFromUi(): AiDifficulty {
    return radioEasy.checked ? 'easy' : 'normal'
  }

  let game: GomokuGame = createGame()
  const board = createBoardView(game.size)

  const {
    dialog: boardEndDialog,
    panel: boardEndPanel,
    title: boardEndTitle,
    btnRestart: btnBoardRestart,
  } = createBoardEndOverlay({ titleId: 'pve-board-end-title' })

  btnBoardRestart.addEventListener('click', () => {
    startMatch()
  })

  const endDrag = attachBoardEndDialogDrag(boardEndPanel, boardHost)

  let aiThinking = false

  function startMatch() {
    aiThinking = false
    newGame(game)
    refresh()
  }

  function pveUndo() {
    const snap = toSnapshot(game)
    if (snap.status !== 'playing' && snap.status !== 'draw') return
    if (game.moveHistory.length === 0) return
    undoLastMove(game)
    if (
      game.moveHistory.length > 0 &&
      game.currentPlayer !== humanPlayer
    ) {
      undoLastMove(game)
    }
    aiThinking = false
    refresh()
  }

  function scheduleAiMove() {
    if (game.status !== 'playing' || game.currentPlayer !== aiPlayer()) return
    if (aiThinking) return
    aiThinking = true
    refresh()
    const d = difficulty
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (game.status !== 'playing' || game.currentPlayer !== aiPlayer()) {
          aiThinking = false
          refresh()
          return
        }
        const choice = pickMove(game, aiPlayer(), { difficulty: d })
        if (
          choice &&
          game.status === 'playing' &&
          game.currentPlayer === aiPlayer()
        ) {
          applyMove(game, choice.x, choice.y)
        }
        aiThinking = false
        refresh()
      })
    })
  }

  function refresh() {
    const snap = toSnapshot(game)
    board.setSnapshot(snap)

    const playing = snap.status === 'playing'
    const humanTurn =
      playing && snap.currentPlayer === humanPlayer && !aiThinking

    const showBoardEndDialog =
      snap.status === 'black_win' || snap.status === 'white_win'

    if (snap.status === 'black_win') {
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
      if (snap.currentPlayer === 'black') {
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

    board.setInteractive(humanTurn)
    btnUndo.disabled =
      showBoardEndDialog ||
      game.moveHistory.length === 0 ||
      aiThinking

    fieldColor.disabled = playing || game.moveHistory.length > 0
    radioHumanBlack.disabled = fieldColor.disabled
    radioHumanWhite.disabled = fieldColor.disabled

    if (showBoardEndDialog) {
      boardEndDialog.classList.remove('board-local-dialog--hidden')
      queueMicrotask(() => btnBoardRestart.focus())
    } else {
      boardEndDialog.classList.add('board-local-dialog--hidden')
      endDrag.resetDrag()
    }

    if (playing && snap.currentPlayer === aiPlayer() && !aiThinking) {
      scheduleAiMove()
    }
  }

  board.setOnMove((x, y) => {
    if (game.currentPlayer !== humanPlayer || aiThinking) return
    applyMove(game, x, y, humanPlayer)
    refresh()
  })

  btnNew.addEventListener('click', () => {
    startMatch()
  })

  btnUndo.addEventListener('click', () => {
    pveUndo()
  })

  function onColorChange() {
    humanPlayer = radioHumanBlack.checked ? 'black' : 'white'
    aiThinking = false
    newGame(game)
    refresh()
  }

  radioHumanBlack.addEventListener('change', onColorChange)
  radioHumanWhite.addEventListener('change', onColorChange)

  function onDifficultyChange() {
    difficulty = readDifficultyFromUi()
  }

  radioEasy.addEventListener('change', onDifficultyChange)
  radioNormal.addEventListener('change', onDifficultyChange)

  board.mount(boardHost)
  boardHost.append(boardEndDialog)
  root.append(panel)
  refresh()

  return () => {
    endDrag.cleanup()
    board.unmount()
    boardEndDialog.remove()
  }
}
