const { BrowserWindow } = require('electron');
const path = require('node:path');
const {
  INPUT_TEST_REQUEST,
  inputTestPlan,
  compareInputEvents,
} = require('../../shared/input-test.mjs');
const { bindLocalStop } = require('./shortcuts.cjs');
function createInputTest({ page, playback, emergencyStop }) {
  let win,
    running = false,
    cancelRequested = false,
    collecting = false,
    closeRequested = false,
    received = [],
    finishTimer;
  const url = `${page}?view=input-test`;
  const send = (channel, value) => {
    if (win && !win.isDestroyed()) win.webContents.send(channel, value);
  };
  function accepts(event) {
    return (
      !!win &&
      !win.isDestroyed() &&
      event.sender === win.webContents &&
      event.senderFrame?.url === url
    );
  }
  function open() {
    if (playback.busy) throw Error('请先停止当前演奏');
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
      return;
    }
    win = new BrowserWindow({
      icon: require('node:path').join(__dirname, '../../../assets/icons/icon.png'),
      width: 960,
      height: 780,
      minWidth: 720,
      minHeight: 600,
      title: 'Melodica Studio · 键鼠接收测试',
      backgroundColor: '#0b0b10',
      webPreferences: {
        preload: path.join(__dirname, '../../preload/index.cjs'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    win.webContents.on('render-process-gone', () => {
      if (running) emergencyStop();
    });
    bindLocalStop(win.webContents, emergencyStop);
    win.on('close', (event) => {
      if (running) {
        event.preventDefault();
        closeRequested = true;
        emergencyStop();
      }
    });
    win.on('blur', () => {
      if (running) emergencyStop();
    });
    win.on('closed', () => {
      win = null;
      closeRequested = false;
    });
    void win.loadURL(url);
  }
  async function start() {
    if (!['win32', 'darwin'].includes(process.platform))
      throw Error('真实键鼠测试需要 macOS 或 Windows 桌面端');
    if (running || playback.busy) throw Error('请先停止当前任务');
    if (!win?.isFocused()) throw Error('请在测试窗口中启动');
    const handle = win.getNativeWindowHandle();
    const hwnd = handle.length === 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE());
    received = [];
    collecting = false;
    running = true;
    cancelRequested = false;
    send('input-test', { type: 'begin', expected: inputTestPlan().events.length });
    try {
      let testPoint;
      if (process.platform === 'darwin') {
        const rect = await win.webContents.executeJavaScript(
          '(()=>{const r=document.getElementById("input-pad").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()',
        );
        if (!win.isFocused()) throw Error('请保持接收测试窗口在前台');
        const bounds = win.getContentBounds();
        testPoint = [bounds.x + rect.x, bounds.y + rect.y];
      }
      if (cancelRequested) throw Error('测试已取消');
      return await playback.play({
        testPoint,
        ...INPUT_TEST_REQUEST,
        target: process.platform === 'darwin' ? `mac:${process.pid}` : `${hwnd}:${process.pid}`,
      });
    } catch (error) {
      running = false;
      send('input-test', { type: 'failure', message: error.message });
      throw error;
    }
  }
  function report(event) {
    if (!running || !collecting || received.length >= 512) return;
    const allowed =
      event?.device === 'key'
        ? ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',']
        : event?.device === 'mouse'
          ? ['left', 'right', 'middle']
          : [];
    if (!allowed.includes(event.code) || typeof event.down !== 'boolean') return;
    received.push({
      device: event.device,
      code: event.code,
      down: event.down,
      trusted: event.trusted === true,
    });
  }
  function onPlayback(state) {
    if (!running) return false;
    if (state.type === 'stop-requested') cancelRequested = true;
    if (state.type === 'playing') collecting = true;
    send('playback', state);
    if (['done', 'stopped', 'error'].includes(state.type)) {
      clearTimeout(finishTimer);
      // Allow the receiver IPC queue to drain after native key-up events.
      finishTimer = setTimeout(() => {
        collecting = false;
        send('input-test', {
          type: 'result',
          terminal: state.type,
          message: state.message,
          ...compareInputEvents(inputTestPlan().events, received),
        });
        running = false;
        if (closeRequested && win && !win.isDestroyed()) win.close();
      }, 180);
    }
    return true;
  }
  return {
    open,
    start,
    report,
    accepts,
    onPlayback,
    get running() {
      return running;
    },
  };
}
module.exports = { createInputTest };
