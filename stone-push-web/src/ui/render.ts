// 画面描画（DOM操作専用。ゲームロジックは game/ 側の純粋関数を呼ぶだけ）
import { initialState, legalAggressiveMoves, legalPassiveMoves } from '../game/engine'
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
  onOpenRules: () => void
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

// 画面上の描画スロット（左上→右上→左下→右下）のラベル。boardRenderOrder()の並びと対応する
const SCREEN_SLOT_LABELS = ['左上', '右上', '左下', '右下']

const PLAYER_LABEL: Record<Player, string> = { BLACK: '黒', WHITE: '白' }

// 後攻（白）でプレイする場合は自陣（白ホーム）が画面下側に来るよう上下の並びを入れ替える。左右のDARK/LIGHT配置は変えない
function boardRenderOrder(flipped: boolean): BoardPosition[] {
  return flipped ? ['BOTTOM_LEFT', 'BOTTOM_RIGHT', 'TOP_LEFT', 'TOP_RIGHT'] : ALL_BOARD_POSITIONS
}

export function renderStart(container: HTMLElement, handlers: StartHandlers): void {
  // スタート画面の装飾イラスト：実際の初期盤面をそのまま静的表示（操作不可）に流用
  const illustrationGame = initialState('VS_HUMAN', 'EASY', 'BLACK', 'BLACK')
  const emptyCells = new Set<string>()
  const illustrationBoards = ALL_BOARD_POSITIONS.map((bp, i) =>
    renderBoard(bp, SCREEN_SLOT_LABELS[i], false, illustrationGame, emptyCells, emptyCells, false),
  ).join('')

  container.innerHTML = `
    <section id="start-screen">
      <h1>Stone Push</h1>
      <div class="start-illustration" aria-hidden="true">
        <div class="board-grid">${illustrationBoards}</div>
      </div>
      <div class="start-menu">
        <button id="btn-vs-human" type="button" class="menu-btn">vs 人間（パス＆プレイ）</button>
        <div class="vs-cpu-group">
          <p>vs CPU（やさしい）</p>
          <button id="btn-vs-cpu-black" type="button" class="menu-btn">先攻（黒）でプレイ</button>
          <button id="btn-vs-cpu-white" type="button" class="menu-btn">後攻（白）でプレイ</button>
        </div>
        <button id="btn-rules" type="button" class="menu-btn menu-btn-secondary">ℹ ルール説明</button>
      </div>
    </section>
  `
  container.querySelector('#btn-vs-human')!.addEventListener('click', () => handlers.onStart('VS_HUMAN', 'BLACK'))
  container.querySelector('#btn-vs-cpu-black')!.addEventListener('click', () => handlers.onStart('VS_CPU', 'BLACK'))
  container.querySelector('#btn-vs-cpu-white')!.addEventListener('click', () => handlers.onStart('VS_CPU', 'WHITE'))
  container.querySelector('#btn-rules')!.addEventListener('click', handlers.onOpenRules)
}

