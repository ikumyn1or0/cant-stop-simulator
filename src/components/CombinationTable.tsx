import { useMemo } from 'react';
import { allTripleCombinations, type TurnState } from '../lib/cantstop';

type Props = {
  state: TurnState;
  onSelect: (columns: readonly number[]) => void;
};

export function CombinationTable({ state, onSelect }: Props) {
  const rows = useMemo(() => allTripleCombinations(), []);

  const currentKey = useMemo(() => {
    if (state.runners.length !== 3 || state.clearedColumns.length > 0) return null;
    return state.runners.map(r => r.column).sort((a, b) => a - b).join('/');
  }, [state]);

  return (
    <section className="combos">
      <h2 className="combos__title">ランナー3列の組み合わせ 165 通り</h2>
      <p className="combos__note">
        クリア済みの列がない前提でのバースト率。行をクリックするとその3列を盤面に反映します。
      </p>
      <div className="combos__scroll">
        <table className="combos__table">
          <thead>
            <tr>
              <th>順位</th>
              <th>列</th>
              <th>バースト率</th>
              <th>バースト数</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const key = row.columns.join('/');
              return (
                <tr
                  key={key}
                  className={key === currentKey ? 'is-current' : undefined}
                  onClick={() => onSelect(row.columns)}
                >
                  <td>{index + 1}</td>
                  <td className="combos__cols">{row.columns.join(' / ')}</td>
                  <td>{(row.probability * 100).toFixed(2)}%</td>
                  <td className="combos__count">{row.burstCount} / 1296</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
