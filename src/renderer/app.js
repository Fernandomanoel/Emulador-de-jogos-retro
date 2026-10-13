const $ = (id) => document.getElementById(id);

const ICONS = {
  star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.900l6-.9z" stroke-linejoin="round"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.900 4.900l1.400 1.400M17.700 17.700l1.400 1.400M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.500A8 8 0 019.500 4a8 8 0 1010.500 10.500z"/></svg>',
};

const LISTS = [
  { id: 'all', name: 'Todos os jogos' },
  { id: 'fav', name: 'Favoritos' },
  { id: 'recent', name: 'Jogados recentemente' },
];

const state = {
  settings: null,
  consoles: [],
  games: [],
  install: null,
  running: null,
  dataDir: '',
  view: 'all',
  query: '',
  settingsTab: 'geral',
  capturing: null,
  keysPlayer: 1,
  keysConsole: 'snes',
  keyCodes: [],
  keyPresets: {},
  controllers: null,
  scanning: false,
};

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v; // só para os ícones fixos de ICONS
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

function hue(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

const consoleOf = (id) => state.consoles.find((c) => c.id === id);
const isFav = (game) => state.settings.favorites.includes(game.path);

function gamesFor(view) {
  if (view === 'all') return state.games;
  if (view === 'fav') return state.games.filter(isFav);
  if (view === 'recent') {
    const byPath = new Map(state.games.map((g) => [g.path, g]));
    return state.settings.recent.map((p) => byPath.get(p)).filter(Boolean);
  }
  return state.games.filter((g) => g.console === view);
}

function visibleGames() {
  const q = state.query.trim().toLowerCase();
  const list = gamesFor(state.view);
  return q ? list.filter((g) => g.title.toLowerCase().includes(q)) : list;
}

/* ---------- Navegação lateral ---------- */
function navViews() {
  return [...LISTS.map((l) => l.id), ...state.consoles.map((c) => c.id)];
}

function navButton(id, label, count, h) {
  const btn = el(
    'button',
    {
      class: 'nav-item',
      type: 'button',
      'aria-current': String(state.view === id),
      onclick: () => setView(id),
    },
    [
      h === undefined ? null : el('span', { class: 'chip' }),
      el('span', { class: 'label', text: label }),
      el('span', { class: 'count', text: String(count) }),
    ]
  );
  if (h !== undefined) btn.style.setProperty('--h', h);
  return btn;
}

function renderNav() {
  const nav = $('nav');
  nav.replaceChildren(
    ...LISTS.map((l) => navButton(l.id, l.name, gamesFor(l.id).length)),
    el('div', { class: 'nav-heading', text: 'Consoles' }),
    ...state.consoles.map((c) => navButton(c.id, c.name, gamesFor(c.id).length, c.hue))
  );
  $('btn-settings').setAttribute('aria-current', String(state.view === 'settings'));
}

function setView(view) {
  state.view = view;
  state.capturing = null;
  if (view !== 'settings') $('content').scrollTop = 0;
  render();
}

/* ---------- Grade ---------- */
function card(game) {
  const c = consoleOf(game.console);
  const fav = el('button', {
    class: 'fav',
    type: 'button',
    tabindex: '-1',
    title: 'Favoritar',
    'aria-label': 'Favoritar',
    'aria-pressed': String(isFav(game)),
    html: ICONS.star,
    onclick: (e) => {
      e.stopPropagation();
      toggleFavorite(game);
    },
  });
  const node = el(
    'div',
    {
      class: 'card',
      tabindex: '0',
      role: 'button',
      'aria-label': `${game.title} — ${c.name}`,
      ondblclick: () => play(game),
    },
    [
      el('div', { class: 'card-tags' }, [
        el('span', { class: 'tag', text: c.short }),
        game.ptbr ? el('span', { class: 'tag', text: 'PT-BR' }) : null,
        game.proto ? el('span', { class: 'tag', text: 'PROTO' }) : null,
      ]),
      fav,
      el('div', { class: 'card-title', text: game.title }),
      el('button', {
        class: 'play',
        type: 'button',
        tabindex: '-1',
        text: 'Jogar',
        onclick: (e) => {
          e.stopPropagation();
          play(game);
        },
      }),
    ]
  );
  node.style.setProperty('--h', hue(game.title));
  node.game = game;
  return node;
}

function emptyState() {
  const c = consoleOf(state.view);
  if (state.query) {
    return [el('h2', { text: 'Nenhum jogo encontrado' }), el('p', { text: `Nada com “${state.query}” nesta lista.` })];
  }
  if (state.view === 'fav') {
    return [el('h2', { text: 'Sem favoritos ainda' }), el('p', { text: 'Marque a estrela de um jogo para ele aparecer aqui.' })];
  }
  if (state.view === 'recent') {
    return [el('h2', { text: 'Nada jogado ainda' }), el('p', { text: 'Os últimos jogos que você abrir ficam aqui.' })];
  }
  if (c) {
    return [
      el('h2', { text: `Nenhum jogo de ${c.name}` }),
      el('p', { text: `Escolha a pasta onde estão os jogos (${c.exts.join(' ')}).` }),
      el('button', { class: 'btn primary', type: 'button', text: 'Escolher pasta de jogos', onclick: () => addRomDir(c.id) }),
    ];
  }
  return [
    el('h2', { text: 'Sua biblioteca está vazia' }),
    el('p', { text: 'Abra as Configurações e indique as pastas onde estão seus jogos.' }),
    el('button', { class: 'btn primary', type: 'button', text: 'Abrir Configurações', onclick: () => setView('settings') }),
  ];
}

function renderLibrary() {
  const games = visibleGames();
  const c = consoleOf(state.view);
  const list = LISTS.find((l) => l.id === state.view);
  $('view-title').textContent = c ? c.name : list.name;
  $('view-sub').textContent = games.length === 1 ? '1 jogo' : `${games.length} jogos`;

  const focused = document.activeElement && document.activeElement.game;
  $('grid').replaceChildren(...games.map(card));
  $('grid').hidden = games.length === 0;
  $('empty').hidden = games.length > 0;
  if (games.length === 0) $('empty').replaceChildren(...emptyState());
  if (focused) {
    const again = [...$('grid').children].find((n) => n.game.path === focused.path);
    if (again) again.focus({ preventScroll: true });
  }
}

/* ---------- Configurações ---------- */
function segmented(options, current, onPick) {
  return el(
    'div',
    { class: 'segmented' },
    options.map(([value, label]) =>
      el('button', { type: 'button', text: label, 'aria-pressed': String(value === current), onclick: () => onPick(value) })
    )
  );
}

function toggle(checked, label, onChange) {
  return el('button', {
    class: 'switch',
    type: 'button',
    role: 'switch',
    'aria-checked': String(checked),
    'aria-label': label,
    onclick: () => onChange(!checked),
  });
}

function row(title, detail, control) {
  return el('div', { class: 'row' }, [
    el('div', { class: 'row-main' }, [el('strong', { text: title }), detail ? el('small', { text: detail }) : null]),
    control,
  ]);
}

function consoleRow(c) {
  const installed = state.install.retroarch && state.install.cores[c.id];
  const dirs = state.settings.romDirs[c.id] || [];
  const count = gamesFor(c.id).length;
  const main = el('div', { class: 'row-main' }, [
    el('strong', { text: c.name }),
    el('small', { text: `${count} ${count === 1 ? 'jogo' : 'jogos'} · ${c.exts.join(' ')}` }),
    el(
      'ul',
      { class: 'dirs' },
      dirs.map((dir) =>
        el('li', {}, [
          el('code', { text: dir, title: dir }),
          el('button', { class: 'link', type: 'button', text: 'abrir', onclick: () => window.retro.openPath(dir) }),
          el('button', { class: 'link', type: 'button', text: 'remover', onclick: () => removeRomDir(c.id, dir) }),
        ])
      )
    ),
  ]);
  const actions = el('div', { class: 'row-actions' }, [
    installed
      ? el('span', { class: 'status-ok', text: 'Instalado' })
      : el('button', { class: 'btn small primary', type: 'button', text: 'Instalar', onclick: () => installConsole(c.id) }),
    el('button', { class: 'btn small', type: 'button', text: 'Adicionar pasta', onclick: () => addRomDir(c.id) }),
  ]);
  return el('div', { class: 'row' }, [main, actions]);
}

const SETTINGS_TABS = [
  ['geral', 'Geral'],
  ['teclado', 'Teclado'],
  ['controles', 'Controles'],
  ['consoles', 'Consoles e pastas'],
];

// Teclas que o usuário pode trocar: [ação, nome na tela]
const DIRECTION_KEYS = [
  ['up', 'Cima'],
  ['down', 'Baixo'],
  ['left', 'Esquerda'],
  ['right', 'Direita'],
];

const SHORTCUT_KEYS = [
  ['save', 'Salvar o progresso'],
  ['load', 'Carregar o progresso'],
  ['menu', 'Abrir o menu do emulador'],
  ['exit', 'Sair do jogo'],
];

const KEY_NAMES = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'Espaço',
  Escape: 'Esc',
  NumpadEnter: 'Enter (num)',
  ShiftLeft: 'Shift esq.',
  ShiftRight: 'Shift dir.',
  ControlLeft: 'Ctrl esq.',
  ControlRight: 'Ctrl dir.',
  AltLeft: 'Alt esq.',
  AltRight: 'Alt dir.',
  Delete: 'Del',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
};

