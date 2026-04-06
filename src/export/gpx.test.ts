import { describe, it, expect } from 'vitest';
import { buildGpx, parseGpx } from './gpx';
import type { MarkerData } from '../types';

describe('buildGpx', () => {
  const marker: MarkerData = {
    id: '1', latlng: { lat: 43.115, lng: 131.885 },
    type: 'checkpoint', name: 'КПП-1', description: 'Точка сбора',
  };

  it('produces valid GPX with header', () => {
    const gpx = buildGpx([marker]);
    expect(gpx).toContain('<gpx');
    expect(gpx).toContain('version="1.1"');
  });

  it('includes waypoint', () => {
    const gpx = buildGpx([marker]);
    expect(gpx).toContain('lat="43.115"');
    expect(gpx).toContain('lon="131.885"');
    expect(gpx).toContain('<name>КПП-1</name>');
  });
});

describe('parseGpx', () => {
  const gpxContent = `<?xml version="1.0"?>
    <gpx version="1.1">
      <wpt lat="43.115" lon="131.885">
        <name>Test</name>
        <desc>Description</desc>
        <type>checkpoint</type>
      </wpt>
    </gpx>`;

  it('parses waypoints', () => {
    const result = parseGpx(gpxContent);
    expect(result.markers).toHaveLength(1);
    expect(result.markers[0].name).toBe('Test');
    expect(result.markers[0].latlng.lat).toBe(43.115);
  });

  it('resolves marker type', () => {
    const result = parseGpx(gpxContent);
    expect(result.markers[0].type).toBe('checkpoint');
  });
});
