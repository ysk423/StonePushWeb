import './style.css'
import * as engine from './game/engine'
import { chooseCpuTurn } from './game/ai'
import type { BoardPosition, Direction, GameMode, GameState, Move, Player, Pos } from './game/types'
import { posEquals } from './game/types'
import type { Lang } from './i18n'
import { renderGame, renderRules, renderStart } from './ui/render'

type MainScreen = { screen: 'start' } | { screen: 'game'; game: GameState }
type AppState = MainScreen | { screen: 'rules'; returnTo: MainScreen }

let appState: AppState = { screen: 'start' }
// フォロー（アグレッシブ移動）の押し出しアニメーション中は、盤面がまだ確定前の見た目のため操作を無効化する
let isAnimating = false
// 言語切替はスタート画面のボタンのみで行うグローバル設定（デフォルトは英語）
let lang: Lang = 'en'

const root = document.querySelector<HTMLDivElement>('#app')!

const PUSH_ANIMATION_MS = 260

function findCellEl(boardPosition: BoardPosition, pos: Pos): HTMLElement | null {
  return root.querySelector(`.cell[data-board="${boardPosition}"][data-row="${pos.row}"][data-col="${pos.col}"]`)
}

function findStoneEl(boardPosition: BoardPosition, pos: Pos): HTMLElement | null {
  return findCellEl(boardPosition, pos)?.querySelector('.stone') ?? null
}

// fromEl の中心が toEl の中心に重なるための移動量(px)
function centerOffset(fromEl: Element, toEl: Element): { dx: number; dy: number } {
  const a = fromEl.getBoundingClientRect()
  const b = toEl.getBoundingClientRect()
  return { dx: b.left + b.width / 2 - (a.left + a.width / 2), dy: b.top + b.height / 2 - (a.top + a.height / 2) }
}

// 盤外へ消える石用：cellSizeRefEl（同じボード上の1マス）を基準に、方向1マス分の移動量を算出する
function offBoardOffset(cellSizeRefEl: Element, dir: Direction): { dx: number; dy: number } {
  const rect = cellSizeRefEl.getBoundingClientRect()
  return { dx: rect.width * dir.dc, dy: rect.height * dir.dr }
}

function animateStone(el: HTMLElement, dx: number, dy: number, fadeOut: boolean): void {
  el.style.transition = `transform ${PUSH_ANIMATION_MS}ms ease, opacity ${PUSH_ANIMATION_MS}ms ease`
  el.style.zIndex = '5'
  requestAnimationFrame(() => {
    el.style.transform = `translate(${dx}px, ${dy}px)`
    if (fadeOut) el.style.opacity = '0'
  })
}

// リード（パッシブ移動）用：押し出しの無い単純なスライドのみ。フォローと同じ速度(PUSH_ANIMATION_MS)で揃える
// isAnimatingの管理は呼び出し側（CPUターン全体を通して1回だけtrue/falseにする）に委ねる
function animateSimpleMove(boardPosition: BoardPosition, from: Pos, to: Pos, onDone: () => void): void {
  const moverEl = findStoneEl(boardPosition, from)
  const destCellEl = findCellEl(boardPosition, to)
  if (!moverEl || !destCellEl) {
    onDone()
    return
  }
  const offset = centerOffset(moverEl, destCellEl)
  animateStone(moverEl, offset.dx, offset.dy, false)
  window.setTimeout(onDone, PUSH_ANIMATION_MS)
}