function keyName(code) {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  const m = /^(Key|Digit|Numpad)(.)$/.exec(code);
  if (m) return m[1] === 'Numpad' ? `Num ${m[2]}` : m[2];
  return code;
}

// Botões do teste ao vivo: [nome interno, rótulo PlayStation, rótulo Xbox]
const TEST_BUTTONS = [
  ['up', '↑', '↑'],
  ['down', '↓', '↓'],
  ['left', '←', '←'],
  ['right', '→', '→'],
  ['a', '✕', 'A'],
  ['b', '○', 'B'],
  ['x', '□', 'X'],
  ['y', '△', 'Y'],
  ['l1', 'L1', 'LB'],
  ['r1', 'R1', 'RB'],
  ['l2', 'L2', 'LT'],
  ['r2', 'R2', 'RT'],
  ['select', 'Select', 'View'],
  ['start', 'Start', 'Menu'],
  ['l3', 'L3', 'LS'],
  ['r3', 'R3', 'RS'],
];

function notice(kind, title, text, extra) {
  return el('div', { class: `notice ${kind}` }, [el('strong', { text: title }), el('p', { text }), extra]);
}

const usbText = (usb) => (usb ? `porta USB ${usb.port} (hub ${usb.hub})` : 'sem fio ou adaptador');

