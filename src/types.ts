// === Marker Types ===

export type MarkerType = 'default' | 'warning' | 'danger' | 'info' | 'checkpoint';

export interface MarkerData {
  id: string;
  latlng: LatLng;
  type: MarkerType;
  name: string;
  description: string;
}

// === Grid Types ===

export interface GridSquare {
  row: number;
  col: number;
  name: string;
  bounds: Bounds;
  isScale: boolean;  // A1
  isSnail: boolean;  // A2
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

// === Display Types ===

export type LabelPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface EdgeLabelsVisibility {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

// === Tile Providers ===

export type TileProviderType = 'satellite' | 'topographic' | 'elevation';

export interface TileProvider {
  type: TileProviderType;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

// === State ===

export interface AppState {
  // Map
  mapType: TileProviderType;
  mapCenter: LatLng;
  mapZoom: number;

  // Grid
  gridSquares: GridSquare[];
  gridBounds: Bounds | null;
  gridSize: number;
  gridColor: string;
  gridWeight: number;
  startLetter: string;

  // Zone
  selectedZone: Bounds | null;

  // Shift
  gridShiftStep: number;

  // Display
  showSquareNames: boolean;
  squareNamePosition: LabelPosition;
  showEdgeLabels: EdgeLabelsVisibility;
  showPointLabels: boolean;
  fontFamily: string;
  squareFontSize: number;
  edgeFontSize: number;
  pointFontSize: number;
  labelColor: string;
  labelStroke: boolean;
  labelStrokeColor: string;

  // Markers
  markers: MarkerData[];

  // UI modes
  markerMode: boolean;
  zoneSelectionMode: boolean;
}

// === Projects ===

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  data: ProjectData;
}

export type ProjectData = Omit<AppState, 'markerMode' | 'zoneSelectionMode'>;

// === Events ===

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface EventMap {
  'map:type-changed': { type: TileProviderType };
  'map:moved': { center: LatLng; zoom: number };
  'grid:created': { squares: GridSquare[] };
  'grid:cleared': void;
  'grid:shifted': { direction: Direction };
  'grid:style-changed': void;
  'grid:display-changed': void;
  'marker:added': { marker: MarkerData };
  'marker:updated': { marker: MarkerData };
  'marker:removed': { id: string };
  'markers:cleared': void;
  'zone:selected': { bounds: Bounds };
  'zone:cleared': void;
  'project:loaded': void;
  'state:reset': void;
  'mode:marker': { active: boolean };
  'mode:zone': { active: boolean };
}
