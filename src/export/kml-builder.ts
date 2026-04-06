import type { MarkerData, GridSquare, Bounds, EdgeLabelsVisibility } from '../types';
import { MARKER_KML_ICONS, MARKER_COLORS } from '../constants';
import { escapeXml, formatKmlCoord } from '../utils/xml';
import { getSquareName, getGridRows, getGridCols } from '../core/grid';
import { metersToDegreesLat, metersToDegreesLng } from '../utils/geo';

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

  // Grid square style
  lines.push(`<Style id="gridSquareStyle"><LineStyle><color>${gridKmlColor}</color><width>${Math.max(1, opts.gridWeight)}</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style>`);

  // Grid guide line (snail)
  lines.push(`<Style id="gridGuideLineStyle"><LineStyle><color>${gridKmlColor}</color><width>${Math.max(1, opts.gridWeight)}</width></LineStyle></Style>`);

  // Square label style
  lines.push(`<Style id="squareLabelStyle"><IconStyle><scale>0</scale></IconStyle><LabelStyle><color>ffffffff</color><scale>0.8</scale></LabelStyle></Style>`);

  // Edge label style
  lines.push(`<Style id="edgeLabelStyle"><IconStyle><scale>0</scale></IconStyle><LabelStyle><color>ffffffff</color><scale>0.9</scale></LabelStyle></Style>`);

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

function linePlacemark(name: string, styleUrl: string, coords: [number, number][]): string {
  const coordStr = coords.map(([lat, lng]) => formatKmlCoord(lat, lng)).join(' ');
  return `<Placemark><name>${escapeXml(name)}</name><styleUrl>${styleUrl}</styleUrl><LineString><coordinates>${coordStr}</coordinates></LineString></Placemark>`;
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
      parts.push(polygonPlacemark(sq.name, '#gridSquareStyle', sq.bounds));

      // Square labels
      if (opts.showSquareNames && !sq.isSnail) {
        const labelText = sq.isScale ? `<${opts.gridSize} м>` : sq.name;
        const center = { lat: (sq.bounds.north + sq.bounds.south) / 2, lng: (sq.bounds.east + sq.bounds.west) / 2 };
        parts.push(pointPlacemark(labelText, '#squareLabelStyle', center.lat, center.lng));
      }
    }
    parts.push('</Folder>');

    // Snail (A2)
    const snailSq = opts.squares.find(s => s.isSnail);
    if (snailSq) {
      parts.push('<Folder><name>Улитка</name>');
      const b = snailSq.bounds;
      const cLat = (b.north + b.south) / 2;
      const cLng = (b.east + b.west) / 2;

      parts.push(linePlacemark('', '#gridGuideLineStyle', [[b.north, cLng], [b.south, cLng]]));
      parts.push(linePlacemark('', '#gridGuideLineStyle', [[cLat, b.west], [cLat, b.east]]));

      const quadrants = [
        { n: '1', lat: (b.north + cLat) / 2, lng: (b.west + cLng) / 2 },
        { n: '2', lat: (b.north + cLat) / 2, lng: (b.east + cLng) / 2 },
        { n: '3', lat: (b.south + cLat) / 2, lng: (b.east + cLng) / 2 },
        { n: '4', lat: (b.south + cLat) / 2, lng: (b.west + cLng) / 2 },
      ];
      for (const q of quadrants) {
        parts.push(pointPlacemark(q.n, '#squareLabelStyle', q.lat, q.lng));
      }
      parts.push('</Folder>');
    }

    // Edge labels
    if (opts.gridBounds) {
      const edgeParts: string[] = [];
      const rows = getGridRows(opts.squares);
      const cols = getGridCols(opts.squares);
      const centerLat = (opts.gridBounds.north + opts.gridBounds.south) / 2;
      const offsetLat = metersToDegreesLat(opts.gridSize * 0.08);
      const offsetLng = metersToDegreesLng(opts.gridSize * 0.08, centerLat);

      for (const row of rows) {
        const sq = opts.squares.find(s => s.row === row);
        if (!sq) continue;
        const letter = getSquareName(row, 0, opts.startLetter).charAt(0);
        const lat = (sq.bounds.north + sq.bounds.south) / 2;

        if (opts.showEdgeLabels.left)
          edgeParts.push(pointPlacemark(letter, '#edgeLabelStyle', lat, opts.gridBounds.west - offsetLng));
        if (opts.showEdgeLabels.right)
          edgeParts.push(pointPlacemark(letter, '#edgeLabelStyle', lat, opts.gridBounds.east + offsetLng));
      }

      for (const col of cols) {
        const sq = opts.squares.find(s => s.col === col);
        if (!sq) continue;
        const num = String(col + 1);
        const lng = (sq.bounds.east + sq.bounds.west) / 2;

        if (opts.showEdgeLabels.top)
          edgeParts.push(pointPlacemark(num, '#edgeLabelStyle', opts.gridBounds.north + offsetLat, lng));
        if (opts.showEdgeLabels.bottom)
          edgeParts.push(pointPlacemark(num, '#edgeLabelStyle', opts.gridBounds.south - offsetLat, lng));
      }

      if (edgeParts.length > 0) {
        parts.push('<Folder><name>Краевые метки</name>');
        parts.push(...edgeParts);
        parts.push('</Folder>');
      }
    }
  }

  parts.push('</Document>');
  parts.push('</kml>');
  return parts.join('\n');
}
