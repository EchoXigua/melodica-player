import { writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '@tonejs/midi';
import { BUNDLED_MELODIES } from './bundled-melodies.mjs';

const { Midi } = pkg;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'assets');
const publicDir = join(root, 'src/renderer/public');

mkdirSync(assetsDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });

for (const song of BUNDLED_MELODIES) {
  const beat = 60 / song.bpm;
  const midi = new Midi();
  midi.header.setTempo(song.bpm);
  const track = midi.addTrack();
  track.name = `${song.title} · 主旋律`;
  let time = 0;
  for (const [pitch, beats] of song.melody) {
    const duration = beats * beat;
    track.addNote({ midi: pitch, time, duration: duration * 0.92 });
    time += duration;
  }
  const out = join(assetsDir, song.file);
  writeFileSync(out, Buffer.from(midi.toArray()));
  cpSync(out, join(publicDir, song.file));
  console.log(`${song.title}: ${song.melody.length} notes, ${time.toFixed(1)}s → ${song.file}`);
}

console.log(`Done. ${BUNDLED_MELODIES.length} files in assets/ and src/renderer/public/`);
