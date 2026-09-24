const { app, BrowserWindow, globalShortcut, session } = require('electron');
app.setName('Melodica Studio');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createScoreSession } = require('../shared/score-session.mjs');
const { createPlayback } = require('./services/playback.cjs');
const { registerStopShortcuts, bindLocalStop } = require('./services/shortcuts.cjs');
const { createInputTest } = require('./services/input-test.cjs');
const { registerIpc } = require('./ipc/register.cjs');
let win,
  diagnostics,
  shortcuts = { f8: false, fallback: false },
  quitting = false;
const page = pathToFileURL(path.join(__dirname, '../../build/renderer/index.html')).href;
const scoreSession = createScoreSession();
const playback = createPlayback({
  getPlan: scoreSession.compile,
  emit(state) {
    if (!diagnostics?.onPlayback(state) && win && !win.isDestroyed())
      win.webContents.send('playback', state);
  },
  onIdle() {
    if (quitting) app.quit();
  },
});
async function emergencyStop({ seeking = false } = {}) {
  const state = { type: 'stop-requested', seeking };
  if (win && !win.isDestroyed()) win.webContents.send('playback', state);
  diagnostics?.onPlayback(state);
  return playback.stop();
}
function shortcutStop() {
  void emergencyStop().catch((error) => {
    if (win && !win.isDestroyed())
      win.webContents.send('playback', { type: 'stop-error', message: error.message });
  });
}
diagnostics = createInputTest({ page, playback, emergencyStop: shortcutStop });
registerIpc({
  getWindow: () => win,
  page,
  playback,
  scoreSession,
  diagnostics,
  emergencyStop,
  getShortcuts: () => shortcuts,
});
app.whenReady().then(() => {
  if (process.platform === 'darwin')
    app.dock.setIcon(path.join(__dirname, '../../assets/icons/icon.png'));
  session.defaultSession.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  win = new BrowserWindow({
    width: 1380,
    height: 960,
    minWidth: 980,
    minHeight: 720,
    backgroundColor: '#0b0b10',
    title: 'Melodica Studio',
    icon: path.join(__dirname, '../../assets/icons/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('render-process-gone', shortcutStop);
  win.on('close', (event) => {
    if (playback.busy) {
      event.preventDefault();
      quitting = true;
      shortcutStop();
    }
  });
  bindLocalStop(win.webContents, shortcutStop);
  shortcuts = registerStopShortcuts(globalShortcut, shortcutStop);
  win.loadURL(page);
});
app.on('before-quit', (event) => {
  if (playback.busy) {
    event.preventDefault();
    quitting = true;
    shortcutStop();
  }
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
