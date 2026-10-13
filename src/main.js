const { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, shell } = require('electron');
const path = require('path');
const paths = require('./paths');
const consoles = require('./consoles');
const settings = require('./settings');
const library = require('./library');
const installer = require('./installer');
const launcher = require('./launcher');
const controllers = require('./controllers');
const keyboard = require('./keyboard');

// Links que a interface pode abrir no navegador.
const LINKS = {
  dshidmini: 'https://github.com/nefarius/DsHidMini/releases/latest',
  dshidminiGuide: 'https://docs.nefarius.at/projects/DsHidMini/How-to-Install/',
  dotnet: 'https://dotnet.microsoft.com/download/dotnet/10.0',
  retroarch: 'https://www.retroarch.com/',
};

let win = null;
let games = [];

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function getState({ rescan = true } = {}) {
  if (rescan) games = library.scanAll();
  return {
    settings: settings.load(),
    consoles,
    games,
    install: installer.status(),
    running: launcher.current(),
    dataDir: paths.dataDir(),
    keyCodes: Object.keys(keyboard.CODES),
    keyPresets: keyboard.PRESETS,
  };
}

function createWindow() {
  const s = settings.load();
  nativeTheme.themeSource = s.theme;
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#101116' : '#f4f3f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.on('closed', () => (win = null));
}

function registerIpc() {
  ipcMain.handle('state:get', () => getState());

  ipcMain.handle('settings:update', (_e, patch) => {
    const allowed = {};
    if (['system', 'dark', 'light'].includes(patch.theme)) allowed.theme = patch.theme;
    if (typeof patch.fullscreen === 'boolean') allowed.fullscreen = patch.fullscreen;
    if (typeof patch.autoInstall === 'boolean') allowed.autoInstall = patch.autoInstall;
    if (typeof patch.fastForward === 'boolean') allowed.fastForward = patch.fastForward;
    if (patch.keyboards && typeof patch.keyboards === 'object') {
      allowed.keyboards = Object.fromEntries(
        consoles.map((c) => [c.id, keyboard.sanitizeProfile(c, patch.keyboards[c.id])])
      );
    }
    if (patch.hotkeys && typeof patch.hotkeys === 'object') allowed.hotkeys = keyboard.sanitizeHotkeys(patch.hotkeys);
    const s = settings.update(allowed);
    nativeTheme.themeSource = s.theme;
    return s;
  });

  ipcMain.handle('favorite:toggle', (_e, gamePath) => {
    const { favorites } = settings.load();
    const next = favorites.includes(gamePath)
      ? favorites.filter((p) => p !== gamePath)
      : [...favorites, gamePath];
    return settings.update({ favorites: next }).favorites;
  });

  ipcMain.handle('romdir:add', async (_e, consoleId) => {
    const c = consoles.find((x) => x.id === consoleId);
    if (!c) return getState({ rescan: false });
    const res = await dialog.showOpenDialog(win, {
      title: `Pasta de jogos de ${c.name}`,
      properties: ['openDirectory'],
    });
    if (!res.canceled && res.filePaths[0]) {
      const { romDirs } = settings.load();
      const list = romDirs[consoleId] || [];
      if (!list.includes(res.filePaths[0])) {
        settings.update({ romDirs: { ...romDirs, [consoleId]: [...list, res.filePaths[0]] } });
      }
    }
    return getState();
  });

  ipcMain.handle('romdir:remove', (_e, consoleId, dir) => {
    const { romDirs } = settings.load();
    const list = (romDirs[consoleId] || []).filter((d) => d !== dir);
    settings.update({ romDirs: { ...romDirs, [consoleId]: list } });
    return getState();
  });

  ipcMain.handle('install:console', async (_e, consoleId) => {
    await installer.installConsole(consoleId);
    return installer.status();
  });

  // Instala o RetroArch e os emuladores dos consoles que já têm jogos.
  ipcMain.handle('install:needed', async () => {
    const ids = [...new Set(games.map((g) => g.console))];
    for (const id of ids) await installer.installConsole(id);
    return installer.status();
  });

  ipcMain.handle('game:launch', async (_e, gamePath) => {
    const game = games.find((g) => g.path === gamePath);
    if (!game) throw new Error('Jogo não encontrado na biblioteca');
    await launcher.launch(game);
    return settings.load().recent;
  });

  ipcMain.handle('controllers:scan', () => controllers.scan());

  ipcMain.handle('shell:path', (_e, target) => {
    const { romDirs } = settings.load();
    const known = [paths.dataDir(), ...Object.values(romDirs).flat()];
    if (known.includes(target)) return shell.openPath(target);
  });

  ipcMain.handle('shell:link', (_e, key) => {
    if (LINKS[key]) return shell.openExternal(LINKS[key]);
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    installer.onProgress((p) => send('install:progress', p));
    launcher.onState((state) => {
      send('game:state', state);
      if (!state.running && win) {
        if (win.isMinimized()) win.restore();
        win.focus();
      }
    });
    registerIpc();
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
