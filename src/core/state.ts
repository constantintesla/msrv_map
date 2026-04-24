import type { AppState } from '../types';
import { bus } from './events';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DEFAULT_GRID_SIZE,
  DEFAULT_GRID_COLOR,
  DEFAULT_GRID_WEIGHT,
  DEFAULT_START_LETTER,
  DEFAULT_GRID_SHIFT_STEP,
  DEFAULT_FONT_FAMILY,
  DEFAULT_SQUARE_FONT_SIZE,
  DEFAULT_EDGE_FONT_SIZE,
  DEFAULT_POINT_FONT_SIZE,
  DEFAULT_LABEL_COLOR,
  DEFAULT_LABEL_STROKE,
  DEFAULT_LABEL_STROKE_COLOR,
} from '../constants';

function createDefaultState(): AppState {
  return {
    mapType: 'satellite',
    mapCenter: { ...DEFAULT_MAP_CENTER },
    mapZoom: DEFAULT_MAP_ZOOM,

    gridSquares: [],
    gridBounds: null,
    gridSize: DEFAULT_GRID_SIZE,
    gridColor: DEFAULT_GRID_COLOR,
    gridWeight: DEFAULT_GRID_WEIGHT,
    startLetter: DEFAULT_START_LETTER,

    selectedZone: null,
    gridShiftStep: DEFAULT_GRID_SHIFT_STEP,

    showSquareNames: true,
    squareNamePosition: 'bottom-right',
    showEdgeLabels: { left: true, right: false, top: true, bottom: true },
    showPointLabels: true,
    fontFamily: DEFAULT_FONT_FAMILY,
    squareFontSize: DEFAULT_SQUARE_FONT_SIZE,
    edgeFontSize: DEFAULT_EDGE_FONT_SIZE,
    pointFontSize: DEFAULT_POINT_FONT_SIZE,
    labelColor: DEFAULT_LABEL_COLOR,
    labelStroke: DEFAULT_LABEL_STROKE,
    labelStrokeColor: DEFAULT_LABEL_STROKE_COLOR,

    markers: [],

    markerMode: false,
    zoneSelectionMode: false,
  };
}

class StateManager {
  private _state: AppState;

  constructor() {
    this._state = createDefaultState();
  }

  get<K extends keyof AppState>(key: K): AppState[K] {
    return this._state[key];
  }

  set<K extends keyof AppState>(key: K, value: AppState[K]): void {
    this._state[key] = value;
    bus.emit('state:changed' as any, { key });
  }

  /** Bulk update without emitting per-key events */
  patch(partial: Partial<AppState>): void {
    Object.assign(this._state, partial);
  }

  /** Full snapshot for serialization (projects, etc.) */
  snapshot(): AppState {
    return structuredClone(this._state);
  }

  /** Reset to defaults */
  reset(): void {
    this._state = createDefaultState();
    bus.emit('state:reset');
  }

  /** Load from project data */
  load(data: Partial<AppState>): void {
    this._state = { ...createDefaultState(), ...data };
    bus.emit('project:loaded');
  }
}

export const state = new StateManager();
