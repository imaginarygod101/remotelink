const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('rl', {
  config: () => ipcRenderer.invoke('config'),
  saveServer: u => ipcRenderer.invoke('save-server', u),
  screenSource: () => ipcRenderer.invoke('screen-source'),
  state: s => ipcRenderer.send('session-state', s),
  input: ev => ipcRenderer.send('input', ev),
  log: m => ipcRenderer.send('log', m),
});
