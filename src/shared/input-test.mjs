import { compile, parseScore } from './score.mjs';
export const INPUT_TEST_REQUEST = {
  mode: 'score',
  text: '1 2 3 4 5 6 7 >1 <1 >2 #4 <#2 >#3',
  settings: { bpm: 240, base: 60, gap: 45, lead: 20 },
  dry: false,
};
export function inputTestPlan() {
  return compile(
    parseScore(INPUT_TEST_REQUEST.text, INPUT_TEST_REQUEST.settings),
    INPUT_TEST_REQUEST.settings,
  );
}
export function compareInputEvents(expected, observed) {
  const trusted = observed.filter((e) => e.trusted === true);
  const same = (a, b) => a && b && a.device === b.device && a.code === b.code && a.down === b.down;
  const held = new Set();
  for (const e of trusted) {
    const key = `${e.device}:${e.code}`;
    if (e.down) held.add(key);
    else held.delete(key);
  }
  const mismatch = expected.findIndex((e, i) => !same(e, trusted[i]));
  return {
    passed:
      mismatch === -1 &&
      trusted.length === expected.length &&
      observed.length === trusted.length &&
      held.size === 0,
    expected: expected.length,
    received: trusted.length,
    untrusted: observed.length - trusted.length,
    mismatch,
    held: [...held],
  };
}
