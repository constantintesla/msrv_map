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

function kmlStyles(_opts: KmlBuildOptions): string {
  const lines: string[] = [];

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

  parts.push('</Document>');
  parts.push('</kml>');
  return parts.join('\n');
}
