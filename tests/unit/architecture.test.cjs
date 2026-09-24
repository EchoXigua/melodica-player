const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
test('shared code stays platform independent and renderer cannot import privileged code', () => {
  for (const area of ['shared', 'renderer'])
    for (const file of files(path.join(root, 'src', area)).filter((f) =>
      /\.(mjs|cjs|js|jsx)$/.test(f),
    )) {
      const source = fs.readFileSync(file, 'utf8');
      const imports = [
        ...source.matchAll(/(?:from\s*|require\s*\(\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g),
      ].map((m) => m[1]);
      for (const ref of imports) {
        assert.ok(
          !/^(node:|electron$|fs$|path$|child_process$)/.test(ref),
          `${file}: forbidden platform dependency ${ref}`,
        );
        if (area === 'shared')
          assert.ok(!/^(react|motion)/.test(ref), `${file}: UI dependency ${ref}`);
        if (ref.startsWith('.')) {
          const target = path.resolve(path.dirname(file), ref);
          assert.ok(
            !['src/main', 'src/preload', 'native'].some((d) =>
              target.startsWith(path.join(root, d) + path.sep),
            ),
            `${file}: privileged import ${ref}`,
          );
          if (area === 'shared')
            assert.ok(
              target.startsWith(path.join(root, 'src/shared') + path.sep),
              `${file}: shared code imports outside its layer`,
            );
        }
      }
    }
});
