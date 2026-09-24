export const EXAMPLE = `1 1 5 5 | 6 6 5:2
4 4 3 3 | 2 2 1:2
5 5 4 4 | 3 3 2:2
5 5 4 4 | 3 3 2:2
1 1 5 5 | 6 6 5:2
4 4 3 3 | 2 2 1:2`;
export const SCALE = `<1 <2 <3 <4 <5 <6 <7
1 2 3 4 | 5 6 7 >1
>2 >3 >4 >5 >6 >7
1 #1 2 #2 3 4 #4 5 #5 6 #6 7 >1`;
export const DEFAULTS = { bpm: 100, base: 60, transpose: 0, speed: 1, gap: 35, lead: 12, jitter: 0 };
export { KEYS } from '../../../../shared/score.mjs';
export const MOUSE = { left: '低八度', right: '高八度', middle: '升半音' };
export const clock = (ms) =>
  `${String(Math.floor(Math.max(0, ms) / 60000)).padStart(2, '0')}:${String(Math.floor(Math.max(0, ms) / 1000) % 60).padStart(2, '0')}`;
