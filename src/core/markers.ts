import type { MarkerData, MarkerType, LatLng } from '../types';
import { state } from './state';
import { bus } from './events';

/** Create a new marker */
export function addMarker(latlng: LatLng, type: MarkerType, name: string, description: string): MarkerData {
  const marker: MarkerData = {
    id: crypto.randomUUID(),
    latlng,
    type,
    name,
    description,
  };

  const markers = [...state.get('markers'), marker];
  state.set('markers', markers);
  bus.emit('marker:added', { marker });
  return marker;
}

/** Update existing marker */
export function updateMarker(
  id: string,
  updates: Partial<Pick<MarkerData, 'name' | 'description' | 'type' | 'latlng' | 'color' | 'icon'>>,
): void {
  const markers = state.get('markers').map(m =>
    m.id === id ? { ...m, ...updates } : m
  );
  state.set('markers', markers);
  const updated = markers.find(m => m.id === id);
  if (updated) bus.emit('marker:updated', { marker: updated });
}

/** Remove marker */
export function removeMarker(id: string): void {
  const markers = state.get('markers').filter(m => m.id !== id);
  state.set('markers', markers);
  bus.emit('marker:removed', { id });
}

/** Clear all markers */
export function clearMarkers(): void {
  state.set('markers', []);
  bus.emit('markers:cleared');
}
