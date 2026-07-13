// ゲームロジック（状態遷移・純粋関数のみ、DOM非依存）
import {
  ALL_BOARD_POSITIONS,
  ALL_DIRECTIONS,
  BOARD_COLOR_OF,
  BOARD_SIZE,
  type BoardPosition,
  type BoardState,
  type Difficulty,
  type Direction,
  type GameMode,
  type GameState,
  type Move,
  type Player,
  type Pos,
  type StoneMap,
  homeBoardsOf,
  isInBounds,
  opponentOf,
  oppositeColorBoards,
  posKey,
}
from './types'

function stoneAt(board: BoardState, pos: Pos): Player | undefined {
  return board.stones[posKey(pos)]
}

function cloneBoard(board: BoardState): BoardState {
  return { ...board, stones: { ...board.stones } as StoneMap }
}

function cloneBoards(boards: Record<BoardPosition, BoardState>): Record<BoardPosition, BoardState> {
  const result = {} as Record<BoardPosition, BoardState>
  for (const bp of ALL_BOARD_POSITIONS) result[bp] = cloneBoard(boards[bp])
  return result
}

function addStep(pos: Pos, dir: Direction, steps: number): Pos {
  return { row: pos.row + dir.dr * steps, col: pos.col + dir.dc * steps }
}

// 初期状態：全4ボードで黒=row3全列・白=row0全列
export function initialState(
  mode: GameMode,
  difficulty: Difficulty,
  humanPlayer: Player,
  firstPlayer: Player = 'BLACK',
): GameState {
  const boards = {} as Record<BoardPosition, BoardState>
  for (const bp of ALL_BOARD_POSITIONS) {
    const stones: StoneMap = {}
    for (let col = 0; col < BOARD_SIZE; col++) {
      stones[posKey({ row: 3, col })] = 'BLACK'
      stones[posKey({ row: 0, col })] = 'WHITE'
    }
    boards[bp] = { position: bp, color: BOARD_COLOR_OF[bp], stones }
  }
  return {
    boards,
    currentPlayer: firstPlayer,
    phase: 'PASSIVE_SELECT',
    mode,
    difficulty,
    humanPlayer,
    selectedPassiveFrom: null,
    passiveMove: null,
    winner: null,
  }
}

// パッシブ移動の経路（中間マス＋目的地）が全て空かどうか
function isLegalPassiveMove(board: BoardState, from: Pos, dir: Direction, steps: 1 | 2): Pos | null {
  const dest = addStep(from, dir, steps)
  if (!isInBounds(dest)) return null
  const path: Pos[] = steps === 2 ? [addStep(from, dir, 1), dest] : [dest]
  if (path.some((p) => stoneAt(board, p) !== undefined)) return null
  return dest
}

// あるボード上の、あるプレイヤーの合法パッシブ移動を全列挙（デッドエンドフィルタなし）
function rawPassiveMovesForBoard(board: BoardState, player: Player): Move[] {
  const moves: Move[] = []
  for (const key of Object.keys(board.stones)) {
    if (board.stones[key] !== player) continue
    const [row, col] = key.split('_').map(Number)
    const from: Pos = { row, col }
    for (const dir of ALL_DIRECTIONS) {
      for (const steps of [1, 2] as const) {
        const dest = isLegalPassiveMove(board, from, dir, steps)
        if (dest) moves.push({ boardPosition: board.position, from, to: dest, direction: dir, steps })
      }
    }
  }
  return moves
}

interface PushResolution {
  destination: Pos
  pushedEnemyFrom: Pos | null
  pushedEnemyTo: Pos | null // null = ボード外へ押し出され消滅
}

// アグレッシブ移動の合法判定＋押し出し結果の算出
function resolveAggressiveMove(
  board: BoardState,
  player: Player,
  from: Pos,
  dir: Direction,
  steps: 1 | 2,
): PushResolution | null {
  const dest = addStep(from, dir, steps)
  if (!isInBounds(dest)) return null // 自石のボード外移動は不可
  const opponent = opponentOf(player)
  const path: Pos[] = steps === 2 ? [addStep(from, dir, 1), dest] : [dest]

  if (path.some((p) => stoneAt(board, p) === player)) return null // 自分の石を途中・目的地に押すのは不可

  const enemyCells = path.filter((p) => stoneAt(board, p) === opponent)
  if (enemyCells.length > 1) return null // 相手の石を2個以上連続で押すのは不可

  if (enemyCells.length === 0) {
    return { destination: dest, pushedEnemyFrom: null, pushedEnemyTo: null }
  }

  const enemyPos = enemyCells[0]
  const pushedTo = addStep(dest, dir, 1)
  if (isInBounds(pushedTo)) {
    if (stoneAt(board, pushedTo) !== undefined) return null // 押し先に石があれば2個同時押しになり不可
    return { destination: dest, pushedEnemyFrom: enemyPos, pushedEnemyTo: pushedTo }
  }
  // ボード外へ押し出し（消滅）
  return { destination: dest, pushedEnemyFrom: enemyPos, pushedEnemyTo: null }
}

