import L from 'leaflet';
import type { TileProviderType } from '../types';
import { TILE_PROVIDERS } from '../constants';
import { state } from './state';
import { bus } from './events';

let map: L.Map;
let currentTileLayer: L.TileLayer;

export function getMap(): L.Map {
  return map;
}

export function initMap(container: string | HTMLElement): L.Map {
  const center = state.get('mapCenter');
  const zoom = state.get('mapZoom');

  map = L.map(container, {
    center: [center.lat, center.lng],
    zoom,
    zoomControl: true,
  });

  loadTileLayer(state.get('mapType'));

  map.on('moveend', () => {
    const c = map.getCenter();
    const z = map.getZoom();
    state.patch({
      mapCenter: { lat: c.lat, lng: c.lng },
      mapZoom: z,
    });
    bus.emit('map:moved', { center: { lat: c.lat, lng: c.lng }, zoom: z });
  });

  return map;
}

export function loadTileLayer(type: TileProviderType): void {
  const provider = TILE_PROVIDERS.find(p => p.type === type);
  if (!provider) return;

  if (currentTileLayer) {
    map.removeLayer(currentTileLayer);
  }

  currentTileLayer = L.tileLayer(provider.url, {
    attribution: provider.attribution,
    maxZoom: provider.maxZoom,
    subdomains: 'abc',
  });

  currentTileLayer.addTo(map);
  state.set('mapType', type);
  bus.emit('map:type-changed', { type });
}

/** Get tile URL for offscreen rendering */
export function getTileUrl(tileX: number, tileY: number, zoom: number): string | null {
  const type = state.get('mapType');
  if (type === 'satellite') {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tileY}/${tileX}`;
  }
  const s = ['a', 'b', 'c'][(tileX + tileY) % 3];
  if (type === 'topographic') {
    return `https://${s}.tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
  }
  if (type === 'elevation') {
    return `https://${s}.tile.opentopomap.org/${zoom}/${tileX}/${tileY}.png`;
  }
  return null;
}

/** Fit map view to current grid bounds (or selected zone) if any */
export function fitToGrid(options?: { padding?: number; maxZoom?: number }): boolean {
  const bounds = state.get('gridBounds') ?? state.get('selectedZone');
  if (!bounds) return false;
  const latLngBounds = L.latLngBounds(
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  );
  map.fitBounds(latLngBounds, {
    padding: [options?.padding ?? 30, options?.padding ?? 30],
    maxZoom: options?.maxZoom,
  });
  return true;
}

/** Get current map bounds as our Bounds type */
export function getMapBounds() {
  const b = map.getBounds();
  return {
    north: b.getNorth(),
    south: b.getSouth(),
    east: b.getEast(),
    west: b.getWest(),
  };
}
