import { describe, it, expect } from 'vitest';
import {
  metersToDegreesLat,
  metersToDegreesLng,
  haversineDistance,
  lngToMercatorX,
  latToMercatorY,
  boundsCenter,
  bufferBounds,
} from './geo';

describe('metersToDegreesLat', () => {
  it('converts 111320m to ~1 degree', () => {
    expect(metersToDegreesLat(111320)).toBeCloseTo(1.0, 2);
  });

  it('converts 100m correctly', () => {
    expect(metersToDegreesLat(100)).toBeCloseTo(0.000898, 4);
  });
});

describe('metersToDegreesLng', () => {
  it('at equator, matches lat conversion', () => {
    expect(metersToDegreesLng(111320, 0)).toBeCloseTo(1.0, 2);
  });

  it('at 45° lat, is ~1.41x larger than lat', () => {
    const degLng = metersToDegreesLng(100, 45);
    const degLat = metersToDegreesLat(100);
    expect(degLng / degLat).toBeCloseTo(1.414, 1);
  });

  it('at 60° lat, is ~2x larger than lat', () => {
    const degLng = metersToDegreesLng(100, 60);
    const degLat = metersToDegreesLat(100);
    expect(degLng / degLat).toBeCloseTo(2.0, 1);
  });
});

describe('haversineDistance', () => {
  it('same point = 0', () => {
    expect(haversineDistance(
      { lat: 43.115, lng: 131.885 },
      { lat: 43.115, lng: 131.885 }
    )).toBe(0);
  });

  it('~111km for 1° latitude', () => {
    const d = haversineDistance(
      { lat: 43.0, lng: 131.0 },
      { lat: 44.0, lng: 131.0 }
    );
    expect(d).toBeCloseTo(111195, -2); // ±200m accuracy
  });
});

describe('Mercator projection', () => {
  it('lngToMercatorX at zoom 0: 0°→128, 180°→256', () => {
    expect(lngToMercatorX(0, 0)).toBeCloseTo(128);
    expect(lngToMercatorX(180, 0)).toBeCloseTo(256);
  });

  it('latToMercatorY at zoom 0: 0°→128', () => {
    expect(latToMercatorY(0, 0)).toBeCloseTo(128);
  });
});

describe('boundsCenter', () => {
  it('returns center of bounds', () => {
    const c = boundsCenter({ north: 44, south: 42, east: 132, west: 130 });
    expect(c.lat).toBe(43);
    expect(c.lng).toBe(131);
  });
});

describe('bufferBounds', () => {
  it('expands bounds by given meters', () => {
    const b = { north: 43.0, south: 42.0, east: 132.0, west: 131.0 };
    const buffered = bufferBounds(b, 1000);
    expect(buffered.north).toBeGreaterThan(b.north);
    expect(buffered.south).toBeLessThan(b.south);
    expect(buffered.east).toBeGreaterThan(b.east);
    expect(buffered.west).toBeLessThan(b.west);
  });
});
