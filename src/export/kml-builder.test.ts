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

  it('includes grid square as Polygon', () => {
    const kml = buildKml({ markers: [], squares: [square], gridBounds: square.bounds, gridSize: 100, gridColor: '#667eea', gridWeight: 2, showSquareNames: true, showPointLabels: true, showEdgeLabels: { left: false, right: false, top: false, bottom: false }, startLetter: 'A' });
    expect(kml).toContain('<Polygon>');
    expect(kml).toContain('<name>A1</name>');
  });
});
