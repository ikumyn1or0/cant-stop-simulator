/**
 * キャントストップのゲーム進行（2人対戦）。
 *
 * 1ターン分の局面表現は cantstop.ts の TurnState をそのまま使い、
 * バースト判定や確率計算は同モジュールの関数に委譲する。
 */

import {
  COLUMNS,
  COLUMN_HEIGHT,
  MAX_RUNNERS,
  PAIRINGS,
  isPlayableSum,
  type Roll,
  type Runner,
  type TurnState,
} from './cantstop';
import type { Rng } from './rng';

export type PlayerId = 0 | 1;

/** 勝利に必要な獲得列数。 */
export const COLUMNS_TO_WIN = 3;

/**
 * 手番の進行状態。
 *
 * - `roll`   : サイコロを振る前
 * - `choose` : 出目が出て、どの和を進めるか選ぶ
 * - `decide` : 進めた直後。もう一度振るか、止めるかを選ぶ
 * - `busted` : 進められる和がなくバーストした
 * - `finished`: 決着
 */
export type Phase = 'roll' | 'choose' | 'decide' | 'busted' | 'finished';

export type Move = {
  /** PAIRINGS のインデックス。 */
  pairing: number;
  /** 進める和。適用順で、長さは1か2。 */
  sums: number[];
};

export type GameState = {
  /** 各プレイヤーの恒久進捗（前のターンまでに確定した段）。 */
  progress: [Record<number, number>, Record<number, number>];
  /** 獲得済みの列と、その所有者。 */
  claimedBy: Record<number, PlayerId>;
  current: PlayerId;
  /** 手番プレイヤーのランナー。 */
  runners: Runner[];
  /** 未処理の出目。 */
  roll: Roll | null;
  phase: Phase;
  winner: PlayerId | null;
  /** 今のターンで何回振ったか。 */
  rollsThisTurn: number;
};

export function createGame(): GameState {
  return {
    progress: [{}, {}],
    claimedBy: {},
    current: 0,
    runners: [],
    roll: null,
    phase: 'roll',
    winner: null,
    rollsThisTurn: 0,
  };
}

export function opponentOf(player: PlayerId): PlayerId {
  return player === 0 ? 1 : 0;
}

/** 獲得済みの列の一覧。 */
export function clearedColumns(game: GameState): number[] {
  return COLUMNS.filter(c => game.claimedBy[c] !== undefined);
}

/** 手番プレイヤーから見た1ターン分の局面。cantstop.ts の関数にそのまま渡せる。 */
export function turnStateOf(game: GameState): TurnState {
  return {
    runners: game.runners,
    clearedColumns: clearedColumns(game),
    progress: game.progress[game.current],
  };
}

/** そのプレイヤーが獲得した列の数。 */
export function claimedCount(game: GameState, player: PlayerId): number {
  return COLUMNS.filter(c => game.claimedBy[c] === player).length;
}

/** 和 sum の列を1段進めた局面を返す。ランナーがいなければ恒久進捗の1つ上に置く。 */
function advance(state: TurnState, sum: number): TurnState {
  const runner = state.runners.find(r => r.column === sum);
  if (runner) {
    return {
      ...state,
      runners: state.runners.map(r => (r.column === sum ? { column: sum, position: r.position + 1 } : r)),
    };
  }
  return {
    ...state,
    runners: [...state.runners, { column: sum, position: (state.progress[sum] ?? 0) + 1 }],
  };
}

function sumsOfPairing(roll: Roll, pairing: number): [number, number] {
  const [first, second] = PAIRINGS[pairing];
  return [roll[first[0]] + roll[first[1]], roll[second[0]] + roll[second[1]]];
}

/**
 * その出目で選べる手の一覧。
 *
 * ペアリングごとに「2つとも使えるなら2つとも使わなければならない」を適用する。
 * 2つ使える手が1つでもあれば、そのペアリングでは1つだけ使う手は選べない。
 * 適用順が違うだけで結果が同じ手は1つにまとめる。
 */
export function legalMoves(game: GameState, roll: Roll): Move[] {
  const base = turnStateOf(game);
  const moves: Move[] = [];
  const seen = new Set<string>();

  const push = (move: Move) => {
    const key = [...move.sums].sort((a, b) => a - b).join(',');
    if (seen.has(key)) return;
    seen.add(key);
    moves.push(move);
  };

  for (let pairing = 0; pairing < PAIRINGS.length; pairing++) {
    const [s1, s2] = sumsOfPairing(roll, pairing);

    const both: Move[] = [];
    for (const [x, y] of [[s1, s2], [s2, s1]] as const) {
      if (!isPlayableSum(x, base)) continue;
      if (isPlayableSum(y, advance(base, x))) both.push({ pairing, sums: [x, y] });
    }

    if (both.length > 0) {
      both.forEach(push);
      continue;
    }

    for (const x of s1 === s2 ? [s1] : [s1, s2]) {
      if (isPlayableSum(x, base)) push({ pairing, sums: [x] });
    }
  }

  return moves;
}

/** サイコロを4個振る。 */
export function rollDice(rng: Rng): Roll {
  const die = () => Math.floor(rng() * 6) + 1;
  return [die(), die(), die(), die()];
}

/** 出目を確定させる。進められる和が1つもなければバーストになる。 */
export function applyRoll(game: GameState, roll: Roll): GameState {
  const busted = legalMoves(game, roll).length === 0;
  return {
    ...game,
    roll,
    rollsThisTurn: game.rollsThisTurn + 1,
    phase: busted ? 'busted' : 'choose',
  };
}

/** 選んだ手を適用する。 */
export function applyMove(game: GameState, move: Move): GameState {
  let state = turnStateOf(game);
  for (const sum of move.sums) state = advance(state, sum);
  return { ...game, runners: state.runners, roll: null, phase: 'decide' };
}

function startTurn(game: GameState, next: PlayerId): GameState {
  return { ...game, current: next, runners: [], roll: null, phase: 'roll', rollsThisTurn: 0 };
}

/**
 * 止める。ランナーの位置を恒久進捗として確定し、最上段に届いていた列を獲得する。
 * 3列獲得したら決着。
 */
export function stopTurn(game: GameState): GameState {
  const progress = { ...game.progress[game.current] };
  const claimedBy = { ...game.claimedBy };

  for (const runner of game.runners) {
    progress[runner.column] = runner.position;
    if (runner.position === COLUMN_HEIGHT[runner.column]) claimedBy[runner.column] = game.current;
  }

  const nextProgress: GameState['progress'] =
    game.current === 0 ? [progress, game.progress[1]] : [game.progress[0], progress];
  const committed: GameState = { ...game, progress: nextProgress, claimedBy };

  if (claimedCount(committed, game.current) >= COLUMNS_TO_WIN) {
    return { ...committed, runners: [], roll: null, phase: 'finished', winner: game.current };
  }
  return startTurn(committed, opponentOf(game.current));
}

/** バーストを確定させる。今ターンの進捗は全て失われる。 */
export function bustTurn(game: GameState): GameState {
  return startTurn(game, opponentOf(game.current));
}

/** 今止めたら勝てるか。 */
export function wouldWinByStopping(game: GameState): boolean {
  return stopTurn(game).winner === game.current;
}

/** 残っているランナーの数。 */
export function freeRunners(game: GameState): number {
  return MAX_RUNNERS - game.runners.length;
}
