import { describe, expect, it } from 'vitest';
import { COLUMN_HEIGHT } from './cantstop';
import {
  DIFFICULTIES,
  chooseMove,
  expectedValueAfterRoll,
  shouldContinue,
  turnValue,
  type Difficulty,
} from './ai';
import {
  applyMove,
  applyRoll,
  bustTurn,
  createGame,
  legalMoves,
  rollDice,
  stopTurn,
  type GameState,
  type PlayerId,
} from './game';
import { mulberry32, type Rng } from './rng';

function gameWith(patch: Partial<GameState>): GameState {
  return { ...createGame(), ...patch };
}

/** 1局を最後まで進め、勝者を返す。決着しなければ null。 */
function playMatch(strategies: [Difficulty, Difficulty], rng: Rng): PlayerId | null {
  let game = createGame();
  for (let step = 0; step < 100000; step++) {
    if (game.phase === 'finished') return game.winner;

    if (game.phase === 'roll') {
      game = applyRoll(game, rollDice(rng));
    } else if (game.phase === 'choose') {
      game = applyMove(game, chooseMove(game, legalMoves(game, game.roll!)));
    } else if (game.phase === 'decide') {
      game = shouldContinue(game, strategies[game.current]) ? { ...game, phase: 'roll' } : stopTurn(game);
    } else {
      game = bustTurn(game);
    }
  }
  return null;
}

describe('評価関数', () => {
  it('段数の少ない列のほうが1マスあたりの価値が高い', () => {
    const short = gameWith({ runners: [{ column: 2, position: 1 }] });   // 3段
    const long = gameWith({ runners: [{ column: 7, position: 1 }] });    // 13段
    expect(turnValue(short)).toBeGreaterThan(turnValue(long));
  });

  it('最上段に到達したランナーにはボーナスが付く', () => {
    const top = gameWith({ runners: [{ column: 2, position: COLUMN_HEIGHT[2] }] });
    const below = gameWith({ runners: [{ column: 2, position: COLUMN_HEIGHT[2] - 1 }] });
    expect(turnValue(top) - turnValue(below)).toBeGreaterThan(1 / COLUMN_HEIGHT[2]);
  });

  it('ランナーがなければ価値0', () => {
    expect(turnValue(createGame())).toBe(0);
  });
});

describe('手の選択', () => {
  it('返す手は必ず合法手に含まれる', () => {
    const rng = mulberry32(1);
    let game = createGame();
    let checked = 0;
    for (let step = 0; step < 3000 && checked < 200; step++) {
      if (game.phase === 'finished') game = createGame();
      if (game.phase === 'roll') {
        game = applyRoll(game, rollDice(rng));
      } else if (game.phase === 'choose') {
        const moves = legalMoves(game, game.roll!);
        const chosen = chooseMove(game, moves);
        expect(moves).toContainEqual(chosen);
        checked++;
        game = applyMove(game, chosen);
      } else if (game.phase === 'decide') {
        game = shouldContinue(game, 'normal') ? { ...game, phase: 'roll' } : stopTurn(game);
      } else {
        game = bustTurn(game);
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('価値が最大になる手を選ぶ', () => {
    // (3,7) / (4,6) / (5,5) のうち、段数の合計がもっとも小さい 3+7 を選ぶ
    const game = createGame();
    const moves = legalMoves(game, [1, 2, 3, 4]);
    const chosen = chooseMove(game, moves);
    const best = Math.max(...moves.map(m => turnValue(applyMove(game, m))));
    expect(turnValue(applyMove(game, chosen))).toBe(best);
  });
});

describe('停止判断', () => {
  it('どの難易度でも、止めれば勝てるときは止める', () => {
    const game = gameWith({
      claimedBy: { 2: 0, 3: 0 },
      runners: [{ column: 12, position: COLUMN_HEIGHT[12] }],
      rollsThisTurn: 1,
    });
    for (const difficulty of DIFFICULTIES) {
      expect(shouldContinue(game, difficulty)).toBe(false);
    }
  });

  it('やさしいは2回振ったら止める', () => {
    const base = { runners: [{ column: 7, position: 1 }] };
    expect(shouldContinue(gameWith({ ...base, rollsThisTurn: 1 }), 'easy')).toBe(true);
    expect(shouldContinue(gameWith({ ...base, rollsThisTurn: 2 }), 'easy')).toBe(false);
  });

  it('ふつうはバースト率が高い局面で止める', () => {
    const safe = gameWith({ runners: [6, 7, 8].map(column => ({ column, position: 1 })) });      // 8.02%
    const risky = gameWith({ runners: [2, 3, 12].map(column => ({ column, position: 1 })) });    // 56.17%
    expect(shouldContinue(safe, 'normal')).toBe(true);
    expect(shouldContinue(risky, 'normal')).toBe(false);
  });

  it('つよいはランナー未配置なら必ず振る（バーストしないので損がない）', () => {
    expect(expectedValueAfterRoll(createGame())).toBeGreaterThan(0);
    expect(shouldContinue(createGame(), 'hard')).toBe(true);
  });

  it('つよいは積み上げた進捗が大きくバースト率も高ければ止める', () => {
    const game = gameWith({ runners: [2, 3, 12].map(column => ({ column, position: 2 })) });
    expect(shouldContinue(game, 'hard')).toBe(false);
  });
});

describe('自己対戦', () => {
  /** a から見た勝率。先手を交互に入れ替えて先手有利の影響を消す。 */
  function winRate(a: Difficulty, b: Difficulty, games: number, seed: number): number {
    let wins = 0;
    for (let i = 0; i < games; i++) {
      const aFirst = i % 2 === 0;
      const strategies: [Difficulty, Difficulty] = aFirst ? [a, b] : [b, a];
      const winner = playMatch(strategies, mulberry32(seed + i));
      expect(winner).not.toBeNull();
      if (strategies[winner!] === a) wins++;
    }
    return wins / games;
  }

  /*
   * ここで検証するのは差が大きく60戦でもはっきり出るカードだけ。
   * つよい vs ふつうは真の勝率が59%程度で、60戦では分散に埋もれる（実際このシードでは五分）。
   * 3段階の強さの序列そのものは scripts/bench.ts の総当たり（各400戦・先手交互）で測っており、
   * つよい→ふつう 59%、ふつう→やさしい 60%、つよい→やさしい 80% を確認している。
   */
  // つよいは1手先読みで1局あたりの計算が重いので、既定の5秒では足りない。
  it('つよいはやさしいに大きく勝ち越す', () => {
    expect(winRate('hard', 'easy', 60, 1000)).toBeGreaterThan(0.6);
  }, 30000);

  it('ふつうはやさしいに勝ち越す', () => {
    expect(winRate('normal', 'easy', 60, 2000)).toBeGreaterThan(0.5);
  });
});
