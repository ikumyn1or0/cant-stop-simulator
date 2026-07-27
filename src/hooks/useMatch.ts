import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COLUMNS, burstProbability } from '../lib/cantstop';
import { chooseMove, currentProgress, decide, expectedAfterRoll, type Difficulty, type Progress, type StopDecision } from '../lib/ai';
import { describeDecision } from '../lib/format';
import {
  applyMove,
  applyRoll,
  bustTurn,
  createGame,
  legalMoves,
  rollDice,
  stopTurn,
  turnStateOf,
  type GameState,
  type Move,
  type PlayerId,
} from '../lib/game';
import type { Rng } from '../lib/rng';

export const HUMAN: PlayerId = 0;
export const AI: PlayerId = 1;

export const PLAYER_NAMES: Record<PlayerId, string> = { 0: 'あなた', 1: 'AI' };

export type LogEntry = { id: number; player: PlayerId; text: string; detail?: string };

/** AIの手を1つずつ見せるための待ち時間(ms)。 */
const AI_DELAY: Record<GameState['phase'], number> = {
  roll: 550,
  choose: 650,
  decide: 650,
  busted: 900,
  finished: 0,
};

const MAX_LOG = 60;

function describeSums(sums: number[]): string {
  if (sums.length === 1) return `${sums[0]} を進めた`;
  if (sums[0] === sums[1]) return `${sums[0]} を2段進めた`;
  return `${sums[0]} と ${sums[1]} を進めた`;
}

function describeStop(before: GameState, after: GameState): string {
  const claimed = COLUMNS.filter(c => after.claimedBy[c] !== undefined && before.claimedBy[c] === undefined);
  return claimed.length > 0 ? `止めて ${claimed.join(' / ')} を獲得` : '止めた';
}

function describeRoll(game: GameState, dice: readonly number[]): string {
  return game.phase === 'busted' ? `${dice.join(' ')} → バースト` : `${dice.join(' ')} を振った`;
}

/** 対戦では素の乱数を使う。シード付きの mulberry32 はテストとベンチマーク用。 */
const rng: Rng = Math.random;

export function useMatch() {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [game, setGame] = useState<GameState>(createGame);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showBurst, setShowBurst] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [aiDecision, setAiDecision] = useState<StopDecision | null>(null);

  const logIdRef = useRef(0);

  const append = useCallback((player: PlayerId, text: string, detail?: string) => {
    setLog(prev => [...prev, { id: logIdRef.current++, player, text, detail }].slice(-MAX_LOG));
  }, []);

  /** 出目に対して選べる手。手番プレイヤーの選択肢。 */
  const moves = useMemo<Move[]>(
    () => (game.phase === 'choose' && game.roll ? legalMoves(game, game.roll) : []),
    [game],
  );

  /** 今の局面でもう1回振ったときのバースト確率。 */
  const burst = useMemo(() => burstProbability(turnStateOf(game)), [game]);

  /** 手番プレイヤーが今ターンに積んだ進捗。 */
  const progressNow = useMemo<Progress>(() => currentProgress(game), [game]);

  /**
   * 人間がもう1回振ったときの期待進捗。
   * 1296通りを走査するので、表示しないときは計算しない。
   */
  const forecast = useMemo<Progress | null>(
    () => (showForecast && game.current === HUMAN && game.phase !== 'finished'
      ? expectedAfterRoll(game)
      : null),
    [game, showForecast],
  );

  const isHumanTurn = game.current === HUMAN && game.phase !== 'finished';

  const roll = useCallback(() => {
    if (game.current !== HUMAN) return;
    if (game.phase !== 'roll' && game.phase !== 'decide') return;
    const dice = rollDice(rng);
    const next = applyRoll(game, dice);
    setGame(next);
    append(HUMAN, describeRoll(next, dice));
  }, [game, append]);

  const choose = useCallback((move: Move) => {
    if (game.current !== HUMAN || game.phase !== 'choose') return;
    setGame(applyMove(game, move));
    append(HUMAN, describeSums(move.sums));
  }, [game, append]);

  const stop = useCallback(() => {
    if (game.current !== HUMAN || game.phase !== 'decide') return;
    const next = stopTurn(game);
    setGame(next);
    append(HUMAN, describeStop(game, next));
  }, [game, append]);

  /** バーストを確認して相手の番へ。 */
  const acknowledgeBust = useCallback(() => {
    if (game.current !== HUMAN || game.phase !== 'busted') return;
    setGame(bustTurn(game));
  }, [game]);

  const newMatch = useCallback(() => {
    setGame(createGame());
    setLog([]);
    setAiDecision(null);
  }, []);

  // AIの手番を1手ずつ進める。
  useEffect(() => {
    if (game.phase === 'finished' || game.current !== AI) return;

    const timer = setTimeout(() => {
      if (game.phase === 'roll') {
        // 手番の1投目なら、前のターンの判断表示を消す。
        if (game.rollsThisTurn === 0) setAiDecision(null);
        const dice = rollDice(rng);
        const next = applyRoll(game, dice);
        setGame(next);
        append(AI, describeRoll(next, dice));
      } else if (game.phase === 'choose') {
        const move = chooseMove(game, legalMoves(game, game.roll!));
        setGame(applyMove(game, move));
        append(AI, describeSums(move.sums));
      } else if (game.phase === 'decide') {
        const decision = decide(game, difficulty);
        setAiDecision(decision);
        if (decision.continue) {
          setGame({ ...game, phase: 'roll' });
          append(AI, '続行', describeDecision(decision));
        } else {
          const next = stopTurn(game);
          setGame(next);
          append(AI, describeStop(game, next), describeDecision(decision));
        }
      } else {
        setGame(bustTurn(game));
      }
    }, AI_DELAY[game.phase]);

    return () => clearTimeout(timer);
  }, [game, difficulty, append]);

  return {
    game, log, moves, burst, isHumanTurn,
    progressNow, forecast, aiDecision,
    difficulty, setDifficulty,
    showBurst, setShowBurst,
    showForecast, setShowForecast,
    roll, choose, stop, acknowledgeBust, newMatch,
  };
}
