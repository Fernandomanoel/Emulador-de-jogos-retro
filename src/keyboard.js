// Teclado por console. Os valores guardados são KeyboardEvent.code.
//
// Os nomes das ações seguem a posição no controle: b = botão de baixo, a = direita,
// y = esquerda, x = cima. Cada console dá o seu próprio rótulo a eles (ver consoles.js).

// Estilo atual de jogos de PC: WASD para andar, setas para o segundo analógico / botões C.
const MODERN = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  b: 'KeyK',
  a: 'KeyL',
  y: 'KeyJ',
  x: 'KeyI',
  l: 'KeyQ',
  r: 'KeyE',
  l2: 'ShiftLeft',
  r2: 'Space',
  start: 'Enter',
  select: 'Backspace',
  rs_up: 'ArrowUp',
  rs_down: 'ArrowDown',
  rs_left: 'ArrowLeft',
  rs_right: 'ArrowRight',
  p2_up: 'KeyT',
  p2_down: 'KeyG',
  p2_left: 'KeyF',
  p2_right: 'KeyH',
  p2_b: 'KeyV',
  p2_a: 'KeyB',
  p2_y: 'KeyC',
  p2_x: 'KeyX',
  p2_l: 'KeyR',
  p2_r: 'KeyY',
  p2_start: 'KeyP',
  p2_select: 'KeyO',
};

// O padrão do ePSXe, como nas lan houses: setas, Z/X/S/D, W/E/R/T, V e C.
const LANHOUSE = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  b: 'KeyZ',
  a: 'KeyX',
  y: 'KeyS',
  x: 'KeyD',
  l: 'KeyW',
  r: 'KeyR',
  l2: 'KeyE',
  r2: 'KeyT',
  start: 'KeyV',
  select: 'KeyC',
  rs_up: 'Home',
  rs_down: 'End',
  rs_left: 'Delete',
  rs_right: 'PageDown',
  p2_up: 'KeyI',
  p2_down: 'KeyK',
  p2_left: 'KeyJ',
  p2_right: 'KeyL',
  p2_b: 'KeyN',
  p2_a: 'KeyM',
  p2_y: 'KeyB',
  p2_x: 'KeyH',
  p2_l: 'KeyU',
  p2_r: 'KeyO',
  p2_start: 'KeyP',
  p2_select: 'KeyY',
};

const PRESETS = { modern: MODERN, lanhouse: LANHOUSE };

// Atalhos, iguais em todos os consoles. "fast" só vale com "Acelerar o jogo" ligado.
const HOTKEYS = { menu: 'F1', save: 'F2', load: 'F4', exit: 'Escape', fast: 'Tab' };

const HOTKEY_BINDS = {
  menu: 'input_menu_toggle',
  save: 'input_save_state',
  load: 'input_load_state',
  exit: 'input_exit_emulator',
  fast: 'input_toggle_fast_forward',
};

const DIRECTIONS = ['up', 'down', 'left', 'right'];
const BUTTONS = ['a', 'b', 'x', 'y', 'l', 'r', 'l2', 'r2', 'start', 'select'];
// Direção -> eixo do analógico no retroarch.cfg
const AXES = { up: 'y_minus', down: 'y_plus', left: 'x_minus', right: 'x_plus' };

// Atalhos de teclado que o RetroArch traz ligados de fábrica (pausa na P, avanço rápido no
// Espaço, etc.). Ficam desligados para não dispararem quando a tecla for usada como botão do jogo.
const DISABLED_HOTKEYS = [
  'input_hold_fast_forward',
  'input_toggle_slowmotion',
  'input_hold_slowmotion',
  'input_rewind',
  'input_pause_toggle',
  'input_frame_advance',
  'input_reset',
  'input_shader_next',
  'input_shader_prev',
  'input_cheat_index_plus',
  'input_cheat_index_minus',
  'input_cheat_toggle',
  'input_screenshot',
  'input_audio_mute',
  'input_osk_toggle',
  'input_fps_toggle',
  'input_netplay_game_watch',
  'input_toggle_fullscreen',
  'input_state_slot_increase',
  'input_state_slot_decrease',
  'input_volume_up',
  'input_volume_down',
  'input_grab_mouse_toggle',
  'input_game_focus_toggle',
  'input_desktop_menu_toggle',
];

