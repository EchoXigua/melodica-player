const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSynth } = require('../../src/renderer/shared/audio/synth.mjs');
function audioContext() {
  const oscillators = [],
    gains = [];
  const param = () => ({
    values: [],
    setValueAtTime(value, time) {
      this.values.push([value, time]);
    },
    linearRampToValueAtTime(value, time) {
      this.values.push([value, time]);
    },
  });
  return {
    state: 'suspended',
    currentTime: 0,
    destination: {},
    oscillators,
    gains,
    async resume() {
      this.state = 'running';
    },
    async close() {
      this.state = 'closed';
    },
    createGain() {
      const node = {
        gain: param(),
        connect() {},
        disconnect() {
          this.disconnected = true;
        },
      };
      gains.push(node);
      return node;
    },
    createOscillator() {
      const node = {
        frequency: param(),
        connect() {},
        disconnect() {
          this.disconnected = true;
        },
        start(time) {
          this.started = time;
        },
        stops: [],
        stop(time) {
          this.stops.push(time);
        },
      };
      oscillators.push(node);
      return node;
    },
  };
}
test('audition uses MIDI pitch and volume; stopping cancels active and future notes', async () => {
  const context = audioContext();
  let tick,
    cancelled = false;
  const synth = createSynth({
    createContext: () => context,
    every: (fn) => {
      tick = fn;
      return 7;
    },
    cancel: (id) => {
      if (id === 7) cancelled = true;
    },
  });
  await synth.prepare();
  synth.setVolume(0.5);
  synth.start({
    notes: [
      { pitch: 69, at: 0, hold: 1000 },
      { pitch: 81, at: 1500, hold: 100 },
    ],
  });
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.oscillators[0].frequency.values[0][0], 440);
  assert.equal(context.gains[0].gain.values.at(-1)[0], 0.11);
  context.currentTime = 1.1;
  tick();
  assert.equal(context.oscillators[1].frequency.values[0][0], 880);
  synth.stop();
  assert.equal(cancelled, true);
  assert.ok(context.oscillators.every((o) => o.stops.includes(undefined) && o.disconnected));
  synth.dispose();
  assert.equal(context.state, 'closed');
});
test('audio must be unlocked before playback and cannot silently start suspended', async () => {
  const context = audioContext();
  context.resume = async () => {};
  const synth = createSynth({ createContext: () => context });
  assert.throws(() => synth.start({ notes: [] }), /启用音频/);
  await assert.rejects(synth.prepare(), /音频未启动/);
  synth.dispose();
});
