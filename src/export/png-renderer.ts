import type { Bounds } from '../types';
import { state } from '../core/state';
import { getTileUrl, getMapBounds } from '../core/map';
import { createProjection, bufferBounds, boundsSizeMeters, lngToMercatorX } from '../utils/geo';
import { getSquareName, getGridRows, getGridCols } from '../core/grid';
import { downloadBlob } from '../utils/download';
import { MARKER_COLORS, PNG_MAX_SIDE, PNG_MIN_SIDE, PNG_BUFFER_METERS } from '../constants';

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

  await loadTiles(ctx, proj);
  drawGrid(ctx, proj);
  drawMarkers(ctx, proj);

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
  const squares = state.get('gridSquares');
  if (squares.length === 0) return;

  const gridColor = state.get('gridColor');
  const gridWeight = state.get('gridWeight');
  const fontFamily = state.get('fontFamily');
  const sqFontSize = state.get('squareFontSize');
  const edgeFontSize = state.get('edgeFontSize');
  const showNames = state.get('showSquareNames');
  const showEdge = state.get('showEdgeLabels');
  const gridBounds = state.get('gridBounds');
  const gridSize = state.get('gridSize');
  const startLetter = state.get('startLetter');

  const fontScale = proj.canvasW / 1500;

  // Grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = Math.max(1, gridWeight);

  for (const sq of squares) {
    const x1 = proj.x(sq.bounds.west);
    const y1 = proj.y(sq.bounds.north);
    const x2 = proj.x(sq.bounds.east);
    const y2 = proj.y(sq.bounds.south);
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }

  // Labels
  if (showNames) {
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scaledFont = Math.round(sqFontSize * fontScale);

    for (const sq of squares) {
      if (sq.isSnail) continue;
      const text = sq.isScale ? `<${gridSize} м>` : sq.name;
      ctx.font = `bold ${scaledFont}px ${fontFamily}`;
      const cx = proj.x((sq.bounds.east + sq.bounds.west) / 2);
      const cy = proj.y((sq.bounds.north + sq.bounds.south) / 2);

      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(text, cx, cy);
      ctx.shadowBlur = 0;
    }
  }

  // Snail
  const snailSq = squares.find(s => s.isSnail);
  if (snailSq) {
    const b = snailSq.bounds;
    const cx = proj.x((b.east + b.west) / 2);
    const cy = proj.y((b.north + b.south) / 2);

    ctx.beginPath();
    ctx.moveTo(cx, proj.y(b.north)); ctx.lineTo(cx, proj.y(b.south));
    ctx.moveTo(proj.x(b.west), cy); ctx.lineTo(proj.x(b.east), cy);
    ctx.stroke();

    const snailFont = Math.round((sqFontSize + 5) * fontScale);
    ctx.font = `bold ${snailFont}px ${fontFamily}`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;

    const x1 = proj.x(b.west), x2 = proj.x(b.east);
    const y1 = proj.y(b.north), y2 = proj.y(b.south);
    ctx.fillText('1', (x1 + cx) / 2, (y1 + cy) / 2);
    ctx.fillText('2', (x2 + cx) / 2, (y1 + cy) / 2);
    ctx.fillText('3', (x2 + cx) / 2, (y2 + cy) / 2);
    ctx.fillText('4', (x1 + cx) / 2, (y2 + cy) / 2);
    ctx.shadowBlur = 0;
  }

  // Edge labels
  if (gridBounds) {
    const rows = getGridRows(squares);
    const cols = getGridCols(squares);
    const scaledEdge = Math.round(edgeFontSize * fontScale);
    ctx.font = `bold ${scaledEdge}px ${fontFamily}`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;

    const pad = 15 * fontScale;

    for (const row of rows) {
      const sq = squares.find(s => s.row === row);
      if (!sq) continue;
      const letter = getSquareName(row, 0, startLetter).charAt(0);
      const y = proj.y((sq.bounds.north + sq.bounds.south) / 2);
      if (showEdge.left) ctx.fillText(letter, proj.x(gridBounds.west) - pad, y);
      if (showEdge.right) ctx.fillText(letter, proj.x(gridBounds.east) + pad, y);
    }

    for (const col of cols) {
      const sq = squares.find(s => s.col === col);
      if (!sq) continue;
      const num = String(col + 1);
      const x = proj.x((sq.bounds.east + sq.bounds.west) / 2);
      if (showEdge.top) ctx.fillText(num, x, proj.y(gridBounds.north) - pad);
      if (showEdge.bottom) ctx.fillText(num, x, proj.y(gridBounds.south) + pad);
    }

    ctx.shadowBlur = 0;
  }
}

function drawMarkers(ctx: CanvasRenderingContext2D, proj: ReturnType<typeof createProjection>): void {
  const markers = state.get('markers');
  const showLabels = state.get('showPointLabels');
  const fontFamily = state.get('fontFamily');
  const fontSize = state.get('pointFontSize');
  const fontScale = proj.canvasW / 1500;

  for (const m of markers) {
    const x = proj.x(m.latlng.lng);
    const y = proj.y(m.latlng.lat);
    const color = MARKER_COLORS[m.type];
    const r = 6 * fontScale;

    // Circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    if (showLabels && m.name) {
      const scaledFont = Math.round(fontSize * fontScale);
      ctx.font = `${scaledFont}px ${fontFamily}`;
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(m.name, x, y - r - 3);
      ctx.shadowBlur = 0;
    }
  }
}
