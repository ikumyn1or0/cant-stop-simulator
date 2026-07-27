/**
 * AI の強さを総当たりで測るベンチマーク。
 *   npx vite-node scripts/bench.ts
 */
import { burstProbability } from '../src/lib/cantstop';
import { chooseMove, expectedValueAfterRoll, turnValue } from '../src/lib/ai';
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
} from '../src/lib/game';
import { mulberry32, type Rng } from '../src/lib/rng';

type Strategy = { name: string; keepRolling: (game: GameState) => boolean };

const fixedRolls = (n: number): Strategy => ({
  name: `振る${n}回`,
  keepRolling: game => game.rollsThisTurn < n,
});

const threshold = (t: number): Strategy => ({
  name: `バースト率${(t * 100).toFixed(0)}%`,
  keepRolling: game => burstProbability(turnStateOf(game)).probability <= t,
});

const expectimax: Strategy = {
  name: '1手先読み',
  keepRolling: game => expectedValueAfterRoll(game) > turnValue(game),
};

function play(a: Strategy, b: Strategy, rng: Rng): PlayerId | null {
  const strategies = [a, b];
  let game = createGame();
  for (let i = 0; i < 200000; i++) {
    if (game.phase === 'finished') return game.winner;
    if (game.phase === 'roll') game = applyRoll(game, rollDice(rng));
    else if (game.phase === 'choose') game = applyMove(game, chooseMove(game, legalMoves(game, game.roll!)));
    else if (game.phase === 'decide') {
      const keep = !wouldWinByStopping(game) && strategies[game.current].keepRolling(game);
      game = keep ? { ...game, phase: 'roll' } : stopTurn(game);
    } else game = bustTurn(game);
  }
  return null;
}

/** a から見た勝率。先手を交互に入れ替える。 */
function winRate(a: Strategy, b: Strategy, games: number): number {
  let wins = 0;
  for (let i = 0; i < games; i++) {
    const aFirst = i % 2 === 0;
    const winner = play(aFirst ? a : b, aFirst ? b : a, mulberry32(9000 + i));
    if (winner === null) continue;
    if ((aFirst && winner === 0) || (!aFirst && winner === 1)) wins++;
  }
  return wins / games;
}

/** 総当たりで比較する候補。 */
const ALL: Strategy[] = [
  fixedRolls(2),
  fixedRolls(3),
  fixedRolls(4),
  threshold(0.1),
  threshold(0.15),
  threshold(0.2),
  threshold(0.25),
  threshold(1 / 3),
  expectimax,
];

/** 実際に採用した3段階。 */
const ADOPTED: Strategy[] = [fixedRolls(2), threshold(0.25), expectimax];

const GAMES = Number(process.argv[2] ?? 200);
const candidates = process.argv[3] === 'adopted' ? ADOPTED : ALL;
console.log(`各カード ${GAMES} 戦（先手交互）\n`);

const header = ['', ...candidates.map(c => c.name)].join('\t');
console.log(header);
for (const a of candidates) {
  const row = [a.name];
  for (const b of candidates) {
    row.push(a === b ? '-' : (winRate(a, b, GAMES) * 100).toFixed(0) + '%');
  }
  console.log(row.join('\t'));
}
