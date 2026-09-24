const windows = require('./windows.cjs');
const macos = require('./macos.cjs');
const supported = ['darwin', 'win32'].includes(process.platform);
const adapter = process.platform === 'darwin' ? macos : windows;
module.exports = {
  native: (...args) => {
    if (!supported) throw Error('键鼠演奏需要 macOS 或 Windows 桌面端');
    return adapter.native(...args);
  },
  listTargets: () => (supported ? adapter.listTargets() : []),
  inputStatus: () =>
    process.platform === 'darwin'
      ? macos.inputStatus()
      : { supported, granted: supported, ready: supported },
  requestPermission: () =>
    process.platform === 'darwin'
      ? macos.requestPermission()
      : { supported, granted: supported, ready: supported },
};
