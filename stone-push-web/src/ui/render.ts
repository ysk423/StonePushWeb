// 画面描画（DOM操作専用。ゲームロジックは game/ 側の純粋関数を呼ぶだけ）
import { initialState, legalAggressiveMoves, legalPassiveMoves } from '../game/engine'
import {
  ALL_BOARD_POSITIONS,
  BOARD_COLOR_OF,
  BOARD_SIZE,
  type BoardPosition,
  type Difficulty,
  type GameMode,
  type GameState,
  type Player,
  type Pos,
  posEquals,
  posKey,
} from '../game/types'
import { getDict, type Dict, type Lang } from '../i18n'

export interface StartHandlers {
  onStart: (mode: GameMode, humanPlayer: Player) => void
  onOpenRules: () => void
  onToggleLang: () => void
  onSelectDifficulty: (difficulty: Difficulty) => void
}

export interface GameHandlers {
  onCellClick: (boardPosition: BoardPosition, pos: Pos) => void
  onCancel: () => void
  onReset: () => void
  onBackToMenu: () => void
  onOpenRules: () => void
}

export interface RulesHandlers {
  onBack: () => void
}

// 後攻（白）でプレイする場合は自陣（白ホーム）が画面下側に来るよう上下の並びを入れ替える。左右のDARK/LIGHT配置は変えない
function boardRenderOrder(flipped: boolean): BoardPosition[] {
  return flipped ? ['BOTTOM_LEFT', 'BOTTOM_RIGHT', 'TOP_LEFT', 'TOP_RIGHT'] : ALL_BOARD_POSITIONS
}

const DIFFICULTIES: Difficulty[] = ['EASY', 'NORMAL', 'HARD']

function difficultyLabel(difficulty: Difficulty, dict: Dict): string {
  switch (difficulty) {
    case 'EASY':
      return dict.difficultyEasy
    case 'NORMAL':
      return dict.difficultyNormal
    case 'HARD':
      return dict.difficultyHard
  }
}

export function renderStart(container: HTMLElement, handlers: StartHandlers, lang: Lang, difficulty: Difficulty): void {
  const dict = getDict(lang)
  // スタート画面の装飾イラスト：実際の初期盤面をそのまま静的表示（操作不可）に流用
  const illustrationGame = initialState('VS_HUMAN', 'EASY', 'BLACK', 'BLACK')
  const emptyCells = new Set<string>()
  const illustrationBoards = ALL_BOARD_POSITIONS.map((bp, i) =>
    renderBoard(bp, dict.boardSlots[i], false, illustrationGame, emptyCells, emptyCells, false, dict),
  ).join('')

  const difficultyButtons = DIFFICULTIES.map(
    (d) =>
      `<button data-difficulty="${d}" type="button" class="difficulty-btn ${d === difficulty ? 'selected' : ''}">${difficultyLabel(d, dict)}</button>`,
  ).join('')

  container.innerHTML = `
    <section id="start-screen">
      <h1>${dict.title}</h1>
      <div class="start-illustration" aria-hidden="true">
        <div class="board-grid">${illustrationBoards}</div>
      </div>
      <div class="start-menu">
        <div class="vs-cpu-group">
          <p>${dict.vsCpuGroupTitle}</p>
          <div class="difficulty-select">${difficultyButtons}</div>
          <button id="btn-vs-cpu-black" type="button" class="menu-btn">${dict.playBlack}</button>
          <button id="btn-vs-cpu-white" type="button" class="menu-btn">${dict.playWhite}</button>
        </div>
        <button id="btn-vs-human" type="button" class="menu-btn">${dict.vsHuman}</button>
        <button id="btn-rules" type="button" class="menu-btn menu-btn-secondary">${dict.rulesLink}</button>
        <button id="btn-lang-toggle" type="button" class="menu-btn menu-btn-secondary">${dict.langButton}</button>
      </div>
    </section>
  `
  container.querySelector('#btn-vs-human')!.addEventListener('click', () => handlers.onStart('VS_HUMAN', 'BLACK'))
  container.querySelector('#btn-vs-cpu-black')!.addEventListener('click', () => handlers.onStart('VS_CPU', 'BLACK'))
  container.querySelector('#btn-vs-cpu-white')!.addEventListener('click', () => handlers.onStart('VS_CPU', 'WHITE'))
  container.querySelector('#btn-rules')!.addEventListener('click', handlers.onOpenRules)
  container.querySelector('#btn-lang-toggle')!.addEventListener('click', handlers.onToggleLang)
  container.querySelectorAll<HTMLButtonElement>('.difficulty-btn').forEach((btn) => {
    btn.addEventListener('click', () => handlers.onSelectDifficulty(btn.dataset.difficulty as Difficulty))
  })
}

