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
 * 今ターンに進めたマス数の合計。
 * 表示用で、段数で割らない素の数。AIの判断には使わない。
 */
export function turnSteps(game: GameState): number {
  const progress = game.progress[game.current];
  return game.runners.reduce((n, r) => n + (r.position - (progress[r.column] ?? 0)), 0);
}

/** 今ターンに積んだ進捗。value は列いくつ分か、steps はマス数。 */
export type Progress = { value: number; steps: number };

export function currentProgress(game: GameState): Progress {
  return { value: turnValue(game), steps: turnSteps(game) };
}

/**
 * もう1回振ったときの、今ターン進捗の期待値。
 * 1296通りの出目を全て試し、バーストする出目は0として数える。
 */
export function expectedAfterRoll(game: GameState): Progress {
  let value = 0;
  let steps = 0;
  for (const roll of ALL_ROLLS) {
    const moves = legalMoves(game, roll);
    if (moves.length === 0) continue;
    const next = applyMove(game, chooseMove(game, moves));
    value += turnValue(next);
    steps += turnSteps(next);
  }
  return { value: value / TOTAL_ROLLS, steps: steps / TOTAL_ROLLS };
}

/** AIが「振る/止める」を決めた根拠。難易度によって使う基準が違う。 */
export type StopDecision = {
  continue: boolean;
  reason: 'win' | 'rolls' | 'burst' | 'expectimax';
  /** 今止めた場合に確定する進捗。全難易度で計算する。 */
  current: Progress;
  /** easy: 振った回数と上限。 */
  rolls?: { done: number; max: number };
  /** normal: バースト率としきい値。 */
  burst?: { probability: number; threshold: number };
  /** hard: もう1回振ったときの期待進捗。 */
  expected?: Progress;
};

/**
 * もう一度振るべきかを、根拠つきで判断する。
 * どの難易度でも、止めれば勝てるときは必ず止める。
 */
export function decide(game: GameState, difficulty: Difficulty): StopDecision {
  const current = currentProgress(game);

  if (wouldWinByStopping(game)) {
    return { continue: false, reason: 'win', current };
  }

  if (difficulty === 'easy') {
    const rolls = { done: game.rollsThisTurn, max: EASY_MAX_ROLLS };
    return { continue: rolls.done < rolls.max, reason: 'rolls', current, rolls };
  }

  if (difficulty === 'normal') {
    const burst = {
      probability: burstProbability(turnStateOf(game)).probability,
      threshold: NORMAL_BURST_THRESHOLD,
    };
    return { continue: burst.probability <= burst.threshold, reason: 'burst', current, burst };
  }

  const expected = expectedAfterRoll(game);
  return { continue: expected.value > current.value, reason: 'expectimax', current, expected };
}

/** もう一度振るべきか。根拠が要らないときの入り口。 */
export function shouldContinue(game: GameState, difficulty: Difficulty): boolean {
  return decide(game, difficulty).continue;
}
