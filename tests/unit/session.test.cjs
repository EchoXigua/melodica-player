const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createScoreSession } = require('../../src/shared/score-session.mjs');
const { simulate } = require('../../src/shared/simulation.mjs');
test('MIDI sessions are isolated and reject missing or invalid tracks', () => {
  const a = createScoreSession(),
    b = createScoreSession();
  const midi = { tracks: [{ name: '', notes: [{ midi: 60, time: 0, duration: 0.5 }] }] };
  assert.deepEqual(a.importMidi(midi, 'test.mid'), {
    name: 'test.mid',
    data: midi,
    id: 'midi-1',
    bpm: 120,
    variableTempo: false,
    tracks: [{ index: 0, name: '轨道 1', count: 1 }],
  });
  const request = { mode: 'midi', track: 0, settings: {} };
  assert.equal(a.compile(request).notes.length, 1);
  assert.throws(() => b.compile(request), /MIDI/);
  assert.throws(() => a.compile({ ...request, track: -1 }), /MIDI/);
  assert.throws(() => a.compile({ mode: 'unknown' }), /无效/);
});
test('simulation emits ordered notes once, including a delayed timer tick', async () => {
  const events = [];
  let time = 0;
  await simulate(
    { notes: [{ at: 0 }, { at: 50 }, { at: 100 }], duration: 200 },
    { cancelled: false },
    (e) => events.push(e),
    {
      now: () => time,
      wait: async () => {
        time += 1000;
      },
    },
  );
  assert.deepEqual(
    events.map((e) => e.type),
    ['countdown', 'playing', 'note', 'note', 'note', 'done'],
  );
  assert.deepEqual(
    events.filter((e) => e.type === 'note').map((e) => e.index),
    [0, 1, 2],
  );
});
for (const cancelAt of [1000, 3100])
  test(`simulation cancellation at ${cancelAt}ms releases the run without completion`, async () => {
    const events = [],
      token = { cancelled: false };
    let time = 0;
    await simulate(
      { notes: [{ at: 0 }, { at: 500 }], duration: 1000 },
      token,
      (e) => events.push(e),
      {
        now: () => time,
        wait: async () => {
          time += 100;
          if (time >= cancelAt) token.cancelled = true;
        },
      },
    );
    assert.equal(events.at(-1).type, 'stopped');
    assert.ok(!events.some((e) => e.type === 'done'));
    assert.equal(events.filter((e) => e.type === 'note').length, cancelAt < 3000 ? 0 : 1);
  });

test('imported MIDI files remain individually selectable', () => {
  const session = createScoreSession();
  const first = session.importMidi(
    { tracks: [{ notes: [{ midi: 60, time: 0, duration: 0.5 }] }] },
    'one.mid',
  );
  const second = session.importMidi(
    { tracks: [{ notes: [{ midi: 64, time: 0, duration: 0.5 }] }] },
    'two.mid',
  );
  const request = { mode: 'midi', track: 0, settings: {} };
  assert.notEqual(first.id, second.id);
  assert.notDeepEqual(
    session.compile({ ...request, midiId: first.id }).notes,
    session.compile({ ...request, midiId: second.id }).notes,
  );
  assert.throws(() => session.compile({ ...request, midiId: 'missing' }), /MIDI/);
});

test('MIDI leading silence is optional and internal rests and original data are preserved', () => {
  const session = createScoreSession();
  const original = [
    { midi: 60, time: 29.54, duration: 0.5 },
    { midi: 64, time: 31.54, duration: 0.5 },
  ];
  const file = session.importMidi({ tracks: [{ notes: original }] }, 'delayed.mid');
  const request = { mode: 'midi', midiId: file.id, track: 0, settings: {} };
  const trimmed = session.compile(request);
  assert.equal(trimmed.notes[0].at, 12);
  assert.equal(trimmed.notes[1].at, 2012);
  assert.match(trimmed.warnings.join(' '), /29.54/);
  const full = session.compile({ ...request, trimMidiStart: false });
  assert.equal(full.notes[0].at, 29552);
  assert.equal(original[0].time, 29.54);
  assert.ok(Math.abs(full.duration - trimmed.duration - 29540) < 0.001);
});

test('serialized MIDI restores into a fresh session with unchanged timing and notes', () => {
  const { Midi } = require('@tonejs/midi');
  const midi = new Midi();
  midi.header.setTempo(73);
  midi.addTrack().addNote({ midi: 64, time: 3, duration: 1 });
  const original = createScoreSession();
  const meta = original.importMidi(midi, 'saved.mid');
  const saved = JSON.parse(JSON.stringify(meta));
  const parsed = new Midi();
  parsed.fromJSON(saved.data);
  const fresh = createScoreSession();
  const restored = fresh.importMidi(parsed, saved.name);
  assert.deepEqual(
    fresh.compile({ mode: 'midi', track: 0, midiId: restored.id }),
    original.compile({ mode: 'midi', track: 0, midiId: meta.id }),
  );
});
