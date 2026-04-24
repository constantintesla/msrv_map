import type { LatLng, Bounds } from '../types';
import { METERS_PER_DEG_LAT, EARTH_RADIUS } from '../constants';

/** Meters → degrees of latitude (constant everywhere) */
export function metersToDegreesLat(meters: number): number {
  return meters / METERS_PER_DEG_LAT;
}

/** Meters → degrees of longitude (depends on latitude) */
export function metersToDegreesLng(meters: number, lat: number): number {
  return meters / (METERS_PER_DEG_LAT * Math.cos(lat * Math.PI / 180));
}

/** Haversine distance between two points in meters */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

/** Longitude → Mercator pixel X at given zoom */
export function lngToMercatorX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom) * 256;
}

/** Latitude → Mercator pixel Y at given zoom */
export function latToMercatorY(lat: number, zoom: number): number {
  const latRad = lat * Math.PI / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom) * 256;
}

/** Center point of bounds */
export function boundsCenter(b: Bounds): LatLng {
  return {
    lat: (b.north + b.south) / 2,
    lng: (b.east + b.west) / 2,
  };
}

/** Expand bounds by meters in all directions */
export function bufferBounds(b: Bounds, meters: number): Bounds {
  const centerLat = (b.north + b.south) / 2;
  const dLat = metersToDegreesLat(meters);
  const dLng = metersToDegreesLng(meters, centerLat);
  return {
    north: b.north + dLat,
    south: b.south - dLat,
    east: b.east + dLng,
    west: b.west - dLng,
  };
}

/** Bounds size in meters: [width, height] */
export function boundsSizeMeters(b: Bounds): [number, number] {
  const centerLat = (b.north + b.south) / 2;
  const width = (b.east - b.west) * METERS_PER_DEG_LAT * Math.cos(centerLat * Math.PI / 180);
  const height = (b.north - b.south) * METERS_PER_DEG_LAT;
  return [width, height];
}

/** Create projection: geo coords → canvas pixels */
export function createProjection(bounds: Bounds, canvasW: number, canvasH: number, zoom: number) {
  const xMin = lngToMercatorX(bounds.west, zoom);
  const xMax = lngToMercatorX(bounds.east, zoom);
  const yMin = latToMercatorY(bounds.north, zoom);
  const yMax = latToMercatorY(bounds.south, zoom);

  return {
    zoom,
    xMin, xMax, yMin, yMax,
    canvasW, canvasH,
    x(lng: number): number {
      return (lngToMercatorX(lng, zoom) - xMin) / (xMax - xMin) * canvasW;
    },
    y(lat: number): number {
      return (latToMercatorY(lat, zoom) - yMin) / (yMax - yMin) * canvasH;
    },
  };
}

export type Projection = ReturnType<typeof createProjection>;
