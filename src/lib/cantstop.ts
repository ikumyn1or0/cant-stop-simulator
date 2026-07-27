/**
 * キャントストップのバースト確率を厳密に計算するコア。
 *
 * サイコロ4個の出目は 6^4 = 1296 通り（順序つき・等確率）。
 * その全てを列挙して数え上げるため、結果は近似ではなく厳密値になる。
 */

export type Roll = readonly [number, number, number, number];

/** 盤面の列（サイコロ2個の和）。 */
export const COLUMNS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** 各列の段数（実物のボードと同じ）。 */
export const COLUMN_HEIGHT: Record<number, number> = {
  2: 3, 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 11, 9: 9, 10: 7, 11: 5, 12: 3,
};

/** 1ターンに置けるランナー（白コマ）の数。 */
export const MAX_RUNNERS = 3;

/**
 * 4個のサイコロを2個ずつに分ける3通りの組み合わせ。
 * この3通りで、4個から作れる6ペア全てを過不足なく覆う。
 */
export const PAIRINGS: readonly (readonly [readonly [number, number], readonly [number, number]])[] = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

/** 出目の総数（6^4）。 */
export const TOTAL_ROLLS = 1296;

function enumerateRolls(): Roll[] {
  const rolls: Roll[] = [];
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      for (let c = 1; c <= 6; c++) {
        for (let d = 1; d <= 6; d++) {
          rolls.push([a, b, c, d]);
        }
      }
    }
  }
  return rolls;
}

/** 4個のサイコロの出目 1296 通り。 */
export const ALL_ROLLS: readonly Roll[] = enumerateRolls();

/** 出目から作れる和の集合をビットマスク（bit n = 和 n+2 が作れる）で表す。 */
function reachableSumMask(roll: Roll): number {
  let mask = 0;
  for (const [first, second] of PAIRINGS) {
    mask |= 1 << (roll[first[0]] + roll[first[1]] - 2);
    mask |= 1 << (roll[second[0]] + roll[second[1]] - 2);
  }
  return mask;
}

const ROLL_SUM_MASKS: readonly number[] = ALL_ROLLS.map(reachableSumMask);

/** ランナー（そのターンだけ進む白コマ）。position は下から数えた絶対位置で 1 以上。 */
export type Runner = {
  column: number;
  /** 現在いる段。1 が最下段、COLUMN_HEIGHT[column] が最上段（＝その列を取れる位置）。 */
  position: number;
};

export type TurnState = {
  /** 配置済みのランナー（0〜3個）。 */
  runners: Runner[];
  /** 誰かがすでにクリアした列。ランナーが余っていても進めないため使用不可。 */
  clearedColumns: number[];
  /** 自分の恒久進捗（前のターンまでに進めた段）。省略した列は 0。 */
  progress: Record<number, number>;
};

export const EMPTY_STATE: TurnState = {
  runners: [],
  clearedColumns: [],
  progress: {},
};

/** 和 sum が有効な列かどうか。 */
export function isColumnSum(sum: number): boolean {
  return sum >= 2 && sum <= 12 && Number.isInteger(sum);
}

/**
 * 和 sum の列を進められるか。
 *
 * 1. 誰かがクリア済みの列は進めない（ランナーが余っていても置けない）
 * 2. その列にランナーがいるなら、最上段に達していなければ進める
 * 3. ランナーがいないなら、ランナーに空きがあり、かつ自分の恒久進捗が最上段未満なら進める
 */
export function isPlayableSum(sum: number, state: TurnState): boolean {
  if (!isColumnSum(sum)) return false;
  if (state.clearedColumns.includes(sum)) return false;

  const height = COLUMN_HEIGHT[sum];
  const runner = state.runners.find(r => r.column === sum);
  if (runner) return runner.position < height;

  if (state.runners.length >= MAX_RUNNERS) return false;
  return (state.progress[sum] ?? 0) < height;
}

