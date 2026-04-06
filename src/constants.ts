import type { TileProvider, MarkerType } from './types';

// === Geo Constants ===

export const EARTH_RADIUS = 6_371_000; // meters
export const METERS_PER_DEG_LAT = 111_320;

export function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos(lat * Math.PI / 180);
}

// === Tile Providers ===

export const TILE_PROVIDERS: TileProvider[] = [
  {
    type: 'satellite',
    name: 'Спутник (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    maxZoom: 19,
  },
  {
    type: 'topographic',
    name: 'Топографическая (OSM)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  {
    type: 'elevation',
    name: 'С высотами (OpenTopoMap)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
    maxZoom: 17,
  },
];

// === Marker Colors ===

export const MARKER_COLORS: Record<MarkerType, string> = {
  default: '#4285F4',    // синий
  warning: '#FBBC04',    // жёлтый
  danger: '#EA4335',     // красный
  info: '#34A8EB',       // голубой
  checkpoint: '#34A853', // зелёный
};

export const MARKER_TYPE_NAMES: Record<MarkerType, string> = {
  default: 'Стандартная',
  warning: 'Предупреждение',
  danger: 'Опасность',
  info: 'Информация',
  checkpoint: 'КПП',
};

// === Google Maps Icon URLs (for KML export) ===

export const MARKER_KML_ICONS: Record<MarkerType, string> = {
  default: 'https://maps.google.com/mapfiles/kml/paddle/blu-circle.png',
  warning: 'https://maps.google.com/mapfiles/kml/paddle/ylw-circle.png',
  danger: 'https://maps.google.com/mapfiles/kml/paddle/red-circle.png',
  info: 'https://maps.google.com/mapfiles/kml/paddle/ltblu-circle.png',
  checkpoint: 'https://maps.google.com/mapfiles/kml/paddle/grn-circle.png',
};

// === Default State Values ===

export const DEFAULT_MAP_CENTER = { lat: 43.1151, lng: 131.8854 }; // Владивосток
export const DEFAULT_MAP_ZOOM = 13;
export const DEFAULT_GRID_SIZE = 100;
export const DEFAULT_GRID_COLOR = '#667eea';
export const DEFAULT_GRID_WEIGHT = 2;
export const DEFAULT_START_LETTER = 'A';
export const DEFAULT_GRID_SHIFT_STEP = 10;
export const DEFAULT_FONT_FAMILY = 'Arial, sans-serif';
export const DEFAULT_SQUARE_FONT_SIZE = 11;
export const DEFAULT_EDGE_FONT_SIZE = 12;
export const DEFAULT_POINT_FONT_SIZE = 12;

// === PNG Export ===

export const PNG_MAX_SIDE = 3000;
export const PNG_MIN_SIDE = 1200;
export const PNG_BUFFER_METERS = 40;

// === Grid Overlay for KMZ ===

export const GRID_OVERLAY_SIZE = 4000;
