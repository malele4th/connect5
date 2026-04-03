import type { Cell, Player } from '../../types/index.ts'
import type { GomokuGame } from '../gomoku.ts'
import { isWinningMove } from '../gomoku.ts'

const OTHER: Record<Player, Player> = { black: 'white', white: 'black' }

export type AiDifficulty = 'easy' | 'normal'

export interface PickMoveOptions {
  difficulty?: AiDifficulty
}

const DIRS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
]

function lineRun(
  board: Cell[][],
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: Player,
  size: number,
): { len: number; openEnds: number } {
  let forward = 0
  let cx = x + dx
  let cy = y + dy
  while (
    cx >= 0 &&
    cx < size &&
    cy >= 0 &&
    cy < size &&
    board[cy]![cx] === player
  ) {
    forward++
    cx += dx
    cy += dy
  }
  const openForward =
    cx >= 0 &&
    cx < size &&
    cy >= 0 &&
    cy < size &&
    board[cy]![cx] === 'empty'

  let backward = 0
  cx = x - dx
  cy = y - dy
  while (
    cx >= 0 &&
    cx < size &&
    cy >= 0 &&
    cy < size &&
    board[cy]![cx] === player
  ) {
    backward++
    cx -= dx
    cy -= dy
  }
  const openBackward =
    cx >= 0 &&
    cx < size &&
    cy >= 0 &&
    cy < size &&
    board[cy]![cx] === 'empty'

  const len = 1 + forward + backward
  const openEnds = (openForward ? 1 : 0) + (openBackward ? 1 : 0)
  return { len, openEnds }
}

function patternWeight(len: number, openEnds: number): number {
  if (len >= 5) return 100_000
  if (len === 4) {
    if (openEnds >= 2) return 50_000
    if (openEnds === 1) return 12_000
    return 800
  }
  if (len === 3) {
    if (openEnds >= 2) return 4_000
    if (openEnds === 1) return 400
    return 40
  }
  if (len === 2) {
    if (openEnds >= 2) return 120
    if (openEnds === 1) return 25
    return 5
  }
  if (openEnds >= 2) return 15
  if (openEnds === 1) return 3
  return 1
}

/** 假设 (x,y) 已为 player，沿四线累加威胁分 */
function scorePointForPlayer(
  board: Cell[][],
  x: number,
  y: number,
  player: Player,
  size: number,
): number {
  let sum = 0
  for (const [dx, dy] of DIRS) {
    const { len, openEnds } = lineRun(board, x, y, dx, dy, player, size)
    sum += patternWeight(len, openEnds)
  }
  return sum
}

function potentialAt(
  board: Cell[][],
  x: number,
  y: number,
  player: Player,
  size: number,
): number {
  board[y]![x] = player
  const s = scorePointForPlayer(board, x, y, player, size)
  board[y]![x] = 'empty'
  return s
}

function centerBias(size: number, x: number, y: number): number {
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const d = Math.abs(x - cx) + Math.abs(y - cy)
  return Math.max(0, 24 - d * 2)
}

function collectEmpties(board: Cell[][], size: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y]![x] === 'empty') out.push({ x, y })
    }
  }
  return out
}

/**
 * 在 `game.currentPlayer === aiPlayer` 且 `status === 'playing'` 时返回一手合法坐标；
 * 满盘返回 `null`。
 */
export function pickMove(
  game: GomokuGame,
  aiPlayer: Player,
  options?: PickMoveOptions,
): { x: number; y: number } | null {
  if (game.status !== 'playing' || game.currentPlayer !== aiPlayer) return null

  const { board, size } = game
  const opp = OTHER[aiPlayer]
  const difficulty = options?.difficulty ?? 'normal'
  const defenseWeight = difficulty === 'easy' ? 1.0 : 1.18
  const attackWeight = difficulty === 'easy' ? 0.92 : 1

  const empties = collectEmpties(board, size)
  if (empties.length === 0) return null

  for (const { x, y } of empties) {
    board[y]![x] = aiPlayer
    const win = isWinningMove(board, x, y, aiPlayer)
    board[y]![x] = 'empty'
    if (win) return { x, y }
  }

  for (const { x, y } of empties) {
    board[y]![x] = opp
    const win = isWinningMove(board, x, y, opp)
    board[y]![x] = 'empty'
    if (win) return { x, y }
  }

  type Scored = { x: number; y: number; score: number }
  const scored: Scored[] = []
  for (const { x, y } of empties) {
    const attack = potentialAt(board, x, y, aiPlayer, size)
    const defense = potentialAt(board, x, y, opp, size)
    const score =
      attack * attackWeight + defense * defenseWeight + centerBias(size, x, y)
    scored.push({ x, y, score })
  }

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]!
  if (difficulty === 'easy' && scored.length >= 3) {
    const top = scored.slice(0, 3)
    const pick = top[Math.floor(Math.random() * top.length)]!
    return { x: pick.x, y: pick.y }
  }
  return { x: best.x, y: best.y }
}
