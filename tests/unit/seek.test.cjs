const { test } = require('node:test');
const assert = require('node:assert/strict');
const { slicePlan } = require('../../src/shared/seek.mjs');
const { compile, parseScore } = require('../../src/shared/score.mjs');
const { simulate } = require('../../src/shared/simulation.mjs');
test('seeking into a held modified note restores input state and releases it', () => {
  const plan = compile(parseScore('>2:4 0:2 1:2', {}), {});
  const clipped = slicePlan(plan, 1000);
  assert.equal(clipped.notes[0].index, 0);
  assert.equal(clipped.notes[0].at, 12);
  assert.equal(clipped.events[0].device, 'mouse');
  assert.equal(clipped.events[0].at, 0);
  assert.ok(clipped.events.some((e) => e.device === 'mouse' && e.down === false));
  assert.equal(clipped.duration, plan.duration - 1000);
  assert.equal(plan.notes[0].at, 12);
  const rest = slicePlan(plan, 2600);
  assert.equal(rest.notes[0].index, 1);
  assert.ok(rest.notes[0].at > 900);
  assert.equal(slicePlan(plan, plan.duration).notes.length, 0);
});
test('seek resume keeps original note indices and has no audition countdown', async () => {
  const plan = slicePlan(compile(parseScore('1 2 3', {}), {}), 700);
  let now = 0;
  const events = [];
  await simulate(plan, { cancelled: false }, (e) => events.push(e), {
    countdown: 0,
    now: () => now,
    wait: async () => {
      now += 100;
    },
  });
  assert.equal(
    events.some((e) => e.type === 'countdown'),
    false,
  );
  assert.equal(events[0].type, 'playing');
  assert.deepEqual(
    events.filter((e) => e.type === 'note').map((e) => e.index),
    [1, 2],
  );
});
