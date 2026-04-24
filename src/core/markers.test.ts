import { describe, it, expect, beforeEach } from 'vitest';
import { state } from './state';
import { addMarker, updateMarker } from './markers';

describe('updateMarker', () => {
  beforeEach(() => {
    state.set('markers', []);
  });

  it('updates color and icon fields', () => {
    const m = addMarker({ lat: 0, lng: 0 }, 'default', 'test', '');
    updateMarker(m.id, { color: '#ff0000', icon: 'https://example.com/x.png' });
    const updated = state.get('markers').find(x => x.id === m.id)!;
    expect(updated.color).toBe('#ff0000');
    expect(updated.icon).toBe('https://example.com/x.png');
  });

  it('allows clearing icon by setting undefined', () => {
    const m = addMarker({ lat: 0, lng: 0 }, 'default', 'test', '');
    updateMarker(m.id, { icon: 'https://example.com/x.png' });
    updateMarker(m.id, { icon: undefined });
    const updated = state.get('markers').find(x => x.id === m.id)!;
    expect(updated.icon).toBeUndefined();
  });

  it('allows changing type', () => {
    const m = addMarker({ lat: 0, lng: 0 }, 'default', 'test', '');
    updateMarker(m.id, { type: 'danger' });
    const updated = state.get('markers').find(x => x.id === m.id)!;
    expect(updated.type).toBe('danger');
  });
});
