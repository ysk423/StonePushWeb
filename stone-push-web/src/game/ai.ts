// CPU AI（MVPスコープ：やさしい＝ランダム合法手のみ）
import { legalAggressiveMoves, legalPassiveMoves } from './engine'
import type { GameState, Move } from './types'

export interface CpuTurn {
  passiveMove: Move
  aggressiveMove: Move
}

function randomOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// legalPassiveMoves は既にデッドエンド（アグレッシブ移動が1手も無いもの）を除外済みなので、
// ここでランダムに選ぶだけで必ず有効な1ターン分の手が組み立てられる
export function chooseCpuTurn(state: GameState): CpuTurn {
  const passiveCandidates = legalPassiveMoves(state)
  if (passiveCandidates.length === 0) throw new Error('CPU: 合法なパッシブ移動がありません')
  const passiveMove = randomOf(passiveCandidates)

  const aggressiveCandidates = legalAggressiveMoves(state, passiveMove)
  if (aggressiveCandidates.length === 0) throw new Error('CPU: デッドエンドでないはずのパッシブ移動でアグレッシブ移動が見つかりません')
  const aggressiveMove = randomOf(aggressiveCandidates)

  return { passiveMove, aggressiveMove }
}
