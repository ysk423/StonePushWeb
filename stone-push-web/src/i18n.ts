// 多言語対応（日本語／英語）。UI文言はすべてここに集約し、render.ts側は辞書引きのみ行う
export type Lang = 'ja' | 'en'

export interface Dict {
  title: string
  vsHuman: string
  vsCpuGroupTitle: string
  difficultyEasy: string
  difficultyNormal: string
  difficultyHard: string
  playBlack: string
  playWhite: string
  rulesLink: string
  rankingLink: string
  langButton: string
  back: string
  cancel: string
  rules: string
  reset: string
  cpuThinking: string
  border: string
  playAgain: string
  backToMenu: string
  win: (player: string) => string
  turn: (player: string, phase: string) => string
  phasePassiveSelect: string
  phasePassiveConfirm: string
  phaseAggressiveSelect: string
  phaseAggressiveConfirm: string
  phaseGameOver: string
  playerBlack: string
  playerWhite: string
  boardSlots: [string, string, string, string]
  rulesHeading: string
  r1Title: string
  r1Body: string
  diagTL: string
  diagTR: string
  diagBL: string
  diagBR: string
  r1Caption: string
  r2Title: string
  r2Body: string
  r3Title: string
  r3Items: string[]
  r4Title: string
  r4Items: string[]
  r4Caption: string
  r5Title: string
  r5Body: string

  // ランキング画面
  rankingTitle: string
  categoryHuman: string
  categoryCpuEasy: string
  categoryCpuNormal: string
  categoryCpuHard: string
  rankCol: string
  nameCol: string
  movesCol: string
  stonesCol: string
  rankingLoading: string
  rankingError: string
  rankingEmpty: string

  // 対局結果画面の名前入力ダイアログ
  recordDialogTitle: string
  recordNamePlaceholder: string
  recordSubmit: string
  recordSkip: string
  recordSubmitting: string
  recordDone: string
  recordError: string
}

const ja: Dict = {
  title: 'Stone Push',
  vsHuman: 'vs 人間（パス＆プレイ）',
  vsCpuGroupTitle: 'vs CPU',
  difficultyEasy: 'よわい',
  difficultyNormal: 'ふつう',
  difficultyHard: 'つよい',
  playBlack: '先攻（黒）でプレイ',
  playWhite: '後攻（白）でプレイ',
  rulesLink: 'ℹ ルール説明',
  rankingLink: '🏆 ランキング',
  langButton: 'English',
  back: '← 戻る',
  cancel: '✕ キャンセル',
  rules: 'ℹ ルール',
  reset: '↺ リセット',
  cpuThinking: 'CPU 思考中…',
  border: 'ボーダー',
  playAgain: 'もう一度',
  backToMenu: 'メニューに戻る',
  win: (p) => `${p}の勝利！`,
  turn: (p, ph) => `${p}の番 ・ ${ph}`,
  phasePassiveSelect: '動かす石を選んでください（リード）',
  phasePassiveConfirm: '移動先を選んでください（リード）',
  phaseAggressiveSelect: '逆色のボードで動かす石を選んでください（フォロー）',
  phaseAggressiveConfirm: '移動先を確定してください（フォロー）',
  phaseGameOver: 'ゲーム終了',
  playerBlack: '黒',
  playerWhite: '白',
  boardSlots: ['左上', '右上', '左下', '右下'],
  rulesHeading: 'ルール説明',
  r1Title: '1. 盤面構成',
  r1Body:
    '4×4のボードが2×2で合計4枚並ぶ。左上と右下が <strong>DARK</strong>、右上と左下が <strong>LIGHT</strong>（対角が同色）。上段2枚が白のホーム、下段2枚が黒のホーム。',
  diagTL: '左上（DARK）<br>白ホーム',
  diagTR: '右上（LIGHT）<br>白ホーム',
  diagBL: '左下（LIGHT）<br>黒ホーム',
  diagBR: '右下（DARK）<br>黒ホーム',
  r1Caption:
    '中央の境界線が「ボーダー」（対局画面にも同じ位置に表示される）。初期配置は全4ボード共通で、黒は一番手前の行、白は一番奥の行に4個ずつ並ぶ。',
  r2Title: '2. ターンの流れ',
  r2Body: '1ターン＝「リード」と「フォロー」を<strong>必ず両方</strong>行う。先手は黒。',
  r3Title: '3. リード',
  r3Items: [
    '自分のホームボード（2枚のうちどちらか）で、自分の石を1つ選ぶ',
    '縦・横・斜め（8方向）に1〜2マス動かす',
    '途中のマスや移動先に石がある場合は動かせない（押せない・飛び越せない）',
    '自分の石をボード外に出すことはできない',
  ],
  r4Title: '4. フォロー',
  r4Items: [
    'リードで使ったボードと<strong>逆色</strong>のボード（自分・相手どちらのホームでもよい）で行う',
    '動かす石を選ぶと、移動方向・歩数はリードと<strong>同じ</strong>に固定されるため、移動先は自動的に1マスに決まる（確認のうえタップで確定）',
    '相手の石は1個までなら押し出せる（押さなくてもよい）',
    '相手の石を2個以上連続で押すことはできない',
    '自分の石を途中や目的地に押す・飛び越すことはできない',
    '押し出された相手の石はボード外に消える（復活しない）',
  ],
  r4Caption: 'リードした結果、フォローできる手が1つも無い場合、そのリード自体を選ぶことはできない（画面上でも最初から選択肢に出ない）。',
  r5Title: '5. 勝利条件',
  r5Body: '4枚のボードのうち、<strong>いずれか1枚から相手の石を4個すべて押し出した</strong>プレイヤーの勝利。',

  rankingTitle: 'ランキング',
  categoryHuman: 'vs 人間',
  categoryCpuEasy: 'CPU（よわい）',
  categoryCpuNormal: 'CPU（ふつう）',
  categoryCpuHard: 'CPU（つよい）',
  rankCol: '順位',
  nameCol: '名前',
  movesCol: '手数',
  stonesCol: '残り石数',
  rankingLoading: '読み込み中…',
  rankingError: '読み込みに失敗しました',
  rankingEmpty: 'まだ記録がありません',

  recordDialogTitle: '勝利おめでとうございます！名前を入力するとランキングに登録できます',
  recordNamePlaceholder: '名前（16文字まで）',
  recordSubmit: '登録する',
  recordSkip: 'スキップ',
  recordSubmitting: '送信中…',
  recordDone: '登録しました！',
  recordError: '登録に失敗しました。通信環境をご確認のうえもう一度お試しください',
}