// Estado de um controle que o Windows enxerga: sem driver, esperando o primeiro botão ou respondendo.
// O navegador só mostra um controle depois que um botão é apertado.
function deviceStatus(dev, devices, pads) {
  if (dev.driver === 'generic') return { level: 'bad', text: 'Plugado, mas sem sinal: falta o driver.' };
  const pad = pads[devices.filter((d) => d.driver !== 'generic').indexOf(dev)];
  if (pad) return { level: 'ok', text: `Conectado e respondendo como Jogador ${pad.index + 1}.`, player: pad.index + 1 };
  return { level: 'wait', text: 'Conectado. Aperte qualquer botão do controle para ativar.' };
}

// Resumo para a barra lateral e para a tela de "Jogando agora"
function padSummary(pads) {
  const devices = state.controllers ? state.controllers.devices : [];
  const all = devices.map((dev) => ({ dev, ...deviceStatus(dev, devices, pads) }));
  const best = all.find((s) => s.level === 'ok') || all.find((s) => s.level === 'wait') || all.find((s) => s.level === 'bad');
  if (best) {
    const label = { ok: 'conectado', wait: 'aperte um botão', bad: 'sem sinal (falta driver)' }[best.level];
    const where = [best.dev.usb ? `Porta USB ${best.dev.usb.port}` : '', best.player ? `Jogador ${best.player}` : ''].filter(Boolean);
    return { level: best.level, label: `${best.dev.name}: ${label}`, sub: where.join(' · ') };
  }
  if (pads[0]) {
    const name = pads[0].id.replace(/\s*\((STANDARD GAMEPAD )?Vendor:.*\)$/i, '');
    return { level: 'ok', label: `${name}: conectado`, sub: `Jogador ${pads[0].index + 1}` };
  }
  return { level: 'none', label: 'Nenhum controle conectado', sub: '' };
}

function ds3Notice(where) {
  const steps = [
    'Instale antes o “.NET 10 Desktop Runtime (x64)” da Microsoft: o instalador do driver exige.',
    'Clique em “Baixar driver DsHidMini” e baixe o arquivo que termina em .msi (Windows 10 e 11).',
    'Instale o arquivo e reinicie o computador se ele pedir.',
    'Conecte o controle pelo cabo USB e aperte o botão PS.',
    'Se o driver deixar escolher o modo, prefira XInput: o controle passa a ser visto como um de Xbox.',
    'Volte aqui e clique em “Verificar de novo”.',
  ];
  return notice(
    'bad',
    'Controle de PS3 plugado, mas sem driver',
    `${where}. O Windows está usando o driver genérico, que não liga o controle: ele aparece como conectado, mas nenhum botão chega ao app nem aos jogos.`,
    el('div', {}, [
      el('ol', { class: 'steps' }, steps.map((text) => el('li', { text }))),
      el('div', { class: 'row-actions' }, [
        el('button', { class: 'btn small primary', type: 'button', text: 'Baixar driver DsHidMini', onclick: () => window.retro.openLink('dshidmini') }),
        el('button', { class: 'btn small', type: 'button', text: 'Baixar .NET 10 (Microsoft)', onclick: () => window.retro.openLink('dotnet') }),
        el('button', { class: 'btn small', type: 'button', text: 'Guia oficial de instalação', onclick: () => window.retro.openLink('dshidminiGuide') }),
      ]),
      el('p', {
        class: 'muted',
        text: 'O app não instala o driver sozinho porque isso exige permissão de administrador do Windows. No Windows 7 e 8 o driver é o ScpToolkit. Controles de PS3 não originais nem sempre são aceitos.',
      }),
    ])
  );
}

