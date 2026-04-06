import type { GridSquare, Bounds } from '../types';
import { state } from '../core/state';
import { getSquareName, getGridRows, getGridCols } from '../core/grid';
import { GRID_OVERLAY_SIZE } from '../constants';

/** Render grid overlay on transparent canvas, return PNG blob */
export async function renderGridOverlay(
  squares: GridSquare[],
  gridBounds: Bounds,
): Promise<Blob> {
  const gridSize = state.get('gridSize');
  const gridColor = state.get('gridColor');
  const gridWeight = state.get('gridWeight');
  const fontFamily = state.get('fontFamily');
  const sqFontSize = state.get('squareFontSize');
  const edgeFontSize = state.get('edgeFontSize');
  const showNames = state.get('showSquareNames');
  const showEdge = state.get('showEdgeLabels');
  const startLetter = state.get('startLetter');

  // Canvas dimensions proportional to bounds
  const latRange = gridBounds.north - gridBounds.south;
  const lngRange = gridBounds.east - gridBounds.west;
  const aspectRatio = lngRange / latRange;

  let width: number, height: number;
  if (aspectRatio >= 1) {
    width = GRID_OVERLAY_SIZE;
    height = Math.round(GRID_OVERLAY_SIZE / aspectRatio);
  } else {
    height = GRID_OVERLAY_SIZE;
    width = Math.round(GRID_OVERLAY_SIZE * aspectRatio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Simple linear projection (good enough for grid-scale areas)
  const projX = (lng: number) => ((lng - gridBounds.west) / lngRange) * width;
  const projY = (lat: number) => ((gridBounds.north - lat) / latRange) * height;

  // Draw grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = Math.max(1, gridWeight);

  for (const sq of squares) {
    const b = sq.bounds;
    const x1 = projX(b.west);
    const y1 = projY(b.north);
    const x2 = projX(b.east);
    const y2 = projY(b.south);
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }

  // Draw square labels
  if (showNames) {
    ctx.fillStyle = 'white';
    ctx.textBaseline = 'middle';
    const scaledFontSize = Math.round(sqFontSize * (width / 1000));

    for (const sq of squares) {
      if (sq.isSnail) continue;
      const text = sq.isScale ? `<${gridSize} м>` : sq.name;
      ctx.font = `bold ${scaledFontSize}px ${fontFamily}`;
      const cx = projX((sq.bounds.east + sq.bounds.west) / 2);
      const cy = projY((sq.bounds.north + sq.bounds.south) / 2);
      ctx.textAlign = 'center';
      ctx.fillText(text, cx, cy);
    }
  }

  // Draw snail in A2
  const snailSq = squares.find(s => s.isSnail);
  if (snailSq) {
    const b = snailSq.bounds;
    const cx = projX((b.east + b.west) / 2);
    const cy = projY((b.north + b.south) / 2);
    const x1 = projX(b.west);
    const x2 = projX(b.east);
    const y1 = projY(b.north);
    const y2 = projY(b.south);

    ctx.beginPath();
    ctx.moveTo(cx, y1); ctx.lineTo(cx, y2);
    ctx.moveTo(x1, cy); ctx.lineTo(x2, cy);
    ctx.stroke();

    const snailFontSize = Math.round((sqFontSize + 5) * (width / 1000));
    ctx.font = `bold ${snailFontSize}px ${fontFamily}`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText('1', (x1 + cx) / 2, (y1 + cy) / 2);
    ctx.fillText('2', (x2 + cx) / 2, (y1 + cy) / 2);
    ctx.fillText('3', (x2 + cx) / 2, (y2 + cy) / 2);
    ctx.fillText('4', (x1 + cx) / 2, (y2 + cy) / 2);
  }

  // Draw edge labels
  const rows = getGridRows(squares);
  const cols = getGridCols(squares);
  const scaledEdgeFont = Math.round(edgeFontSize * (width / 1000));
  ctx.font = `bold ${scaledEdgeFont}px ${fontFamily}`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const edgeOffset = width * 0.02;

  for (const row of rows) {
    const sq = squares.find(s => s.row === row);
    if (!sq) continue;
    const letter = getSquareName(row, 0, startLetter).charAt(0);
    const y = projY((sq.bounds.north + sq.bounds.south) / 2);
    if (showEdge.left) ctx.fillText(letter, edgeOffset, y);
    if (showEdge.right) ctx.fillText(letter, width - edgeOffset, y);
  }

  for (const col of cols) {
    const sq = squares.find(s => s.col === col);
    if (!sq) continue;
    const num = String(col + 1);
    const x = projX((sq.bounds.east + sq.bounds.west) / 2);
    if (showEdge.top) ctx.fillText(num, x, edgeOffset);
    if (showEdge.bottom) ctx.fillText(num, x, height - edgeOffset);
  }

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}
