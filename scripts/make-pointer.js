// Gera a seta amarela usada como ponteiro do mouse, em duas versões de 46x46:
//   src/assets/cursor.png  - para o app, com a ponta perto do canto (como um cursor comum)
//   src/assets/pointer.png - para o menu do RetroArch, que desenha a imagem centrada no mouse,
//                            então a ponta fica no meio, como no ponteiro original dele
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 46;
const SAMPLES = 4;
const FILL = [255, 204, 51];
const EDGE = [26, 22, 48];
// Contorno da seta, com a ponta na origem
const ARROW = [[0, 0], [0, 27], [7, 21], [12, 32], [17, 30], [12, 19], [21, 19]];
let SHAPE = [];

function inside(x, y) {
  let hit = false;
  for (let i = 0, j = SHAPE.length - 1; i < SHAPE.length; j = i++) {
    const [xi, yi] = SHAPE[i];
    const [xj, yj] = SHAPE[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function edgeDistance(x, y) {
  let best = Infinity;
  for (let i = 0, j = SHAPE.length - 1; i < SHAPE.length; j = i++) {
    const [ax, ay] = SHAPE[j];
    const [bx, by] = SHAPE[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

function make(name, tip, scale, OUTLINE) {
SHAPE = ARROW.map(([x, y]) => [x * scale + tip[0], y * scale + tip[1]]);
// Uma linha por vez: byte de filtro 0 seguido de RGBA, com suavização por superamostragem
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let py = 0; py < SIZE; py++) {
  for (let px = 0; px < SIZE; px++) {
    let fill = 0;
    let edge = 0;
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        const x = px + (sx + 0.5) / SAMPLES;
        const y = py + (sy + 0.5) / SAMPLES;
        const near = edgeDistance(x, y) < OUTLINE;
        if (near) edge++;
        else if (inside(x, y)) fill++;
      }
    }
    const total = fill + edge;
    const at = py * (SIZE * 4 + 1) + 1 + px * 4;
    for (let c = 0; c < 3; c++) raw[at + c] = total ? Math.round((FILL[c] * fill + EDGE[c] * edge) / total) : 0;
    raw[at + 3] = Math.round((255 * total) / (SAMPLES * SAMPLES));
  }
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header.set([8, 6, 0, 0, 0], 8); // 8 bits por canal, RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.resolve(__dirname, '..', 'src', 'assets', name);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('ponteiro gerado em', out);
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(zlib.crc32(body), body.length + 4);
  return out;
}

make('cursor.png', [4, 3], 0.8, 1.6);
make('pointer.png', [23, 23], 0.62, 1.4);
