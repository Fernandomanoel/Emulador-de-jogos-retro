const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const consoles = require('./consoles');
const settings = require('./settings');
const installer = require('./installer');
const keyboard = require('./keyboard');

const MAX_RECENT = 24;
let running = null;
let notify = () => {};

function onState(fn) {
  notify = fn;
}

// Troca o ponteiro do mouse do menu do RetroArch pela seta do app.
function installPointer() {
  const ours = path.join(__dirname, 'assets', 'pointer.png');
  const theirs = path.join(paths.retroarchDir(), 'assets', 'ozone', 'png', 'icons', 'pointer.png');
  try {
    if (!fs.readFileSync(ours).equals(fs.readFileSync(theirs))) fs.copyFileSync(ours, theirs);
  } catch {}
}

// Grava os ajustes de desempenho do console no .opt do core, preservando as outras opções.
function applyCoreOptions(c) {
  if (!c.coreOptions) return;
  const file = path.join(paths.retroarchDir(), 'config', c.coreOptions.dir, `${c.coreOptions.dir}.opt`);
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {}
  for (const [key, value] of Object.entries(c.coreOptions.values)) {
    const line = `${key} = "${value}"`;
    const existing = new RegExp(`^${key} = .*$`, 'm');
    if (existing.test(text)) text = text.replace(existing, line);
    else text = `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

// Configuração aplicada por cima do retroarch.cfg a cada partida.
function writeLaunchConfig(c) {
  const s = settings.load();
  fs.mkdirSync(paths.statesDir(), { recursive: true });
  const cfg = {
    video_fullscreen: s.fullscreen,
    video_windowed_fullscreen: true,
    video_vsync: true,
    // Saves (.srm) ficam ao lado da ROM, então os saves antigos do ZSNES continuam valendo
    savefiles_in_content_dir: true,
    sort_savefiles_enable: false,
    sort_savefiles_by_content_enable: false,
    savestates_in_content_dir: false,
    savestate_directory: paths.statesDir(),
    // Controle: o RetroArch reconhece o DualShock 3 sozinho pelos perfis de autoconfig
    input_autodetect_enable: true,
    notification_show_autoconfig: true,
    // L3 + R3 abre o menu do RetroArch (salvar estado, sair, etc.)
    input_menu_toggle_gamepad_combo: 2,
    menu_swap_ok_cancel_buttons: true,
    // O menu do emulador aceita clique do mouse
    menu_mouse_enable: true,
    menu_pointer_enable: true,
    user_language: 7, // Português (Brasil)
    pause_nonactive: true,
    config_save_on_exit: true,
    ...keyboard.toRetroArch(c, s.keyboards[c.id], s.hotkeys, { fastForward: s.fastForward }),
  };
  const text = Object.entries(cfg)
    .map(([k, v]) => `${k} = "${v}"`)
    .join('\r\n');
  fs.writeFileSync(paths.launchConfig(), text + '\r\n');
}

async function launch(game) {
  if (running) throw new Error('Já existe um jogo aberto');
  const c = consoles.find((x) => x.id === game.console);
  if (!c) throw new Error('Console desconhecido');
  if (!fs.existsSync(game.path)) throw new Error('Arquivo do jogo não encontrado');

  await installer.installConsole(c.id);
  if (running) throw new Error('Já existe um jogo aberto');
  writeLaunchConfig(c);
  installPointer();
  applyCoreOptions(c);

  const args = ['-L', paths.coreFile(c.core), game.path, '--appendconfig', paths.launchConfig()];
  const child = spawn(paths.retroarchExe(), args, { cwd: paths.retroarchDir(), stdio: 'ignore' });
  running = { path: game.path, title: game.title };
  notify({ running });

  const finish = (error) => {
    if (!running) return;
    running = null;
    notify({ running: null, error });
  };
  child.on('error', (e) => finish(e.message));
  child.on('exit', () => finish());

  const s = settings.load();
  const recent = [game.path, ...s.recent.filter((p) => p !== game.path)].slice(0, MAX_RECENT);
  settings.update({ recent });
}

module.exports = { launch, onState, current: () => running };
