import type { Bounds } from '../types';
import { state } from '../core/state';
import { getTileUrl, getMapBounds } from '../core/map';
import { createProjection, bufferBounds, boundsSizeMeters, lngToMercatorX } from '../utils/geo';
import { downloadBlob } from '../utils/download';
import { MARKER_COLORS, PNG_MAX_SIDE, PNG_MIN_SIDE, PNG_BUFFER_METERS } from '../constants';
import { resolveIconLocal } from '../constants/curated-icons';
import { drawGridOnCanvas } from './grid-painter';

/** Get recommended zoom for a given zone mode */
export function getRecommendedZoom(zoneMode: string): number {
  const bounds = getExportBounds(zoneMode);
  if (!bounds) return 16;
  return pickZoom(bounds, PNG_MAX_SIDE);
}

/** Render map to a canvas and return it */
export async function renderToCanvas(zoneMode: string, zoomOverride?: number, maxSide?: number): Promise<HTMLCanvasElement | null> {
  const bounds = getExportBounds(zoneMode);
  if (!bounds) return null;

  const [widthM, heightM] = boundsSizeMeters(bounds);
  const aspect = widthM / heightM;
  const max = maxSide ?? PNG_MAX_SIDE;
  const min = maxSide ? Math.round(max / 3) : PNG_MIN_SIDE;

  let canvasW: number, canvasH: number;
  if (aspect >= 1) {
    canvasW = max;
    canvasH = Math.max(min, Math.round(max / aspect));
  } else {
    canvasH = max;
    canvasW = Math.max(min, Math.round(max * aspect));
  }

  const zoom = zoomOverride
    ? Math.round(zoomOverride)
    : pickZoom(bounds, canvasW);

  const proj = createProjection(bounds, canvasW, canvasH, zoom);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  await loadTiles(ctx, proj);
  drawGrid(ctx, proj);
  const iconCache = await preloadMarkerIcons();
  drawMarkers(ctx, proj, iconCache);

  return canvas;
}

/** Export high-res PNG */
export async function exportPng(zoneMode: string, zoomOverride?: number): Promise<void> {
  const canvas = await renderToCanvas(zoneMode, zoomOverride);
  if (!canvas) {
    alert('Нет данных для экспорта.');
    return;
  }

  canvas.toBlob(blob => {
    if (blob) downloadBlob(blob, 'map.png');
  }, 'image/png');
}

function getExportBounds(mode: string): Bounds | null {
  const gridBounds = state.get('gridBounds');
  const zone = state.get('selectedZone');

  switch (mode) {
    case 'grid':
      return gridBounds ? bufferBounds(gridBounds, PNG_BUFFER_METERS) : null;
    case 'zone':
      return zone ? bufferBounds(zone, PNG_BUFFER_METERS) : null;
    case 'screen':
      return getMapBounds();
    default:
      return gridBounds ? bufferBounds(gridBounds, PNG_BUFFER_METERS) : getMapBounds();
  }
}

function pickZoom(bounds: Bounds, canvasW: number): number {
  for (let z = 18; z >= 1; z--) {
    const xMin = lngToMercatorX(bounds.west, z);
    const xMax = lngToMercatorX(bounds.east, z);
    const tilePixels = xMax - xMin;
    if (tilePixels >= canvasW) return z;
  }
  return 14;
}

