import { describe, expect, it } from 'vitest';
import { ALL_ROLLS, COLUMN_HEIGHT, isBurstRoll, isPlayableSum, type Roll } from './cantstop';
import {
  applyMove,
  applyRoll,
  bustTurn,
  createGame,
  legalMoves,
  rollDice,
  stopTurn,
  turnStateOf,
  wouldWinByStopping,
  type GameState,
  type PlayerId,
} from './game';
import { mulberry32 } from './rng';

function gameWith(patch: Partial<GameState>): GameState {
  return { ...createGame(), ...patch };
}

function runnersAt(entries: [number, number][]) {
  return entries.map(([column, position]) => ({ column, position }));
}

/** 出目 [1,2,3,4] のペアリングは (3,7) / (4,6) / (5,5)。 */
const ROLL_1234: Roll = [1, 2, 3, 4];

/** 7 以外の全列が相手に獲得された状態。 */
const ALL_BUT_SEVEN: Record<number, PlayerId> = Object.fromEntries(
  [2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map(c => [c, 1 as PlayerId]),
);

describe('合法手の生成', () => {
  it('2つとも使えるときは1つだけ使う手を作らない', () => {
    const moves = legalMoves(createGame(), ROLL_1234);
    expect(moves.every(m => m.sums.length === 2)).toBe(true);
    expect(moves.map(m => [...m.sums].sort((a, b) => a - b))).toEqual([[3, 7], [4, 6], [5, 5]]);
  });

  it('ランナー2個で新規列が2つ出たら、3個目は片方にしか置けず選択肢が2つになる', () => {
    const game = gameWith({ runners: runnersAt([[6, 1], [8, 1]]) });
    const moves = legalMoves(game, ROLL_1234).filter(m => m.pairing === 0); // (3, 7) の組
    expect(moves.map(m => m.sums)).toEqual([[3], [7]]);
  });

  it('同じ和が2つ出たら、ランナー1個が2段進む', () => {
    const move = legalMoves(createGame(), [3, 4, 3, 4])[0]; // (7, 7)
    expect(move.sums).toEqual([7, 7]);
    expect(applyMove(createGame(), move).runners).toEqual([{ column: 7, position: 2 }]);
  });

  it('最上段のランナーがいる列はそれ以上進めない', () => {
    // 7 以外は全て獲得済みなので、7 のランナーが最上段にいると何も進められない
    const game = gameWith({ runners: runnersAt([[7, COLUMN_HEIGHT[7]]]), claimedBy: ALL_BUT_SEVEN });
    expect(legalMoves(game, [3, 4, 3, 4])).toEqual([]);

    const notYetTop = gameWith({ runners: runnersAt([[7, 1]]), claimedBy: ALL_BUT_SEVEN });
    expect(legalMoves(notYetTop, [3, 4, 3, 4]).map(m => m.sums)).toEqual([[7, 7]]);
  });

  it('獲得済みの列はランナーが余っていても進めない', () => {
    const game = gameWith({ claimedBy: { 3: 1, 7: 1 } });
    const moves = legalMoves(game, ROLL_1234).filter(m => m.pairing === 0); // (3, 7) の組
    expect(moves).toEqual([]);
  });

  it('恒久進捗の続きからランナーを置く', () => {
    const game = gameWith({ progress: [{ 7: 5 }, {}] });
    const move = legalMoves(game, [3, 4, 3, 4])[0];
    expect(applyMove(game, move).runners).toEqual([{ column: 7, position: 7 }]);
  });

  it('合法手が0個になる局面は既存の isBurstRoll と一致する', () => {
    const games = [
      createGame(),
      gameWith({ runners: runnersAt([[6, 1], [7, 1], [8, 1]]) }),
      gameWith({ runners: runnersAt([[2, 1], [3, 1], [12, 1]]) }),
      gameWith({ runners: runnersAt([[2, 1], [3, 1]]), claimedBy: { 10: 1, 11: 1, 12: 1 } }),
      gameWith({ runners: runnersAt([[7, COLUMN_HEIGHT[7]]]), claimedBy: { 2: 0, 3: 0, 4: 1, 5: 1, 6: 1 } }),
    ];
    for (const game of games) {
      const turn = turnStateOf(game);
      for (const roll of ALL_ROLLS) {
        expect(legalMoves(game, roll).length === 0).toBe(isBurstRoll(roll, turn));
      }
    }
  });
});

describe('ターンの確定', () => {
  it('止めるとランナーの位置が恒久進捗になり、手番が入れ替わる', () => {
    const game = gameWith({ runners: runnersAt([[6, 4], [8, 2]]) });
    const next = stopTurn(game);
    expect(next.progress[0]).toEqual({ 6: 4, 8: 2 });
    expect(next.current).toBe(1);
    expect(next.runners).toEqual([]);
  });

  it('最上段のランナーがいる列を獲得し、以後どちらも進めなくなる', () => {
    const game = gameWith({ runners: runnersAt([[2, COLUMN_HEIGHT[2]]]) });
    const next = stopTurn(game);
    expect(next.claimedBy[2]).toBe(0);
    expect(isPlayableSum(2, turnStateOf(next))).toBe(false);
  });

  it('3列目を獲得すると決着する', () => {
    const game = gameWith({
      claimedBy: { 2: 0, 3: 0 },
      runners: runnersAt([[12, COLUMN_HEIGHT[12]]]),
    });
    expect(wouldWinByStopping(game)).toBe(true);
    const next = stopTurn(game);
    expect(next.phase).toBe('finished');
    expect(next.winner).toBe(0);
  });

  it('相手が2列取っていても自分の3列目でなければ決着しない', () => {
    const game = gameWith({
      claimedBy: { 2: 1, 3: 1 },
      runners: runnersAt([[12, COLUMN_HEIGHT[12]]]),
    });
    expect(wouldWinByStopping(game)).toBe(false);
    expect(stopTurn(game).phase).toBe('roll');
  });

  it('バーストすると今ターンの進捗は失われる', () => {
    const game = gameWith({ progress: [{ 6: 2 }, {}], runners: runnersAt([[6, 5], [7, 3]]) });
    const next = bustTurn(game);
    expect(next.progress[0]).toEqual({ 6: 2 });
    expect(next.runners).toEqual([]);
    expect(next.current).toBe(1);
  });
});

describe('出目の確定', () => {
  it('進められる和がなければ busted になる', () => {
    const game = gameWith({ runners: runnersAt([[7, COLUMN_HEIGHT[7]]]), claimedBy: ALL_BUT_SEVEN });
    expect(applyRoll(game, [3, 4, 3, 4]).phase).toBe('busted');
  });

  it('進められる和があれば choose になり、振った回数が増える', () => {
    const next = applyRoll(createGame(), ROLL_1234);
    expect(next.phase).toBe('choose');
    expect(next.rollsThisTurn).toBe(1);
  });
});

describe('サイコロ', () => {
  it('シードが同じなら同じ出目になり、値は1〜6に収まる', () => {
    const a = Array.from({ length: 50 }, (() => { const r = mulberry32(42); return () => rollDice(r); })());
    const b = Array.from({ length: 50 }, (() => { const r = mulberry32(42); return () => rollDice(r); })());
    expect(a).toEqual(b);
    expect(a.flat().every(v => v >= 1 && v <= 6)).toBe(true);
  });
});

describe('通しの対局', () => {
  it('常に止める戦略同士でも決着し、獲得列の所有者が矛盾しない', () => {
    const rng = mulberry32(7);
    let game = createGame();
    for (let i = 0; i < 20000 && game.phase !== 'finished'; i++) {
      if (game.phase === 'roll' || game.phase === 'decide') {
        // ランナーを1つ置いたら止める、を繰り返す
        if (game.phase === 'decide') { game = stopTurn(game); continue; }
        game = applyRoll(game, rollDice(rng));
      } else if (game.phase === 'choose') {
        game = applyMove(game, legalMoves(game, game.roll!)[0]);
      } else if (game.phase === 'busted') {
        game = bustTurn(game);
      }
    }
    expect(game.phase).toBe('finished');
    const owners = Object.values(game.claimedBy) as PlayerId[];
    expect(owners.filter(o => o === game.winner)).toHaveLength(3);
  });
});
