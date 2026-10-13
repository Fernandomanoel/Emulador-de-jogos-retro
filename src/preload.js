const { contextBridge, ipcRenderer } = require('electron');

const call = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);
const listen = (channel) => (fn) => ipcRenderer.on(channel, (_e, payload) => fn(payload));

contextBridge.exposeInMainWorld('retro', {
  getState: call('state:get'),
  updateSettings: call('settings:update'),
  toggleFavorite: call('favorite:toggle'),
  addRomDir: call('romdir:add'),
  removeRomDir: call('romdir:remove'),
  installConsole: call('install:console'),
  installNeeded: call('install:needed'),
  launch: call('game:launch'),
  scanControllers: call('controllers:scan'),
  openPath: call('shell:path'),
  openLink: call('shell:link'),
  onInstallProgress: listen('install:progress'),
  onGameState: listen('game:state'),
});
