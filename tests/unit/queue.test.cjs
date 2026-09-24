const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nextSongId } = require('../../src/shared/queue.mjs');
test('playback order advances, wraps, repeats and shuffles without repeating current song', () => {
  const songs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(nextSongId(songs, 'a', 'sequential'), 'b');
  assert.equal(nextSongId(songs, 'c', 'sequential'), null);
  assert.equal(nextSongId(songs, 'c', 'list'), 'a');
  assert.equal(nextSongId(songs, 'b', 'single'), 'b');
  assert.equal(
    nextSongId(songs, 'b', 'shuffle', () => 0),
    'a',
  );
  assert.equal(
    nextSongId(songs, 'b', 'shuffle', () => 0.99),
    'c',
  );
  assert.equal(nextSongId([songs[0]], 'a', 'shuffle'), 'a');
  assert.equal(nextSongId([], 'a', 'list'), null);
  assert.equal(nextSongId(songs, 'missing', 'list'), null);
});
