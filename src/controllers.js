const { execFile } = require('child_process');

// Traz o controle de PS3, tudo que é XInput (IG_) e os aparelhos USB da Microsoft (para achar a porta do Xbox).
// Get-PnpDevice (Windows 8+) responde em ~2 s e só lista o que está plugado; a consulta WMI fica como
// reserva para o PowerShell 2 do Windows 7, porque pode levar mais de 20 s.
const QUERY = `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
if (Get-Command Get-PnpDevice -ErrorAction SilentlyContinue) {
  $rows = Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -match 'VID_054C&PID_0268|IG_|^USB\\\\VID_045E' } |
    ForEach-Object { ,@($_.InstanceId, $_.FriendlyName, $_.Service, '') }
} else {
  $filter = "DeviceID LIKE '%VID_054C&PID_0268%' OR DeviceID LIKE '%IG[_]%' OR DeviceID LIKE 'USB\\\\VID[_]045E%'"
  $rows = Get-WmiObject Win32_PnPSignedDriver -Filter $filter |
    ForEach-Object { ,@($_.DeviceID, $_.DeviceName, $_.DriverProviderName, $_.InfName) }
}
foreach ($r in $rows) {
  $loc = ''; $desc = ''
  try {
    $p = Get-ItemProperty ('HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\' + $r[0]) -ErrorAction Stop
    $loc = $p.LocationInformation; $desc = $p.DeviceDesc
  } catch {}
  ($r + $loc + $desc) -join '|'
}`;
const ENCODED = Buffer.from(QUERY, 'utf16le').toString('base64');
const SCAN_TIMEOUT = 45000;

const DS3 = '054C:0268';

function ds3Driver(rows) {
  const text = rows.map((r) => `${r.provider} ${r.inf} ${r.name} ${r.desc}`).join(' ');
  if (/nefarius|dshidmini|DS3 Compatible|mshidumdf/i.test(text)) return 'dshidmini';
  if (/scp|motioninjoy|libusb|winusb/i.test(text)) return 'scp';
  // Driver genérico da Microsoft: o controle aparece no Windows mas nunca envia os botões
  return 'generic';
}

// "Port_#0001.Hub_#0003" -> { port: 1, hub: 3 }
function usbPort(location) {
  const m = /Port_#(\d+)\.Hub_#(\d+)/i.exec(location || '');
  return m ? { port: Number(m[1]), hub: Number(m[2]) } : null;
}

function parse(stdout) {
  const groups = new Map();
  for (const line of stdout.split(/\r?\n/)) {
    const [id = '', name = '', provider = '', inf = '', location = '', desc = ''] = line.split('|');
    const m = /VID_([0-9A-F]{4})&PID_([0-9A-F]{4})/i.exec(id);
    if (!m) continue;
    const key = `${m[1]}:${m[2]}`.toUpperCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ id, name, provider, inf, location, desc });
  }

  const devices = [];
  for (const [key, rows] of groups) {
    const isDs3 = key === DS3;
    if (!isDs3 && !rows.some((r) => /IG_/i.test(r.id))) continue;
    const usbRows = rows.filter((r) => /^USB\\/i.test(r.id));
    // Um aparelho por nó USB (dois controles iguais = dois nós); sem nó USB é Bluetooth ou adaptador
    for (const usb of usbRows.length ? usbRows : [null]) {
      devices.push({
        type: isDs3 ? 'ps3' : 'xbox',
        name: isDs3 ? 'Controle de PS3' : (usb || rows[0]).name || 'Controle de Xbox',
        driver: isDs3 ? ds3Driver(rows) : 'xinput',
        usb: usb ? usbPort(usb.location) : null,
      });
    }
  }
  // Em modo XInput o DsHidMini cria um "controle de Xbox" virtual (sem nó USB) para o
  // mesmo controle de PS3; mostrar os dois faria parecer que há dois controles ligados.
  const ds3Driven = devices.some((d) => d.type === 'ps3' && d.driver === 'dshidmini');
  return ds3Driven ? devices.filter((d) => d.type === 'ps3' || d.usb) : devices;
}

// Olha quais controles o Windows enxerga, com qual driver e em qual porta USB.
function scan() {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', ENCODED],
      { windowsHide: true, timeout: SCAN_TIMEOUT },
      (error, stdout) => resolve(error ? { ok: false, devices: [] } : { ok: true, devices: parse(stdout) })
    );
  });
}

module.exports = { scan };
