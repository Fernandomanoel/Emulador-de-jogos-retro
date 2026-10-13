const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Raiz do projeto (pasta RetroEmulator), quando dá para identificar.
function projectRoot() {
  if (!app.isPackaged) return app.getAppPath();
  // Empacotado dentro do projeto: RetroEmulator\dist\RetroEmulator-win32-x64\RetroEmulator.exe
  const up = path.resolve(path.dirname(process.execPath), '..', '..');
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(up, 'package.json'), 'utf8'));
    if (pkg.name === 'retro-emulator') return up;
  } catch {}
  return null;
}

// Tudo que o app baixa ou grava (RetroArch, cores, saves, configurações) fica aqui.
function dataDir() {
  const root = projectRoot();
  const dir = root ? path.join(root, 'data') : path.join(path.dirname(process.execPath), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const data = (...parts) => path.join(dataDir(), ...parts);

module.exports = {
  projectRoot,
  dataDir,
  settingsFile: () => data('settings.json'),
  downloadsDir: () => data('downloads'),
  retroarchDir: () => data('retroarch'),
  retroarchExe: () => data('retroarch', 'retroarch.exe'),
  coresDir: () => data('retroarch', 'cores'),
  systemDir: (...parts) => data('retroarch', 'system', ...parts),
  coreFile: (core) => data('retroarch', 'cores', `${core}_libretro.dll`),
  statesDir: () => data('states'),
  romsDir: (consoleId) => data('roms', consoleId),
  launchConfig: () => data('retroemulator.cfg'),
};