// KeyboardEvent.code -> nome da tecla no RetroArch
const CODES = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'enter',
  NumpadEnter: 'kp_enter',
  Space: 'space',
  Tab: 'tab',
  Backspace: 'backspace',
  Escape: 'escape',
  ShiftLeft: 'shift',
  ShiftRight: 'rshift',
  ControlLeft: 'ctrl',
  ControlRight: 'rctrl',
  AltLeft: 'alt',
  AltRight: 'ralt',
  Insert: 'insert',
  Delete: 'del',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  Comma: 'comma',
  Period: 'period',
  Slash: 'slash',
  Semicolon: 'semicolon',
  Quote: 'quote',
  Minus: 'minus',
  Equal: 'equals',
  BracketLeft: 'leftbracket',
  BracketRight: 'rightbracket',
  Backslash: 'backslash',
  NumpadAdd: 'add',
  NumpadSubtract: 'subtract',
  NumpadMultiply: 'multiply',
  NumpadDivide: 'divide',
};
for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') CODES[`Key${letter}`] = letter.toLowerCase();
for (let n = 0; n <= 9; n++) {
  CODES[`Digit${n}`] = `num${n}`;
  CODES[`Numpad${n}`] = `keypad${n}`;
}
for (let n = 1; n <= 12; n++) CODES[`F${n}`] = `f${n}`;

// Aceita só ações e teclas conhecidas; o que faltar ou for inválido volta ao padrão.
function sanitize(keys, defaults) {
  const clean = { ...defaults };
  for (const action of Object.keys(defaults)) {
    const code = keys && keys[action];
    if (typeof code === 'string' && CODES[code]) clean[action] = code;
  }
  return clean;
}

const presetFor = (console) => PRESETS[console.keyPreset] || MODERN;
const sanitizeProfile = (console, keys) => sanitize(keys, presetFor(console));
const sanitizeHotkeys = (keys) => sanitize(keys, HOTKEYS);

// Opções do retroarch.cfg para o teclado de um console. Botões que o console não tem
// ficam sem tecla, para não sobrar tecla "fantasma" fazendo algo no jogo.
function toRetroArch(console, profile, hotkeys, { fastForward = false } = {}) {
  const keys = sanitizeProfile(console, profile);
  const hot = sanitizeHotkeys(hotkeys);
  const used = new Set(console.buttons.map(([action]) => action));
  const cfg = {};
  for (const name of DISABLED_HOTKEYS) cfg[name] = 'nul';

  for (const [prefix, player] of [['', 1], ['p2_', 2]]) {
    const key = (action) => CODES[keys[prefix + action]] || 'nul';
    for (const direction of DIRECTIONS) {
      cfg[`input_player${player}_${direction}`] = key(direction);
      // As direções também movem o analógico esquerdo: sem isso, jogos que só leem o
      // analógico (Nintendo 64, GameCube, PlayStation) não andam pelo teclado.
      cfg[`input_player${player}_l_${AXES[direction]}`] = key(direction);
      cfg[`input_player${player}_r_${AXES[direction]}`] = console.stick ? key(`rs_${direction}`) : 'nul';
    }
    for (const button of BUTTONS) cfg[`input_player${player}_${button}`] = used.has(button) ? key(button) : 'nul';
  }

  for (const [action, name] of Object.entries(HOTKEY_BINDS)) cfg[name] = CODES[hot[action]];
  if (!fastForward) cfg[HOTKEY_BINDS.fast] = 'nul';
  return cfg;
}

module.exports = { PRESETS, HOTKEYS, CODES, presetFor, sanitizeProfile, sanitizeHotkeys, toRetroArch };