function deviceNotice(dev, index) {
  const where = `Entrada: ${usbText(dev.usb)}`;
  if (dev.driver === 'generic') return ds3Notice(where);
  const drivers = { dshidmini: ' (driver DsHidMini)', scp: ' (driver ScpToolkit)' };
  const node = notice('wait', dev.name + (drivers[dev.driver] || ''), `${where}.`, el('p', { class: 'notice-live' }));
  // pollPads atualiza o estado destes avisos a cada quadro
  node.dataset.dev = index;
  return node;
}

function diagnosis() {
  const c = state.controllers;
  if (!c) return [el('p', { class: 'muted', text: 'Verificando os controles conectados…' })];
  if (!c.ok) return [notice('idle', 'Não foi possível consultar o Windows', 'Use o teste abaixo para ver se o controle responde.')];
  if (!c.devices.length) {
    return [notice('idle', 'Nenhum controle conectado', 'Conecte o controle pelo cabo USB. Esta lista se atualiza sozinha em alguns segundos.')];
  }
  return c.devices.map(deviceNotice);
}

function updateDeviceNotices(pads) {
  const devices = state.controllers ? state.controllers.devices : [];
  for (const node of document.querySelectorAll('.notice[data-dev]')) {
    const dev = devices[node.dataset.dev];
    if (!dev) continue;
    const status = deviceStatus(dev, devices, pads);
    const cls = `notice ${status.level}`;
    if (node.className !== cls) node.className = cls;
    setText(node.querySelector('.notice-live'), status.text);
  }
}

function settingsGeral() {
  const s = state.settings;
  return [
    el('h2', { text: 'Aparência' }),
    el('div', { class: 'panel' }, [
      row(
        'Tema',
        'Sistema acompanha o tema do Windows.',
        segmented([['system', 'Sistema'], ['dark', 'Escuro'], ['light', 'Claro']], s.theme, (theme) => updateSettings({ theme }))
      ),
    ]),

    el('h2', { text: 'Jogo' }),
    el('div', { class: 'panel' }, [
      row('Tela cheia', 'Abre os jogos ocupando a tela inteira.', toggle(s.fullscreen, 'Tela cheia', (fullscreen) => updateSettings({ fullscreen }))),
      row(
        'Download automático',
        'Baixa o RetroArch e os emuladores necessários ao abrir o app.',
        toggle(s.autoInstall, 'Download automático', (autoInstall) => updateSettings({ autoInstall }))
      ),
    ]),

    el('h2', { text: 'Dados do app' }),
    el('div', { class: 'panel' }, [
      row(
        'Pasta de dados',
        state.dataDir,
        el('button', { class: 'btn small', type: 'button', text: 'Abrir pasta', onclick: () => window.retro.openPath(state.dataDir) })
      ),
      row(
        'RetroArch',
        state.install.retroarch ? `Versão ${state.install.version} instalada` : `Versão ${state.install.version} (ainda não baixado)`,
        null
      ),
    ]),
  ];
}

function settingsControles() {
  const recheck = el('button', {
    class: 'btn small',
    type: 'button',
    text: state.scanning ? 'Verificando…' : 'Verificar de novo',
    onclick: () => scanControllers(true),
  });
  recheck.disabled = state.scanning;

  return [
    el('div', { class: 'heading-row' }, [el('h2', { text: 'Controles conectados' }), recheck]),
    el('div', { class: 'panel help' }, diagnosis()),

    el('h2', { text: 'Teste ao vivo' }),
    el('div', { class: 'panel help' }, [
      el('p', { id: 'pad-tester-name', class: 'muted' }),
      el(
        'div',
        { id: 'pad-tester', class: 'tester' },
        TEST_BUTTONS.map(([name]) => el('span', { class: 'test-btn', 'data-btn': name, 'data-on': 'false' }))
      ),
    ]),

    el('h2', { text: 'Durante o jogo' }),
    el('div', { class: 'panel help' }, [
      el('p', { text: 'Os botões do controle ficam na mesma posição do controle original do console.' }),
      el('p', { text: 'Apertar os dois analógicos juntos (L3 + R3) abre o menu do emulador, para salvar, carregar ou sair.' }),
    ]),
  ];
}

// id identifica a tecla em edição: "game:<ação>" (console escolhido) ou "hot:<atalho>"
function keyRow(id, label, code) {
  const waiting = state.capturing === id;
  return el('div', { class: 'key-row' }, [
    el('span', { text: label }),
    el('button', {
      class: 'keycap',
      type: 'button',
      'aria-pressed': String(waiting),
      'aria-label': `${label}: ${keyName(code)}. Clique para trocar`,
      text: waiting ? 'Aperte a tecla…' : keyName(code),
      onclick: () => {
        state.capturing = waiting ? null : id;
        render();
      },
    }),
  ]);
}

const keysConsole = () => consoleOf(state.keysConsole) || state.consoles[0];

