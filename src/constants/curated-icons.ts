export interface CuratedIcon {
  id: string;       // стабильный ключ и имя файла без расширения
  label: string;    // отображаемое имя в UI
  remoteUrl: string;// канонический URL на maps.google.com/mapfiles/...
  localUrl: string; // '/icons/<id>.png'
}

const SHAPE_BASE = 'https://maps.google.com/mapfiles/kml/shapes/';
const PADDLE_BASE = 'https://maps.google.com/mapfiles/kml/paddle/';

function curated(id: string, label: string, remotePath: string): CuratedIcon {
  return { id, label, remoteUrl: remotePath, localUrl: `/icons/${id}.png` };
}

function normalize(url: string): string {
  return url.replace(/^http:\/\//i, 'https://').split('?')[0];
}

export const CURATED_ICONS: CuratedIcon[] = [
  curated('shape-flag',       'Флаг',           `${SHAPE_BASE}flag.png`),
  curated('shape-star',       'Звезда',         `${SHAPE_BASE}star.png`),
  curated('shape-triangle',   'Треугольник',    `${SHAPE_BASE}triangle.png`),
  curated('shape-square',     'Квадрат',        `${SHAPE_BASE}square.png`),
  curated('shape-diamond',    'Ромб',           `${SHAPE_BASE}open-diamond.png`),
  curated('shape-cross',      'Прицел',         `${SHAPE_BASE}cross-hairs.png`),
  curated('shape-target',     'Мишень',         `${SHAPE_BASE}target.png`),
  curated('shape-info',       'Инфо',           `${SHAPE_BASE}info.png`),
  curated('shape-caution',    'Осторожно',      `${SHAPE_BASE}caution.png`),
  curated('shape-camera',     'Камера',         `${SHAPE_BASE}camera.png`),
  curated('shape-parking',    'Парковка',       `${SHAPE_BASE}parking_lot.png`),
  curated('shape-picnic',     'Пикник',         `${SHAPE_BASE}picnic.png`),
  curated('shape-donut',      'Бублик',         `${SHAPE_BASE}donut.png`),
  curated('shape-polygon',    'Полигон',        `${SHAPE_BASE}polygon.png`),
  curated('shape-arrow',      'Стрелка',        `${SHAPE_BASE}arrow.png`),
  curated('paddle-a',         'Бейдж A',        `${PADDLE_BASE}A.png`),
  curated('paddle-b',         'Бейдж B',        `${PADDLE_BASE}B.png`),
  curated('paddle-c',         'Бейдж C',        `${PADDLE_BASE}C.png`),
  curated('paddle-red-stars', 'Красная звезда', `${PADDLE_BASE}red-stars.png`),
  curated('paddle-blu-diam',  'Синий ромб',     `${PADDLE_BASE}blu-diamond.png`),
  curated('paddle-grn-circ',  'Зелёный круг',   `${PADDLE_BASE}grn-circle.png`),
  curated('paddle-ylw-circ',  'Жёлтый круг',    `${PADDLE_BASE}ylw-circle.png`),
  curated('paddle-pink-blnk', 'Розовый бейдж',  `${PADDLE_BASE}pink-blank.png`),
  curated('paddle-orange-blnk', 'Оранжевый бейдж', `${PADDLE_BASE}orange-blank.png`),
];

const REMOTE_BY_URL = new Map<string, CuratedIcon>();
const BY_FILENAME = new Map<string, CuratedIcon>();
for (const i of CURATED_ICONS) {
  const canonical = normalize(i.remoteUrl);
  REMOTE_BY_URL.set(canonical, i);
  BY_FILENAME.set(`${i.id}.png`, i);
  const mapfilesName = canonical.split('/').pop();
  if (mapfilesName) BY_FILENAME.set(mapfilesName, i);
}

export function resolveIconLocal(remoteUrl: string | undefined): string | undefined {
  if (!remoteUrl) return undefined;
  const found = REMOTE_BY_URL.get(normalize(remoteUrl));
  return found ? found.localUrl : remoteUrl;
}

export function findCuratedByUrl(remoteUrl: string | undefined): CuratedIcon | undefined {
  if (!remoteUrl) return undefined;
  return REMOTE_BY_URL.get(normalize(remoteUrl));
}

export function findCuratedByFilename(path: string): CuratedIcon | undefined {
  const base = path.split(/[/\\]/).pop();
  if (!base) return undefined;
  return BY_FILENAME.get(base);
}
