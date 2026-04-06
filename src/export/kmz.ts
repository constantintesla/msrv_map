import JSZip from 'jszip';
import type { Bounds } from '../types';
import { state } from '../core/state';
import { buildKml } from './kml-builder';
import { renderGridOverlay } from './grid-overlay';
import { downloadBlob, downloadText } from '../utils/download';
import { escapeXml, formatKmlCoord } from '../utils/xml';
import { MARKER_KML_ICONS, MARKER_COLORS } from '../constants';

/** Convert hex #RRGGBB to KML AABBGGRR */
function hexToKmlColor(hex: string): string {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `ff${b}${g}${r}`;
}

/** Build KML for KMZ (markers + GroundOverlay, no vector grid) */
function buildKmzKml(gridBounds: Bounds): string {
  const markers = state.get('markers');
  const showPointLabels = state.get('showPointLabels');

  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push('<kml xmlns="http://www.opengis.net/kml/2.2">');
  parts.push('<Document>');
  parts.push('<name>Карта</name>');

  // Marker styles
  for (const [type, iconUrl] of Object.entries(MARKER_KML_ICONS)) {
    const color = hexToKmlColor(MARKER_COLORS[type as keyof typeof MARKER_COLORS]);
    parts.push(`<Style id="marker-${type}"><IconStyle><Icon><href>${iconUrl}</href></Icon><scale>1.0</scale><color>${color}</color></IconStyle><LabelStyle><color>ffffffff</color><scale>0.8</scale></LabelStyle></Style>`);
  }

  // Markers
  if (markers.length > 0) {
    parts.push('<Folder><name>Маркеры</name>');
    for (const m of markers) {
      const name = showPointLabels ? (m.name || '') : '';
      parts.push(`<Placemark><name>${escapeXml(name)}</name>${m.description ? `<description>${escapeXml(m.description)}</description>` : ''}<styleUrl>#marker-${m.type}</styleUrl><Point><coordinates>${formatKmlCoord(m.latlng.lat, m.latlng.lng)}</coordinates></Point></Placemark>`);
    }
    parts.push('</Folder>');
  }

  // Grid as GroundOverlay
  parts.push(`<GroundOverlay>
    <name>Сетка</name>
    <Icon><href>grid_overlay.png</href></Icon>
    <LatLonBox>
      <north>${gridBounds.north}</north>
      <south>${gridBounds.south}</south>
      <east>${gridBounds.east}</east>
      <west>${gridBounds.west}</west>
    </LatLonBox>
  </GroundOverlay>`);

  parts.push('</Document>');
  parts.push('</kml>');
  return parts.join('\n');
}

/** Export KMZ file */
export async function exportKmz(): Promise<void> {
  const squares = state.get('gridSquares');
  const gridBounds = state.get('gridBounds');

  if (squares.length === 0 && state.get('markers').length === 0) {
    alert('Нечего экспортировать. Создайте сетку или добавьте метки.');
    return;
  }

  const zip = new JSZip();

  if (squares.length > 0 && gridBounds) {
    // KMZ with GroundOverlay
    const overlayBlob = await renderGridOverlay(squares, gridBounds);
    const kml = buildKmzKml(gridBounds);
    zip.file('doc.kml', kml);
    zip.file('grid_overlay.png', overlayBlob);
  } else {
    // No grid — just markers as regular KML
    const kml = buildKml({
      markers: state.get('markers'),
      squares: [],
      gridBounds: null,
      gridSize: state.get('gridSize'),
      gridColor: state.get('gridColor'),
      gridWeight: state.get('gridWeight'),
      showSquareNames: state.get('showSquareNames'),
      showPointLabels: state.get('showPointLabels'),
      showEdgeLabels: state.get('showEdgeLabels'),
      startLetter: state.get('startLetter'),
    });
    zip.file('doc.kml', kml);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, 'map.kmz');
}

/** Export KML file (vector grid) */
export function exportKml(): void {
  const kml = buildKml({
    markers: state.get('markers'),
    squares: state.get('gridSquares'),
    gridBounds: state.get('gridBounds'),
    gridSize: state.get('gridSize'),
    gridColor: state.get('gridColor'),
    gridWeight: state.get('gridWeight'),
    showSquareNames: state.get('showSquareNames'),
    showPointLabels: state.get('showPointLabels'),
    showEdgeLabels: state.get('showEdgeLabels'),
    startLetter: state.get('startLetter'),
  });
  downloadText(kml, 'map.kml', 'application/vnd.google-earth.kml+xml');
}

/** Unpack KMZ to KML string */
export async function unpackKmz(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  let kmlPath = '';
  zip.forEach((path) => {
    if (path.endsWith('.kml') && !kmlPath) {
      kmlPath = path;
    }
  });

  if (!kmlPath) throw new Error('KML файл не найден в KMZ архиве');

  return await zip.file(kmlPath)!.async('text');
}