// Linhas [ação, nome] que aparecem para um console e jogador
function gameKeys(c, profile, prefix) {
  // O jogador 2 só tem os botões básicos (sem gatilhos nem segundo analógico)
  const buttons = c.buttons.filter(([action]) => profile[prefix + action]);
  const stick = !prefix && c.stick ? DIRECTION_KEYS.map(([action, label]) => [`rs_${action}`, `${c.stick} ${label.toLowerCase()}`]) : [];
  return [...DIRECTION_KEYS, ...buttons, ...stick].map(([action, label]) => [prefix + action, label]);
}

// Teclas em uso por um console, contando os dois jogadores
function consoleCodes(c) {
  const profile = state.settings.keyboards[c.id];
  return ['', 'p2_'].flatMap((prefix) => gameKeys(c, profile, prefix).map(([action]) => profile[action]));
}

function settingsTeclado() {
  const s = state.settings;
  const c = keysConsole();
  const profile = s.keyboards[c.id];
  const prefix = state.keysPlayer === 2 ? 'p2_' : '';
  const pick = (patch) => {
    Object.assign(state, patch);
    state.capturing = null;
    render();
  };
  const usePreset = (name) => saveKeyboards({ ...s.keyboards, [c.id]: { ...state.keyPresets[name] } });

  return [
    el('h2', { text: `Teclas de ${c.name}` }),
    el('p', { class: 'muted lead', text: 'Cada console tem as suas teclas. Clique em uma tecla e aperte a nova.' }),
    el('div', { class: 'tabs' }, [segmented(state.consoles.map((x) => [x.id, x.short]), c.id, (id) => pick({ keysConsole: id }))]),
    el('div', { class: 'key-tools' }, [
      el('div', { class: 'tabs' }, [segmented([[1, 'Jogador 1'], [2, 'Jogador 2']], state.keysPlayer, (n) => pick({ keysPlayer: n }))]),
      el('div', { class: 'row-actions' }, [
        el('button', { class: 'btn small', type: 'button', text: 'Usar estilo moderno (WASD)', onclick: () => usePreset('modern') }),
        el('button', { class: 'btn small', type: 'button', text: 'Usar estilo lan house', onclick: () => usePreset('lanhouse') }),
      ]),
    ]),
    el(
      'div',
      { class: 'panel key-grid' },
      gameKeys(c, profile, prefix).map(([action, label]) => keyRow(`game:${action}`, label, profile[action]))
    ),

    el('h2', { text: 'Atalhos' }),
    el('p', { class: 'muted lead', text: 'Valem para todos os consoles.' }),
    el('div', { class: 'panel key-grid' }, SHORTCUT_KEYS.map(([action, label]) => keyRow(`hot:${action}`, label, s.hotkeys[action]))),

    el('h2', { text: 'Acelerar o jogo' }),
    el('div', { class: 'panel' }, [
      row(
        'Permitir acelerar o jogo',
        s.fastForward
          ? 'Aperte a tecla uma vez para acelerar e de novo para voltar à velocidade normal.'
          : 'Desligado: nenhuma tecla acelera o jogo.',
        toggle(s.fastForward, 'Permitir acelerar o jogo', (fastForward) => updateSettings({ fastForward }))
      ),
      s.fastForward ? el('div', { class: 'key-grid' }, [keyRow('hot:fast', 'Tecla para acelerar', s.hotkeys.fast)]) : null,
    ]),
  ];
}

async function saveKeyboards(keyboards) {
  state.capturing = null;
  await updateSettings({ keyboards });
}

async function saveHotkeys(hotkeys) {
  state.capturing = null;
  await updateSettings({ hotkeys });
}

// Enquanto uma tecla está sendo escolhida, a próxima tecla apertada vira a nova.
// Se ela já estava em outro botão do mesmo console (ou em outro atalho), os dois trocam de lugar.
// Botão de jogo e atalho nunca dividem a mesma tecla, porque o atalho vale em todos os consoles.
document.addEventListener(
  'keydown',
  (e) => {
    if (!state.capturing) return;
    e.preventDefault();
    e.stopPropagation();
    if (!state.keyCodes.includes(e.code)) {
      showError('Essa tecla não pode ser usada. Escolha outra.');
      return;
    }
    const [scope, action] = state.capturing.split(':');
    const { keyboards, hotkeys } = state.settings;
    const swapInto = (keys) => {
      const next = { ...keys };
      const taken = Object.keys(next).find((other) => next[other] === e.code);
      if (taken) next[taken] = next[action];
      next[action] = e.code;
      return next;
    };

    if (scope === 'hot') {
      const user = state.consoles.find((c) => consoleCodes(c).includes(e.code));
      if (user) {
        showError(`Essa tecla já é um botão em ${user.name}. Escolha outra.`);
        return;
      }
      saveHotkeys(swapInto(hotkeys));
    } else {
      if (Object.values(hotkeys).includes(e.code)) {
        showError('Essa tecla já é um atalho. Escolha outra ou troque o atalho antes.');
        return;
      }
      const c = keysConsole();
      saveKeyboards({ ...keyboards, [c.id]: swapInto(keyboards[c.id]) });
    }
  },
  true
);

