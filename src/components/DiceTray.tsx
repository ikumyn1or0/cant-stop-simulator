import type { Roll } from '../lib/cantstop';
import type { Move } from '../lib/game';

type Props = {
  roll: Roll | null;
  moves: Move[];
  onChoose: (move: Move) => void;
};

function moveLabel(move: Move): string {
  if (move.sums.length === 1) return `${move.sums[0]} を進める`;
  if (move.sums[0] === move.sums[1]) return `${move.sums[0]} を2段進める`;
  return `${move.sums[0]} と ${move.sums[1]} を進める`;
}

export function DiceTray({ roll, moves, onChoose }: Props) {
  return (
    <div className="dice-tray">
      <div className="dice" aria-label="出目">
        {(roll ?? [null, null, null, null]).map((die, i) => (
          <span className={`die${die === null ? ' die--empty' : ''}`} key={i}>
            {die ?? ''}
          </span>
        ))}
      </div>

      {moves.length > 0 && (
        <div className="dice-tray__moves">
          {moves.map(move => (
            <button
              type="button"
              className="btn btn--move"
              key={`${move.pairing}:${move.sums.join(',')}`}
              onClick={() => onChoose(move)}
            >
              {moveLabel(move)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
