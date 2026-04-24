import type { MarkerData, MarkerType } from '../types';
import { escapeXml, parseXml } from '../utils/xml';

const GPX_SYM_MAP: Record<MarkerType, string> = {
  default: 'Flag, Blue',
  warning: 'Flag, Yellow',
  danger: 'Flag, Red',
  info: 'Information',
  checkpoint: 'Flag, Green',
};

/** Build GPX from markers */
export function buildGpx(markers: MarkerData[]): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<gpx version="1.1" creator="msrv_map" xmlns="http://www.topografix.com/GPX/1/1">');

  for (const m of markers) {
    lines.push(`  <wpt lat="${m.latlng.lat}" lon="${m.latlng.lng}">`);
    if (m.name) lines.push(`    <name>${escapeXml(m.name)}</name>`);
    if (m.description) lines.push(`    <desc>${escapeXml(m.description)}</desc>`);
    lines.push(`    <type>${m.type}</type>`);
    lines.push(`    <sym>${GPX_SYM_MAP[m.type] ?? 'Flag, Blue'}</sym>`);
    lines.push(`  </wpt>`);
  }

  lines.push('</gpx>');
  return lines.join('\n');
}

/** Parse GPX content */
export function parseGpx(content: string): { markers: MarkerData[]; tracks: { lat: number; lng: number }[][] } {
  const doc = parseXml(content);
  const markers: MarkerData[] = [];
  const tracks: { lat: number; lng: number }[][] = [];

  // Waypoints → markers
  doc.querySelectorAll('wpt').forEach(wpt => {
    const lat = parseFloat(wpt.getAttribute('lat') ?? '0');
    const lng = parseFloat(wpt.getAttribute('lon') ?? '0');
    const name = wpt.querySelector('name')?.textContent?.trim() ?? '';
    const desc = wpt.querySelector('desc')?.textContent?.trim() ?? '';
    const typeStr = wpt.querySelector('type')?.textContent?.trim() ?? '';
    const sym = wpt.querySelector('sym')?.textContent?.trim() ?? '';

    markers.push({
      id: crypto.randomUUID(),
      latlng: { lat, lng },
      type: resolveGpxType(typeStr, sym, name),
      name,
      description: desc,
    });
  });

  // Tracks
  doc.querySelectorAll('trk').forEach(trk => {
    trk.querySelectorAll('trkseg').forEach(seg => {
      const points: { lat: number; lng: number }[] = [];
      seg.querySelectorAll('trkpt').forEach(pt => {
        points.push({
          lat: parseFloat(pt.getAttribute('lat') ?? '0'),
          lng: parseFloat(pt.getAttribute('lon') ?? '0'),
        });
      });
      if (points.length > 0) tracks.push(points);
    });
  });

  return { markers, tracks };
}

function resolveGpxType(type: string, sym: string, name: string): MarkerType {
  const validTypes: MarkerType[] = ['default', 'warning', 'danger', 'info', 'checkpoint'];
  if (validTypes.includes(type as MarkerType)) return type as MarkerType;

  const symLower = sym.toLowerCase();
  if (symLower.includes('red')) return 'danger';
  if (symLower.includes('yellow')) return 'warning';
  if (symLower.includes('green')) return 'checkpoint';
  if (symLower.includes('info')) return 'info';

  const nameLower = name.toLowerCase();
  if (nameLower.includes('опасн') || nameLower.includes('danger')) return 'danger';
  if (nameLower.includes('предупр') || nameLower.includes('warn')) return 'warning';
  if (nameLower.includes('кпп') || nameLower.includes('checkpoint')) return 'checkpoint';
  if (nameLower.includes('инфо') || nameLower.includes('info')) return 'info';

  return 'default';
}