// アグレッシブ移動を「今表示されている盤面(beforeState)」から見た目だけアニメーションしてから、onDoneを呼ぶ。
// beforeStateは現在renderGame済みのDOMと一致している必要がある（移動元・押し出し対象の石要素を探すため）
// isAnimatingの管理は呼び出し側に委ねる（CPUターンではリードのアニメーションと合わせて1つの区間として扱うため）
function animatePush(beforeState: GameState, move: Move, onDone: () => void): void {
  const moverEl = findStoneEl(move.boardPosition, move.from)
  const destCellEl = findCellEl(move.boardPosition, move.to)
  if (!moverEl || !destCellEl) {
    onDone()
    return
  }

  const moverOffset = centerOffset(moverEl, destCellEl)
  animateStone(moverEl, moverOffset.dx, moverOffset.dy, false)

  const preview = engine.previewAggressiveMove(beforeState, move)
  if (preview.pushedFrom) {
    const pushedEl = findStoneEl(move.boardPosition, preview.pushedFrom)
    if (pushedEl) {
      if (preview.pushedTo) {
        const pushedDestCellEl = findCellEl(move.boardPosition, preview.pushedTo)
        const offset = pushedDestCellEl ? centerOffset(pushedEl, pushedDestCellEl) : offBoardOffset(destCellEl, move.direction)
        animateStone(pushedEl, offset.dx, offset.dy, false)
      } else {
        // 盤外へ押し出されて消滅
        const offset = offBoardOffset(destCellEl, move.direction)
        animateStone(pushedEl, offset.dx, offset.dy, true)
      }
    }
  }

  window.setTimeout(onDone, PUSH_ANIMATION_MS)
}

function setState(next: AppState): void {
  appState = next
  render()
}

function toggleLang(): void {
  lang = lang === 'ja' ? 'en' : 'ja'
  render()
}

function render(): void {
  if (appState.screen === 'start') {
    renderStart(root, { onStart: startGame, onOpenRules: () => openRules(appState as MainScreen), onToggleLang: toggleLang }, lang)
    return
  }
  if (appState.screen === 'rules') {
    const returnTo = appState.returnTo
    renderRules(root, { onBack: () => setState(returnTo) }, lang)
    return
  }
  renderGame(
    root,
    appState.game,
    {
      onCellClick: handleCellClick,
      onCancel: handleCancel,
      onReset: resetGame,
      onBackToMenu: () => setState({ screen: 'start' }),
      onOpenRules: () => openRules(appState as MainScreen),
    },
    lang,
  )
  scheduleCpuTurnIfNeeded()
}

function openRules(returnTo: MainScreen): void {
  setState({ screen: 'rules', returnTo })
}

function startGame(mode: GameMode, humanPlayer: Player): void {
  setState({ screen: 'game', game: engine.initialState(mode, 'EASY', humanPlayer, 'BLACK') })
}

function resetGame(): void {
  if (appState.screen !== 'game') return
  const { mode, difficulty, humanPlayer } = appState.game
  setState({ screen: 'game', game: engine.initialState(mode, difficulty, humanPlayer, 'BLACK') })
}

function isHumanTurn(game: GameState): boolean {
  return game.mode === 'VS_HUMAN' || game.currentPlayer === game.humanPlayer
}

