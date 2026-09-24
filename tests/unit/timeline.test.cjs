const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  timelineWindow,
  visibleNotes,
} = require('../../src/renderer/features/studio/data/timeline.mjs');
const { midiBytes } = require('../../src/shared/midi-file.mjs');
test('long scores show 20 seconds and preserve duration proportions', () => {
  const local = timelineWindow(94000, 0);
  const full = timelineWindow(94000, 0, true);
  const notes = [
    { at: 0, hold: 331 },
    { at: 400, hold: 662 },
  ];
  const bars = visibleNotes(notes, local);
  assert.equal(local.span, 20000);
  assert.equal(bars[1].width, bars[0].width * 2);
  assert.ok(bars[0].width > visibleNotes(notes, full)[0].width * 4);
  assert.equal(timelineWindow(94000, 22000).start, 20000);
  assert.equal(timelineWindow(94000, 94000).start, 80000);
  assert.equal(timelineWindow(12000, 0).span, 12000);
});
test('notes crossing a viewport boundary are clipped without dropping active index', () => {
  const notes = [
    { at: 19000, hold: 2000 },
    { at: 21000, hold: 500 },
    { at: 40000, hold: 500 },
  ];
  const bars = visibleNotes(notes, timelineWindow(94000, 21000));
  assert.deepEqual(
    bars.map((n) => n.index),
    [0, 1],
  );
  assert.equal(bars[0].left, 0);
  assert.equal(bars[0].width, 5);
  assert.equal(timelineWindow(94000, 21000, false, 0).start, 0);
});
test('HTML renamed to MIDI fails with an actionable error', () => {
  assert.throws(() => midiBytes(Buffer.from('<!DOCTYPE html><html>')), /MThd/);
  const bytes = Buffer.concat([Buffer.from('MThd'), Buffer.alloc(10)]);
  assert.equal(midiBytes(bytes), bytes);
  assert.deepEqual(
    midiBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)),
    new Uint8Array(bytes),
  );
});