function settingsConsoles() {
  return [
    el('h2', { text: 'Consoles e pastas de jogos' }),
    el('div', { class: 'panel' }, state.consoles.map(consoleRow)),
  ];
}

function renderSettings() {
  $('view-title').textContent = 'Configurações';
  $('view-sub').textContent = '';
  const body = { geral: settingsGeral, teclado: settingsTeclado, controles: settingsControles, consoles: settingsConsoles }[state.settingsTab]();
  $('settings').replaceChildren(el('div', { class: 'tabs' }, [segmented(SETTINGS_TABS, state.settingsTab, setSettingsTab)]), ...body);
}

function setSettingsTab(tab) {
  state.settingsTab = tab;
  state.capturing = null;
  render();
  if (tab === 'controles' && !state.controllers) scanControllers(true);
}

// manual = pedido pelo botão; as verificações automáticas só redesenham a tela se algo mudou.
async function scanControllers(manual = false) {
  if (state.scanning) return;
  state.scanning = true;
  if (manual) render();
  const result = await window.retro.scanControllers();
  const changed = JSON.stringify(result) !== JSON.stringify(state.controllers);
  state.controllers = result;
  state.scanning = false;
  updatePadStatus();
  if (state.view === 'settings' && (manual || changed)) render();
}

function render() {
  const inSettings = state.view === 'settings';
  renderNav();
  $('settings').hidden = !inSettings;
  $('search').hidden = inSettings;
  $('btn-keys').hidden = inSettings;
  setText($('overlay-exit'), keyName(state.settings.hotkeys.exit));
  setText($('hint-exit'), keyName(state.settings.hotkeys.exit));
  $('hints').hidden = inSettings;
  if (inSettings) {
    $('grid').hidden = true;
    $('empty').hidden = true;
    renderSettings();
  } else {
    renderLibrary();
  }
  $('btn-theme').innerHTML = darkQuery.matches ? ICONS.sun : ICONS.moon;
}

/* ---------- Ações ---------- */
let toastTimer = 0;
function showError(error) {
  const text = String((error && error.message) || error).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 7000);
}

async function refresh() {
  Object.assign(state, await window.retro.getState());
  render();
}

async function updateSettings(patch) {
  state.settings = await window.retro.updateSettings(patch);
  render();
}

async function toggleFavorite(game) {
  state.settings.favorites = await window.retro.toggleFavorite(game.path);
  render();
}

async function addRomDir(consoleId) {
  Object.assign(state, await window.retro.addRomDir(consoleId));
  render();
  maybeAutoInstall();
}

async function removeRomDir(consoleId, dir) {
  Object.assign(state, await window.retro.removeRomDir(consoleId, dir));
  render();
}

async function installConsole(consoleId) {
  try {
    state.install = await window.retro.installConsole(consoleId);
    render();
  } catch (e) {
    showError(e);
  }
}

async function play(game) {
  if (state.running) return;
  try {
    state.settings.recent = await window.retro.launch(game.path);
    state.install = (await window.retro.getState()).install;
    renderNav();
  } catch (e) {
    showError(e);
  }
}

// Baixa sozinho o RetroArch e os emuladores dos consoles que já têm jogos.
async function maybeAutoInstall() {
  if (!state.settings.autoInstall) return;
  const needed = [...new Set(state.games.map((g) => g.console))].some(
    (id) => !state.install.retroarch || !state.install.cores[id]
  );
  if (!needed) return;
  try {
    state.install = await window.retro.installNeeded();
    render();
  } catch (e) {
    showError(e);
  }
}

/* ---------- Progresso de instalação ---------- */
const mb = (bytes) => `${(bytes / 1048576).toFixed(0)} MB`;
let progressTimer = 0;

window.retro.onInstallProgress((p) => {
  clearTimeout(progressTimer);
  $('progress').hidden = false;
  let detail = '';
  let percent = 0;
  if (p.phase === 'start') {
    detail = 'Iniciando…';
  } else if (p.phase === 'download') {
    percent = p.total ? (p.received / p.total) * 100 : 0;
    detail = p.total ? `${mb(p.received)} de ${mb(p.total)}` : mb(p.received);
  } else if (p.phase === 'extract') {
    percent = p.percent;
    detail = `Extraindo ${p.percent}%`;
  } else if (p.phase === 'done') {
    percent = 100;
    detail = 'Pronto';
    progressTimer = setTimeout(() => ($('progress').hidden = true), 1800);
  } else if (p.phase === 'error') {
    detail = 'Falhou';
    progressTimer = setTimeout(() => ($('progress').hidden = true), 4000);
  }
  $('progress-label').textContent = p.phase === 'download' ? `Baixando ${p.label}` : p.label;
  $('progress-detail').textContent = detail;
  $('progress-bar').style.transform = `scaleX(${percent / 100})`;
});

