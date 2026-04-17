import L from 'leaflet';
import type { MarkerData } from '../types';
import { MARKER_COLORS, MARKER_TYPE_NAMES } from '../constants';
import { state } from './state';
import { bus } from './events';
import { getMap } from './map';
import { updateMarker } from './markers';

const leafletMarkers = new Map<string, L.Marker>();

function createMarkerIcon(type: string, size: number = 12): L.DivIcon {
  const color = MARKER_COLORS[type as keyof typeof MARKER_COLORS] ?? MARKER_COLORS.default;
  return L.divIcon({
    className: 'map-marker',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:2px solid white;
      border-radius:50%;
      box-shadow:0 1px 3px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
  });
}

function createPopupContent(data: MarkerData): string {
  const typeName = MARKER_TYPE_NAMES[data.type];
  return `<div>
    <strong>${typeName}</strong>${data.name ? `: ${data.name}` : ''}
    ${data.description ? `<br><em>${data.description}</em>` : ''}
    <br><small>Ctrl+Click для редактирования</small>
  </div>`;
}

function renderMarker(data: MarkerData): void {
  const map = getMap();
  const existing = leafletMarkers.get(data.id);
  if (existing) map.removeLayer(existing);

  const marker = L.marker([data.latlng.lat, data.latlng.lng], {
    icon: createMarkerIcon(data.type),
    draggable: true,
    zIndexOffset: 2000,
  });

  marker.bindPopup(createPopupContent(data));

  // Tooltip (persistent label)
  if (data.name && state.get('showPointLabels')) {
    marker.bindTooltip(data.name, {
      permanent: true,
      direction: 'top',
      offset: [0, -10],
      className: 'marker-tooltip',
    });
  }

  // Drag handler
  marker.on('dragend', () => {
    const pos = marker.getLatLng();
    updateMarker(data.id, { latlng: { lat: pos.lat, lng: pos.lng } });
  });

  // Ctrl+Click → edit
  marker.on('click', (e: L.LeafletMouseEvent) => {
    if (e.originalEvent.ctrlKey) {
      const desc = prompt('Описание:', data.description);
      if (desc !== null) {
        const name = prompt('Подпись:', data.name);
        if (name !== null) {
          updateMarker(data.id, { description: desc, name });
        }
      }
    }
  });

  marker.addTo(map);
  leafletMarkers.set(data.id, marker);
}

function removeMarkerVisual(id: string): void {
  const marker = leafletMarkers.get(id);
  if (marker) {
    getMap().removeLayer(marker);
    leafletMarkers.delete(id);
  }
}

function clearAllVisuals(): void {
  const map = getMap();
  leafletMarkers.forEach(m => map.removeLayer(m));
  leafletMarkers.clear();
}

/** Re-render all markers (after project load, etc.) */
export function renderAllMarkers(): void {
  clearAllVisuals();
  for (const data of state.get('markers')) {
    renderMarker(data);
  }
}

// Event subscriptions
bus.on('marker:added', ({ marker }) => renderMarker(marker));
bus.on('marker:updated', ({ marker }) => renderMarker(marker));
bus.on('marker:removed', ({ id }) => removeMarkerVisual(id));
bus.on('markers:cleared', clearAllVisuals);
bus.on('project:loaded', renderAllMarkers);
bus.on('state:reset', clearAllVisuals);
