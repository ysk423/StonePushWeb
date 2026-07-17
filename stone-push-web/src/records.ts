// 戦績（records コレクション）へのアクセスをこのモジュールに閉じ込め、main.ts/render.tsからFirestoreの詳細を隠蔽する
// vs人間（パス＆プレイ）は記録対象外。vs CPUで人間が勝った場合のみ記録する（render.tsのshouldOfferRecord参照）
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from './firebase'
import type { Difficulty } from './game/types'

export type RecordCategory = 'CPU_EASY' | 'CPU_NORMAL' | 'CPU_HARD'

export interface GameRecord {
  playerName: string
  category: RecordCategory
  moveCount: number
  stonesRemaining: number
}

export interface RankingEntry extends GameRecord {
  id: string
}

const RECORDS_COLLECTION = 'records'
const RANKING_LIMIT = 50
const NAME_MAX_LENGTH = 16

export function categoryFor(difficulty: Difficulty): RecordCategory {
  switch (difficulty) {
    case 'EASY':
      return 'CPU_EASY'
    case 'NORMAL':
      return 'CPU_NORMAL'
    case 'HARD':
      return 'CPU_HARD'
  }
}

export async function submitRecord(record: GameRecord): Promise<void> {
  await addDoc(collection(db, RECORDS_COLLECTION), {
    ...record,
    playerName: record.playerName.trim().slice(0, NAME_MAX_LENGTH),
    createdAt: serverTimestamp(),
  })
}

// 手数(moveCount)昇順、同数はcreatedAt昇順（先に達成した記録を上位に）でソートした上位N件を取得
export async function fetchRanking(category: RecordCategory): Promise<RankingEntry[]> {
  const q = query(
    collection(db, RECORDS_COLLECTION),
    where('category', '==', category),
    orderBy('moveCount', 'asc'),
    orderBy('createdAt', 'asc'),
    limit(RANKING_LIMIT),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      playerName: data.playerName as string,
      category: data.category as RecordCategory,
      moveCount: data.moveCount as number,
      stonesRemaining: data.stonesRemaining as number,
    }
  })
}
