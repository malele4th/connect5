import type { Cell, GameSnapshot, GameStatus, Player } from '../types/index.ts'

export const DEFAULT_BOARD_SIZE = 15

const OTHER: Record<Player, Player> = { black: 'white', white: 'black' }

export interface GomokuGame {
  size: number
  board: Cell[][]
  currentPlayer: Player
  status: GameStatus
  lastMove: { x: number; y: number } | null
  moveHistory: { x: number; y: number }[]
}

export interface ApplyMoveResult {
  ok: boolean
  reason?: 'game_over' | 'out_of_bounds' | 'occupied' | 'wrong_player'
  winner?: Player | null
  snapshot: GameSnapshot
}

function emptyBoard(size: number): Cell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 'empty' as Cell),
  )
}

export function createGame(size: number = DEFAULT_BOARD_SIZE): GomokuGame {
  return {
    size,
    board: emptyBoard(size),
    currentPlayer: 'black',
    status: 'playing',
    lastMove: null,
    moveHistory: [],
  }
}

export function toSnapshot(g: GomokuGame): GameSnapshot {
  return {
    size: g.size,
    board: g.board.map((row) => [...row]),
    currentPlayer: g.currentPlayer,
    status: g.status,
    lastMove: g.lastMove,
  }
}

function countDir(
  board: Cell[][],
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: Player,
): number {
  let n = 0
  let cx = x + dx
  let cy = y + dy
  const size = board.length
  while (
    cx >= 0 &&
    cx < size &&
    cy >= 0 &&
    cy < size &&
    board[cy]![cx] === player
  ) {
    n++
    cx += dx
    cy += dy
  }
  return n
}

export function isWinningMove(
  board: Cell[][],
  x: number,
  y: number,
  player: Player,
): boolean {
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ] as const
  for (const [dx, dy] of dirs) {
    const line =
      1 +
      countDir(board, x, y, dx, dy, player) +
      countDir(board, x, y, -dx, -dy, player)
    if (line >= 5) return true
  }
  return false
}

function isFull(board: Cell[][]): boolean {
  for (const row of board) {
    for (const c of row) {
      if (c === 'empty') return false
    }
  }
  return true
}

/**
 * 落子；黑先；五连及以上判胜；满盘无胜为和棋。
 * 终局后 currentPlayer 保持为刚落子一方（便于展示）。
 */
export function applyMove(
  g: GomokuGame,
  x: number,
  y: number,
  expectedPlayer?: Player,
): ApplyMoveResult {
  const snap = () => toSnapshot(g)
  if (g.status !== 'playing') {
    return { ok: false, reason: 'game_over', snapshot: snap() }
  }
  if (expectedPlayer !== undefined && g.currentPlayer !== expectedPlayer) {
    return { ok: false, reason: 'wrong_player', snapshot: snap() }
  }
  if (x < 0 || x >= g.size || y < 0 || y >= g.size) {
    return { ok: false, reason: 'out_of_bounds', snapshot: snap() }
  }
  if (g.board[y]![x] !== 'empty') {
    return { ok: false, reason: 'occupied', snapshot: snap() }
  }
  const p = g.currentPlayer
  g.board[y]![x] = p
  g.lastMove = { x, y }
  g.moveHistory.push({ x, y })
  if (isWinningMove(g.board, x, y, p)) {
    g.status = p === 'black' ? 'black_win' : 'white_win'
    return { ok: true, winner: p, snapshot: snap() }
  }
  if (isFull(g.board)) {
    g.status = 'draw'
    return { ok: true, winner: null, snapshot: snap() }
  }
  g.currentPlayer = OTHER[p]
  return { ok: true, winner: null, snapshot: snap() }
}

/** 本地限时思考：超时未落子则换手（不落子）。 */
export function passTurnOnTimeout(g: GomokuGame): boolean {
  if (g.status !== 'playing') return false
  g.currentPlayer = OTHER[g.currentPlayer]
  return true
}

/** 退一步（仅休闲）；终局也可悔一步恢复为 playing。 */
export function undoLastMove(g: GomokuGame): boolean {
  const last = g.moveHistory.pop()
  if (!last) return false
  g.board[last.y]![last.x] = 'empty'
  g.lastMove =
    g.moveHistory.length > 0
      ? g.moveHistory[g.moveHistory.length - 1]!
      : null
  g.status = 'playing'
  g.currentPlayer = g.moveHistory.length % 2 === 0 ? 'black' : 'white'
  return true
}

export function newGame(
  g: GomokuGame,
  size: number = g.size,
): void {
  const fresh = createGame(size)
  g.size = fresh.size
  g.board = fresh.board
  g.currentPlayer = fresh.currentPlayer
  g.status = fresh.status
  g.lastMove = fresh.lastMove
  g.moveHistory = fresh.moveHistory
}
