const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
if (process.platform !== 'darwin') process.exit(0);
const dir = path.resolve(__dirname, '../native/macos');
const output = path.join(dir, 'melodica-input');
const source = path.join(dir, 'InputEngine.swift');
if (fs.existsSync(output) && fs.statSync(output).mtimeMs >= fs.statSync(source).mtimeMs)
  process.exit(0);
const temp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'melodica-compile-'));
try {
  const binaries = ['arm64', 'x86_64'].map((arch) => {
    const file = path.join(temp, arch);
    execFileSync(
      'xcrun',
      [
        'swiftc',
        '-swift-version',
        '5',
        '-O',
        '-target',
        `${arch}-apple-macosx11.0`,
        source,
        '-o',
        file,
      ],
      { stdio: 'inherit' },
    );
    return file;
  });
  execFileSync('lipo', ['-create', ...binaries, '-output', output], { stdio: 'inherit' });
  fs.chmodSync(output, 0o755);
  execFileSync('codesign', ['--force', '--sign', '-', output], { stdio: 'inherit' });
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
