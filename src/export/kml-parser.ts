import type { MarkerData, MarkerType, GridSquare } from '../types';
import { MARKER_COLORS, MARKER_KML_ICONS } from '../constants';
import { parseXml } from '../utils/xml';
import { unpackKmz } from './kmz';
import { state } from '../core/state';
import { bus } from '../core/events';
import { computeGridBounds } from '../core/grid';

interface ParseResult {
  markers: MarkerData[];
  squares: GridSquare[];
  gridSize: number | null;
}

const GRID_NAME_PATTERN = /^[A-ZА-Я]{1,2}\d+$/;

/** Import KML/KMZ file */
export async function importFile(file: File): Promise<void> {
  let kmlContent: string;

  if (file.name.toLowerCase().endsWith('.kmz')) {
    kmlContent = await unpackKmz(file);
  } else {
    kmlContent = await file.text();
  }

  const result = parseKml(kmlContent);

  // Apply to state
  state.set('markers', result.markers);
  state.set('gridSquares', result.squares);
  state.set('gridBounds', computeGridBounds(result.squares));
  if (result.gridSize) state.set('gridSize', result.gridSize);

  bus.emit('project:loaded');
}

function parseKml(content: string): ParseResult {
  const doc = parseXml(content);
  const styleTypeMap = buildStyleTypeMap(doc);
  const markers: MarkerData[] = [];
  const squares: GridSquare[] = [];

  const placemarks = doc.querySelectorAll('Placemark');

  // First pass: collect grid squares (Polygons with grid-like names)
  const gridNames = new Set<string>();

  for (const pm of placemarks) {
    const name = pm.querySelector('name')?.textContent?.trim() ?? '';
    const polygon = pm.querySelector('Polygon');

    if (polygon && GRID_NAME_PATTERN.test(name)) {
      const coords = polygon.querySelector('coordinates')?.textContent?.trim();
      if (!coords) continue;

      const points = parseCoordinateList(coords);
      if (points.length < 4) continue;

      const lats = points.map(p => p.lat);
      const lngs = points.map(p => p.lng);

      const bounds = {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      };

      // Determine row/col from name
      const match = name.match(/^([A-ZА-Я]{1,2})(\d+)$/);
      if (!match) continue;

      const letter = match[1];
      const col = parseInt(match[2]) - 1;
      const row = letterToRow(letter);

      squares.push({
        row, col, name, bounds,
        isScale: row === 0 && col === 0,
        isSnail: row === 0 && col === 1,
      });

      gridNames.add(name);
    }
  }

  // Second pass: collect markers (Points that aren't grid labels)
  for (const pm of placemarks) {
    const name = pm.querySelector('name')?.textContent?.trim() ?? '';
    const point = pm.querySelector('Point');

    if (!point) continue;

    const coords = point.querySelector('coordinates')?.textContent?.trim();
    if (!coords) continue;

    // Skip grid square labels
    if (gridNames.has(name) || isSquareLabel(name)) continue;
    // Skip snail numbers
    if (/^[1-4]$/.test(name)) continue;

    const [lng, lat] = coords.split(',').map(Number);
    if (isNaN(lat) || isNaN(lng)) continue;

    const styleUrl = pm.querySelector('styleUrl')?.textContent?.trim() ?? '';
    const type = resolveMarkerType(pm, styleUrl, styleTypeMap);

    markers.push({
      id: crypto.randomUUID(),
      latlng: { lat, lng },
      type,
      name,
      description: pm.querySelector('description')?.textContent?.trim() ?? '',
    });
  }

  // Estimate grid size from squares
  let gridSize: number | null = null;
  if (squares.length >= 2) {
    const first = squares[0];
    gridSize = Math.round((first.bounds.north - first.bounds.south) * 111320);
  }

  return { markers, squares, gridSize };
}

function parseCoordinateList(coords: string): { lat: number; lng: number }[] {
  return coords.split(/\s+/).filter(Boolean).map(c => {
    const [lng, lat] = c.split(',').map(Number);
    return { lat, lng };
  });
}

function letterToRow(letter: string): number {
  const code = letter.charCodeAt(0);
  if (code >= 65 && code <= 90) return code - 65; // A-Z
  if (code >= 0x0410 && code <= 0x042F) return code - 0x0410; // А-Я
  return 0;
}

function isSquareLabel(name: string): boolean {
  if (GRID_NAME_PATTERN.test(name)) return true;
  if (/^<?\d+ м>?$/.test(name)) return true;
  return false;
}

function buildStyleTypeMap(doc: Document): Map<string, MarkerType> {
  const map = new Map<string, MarkerType>();

  doc.querySelectorAll('Style').forEach(style => {
    const id = style.getAttribute('id') ?? '';
    const href = style.querySelector('IconStyle Icon href')?.textContent ?? '';
    const color = style.querySelector('IconStyle color')?.textContent ?? '';

    // Match by icon URL
    for (const [type, iconUrl] of Object.entries(MARKER_KML_ICONS)) {
      if (href.includes(iconUrl) || href.includes(type)) {
        map.set(`#${id}`, type as MarkerType);
        return;
      }
    }

    // Match by color
    if (color) {
      const resolved = inferTypeByKmlColor(color);
      if (resolved) map.set(`#${id}`, resolved);
    }
  });

  return map;
}

function resolveMarkerType(pm: Element, styleUrl: string, styleMap: Map<string, MarkerType>): MarkerType {
  // 1. By style URL
  if (styleUrl && styleMap.has(styleUrl)) return styleMap.get(styleUrl)!;

  // 2. By inline icon
  const href = pm.querySelector('Style IconStyle Icon href')?.textContent ?? '';
  for (const [type, iconUrl] of Object.entries(MARKER_KML_ICONS)) {
    if (href.includes(iconUrl)) return type as MarkerType;
  }

  // 3. By name text
  const name = (pm.querySelector('name')?.textContent ?? '').toLowerCase();
  if (name.includes('опасн') || name.includes('danger')) return 'danger';
  if (name.includes('предупр') || name.includes('warn')) return 'warning';
  if (name.includes('кпп') || name.includes('checkpoint')) return 'checkpoint';
  if (name.includes('инфо') || name.includes('info')) return 'info';

  return 'default';
}

function inferTypeByKmlColor(kmlColor: string): MarkerType | null {
  if (kmlColor.length !== 8) return null;
  const r = kmlColor.slice(6, 8);
  const g = kmlColor.slice(4, 6);
  const b = kmlColor.slice(2, 4);
  const hex = `#${r}${g}${b}`.toUpperCase();

  for (const [type, color] of Object.entries(MARKER_COLORS)) {
    if (color.toUpperCase() === hex) return type as MarkerType;
  }
  return null;
}