/** 進行可能な和の集合をビットマスクで返す。 */
function playableSumMask(state: TurnState): number {
  let mask = 0;
  for (const sum of COLUMNS) {
    if (isPlayableSum(sum, state)) mask |= 1 << (sum - 2);
  }
  return mask;
}

/** その出目でどのペアリングを選んでも1コマも進められない（＝バースト）か。 */
export function isBurstRoll(roll: Roll, state: TurnState): boolean {
  return (reachableSumMask(roll) & playableSumMask(state)) === 0;
}

/** ある出目で進められる和の一覧（重複なし・昇順）。 */
export function playableSumsForRoll(roll: Roll, state: TurnState): number[] {
  const mask = reachableSumMask(roll) & playableSumMask(state);
  return COLUMNS.filter(sum => (mask & (1 << (sum - 2))) !== 0);
}

export type BurstResult = {
  /** バーストする出目の数。 */
  burstCount: number;
  /** 出目の総数（常に 1296）。 */
  total: number;
  /** バースト確率（0〜1）。 */
  probability: number;
};

/** 局面のバースト確率を 1296 通りの全列挙で厳密に求める。 */
export function burstProbability(state: TurnState): BurstResult {
  const playable = playableSumMask(state);
  let burstCount = 0;
  for (const mask of ROLL_SUM_MASKS) {
    if ((mask & playable) === 0) burstCount++;
  }
  return { burstCount, total: TOTAL_ROLLS, probability: burstCount / TOTAL_ROLLS };
}

let sumReachCache: Record<number, number> | null = null;

/**
 * 各和が「4個のサイコロから作れる」確率。局面には依存しないサイコロだけの性質で、
 * どの列が出やすいかの目安になる（7 が最も出やすい）。
 */
export function sumReachProbability(): Record<number, number> {
  if (sumReachCache) return sumReachCache;

  const counts: Record<number, number> = {};
  for (const sum of COLUMNS) counts[sum] = 0;
  for (const mask of ROLL_SUM_MASKS) {
    for (const sum of COLUMNS) {
      if ((mask & (1 << (sum - 2))) !== 0) counts[sum]++;
    }
  }

  const result: Record<number, number> = {};
  for (const sum of COLUMNS) result[sum] = counts[sum] / TOTAL_ROLLS;
  sumReachCache = result;
  return result;
}

/**
 * 「指定した列だけが進行可能」な局面のバースト確率。
 *
 * ランナーは最下段（position 1）に置いた扱い。列が3個未満のときは残りのランナーで
 * 別の列を始められてしまうので、指定外の列は全てクリア済みとして塞ぐ。
 */
export function burstProbabilityForColumns(columns: readonly number[]): BurstResult {
  return burstProbability({
    runners: columns.map(column => ({ column, position: 1 })),
    clearedColumns: columns.length >= MAX_RUNNERS
      ? []
      : COLUMNS.filter(sum => !columns.includes(sum)),
    progress: {},
  });
}

export type TripleCombination = {
  columns: [number, number, number];
  burstCount: number;
  probability: number;
};

let tripleCache: TripleCombination[] | null = null;

/** ランナー3個の列の組み合わせ 165 通りを、バースト確率の昇順で返す。 */
export function allTripleCombinations(): TripleCombination[] {
  if (tripleCache) return tripleCache;

  const result: TripleCombination[] = [];
  for (let i = 0; i < COLUMNS.length; i++) {
    for (let j = i + 1; j < COLUMNS.length; j++) {
      for (let k = j + 1; k < COLUMNS.length; k++) {
        const columns: [number, number, number] = [COLUMNS[i], COLUMNS[j], COLUMNS[k]];
        const { burstCount, probability } = burstProbabilityForColumns(columns);
        result.push({ columns, burstCount, probability });
      }
    }
  }
  result.sort((a, b) => a.probability - b.probability || a.columns[0] - b.columns[0]);
  tripleCache = result;
  return result;
}
