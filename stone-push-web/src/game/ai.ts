// CPU AI（よわい＝ランダム合法手、ふつう＝1手先読みの貪欲評価、つよい＝2手先読みのミニマックス）
import { applyAggressiveMove, applyPassiveMove, legalAggressiveMoves, legalPassiveMoves } from './engine'
import { ALL_BOARD_POSITIONS, opponentOf, type Difficulty, type GameState, type Move, type Player } from './types'

export interface CpuTurn {
  passiveMove: Move
  aggressiveMove: Move
}

interface TurnCandidate {
  passiveMove: Move
  aggressiveMove: Move
  resultState: GameState
}

function randomOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// legalPassiveMoves は既にデッドエンド（アグレッシブ移動が1手も無いもの）を除外済みなので、
// 「パッシブ×アグレッシブ」の全組み合わせを列挙すれば必ず1件以上の有効な1ターン分の手が得られる
function enumerateTurns(state: GameState): TurnCandidate[] {
  const candidates: TurnCandidate[] = []
  for (const passiveMove of legalPassiveMoves(state)) {
    const afterPassive = applyPassiveMove(state, passiveMove)
    for (const aggressiveMove of legalAggressiveMoves(state, passiveMove)) {
      const resultState = applyAggressiveMove(afterPassive, aggressiveMove)
      candidates.push({ passiveMove, aggressiveMove, resultState })
    }
  }
  return candidates
}

// player視点の盤面評価値。石数差・全滅寸前ボーナス/ペナルティのみのシンプルな評価関数
function evaluate(state: GameState, player: Player): number {
  if (state.winner === player) return Number.POSITIVE_INFINITY
  if (state.winner) return Number.NEGATIVE_INFINITY

  const opponent = opponentOf(player)
  let score = 0
  for (const bp of ALL_BOARD_POSITIONS) {
    const stones = Object.values(state.boards[bp].stones)
    const mine = stones.filter((owner) => owner === player).length
    const theirs = stones.filter((owner) => owner === opponent).length
    score += (mine - theirs) * 10
    if (theirs === 1) score += 50 // 相手はあと1個押し出せば勝てる状況
    if (mine === 1) score -= 50 // 自分があと1個押し出されると負ける状況
  }
  return score
}

// ふつう：自分のターン直後の評価値が最も高い手を選ぶ（相手の応手は考慮しない1手先読み）
function chooseGreedy(state: GameState, candidates: TurnCandidate[]): TurnCandidate {
  const player = state.currentPlayer
  let bestScore = Number.NEGATIVE_INFINITY
  let bestCandidates: TurnCandidate[] = []
  for (const c of candidates) {
    const score = evaluate(c.resultState, player)
    if (score > bestScore) {
      bestScore = score
      bestCandidates = [c]
    } else if (score === bestScore) {
      bestCandidates.push(c)
    }
  }
  return randomOf(bestCandidates)
}

// 相手が「自分（player）の評価値を最小化する手」を選ぶと仮定した場合の、相手ターン後の評価値
function opponentReplyScore(state: GameState, player: Player): number {
  if (state.phase === 'GAME_OVER') return evaluate(state, player)
  const replies = enumerateTurns(state)
  if (replies.length === 0) return evaluate(state, player) // 合法なパッシブ移動が無い完全デッドロック時のフォールバック
  let worst = Number.POSITIVE_INFINITY
  for (const reply of replies) {
    const score = evaluate(reply.resultState, player)
    if (score < worst) worst = score
  }
  return worst
}

// つよい：自分のターン → 相手の最善の応手 まで見た2手先読みミニマックスで最も評価値が高い手を選ぶ
function chooseMinimax(state: GameState, candidates: TurnCandidate[]): TurnCandidate {
  const player = state.currentPlayer
  let bestScore = Number.NEGATIVE_INFINITY
  let bestCandidates: TurnCandidate[] = []
  for (const c of candidates) {
    const score = opponentReplyScore(c.resultState, player)
    if (score > bestScore) {
      bestScore = score
      bestCandidates = [c]
    } else if (score === bestScore) {
      bestCandidates.push(c)
    }
  }
  return randomOf(bestCandidates)
}

export function chooseCpuTurn(state: GameState): CpuTurn {
  const candidates = enumerateTurns(state)
  if (candidates.length === 0) throw new Error('CPU: 合法な手がありません')

  const chosen = chooseByDifficulty(state, candidates, state.difficulty)
  return { passiveMove: chosen.passiveMove, aggressiveMove: chosen.aggressiveMove }
}

function chooseByDifficulty(state: GameState, candidates: TurnCandidate[], difficulty: Difficulty): TurnCandidate {
  switch (difficulty) {
    case 'EASY':
      return randomOf(candidates)
    case 'NORMAL':
      return chooseGreedy(state, candidates)
    case 'HARD':
      return chooseMinimax(state, candidates)
  }
}
