const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const consoles = require('./consoles');
const keyboard = require('./keyboard');

let cache = null;

function defaults() {
  const romDirs = {};
  for (const c of consoles) {
    const own = paths.romsDir(c.id);
    fs.mkdirSync(own, { recursive: true });
    romDirs[c.id] = [own];
  }
  // Se a pasta de jogos de SNES que já existe ao lado do projeto estiver lá, usa ela.
  const root = paths.projectRoot();
  if (root) {
    const existing = path.resolve(root, '..', 'jogo', 'jogos');
    if (fs.existsSync(existing)) romDirs.snes.unshift(existing);
  }
  return {
    theme: 'system', // system | dark | light
    fullscreen: true,
    autoInstall: true,
    fastForward: false,
    keyboards: Object.fromEntries(consoles.map((c) => [c.id, { ...keyboard.presetFor(c) }])),
    hotkeys: { ...keyboard.HOTKEYS },
    romDirs,
    favorites: [],
    recent: [],
  };
}

function load() {
  if (cache) return cache;
  const base = defaults();
  try {
    const saved = JSON.parse(fs.readFileSync(paths.settingsFile(), 'utf8'));
    cache = {
      ...base,
      ...saved,
      romDirs: { ...base.romDirs, ...saved.romDirs },
      keyboards: Object.fromEntries(
        consoles.map((c) => [c.id, keyboard.sanitizeProfile(c, saved.keyboards && saved.keyboards[c.id])])
      ),
      hotkeys: keyboard.sanitizeHotkeys(saved.hotkeys),
    };
    // formato antigo: um teclado só para todos os consoles
    delete cache.keyboard;
  } catch {
    cache = base;
    save();
  }
  return cache;
}

function save() {
  fs.writeFileSync(paths.settingsFile(), JSON.stringify(cache, null, 2));
}

function update(patch) {
  cache = { ...load(), ...patch };
  save();
  return cache;
}

module.exports = { load, update };
