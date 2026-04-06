import L from 'leaflet';
import type { GridSquare, Bounds } from '../types';
import { state } from './state';
import { bus } from './events';
import { getMap } from './map';
import {
  generateGridSquares,
  computeGridBounds,
  shiftSquares,
  getGridRows,
  getGridCols,
  getSquareName,
} from './grid';
import { metersToDegreesLat, metersToDegreesLng } from '../utils/geo';

// Visual layers — separate from data
const gridPolygons: L.Polygon[] = [];
const gridLabels: L.Marker[] = [];
const snailElements: L.Layer[] = [];
const edgeLabelMarkers: L.Marker[] = [];

/** Clear all visual grid layers from map */
function clearVisuals(): void {
  const map = getMap();
  gridPolygons.forEach(p => map.removeLayer(p));
  gridLabels.forEach(l => map.removeLayer(l));
  snailElements.forEach(l => map.removeLayer(l));
  edgeLabelMarkers.forEach(l => map.removeLayer(l));
  gridPolygons.length = 0;
  gridLabels.length = 0;
  snailElements.length = 0;
  edgeLabelMarkers.length = 0;
}

/** Render grid polygons on map */
function renderPolygons(squares: GridSquare[]): void {
  const map = getMap();
  const color = state.get('gridColor');
  const weight = state.get('gridWeight');

  for (const sq of squares) {
    const b = sq.bounds;
    const polygon = L.polygon([
      [b.north, b.west],
      [b.north, b.east],
      [b.south, b.east],
      [b.south, b.west],
    ], {
      color,
      weight,
      fill: false,
      interactive: false,
    });
    polygon.addTo(map);
    gridPolygons.push(polygon);
  }
}

/** Render square labels (names, A1 scale, skip A2) */
function renderSquareLabels(squares: GridSquare[]): void {
  if (!state.get('showSquareNames')) return;
  const map = getMap();
  const fontFamily = state.get('fontFamily');
  const fontSize = state.get('squareFontSize');
  const gridSize = state.get('gridSize');
  const position = state.get('squareNamePosition');

  for (const sq of squares) {
    if (sq.isSnail) continue; // A2 — no text label

    const labelText = sq.isScale ? `<${gridSize} м>` : sq.name;
    const latlng = getLabelPosition(sq.bounds, position, sq.isScale);

    const icon = L.divIcon({
      className: 'grid-label',
      html: `<div style="
        font-size:${fontSize}px;
        font-weight:bold;
        color:white;
        font-family:${fontFamily};
        pointer-events:none;
        user-select:none;
        white-space:nowrap;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      ">${labelText}</div>`,
      iconSize: [80, 20],
      iconAnchor: getAnchor(position, sq.isScale),
    });

    const marker = L.marker(latlng, { icon, interactive: false, zIndexOffset: 1000 });
    marker.addTo(map);
    gridLabels.push(marker);
  }
}

function getLabelPosition(b: Bounds, pos: string, isScale: boolean): [number, number] {
  if (isScale) {
    return [(b.north + b.south) / 2, (b.east + b.west) / 2];
  }
  const pad = 0.05; // 5% padding
  const latRange = b.north - b.south;
  const lngRange = b.east - b.west;

  const latMap: Record<string, number> = {
    'top': b.north - latRange * pad,
    'center': (b.north + b.south) / 2,
    'bottom': b.south + latRange * pad,
  };
  const lngMap: Record<string, number> = {
    'left': b.west + lngRange * pad,
    'center': (b.east + b.west) / 2,
    'right': b.east - lngRange * pad,
  };

  const [vPos, hPos] = pos.includes('-') ? pos.split('-') : ['center', pos];
  return [latMap[vPos] ?? latMap['center'], lngMap[hPos] ?? lngMap['center']];
}

function getAnchor(pos: string, isScale: boolean): [number, number] {
  if (isScale) return [40, 10];
  const anchorMap: Record<string, [number, number]> = {
    'top-left': [0, 0],
    'top-center': [40, 0],
    'top-right': [80, 0],
    'center-left': [0, 10],
    'center': [40, 10],
    'center-right': [80, 10],
    'bottom-left': [0, 20],
    'bottom-center': [40, 20],
    'bottom-right': [80, 20],
  };
  return anchorMap[pos] ?? [80, 20];
}

