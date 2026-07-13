// 画面描画（DOM操作専用。ゲームロジックは game/ 側の純粋関数を呼ぶだけ）
import { legalAggressiveMoves, legalPassiveMoves } from '../game/engine'
import {
  ALL_BOARD_POSITIONS,
  BOARD_COLOR_OF,
  BOARD_SIZE,
  type BoardPosition,
  type GameMode,
  type GameState,
  type Player,
  type Pos,
  posEquals,
  posKey,
} from '../game/types'

export interface StartHandlers {
  onStart: (mode: GameMode, humanPlayer: Player) => void
}

export interface GameHandlers {
  onCellClick: (boardPosition: BoardPosition, pos: Pos) => void
  onCancel: () => void
  onReset: () => void
  onBackToMenu: () => void
}

const BOARD_LABEL: Record<BoardPosition, string> = {
  TOP_LEFT: '左上',
  TOP_RIGHT: '右上',
  BOTTOM_LEFT: '左下',
  BOTTOM_RIGHT: '右下',
}

const PLAYER_LABEL: Record<Player, string> = { BLACK: '黒', WHITE: '白' }

export function renderStart(container: HTMLElement, handlers: StartHandlers): void {
  container.innerHTML = `
    <section id="start-screen">
      <h1>Stone Push</h1>
      <div class="start-menu">
        <button id="btn-vs-human" type="button" class="menu-btn">vs 人間（パス＆プレイ）</button>
        <div class="vs-cpu-group">
          <p>vs CPU（やさしい）</p>
          <button id="btn-vs-cpu-black" type="button" class="menu-btn">先攻（黒）でプレイ</button>
          <button id="btn-vs-cpu-white" type="button" class="menu-btn">後攻（白）でプレイ</button>
        </div>
      </div>
    </section>
  `
  container.querySelector('#btn-vs-human')!.addEventListener('click', () => handlers.onStart('VS_HUMAN', 'BLACK'))
  container.querySelector('#btn-vs-cpu-black')!.addEventListener('click', () => handlers.onStart('VS_CPU', 'BLACK'))
  container.querySelector('#btn-vs-cpu-white')!.addEventListener('click', () => handlers.onStart('VS_CPU', 'WHITE'))
}

function cellKey(bp: BoardPosition, pos: Pos): string {
  return `${bp}:${posKey(pos)}`
}

// フェーズごとに「選択可能な石」の集合を算出
function computeMovableCells(game: GameState): Set<string> {
  const set = new Set<string>()
  if (game.phase === 'PASSIVE_SELECT') {
    for (const m of legalPassiveMoves(game)) set.add(cellKey(m.boardPosition, m.from))
  } else if (game.phase === 'AGGRESSIVE_SELECT' && game.passiveMove) {
    for (const m of legalAggressiveMoves(game, game.passiveMove)) set.add(cellKey(m.boardPosition, m.from))
  }
  return set
}

// フェーズごとに「移動先候補」の集合を算出
function computeDestinationCells(game: GameState): Set<string> {
  const set = new Set<string>()
  if (game.phase === 'PASSIVE_CONFIRM' && game.selectedPassiveFrom) {
    const sel = game.selectedPassiveFrom
    for (const m of legalPassiveMoves(game)) {
      if (m.boardPosition === sel.boardPosition && posEquals(m.from, sel.pos)) set.add(cellKey(m.boardPosition, m.to))
    }
  } else if (game.phase === 'AGGRESSIVE_SELECT' && game.passiveMove) {
    for (const m of legalAggressiveMoves(game, game.passiveMove)) set.add(cellKey(m.boardPosition, m.to))
  }
  return set
}

// アグレッシブフェーズで使用できないボード（パッシブと同色）
function computeDimmedBoards(game: GameState): Set<BoardPosition> {
  const set = new Set<BoardPosition>()
  if (game.phase === 'AGGRESSIVE_SELECT' && game.passiveMove) {
    const passiveColor = BOARD_COLOR_OF[game.passiveMove.boardPosition]
    for (const bp of ALL_BOARD_POSITIONS) {
      if (BOARD_COLOR_OF[bp] === passiveColor) set.add(bp)
    }
  }
  return set
}

function phaseLabel(game: GameState): string {
  switch (game.phase) {
    case 'PASSIVE_SELECT':
      return '動かす石を選んでください（セット）'
    case 'PASSIVE_CONFIRM':
      return '移動先を選んでください（セット）'
    case 'AGGRESSIVE_SELECT':
      return '逆色のボードで移動先を選んでください（プッシュ）'
    case 'GAME_OVER':
      return 'ゲーム終了'
  }
}

