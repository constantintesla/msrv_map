import type { MarkerData, GridSquare, Bounds, EdgeLabelsVisibility } from '../types';
import { MARKER_KML_ICONS, MARKER_COLORS } from '../constants';
import { escapeXml, formatKmlCoord } from '../utils/xml';

export interface KmlBuildOptions {
  markers: MarkerData[];
  squares: GridSquare[];
  gridBounds: Bounds | null;
  gridSize: number;
  gridColor: string;
  gridWeight: number;
  showSquareNames: boolean;
  showPointLabels: boolean;
  showEdgeLabels: EdgeLabelsVisibility;
  startLetter: string;
}

/** Convert hex #RRGGBB to KML AABBGGRR */
function hexToKmlColor(hex: string, alpha: string = 'ff'): string {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `${alpha}${b}${g}${r}`;
}

function kmlStyles(opts: KmlBuildOptions): string {
  const gridKmlColor = hexToKmlColor(opts.gridColor);
  const lines: string[] = [];

  // Grid square style — polygon name displayed by KML viewer at centroid
  lines.push(`<Style id="gridSquareStyle"><LineStyle><color>${gridKmlColor}</color><width>${Math.max(1, opts.gridWeight)}</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle><LabelStyle><color>ffffffff</color><scale>0.7</scale></LabelStyle></Style>`);

  // Marker styles
  for (const [type, iconUrl] of Object.entries(MARKER_KML_ICONS)) {
    const color = hexToKmlColor(MARKER_COLORS[type as keyof typeof MARKER_COLORS]);
    lines.push(`<Style id="marker-${type}"><IconStyle><Icon><href>${iconUrl}</href></Icon><scale>1.0</scale><color>${color}</color></IconStyle><LabelStyle><color>ffffffff</color><scale>0.8</scale></LabelStyle></Style>`);
  }

  return lines.join('\n');
}

function pointPlacemark(name: string, styleUrl: string, lat: number, lng: number, description?: string): string {
  return `<Placemark><name>${escapeXml(name)}</name>${description ? `<description>${escapeXml(description)}</description>` : ''}<styleUrl>${styleUrl}</styleUrl><Point><coordinates>${formatKmlCoord(lat, lng)}</coordinates></Point></Placemark>`;
}

function polygonPlacemark(name: string, styleUrl: string, b: Bounds): string {
  const coords = [
    formatKmlCoord(b.north, b.west),
    formatKmlCoord(b.north, b.east),
    formatKmlCoord(b.south, b.east),
    formatKmlCoord(b.south, b.west),
    formatKmlCoord(b.north, b.west),
  ].join(' ');
  return `<Placemark><name>${escapeXml(name)}</name><styleUrl>${styleUrl}</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
}


export function buildKml(opts: KmlBuildOptions): string {
  const parts: string[] = [];

  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push('<kml xmlns="http://www.opengis.net/kml/2.2">');
  parts.push('<Document>');
  parts.push('<name>Карта</name>');
  parts.push(kmlStyles(opts));

  // Markers folder
  if (opts.markers.length > 0) {
    parts.push('<Folder><name>Маркеры</name>');
    for (const m of opts.markers) {
      const name = opts.showPointLabels ? (m.name || '') : '';
      const desc = [m.description].filter(Boolean).join('; ');
      parts.push(pointPlacemark(name, `#marker-${m.type}`, m.latlng.lat, m.latlng.lng, desc));
    }
    parts.push('</Folder>');
  }

  // Grid folder
  if (opts.squares.length > 0) {
    parts.push('<Folder><name>Сетка</name>');
    for (const sq of opts.squares) {
      // Polygon name shown by viewer at centroid; scale label shows grid size
      const displayName = (opts.showSquareNames && !sq.isSnail)
        ? (sq.isScale ? `<${opts.gridSize} м>` : sq.name)
        : '';
      parts.push(polygonPlacemark(displayName, '#gridSquareStyle', sq.bounds));
    }
    parts.push('</Folder>');

    // Snail (A2) omitted from KML/KMZ — renders poorly in mobile viewers
  }

  parts.push('</Document>');
  parts.push('</kml>');
  return parts.join('\n');
}