export function renderRules(container: HTMLElement, handlers: RulesHandlers): void {
  container.innerHTML = `
    <section id="rules-screen">
      <div class="toolbar">
        <button id="btn-rules-back" type="button">← 戻る</button>
        <div class="phase-indicator">ルール説明</div>
        <span></span>
      </div>

      <div class="rules-content">
        <h2>1. 盤面構成</h2>
        <p>4×4のボードが2×2で合計4枚並ぶ。左上と右下が <strong>DARK</strong>、右上と左下が <strong>LIGHT</strong>（対角が同色）。上段2枚が白のホーム、下段2枚が黒のホーム。</p>
        <div class="rules-board-diagram">
          <div class="rules-board-cell board-dark">左上（DARK）<br>白ホーム</div>
          <div class="rules-board-cell board-light">右上（LIGHT）<br>白ホーム</div>
          <div class="rules-board-cell board-light">左下（LIGHT）<br>黒ホーム</div>
          <div class="rules-board-cell board-dark">右下（DARK）<br>黒ホーム</div>
        </div>
        <p class="rules-caption">中央の境界線が「ボーダー」（対局画面にも同じ位置に表示される）。初期配置は全4ボード共通で、黒は一番手前の行、白は一番奥の行に4個ずつ並ぶ。</p>

        <h2>2. ターンの流れ</h2>
        <p>1ターン＝「リード」と「フォロー」を<strong>必ず両方</strong>行う。先手は黒。</p>

        <h2>3. リード</h2>
        <ul>
          <li>自分のホームボード（2枚のうちどちらか）で、自分の石を1つ選ぶ</li>
          <li>縦・横・斜め（8方向）に1〜2マス動かす</li>
          <li>途中のマスや移動先に石がある場合は動かせない（押せない・飛び越せない）</li>
          <li>自分の石をボード外に出すことはできない</li>
        </ul>

        <h2>4. フォロー</h2>
        <ul>
          <li>リードで使ったボードと<strong>逆色</strong>のボード（自分・相手どちらのホームでもよい）で行う</li>
          <li>動かす石を選ぶと、移動方向・歩数はリードと<strong>同じ</strong>に固定されるため、移動先は自動的に1マスに決まる（確認のうえタップで確定）</li>
          <li>相手の石は1個までなら押し出せる（押さなくてもよい）</li>
          <li>相手の石を2個以上連続で押すことはできない</li>
          <li>自分の石を途中や目的地に押す・飛び越すことはできない</li>
          <li>押し出された相手の石はボード外に消える（復活しない）</li>
        </ul>
        <p class="rules-caption">リードした結果、フォローできる手が1つも無い場合、そのリード自体を選ぶことはできない（画面上でも最初から選択肢に出ない）。</p>

        <h2>5. 勝利条件</h2>
        <p>4枚のボードのうち、<strong>いずれか1枚から相手の石を4個すべて押し出した</strong>プレイヤーの勝利。</p>
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

function phaseLabel(game: GameState): string {
  switch (game.phase) {
    case 'PASSIVE_SELECT':
      return '動かす石を選んでください（リード）'
    case 'PASSIVE_CONFIRM':
      return '移動先を選んでください（リード）'
    case 'AGGRESSIVE_SELECT':
      return '逆色のボードで動かす石を選んでください（フォロー）'
    case 'AGGRESSIVE_CONFIRM':
      return '移動先を確定してください（フォロー）'
    case 'GAME_OVER':
      return 'ゲーム終了'
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
        <span class="board-count"><span class="${blackCountClass}">黒:${blackCount}</span> <span class="${whiteCountClass}">白:${whiteCount}</span></span>
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
  const canCancel = game.phase === 'PASSIVE_CONFIRM' || game.phase === 'AGGRESSIVE_SELECT' || game.phase === 'AGGRESSIVE_CONFIRM'
  // 後攻（白）でプレイ中は自陣が画面下に来るよう表示だけ反転させる（ゲーム内部の座標・ロジックは不変）
  const flipped = game.humanPlayer === 'WHITE'
  const boardOrder = boardRenderOrder(flipped)

  const movableCells = computeMovableCells(game)
  const destinationCells = computeDestinationCells(game)
  const dimmedBoards = computeDimmedBoards(game)

  container.innerHTML = `
    <section id="game-screen">
      <div class="toolbar">
        <button id="btn-back" type="button">← 戻る</button>
        <div class="phase-indicator">${PLAYER_LABEL[game.currentPlayer]}の番 ・ ${phaseLabel(game)}</div>
        <button id="btn-cancel" type="button" ${canCancel ? '' : 'disabled'}>✕ キャンセル</button>
        <button id="btn-rules" type="button">ℹ ルール</button>
        <button id="btn-reset" type="button">↺ リセット</button>
      </div>
      <div class="board-grid">
        ${boardOrder.map((bp, i) => renderBoard(bp, SCREEN_SLOT_LABELS[i], flipped, game, movableCells, destinationCells, dimmedBoards.has(bp))).join('')}
        <div class="border-label">ボーダー</div>
      </div>
      ${isCpuThinking ? '<div class="cpu-thinking">CPU 思考中…</div>' : ''}
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
  container.querySelector('#btn-rules')?.addEventListener('click', handlers.onOpenRules)
  container.querySelector('#btn-reset')?.addEventListener('click', handlers.onReset)
  container.querySelector('#btn-play-again')?.addEventListener('click', handlers.onReset)
  container.querySelector('#btn-to-menu')?.addEventListener('click', handlers.onBackToMenu)
}
