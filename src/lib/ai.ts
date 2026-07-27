/**
 * 対戦AI。手の選び方は3段階とも共通の貪欲法で、違いは「振るか止めるか」の判断だけ。
 */

import { ALL_ROLLS, COLUMN_HEIGHT, TOTAL_ROLLS, burstProbability } from './cantstop';
import {
  applyMove,
  legalMoves,
  turnStateOf,
  wouldWinByStopping,
  type GameState,
  type Move,
} from './game';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'やさしい',
  normal: 'ふつう',
  hard: 'つよい',
};

export const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  easy: '2回振ったら必ず止める',
  normal: 'バースト率が 25% を超えたら止める',
  hard: '1296通りを全列挙して1手先の期待値を計算し、得なら振る',
};

/** 最上段に到達したランナーの価値。列の獲得につながるので1マス分より重い。 */
const TOP_BONUS = 0.5;

/*
 * しきい値は scripts/bench.ts の総当たり（各カード400戦・先手交互）で決めた。
 * 採用した3つの勝率: 1手先読み → バースト率25% が 59%、バースト率25% → 2回 が 60%、
 * 1手先読み → 2回 が 80%。しきい値を 1/3 まで緩めると振りすぎて最弱になる。
 */
const EASY_MAX_ROLLS = 2;
const NORMAL_BURST_THRESHOLD = 0.25;

/**
 * 今ターンに積み上げた進捗の価値を「列いくつ分か」で表す。
 * 段数の少ない列ほど1マスの価値が高くなる。
 */
export function turnValue(game: GameState): number {
  const progress = game.progress[game.current];
  let value = 0;
  for (const runner of game.runners) {
    const height = COLUMN_HEIGHT[runner.column];
    value += (runner.position - (progress[runner.column] ?? 0)) / height;
    if (runner.position === height) value += TOP_BONUS;
  }
  return value;
}

/** 合法手のうち、適用後の価値がもっとも高いものを選ぶ。 */
export function chooseMove(game: GameState, moves: Move[]): Move {
  let best = moves[0];
  let bestValue = -Infinity;
  for (const move of moves) {
    const value = turnValue(applyMove(game, move));
    if (value > bestValue) {
      bestValue = value;
      best = move;
    }
  }
  return best;
}

/**
 * もう1回振ったときの、今ターン価値の期待値。
 * 1296通りの出目を全て試し、バーストする出目は価値0として数える。
 */
export function expectedValueAfterRoll(game: GameState): number {
  let total = 0;
  for (const roll of ALL_ROLLS) {
    const moves = legalMoves(game, roll);
    if (moves.length === 0) continue;
    total += turnValue(applyMove(game, chooseMove(game, moves)));
  }
  return total / TOTAL_ROLLS;
}

/** もう一度振るべきか。どの難易度でも、止めれば勝てるときは必ず止める。 */
export function shouldContinue(game: GameState, difficulty: Difficulty): boolean {
  if (wouldWinByStopping(game)) return false;

  if (difficulty === 'easy') return game.rollsThisTurn < EASY_MAX_ROLLS;
  if (difficulty === 'normal') {
    return burstProbability(turnStateOf(game)).probability <= NORMAL_BURST_THRESHOLD;
  }
  return expectedValueAfterRoll(game) > turnValue(game);
}
