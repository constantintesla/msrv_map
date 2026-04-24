import JSZip from 'jszip';
import type { Bounds } from '../types';
import { state } from '../core/state';
import { buildKml } from './kml-builder';
import { renderGridOverlay } from './grid-overlay';
import { downloadBlob, downloadText } from '../utils/download';
import { escapeXml, formatKmlCoord } from '../utils/xml';
import { MARKER_KML_ICONS, MARKER_COLORS } from '../constants';
import { metersToDegreesLat, metersToDegreesLng } from '../utils/geo';

/** Convert hex #RRGGBB to KML AABBGGRR */
function hexToKmlColor(hex: string): string {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  return `ff${b}${g}${r}`;
}

/** Build KML for KMZ — per-marker стили с абсолютными URL иконок + GroundOverlay (grid as PNG image) */
function buildKmzKml(overlayBounds: Bounds | null): string {
  const markers = state.get('markers');
  const showPointLabels = state.get('showPointLabels');

  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push('<kml xmlns="http://www.opengis.net/kml/2.2">');
  parts.push('<Document>');
  parts.push('<name>Карта</name>');

  // Per-marker styles — абсолютный URL иконки, чтобы работало во всех вьюверах (Alpinequest и т.п.)
  for (const m of markers) {
    const href = m.icon ?? MARKER_KML_ICONS[m.type];
    const colorTag = !m.icon
      ? `<color>${hexToKmlColor(m.color ?? MARKER_COLORS[m.type])}</color>`
      : '';
    parts.push(`<Style id="marker-${m.id}"><IconStyle><Icon><href>${escapeXml(href)}</href></Icon><scale>1.0</scale>${colorTag}</IconStyle><LabelStyle><color>ffffffff</color><scale>0.8</scale></LabelStyle></Style>`);
  }

  // Markers
  if (markers.length > 0) {
    parts.push('<Folder><name>Маркеры</name>');
    for (const m of markers) {
      const name = showPointLabels ? (m.name || '') : '';
      parts.push(`<Placemark><name>${escapeXml(name)}</name>${m.description ? `<description>${escapeXml(m.description)}</description>` : ''}<styleUrl>#marker-${m.id}</styleUrl><Point><coordinates>${formatKmlCoord(m.latlng.lat, m.latlng.lng)}</coordinates></Point></Placemark>`);
    }
    parts.push('</Folder>');
  }

  // Grid as transparent GroundOverlay
  if (overlayBounds) {
    parts.push(`<GroundOverlay>
<name>Сетка</name>
<Icon><href>grid_overlay.png</href></Icon>
<LatLonBox>
  <north>${overlayBounds.north}</north>
  <south>${overlayBounds.south}</south>
  <east>${overlayBounds.east}</east>
  <west>${overlayBounds.west}</west>
</LatLonBox>
</GroundOverlay>`);
  }

  parts.push('</Document>');
  parts.push('</kml>');
  return parts.join('\n');
}

/** Build KML content from current state (vector grid) */
function buildStateKml() {
  return buildKml({
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
}

/** Export KMZ file (grid as GroundOverlay PNG + markers) */
export async function exportKmz(): Promise<void> {
  const squares = state.get('gridSquares');
  const gridBounds = state.get('gridBounds');

  if (squares.length === 0 && state.get('markers').length === 0) {
    alert('Нечего экспортировать. Создайте сетку или добавьте метки.');
    return;
  }

  const zip = new JSZip();

  let overlayBounds: Bounds | null = null;
  if (squares.length > 0 && gridBounds) {
    // Expand bounds to fit edge labels outside the grid
    const gridSize = state.get('gridSize');
    const centerLat = (gridBounds.north + gridBounds.south) / 2;
    const padLat = metersToDegreesLat(gridSize * 0.15);
    const padLng = metersToDegreesLng(gridSize * 0.15, centerLat);
    overlayBounds = {
      north: gridBounds.north + padLat,
      south: gridBounds.south - padLat,
      east: gridBounds.east + padLng,
      west: gridBounds.west - padLng,
    };

    const overlayBlob = await renderGridOverlay(squares, overlayBounds);
    zip.file('grid_overlay.png', overlayBlob);
  }

  zip.file('doc.kml', buildKmzKml(overlayBounds));

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, 'map.kmz');
}

/** Export KML file (vector grid) */
export function exportKml(): void {
  downloadText(buildStateKml(), 'map.kml', 'application/vnd.google-earth.kml+xml');
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