export function renderRules(container: HTMLElement, handlers: RulesHandlers, lang: Lang): void {
  const dict = getDict(lang)
  container.innerHTML = `
    <section id="rules-screen">
      <div class="toolbar">
        <button id="btn-rules-back" type="button">${dict.back}</button>
        <div class="phase-indicator">${dict.rulesHeading}</div>
        <span></span>
      </div>

      <div class="rules-content">
        <h2>${dict.r1Title}</h2>
        <p>${dict.r1Body}</p>
        <div class="rules-board-diagram">
          <div class="rules-board-cell board-dark">${dict.diagTL}</div>
          <div class="rules-board-cell board-light">${dict.diagTR}</div>
          <div class="rules-board-cell board-light">${dict.diagBL}</div>
          <div class="rules-board-cell board-dark">${dict.diagBR}</div>
        </div>
        <p class="rules-caption">${dict.r1Caption}</p>

        <h2>${dict.r2Title}</h2>
        <p>${dict.r2Body}</p>

        <h2>${dict.r3Title}</h2>
        <ul>
          ${dict.r3Items.map((item) => `<li>${item}</li>`).join('')}
        </ul>

        <h2>${dict.r4Title}</h2>
        <ul>
          ${dict.r4Items.map((item) => `<li>${item}</li>`).join('')}
        </ul>
        <p class="rules-caption">${dict.r4Caption}</p>

        <h2>${dict.r5Title}</h2>
        <p>${dict.r5Body}</p>
      </div>
    </section>
  `
  container.querySelector('#btn-rules-back')!.addEventListener('click', handlers.onBack)
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

// フェーズごとに「移動先候補」の集合を算出（AGGRESSIVE_CONFIRMは選んだ石1つ分のみ＝方向・歩数固定のため常に1マス）
function computeDestinationCells(game: GameState): Set<string> {
  const set = new Set<string>()
  if (game.phase === 'PASSIVE_CONFIRM' && game.selectedPassiveFrom) {
    const sel = game.selectedPassiveFrom
    for (const m of legalPassiveMoves(game)) {
      if (m.boardPosition === sel.boardPosition && posEquals(m.from, sel.pos)) set.add(cellKey(m.boardPosition, m.to))
    }
  } else if (game.phase === 'AGGRESSIVE_CONFIRM' && game.passiveMove && game.selectedAggressiveFrom) {
    const sel = game.selectedAggressiveFrom
    for (const m of legalAggressiveMoves(game, game.passiveMove)) {
      if (m.boardPosition === sel.boardPosition && posEquals(m.from, sel.pos)) set.add(cellKey(m.boardPosition, m.to))
    }
  }
  return set
}

// アグレッシブフェーズ（石選択・移動先確定の両方）で使用できないボード（パッシブと同色）
function computeDimmedBoards(game: GameState): Set<BoardPosition> {
  const set = new Set<BoardPosition>()
  if ((game.phase === 'AGGRESSIVE_SELECT' || game.phase === 'AGGRESSIVE_CONFIRM') && game.passiveMove) {
    const passiveColor = BOARD_COLOR_OF[game.passiveMove.boardPosition]
    for (const bp of ALL_BOARD_POSITIONS) {
      if (BOARD_COLOR_OF[bp] === passiveColor) set.add(bp)
    }
  }
  return set
}

function phaseLabel(game: GameState, dict: Dict): string {
  switch (game.phase) {
    case 'PASSIVE_SELECT':
      return dict.phasePassiveSelect
    case 'PASSIVE_CONFIRM':
      return dict.phasePassiveConfirm
    case 'AGGRESSIVE_SELECT':
      return dict.phaseAggressiveSelect
    case 'AGGRESSIVE_CONFIRM':
      return dict.phaseAggressiveConfirm
    case 'GAME_OVER':
      return dict.phaseGameOver
  }
}

function renderBoard(
  bp: BoardPosition,
  screenLabel: string,
  flipped: boolean,
  game: GameState,
  movableCells: Set<string>,
  destinationCells: Set<string>,
  dimmed: boolean,
  dict: Dict,
): string {
  const board = game.boards[bp]
  let blackCount = 0
  let whiteCount = 0
  for (const owner of Object.values(board.stones)) {
    if (owner === 'BLACK') blackCount++
    else if (owner === 'WHITE') whiteCount++
  }

  const cells: string[] = []
  for (let visualRow = 0; visualRow < BOARD_SIZE; visualRow++) {
    // flipped時は行の描画順を反転させるだけで、内部座標(pos)は常に本来のrow/colのまま扱う
    const row = flipped ? BOARD_SIZE - 1 - visualRow : visualRow
    for (let col = 0; col < BOARD_SIZE; col++) {
      const pos: Pos = { row, col }
      const owner = board.stones[posKey(pos)]
      const key = cellKey(bp, pos)
      const isMovable = movableCells.has(key)
      const isDestination = destinationCells.has(key)
      const isSelected =
        (!!game.selectedPassiveFrom && game.selectedPassiveFrom.boardPosition === bp && posEquals(game.selectedPassiveFrom.pos, pos)) ||
        (!!game.selectedAggressiveFrom && game.selectedAggressiveFrom.boardPosition === bp && posEquals(game.selectedAggressiveFrom.pos, pos))
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
  // 残り1個＝次に押し出されたら敗北の危険な状態として数字を赤く強調する
  const blackCountClass = blackCount === 1 ? 'count-danger' : ''
  const whiteCountClass = whiteCount === 1 ? 'count-danger' : ''
  return `
    <div class="board ${colorClass} ${dimmed ? 'board-dimmed' : ''}" data-board="${bp}">
      <div class="board-header">
        <span class="board-name">${screenLabel}</span>
        <span class="board-count"><span class="${blackCountClass}">${dict.playerBlack}:${blackCount}</span> <span class="${whiteCountClass}">${dict.playerWhite}:${whiteCount}</span></span>
      </div>
      <div class="board-cells">${cells.join('')}</div>
    </div>
  `
}

function renderResult(game: GameState, dict: Dict): string {
  const winnerLabel = game.winner === 'BLACK' ? dict.playerBlack : game.winner === 'WHITE' ? dict.playerWhite : ''
  return `
    <div class="result-overlay">
      <div class="result-card">
        <h2>${dict.win(winnerLabel)}</h2>
        <button id="btn-play-again" type="button" class="menu-btn">${dict.playAgain}</button>
        <button id="btn-to-menu" type="button" class="menu-btn">${dict.backToMenu}</button>
      </div>
    </div>
  `
}

export function renderGame(container: HTMLElement, game: GameState, handlers: GameHandlers, lang: Lang): void {
  const dict = getDict(lang)
  const isCpuThinking = game.mode === 'VS_CPU' && game.currentPlayer !== game.humanPlayer && game.phase !== 'GAME_OVER'
  const canCancel = game.phase === 'PASSIVE_CONFIRM' || game.phase === 'AGGRESSIVE_SELECT' || game.phase === 'AGGRESSIVE_CONFIRM'
  // 後攻（白）でプレイ中は自陣が画面下に来るよう表示だけ反転させる（ゲーム内部の座標・ロジックは不変）
  const flipped = game.humanPlayer === 'WHITE'
  const boardOrder = boardRenderOrder(flipped)

  const movableCells = computeMovableCells(game)
  const destinationCells = computeDestinationCells(game)
  const dimmedBoards = computeDimmedBoards(game)
  const currentPlayerLabel = game.currentPlayer === 'BLACK' ? dict.playerBlack : dict.playerWhite

  container.innerHTML = `
    <section id="game-screen">
      <div class="toolbar">
        <button id="btn-back" type="button">${dict.back}</button>
        <div class="phase-indicator">${dict.turn(currentPlayerLabel, phaseLabel(game, dict))}</div>
        <button id="btn-cancel" type="button" ${canCancel ? '' : 'disabled'}>${dict.cancel}</button>
        <button id="btn-rules" type="button">${dict.rules}</button>
        <button id="btn-reset" type="button">${dict.reset}</button>
      </div>
      <div class="board-grid">
        ${boardOrder.map((bp, i) => renderBoard(bp, dict.boardSlots[i], flipped, game, movableCells, destinationCells, dimmedBoards.has(bp), dict)).join('')}
        <div class="border-label">${dict.border}</div>
      </div>
      ${isCpuThinking ? `<div class="cpu-thinking">${dict.cpuThinking}</div>` : ''}
      ${game.phase === 'GAME_OVER' ? renderResult(game, dict) : ''}
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
  container.querySelector('#btn-rules')?.addEventListener('click', handlers.onOpenRules)
  container.querySelector('#btn-reset')?.addEventListener('click', handlers.onReset)
  container.querySelector('#btn-play-again')?.addEventListener('click', handlers.onReset)
  container.querySelector('#btn-to-menu')?.addEventListener('click', handlers.onBackToMenu)
}
