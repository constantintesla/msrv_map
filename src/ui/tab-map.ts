import { $ } from '../utils/dom';
import { TILE_PROVIDERS } from '../constants';
import { state } from '../core/state';
import { loadTileLayer } from '../core/map';
import { bus } from '../core/events';

export function initTabMap(): void {
  const container = $<HTMLDivElement>('#tab-map');

  container.innerHTML = `
    <div class="section">
      <div class="section__title">Подложка карты</div>
      ${TILE_PROVIDERS.map(p => `
        <label class="checkbox" style="margin-bottom: 0.3rem;">
          <input type="radio" name="map-type" value="${p.type}"
            ${p.type === state.get('mapType') ? 'checked' : ''}>
          ${p.name}
        </label>
      `).join('')}
    </div>
  `;

  container.querySelectorAll<HTMLInputElement>('input[name="map-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        loadTileLayer(radio.value as any);
      }
    });
  });

  bus.on('project:loaded', () => {
    const current = state.get('mapType');
    container.querySelectorAll<HTMLInputElement>('input[name="map-type"]').forEach(r => {
      r.checked = r.value === current;
    });
  });
}
