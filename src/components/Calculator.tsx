import { Board } from './Board';
import { CombinationTable } from './CombinationTable';
import { ResultPanel } from './ResultPanel';
import { useTurnState } from '../hooks/useTurnState';

export function Calculator() {
  const { state, result, toggleCell, toggleCleared, setRunnerColumns, resetAll, resetRunners } = useTurnState();

  return (
    <>
      <p className="lead">
        マスをクリックしてランナー（白コマ）を置き、列の数字をクリックするとその列をクリア済みにできます。
        次のロールでバーストする確率を、サイコロ4個の 1296 通りを全て数え上げて厳密に計算します。
      </p>

      <Board state={state} onCellClick={toggleCell} onHeaderClick={toggleCleared} />

      <div className="controls">
        <button
          type="button"
          className="btn btn--reset"
          title="ランナーだけ消します。クリア済みの列はそのまま残ります"
          onClick={resetRunners}
        >
          進行中列リセット
        </button>
        <button
          type="button"
          className="btn btn--reset"
          title="ランナーとクリア済みの列を全て消します"
          onClick={resetAll}
        >
          全列リセット
        </button>
      </div>

      <ResultPanel state={state} result={result} />

      <CombinationTable state={state} onSelect={setRunnerColumns} />

      <section className="rules">
        <h2 className="rules__title">バーストの判定ルール</h2>
        <p>
          4個のサイコロは <code>(1,2)+(3,4)</code> / <code>(1,3)+(2,4)</code> / <code>(1,4)+(2,3)</code> の3通りに分けられ、
          そのいずれかで作った和の列を1つでも進められれば、そのロールはセーフです。
          どの分け方でもどちらの和も進められないときにバーストします。
        </p>
        <p>和が進められるのは、次を全て満たすときです。</p>
        <ol>
          <li>その列が誰かにクリアされていないこと（クリア済みの列はランナーが余っていても置けません）</li>
          <li>その列にランナーがいるなら、まだ最上段に達していないこと</li>
          <li>ランナーがいないなら、ランナーに空きがあること（1ターンに3個まで）</li>
        </ol>
      </section>
    </>
  );
}