/** Render snail (cross + numbers 1-4) in A2 */
function renderSnail(sq: GridSquare): void {
  const map = getMap();
  const b = sq.bounds;
  const centerLat = (b.north + b.south) / 2;
  const centerLng = (b.east + b.west) / 2;
  const color = state.get('gridColor');
  const weight = state.get('gridWeight');
  const fontFamily = state.get('fontFamily');
  const fontSize = state.get('squareFontSize') + 5;

  // Vertical line
  const vLine = L.polyline([[b.north, centerLng], [b.south, centerLng]], {
    color, weight, opacity: 0.8, interactive: false,
  });
  vLine.addTo(map);
  snailElements.push(vLine);

  // Horizontal line
  const hLine = L.polyline([[centerLat, b.west], [centerLat, b.east]], {
    color, weight, opacity: 0.8, interactive: false,
  });
  hLine.addTo(map);
  snailElements.push(hLine);

  // Numbers: 1=NW, 2=NE, 3=SE, 4=SW
  const parts = [
    { n: '1', lat: (b.north + centerLat) / 2, lng: (b.west + centerLng) / 2 },
    { n: '2', lat: (b.north + centerLat) / 2, lng: (b.east + centerLng) / 2 },
    { n: '3', lat: (b.south + centerLat) / 2, lng: (b.east + centerLng) / 2 },
    { n: '4', lat: (b.south + centerLat) / 2, lng: (b.west + centerLng) / 2 },
  ];

  for (const p of parts) {
    const icon = L.divIcon({
      className: 'snail-label',
      html: `<div style="
        font-size:${fontSize}px;
        font-weight:bold;
        color:white;
        font-family:${fontFamily};
        text-align:center;
        pointer-events:none;
        user-select:none;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      ">${p.n}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    const marker = L.marker([p.lat, p.lng], { icon, interactive: false, zIndexOffset: 1001 });
    marker.addTo(map);
    snailElements.push(marker);
  }
}

/** Render edge labels (letters on sides, numbers on top/bottom) */
function renderEdgeLabels(squares: GridSquare[]): void {
  const map = getMap();
  const gridBounds = state.get('gridBounds');
  if (!gridBounds || squares.length === 0) return;

  const show = state.get('showEdgeLabels');
  const fontFamily = state.get('fontFamily');
  const fontSize = state.get('edgeFontSize');
  const startLetter = state.get('startLetter');
  const gridSize = state.get('gridSize');

  const rows = getGridRows(squares);
  const cols = getGridCols(squares);
  const centerLat = (gridBounds.north + gridBounds.south) / 2;
  const offsetLat = metersToDegreesLat(gridSize * 0.08);
  const offsetLng = metersToDegreesLng(gridSize * 0.08, centerLat);

  function addLabel(lat: number, lng: number, text: string) {
    const icon = L.divIcon({
      className: 'edge-label',
      html: `<div style="
        font-size:${fontSize}px;
        font-weight:bold;
        color:white;
        font-family:${fontFamily};
        text-align:center;
        pointer-events:none;
        user-select:none;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      ">${text}</div>`,
      iconSize: [30, 20],
      iconAnchor: [15, 10],
    });
    const marker = L.marker([lat, lng], { icon, interactive: false, zIndexOffset: 999 });
    marker.addTo(map);
    edgeLabelMarkers.push(marker);
  }

  // Left / Right — letters
  for (const row of rows) {
    const sq = squares.find(s => s.row === row);
    if (!sq) continue;
    const letter = getSquareName(row, 0, startLetter).charAt(0);
    const lat = (sq.bounds.north + sq.bounds.south) / 2;

    if (show.left) addLabel(lat, gridBounds.west - offsetLng, letter);
    if (show.right) addLabel(lat, gridBounds.east + offsetLng, letter);
  }

  // Top / Bottom — numbers
  for (const col of cols) {
    const sq = squares.find(s => s.col === col);
    if (!sq) continue;
    const num = String(col + 1);
    const lng = (sq.bounds.east + sq.bounds.west) / 2;

    if (show.top) addLabel(gridBounds.north + offsetLat, lng, num);
    if (show.bottom) addLabel(gridBounds.south - offsetLat, lng, num);
  }
}

/** Full render: generate grid, update state, render on map */
export function createGrid(): void {
  clearVisuals();

  const zone = state.get('selectedZone') ?? (() => {
    const map = getMap();
    const b = map.getBounds();
    return { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };
  })();

  const squares = generateGridSquares(zone, state.get('gridSize'), state.get('startLetter'));
  if (squares.length === 0) {
    alert('Зона слишком мала для создания сетки. Увеличьте зону или уменьшите размер ячейки.');
    return;
  }

  const gridBounds = computeGridBounds(squares);

  state.patch({ gridSquares: squares, gridBounds });
  renderAll(squares);
  bus.emit('grid:created', { squares });
}

/** Render everything from current state */
export function renderAll(squares?: GridSquare[]): void {
  clearVisuals();
  const sq = squares ?? state.get('gridSquares');
  if (sq.length === 0) return;

  renderPolygons(sq);
  renderSquareLabels(sq);
  renderEdgeLabels(sq);

  const snailSquare = sq.find(s => s.isSnail);
  if (snailSquare) renderSnail(snailSquare);
}

/** Clear grid data and visuals */
export function clearGrid(): void {
  clearVisuals();
  state.patch({ gridSquares: [], gridBounds: null });
  bus.emit('grid:cleared');
}

/** Shift grid in direction */
export function shiftGrid(direction: 'up' | 'down' | 'left' | 'right'): void {
  const squares = state.get('gridSquares');
  if (squares.length === 0) return;

  const shifted = shiftSquares(squares, direction, state.get('gridShiftStep'));
  const newBounds = computeGridBounds(shifted);

  // Also shift selectedZone if exists
  const zone = state.get('selectedZone');
  if (zone) {
    const dummyShifted = shiftSquares(
      [{ row: 0, col: 0, name: '', bounds: zone, isScale: false, isSnail: false }],
      direction,
      state.get('gridShiftStep'),
    );
    state.set('selectedZone', dummyShifted[0].bounds);
  }

  state.patch({ gridSquares: shifted, gridBounds: newBounds });
  renderAll(shifted);
  bus.emit('grid:shifted', { direction });
}

/** Refresh visuals after style change */
export function refreshGrid(): void {
  renderAll();
}

// Listen for style changes
bus.on('grid:style-changed', refreshGrid);
bus.on('grid:display-changed', refreshGrid);