const en: Dict = {
  title: 'Stone Push',
  vsHuman: 'vs Human (pass & play)',
  vsCpuGroupTitle: 'vs CPU',
  difficultyEasy: 'Easy',
  difficultyNormal: 'Normal',
  difficultyHard: 'Hard',
  playBlack: 'Play as Black (first)',
  playWhite: 'Play as White (second)',
  rulesLink: 'ℹ How to Play',
  rankingLink: '🏆 Ranking',
  langButton: '日本語',
  back: '← Back',
  cancel: '✕ Cancel',
  rules: 'ℹ Rules',
  reset: '↺ Reset',
  cpuThinking: 'CPU thinking…',
  border: 'Border',
  playAgain: 'Play Again',
  backToMenu: 'Back to Menu',
  win: (p) => `${p} wins!`,
  turn: (p, ph) => `${p}'s turn - ${ph}`,
  phasePassiveSelect: 'Select a stone to move (Lead)',
  phasePassiveConfirm: 'Select a destination (Lead)',
  phaseAggressiveSelect: 'Select a stone on the opposite-color board (Follow)',
  phaseAggressiveConfirm: 'Confirm the destination (Follow)',
  phaseGameOver: 'Game Over',
  playerBlack: 'Black',
  playerWhite: 'White',
  boardSlots: ['Top-Left', 'Top-Right', 'Bottom-Left', 'Bottom-Right'],
  rulesHeading: 'How to Play',
  r1Title: '1. Board Layout',
  r1Body:
    'The board is made up of four 4×4 boards arranged in a 2×2 grid. Top-left and bottom-right are <strong>DARK</strong>, top-right and bottom-left are <strong>LIGHT</strong> (diagonal pairs share a color). The top two boards are White’s home, the bottom two are Black’s home.',
  diagTL: 'Top-Left (DARK)<br>White Home',
  diagTR: 'Top-Right (LIGHT)<br>White Home',
  diagBL: 'Bottom-Left (LIGHT)<br>Black Home',
  diagBR: 'Bottom-Right (DARK)<br>Black Home',
  r1Caption:
    'The line across the middle is the "Border" (shown in the same position during a match). All four boards start the same way: Black occupies the row nearest you with 4 stones, White occupies the far row with 4 stones.',
  r2Title: '2. Turn Flow',
  r2Body: 'Each turn always consists of <strong>both</strong> a "Lead" and a "Follow" move. Black moves first.',
  r3Title: '3. Lead',
  r3Items: [
    'Choose one of your own stones on one of your home boards (either of the two).',
    'Move it 1–2 squares in any of the 8 directions (orthogonal or diagonal).',
    'You cannot move through or onto a square that already has a stone (no pushing, no jumping).',
    'You cannot move your own stone off the board.',
  ],
  r4Title: '4. Follow',
  r4Items: [
    'Performed on a board of the <strong>opposite color</strong> to the one used for the Lead (either player’s home board).',
    'Once you choose a stone to move, its direction and distance are <strong>fixed to match the Lead</strong>, so the destination is determined automatically (tap to confirm).',
    'You may push at most one opposing stone (pushing is optional).',
    'You cannot push two or more opposing stones in a row.',
    'You cannot push through or onto your own stone.',
    'A pushed opposing stone that goes off the board is removed permanently.',
  ],
  r4Caption:
    'If a Lead move would leave no legal Follow move, that Lead move cannot be selected in the first place (it won’t appear as an option).',
  r5Title: '5. Win Condition',
  r5Body: 'The first player to push <strong>all 4 of the opponent’s stones off any single board</strong> wins.',

  rankingTitle: 'Ranking',
  categoryHuman: 'vs Human',
  categoryCpuEasy: 'CPU (Easy)',
  categoryCpuNormal: 'CPU (Normal)',
  categoryCpuHard: 'CPU (Hard)',
  rankCol: 'Rank',
  nameCol: 'Name',
  movesCol: 'Moves',
  stonesCol: 'Stones Left',
  rankingLoading: 'Loading…',
  rankingError: 'Failed to load',
  rankingEmpty: 'No records yet',

  recordDialogTitle: 'You won! Enter your name to add it to the ranking',
  recordNamePlaceholder: 'Name (up to 16 characters)',
  recordSubmit: 'Submit',
  recordSkip: 'Skip',
  recordSubmitting: 'Submitting…',
  recordDone: 'Recorded!',
  recordError: 'Failed to submit. Please check your connection and try again',
}

export function getDict(lang: Lang): Dict {
  return lang === 'ja' ? ja : en
}
