import { describe, expect, it } from 'vitest';
import {
  ALL_ROLLS,
  COLUMNS,
  COLUMN_HEIGHT,
  TOTAL_ROLLS,
  allTripleCombinations,
  burstProbability,
  burstProbabilityForColumns,
  isBurstRoll,
  isPlayableSum,
  playableSumsForRoll,
  sumReachProbability,
  type Roll,
  type TurnState,
} from './cantstop';

describe('出目の列挙', () => {
  it('6^4 = 1296 通りを重複なく列挙する', () => {
    expect(ALL_ROLLS).toHaveLength(TOTAL_ROLLS);
    expect(new Set(ALL_ROLLS.map(r => r.join(','))).size).toBe(TOTAL_ROLLS);
  });
});

describe('既知のバースト確率', () => {
  it('6/7/8 は 104/1296 で3列中もっとも低い', () => {
    expect(burstProbabilityForColumns([6, 7, 8]).burstCount).toBe(104);
    expect(allTripleCombinations()[0].columns).toEqual([6, 7, 8]);
  });

  it('2/3/12 と 2/11/12 は同値で3列中もっとも高い', () => {
    const a = burstProbabilityForColumns([2, 3, 12]);
    const b = burstProbabilityForColumns([2, 11, 12]);
    expect(a.burstCount).toBe(b.burstCount);
    expect(a.burstCount).toBe(728);
    expect(allTripleCombinations().at(-1)!.probability).toBe(a.probability);
  });

  it('7 だけしか進めない局面は 462/1296', () => {
    expect(burstProbabilityForColumns([7]).burstCount).toBe(462);
  });

  it('組み合わせ表は 165 件でバースト確率の昇順', () => {
    const table = allTripleCombinations();
    expect(table).toHaveLength(165);
    for (let i = 1; i < table.length; i++) {
      expect(table[i].probability).toBeGreaterThanOrEqual(table[i - 1].probability);
    }
  });
});

describe('クリア済みの列は進めない', () => {
  // 進行中が 2・3（ランナー1個空き）、クリア済みが 10・11・12。
  const state: TurnState = {
    runners: [
      { column: 2, position: 1 },
      { column: 3, position: 1 },
    ],
    clearedColumns: [10, 11, 12],
    progress: {},
  };

  it('クリア済みの列はランナーが余っていても進行不可', () => {
    expect(isPlayableSum(11, state)).toBe(false);
    expect(isPlayableSum(5, state)).toBe(true); // 空きランナーで新規に置ける
  });

  it('[5,5,6,6] は和が 10/11/12 にしかならずバースト', () => {
    const roll: Roll = [5, 5, 6, 6];
    expect(playableSumsForRoll(roll, state)).toEqual([]);
    expect(isBurstRoll(roll, state)).toBe(true);
  });

  it('局面全体では 20/1296', () => {
    expect(burstProbability(state).burstCount).toBe(20);
  });

  it('同じ局面でも 10/11/12 が空いていればバーストしない', () => {
    const open: TurnState = { ...state, clearedColumns: [] };
    expect(isBurstRoll([5, 5, 6, 6], open)).toBe(false);
    expect(burstProbability(open).burstCount).toBe(0);
  });
});

describe('性質', () => {
  it('盤面の左右対称性: S と {14-s} のバースト確率は等しい', () => {
    for (const { columns, burstCount } of allTripleCombinations()) {
      const mirrored = columns.map(c => 14 - c).sort((a, b) => a - b);
      expect(burstProbabilityForColumns(mirrored).burstCount).toBe(burstCount);
    }
  });

  it('進行可能な列を増やすとバースト確率は決して上がらない', () => {
    for (let i = 0; i < COLUMNS.length; i++) {
      for (let j = i + 1; j < COLUMNS.length; j++) {
        const pair = burstProbabilityForColumns([COLUMNS[i], COLUMNS[j]]);
        for (let k = j + 1; k < COLUMNS.length; k++) {
          const triple = burstProbabilityForColumns([COLUMNS[i], COLUMNS[j], COLUMNS[k]]);
          expect(triple.burstCount).toBeLessThanOrEqual(pair.burstCount);
        }
      }
    }
  });

  it('ランナー0個・全列オープンならバーストしない', () => {
    expect(burstProbability({ runners: [], clearedColumns: [], progress: {} }).burstCount).toBe(0);
  });

  it('全列クリア済みなら必ずバースト', () => {
    const state: TurnState = { runners: [], clearedColumns: [...COLUMNS], progress: {} };
    expect(burstProbability(state).probability).toBe(1);
  });

  it('ランナー3個が全て最上段なら必ずバースト', () => {
    const state: TurnState = {
      runners: [6, 7, 8].map(column => ({ column, position: COLUMN_HEIGHT[column] })),
      clearedColumns: [],
      progress: {},
    };
    expect(burstProbability(state).probability).toBe(1);
  });

  it('恒久進捗が最上段の列は新しくランナーを置けない', () => {
    const state: TurnState = { runners: [], clearedColumns: [], progress: { 7: COLUMN_HEIGHT[7] } };
    expect(isPlayableSum(7, state)).toBe(false);
    expect(isPlayableSum(6, state)).toBe(true);
  });
});

describe('サイコロの性質', () => {
  it('各和が作れる確率は 7 が最大で、左右対称', () => {
    const reach = sumReachProbability();
    for (const sum of COLUMNS) {
      expect(reach[sum]).toBeCloseTo(reach[14 - sum], 12);
      expect(reach[sum]).toBeLessThanOrEqual(reach[7]);
    }
  });

  it('1つの和しか進めない局面のバースト確率は、その和が作れない確率と一致する', () => {
    const reach = sumReachProbability();
    for (const sum of COLUMNS) {
      expect(burstProbabilityForColumns([sum]).probability).toBeCloseTo(1 - reach[sum], 12);
    }
  });
});
