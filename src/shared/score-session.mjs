import { parseScore, compile, monophonic } from './score.mjs';
// Each desktop window or browser instance owns its imported MIDI separately.
export function createScoreSession() {
  let midi = null,
    serial = 0;
  const files = new Map();
  return {
    importMidi(parsed, name) {
      midi = parsed;
      const id = `midi-${++serial}`;
      files.set(id, parsed);
      return {
        name,
        data: parsed.toJSON ? parsed.toJSON() : parsed,
        id,
        bpm: parsed.header?.tempos?.[0]?.bpm ?? 120,
        variableTempo: (parsed.header?.tempos?.length ?? 0) > 1,
        tracks: midi.tracks.map((t, index) => ({
          index,
          name: t.name || `轨道 ${index + 1}`,
          count: t.notes.length,
        })),
      };
    },
    compile(request) {
      if (!request || !['score', 'midi'].includes(request.mode)) throw Error('无效曲谱类型');
      let source;
      if (request.mode === 'midi') {
        const selected = request.midiId ? files.get(request.midiId) : midi;
        if (!selected || !Number.isInteger(request.track) || !selected.tracks[request.track])
          throw Error('请先导入 MIDI 并选择轨道');
        source = monophonic(selected.tracks[request.track].notes);
        const offset = source.notes[0]?.time || 0;
        if (offset > 0 && request.trimMidiStart !== false) {
          source = {
            ...source,
            notes: source.notes.map((n) => ({ ...n, time: n.time - offset })),
            duration: source.duration - offset,
            warnings: [
              ...source.warnings,
              `已跳过轨道开头 ${offset.toFixed(2)} 秒空白，曲中休止保持不变。`,
            ],
          };
        } else if (offset > 0) {
          source.warnings.push(`该轨道首音在 ${offset.toFixed(2)} 秒；可勾选“跳过开头空白”。`);
        }
      } else source = parseScore(request.text, request.settings);
      return compile(source, request.settings);
    },
  };
}
