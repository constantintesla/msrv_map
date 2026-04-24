// Однократный скрипт: скачивает курируемые иконки в public/icons/.
// Использование: node scripts/fetch-curated-icons.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Импорт ts-модуля прямо в node невозможен. Дублируем список здесь,
// либо читаем source TS и извлекаем URLы. Простой путь — продублировать.

const SHAPE_BASE = 'https://maps.google.com/mapfiles/kml/shapes/';
const PADDLE_BASE = 'https://maps.google.com/mapfiles/kml/paddle/';

const ICONS = [
  ['shape-flag',       `${SHAPE_BASE}flag.png`],
  ['shape-star',       `${SHAPE_BASE}star.png`],
  ['shape-triangle',   `${SHAPE_BASE}triangle.png`],
  ['shape-square',     `${SHAPE_BASE}square.png`],
  ['shape-diamond',    `${SHAPE_BASE}open-diamond.png`],
  ['shape-cross',      `${SHAPE_BASE}cross-hairs.png`],
  ['shape-target',     `${SHAPE_BASE}target.png`],
  ['shape-info',       `${SHAPE_BASE}info.png`],
  ['shape-caution',    `${SHAPE_BASE}caution.png`],
  ['shape-camera',     `${SHAPE_BASE}camera.png`],
  ['shape-parking',    `${SHAPE_BASE}parking_lot.png`],
  ['shape-picnic',     `${SHAPE_BASE}picnic.png`],
  ['shape-donut',      `${SHAPE_BASE}donut.png`],
  ['shape-polygon',    `${SHAPE_BASE}polygon.png`],
  ['shape-arrow',      `${SHAPE_BASE}arrow.png`],
  ['paddle-a',         `${PADDLE_BASE}A.png`],
  ['paddle-b',         `${PADDLE_BASE}B.png`],
  ['paddle-c',         `${PADDLE_BASE}C.png`],
  ['paddle-red-stars', `${PADDLE_BASE}red-stars.png`],
  ['paddle-blu-diam',  `${PADDLE_BASE}blu-diamond.png`],
  ['paddle-grn-circ',  `${PADDLE_BASE}grn-circle.png`],
  ['paddle-ylw-circ',  `${PADDLE_BASE}ylw-circle.png`],
  ['paddle-pink-blnk', `${PADDLE_BASE}pink-blank.png`],
  ['paddle-orange-blnk', `${PADDLE_BASE}orange-blank.png`],
];

const outDir = join(__dirname, '..', 'public', 'icons');
await mkdir(outDir, { recursive: true });

for (const [id, url] of ICONS) {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`FAIL ${id}: ${res.status} ${url}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(join(outDir, `${id}.png`), buf);
  console.log(`OK   ${id} (${buf.length} bytes)`);
}
