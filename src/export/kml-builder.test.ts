import { describe, it, expect } from 'vitest';
import { buildKml } from './kml-builder';
import type { GridSquare, MarkerData } from '../types';

describe('buildKml', () => {
  const marker: MarkerData = {
    id: '1', latlng: { lat: 43.115, lng: 131.885 },
    type: 'checkpoint', name: 'КПП-1', description: 'Точка сбора',
  };

  const square: GridSquare = {
    row: 0, col: 0, name: 'A1',
    bounds: { north: 43.01, south: 43.0, east: 131.01, west: 131.0 },
    isScale: true, isSnail: false,
  };

  it('produces valid KML with XML header', () => {
    const kml = buildKml({ markers: [marker], squares: [], gridBounds: null, gridSize: 100, gridColor: '#667eea', gridWeight: 2, showSquareNames: true, showPointLabels: true, showEdgeLabels: { left: false, right: false, top: false, bottom: false }, startLetter: 'A' });
    expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
  });

  it('includes marker as Placemark', () => {
    const kml = buildKml({ markers: [marker], squares: [], gridBounds: null, gridSize: 100, gridColor: '#667eea', gridWeight: 2, showSquareNames: true, showPointLabels: true, showEdgeLabels: { left: false, right: false, top: false, bottom: false }, startLetter: 'A' });
    expect(kml).toContain('<name>КПП-1</name>');
    expect(kml).toContain('131.885,43.115,0');
  });

  it('does not emit grid polygons (KML is points-only)', () => {
    const kml = buildKml({ markers: [], squares: [square], gridBounds: square.bounds, gridSize: 100, gridColor: '#667eea', gridWeight: 2, showSquareNames: true, showPointLabels: true, showEdgeLabels: { left: false, right: false, top: false, bottom: false }, startLetter: 'A' });
    expect(kml).not.toContain('<Polygon>');
    expect(kml).not.toContain('Сетка');
  });
});

function baseOpts(markers: MarkerData[]) {
  return {
    markers,
    squares: [],
    gridBounds: null,
    gridSize: 100,
    gridColor: '#000000',
    gridWeight: 1,
    showSquareNames: false,
    showPointLabels: true,
    showEdgeLabels: { left: false, right: false, top: false, bottom: false },
    startLetter: 'A',
  };
}

function mk(partial: Partial<MarkerData>): MarkerData {
  return {
    id: 'id1',
    latlng: { lat: 0, lng: 0 },
    type: 'default',
    name: 'M',
    description: '',
    ...partial,
  };
}

describe('buildKml — per-marker styles', () => {
  it('marker without icon/color → <href> дефолта типа, without custom color', () => {
    const kml = buildKml(baseOpts([mk({ type: 'danger' })]));
    expect(kml).toContain('https://maps.google.com/mapfiles/kml/paddle/red-circle.png');
  });

  it('marker with custom color → <color> tag AABBGGRR', () => {
    const kml = buildKml(baseOpts([mk({ color: '#ff0000' })]));
    // red #ff0000 → KML ff 00 00 ff → AABBGGRR
    expect(kml).toMatch(/<color>ff0000ff<\/color>/);
  });

  it('marker with custom icon → <href> custom URL, no <color>', () => {
    const kml = buildKml(baseOpts([mk({ icon: 'https://maps.google.com/mapfiles/kml/shapes/flag.png' })]));
    expect(kml).toContain('<href>https://maps.google.com/mapfiles/kml/shapes/flag.png</href>');
    // стиль конкретной метки не должен содержать color override (мы не дописываем в IconStyle)
    const styleBlock = kml.match(/<Style id="marker-id1">[\s\S]*?<\/Style>/);
    expect(styleBlock).not.toBeNull();
    const iconStyle = styleBlock![0].match(/<IconStyle>[\s\S]*?<\/IconStyle>/);
    expect(iconStyle).not.toBeNull();
    expect(iconStyle![0]).not.toMatch(/<color>/);
  });
});
