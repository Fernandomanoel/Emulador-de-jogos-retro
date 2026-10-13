const fs = require('fs');
const path = require('path');
const consoles = require('./consoles');
const settings = require('./settings');

const MAX_DEPTH = 3;
const MIN_NOEXT_SIZE = 128 * 1024;
const REGIONS = ['USA', 'Japan', 'Europe', 'France', 'Brazil', 'Germany', 'Spain', 'World'];

// "Legend of Zelda, The - A Link to the Past (USA) (PT-BR).sfc"
//   -> { title: "The Legend of Zelda - A Link to the Past", region: "USA", ptbr: true }
function parseName(file) {
  let name = file.replace(/\.[A-Za-z0-9]{2,4}$/, '');
  const tags = [];
  name = name.replace(/\(([^)]*)\)/g, (_, tag) => {
    tags.push(tag.trim());
    return '';
  });
  name = name
    // marcas de catálogo como [!] e [T+Por]
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\.(smc|sfc|fig)\b/gi, '')
    .replace(/_/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  name = name.replace(/^([^-]+?), (The|A|An)\b/, '$2 $1');

  const flat = tags.flatMap((t) => t.split(',').map((s) => s.trim()));
  return {
    title: name || file,
    region: flat.find((t) => REGIONS.includes(t)) || '',
    ptbr: flat.some((t) => /^pt-?br$/i.test(t) || t === 'Translated Pt'),
    proto: flat.includes('Proto'),
  };
}

function walk(dir, depth, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth < MAX_DEPTH) walk(full, depth + 1, out);
    } else if (e.isFile()) {
      out.push(full);
    }
  }
}

function scanConsole(c, dirs) {
  const files = [];
  for (const dir of dirs) walk(dir, 0, files);

  // Jogo de vários discos: a lista .m3u aparece uma vez só e os discos dela ficam escondidos
  const inPlaylist = new Set();
  for (const full of files) {
    if (path.extname(full).toLowerCase() !== '.m3u') continue;
    try {
      for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
        const entry = line.trim();
        if (entry && !entry.startsWith('#')) inPlaylist.add(path.resolve(path.dirname(full), entry).toLowerCase());
      }
    } catch {}
  }

  const games = [];
  const seen = new Set();
  for (const full of files) {
    const key = full.toLowerCase();
    if (seen.has(key) || inPlaylist.has(key)) continue;
    const ext = path.extname(full).toLowerCase();
    let ok = c.exts.includes(ext);
    if (!ok && c.allowNoExt && ext === '') {
      try {
        ok = fs.statSync(full).size >= MIN_NOEXT_SIZE;
      } catch {}
    }
    if (!ok) continue;
    seen.add(key);
    games.push({ path: full, console: c.id, ...parseName(path.basename(full)) });
  }
  return games;
}

function scanAll() {
  const { romDirs } = settings.load();
  const games = [];
  for (const c of consoles) games.push(...scanConsole(c, romDirs[c.id] || []));
  // "The Lion King" fica na letra L, não na T
  const key = (g) => g.title.replace(/^(The|A|An) /, '');
  games.sort((a, b) => key(a).localeCompare(key(b), 'pt-BR', { sensitivity: 'base', numeric: true }));
  return games;
}

module.exports = { scanAll, parseName };
