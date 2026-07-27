import { useCallback, useMemo, useState } from 'react';
import {
  COLUMN_HEIGHT,
  MAX_RUNNERS,
  burstProbability,
  type TurnState,
} from '../lib/cantstop';

export type Preset = {
  label: string;
  hint: string;
  state: TurnState;
};

function runnersAt(columns: number[], position = 1) {
  return columns.map(column => ({ column, position }));
}

export const PRESETS: Preset[] = [
  {
    label: 'ランナー未配置',
    hint: 'ターン開始時。どの列にも置けるのでバーストしない',
    state: { runners: [], clearedColumns: [], progress: {} },
  },
  {
    label: '6 / 7 / 8',
    hint: '3列でもっともバーストしにくい組み合わせ',
    state: { runners: runnersAt([6, 7, 8]), clearedColumns: [], progress: {} },
  },
  {
    label: '2 / 3 / 12',
    hint: '3列でもっともバーストしやすい組み合わせ',
    state: { runners: runnersAt([2, 3, 12]), clearedColumns: [], progress: {} },
  },
  {
    label: '7 のみ + 全列クリア済み',
    hint: '7 以外が全て埋まった終盤。7 が作れなければバースト',
    state: {
      runners: runnersAt([7]),
      clearedColumns: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12],
      progress: {},
    },
  },
  {
    label: '2・3 進行中 / 10・11・12 クリア済み',
    hint: 'ランナーが1個余っていても、クリア済みの列には置けない',
    state: { runners: runnersAt([2, 3]), clearedColumns: [10, 11, 12], progress: {} },
  },
];

export function useTurnState() {
  const [state, setState] = useState<TurnState>(PRESETS[1].state);

  const result = useMemo(() => burstProbability(state), [state]);

  /** マスをクリック: ランナーを置く / 動かす / 外す。 */
  const toggleCell = useCallback((column: number, position: number) => {
    setState(prev => {
      if (prev.clearedColumns.includes(column)) return prev;

      const existing = prev.runners.find(r => r.column === column);
      if (existing) {
        const runners = existing.position === position
          ? prev.runners.filter(r => r.column !== column)
          : prev.runners.map(r => (r.column === column ? { column, position } : r));
        return { ...prev, runners };
      }

      if (prev.runners.length >= MAX_RUNNERS) return prev;
      return { ...prev, runners: [...prev.runners, { column, position }] };
    });
  }, []);

  /** 列見出しをクリック: クリア済みを切り替える（ランナーがいれば外す）。 */
  const toggleCleared = useCallback((column: number) => {
    setState(prev => {
      const cleared = prev.clearedColumns.includes(column);
      return {
        ...prev,
        clearedColumns: cleared
          ? prev.clearedColumns.filter(c => c !== column)
          : [...prev.clearedColumns, column].sort((a, b) => a - b),
        runners: cleared ? prev.runners : prev.runners.filter(r => r.column !== column),
      };
    });
  }, []);

  /** 組み合わせ表から3列をまとめて反映する。 */
  const setRunnerColumns = useCallback((columns: readonly number[]) => {
    setState(prev => ({
      ...prev,
      runners: columns.map(column => {
        const existing = prev.runners.find(r => r.column === column);
        return { column, position: existing ? Math.min(existing.position, COLUMN_HEIGHT[column] - 1) : 1 };
      }),
      clearedColumns: prev.clearedColumns.filter(c => !columns.includes(c)),
    }));
  }, []);

  const reset = useCallback(() => {
    setState({ runners: [], clearedColumns: [], progress: {} });
  }, []);

  const applyPreset = useCallback((preset: Preset) => {
    setState({
      runners: preset.state.runners.map(r => ({ ...r })),
      clearedColumns: [...preset.state.clearedColumns],
      progress: { ...preset.state.progress },
    });
  }, []);

  return { state, result, toggleCell, toggleCleared, setRunnerColumns, reset, applyPreset };
}
