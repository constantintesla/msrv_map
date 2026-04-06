import L from 'leaflet';
import { getMap } from './map';
import { state } from './state';
import { bus } from './events';
import type { Bounds } from '../types';

let zoneRectangle: L.Rectangle | null = null;
let drawStartPoint: L.LatLng | null = null;
let drawRect: L.Rectangle | null = null;

/** Start zone selection mode */
export function startZoneSelection(): void {
  const map = getMap();
  state.set('zoneSelectionMode', true);
  bus.emit('mode:zone', { active: true });

  map.getContainer().style.cursor = 'crosshair';

  map.dragging.disable();

  const onMouseDown = (e: L.LeafletMouseEvent) => {
    drawStartPoint = e.latlng;
  };

  const onMouseMove = (e: L.LeafletMouseEvent) => {
    if (!drawStartPoint) return;
    const bounds = L.latLngBounds(drawStartPoint, e.latlng);
    if (drawRect) {
      drawRect.setBounds(bounds);
    } else {
      drawRect = L.rectangle(bounds, {
        color: '#667eea',
        weight: 2,
        dashArray: '6 4',
        fill: true,
        fillOpacity: 0.1,
      });
      drawRect.addTo(map);
    }
  };

  const onMouseUp = (e: L.LeafletMouseEvent) => {
    if (!drawStartPoint) return;

    const bounds = L.latLngBounds(drawStartPoint, e.latlng);
    const zone: Bounds = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    };

    state.set('selectedZone', zone);

    // Replace draw rect with final zone rect
    if (drawRect) map.removeLayer(drawRect);
    drawRect = null;

    if (zoneRectangle) map.removeLayer(zoneRectangle);
    zoneRectangle = L.rectangle(bounds, {
      color: '#667eea',
      weight: 2,
      dashArray: '6 4',
      fill: true,
      fillOpacity: 0.05,
    });
    zoneRectangle.addTo(map);

    cleanup();
    bus.emit('zone:selected', { bounds: zone });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (drawRect) map.removeLayer(drawRect);
      drawRect = null;
      drawStartPoint = null;
      cleanup();
      state.set('zoneSelectionMode', false);
      bus.emit('mode:zone', { active: false });
    }
  };

  function cleanup() {
    map.off('mousedown', onMouseDown);
    map.off('mousemove', onMouseMove);
    map.off('mouseup', onMouseUp);
    document.removeEventListener('keydown', onKeyDown);
    map.dragging.enable();
    map.getContainer().style.cursor = '';
    state.set('zoneSelectionMode', false);
    bus.emit('mode:zone', { active: false });
    drawStartPoint = null;
  }

  map.on('mousedown', onMouseDown);
  map.on('mousemove', onMouseMove);
  map.on('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);
}

/** Clear selected zone */
export function clearZone(): void {
  const map = getMap();
  if (zoneRectangle) {
    map.removeLayer(zoneRectangle);
    zoneRectangle = null;
  }
  state.set('selectedZone', null);
  bus.emit('zone:cleared');
}

/** Get zone rectangle for external use */
export function getZoneRectangle(): L.Rectangle | null {
  return zoneRectangle;
}
