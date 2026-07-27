import { DIFFICULTIES, DIFFICULTY_HINTS, DIFFICULTY_LABELS } from '../lib/ai';
import { COLUMNS_TO_WIN, claimedCount } from '../lib/game';
import { AI, HUMAN, PLAYER_NAMES, useMatch } from '../hooks/useMatch';
import { DiceTray } from './DiceTray';
import { GameBoard } from './GameBoard';
import { TurnLog } from './TurnLog';

export function Match() {
  const {
    game, log, moves, burst, isHumanTurn,
    difficulty, setDifficulty,
    showBurst, setShowBurst,
    roll, choose, stop, acknowledgeBust, newMatch,
  } = useMatch();

  const finished = game.phase === 'finished';

  return (
    <>
      <p className="lead">
        3列を先に取ったほうが勝ちです。振るたびに進める列を選び、止めればそのターンの進捗が確定します。
        止める前にバーストすると、そのターンに進めた分は全て失われます。
      </p>

      <div className="setup">
        <span className="setup__label">AIの強さ</span>
        {DIFFICULTIES.map(level => (
          <button
            type="button"
            key={level}
            className={`btn btn--level${level === difficulty ? ' is-active' : ''}`}
            title={DIFFICULTY_HINTS[level]}
            onClick={() => setDifficulty(level)}
          >
            {DIFFICULTY_LABELS[level]}
          </button>
        ))}
        <button type="button" className="btn btn--reset" onClick={newMatch}>新しい対局</button>
      </div>

      <div className="score">
        {[HUMAN, AI].map(player => (
          <div className={`score__side score__side--p${player}${game.current === player && !finished ? ' is-turn' : ''}`} key={player}>
            <span className="score__name">{PLAYER_NAMES[player]}</span>
            <span className="score__count">{claimedCount(game, player)} / {COLUMNS_TO_WIN}</span>
          </div>
        ))}
      </div>

      <GameBoard game={game} />

      <section className="turn">
        {finished ? (
          <div className={`turn__banner turn__banner--${game.winner === HUMAN ? 'win' : 'lose'}`}>
            <strong>{game.winner === HUMAN ? 'あなたの勝ちです' : 'AIの勝ちです'}</strong>
            <button type="button" className="btn btn--move" onClick={newMatch}>もう一局</button>
          </div>
        ) : !isHumanTurn ? (
          <>
            <div className="turn__status">AI（{DIFFICULTY_LABELS[difficulty]}）の番です…</div>
            <DiceTray roll={game.roll} moves={[]} onChoose={() => {}} />
          </>
        ) : game.phase === 'busted' ? (
          <>
            <div className="turn__status turn__status--bust">バースト！ このターンの進捗は失われます</div>
            <DiceTray roll={game.roll} moves={[]} onChoose={() => {}} />
            <button type="button" className="btn btn--move" onClick={acknowledgeBust}>相手の番へ</button>
          </>
        ) : game.phase === 'choose' ? (
          <>
            <div className="turn__status">進める列を選んでください</div>
            <DiceTray roll={game.roll} moves={moves} onChoose={choose} />
          </>
        ) : (
          <>
            <div className="turn__status">
              {game.phase === 'roll' ? 'あなたの番です' : 'もう一度振りますか？'}
            </div>
            <DiceTray roll={game.roll} moves={[]} onChoose={() => {}} />
            {showBurst && (
              <div className="turn__burst">
                もう1回振ると <strong>{(burst.probability * 100).toFixed(2)}%</strong> でバースト
                <span className="turn__burst-detail">（1296通り中 {burst.burstCount} 通り）</span>
              </div>
            )}
            <div className="turn__actions">
              <button type="button" className="btn btn--move" onClick={roll}>振る</button>
              <button
                type="button"
                className="btn btn--stop"
                onClick={stop}
                disabled={game.phase !== 'decide'}
                title={game.phase === 'decide' ? undefined : '1回は振る必要があります'}
              >
                止める
              </button>
            </div>
          </>
        )}

        <label className="toggle">
          <input type="checkbox" checked={showBurst} onChange={e => setShowBurst(e.target.checked)} />
          バースト率を表示する
        </label>
      </section>

      <TurnLog log={log} />
    </>
  );
}
