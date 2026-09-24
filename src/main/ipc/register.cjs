const { app, ipcMain, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Midi } = require('@tonejs/midi');
const { midiBytes } = require('../../shared/midi-file.mjs');
const { createLibraryStore } = require('../services/library.cjs');
const { listTargets, inputStatus, requestPermission } = require('../adapters/input.cjs');
function registerIpc({
  getWindow,
  page,
  playback,
  scoreSession,
  diagnostics,
  emergencyStop,
  getShortcuts,
}) {
  const library = createLibraryStore(path.join(app.getPath('userData'), 'library.json'));
  function handle(name, fn, allowTest = false) {
    ipcMain.handle(name, async (event, ...args) => {
      if (
        !(event.sender === getWindow()?.webContents && event.senderFrame?.url === page) &&
        !(allowTest && diagnostics.accepts(event))
      )
        throw Error('无效请求来源');
      try {
        return { ok: true, value: await fn(...args) };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });
  }
  handle(
    'info',
    () => ({
      platform: process.platform,
      version: app.getVersion(),
      shortcuts: getShortcuts(),
      input: inputStatus(),
    }),
    true,
  );
  handle('input-test:open', diagnostics.open);
  ipcMain.handle('input-test:start', async (event) => {
    if (!diagnostics.accepts(event)) throw Error('请从接收测试窗口启动');
    try {
      return { ok: true, value: await diagnostics.start() };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.on('input-test:report', (event, data) => {
    if (diagnostics.accepts(event)) diagnostics.report(data);
  });
  handle('library:read', library.read);
  handle('library:write', library.write);
  handle('midi:restore', (value) => {
    const parsed = new Midi();
    parsed.fromJSON(value.data);
    return scoreSession.importMidi(parsed, value.name);
  });
  handle('compile', scoreSession.compile);
  handle('bundled-midi', async (name) => {
    if (playback.busy) throw Error('请先停止演奏');
    const file = path.join(app.getAppPath(), 'assets', name);
    if ((await fs.stat(file)).size > 10 * 1024 * 1024) throw Error('MIDI 文件不能超过 10 MB');
    const parsed = new Midi(midiBytes(await fs.readFile(file)));
    return scoreSession.importMidi(parsed, path.basename(file));
  });
  handle('midi', async () => {
    if (playback.busy) throw Error('请先停止演奏');
    const result = await dialog.showOpenDialog(getWindow(), {
      properties: ['openFile'],
      filters: [{ name: 'MIDI', extensions: ['mid', 'midi'] }],
    });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    if ((await fs.stat(file)).size > 10 * 1024 * 1024) throw Error('MIDI 文件不能超过 10 MB');
    const parsed = new Midi(midiBytes(await fs.readFile(file)));
    return scoreSession.importMidi(parsed, path.basename(file));
  });
  handle('targets', listTargets);
  handle('input:permission', requestPermission, true);
  handle('stop', (options) => emergencyStop({ seeking: options?.seeking === true }), true);
  handle('play', (request) => {
    if (diagnostics.running) throw Error('请先结束键鼠测试');
    const { testPoint: _ignored, ...normalRequest } = request;
    return playback.play(normalRequest);
  });
}
module.exports = { registerIpc };
