import type { GridSquare, Bounds, EdgeLabelsVisibility, LabelPosition } from '../types';
import { getSquareName, getGridRows, getGridCols } from '../core/grid';

export interface GridPaintOptions {
  squares: GridSquare[];
  gridBounds: Bounds | null;
  projX: (lng: number) => number;
  projY: (lat: number) => number;
  canvasW: number;
  canvasH: number;

  gridSize: number;
  gridColor: string;
  gridWeight: number;
  startLetter: string;

  fontFamily: string;
  squareFontSize: number;
  edgeFontSize: number;
  showSquareNames: boolean;
  squareNamePosition: LabelPosition;
  showEdgeLabels: EdgeLabelsVisibility;

  labelColor: string;
  labelStroke: boolean;
  labelStrokeColor: string;

  /** When edge labels render outside the grid bounds (PNG: true; overlay: false — they sit inside the padding strip) */
  edgeLabelsOutside: boolean;
}

/**
 * Snap a stroke coordinate to the pixel grid so 1–2px lines render crisply.
 * Even line widths align to integer pixels; odd widths align to half-pixels.
 */
function snap(coord: number, lineWidth: number): number {
  const w = Math.round(lineWidth);
  return w % 2 === 1 ? Math.round(coord) + 0.5 : Math.round(coord);
}

export function drawGridOnCanvas(ctx: CanvasRenderingContext2D, opts: GridPaintOptions): void {
  const {
    squares, gridBounds, projX, projY, canvasW,
    gridSize, gridColor, gridWeight, startLetter,
    fontFamily, squareFontSize, edgeFontSize,
    showSquareNames, squareNamePosition, showEdgeLabels,
    labelColor, labelStroke, labelStrokeColor,
    edgeLabelsOutside,
  } = opts;

  if (squares.length === 0) return;

  const fontScale = canvasW / 1500;
  const lineWidth = Math.max(1, gridWeight * fontScale);
  const shadowColor = labelStroke ? labelStrokeColor : 'rgba(0,0,0,0.8)';

  // === Grid lines (snapped to pixel grid for crispness) ===
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = lineWidth;

  for (const sq of squares) {
    const x1 = snap(projX(sq.bounds.west), lineWidth);
    const y1 = snap(projY(sq.bounds.north), lineWidth);
    const x2 = snap(projX(sq.bounds.east), lineWidth);
    const y2 = snap(projY(sq.bounds.south), lineWidth);
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }

  // === Square name labels ===
  if (showSquareNames) {
    ctx.fillStyle = labelColor;
    const scaledFont = Math.round(squareFontSize * fontScale);
    const pad = 0.05; // 5% padding from cell edge

    for (const sq of squares) {
      if (sq.isSnail) continue;
      const text = sq.isScale ? `<${gridSize} м>` : sq.name;
      ctx.font = `bold ${scaledFont}px ${fontFamily}`;

      const b = sq.bounds;
      const pos = sq.isScale ? 'center' : squareNamePosition;
      const [vPos, hPos] = pos.includes('-') ? pos.split('-') : ['center', pos];

      const latR = b.north - b.south;
      const lngR = b.east - b.west;
      const latMap: Record<string, number> = {
        'top': b.north - latR * pad,
        'center': (b.north + b.south) / 2,
        'bottom': b.south + latR * pad,
      };
      const lngMap: Record<string, number> = {
        'left': b.west + lngR * pad,
        'center': (b.east + b.west) / 2,
        'right': b.east - lngR * pad,
      };

      const cx = projX(lngMap[hPos] ?? lngMap['center']);
      const cy = projY(latMap[vPos] ?? latMap['center']);

      ctx.textAlign = hPos === 'left' ? 'left' : hPos === 'right' ? 'right' : 'center';
      ctx.textBaseline = vPos === 'top' ? 'top' : vPos === 'bottom' ? 'bottom' : 'middle';

      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 3;
      ctx.fillText(text, cx, cy);
      ctx.shadowBlur = 0;
    }
  }

  // === Snail (A2) ===
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
    ctx.moveTo(snap(cx, lineWidth), snap(y1, lineWidth));
    ctx.lineTo(snap(cx, lineWidth), snap(y2, lineWidth));
    ctx.moveTo(snap(x1, lineWidth), snap(cy, lineWidth));
    ctx.lineTo(snap(x2, lineWidth), snap(cy, lineWidth));
    ctx.stroke();

    const snailFont = Math.round((squareFontSize + 5) * fontScale);
    ctx.font = `bold ${snailFont}px ${fontFamily}`;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 3;

    ctx.fillText('1', (x1 + cx) / 2, (y1 + cy) / 2);
    ctx.fillText('2', (x2 + cx) / 2, (y1 + cy) / 2);
    ctx.fillText('3', (x2 + cx) / 2, (y2 + cy) / 2);
    ctx.fillText('4', (x1 + cx) / 2, (y2 + cy) / 2);
    ctx.shadowBlur = 0;
  }

  // === Edge labels ===
  if (gridBounds) {
    const rows = getGridRows(squares);
    const cols = getGridCols(squares);
    const scaledEdge = Math.round(edgeFontSize * fontScale);
    ctx.font = `bold ${scaledEdge}px ${fontFamily}`;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 3;

    // Edge label position differs:
    // - PNG: outside grid bounds (canvas has buffer area around the grid)
    // - Overlay: small inset from canvas edge (overlay PNG itself is the grid + tiny pad)
    const insetPad = 15 * fontScale;
    const outsidePad = 15 * fontScale;

    const leftX = edgeLabelsOutside ? projX(gridBounds.west) - outsidePad : insetPad;
    const rightX = edgeLabelsOutside ? projX(gridBounds.east) + outsidePad : opts.canvasW - insetPad;
    const topY = edgeLabelsOutside ? projY(gridBounds.north) - outsidePad : insetPad;
    const bottomY = edgeLabelsOutside ? projY(gridBounds.south) + outsidePad : opts.canvasH - insetPad;

    for (const row of rows) {
      const sq = squares.find(s => s.row === row);
      if (!sq) continue;
      const letter = getSquareName(row, 0, startLetter).charAt(0);
      const y = projY((sq.bounds.north + sq.bounds.south) / 2);
      if (showEdgeLabels.left) ctx.fillText(letter, leftX, y);
      if (showEdgeLabels.right) ctx.fillText(letter, rightX, y);
    }

    for (const col of cols) {
      const sq = squares.find(s => s.col === col);
      if (!sq) continue;
      const num = String(col + 1);
      const x = projX((sq.bounds.east + sq.bounds.west) / 2);
      if (showEdgeLabels.top) ctx.fillText(num, x, topY);
      if (showEdgeLabels.bottom) ctx.fillText(num, x, bottomY);
    }

    ctx.shadowBlur = 0;
  }
}
