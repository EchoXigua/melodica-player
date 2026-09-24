const { app, systemPreferences, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
function binary() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'native/macos/melodica-input')
    : path.join(__dirname, '../../../native/macos/melodica-input');
}
function inputStatus() {
  return {
    supported: true,
    granted: systemPreferences.isTrustedAccessibilityClient(false),
    ready: fs.existsSync(binary()),
  };
}
async function requestPermission() {
  systemPreferences.isTrustedAccessibilityClient(true);
  await shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  );
  return inputStatus();
}
function native(mode, args = []) {
  if (!fs.existsSync(binary())) throw Error('macOS 输入引擎未构建，请运行 pnpm native:mac 后重启');
  if (mode === 'play' && !inputStatus().granted)
    throw Error(
      '请先授权辅助功能：系统设置 → 隐私与安全性 → 辅助功能，允许 Melodica Studio（开发模式可能显示 Electron 或启动终端）后重启',
    );
  return spawn(binary(), ['-Mode', mode, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
}
function listTargets() {
  return new Promise((resolve, reject) => {
    const child = native('list', ['-Owner', String(process.pid)]);
    let out = '',
      err = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(Error('枚举应用超时'));
    }, 10000);
    child.stdout.on('data', (b) => {
      out += b;
    });
    child.stderr.on('data', (b) => {
      err += b;
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code) return reject(Error(err || '枚举应用失败'));
      resolve(
        out
          .trim()
          .split(/\r?\n/)
          .filter((line) => /^mac:\d+\t/.test(line))
          .map((line) => {
            const [id, title] = line.split('\t');
            return { id, title: Buffer.from(title, 'base64').toString('utf8') };
          }),
      );
    });
  });
}
module.exports = { native, listTargets, inputStatus, requestPermission };
