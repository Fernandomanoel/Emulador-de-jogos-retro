// Gera dist\RetroEmulator-Setup-<versão>.exe a partir do app já gerado por "npm run build".
// Usa o IExpress, que vem no Windows: o Setup é um pacote que se extrai e roda installer\install.cmd.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { path7za } = require('7zip-bin');

const root = path.resolve(__dirname, '..');
const { version } = require(path.join(root, 'package.json'));
const app = path.join(root, 'dist', 'RetroEmulator-win32-x64');
const target = path.join(root, 'dist', `RetroEmulator-Setup-${version}.exe`);

if (!fs.existsSync(path.join(app, 'RetroEmulator.exe'))) {
  console.error('App não encontrado. Rode "npm run build" antes.');
  process.exit(1);
}

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'retroemulator-setup-'));
try {
  console.log('Compactando o app...');
  execFileSync(path7za, ['a', '-t7z', '-mx=7', path.join(stage, 'app.7z'), '.'], { cwd: app, stdio: 'ignore' });
  fs.copyFileSync(path7za, path.join(stage, '7za.exe'));
  fs.copyFileSync(path.join(root, 'installer', 'uninstall.cmd'), path.join(stage, 'uninstall.cmd'));
  const install = fs.readFileSync(path.join(root, 'installer', 'install.cmd'), 'utf8').replace('@VERSION@', version);
  fs.writeFileSync(path.join(stage, 'install.cmd'), install);

  const files = ['app.7z', '7za.exe', 'install.cmd', 'uninstall.cmd'];
  const sed = [
    '[Version]',
    'Class=IEXPRESS',
    'SEDVersion=3',
    '[Options]',
    'PackagePurpose=InstallApp',
    'ShowInstallProgramWindow=0',
    'HideExtractAnimation=0',
    'UseLongFileName=1',
    'InsideCompressed=0',
    'CAB_FixedSize=0',
    'CAB_ResvCodeSigning=0',
    'RebootMode=N',
    'InstallPrompt=',
    'DisplayLicense=',
    'FinishMessage=',
    `TargetName=${target}`,
    'FriendlyName=RetroEmulator',
    // ".\" porque o cmd deixa de procurar na pasta atual quando NoDefaultCurrentDirectoryInExePath está definido
    'AppLaunched=cmd /c .\\install.cmd',
    'PostInstallCmd=<None>',
    // usados quando o Setup roda com /Q (instalação silenciosa)
    'AdminQuietInstCmd=cmd /c .\\install.cmd',
    'UserQuietInstCmd=cmd /c .\\install.cmd',
    'SourceFiles=SourceFiles',
    '[SourceFiles]',
    `SourceFiles0=${stage}\\`,
    '[SourceFiles0]',
    ...files.map((file) => `${file}=`),
  ].join('\r\n');
  const sedFile = path.join(stage, 'setup.sed');
  fs.writeFileSync(sedFile, sed + '\r\n', 'latin1');

  console.log('Gerando o instalador...');
  fs.rmSync(target, { force: true });
  execFileSync('iexpress.exe', ['/N', '/Q', sedFile], { stdio: 'ignore' });
  if (!fs.existsSync(target)) throw new Error('o IExpress não gerou o instalador');
  console.log('Instalador gerado em', target, `(${Math.round(fs.statSync(target).size / 1048576)} MB)`);
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
