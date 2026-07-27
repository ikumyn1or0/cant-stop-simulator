/** 0 以上 1 未満の乱数を返す関数。 */
export type Rng = () => number;

/**
 * mulberry32。シードを与えると毎回同じ列を返すので、テストで出目を固定できる。
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