window.retro.onGameState(({ running, error }) => {
  state.running = running;
  $('overlay').hidden = !running;
  if (running) {
    $('overlay-title').textContent = running.title;
    updatePadStatus();
    scanControllers();
  }
  if (error) showError(`Não foi possível abrir o emulador: ${error}`);
});

/* ---------- Navegação pela grade (teclado e controle) ---------- */
function cards() {
  return [...$('grid').children];
}

function moveFocus(dx, dy) {
  const list = cards();
  if (!list.length) return;
  const current = list.indexOf(document.activeElement);
  if (current < 0) {
    list[0].focus();
    return;
  }
  const top = list[0].offsetTop;
  const cols = list.findIndex((n) => n.offsetTop !== top);
  const perRow = cols < 0 ? list.length : cols;
  let next = current + dx + dy * perRow;
  if (dy > 0 && next >= list.length && Math.floor(current / perRow) < Math.floor((list.length - 1) / perRow)) {
    next = list.length - 1;
  }
  if (next < 0 || next >= list.length) return;
  list[next].focus();
  list[next].scrollIntoView({ block: 'nearest' });
}

function focusedGame() {
  return document.activeElement && document.activeElement.game;
}

function cycleView(step) {
  const views = navViews();
  const i = views.indexOf(state.view);
  setView(views[(i + step + views.length) % views.length]);
}

document.addEventListener('keydown', (e) => {
  if (state.running || state.view === 'settings') return;
  const inSearch = e.target === $('search');
  if ((e.ctrlKey && e.key.toLowerCase() === 'f') || (e.key === '/' && !inSearch)) {
    e.preventDefault();
    $('search').focus();
    return;
  }
  if (inSearch) {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const first = cards()[0];
      if (first) first.focus();
    }
    return;
  }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrows[e.key]) {
    e.preventDefault();
    moveFocus(...arrows[e.key]);
  } else if (e.key === 'Enter' && focusedGame() && e.target.classList.contains('card')) {
    play(focusedGame());
  } else if (e.key.toLowerCase() === 'f' && focusedGame()) {
    toggleFavorite(focusedGame());
  }
});

/* ---------- Controle (Gamepad API) ---------- */
// Layout padrão do navegador: controles de Xbox (XInput) e o de PS3 com DsHidMini em modo XInput.
// a/b/x/y são posições: a = baixo (✕ ou A), b = direita (○ ou B), x = esquerda (□ ou X), y = cima (△ ou Y).
const PAD_STANDARD = {
  a: 0, b: 1, x: 2, y: 3, l1: 4, r1: 5, l2: 6, r2: 7,
  select: 8, start: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15,
};
// DualShock 3 sem mapeamento padrão (ordem crua dos botões)
const PAD_DS3_RAW = {
  select: 0, l3: 1, r3: 2, start: 3, up: 4, right: 5, down: 6, left: 7,
  l2: 8, r2: 9, l1: 10, r1: 11, y: 12, b: 13, a: 14, x: 15,
};
// DualShock 3 com DsHidMini em modo SXS: o direcional chega como "hat" em um eixo
const PAD_DS3_SXS = {
  y: 0, b: 1, a: 2, x: 3, l2: 4, r2: 5, l1: 6, r1: 7, start: 8, select: 9, l3: 10, r3: 11,
};
const HAT_AXIS = 9;
const REPEAT_FIRST = 380;
const REPEAT_NEXT = 120;
const AXIS_THRESHOLD = 0.55;

const padHeld = {};

function padLayout(pad) {
  if (pad.mapping === 'standard') return PAD_STANDARD;
  if (/DS3 Compatible HID/i.test(pad.id)) return PAD_DS3_SXS;
  if (/054c.*0268|PLAYSTATION\(R\)3|PS3/i.test(pad.id)) return PAD_DS3_RAW;
  return PAD_STANDARD;
}

const padKind = (pad) => (/xbox|xinput|045e/i.test(pad.id) ? 'xbox' : 'ps');

// O "hat" vai de -1 (cima) a 1 em passos de 2/7, no sentido horário; fora disso está solto.
function readHat(pad) {
  const v = pad.axes[HAT_AXIS];
  if (v === undefined || Math.abs(v) > 1.1) return {};
  const i = Math.round((v + 1) * 3.5) % 8;
  return { up: i === 7 || i <= 1, right: i >= 1 && i <= 3, down: i >= 3 && i <= 5, left: i >= 5 };
}

