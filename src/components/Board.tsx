import { COLUMNS, COLUMN_HEIGHT, isPlayableSum, type TurnState } from '../lib/cantstop';

type Props = {
  state: TurnState;
  onCellClick: (column: number, position: number) => void;
  onHeaderClick: (column: number) => void;
};

export function Board({ state, onCellClick, onHeaderClick }: Props) {
  const maxHeight = COLUMN_HEIGHT[7];

  return (
    <div className="board">
      {COLUMNS.map(column => {
        const height = COLUMN_HEIGHT[column];
        const cleared = state.clearedColumns.includes(column);
        const runner = state.runners.find(r => r.column === column);
        const playable = isPlayableSum(column, state);

        return (
          <div className="track" key={column} style={{ paddingTop: (maxHeight - height) * 20 }}>
            <div className="track__cells">
              {Array.from({ length: height }, (_, i) => height - i).map(position => {
                const isRunner = runner?.position === position;
                const passed = runner !== undefined && position < runner.position;
                const isTop = position === height;
                const classes = [
                  'cell',
                  isRunner && 'cell--runner',
                  passed && 'cell--passed',
                  isTop && 'cell--top',
                  cleared && 'cell--cleared',
                ].filter(Boolean).join(' ');

                return (
                  <button
                    type="button"
                    key={position}
                    className={classes}
                    disabled={cleared}
                    aria-label={`列 ${column} の ${position} 段目`}
                    onClick={() => onCellClick(column, position)}
                  />
                );
              })}
            </div>
            <button
              type="button"
              className={`track__label${cleared ? ' track__label--cleared' : ''}${playable ? ' track__label--playable' : ''}`}
              aria-label={`列 ${column}${cleared ? '（クリア済み）' : ''}`}
              onClick={() => onHeaderClick(column)}
            >
              {column}
            </button>
          </div>
        );
      })}
    </div>
  );
}
