// Consoles suportados. Cada um roda em um "core" do RetroArch (libretro).
//
// buttons: [ação, nome do botão neste console]. As ações são posições do controle do RetroArch:
//   b = botão de baixo, a = direita, y = esquerda, x = cima, l/r = ombros, l2/r2 = gatilhos.
// stick: nome do segundo analógico (ou dos botões C), quando o console tem.
// keyPreset: estilo de teclado que vem de fábrica (ver keyboard.js).
// coreOptions: ajustes de desempenho gravados no .opt do core antes de cada partida.
const START_SELECT = [
  ['start', 'Start'],
  ['select', 'Select'],
];

module.exports = [
  {
    id: 'snes',
    name: 'Super Nintendo',
    short: 'SNES',
    core: 'snes9x',
    exts: ['.smc', '.sfc', '.fig', '.swc', '.bs', '.zip'],
    // ROMs de SNES antigas às vezes vêm sem extensão (ex.: "F-zero")
    allowNoExt: true,
    hue: 262,
    keyPreset: 'modern',
    buttons: [['a', 'A'], ['b', 'B'], ['x', 'X'], ['y', 'Y'], ['l', 'L'], ['r', 'R'], ...START_SELECT],
  },
  {
    id: 'genesis',
    name: 'Mega Drive',
    short: 'MD',
    core: 'genesis_plus_gx',
    exts: ['.md', '.gen', '.smd', '.sms', '.gg', '.zip'],
    hue: 210,
    keyPreset: 'modern',
    buttons: [['y', 'A'], ['b', 'B'], ['a', 'C'], ['l', 'X'], ['x', 'Y'], ['r', 'Z'], ['start', 'Start'], ['select', 'Mode']],
  },
  {
    id: 'nes',
    name: 'Nintendo 8-bit',
    short: 'NES',
    core: 'nestopia',
    exts: ['.nes', '.fds', '.zip'],
    hue: 0,
    keyPreset: 'modern',
    buttons: [['a', 'A'], ['b', 'B'], ...START_SELECT],
  },
  {
    id: 'gb',
    name: 'Game Boy / Advance',
    short: 'GBA',
    core: 'mgba',
    exts: ['.gb', '.gbc', '.gba', '.zip'],
    hue: 140,
    keyPreset: 'modern',
    buttons: [['a', 'A'], ['b', 'B'], ['l', 'L'], ['r', 'R'], ...START_SELECT],
  },
  {
    id: 'n64',
    name: 'Nintendo 64',
    short: 'N64',
    core: 'mupen64plus_next',
    exts: ['.z64', '.n64', '.v64', '.zip'],
    hue: 35,
    keyPreset: 'modern',
    buttons: [['b', 'A'], ['y', 'B'], ['l2', 'Z'], ['l', 'L'], ['r', 'R'], ['start', 'Start']],
    stick: 'Botão C',
    // Resolução original do N64 e vídeo em outro núcleo do processador: o Intel HD integrado não dá conta de 640x480
    coreOptions: {
      dir: 'Mupen64Plus-Next',
      values: { 'mupen64plus-43screensize': '320x240', 'mupen64plus-ThreadedRenderer': 'True' },
    },
  },
  {
    id: 'ps1',
    name: 'PlayStation',
    short: 'PS1',
    core: 'pcsx_rearmed',
    // .bin fica de fora de propósito: o .cue ao lado é o que deve ser aberto
    exts: ['.cue', '.chd', '.pbp', '.m3u', '.iso'],
    hue: 225,
    keyPreset: 'lanhouse',
    buttons: [['b', '✕'], ['a', '○'], ['y', '□'], ['x', '△'], ['l', 'L1'], ['r', 'R1'], ['l2', 'L2'], ['r2', 'R2'], ...START_SELECT],
  },
  {
    id: 'gamecube',
    name: 'GameCube',
    short: 'GC',
    core: 'dolphin',
    exts: ['.iso', '.rvz', '.gcm', '.gcz', '.ciso', '.wbfs'],
    // O Dolphin precisa dos seus arquivos de sistema em retroarch\system\dolphin-emu
    system: { zip: 'Dolphin.zip', dir: 'dolphin-emu' },
    hue: 275,
    keyPreset: 'modern',
    buttons: [['a', 'A'], ['b', 'B'], ['x', 'X'], ['y', 'Y'], ['r', 'Z'], ['l2', 'L'], ['r2', 'R'], ['start', 'Start']],
    stick: 'Analógico C',
    // Shaders compilados em segundo plano (3) tiram os engasgos. Não ligar dolphin_vi_skip: no teste travou o jogo.
    coreOptions: {
      dir: 'dolphin-emu',
      values: { dolphin_shader_compilation_mode: '3' },
    },
  },
];
