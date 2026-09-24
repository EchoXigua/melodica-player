const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createLibraryStore } = require('../../src/main/services/library.cjs');
test('library writes are ordered and recover through a new store instance', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'melodica-library-'));
  try {
    const file = path.join(dir, 'library.json'),
      store = createLibraryStore(file);
    assert.equal(await store.read(), null);
    await Promise.all([
      store.write({ version: 1, items: [{ id: 'a', title: '旧名字' }] }),
      store.write({
        version: 1,
        items: [
          { id: 'b', title: '新名字', midi: { data: { tracks: [] } } },
          { id: 'a', title: '另一首' },
        ],
      }),
    ]);
    const value = await createLibraryStore(file).read();
    assert.deepEqual(
      value.items.map((i) => i.id),
      ['b', 'a'],
    );
    assert.equal(value.items[0].title, '新名字');
    assert.deepEqual(value.items[0].midi.data.tracks, []);
    await fs.writeFile(file, 'invalid');
    await assert.rejects(createLibraryStore(file).read());
    assert.equal(await fs.readFile(file, 'utf8'), 'invalid');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
