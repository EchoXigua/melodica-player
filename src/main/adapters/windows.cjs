const { app } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
function native(mode, args = []) {
  const dir = app.isPackaged
    ? path.join(process.resourcesPath, 'native')
    : path.join(__dirname, '../../../native/windows');
  return spawn(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(dir, 'runner.ps1'),
      '-Mode',
      mode,
      ...args,
    ],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
}
function listTargets() {
  if (process.platform !== 'win32') return [];
  return new Promise((resolve, reject) => {
    const child = native('list');
    let out = '',
      err = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(Error('枚举窗口超时'));
    }, 15000);
    child.stdout.on('data', (b) => (out += b));
    child.stderr.on('data', (b) => (err += b));
    child.on('error', (e) => {
      clearTimeout(timeout);
      reject(e);
    });
    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (code || out.includes('ERROR ')) return reject(Error(err || out));
      resolve(
        out
          .trim()
          .split(/\r?\n/)
          .filter((l) => /^\d+:\d+\t/.test(l))
          .map((l) => {
            const [id, title] = l.split('\t');
            return { id, title: Buffer.from(title, 'base64').toString('utf8') };
          })
          .filter((t) => !t.title.includes('Melodica Studio')),
      );
    });
  });
}
module.exports = { native, listTargets };
