const { spawn } = require('child_process');
const { once } = require('events');
const fs = require('fs');
const https = require('https');
const path = require('path');
const paths = require('./paths');
const consoles = require('./consoles');

const RETROARCH_VERSION = '1.22.2';
const RETROARCH_URL = `https://buildbot.libretro.com/stable/${RETROARCH_VERSION}/windows/x86_64/RetroArch.7z`;
const coreUrl = (core) =>
  `https://buildbot.libretro.com/nightly/windows/x86_64/latest/${core}_libretro.dll.zip`;
const SYSTEM_URL = 'https://buildbot.libretro.com/assets/system/';
const DOWNLOAD_TIMEOUT = 30000;

let notify = () => {};
const inFlight = new Map();
// Uma instalação por vez: os downloads são grandes e a extração é pesada.
let queue = Promise.resolve();

function onProgress(fn) {
  notify = fn;
}

function status() {
  return {
    retroarch: fs.existsSync(paths.retroarchExe()),
    version: RETROARCH_VERSION,
    cores: Object.fromEntries(consoles.map((c) => [c.id, hasCore(c) && hasSystem(c)])),
  };
}

const hasCore = (c) => fs.existsSync(paths.coreFile(c.core));
const hasSystem = (c) => !c.system || fs.existsSync(paths.systemDir(c.system.dir));

// https puro (em vez de fetch) para funcionar no Electron 22, o último com suporte a Windows 7/8.
function request(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'RetroEmulator' } }, (res) => {
      const { statusCode, headers } = res;
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        res.resume();
        if (!redirects) return reject(new Error('Redirecionamentos demais'));
        const next = new URL(headers.location, url);
        if (next.protocol !== 'https:') return reject(new Error('Redirecionamento inseguro'));
        return resolve(request(next.href, redirects - 1));
      }
      if (statusCode !== 200) {
        res.resume();
        return reject(new Error(`Falha no download (HTTP ${statusCode})`));
      }
      resolve(res);
    });
    req.setTimeout(DOWNLOAD_TIMEOUT, () => req.destroy(new Error('Conexão sem resposta')));
    req.on('error', reject);
  });
}

async function download(url, dest, report) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await request(url);
  const total = Number(res.headers['content-length']) || 0;
  const part = `${dest}.part`;
  const ws = fs.createWriteStream(part);
  let received = 0;
  let lastReport = 0;
  try {
    for await (const chunk of res) {
      received += chunk.length;
      if (!ws.write(chunk)) await once(ws, 'drain');
      const now = Date.now();
      if (now - lastReport > 200) {
        lastReport = now;
        report({ phase: 'download', received, total });
      }
    }
  } finally {
    ws.end();
    await once(ws, 'close');
  }
  if (total && received !== total) {
    fs.rmSync(part, { force: true });
    throw new Error('Download incompleto, tente novamente');
  }
  fs.renameSync(part, dest);
}

function extract(archive, outDir, report) {
  const { path7za } = require('7zip-bin');
  fs.mkdirSync(outDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const child = spawn(path7za, ['x', archive, `-o${outDir}`, '-y', '-bsp1'], {
      windowsHide: true,
    });
    let err = '';
    child.stdout.on('data', (buf) => {
      const m = [...buf.toString().matchAll(/(\d+)%/g)].pop();
      if (m) report({ phase: 'extract', percent: Number(m[1]) });
    });
    child.stderr.on('data', (buf) => (err += buf));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`Falha ao extrair (${code}) ${err.trim()}`))
    );
  });
}

function findExeDir(dir, depth = 0) {
  if (fs.existsSync(path.join(dir, 'retroarch.exe'))) return dir;
  if (depth >= 2) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const found = findExeDir(path.join(dir, e.name), depth + 1);
    if (found) return found;
  }
  return null;
}

async function doInstallRetroArch(report) {
  const archive = path.join(paths.downloadsDir(), 'RetroArch.7z');
  const tmp = path.join(paths.dataDir(), '_extract');
  await download(RETROARCH_URL, archive, report);
  fs.rmSync(tmp, { recursive: true, force: true });
  await extract(archive, tmp, report);
  const found = findExeDir(tmp);
  if (!found) throw new Error('retroarch.exe não encontrado no pacote baixado');
  fs.rmSync(paths.retroarchDir(), { recursive: true, force: true });
  fs.renameSync(found, paths.retroarchDir());
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(archive, { force: true });
}

async function doInstallCore(core, report) {
  const archive = path.join(paths.downloadsDir(), `${core}_libretro.dll.zip`);
  await download(coreUrl(core), archive, report);
  await extract(archive, paths.coresDir(), report);
  fs.rmSync(archive, { force: true });
  if (!fs.existsSync(paths.coreFile(core))) throw new Error(`Core ${core} não foi instalado`);
}

function run(task, label, job) {
  if (inFlight.has(task)) return inFlight.get(task);
  const report = (p) => notify({ task, label, ...p });
  const promise = (queue = queue
    .catch(() => {})
    .then(async () => {
      report({ phase: 'start' });
      try {
        await job(report);
        report({ phase: 'done' });
      } catch (e) {
        report({ phase: 'error', message: e.message });
        throw e;
      }
    })).finally(() => inFlight.delete(task));
  inFlight.set(task, promise);
  return promise;
}

function installRetroArch() {
  if (status().retroarch) return Promise.resolve();
  return run('retroarch', 'RetroArch', doInstallRetroArch);
}

async function installConsole(consoleId) {
  const c = consoles.find((x) => x.id === consoleId);
  if (!c) throw new Error('Console desconhecido');
  await installRetroArch();
  if (!hasCore(c)) {
    await run(`core:${c.core}`, `Emulador de ${c.name}`, (report) => doInstallCore(c.core, report));
  }
  if (!hasSystem(c)) {
    await run(`system:${c.id}`, `Arquivos de sistema de ${c.name}`, (report) => doInstallSystem(c.system, report));
  }
}

async function doInstallSystem(system, report) {
  const archive = path.join(paths.downloadsDir(), system.zip);
  await download(SYSTEM_URL + system.zip, archive, report);
  await extract(archive, paths.systemDir(), report);
  fs.rmSync(archive, { force: true });
  if (!fs.existsSync(paths.systemDir(system.dir))) throw new Error('Arquivos de sistema não foram instalados');
}

module.exports = { onProgress, status, installRetroArch, installConsole };
