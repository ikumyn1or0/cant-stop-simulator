import { PLAYER_NAMES, type LogEntry } from '../hooks/useMatch';

type Props = {
  log: LogEntry[];
};

export function TurnLog({ log }: Props) {
  if (log.length === 0) return null;

  return (
    <section className="log">
      <h2 className="log__title">進行ログ</h2>
      <ol className="log__list">
        {[...log].reverse().map(entry => (
          <li className={`log__item log__item--p${entry.player}`} key={entry.id}>
            <span className="log__who">{PLAYER_NAMES[entry.player]}</span>
            <span>{entry.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
