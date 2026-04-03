import type { Cell, GameSnapshot, Player } from '@/types/index.ts'

const STAR_SET = new Set(
  [3, 7, 11].flatMap((a) => [3, 7, 11].map((b) => `${a},${b}`)),
)

function pieceLabel(c: Cell, x: number, y: number): string {
  if (c === 'black') return `黑子，${y + 1} 行 ${x + 1} 列`
  if (c === 'white') return `白子，${y + 1} 行 ${x + 1} 列`
  return `空位交叉点 ${y + 1} 行 ${x + 1} 列`
}

export interface BoardView {
  mount(parent: HTMLElement): void
  unmount(): void
  setSnapshot(s: GameSnapshot): void
  setInteractive(enabled: boolean): void
  setOnMove(cb: ((x: number, y: number) => void) | null): void
}

export function createBoardView(size: number): BoardView {
  const root = document.createElement('div')
  root.className = 'board-wrap'
  root.setAttribute('role', 'grid')
  root.setAttribute('aria-label', `${size} 路棋盘`)

  const grid = document.createElement('div')
  grid.className = 'board-grid'
  grid.style.setProperty('--n', String(size))

  const cells: HTMLButtonElement[][] = []
  let onMove: ((x: number, y: number) => void) | null = null
  let interactive = true

  for (let y = 0; y < size; y++) {
    const row: HTMLButtonElement[] = []
    for (let x = 0; x < size; x++) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'board-cell'
      if (STAR_SET.has(`${x},${y}`)) btn.classList.add('board-star')
      btn.setAttribute('aria-label', pieceLabel('empty', x, y))
      btn.disabled = false
      btn.addEventListener('click', () => {
        if (interactive && onMove) onMove(x, y)
      })
      grid.append(btn)
      row.push(btn)
    }
    cells.push(row)
  }

  root.append(grid)

  function paint(s: GameSnapshot) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const c = s.board[y]![x]!
        const btn = cells[y]![x]!
        btn.classList.remove('stone-black', 'stone-white', 'last-move')
        btn.setAttribute('aria-label', pieceLabel(c, x, y))
        if (c === 'black') btn.classList.add('stone-black')
        else if (c === 'white') btn.classList.add('stone-white')
        if (s.lastMove && s.lastMove.x === x && s.lastMove.y === y) {
          btn.classList.add('last-move')
        }
      }
    }
  }

  return {
    mount(parent: HTMLElement) {
      parent.append(root)
    },
    unmount() {
      root.remove()
    },
    setSnapshot(s: GameSnapshot) {
      paint(s)
    },
    setInteractive(enabled: boolean) {
      interactive = enabled
      for (const row of cells) {
        for (const btn of row) {
          btn.disabled = !enabled
        }
      }
    },
    setOnMove(cb: ((x: number, y: number) => void) | null) {
      onMove = cb
    },
  }
}

export function statusMessage(
  s: GameSnapshot,
  localLabel: (p: Player) => string,
): string {
  switch (s.status) {
    case 'playing':
      return `轮到${localLabel(s.currentPlayer)}行棋（${s.currentPlayer === 'black' ? '黑' : '白'}方）`
    case 'draw':
      return '和棋，棋盘已满。'
    case 'black_win':
      return `黑方胜。${localLabel('black')}获胜。`
    case 'white_win':
      return `白方胜。${localLabel('white')}获胜。`
    default:
      return ''
  }
}