function handleCellClick(boardPosition: BoardPosition, pos: Pos): void {
  if (isAnimating) return
  if (appState.screen !== 'game') return
  const game = appState.game
  if (game.phase === 'GAME_OVER' || !isHumanTurn(game)) return

  if (game.phase === 'PASSIVE_SELECT') {
    const isMovable = engine
      .legalPassiveMoves(game)
      .some((m) => m.boardPosition === boardPosition && posEquals(m.from, pos))
    if (isMovable) setState({ screen: 'game', game: engine.selectPassiveStone(game, boardPosition, pos) })
    return
  }

  if (game.phase === 'PASSIVE_CONFIRM' && game.selectedPassiveFrom) {
    const sel = game.selectedPassiveFrom
    if (sel.boardPosition === boardPosition && posEquals(sel.pos, pos)) {
      setState({ screen: 'game', game: engine.cancelPassiveSelection(game) })
      return
    }
    const chosen = engine
      .legalPassiveMoves(game)
      .find((m) => m.boardPosition === sel.boardPosition && posEquals(m.from, sel.pos) && m.boardPosition === boardPosition && posEquals(m.to, pos))
    if (chosen) setState({ screen: 'game', game: engine.applyPassiveMove(game, chosen) })
    return
  }

  if (game.phase === 'AGGRESSIVE_SELECT' && game.passiveMove) {
    const isMovable = engine
      .legalAggressiveMoves(game, game.passiveMove)
      .some((m) => m.boardPosition === boardPosition && posEquals(m.from, pos))
    if (isMovable) {
      setState({ screen: 'game', game: engine.selectAggressiveStone(game, boardPosition, pos) })
    } else {
      // ハイライトされていない場所をタップ → パッシブ移動を巻き戻してキャンセル
      setState({ screen: 'game', game: engine.cancelAggressiveAndRevertPassive(game) })
    }
    return
  }

  if (game.phase === 'AGGRESSIVE_CONFIRM' && game.passiveMove && game.selectedAggressiveFrom) {
    const sel = game.selectedAggressiveFrom
    if (sel.boardPosition === boardPosition && posEquals(sel.pos, pos)) {
      setState({ screen: 'game', game: engine.cancelAggressiveSelection(game) })
      return
    }
    // 選んだ石の移動先は方向・歩数固定のため一意に決まる
    const chosen = engine
      .legalAggressiveMoves(game, game.passiveMove)
      .find((m) => m.boardPosition === sel.boardPosition && posEquals(m.from, sel.pos) && m.boardPosition === boardPosition && posEquals(m.to, pos))
    if (chosen) {
      const after = engine.applyAggressiveMove(game, chosen)
      isAnimating = true
      animatePush(game, chosen, () => {
        isAnimating = false
        setState({ screen: 'game', game: after })
      })
    } else {
      setState({ screen: 'game', game: engine.cancelAggressiveAndRevertPassive(game) })
    }
  }
}

function handleCancel(): void {
  if (isAnimating) return
  if (appState.screen !== 'game') return
  const game = appState.game
  if (game.phase === 'PASSIVE_CONFIRM') setState({ screen: 'game', game: engine.cancelPassiveSelection(game) })
  else if (game.phase === 'AGGRESSIVE_SELECT') setState({ screen: 'game', game: engine.cancelAggressiveAndRevertPassive(game) })
  else if (game.phase === 'AGGRESSIVE_CONFIRM') setState({ screen: 'game', game: engine.cancelAggressiveSelection(game) })
}

function scheduleCpuTurnIfNeeded(): void {
  if (appState.screen !== 'game') return
  const game = appState.game
  if (game.mode !== 'VS_CPU' || game.phase === 'GAME_OVER' || game.currentPlayer === game.humanPlayer) return

  window.setTimeout(() => {
    // isAnimating中はrender()経由でこの関数が再呼び出しされても何もしない（リード→フォローの2段階アニメーション中に
    // 中間setStateがrender()→scheduleCpuTurnIfNeeded()を再トリガーし、CPUターンが二重に走ってしまうのを防ぐ）
    if (isAnimating) return
    if (appState.screen !== 'game') return
    const current = appState.game
    if (current.mode !== 'VS_CPU' || current.phase === 'GAME_OVER' || current.currentPlayer === current.humanPlayer) return
    const { passiveMove, aggressiveMove } = chooseCpuTurn(current)
    const afterPassive = engine.applyPassiveMove(current, passiveMove)
    const afterAggressive = engine.applyAggressiveMove(afterPassive, aggressiveMove)

    // リードとフォローを同じ速度(PUSH_ANIMATION_MS)で順番にスライドさせる（リードだけ無音瞬間移動になっていたのを解消）
    isAnimating = true
    animateSimpleMove(passiveMove.boardPosition, passiveMove.from, passiveMove.to, () => {
      setState({ screen: 'game', game: afterPassive })
      // アグレッシブ移動の対象ボードはパッシブ移動の影響を受けないため、afterPassiveのDOMからそのままアニメーションできる
      animatePush(afterPassive, aggressiveMove, () => {
        isAnimating = false
        setState({ screen: 'game', game: afterAggressive })
      })
    })
  }, 500)
}

render()
