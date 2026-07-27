import {
  COLUMNS,
  MAX_RUNNERS,
  isPlayableSum,
  sumReachProbability,
  type BurstResult,
  type TurnState,
} from '../lib/cantstop';

type Props = {
  state: TurnState;
  result: BurstResult;
};

const REACH = sumReachProbability();

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/** バースト率に応じた危険度ラベル。 */
function riskLabel(probability: number): { text: string; level: string } {
  if (probability < 0.15) return { text: '安全圏', level: 'low' };
  if (probability < 0.3) return { text: 'やや危険', level: 'mid' };
  if (probability < 0.5) return { text: '危険', level: 'high' };
  return { text: '非常に危険', level: 'max' };
}

export function ResultPanel({ state, result }: Props) {
  const risk = riskLabel(result.probability);
  const freeRunners = MAX_RUNNERS - state.runners.length;
  const activeColumns = [...state.runners].sort((a, b) => a.column - b.column);

  return (
    <section className="panel">
      <div className="panel__headline">
        <div>
          <div className="panel__caption">次のロールでバーストする確率</div>
          <div className={`panel__value panel__value--${risk.level}`}>{percent(result.probability)}</div>
          <div className="panel__detail">
            1296 通り中 <strong>{result.burstCount}</strong> 通り（全列挙による厳密値）
          </div>
        </div>
        <span className={`risk risk--${risk.level}`}>{risk.text}</span>
      </div>

      <div className="meter">
        <div className={`meter__fill meter__fill--${risk.level}`} style={{ width: `${result.probability * 100}%` }} />
      </div>

      <dl className="facts">
        <div>
          <dt>進行中の列</dt>
          <dd>{activeColumns.length > 0 ? activeColumns.map(r => r.column).join(' / ') : 'なし'}</dd>
        </div>
        <div>
          <dt>空きランナー</dt>
          <dd>{freeRunners} 個</dd>
        </div>
        <div>
          <dt>クリア済みの列</dt>
          <dd>{state.clearedColumns.length > 0 ? [...state.clearedColumns].sort((a, b) => a - b).join(' / ') : 'なし'}</dd>
        </div>
      </dl>

      <div className="sums">
        <div className="sums__caption">
          各列の出やすさ（バーは4個のサイコロからその和を作れる確率／色つきが進行可能な列）
        </div>
        {COLUMNS.map(sum => {
          const playable = isPlayableSum(sum, state);
          return (
            <div className={`sums__row${playable ? ' sums__row--playable' : ''}`} key={sum}>
              <span className="sums__label">{sum}</span>
              <span className="sums__bar">
                <span className="sums__bar-fill" style={{ width: `${REACH[sum] * 100}%` }} />
              </span>
              <span className="sums__value">{percent(REACH[sum])}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
