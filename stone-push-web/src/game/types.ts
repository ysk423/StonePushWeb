// ドメインモデル定義（DOM非依存の純粋な型・定数のみ）

export type Player = 'BLACK' | 'WHITE'

export type BoardColor = 'DARK' | 'LIGHT'

export type BoardPosition = 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT'

// AGGRESSIVE_SELECT: 動かす石を選ぶ／AGGRESSIVE_CONFIRM: 選んだ石の移動先（一意に決まる）を確定する
export type TurnPhase = 'PASSIVE_SELECT' | 'PASSIVE_CONFIRM' | 'AGGRESSIVE_SELECT' | 'AGGRESSIVE_CONFIRM' | 'GAME_OVER'

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD'

export type GameMode = 'VS_CPU' | 'VS_HUMAN'

export interface Pos {
  row: number
  col: number
}

export interface Direction {
  dr: number
  dc: number
}

// 8方向（縦・横・斜め）
export const ALL_DIRECTIONS: Direction[] = [
  { dr: -1, dc: -1 }, { dr: -1, dc: 0 }, { dr: -1, dc: 1 },
  { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
  { dr: 1, dc: -1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 },
]

export const ALL_BOARD_POSITIONS: BoardPosition[] = [
  'TOP_LEFT', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT',
]

// ボード位置ごとの色（左上・右下がDARK、右上・左下がLIGHT）
export const BOARD_COLOR_OF: Record<BoardPosition, BoardColor> = {
  TOP_LEFT: 'DARK',
  TOP_RIGHT: 'LIGHT',
  BOTTOM_LEFT: 'LIGHT',
  BOTTOM_RIGHT: 'DARK',
}

// ボード位置ごとのホームプレイヤー（上段2枚が白、下段2枚が黒）
export const HOME_PLAYER_OF: Record<BoardPosition, Player> = {
  TOP_LEFT: 'WHITE',
  TOP_RIGHT: 'WHITE',
  BOTTOM_LEFT: 'BLACK',
  BOTTOM_RIGHT: 'BLACK',
}

export const BOARD_SIZE = 4

// 1枚のボード上の石配置。key は `${row}_${col}`、値は石の所有者
export type StoneMap = Partial<Record<string, Player>>

export interface BoardState {
  position: BoardPosition
  color: BoardColor
  stones: StoneMap
}

export interface Move {
  boardPosition: BoardPosition
  from: Pos
  to: Pos
  direction: Direction
  steps: 1 | 2
}

export interface GameState {
  boards: Record<BoardPosition, BoardState>
  currentPlayer: Player
  phase: TurnPhase
  mode: GameMode
  difficulty: Difficulty
  humanPlayer: Player
  // PASSIVE_CONFIRM: どの石を選択中か
  selectedPassiveFrom: { boardPosition: BoardPosition; pos: Pos } | null
  // AGGRESSIVE_SELECT: 適用済みのパッシブ移動（方向・歩数の引き継ぎ、及びキャンセル時の巻き戻しに使用）
  passiveMove: Move | null
  // AGGRESSIVE_CONFIRM: どの石を選択中か
  selectedAggressiveFrom: { boardPosition: BoardPosition; pos: Pos } | null
  winner: Player | null
}

export function posKey(pos: Pos): string {
  return `${pos.row}_${pos.col}`
}

export function posEquals(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col
}

export function isInBounds(pos: Pos): boolean {
  return pos.row >= 0 && pos.row < BOARD_SIZE && pos.col >= 0 && pos.col < BOARD_SIZE
}

export function opponentOf(player: Player): Player {
  return player === 'BLACK' ? 'WHITE' : 'BLACK'
}

// あるプレイヤーのホームボード2枚
export function homeBoardsOf(player: Player): BoardPosition[] {
  return ALL_BOARD_POSITIONS.filter((bp) => HOME_PLAYER_OF[bp] === player)
}

// あるボード色と逆色のボード2枚（アグレッシブ移動の対象）
export function oppositeColorBoards(color: BoardColor): BoardPosition[] {
  const opposite: BoardColor = color === 'DARK' ? 'LIGHT' : 'DARK'
  return ALL_BOARD_POSITIONS.filter((bp) => BOARD_COLOR_OF[bp] === opposite)
}