function readPad(pad) {
  const map = padLayout(pad);
  const pressed = (name) => !!(pad.buttons[map[name]] && pad.buttons[map[name]].pressed);
  const hat = map === PAD_DS3_SXS ? readHat(pad) : {};
  const [x = 0, y = 0] = pad.axes;
  const input = {};
  for (const name of Object.keys(PAD_STANDARD)) input[name] = pressed(name);
  input.up = input.up || !!hat.up || y < -AXIS_THRESHOLD;
  input.down = input.down || !!hat.down || y > AXIS_THRESHOLD;
  input.left = input.left || !!hat.left || x < -AXIS_THRESHOLD;
  input.right = input.right || !!hat.right || x > AXIS_THRESHOLD;
  return input;
}

// Dispara ao apertar; as direções repetem enquanto seguradas.
function padFired(name, down, now, repeats) {
  const held = padHeld[name];
  if (!down) {
    delete padHeld[name];
    return false;
  }
  if (!held) {
    padHeld[name] = now + REPEAT_FIRST;
    return true;
  }
  if (repeats && now >= held) {
    padHeld[name] = now + REPEAT_NEXT;
    return true;
  }
  return false;
}

function handlePad(input, now) {
  const fired = (name, repeats) => padFired(name, input[name], now, repeats);
  const up = fired('up', true);
  const down = fired('down', true);
  const left = fired('left', true);
  const right = fired('right', true);
  const a = fired('a');
  const start = fired('start');
  const y = fired('y');
  const b = fired('b');
  const l1 = fired('l1');
  const r1 = fired('r1');

  if (state.view === 'settings') {
    if (b) setView('all');
    return;
  }
  if (up) moveFocus(0, -1);
  if (down) moveFocus(0, 1);
  if (left) moveFocus(-1, 0);
  if (right) moveFocus(1, 0);
  if (l1) cycleView(-1);
  if (r1) cycleView(1);
  if ((a || start) && focusedGame()) play(focusedGame());
  if (y && focusedGame()) toggleFavorite(focusedGame());
}

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

function updateTester(pad, input) {
  const box = $('pad-tester');
  if (!box) return;
  setText(
    $('pad-tester-name'),
    pad
      ? `Recebendo sinal de: ${pad.id}`
      : 'Aperte qualquer botão do controle. Se nada acender aqui, o controle não está enviando sinal para o computador.'
  );
  const labelIndex = pad && padKind(pad) === 'xbox' ? 2 : 1;
  [...box.children].forEach((chip, i) => {
    setText(chip, TEST_BUTTONS[i][labelIndex]);
    const on = String(!!(input && input[chip.dataset.btn]));
    if (chip.dataset.on !== on) chip.dataset.on = on;
  });
}

const currentPads = () => [...navigator.getGamepads()].filter(Boolean);

function updatePadStatus(pads = currentPads()) {
  const { level, label, sub } = padSummary(pads);
  if ($('pad-status').dataset.level !== level) $('pad-status').dataset.level = level;
  setText($('pad-label'), label);
  setText($('pad-sub'), sub);
  if (state.running) {
    if ($('overlay-pad').dataset.level !== level) $('overlay-pad').dataset.level = level;
    const hint = level === 'bad' || level === 'none' ? ' Use o teclado.' : '';
    setText($('overlay-pad-text'), [label, sub].filter(Boolean).join(' · ') + '.' + hint);
  }
}

function pollPads(now) {
  const pads = currentPads();
  const pad = pads[0];
  updatePadStatus(pads);
  const input = pad ? readPad(pad) : null;
  if (state.view === 'settings') {
    updateTester(pad, input);
    updateDeviceNotices(pads);
  }
  if (input && document.hasFocus() && !state.running && state.settings) handlePad(input, now);
  requestAnimationFrame(pollPads);
}

/* ---------- Início ---------- */
$('search').addEventListener('input', (e) => {
  state.query = e.target.value;
  renderLibrary();
});

$('btn-settings').addEventListener('click', () => setView('settings'));
$('pad-status').addEventListener('click', () => {
  state.view = 'settings';
  setSettingsTab('controles');
});

// O Windows não avisa o app quando um controle é plugado; então conferimos de tempos em tempos.
const SCAN_INTERVAL = 15000;
setInterval(() => {
  if (document.hasFocus() && !state.running) scanControllers();
}, SCAN_INTERVAL);
window.addEventListener('focus', () => {
  scanControllers();
  if (!state.running && !state.capturing && state.view !== 'settings') refresh();
});
window.addEventListener('gamepadconnected', () => scanControllers());
window.addEventListener('gamepaddisconnected', () => scanControllers());
$('btn-keys').addEventListener('click', () => {
  if (consoleOf(state.view)) state.keysConsole = state.view;
  state.view = 'settings';
  setSettingsTab('teclado');
});
$('btn-theme').addEventListener('click', () => updateSettings({ theme: darkQuery.matches ? 'light' : 'dark' }));
darkQuery.addEventListener('change', render);

refresh().then(() => {
  const first = cards()[0];
  if (first) first.focus({ preventScroll: true });
  maybeAutoInstall();
  scanControllers();
  requestAnimationFrame(pollPads);
}, showError);
