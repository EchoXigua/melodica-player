// Browser preview uses the same score compiler; it never sends OS input.
import { libraryDB } from './library-db';
import { slicePlan } from '../../shared/seek.mjs';
import { Midi } from '@tonejs/midi';
import { midiBytes } from '../../shared/midi-file.mjs';
import { createScoreSession } from '../../shared/score-session.mjs';
import { simulate } from '../../shared/simulation.mjs';
const scoreSession = createScoreSession();
let job = null;
const listeners = new Set();
const emit = (data) => listeners.forEach((fn) => fn(data));
const wrap =
  (fn) =>
  async (...args) => {
    try {
      return { ok: true, value: await fn(...args) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };
const plan = scoreSession.compile;
export const browserApi = {
  openInputTest: wrap(() => {
    location.search = '?view=input-test';
  }),
  startInputTest: wrap(() => {
    throw Error('请在 macOS 或 Windows 桌面端进行真实键鼠测试');
  }),
  reportInput: () => {},
  onInputTest: () => () => {},
  info: wrap(() => ({ platform: 'browser', version: '0.2.0' })),
  compile: wrap(plan),
  targets: wrap(() => []),
  copyText: wrap((text) => navigator.clipboard.writeText(text)),
  loadBundledMidi: wrap(async (name) => {
    const res = await fetch(`./${name}`);
    if (!res.ok) throw Error(`无法加载 ${name}`);
    const parsed = new Midi(midiBytes(await res.arrayBuffer()));
    return scoreSession.importMidi(parsed, name);
  }),
  readLibrary: wrap(() => libraryDB()),
  saveLibrary: wrap((value) => libraryDB(value)),
  restoreMidi: wrap((value) => {
    const parsed = new Midi();
    parsed.fromJSON(value.data);
    return scoreSession.importMidi(parsed, value.name);
  }),
  importMidi: wrap(
    () =>
      new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.mid,.midi';
        input.oncancel = () => resolve(null);
        input.onchange = async () => {
          try {
            const file = input.files[0];
            if (!file) return resolve(null);
            if (file.size > 10 * 1024 * 1024) throw Error('MIDI 文件不能超过 10 MB');
            const parsed = new Midi(midiBytes(await file.arrayBuffer()));
            resolve(scoreSession.importMidi(parsed, file.name));
          } catch (e) {
            reject(e);
          }
        };
        input.click();
      }),
  ),
  play: wrap((request) => {
    if (!request.dry) throw Error('浏览器只支持模拟运行，请在 macOS 或 Windows 桌面端演奏');
    if (job) throw Error('已有演奏任务');
    const score = slicePlan(plan(request), request.startAt);
    const current = { cancelled: false };
    job = current;
    let terminal;
    simulate(
      score,
      current,
      (state) => {
        if (['done', 'stopped'].includes(state.type)) terminal = state;
        else emit(state);
      },
      { countdown: request.audition || request.seekResume ? 0 : 3000 },
    )
      .then(() => {
        if (job === current) job = null;
        emit(terminal);
      })
      .catch((error) => {
        job = null;
        emit({ type: 'error', message: error.message });
      });
    return { notes: score.notes.length };
  }),
  stop: wrap((options) => {
    emit({ type: 'stop-requested', seeking: options?.seeking === true });
    if (job) {
      job.cancelled = true;
      return { requested: true };
    }
    return { requested: false };
  }),
  onPlayback: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
