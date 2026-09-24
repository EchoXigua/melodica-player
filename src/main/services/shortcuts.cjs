const { isStopShortcut } = require('../../shared/shortcuts.mjs');
function registerStopShortcuts(globalShortcut, stop) {
  const register = (key) => {
    try {
      return globalShortcut.register(key, stop);
    } catch {
      return false;
    }
  };
  return { f8: register('F8'), fallback: register('CommandOrControl+Shift+S') };
}
function bindLocalStop(webContents, stop) {
  webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && isStopShortcut(input)) {
      event.preventDefault();
      stop();
    }
  });
}
module.exports = { registerStopShortcuts, bindLocalStop };
