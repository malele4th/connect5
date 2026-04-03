/** 执子方：黑先 */
export type Player = 'black' | 'white'

export type Cell = 'empty' | Player

export type GameStatus = 'playing' | 'draw' | 'black_win' | 'white_win'

export interface Coord {
  x: number
  y: number
}

export interface Move extends Coord {}

/** 可序列化的对局快照（联网同步用） */
export interface GameSnapshot {
  size: number
  board: Cell[][]
  currentPlayer: Player
  status: GameStatus
  lastMove: Coord | null
}
