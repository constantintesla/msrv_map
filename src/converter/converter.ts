import type { MarkerData } from '../types';
import { buildKml } from '../export/kml-builder';
import { buildGpx, parseGpx } from '../export/gpx';
import { parseXml } from '../utils/xml';
import JSZip from 'jszip';

export interface ConvertResult {
  kml: string;
  kmz: Blob;
  gpx: string;
}

/** Convert input file to all three formats */
export async function convertFile(file: File): Promise<ConvertResult> {
  const name = file.name.toLowerCase();
  let markers: MarkerData[] = [];
  let tracks: { lat: number; lng: number }[][] = [];

  if (name.endsWith('.gpx')) {
    const content = await file.text();
    const result = parseGpx(content);
    markers = result.markers;
    tracks = result.tracks;
  } else if (name.endsWith('.kml')) {
    const kmlContent = await file.text();
    const result = parseKmlForConverter(kmlContent);
    markers = result.markers;
    tracks = result.tracks;
  } else if (name.endsWith('.kmz')) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    let kmlPath = '';
    zip.forEach((path) => { if (path.endsWith('.kml') && !kmlPath) kmlPath = path; });
    if (!kmlPath) throw new Error('KML не найден в KMZ');
    const kmlContent = await zip.file(kmlPath)!.async('text');
    const result = parseKmlForConverter(kmlContent);
    markers = result.markers;
    tracks = result.tracks;
  } else {
    throw new Error('Неподдерживаемый формат');
  }

  // Build KML with normalized styles
  const kml = buildNormalizedKml(markers, tracks);

  // Build KMZ
  const outZip = new JSZip();
  outZip.file('doc.kml', kml);
  const kmz = await outZip.generateAsync({ type: 'blob' });

  // Build GPX
  const gpx = buildGpx(markers);

  return { kml, kmz, gpx };
}

function parseKmlForConverter(content: string): { markers: MarkerData[]; tracks: { lat: number; lng: number }[][] } {
  const doc = parseXml(content);
  const markers: MarkerData[] = [];
  const tracks: { lat: number; lng: number }[][] = [];

  doc.querySelectorAll('Placemark').forEach(pm => {
    const name = pm.querySelector('name')?.textContent?.trim() ?? '';
    const desc = pm.querySelector('description')?.textContent?.trim() ?? '';

    const point = pm.querySelector('Point coordinates');
    if (point) {
      const [lng, lat] = (point.textContent?.trim() ?? '').split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        markers.push({
          id: crypto.randomUUID(),
          latlng: { lat, lng },
          type: 'default',
          name,
          description: desc,
        });
      }
    }

    const lineCoords = pm.querySelector('LineString coordinates');
    if (lineCoords) {
      const points = (lineCoords.textContent?.trim() ?? '').split(/\s+/).filter(Boolean).map(c => {
        const [lng, lat] = c.split(',').map(Number);
        return { lat, lng };
      });
      if (points.length > 0) tracks.push(points);
    }
  });

  return { markers, tracks };
}

function buildNormalizedKml(markers: MarkerData[], tracks: { lat: number; lng: number }[][]): string {
  const kml = buildKml({
    markers,
    squares: [],
    gridBounds: null,
    gridSize: 100,
    gridColor: '#667eea',
    gridWeight: 2,
    showSquareNames: false,
    showPointLabels: true,
    showEdgeLabels: { left: false, right: false, top: false, bottom: false },
    startLetter: 'A',
  });

  if (tracks.length === 0) return kml;

  const trackFolder = tracks.map((track, i) => {
    const coords = track.map(p => `${p.lng},${p.lat},0`).join(' ');
    return `<Placemark><name>Track ${i + 1}</name><LineString><coordinates>${coords}</coordinates></LineString></Placemark>`;
  }).join('\n');

  return kml.replace('</Document>', `<Folder><name>Треки</name>${trackFolder}</Folder>\n</Document>`);
}
