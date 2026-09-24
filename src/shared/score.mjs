const KEYS = ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ','];
const DEGREE = [0, 2, 4, 5, 7, 9, 11, 12];
function number(value, min, max, name, integer = false) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n)))
    throw Error(`${name}必须在 ${min}–${max} 之间${integer ? '且为整数' : ''}`);
  return n;
}
function settings(raw = {}) {
  return {
    bpm: number(raw.bpm ?? 100, 20, 300, 'BPM'),
    base: number(raw.base ?? 60, 24, 96, '基准音', true),
    transpose: number(raw.transpose ?? 0, -36, 36, '移调', true),
    speed: number(raw.speed ?? 1, 0.25, 3, '速度'),
    gap: number(raw.gap ?? 35, 5, 200, '音间隔'),
    lead: number(raw.lead ?? 12, 0, 100, '鼠标提前量'),
  };
}
function parseScore(text, raw) {
  const s = settings(raw);
  if (typeof text !== 'string' || text.length > 100000) throw Error('简谱过长');
  const tokens = text
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\|/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let cursor = 0;
  const notes = [];
  for (const token of tokens) {
    const m = token.match(/^([<>]?)(#?)([0-7])(?::(\d+(?:\.\d+)?))?$/);
    if (!m || (m[3] === '0' && (m[1] || m[2])))
      throw Error(`无法识别「${token}」；例：1 2:0.5 <3 >1 #4 0:2`);
    const beats = number(m[4] ?? 1, 0.0625, 32, '音符拍数');
    const duration = (beats * 60) / s.bpm;
    if (m[3] !== '0')
      notes.push({
        time: cursor,
        duration,
        midi:
          s.base +
          DEGREE[Number(m[3]) - 1] +
          (m[1] === '<' ? -12 : m[1] === '>' ? 12 : 0) +
          (m[2] ? 1 : 0),
        label: token,
      });
    cursor += duration;
  }
  return { notes, duration: cursor, warnings: [] };
}
function monophonic(input) {
  if (input.length > 20000) throw Error('最多支持 20,000 个音符，请先裁剪 MIDI 轨道');
  const sorted = input
    .map((n) => ({ midi: n.midi, time: n.time, duration: n.duration }))
    .sort((a, b) => a.time - b.time || b.midi - a.midi);
  const notes = [];
  let altered = 0;
  for (const n of sorted) {
    if (
      !Number.isFinite(n.time) ||
      !Number.isFinite(n.duration) ||
      n.time < 0 ||
      n.duration <= 0 ||
      !Number.isInteger(n.midi) ||
      n.midi < 0 ||
      n.midi > 127
    )
      throw Error('无效 MIDI 音符');
    const prev = notes.at(-1);
    if (prev && Math.abs(prev.time - n.time) < 0.0001) {
      altered++;
      continue;
    }
    if (prev && prev.time + prev.duration > n.time) {
      prev.duration = n.time - prev.time;
      altered++;
    }
    notes.push(n);
  }
  return {
    notes,
    duration: Math.max(0, ...notes.map((n) => n.time + n.duration)),
    warnings: altered ? [`已简化 ${altered} 处重叠音：同起点取最高音，交叠音截短。`] : [],
  };
}
function compile(source, raw) {
  const s = settings(raw);
  if (!source.notes.length) throw Error('曲谱中没有可演奏的音符');
  if (source.notes.length > 20000) throw Error('最多支持 20,000 个音符');
  const events = [],
    notes = [];
  const warnings = [...(source.warnings || [])];
  let previousMouse = '';
  for (let i = 0; i < source.notes.length; i++) {
    const n = source.notes[i];
    const pitch = n.midi + s.transpose;
    const candidates = [];
    for (const octave of [0, -1, 1])
      for (const sharp of [0, 1])
        for (let k = 0; k < 8; k++) {
          if (s.base + 12 * octave + DEGREE[k] + sharp === pitch) {
            const mouse = [
              ...(octave === -1 ? ['left'] : octave === 1 ? ['right'] : []),
              ...(sharp ? ['middle'] : []),
            ];
            candidates.push({
              key: KEYS[k],
              mouse,
              cost: mouse.length * 2 + (mouse.join(',') === previousMouse ? 0 : 1),
            });
          }
        }
    candidates.sort((a, b) => a.cost - b.cost);
    const mapping = candidates[0];
    if (!mapping)
      throw Error(
        `第 ${i + 1} 个音 MIDI ${pitch} 超出音域 ${s.base - 12}–${s.base + 25}，请调整移调`,
      );
    previousMouse = mapping.mouse.join(',');
    const at = Math.round((n.time * 1000) / s.speed) + s.lead;
    const available = Math.min(
      (n.duration * 1000) / s.speed,
      ((source.notes[i + 1]?.time - n.time) * 1000) / s.speed || Infinity,
    );
    const hold = Math.floor(available - s.gap - s.lead);
    if (hold < 10) throw Error(`第 ${i + 1} 个音过短；请降低速度或减小音间隔/鼠标提前量`);
    for (const button of mapping.mouse)
      events.push({ at: at - s.lead, device: 'mouse', code: button, down: true });
    events.push({ at, device: 'key', code: mapping.key, down: true, index: i });
    events.push({ at: at + hold, device: 'key', code: mapping.key, down: false });
    for (const button of mapping.mouse)
      events.push({ at: at + hold, device: 'mouse', code: button, down: false });
    notes.push({ ...n, pitch, at, hold, ...mapping });
  }
  events.sort((a, b) => a.at - b.at || Number(a.down) - Number(b.down));
  const duration = Math.max((source.duration * 1000) / s.speed + s.lead, events.at(-1).at);
  if (duration > 1800000) throw Error('单次演奏最长 30 分钟');
  return { events, notes, duration, warnings, settings: s };
}
export { KEYS, DEGREE, settings, parseScore, monophonic, compile };
