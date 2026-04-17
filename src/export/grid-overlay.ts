import type { GridSquare, Bounds } from '../types';
import { state } from '../core/state';
import { GRID_OVERLAY_SIZE } from '../constants';
import { drawGridOnCanvas } from './grid-painter';

/** Render grid overlay on transparent canvas, return PNG blob */
export async function renderGridOverlay(
  squares: GridSquare[],
  gridBounds: Bounds,
): Promise<Blob> {
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

  // Linear lat/lng projection — KML GroundOverlay places the image as a
  // lat/lng rectangle, so we deliberately do NOT use Mercator here.
  const projX = (lng: number) => ((lng - gridBounds.west) / lngRange) * width;
  const projY = (lat: number) => ((gridBounds.north - lat) / latRange) * height;

  drawGridOnCanvas(ctx, {
    squares,
    gridBounds,
    projX,
    projY,
    canvasW: width,
    canvasH: height,
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
    // Overlay PNG includes a small padding strip; edge labels sit inside it
    edgeLabelsOutside: false,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}
