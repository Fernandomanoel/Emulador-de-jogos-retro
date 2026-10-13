// Gera dist\RetroEmulator-win32-x64\RetroEmulator.exe copiando o runtime do Electron
// e colocando o app em resources\app (sem asar: o 7za.exe precisa ser um arquivo de verdade).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const runtime = path.join(root, 'node_modules', 'electron', 'dist');
const out = path.join(root, 'dist', 'RetroEmulator-win32-x64');
const appDir = path.join(out, 'resources', 'app');

if (!fs.existsSync(path.join(runtime, 'electron.exe'))) {
  console.error('Runtime do Electron não encontrado. Rode "npm install" antes.');
  process.exit(1);
}

// Com o app aberto o Windows trava o .exe e a limpeza pararia no meio, deixando a pasta pela metade.
const exe = path.join(out, 'RetroEmulator.exe');
if (fs.existsSync(exe)) {
  try {
    fs.closeSync(fs.openSync(exe, 'r+'));
  } catch {
    console.error('O RetroEmulator está aberto. Feche o app e rode o build de novo.');
    process.exit(1);
  }
}

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(runtime, out, { recursive: true });
fs.renameSync(path.join(out, 'electron.exe'), path.join(out, 'RetroEmulator.exe'));
fs.rmSync(path.join(out, 'resources', 'default_app.asar'), { force: true });

fs.mkdirSync(appDir, { recursive: true });
fs.copyFileSync(path.join(root, 'package.json'), path.join(appDir, 'package.json'));
fs.cpSync(path.join(root, 'src'), path.join(appDir, 'src'), { recursive: true });

// Do 7zip-bin só interessa o binário de Windows x64
const zipSrc = path.join(root, 'node_modules', '7zip-bin');
const zipDst = path.join(appDir, 'node_modules', '7zip-bin');
fs.mkdirSync(path.join(zipDst, 'win', 'x64'), { recursive: true });
for (const file of ['package.json', 'index.js', 'LICENSE.txt', path.join('win', 'x64', '7za.exe')]) {
  if (fs.existsSync(path.join(zipSrc, file))) fs.copyFileSync(path.join(zipSrc, file), path.join(zipDst, file));
}

console.log('App gerado em', path.join(out, 'RetroEmulator.exe'));
