const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('melodica', {
  openInputTest: () => ipcRenderer.invoke('input-test:open'),
  startInputTest: () => ipcRenderer.invoke('input-test:start'),
  reportInput: (value) => ipcRenderer.send('input-test:report', value),
  onInputTest: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('input-test', listener);
    return () => ipcRenderer.removeListener('input-test', listener);
  },
  requestInputPermission: () => ipcRenderer.invoke('input:permission'),
  info: () => ipcRenderer.invoke('info'),
  compile: (r) => ipcRenderer.invoke('compile', r),
  readLibrary: () => ipcRenderer.invoke('library:read'),
  saveLibrary: (value) => ipcRenderer.invoke('library:write', value),
  restoreMidi: (value) => ipcRenderer.invoke('midi:restore', value),
  importMidi: () => ipcRenderer.invoke('midi'),
  loadBundledMidi: (name) => ipcRenderer.invoke('bundled-midi', name),
  targets: () => ipcRenderer.invoke('targets'),
  play: (r) => ipcRenderer.invoke('play', r),
  stop: (options) => ipcRenderer.invoke('stop', options),
  onPlayback: (callback) => {
    const listener = (_e, data) => callback(data);
    ipcRenderer.on('playback', listener);
    return () => ipcRenderer.removeListener('playback', listener);
  },
});