// パッシブ移動に対応する合法アグレッシブ移動を列挙（逆色ボード×自分の石）
export function legalAggressiveMoves(state: GameState, passiveMove: Move): Move[] {
  const player = state.currentPlayer
  const boards = oppositeColorBoards(BOARD_COLOR_OF[passiveMove.boardPosition])
  const moves: Move[] = []
  for (const bp of boards) {
    const board = state.boards[bp]
    for (const key of Object.keys(board.stones)) {
      if (board.stones[key] !== player) continue
      const [row, col] = key.split('_').map(Number)
      const from: Pos = { row, col }
      const resolution = resolveAggressiveMove(board, player, from, passiveMove.direction, passiveMove.steps)
      if (resolution) {
        moves.push({
          boardPosition: bp,
          from,
          to: resolution.destination,
          direction: passiveMove.direction,
          steps: passiveMove.steps,
        })
      }
    }
  }
  return moves
}

// 現在の手番の合法パッシブ移動（デッドエンド＝アグレッシブ移動が1手も無いものは除外）
export function legalPassiveMoves(state: GameState): Move[] {
  const player = state.currentPlayer
  const raw: Move[] = []
  for (const bp of homeBoardsOf(player)) {
    raw.push(...rawPassiveMovesForBoard(state.boards[bp], player))
  }
  return raw.filter((move) => legalAggressiveMoves(state, move).length > 0)
}

export function applyPassiveMove(state: GameState, move: Move): GameState {
  const boards = cloneBoards(state.boards)
  const board = boards[move.boardPosition]
  delete board.stones[posKey(move.from)]
  board.stones[posKey(move.to)] = state.currentPlayer
  return {
    ...state,
    boards,
    phase: 'AGGRESSIVE_SELECT',
    selectedPassiveFrom: null,
    passiveMove: move,
  }
}

export function applyAggressiveMove(state: GameState, move: Move): GameState {
  const player = state.currentPlayer
  const boards = cloneBoards(state.boards)
  const sourceBoard = state.boards[move.boardPosition] // 押し出し解決は変更前の状態で算出
  const resolution = resolveAggressiveMove(sourceBoard, player, move.from, move.direction, move.steps)
  if (!resolution) throw new Error('不正なアグレッシブ移動です')

  const board = boards[move.boardPosition]
  delete board.stones[posKey(move.from)]
  if (resolution.pushedEnemyFrom) {
    delete board.stones[posKey(resolution.pushedEnemyFrom)]
    if (resolution.pushedEnemyTo) {
      board.stones[posKey(resolution.pushedEnemyTo)] = opponentOf(player)
    }
  }
  board.stones[posKey(resolution.destination)] = player

  const winner = checkWinner(boards)
  if (winner) {
    return {
      ...state,
      boards,
      phase: 'GAME_OVER',
      winner,
      passiveMove: null,
      selectedPassiveFrom: null,
    }
  }
  return {
    ...state,
    boards,
    phase: 'PASSIVE_SELECT',
    currentPlayer: opponentOf(player),
    passiveMove: null,
    selectedPassiveFrom: null,
  }
}

// いずれかのボードで相手の石が0個になっていれば、直前に動いたプレイヤーの勝利
function checkWinner(boards: Record<BoardPosition, BoardState>): Player | null {
  for (const bp of ALL_BOARD_POSITIONS) {
    const board = boards[bp]
    const blackCount = Object.values(board.stones).filter((p) => p === 'BLACK').length
    const whiteCount = Object.values(board.stones).filter((p) => p === 'WHITE').length
    if (blackCount === 0) return 'WHITE'
    if (whiteCount === 0) return 'BLACK'
  }
  return null
}

// PASSIVE_SELECT: 石を選択 → PASSIVE_CONFIRM
export function selectPassiveStone(state: GameState, boardPosition: BoardPosition, pos: Pos): GameState {
  return { ...state, phase: 'PASSIVE_CONFIRM', selectedPassiveFrom: { boardPosition, pos } }
}

// PASSIVE_CONFIRM: 同じ石を再タップ → PASSIVE_SELECTへ戻る
export function cancelPassiveSelection(state: GameState): GameState {
  return { ...state, phase: 'PASSIVE_SELECT', selectedPassiveFrom: null }
}

// AGGRESSIVE_SELECT: キャンセル → パッシブ移動を手動で逆適用してPASSIVE_SELECTへ戻る
export function cancelAggressiveAndRevertPassive(state: GameState): GameState {
  if (!state.passiveMove) return state
  const boards = cloneBoards(state.boards)
  const board = boards[state.passiveMove.boardPosition]
  delete board.stones[posKey(state.passiveMove.to)]
  board.stones[posKey(state.passiveMove.from)] = state.currentPlayer
  return {
    ...state,
    boards,
    phase: 'PASSIVE_SELECT',
    passiveMove: null,
    selectedPassiveFrom: null,
  }
}
