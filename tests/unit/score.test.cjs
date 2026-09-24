const test = require('node:test');
const assert = require('node:assert/strict');
const { parseScore, compile, monophonic } = require('../../src/shared/score.mjs');
const { Midi } = require('@tonejs/midi');
test('简谱节拍、休止、音区和半音', () => {
  const s = parseScore('1:0.5 0 <#2 >1:2 // 注释\n| 3', { bpm: 120 });
  assert.deepEqual(
    s.notes.map((n) => n.midi),
    [60, 51, 72, 64],
  );
  assert.equal(s.notes[1].time, 0.75);
  assert.equal(s.duration, 2.75);
});
test('音域内全部 38 半音可编译且键鼠成对释放', () => {
  for (let pitch = 48; pitch <= 85; pitch++) {
    const p = compile({ notes: [{ midi: pitch, time: 0, duration: 1 }], duration: 1 }, {});
    const held = new Set();
    for (const e of p.events) {
      const id = e.device + e.code;
      if (e.down) {
        assert(!held.has(id));
        held.add(id);
      } else {
        assert(held.has(id));
        held.delete(id);
      }
    }
    assert.equal(held.size, 0);
    assert.equal(p.notes[0].pitch, pitch);
  }
});
test('超音域、非法曲谱、参数和过短音符显式失败', () => {
  assert.throws(() => parseScore('8', {}));
  assert.throws(() => parseScore('#0', {}));
  assert.throws(() => parseScore('1', { bpm: 0 }));
  assert.throws(() => compile(parseScore('1', {}), { transpose: 36 }), /超出/);
  assert.throws(() => compile(parseScore('1:0.0625', { bpm: 300 }), {}), /过短/);
});
test('同音重奏先释放，修饰键不泄漏到下一音', () => {
  const p = compile(parseScore('<1 <1 >#2 3', {}), {});
  for (let i = 1; i < p.notes.length; i++) {
    assert(p.notes[i - 1].at + p.notes[i - 1].hold < p.notes[i].at - p.settings.lead);
  }
  assert.deepEqual(p.notes[0].mouse, ['left']);
  assert.deepEqual(p.notes[2].mouse, ['right', 'middle']);
});
test('MIDI 重叠处理确定且不修改原数据', () => {
  const input = [
    { midi: 60, time: 0, duration: 2 },
    { midi: 67, time: 0, duration: 2 },
    { midi: 62, time: 1, duration: 1 },
  ];
  const s = monophonic(input);
  assert.equal(s.notes[0].midi, 67);
  assert.equal(s.notes[0].duration, 1);
  assert.equal(input[1].duration, 2);
  assert.equal(s.warnings.length, 1);
});
test('真实 MIDI 二进制解析保留变速后的时间', () => {
  const m = new Midi();
  m.header.tempos = [
    { ticks: 0, bpm: 120 },
    { ticks: 480, bpm: 60 },
  ];
  m.header.update();
  m.addTrack()
    .addNote({ midi: 60, ticks: 0, durationTicks: 480 })
    .addNote({ midi: 62, ticks: 480, durationTicks: 480 });
  const roundtrip = new Midi(m.toArray());
  const s = monophonic(roundtrip.tracks[0].notes);
  assert.equal(s.notes[0].duration, 0.5);
  assert.equal(s.notes[1].time, 0.5);
  assert.equal(s.notes[1].duration, 1);
  const p = compile(s, { speed: 0.5 });
  assert.equal(p.notes[1].at, 1012);
});
test('尾部休止计入总长', () => {
  const p = compile(parseScore('1 0:4', { bpm: 60 }), {});
  assert.equal(p.duration, 5012);
});
