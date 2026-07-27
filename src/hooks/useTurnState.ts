import { useCallback, useMemo, useState } from 'react';
import {
  COLUMN_HEIGHT,
  MAX_RUNNERS,
  burstProbability,
  type TurnState,
} from '../lib/cantstop';

/** 初期表示は、3列でもっともバーストしにくい 6 / 7 / 8 の局面。 */
function initialState(): TurnState {
  return {
    runners: [6, 7, 8].map(column => ({ column, position: 1 })),
    clearedColumns: [],
    progress: {},
  };
}

export function useTurnState() {
  const [state, setState] = useState<TurnState>(initialState);

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

  /** ランナーもクリア済みの列も全て消す。 */
  const resetAll = useCallback(() => {
    setState({ runners: [], clearedColumns: [], progress: {} });
  }, []);

  /** ランナーだけ消す。クリア済みの列はターンをまたいでも残るのでそのまま。 */
  const resetRunners = useCallback(() => {
    setState(prev => ({ ...prev, runners: [] }));
  }, []);

  return { state, result, toggleCell, toggleCleared, setRunnerColumns, resetAll, resetRunners };
}
