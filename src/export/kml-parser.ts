import type { MarkerData, MarkerType, GridSquare } from '../types';
import { MARKER_COLORS, MARKER_KML_ICONS } from '../constants';
import { findCuratedByUrl, findCuratedByFilename } from '../constants/curated-icons';
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

interface StyleInfo {
  type: MarkerType;
  iconHref: string | null;  // сырой href, как в KML
  kmlColor: string | null;  // AABBGGRR, как в KML
}

interface MarkerInfo {
  type: MarkerType;
  icon?: string;
  color?: string;
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

    const styleUrl = pm.querySelector('styleUrl')?.textContent?.trim() ?? '';

    // Skip grid/edge label placemarks (by style or name pattern)
    if (isGridLabelStyle(styleUrl)) continue;
    if (gridNames.has(name) || isSquareLabel(name)) continue;

    const [lng, lat] = coords.split(',').map(Number);
    if (isNaN(lat) || isNaN(lng)) continue;

    const resolved = resolveMarkerInfo(pm, styleUrl, styleTypeMap);

    markers.push({
      id: crypto.randomUUID(),
      latlng: { lat, lng },
      type: resolved.type,
      name,
      description: pm.querySelector('description')?.textContent?.trim() ?? '',
      icon: resolved.icon,
      color: resolved.color,
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
  // Single letter (Latin or Cyrillic) — edge label
  if (/^[A-ZА-Яa-zа-я]$/.test(name)) return true;
  // Single number — edge label or snail
  if (/^\d+$/.test(name)) return true;
  return false;
}

function isGridLabelStyle(styleUrl: string): boolean {
  return styleUrl === '#squareLabelStyle' || styleUrl === '#edgeLabelStyle';
}

function buildStyleTypeMap(doc: Document): Map<string, StyleInfo> {
  const map = new Map<string, StyleInfo>();

  doc.querySelectorAll('Style').forEach(style => {
    const id = style.getAttribute('id') ?? '';
    const href = style.querySelector('IconStyle Icon href')?.textContent ?? '';
    const kmlColor = style.querySelector('IconStyle color')?.textContent ?? null;

    let type: MarkerType | null = null;

    for (const [t, iconUrl] of Object.entries(MARKER_KML_ICONS)) {
      if (href.includes(iconUrl) || href.includes(t)) {
        type = t as MarkerType;
        break;
      }
    }

    if (!type && kmlColor) {
      type = inferTypeByKmlColor(kmlColor);
    }

    map.set(`#${id}`, {
      type: type ?? 'default',
      iconHref: href || null,
      kmlColor,
    });
  });

  return map;
}

function resolveMarkerInfo(pm: Element, styleUrl: string, styleMap: Map<string, StyleInfo>): MarkerInfo {
  // Собираем href/color из styleUrl, либо inline.
  let info: StyleInfo = { type: 'default', iconHref: null, kmlColor: null };
  if (styleUrl && styleMap.has(styleUrl)) {
    info = styleMap.get(styleUrl)!;
  } else {
    const inlineHref = pm.querySelector('Style IconStyle Icon href')?.textContent ?? '';
    const inlineColor = pm.querySelector('Style IconStyle color')?.textContent ?? null;
    if (inlineHref || inlineColor) {
      info = { type: 'default', iconHref: inlineHref || null, kmlColor: inlineColor };
      for (const [t, iconUrl] of Object.entries(MARKER_KML_ICONS)) {
        if (inlineHref.includes(iconUrl) || inlineHref.includes(t)) {
          info.type = t as MarkerType;
          break;
        }
      }
      if (!info.iconHref && info.kmlColor) {
        info.type = inferTypeByKmlColor(info.kmlColor) ?? info.type;
      }
    } else {
      // По имени (существующая логика).
      const name = (pm.querySelector('name')?.textContent ?? '').toLowerCase();
      if (name.includes('опасн') || name.includes('danger')) info.type = 'danger';
      else if (name.includes('предупр') || name.includes('warn')) info.type = 'warning';
      else if (name.includes('кпп') || name.includes('checkpoint')) info.type = 'checkpoint';
      else if (name.includes('инфо') || name.includes('info')) info.type = 'info';
    }
  }

  const href = info.iconHref ?? '';
  const normalized = href.replace(/^http:\/\//i, 'https://').split('?')[0];
  const defaultForType = MARKER_KML_ICONS[info.type];

  let icon: string | undefined;
  if (normalized && normalized !== defaultForType) {
    // Либо курируемая — запомним remoteUrl, либо произвольная — as is.
    const curated = findCuratedByUrl(normalized) ?? findCuratedByFilename(normalized);
    icon = curated ? curated.remoteUrl : normalized;
  }

  let color: string | undefined;
  if (!icon && info.kmlColor) {
    color = kmlColorToHex(info.kmlColor) ?? undefined;
  }

  return { type: info.type, icon, color };
}

function kmlColorToHex(kmlColor: string): string | null {
  if (kmlColor.length !== 8) return null;
  const r = kmlColor.slice(6, 8);
  const g = kmlColor.slice(4, 6);
  const b = kmlColor.slice(2, 4);
  return `#${r}${g}${b}`.toLowerCase();
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

// Экспорт для тестов (чтобы не инициализировать state).
export function parseKmlForTest(content: string): ParseResult {
  return parseKml(content);
}