async function loadTiles(ctx: CanvasRenderingContext2D, proj: ReturnType<typeof createProjection>): Promise<void> {
  const tileSize = 256;
  const totalTiles = Math.pow(2, proj.zoom);
  const tileXMin = Math.max(0, Math.floor(proj.xMin / tileSize));
  const tileXMax = Math.min(totalTiles - 1, Math.floor(proj.xMax / tileSize));
  const tileYMin = Math.max(0, Math.floor(proj.yMin / tileSize));
  const tileYMax = Math.min(totalTiles - 1, Math.floor(proj.yMax / tileSize));

  const loadImage = (url: string): Promise<HTMLImageElement | null> =>
    new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });

  const promises: Promise<{ img: HTMLImageElement | null; tx: number; ty: number }>[] = [];

  for (let tx = tileXMin; tx <= tileXMax; tx++) {
    for (let ty = tileYMin; ty <= tileYMax; ty++) {
      const url = getTileUrl(tx, ty, proj.zoom);
      if (!url) continue;
      promises.push(loadImage(url).then(img => ({ img, tx, ty })));
    }
  }

  const results = await Promise.all(promises);
  for (const { img, tx, ty } of results) {
    if (!img) continue;
    const globalX = tx * tileSize;
    const globalY = ty * tileSize;
    const canvasX = (globalX - proj.xMin) / (proj.xMax - proj.xMin) * proj.canvasW;
    const canvasY = (globalY - proj.yMin) / (proj.yMax - proj.yMin) * proj.canvasH;
    const drawW = tileSize / (proj.xMax - proj.xMin) * proj.canvasW;
    const drawH = tileSize / (proj.yMax - proj.yMin) * proj.canvasH;
    ctx.drawImage(img, canvasX, canvasY, drawW, drawH);
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, proj: ReturnType<typeof createProjection>): void {
  drawGridOnCanvas(ctx, {
    squares: state.get('gridSquares'),
    gridBounds: state.get('gridBounds'),
    projX: proj.x,
    projY: proj.y,
    canvasW: proj.canvasW,
    canvasH: proj.canvasH,
    gridSize: state.get('gridSize'),
    gridColor: state.get('gridColor'),
    gridWeight: state.get('gridWeight'),
    startLetter: state.get('startLetter'),
    fontFamily: state.get('fontFamily'),
    squareFontSize: state.get('squareFontSize'),
    edgeFontSize: state.get('edgeFontSize'),
    showSquareNames: state.get('showSquareNames'),
    squareNamePosition: state.get('squareNamePosition'),
    showEdgeLabels: state.get('showEdgeLabels'),
    labelColor: state.get('labelColor'),
    labelStroke: state.get('labelStroke'),
    labelStrokeColor: state.get('labelStrokeColor'),
    edgeLabelsOutside: true,
  });
}

const ICON_LOAD_TIMEOUT_MS = 3000;

async function loadIconImage(url: string): Promise<HTMLImageElement | null> {
  const localOrRemote = resolveIconLocal(url) ?? url;
  const isLocal = localOrRemote.startsWith('/');

  if (isLocal) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = localOrRemote;
    });
  }

  // Кастомный URL — пробуем fetch → blob → objectURL.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ICON_LOAD_TIMEOUT_MS);
    const res = await fetch(localOrRemote, { signal: controller.signal, mode: 'cors' });
    clearTimeout(timer);
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    return await new Promise(resolve => {
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
      img.src = objectUrl;
    });
  } catch {
    return null;
  }
}

async function preloadMarkerIcons(): Promise<Map<string, HTMLImageElement>> {
  const markers = state.get('markers');
  const urls = Array.from(new Set(markers.map(m => m.icon).filter((x): x is string => !!x)));
  const entries = await Promise.all(urls.map(async url => [url, await loadIconImage(url)] as const));
  const cache = new Map<string, HTMLImageElement>();
  for (const [url, img] of entries) {
    if (img) cache.set(url, img);
  }
  return cache;
}

function drawMarkers(
  ctx: CanvasRenderingContext2D,
  proj: ReturnType<typeof createProjection>,
  iconCache: Map<string, HTMLImageElement>,
): void {
  const markers = state.get('markers');
  const showLabels = state.get('showPointLabels');
  const fontFamily = state.get('fontFamily');
  const fontSize = state.get('pointFontSize');
  const fontScale = proj.canvasW / 1500;

  for (const m of markers) {
    const x = proj.x(m.latlng.lng);
    const y = proj.y(m.latlng.lat);
    const img = m.icon ? iconCache.get(m.icon) : undefined;

    let labelBaselineY: number;

    if (img) {
      const size = 32 * fontScale;
      ctx.drawImage(img, x - size / 2, y - size, size, size);
      labelBaselineY = y - size - 3;
    } else {
      const color = m.color ?? MARKER_COLORS[m.type] ?? MARKER_COLORS.default;
      const r = 6 * fontScale;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
      labelBaselineY = y - r - 3;
    }

    if (showLabels && m.name) {
      const scaledFont = Math.round(fontSize * fontScale);
      ctx.font = `${scaledFont}px ${fontFamily}`;
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(m.name, x, labelBaselineY);
      ctx.shadowBlur = 0;
    }
  }
}
