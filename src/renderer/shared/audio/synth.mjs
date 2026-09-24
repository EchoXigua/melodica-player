import { slicePlan } from '../../../shared/seek.mjs';
// Audio is synthesized from the compiled notes, not from game output or an MP3.
export function createSynth({
  createContext = () => new AudioContext(),
  every = setInterval,
  cancel = clearInterval,
} = {}) {
  let context,
    master,
    timer,
    cursor = 0,
    volume = 0.35;
  const voices = new Set();
  function stop() {
    if (timer !== undefined) cancel(timer);
    timer = undefined;
    for (const voice of voices) {
      voice.oscillator.onended = null;
      try {
        voice.oscillator.stop();
      } catch {}
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
    voices.clear();
  }
  function setVolume(value) {
    volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (master) master.gain.setValueAtTime(volume * 0.22, context.currentTime);
  }
  async function prepare() {
    if (!context || context.state === 'closed') {
      context = createContext();
      master = context.createGain();
      master.connect(context.destination);
      setVolume(volume);
    }
    await context.resume();
    if (context.state !== 'running') throw Error('音频未启动，请再次点击有声试听');
  }
  function start(original, offset = 0) {
    const plan = slicePlan(original, offset);
    stop();
    if (!context || context.state !== 'running') throw Error('请先点击有声试听以启用音频');
    const origin = context.currentTime + 0.02;
    cursor = 0;
    const tick = () => {
      while (
        cursor < plan.notes.length &&
        origin + plan.notes[cursor].at / 1000 < context.currentTime + 0.5
      ) {
        const note = plan.notes[cursor++];
        const end = origin + (note.at + note.hold) / 1000;
        if (end <= context.currentTime) continue;
        const at = Math.max(context.currentTime, origin + note.at / 1000);
        const oscillator = context.createOscillator(),
          gain = context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(440 * 2 ** ((note.pitch - 69) / 12), at);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(1, Math.min(at + 0.008, end));
        gain.gain.setValueAtTime(1, Math.max(at + 0.008, end - 0.012));
        gain.gain.linearRampToValueAtTime(0, Math.max(at + 0.009, end));
        oscillator.connect(gain);
        gain.connect(master);
        const voice = { oscillator, gain };
        voices.add(voice);
        oscillator.onended = () => {
          voices.delete(voice);
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(at);
        oscillator.stop(Math.max(at + 0.01, end));
      }
      if (cursor >= plan.notes.length) {
        cancel(timer);
        timer = undefined;
      }
    };
    timer = every(tick, 30);
    tick();
  }
  function dispose() {
    stop();
    if (context && context.state !== 'closed') void context.close();
  }
  return { prepare, start, stop, setVolume, dispose };
}
