import { COLUMNS, COLUMN_HEIGHT } from '../lib/cantstop';
import type { GameState } from '../lib/game';
import { PLAYER_NAMES } from '../hooks/useMatch';

type Props = {
  game: GameState;
};

/**
 * 対戦用の盤面。1つの列に両プレイヤーの恒久進捗を左右に分けて描き、
 * 手番プレイヤーのランナーを上に重ねる。
 */
export function GameBoard({ game }: Props) {
  const maxHeight = COLUMN_HEIGHT[7];

  return (
    <>
      <div className="board">
        {COLUMNS.map(column => {
          const height = COLUMN_HEIGHT[column];
          const owner = game.claimedBy[column];
          const runner = game.runners.find(r => r.column === column);
          const progress = [game.progress[0][column] ?? 0, game.progress[1][column] ?? 0];

          return (
            <div className="track" key={column} style={{ paddingTop: (maxHeight - height) * 20 }}>
              <div className="track__cells">
                {Array.from({ length: height }, (_, i) => height - i).map(position => {
                  const gained = runner !== undefined
                    && position <= runner.position
                    && position > progress[game.current];
                  const classes = [
                    'cell',
                    'cell--game',
                    owner !== undefined && `cell--owned cell--owned-p${owner}`,
                    gained && `cell--gain cell--gain-p${game.current}`,
                    runner?.position === position && `cell--runner-p${game.current}`,
                  ].filter(Boolean).join(' ');

                  return (
                    <div className={classes} key={position}>
                      <span className={`half half--p0${progress[0] >= position ? ' half--filled' : ''}`} />
                      <span className={`half half--p1${progress[1] >= position ? ' half--filled' : ''}`} />
                    </div>
                  );
                })}
              </div>
              <div
                className={`track__label track__label--static${owner !== undefined ? ` track__label--owned-p${owner}` : ''}`}
                title={owner !== undefined ? `${PLAYER_NAMES[owner]}が獲得` : undefined}
              >
                {column}
              </div>
            </div>
          );
        })}
      </div>

      <div className="legend">
        <span className="legend__item"><span className="swatch swatch--p0" />あなた（マスの左半分）</span>
        <span className="legend__item"><span className="swatch swatch--p1" />AI（右半分）</span>
        <span className="legend__item"><span className="swatch swatch--runner" />今ターンの進み</span>
      </div>
    </>
  );
}
