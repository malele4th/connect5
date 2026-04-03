import { describe, expect, it } from 'vitest'
import {
  applyMove,
  createGame,
  isWinningMove,
  newGame,
  passTurnOnTimeout,
  undoLastMove,
} from './gomoku.ts'

describe('applyMove', () => {
  it('rejects occupied and out of bounds', () => {
    const g = createGame(15)
    expect(applyMove(g, 7, 7).ok).toBe(true)
    expect(applyMove(g, 7, 7).ok).toBe(false)
    expect(applyMove(g, -1, 0).ok).toBe(false)
    expect(applyMove(g, 15, 0).ok).toBe(false)
  })

  it('detects horizontal win (>=5)', () => {
    const g = createGame(15)
    const pairs: [number, number][] = [
      [0, 0],
      [10, 10],
      [1, 0],
      [10, 11],
      [2, 0],
      [10, 12],
      [3, 0],
      [10, 13],
      [4, 0],
    ]
    for (const [x, y] of pairs) {
      applyMove(g, x, y)
    }
    expect(g.status).toBe('black_win')
  })

  it('detects diagonal win', () => {
    const g = createGame(15)
    const seq: [number, number][] = [
      [0, 0],
      [10, 0],
      [1, 1],
      [10, 1],
      [2, 2],
      [10, 2],
      [3, 3],
      [10, 3],
      [4, 4],
      [10, 4],
      [5, 5],
    ]
    for (const [x, y] of seq) {
      applyMove(g, x, y)
    }
    expect(g.status).toBe('black_win')
  })

  it('declares draw when board is full without winner', () => {
    const g = createGame(3)
    const moves: [number, number][] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 0],
      [1, 2],
      [2, 1],
      [2, 0],
      [2, 2],
    ]
    for (const [x, y] of moves) {
      applyMove(g, x, y)
    }
    expect(g.status).toBe('draw')
  })

  it('enforces expectedPlayer for online', () => {
    const g = createGame(5)
    expect(applyMove(g, 0, 0, 'white').ok).toBe(false)
    expect(applyMove(g, 0, 0, 'black').ok).toBe(true)
  })
})

describe('undoLastMove', () => {
  it('restores turn order', () => {
    const g = createGame(15)
    applyMove(g, 1, 1)
    applyMove(g, 2, 2)
    expect(g.currentPlayer).toBe('black')
    undoLastMove(g)
    expect(g.currentPlayer).toBe('white')
    expect(g.board[2]![2]).toBe('empty')
  })
})

describe('newGame', () => {
  it('clears board', () => {
    const g = createGame(15)
    applyMove(g, 0, 0)
    newGame(g)
    expect(g.board[0]![0]).toBe('empty')
    expect(g.status).toBe('playing')
    expect(g.currentPlayer).toBe('black')
  })
})

describe('passTurnOnTimeout', () => {
  it('switches player without placing', () => {
    const g = createGame(15)
    expect(g.currentPlayer).toBe('black')
    passTurnOnTimeout(g)
    expect(g.currentPlayer).toBe('white')
    passTurnOnTimeout(g)
    expect(g.currentPlayer).toBe('black')
  })
})

describe('isWinningMove', () => {
  it('counts five in a line', () => {
    const g = createGame(15)
    g.board[0]![0] = g.board[0]![1] = g.board[0]![2] = g.board[0]![3] = 'black'
    expect(isWinningMove(g.board, 4, 0, 'black')).toBe(true)
  })
})
