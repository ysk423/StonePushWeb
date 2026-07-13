import './style.css'
import * as engine from './game/engine'
import { chooseCpuTurn } from './game/ai'
import type { BoardPosition, GameMode, GameState, Player, Pos } from './game/types'
import { posEquals } from './game/types'
import { renderGame, renderStart } from './ui/render'

type AppState = { screen: 'start' } | { screen: 'game'; game: GameState }

let appState: AppState = { screen: 'start' }

const root = document.querySelector<HTMLDivElement>('#app')!

function setState(next: AppState): void {
  appState = next
  render()
}

function render(): void {
  if (appState.screen === 'start') {
    renderStart(root, { onStart: startGame })
    return
  }
  renderGame(root, appState.game, {
    onCellClick: handleCellClick,
    onCancel: handleCancel,
    onReset: resetGame,
    onBackToMenu: () => setState({ screen: 'start' }),
  })
  scheduleCpuTurnIfNeeded()
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
    const chosen = engine
      .legalAggressiveMoves(game, game.passiveMove)
      .find((m) => m.boardPosition === boardPosition && posEquals(m.to, pos))
    if (chosen) {
      setState({ screen: 'game', game: engine.applyAggressiveMove(game, chosen) })
    } else {
      // ハイライトされていない場所をタップ → パッシブ移動を巻き戻してキャンセル
      setState({ screen: 'game', game: engine.cancelAggressiveAndRevertPassive(game) })
    }
  }
}

function handleCancel(): void {
  if (appState.screen !== 'game') return
  const game = appState.game
  if (game.phase === 'PASSIVE_CONFIRM') setState({ screen: 'game', game: engine.cancelPassiveSelection(game) })
  else if (game.phase === 'AGGRESSIVE_SELECT') setState({ screen: 'game', game: engine.cancelAggressiveAndRevertPassive(game) })
}

function scheduleCpuTurnIfNeeded(): void {
  if (appState.screen !== 'game') return
  const game = appState.game
  if (game.mode !== 'VS_CPU' || game.phase === 'GAME_OVER' || game.currentPlayer === game.humanPlayer) return

  window.setTimeout(() => {
    if (appState.screen !== 'game') return
    const current = appState.game
    if (current.mode !== 'VS_CPU' || current.phase === 'GAME_OVER' || current.currentPlayer === current.humanPlayer) return
    const { passiveMove, aggressiveMove } = chooseCpuTurn(current)
    const afterPassive = engine.applyPassiveMove(current, passiveMove)
    const afterAggressive = engine.applyAggressiveMove(afterPassive, aggressiveMove)
    setState({ screen: 'game', game: afterAggressive })
  }, 500)
}

render()