function renderBoard(
  bp: BoardPosition,
  game: GameState,
  movableCells: Set<string>,
  destinationCells: Set<string>,
  dimmed: boolean,
): string {
  const board = game.boards[bp]
  let blackCount = 0
  let whiteCount = 0
  for (const owner of Object.values(board.stones)) {
    if (owner === 'BLACK') blackCount++
    else if (owner === 'WHITE') whiteCount++
  }

  const cells: string[] = []
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const pos: Pos = { row, col }
      const owner = board.stones[posKey(pos)]
      const key = cellKey(bp, pos)
      const isMovable = movableCells.has(key)
      const isDestination = destinationCells.has(key)
      const isSelected = !!game.selectedPassiveFrom && game.selectedPassiveFrom.boardPosition === bp && posEquals(game.selectedPassiveFrom.pos, pos)
      const isDimmedOwnStone = game.phase === 'PASSIVE_SELECT' && owner === game.currentPlayer && !isMovable

      const classes = ['cell']
      if (owner) classes.push(`stone-${owner.toLowerCase()}`)
      if (isMovable) classes.push('movable')
      if (isSelected) classes.push('selected')
      if (isDestination) classes.push('destination')
      if (isDimmedOwnStone) classes.push('dimmed-stone')

      cells.push(
        `<div class="${classes.join(' ')}" data-board="${bp}" data-row="${row}" data-col="${col}">${owner ? '<span class="stone"></span>' : ''}</div>`,
      )
    }
  }

  const colorClass = board.color === 'DARK' ? 'board-dark' : 'board-light'
  return `
    <div class="board ${colorClass} ${dimmed ? 'board-dimmed' : ''}" data-board="${bp}">
      <div class="board-header">
        <span class="board-name">${BOARD_LABEL[bp]}</span>
        <span class="board-count">黒:${blackCount} 白:${whiteCount}</span>
      </div>
      <div class="board-cells">${cells.join('')}</div>
    </div>
  `
}

function renderResult(game: GameState): string {
  const winnerLabel = game.winner ? PLAYER_LABEL[game.winner] : ''
  return `
    <div class="result-overlay">
      <div class="result-card">
        <h2>${winnerLabel}の勝利！</h2>
        <button id="btn-play-again" type="button" class="menu-btn">もう一度</button>
        <button id="btn-to-menu" type="button" class="menu-btn">メニューに戻る</button>
      </div>
    </div>
  `
}

export function renderGame(container: HTMLElement, game: GameState, handlers: GameHandlers): void {
  const isCpuThinking = game.mode === 'VS_CPU' && game.currentPlayer !== game.humanPlayer && game.phase !== 'GAME_OVER'
  const canCancel = game.phase === 'PASSIVE_CONFIRM' || game.phase === 'AGGRESSIVE_SELECT'

  const movableCells = computeMovableCells(game)
  const destinationCells = computeDestinationCells(game)
  const dimmedBoards = computeDimmedBoards(game)

  container.innerHTML = `
    <section id="game-screen">
      <div class="toolbar">
        <button id="btn-back" type="button">← 戻る</button>
        <div class="phase-indicator">${PLAYER_LABEL[game.currentPlayer]}の番 ・ ${phaseLabel(game)}</div>
        <button id="btn-cancel" type="button" ${canCancel ? '' : 'disabled'}>✕ キャンセル</button>
        <button id="btn-reset" type="button">↺ リセット</button>
      </div>
      ${isCpuThinking ? '<div class="cpu-thinking">CPU 思考中…</div>' : ''}
      <div class="board-grid">
        ${ALL_BOARD_POSITIONS.map((bp) => renderBoard(bp, game, movableCells, destinationCells, dimmedBoards.has(bp))).join('')}
      </div>
      ${game.phase === 'GAME_OVER' ? renderResult(game) : ''}
    </section>
  `

  container.querySelectorAll<HTMLElement>('.cell').forEach((el) => {
    el.addEventListener('click', () => {
      const bp = el.dataset.board as BoardPosition
      const row = Number(el.dataset.row)
      const col = Number(el.dataset.col)
      handlers.onCellClick(bp, { row, col })
    })
  })
  container.querySelector('#btn-back')?.addEventListener('click', handlers.onBackToMenu)
  container.querySelector('#btn-cancel')?.addEventListener('click', handlers.onCancel)
  container.querySelector('#btn-reset')?.addEventListener('click', handlers.onReset)
  container.querySelector('#btn-play-again')?.addEventListener('click', handlers.onReset)
  container.querySelector('#btn-to-menu')?.addEventListener('click', handlers.onBackToMenu)
}
