import type { Progress, StopDecision } from './ai';

export function formatPercent(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** 進捗を「0.42列分（8マス）」の形にする。マス数は整数なら小数点を出さない。 */
export function formatProgress(progress: Progress): string {
  const steps = Number.isInteger(progress.steps) ? progress.steps : progress.steps.toFixed(1);
  return `${progress.value.toFixed(2)}列分（${steps}マス）`;
}

/** AIが振る/止めるを決めた根拠を1行で説明する。実際に使った基準だけを書く。 */
export function describeDecision(decision: StopDecision): string {
  switch (decision.reason) {
    case 'win':
      return '止めれば勝てる';
    case 'rolls': {
      const { done, max } = decision.rolls!;
      return `${done}回振った（上限 ${max} 回）`;
    }
    case 'burst': {
      const { probability, threshold } = decision.burst!;
      const compare = decision.continue ? '≤' : '>';
      return `バースト率 ${formatPercent(probability)} ${compare} しきい値 ${formatPercent(threshold, 0)}`;
    }
    case 'expectimax': {
      const compare = decision.continue ? '>' : '≤';
      return `振ると期待 ${formatProgress(decision.expected!)} ${compare} 止めると ${formatProgress(decision.current)}`;
    }
  }
}
