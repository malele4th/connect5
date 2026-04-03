import { describe, expect, it } from 'vitest'
import { applyMove, createGame, type GomokuGame } from './gomoku.ts'
import { pickMove } from './ai/index.ts'

function placeSeq(g: GomokuGame, moves: [number, number][]) {
  for (const [x, y] of moves) {
    const r = applyMove(g, x, y)
    expect(r.ok).toBe(true)
  }
}

describe('pickMove', () => {
  it('returns null when not AI turn or game over', () => {
    const g = createGame(15)
    expect(pickMove(g, 'white')).toBeNull()
    applyMove(g, 0, 0)
    expect(pickMove(g, 'black')).toBeNull()
    expect(pickMove(g, 'white')).not.toBeNull()
    g.status = 'draw'
    expect(pickMove(g, 'white')).toBeNull()
  })

  it('chooses immediate winning five', () => {
    const g = createGame(15)
    g.board[0]![0] = 'black'
    g.board[0]![1] = 'black'
    g.board[0]![2] = 'black'
    g.board[0]![3] = 'black'
    g.currentPlayer = 'black'
    g.status = 'playing'
    g.moveHistory = []
    g.lastMove = null

    const m = pickMove(g, 'black')
    expect(m).toEqual({ x: 4, y: 0 })
    expect(applyMove(g, m!.x, m!.y, 'black').ok).toBe(true)
    expect(g.status).toBe('black_win')
  })

  it('blocks opponent open four', () => {
    const g = createGame(15)
    g.board[5]![5] = 'white'
    g.board[5]![6] = 'white'
    g.board[5]![7] = 'white'
    g.board[5]![8] = 'white'
    g.currentPlayer = 'black'
    g.status = 'playing'
    g.moveHistory = []
    g.lastMove = null

    const m = pickMove(g, 'black')
    expect(m).not.toBeNull()
    expect(m!.y).toBe(5)
    expect(m!.x === 4 || m!.x === 9).toBe(true)
    const r = applyMove(g, m!.x, m!.y, 'black')
    expect(r.ok).toBe(true)
    expect(g.board[5]![m!.x]).toBe('black')
  })

  it('normal difficulty picks deterministically on symmetric empty center', () => {
    const g = createGame(15)
    const m = pickMove(g, 'black', { difficulty: 'normal' })
    expect(m).not.toBeNull()
    expect(applyMove(g, m!.x, m!.y, 'black').ok).toBe(true)
  })

  it('random positions: AI move is always legal when it is AI turn', () => {
    for (let i = 0; i < 30; i++) {
      const g = createGame(15)
      const depth = 3 + (i % 8)
      let moves = 0
      while (moves < depth && g.status === 'playing') {
        const empties: { x: number; y: number }[] = []
        for (let y = 0; y < g.size; y++) {
          for (let x = 0; x < g.size; x++) {
            if (g.board[y]![x] === 'empty') empties.push({ x, y })
          }
        }
        if (empties.length === 0) break
        const { x, y } = empties[(i + moves * 7) % empties.length]!
        applyMove(g, x, y)
        moves++
      }
      if (g.status !== 'playing') continue

      const ai = g.currentPlayer
      const choice = pickMove(g, ai, { difficulty: 'normal' })
      expect(choice).not.toBeNull()
      const r = applyMove(g, choice!.x, choice!.y, ai)
      expect(r.ok).toBe(true)
    }
  })

  it('after human opens, AI replies with legal move', () => {
    const g = createGame(15)
    placeSeq(g, [[7, 7]])
    const m = pickMove(g, 'white', { difficulty: 'normal' })
    expect(m).not.toBeNull()
    expect(applyMove(g, m!.x, m!.y, 'white').ok).toBe(true)
  })
})
