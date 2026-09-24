const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter, once } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const { createPlayback } = require('../../src/main/services/playback.cjs');
const { inputTestPlan, compareInputEvents } = require('../../src/shared/input-test.mjs');
const { isStopShortcut, shortcutHint } = require('../../src/shared/shortcuts.mjs');
const { registerStopShortcuts } = require('../../src/main/services/shortcuts.cjs');
test('media play/pause is not F8; fallback and failed registration are explicit', () => {
  assert.equal(isStopShortcut({ key: 'MediaPlayPause' }), false);
  assert.equal(isStopShortcut({ key: 'F8' }), true);
  assert.equal(isStopShortcut({ key: 's', metaKey: true, shiftKey: true }), true);
  assert.equal(isStopShortcut({ key: 'S', control: true, shift: true }), true);
  assert.equal(isStopShortcut({ key: 's', metaKey: true }), false);
  const callbacks = {};
  assert.deepEqual(
    registerStopShortcuts(
      {
        register(key, fn) {
          callbacks[key] = fn;
          return key !== 'F8';
        },
      },
      () => {},
    ),
    { f8: false, fallback: true },
  );
  assert.match(
    shortcutHint({ platform: 'darwin', shortcuts: { f8: false, fallback: true } }),
    /⌘⇧S/,
  );
});
test('native stop is confirmed only on close; late release errors override STOP', async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  const events = [],
    idle = new EventEmitter();
  let args;
  const playback = createPlayback({
    getPlan: inputTestPlan,
    emit: (e) => events.push(e),
    onIdle: () => idle.emit('idle'),
    platform: 'win32',
    getTempPath: os.tmpdir,
    launch: (_mode, values) => {
      args = values;
      return child;
    },
  });
  await playback.play({ dry: false, target: '123:456' });
  await assert.rejects(playback.play({ dry: true }), /已有/);
  const stopPath = args[args.indexOf('-StopFile') + 1];
  await playback.stop();
  assert.equal(await fs.readFile(stopPath, 'utf8'), 'stop');
  child.stdout.emit('data', Buffer.from('STOP Cancelled\n'));
  assert.equal(playback.busy, true);
  assert.equal(events.length, 0);
  child.stdout.emit('data', Buffer.from('ERROR Could not release all inputs')); // partial final line
  const finished = once(idle, 'idle');
  child.emit('close', 0);
  await finished;
  assert.equal(playback.busy, false);
  assert.equal(events.at(-1).type, 'error');
  assert.match(events.at(-1).message, /release/);
  await assert.rejects(fs.stat(stopPath), /ENOENT/);
});
test('cancelling during native preparation prevents launching the input process', async () => {
  let launched = false;
  const events = [];
  const playback = createPlayback({
    getPlan: inputTestPlan,
    emit: (e) => events.push(e),
    onIdle: () => {},
    platform: 'win32',
    getTempPath: os.tmpdir,
    launch: () => {
      launched = true;
    },
  });
  const start = playback.play({ dry: false, target: '123:456' });
  await playback.stop();
  await start;
  assert.equal(launched, false);
  assert.equal(playback.busy, false);
  assert.equal(events.at(-1).type, 'stopped');
});
test('receiver comparison rejects missing, extra, untrusted and unreleased input', () => {
  const expected = inputTestPlan().events;
  const observed = expected.map((e) => ({ ...e, trusted: true }));
  assert.equal(compareInputEvents(expected, observed).passed, true);
  assert.equal(compareInputEvents(expected, observed.slice(1)).passed, false);
  assert.equal(compareInputEvents(expected, [...observed, observed[0]]).passed, false);
  assert.equal(
    compareInputEvents(
      expected,
      observed.map((e) => ({ ...e, trusted: false })),
    ).passed,
    false,
  );
  assert.ok(
    compareInputEvents(expected, [
      { device: 'key', code: 'Z', down: true, trusted: true },
    ]).held.includes('key:Z'),
  );
  assert.deepEqual(
    new Set(expected.filter((e) => e.device === 'mouse').map((e) => e.code)),
    new Set(['left', 'right', 'middle']),
  );
  assert.equal(new Set(expected.filter((e) => e.device === 'key').map((e) => e.code)).size, 8);
});

test('macOS routes its target to the native engine and confirms stop after close', async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  let args;
  const idle = new EventEmitter(),
    events = [];
  const playback = createPlayback({
    getPlan: inputTestPlan,
    emit: (e) => events.push(e),
    onIdle: () => idle.emit('idle'),
    platform: 'darwin',
    getTempPath: os.tmpdir,
    launch: (_mode, values) => {
      args = values;
      return child;
    },
  });
  await assert.rejects(playback.play({ dry: false, target: '123:456' }), /选择目标/);
  await playback.play({ dry: false, target: 'mac:123' });
  assert.equal(args[args.indexOf('-Target') + 1], 'mac:123');
  child.stdout.emit('data', Buffer.from('COUNTDOWN 5\nPLAYING\nNOTE 0\n'));
  await playback.stop();
  const stopPath = args[args.indexOf('-StopFile') + 1];
  assert.equal(await fs.readFile(stopPath, 'utf8'), 'stop');
  child.stdout.emit('data', Buffer.from('STOP 已取消\n'));
  assert.equal(playback.busy, true);
  const finished = once(idle, 'idle');
  child.emit('close', 0);
  await finished;
  assert.equal(events.at(-1).type, 'stopped');
  assert.equal(playback.busy, false);
});
