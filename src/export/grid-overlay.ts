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
  const namePosition = state.get('squareNamePosition');
  const showEdge = state.get('showEdgeLabels');
  const startLetter = state.get('startLetter');
  const labelColor = state.get('labelColor');
  const labelStroke = state.get('labelStroke');
  const labelStrokeColor = state.get('labelStrokeColor');

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

  const fontScale = width / 1000;

  // Simple linear projection
  const projX = (lng: number) => ((lng - gridBounds.west) / lngRange) * width;
  const projY = (lat: number) => ((gridBounds.north - lat) / latRange) * height;

  // Helper: configure text shadow (stroke effect)
  function setupTextShadow() {
    if (labelStroke) {
      ctx.shadowColor = labelStrokeColor;
      ctx.shadowBlur = 3;
    }
  }
  function clearTextShadow() {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

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
    ctx.fillStyle = labelColor;
    const scaledFontSize = Math.round(sqFontSize * fontScale);
    const pad = 0.05;

    for (const sq of squares) {
      if (sq.isSnail) continue;
      const text = sq.isScale ? `<${gridSize} м>` : sq.name;
      ctx.font = `bold ${scaledFontSize}px ${fontFamily}`;

      const b = sq.bounds;
      const pos = sq.isScale ? 'center' : namePosition;
      const [vPos, hPos] = pos.includes('-') ? pos.split('-') : ['center', pos];

      const latR = b.north - b.south;
      const lngR = b.east - b.west;
      const latMap: Record<string, number> = {
        'top': b.north - latR * pad, 'center': (b.north + b.south) / 2, 'bottom': b.south + latR * pad,
      };
      const lngMap: Record<string, number> = {
        'left': b.west + lngR * pad, 'center': (b.east + b.west) / 2, 'right': b.east - lngR * pad,
      };

      const cx = projX(lngMap[hPos] ?? lngMap['center']);
      const cy = projY(latMap[vPos] ?? latMap['center']);

      ctx.textAlign = hPos === 'left' ? 'left' : hPos === 'right' ? 'right' : 'center';
      ctx.textBaseline = vPos === 'top' ? 'top' : vPos === 'bottom' ? 'bottom' : 'middle';

      setupTextShadow();
      ctx.fillText(text, cx, cy);
      clearTextShadow();
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

    const snailFontSize = Math.round((sqFontSize + 5) * fontScale);
    ctx.font = `bold ${snailFontSize}px ${fontFamily}`;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    setupTextShadow();
    ctx.fillText('1', (x1 + cx) / 2, (y1 + cy) / 2);
    ctx.fillText('2', (x2 + cx) / 2, (y1 + cy) / 2);
    ctx.fillText('3', (x2 + cx) / 2, (y2 + cy) / 2);
    ctx.fillText('4', (x1 + cx) / 2, (y2 + cy) / 2);
    clearTextShadow();
  }

  // Draw edge labels
  const rows = getGridRows(squares);
  const cols = getGridCols(squares);
  const scaledEdgeFont = Math.round(edgeFontSize * fontScale);
  ctx.font = `bold ${scaledEdgeFont}px ${fontFamily}`;
  ctx.fillStyle = labelColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const edgePad = 15 * fontScale;

  setupTextShadow();

  for (const row of rows) {
    const sq = squares.find(s => s.row === row);
    if (!sq) continue;
    const letter = getSquareName(row, 0, startLetter).charAt(0);
    const y = projY((sq.bounds.north + sq.bounds.south) / 2);
    if (showEdge.left) ctx.fillText(letter, edgePad, y);
    if (showEdge.right) ctx.fillText(letter, width - edgePad, y);
  }

  for (const col of cols) {
    const sq = squares.find(s => s.col === col);
    if (!sq) continue;
    const num = String(col + 1);
    const x = projX((sq.bounds.east + sq.bounds.west) / 2);
    if (showEdge.top) ctx.fillText(num, x, edgePad);
    if (showEdge.bottom) ctx.fillText(num, x, height - edgePad);
  }

  clearTextShadow();

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}
