import type { LeafletMouseEvent } from 'leaflet';
import { $ } from '../utils/dom';
import { state } from '../core/state';
import { bus } from '../core/events';
import { addMarker, removeMarker, updateMarker } from '../core/markers';
import { getMap } from '../core/map';
import { MARKER_COLORS, MARKER_TYPE_NAMES } from '../constants';
import { CURATED_ICONS } from '../constants/curated-icons';
import type { MarkerType } from '../types';

export function initTabMarkers(): void {
  const container = $<HTMLDivElement>('#tab-markers');

  container.innerHTML = `
    <div class="section">
      <div class="section__title">Добавить метку</div>
      <div class="field">
        <label class="label">Тип</label>
        <select class="select" id="select-marker-type">
          ${Object.entries(MARKER_TYPE_NAMES).map(([val, name]) =>
            `<option value="${val}">${name}</option>`
          ).join('')}
        </select>
      </div>
      <div class="field">
        <label class="label">Подпись</label>
        <input type="text" class="input" id="input-marker-name" placeholder="Название точки">
      </div>
      <div class="field">
        <label class="label">Описание</label>
        <textarea class="textarea" id="input-marker-desc" rows="2" placeholder="Описание"></textarea>
      </div>
      <button class="btn btn--primary btn--full" id="btn-marker-mode">Режим добавления меток</button>
    </div>

    <div class="section">
      <label class="checkbox">
        <input type="checkbox" id="chk-point-labels" ${state.get('showPointLabels') ? 'checked' : ''}>
        Показывать подписи точек
      </label>
      <div class="field" style="margin-top:0.4rem;">
        <label class="label">Шрифт подписей (px)</label>
        <input type="number" class="input input--sm" id="input-point-font" value="${state.get('pointFontSize')}" min="8" max="48">
      </div>
    </div>

    <div class="section">
      <div class="section__title">Список меток (<span id="marker-count">0</span>)</div>
      <div id="markers-list" style="max-height:300px; overflow-y:auto;"></div>
    </div>

    <div class="section" id="marker-editor" style="display:none;">
      <div class="section__title">Редактирование метки</div>
      <div class="field">
        <label class="label">Тип</label>
        <select class="select" id="edit-marker-type">
          ${Object.entries(MARKER_TYPE_NAMES).map(([val, name]) =>
            `<option value="${val}">${name}</option>`
          ).join('')}
        </select>
      </div>
      <div class="field">
        <label class="label">Цвет кружка</label>
        <input type="color" class="input" id="edit-marker-color">
        <small style="color:var(--color-text-secondary);">Игнорируется, если выбрана иконка.</small>
      </div>
      <div class="field">
        <label class="label">Иконка</label>
        <div id="edit-marker-icons" style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;max-height:180px;overflow-y:auto;padding:4px;border:1px solid var(--color-border);border-radius:4px;"></div>
        <div style="margin-top:0.4rem;">
          <label class="label">Свой URL (опционально)</label>
          <input type="url" class="input" id="edit-marker-icon-url" placeholder="https://...">
        </div>
      </div>
      <div class="field">
        <label class="label">Подпись</label>
        <input type="text" class="input" id="edit-marker-name">
      </div>
      <div class="field">
        <label class="label">Описание</label>
        <textarea class="textarea" id="edit-marker-desc" rows="2"></textarea>
      </div>
      <div style="display:flex;gap:0.5rem;">
        <button class="btn btn--primary" id="edit-marker-save">Сохранить</button>
        <button class="btn btn--ghost" id="edit-marker-cancel">Отмена</button>
      </div>
    </div>
  `;

  // Marker mode toggle
  const modeBtn = $<HTMLButtonElement>('#btn-marker-mode');
  let markerModeActive = false;

  // === Marker editor state ===
  let editingId: string | null = null;

  function openEditor(id: string) {
    const m = state.get('markers').find(x => x.id === id);
    if (!m) return;
    editingId = id;

    const editor = $<HTMLDivElement>('#marker-editor');
    editor.style.display = '';

    $<HTMLSelectElement>('#edit-marker-type').value = m.type;
    $<HTMLInputElement>('#edit-marker-color').value = m.color ?? MARKER_COLORS[m.type];
    $<HTMLInputElement>('#edit-marker-name').value = m.name;
    $<HTMLTextAreaElement>('#edit-marker-desc').value = m.description;
    $<HTMLInputElement>('#edit-marker-icon-url').value =
      m.icon && !CURATED_ICONS.some(c => c.remoteUrl === m.icon) ? m.icon : '';

    renderIconGrid(m.icon);
    updateColorEnabled();
  }

  function closeEditor() {
    editingId = null;
    $<HTMLDivElement>('#marker-editor').style.display = 'none';
  }

  function renderIconGrid(selected: string | undefined) {
    const grid = $<HTMLDivElement>('#edit-marker-icons');
    const tiles: string[] = [];
    tiles.push(`<button type="button" class="icon-tile ${!selected ? 'icon-tile--active' : ''}" data-url="" title="Без иконки (кружок)" style="aspect-ratio:1;border:1px solid var(--color-border);background:var(--color-bg);border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;">✖</button>`);
    for (const ic of CURATED_ICONS) {
      const isActive = selected === ic.remoteUrl;
      tiles.push(`<button type="button" class="icon-tile ${isActive ? 'icon-tile--active' : ''}" data-url="${ic.remoteUrl}" title="${ic.label}" style="aspect-ratio:1;border:1px solid ${isActive ? 'var(--color-accent,#667eea)' : 'var(--color-border)'};background:${isActive ? 'rgba(102,126,234,0.15)' : 'var(--color-bg)'};border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:2px;"><img src="${ic.localUrl}" alt="${ic.label}" style="max-width:100%;max-height:100%;object-fit:contain;"></button>`);
    }
    grid.innerHTML = tiles.join('');

    grid.querySelectorAll<HTMLButtonElement>('.icon-tile').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.icon-tile').forEach(b => (b as HTMLElement).classList.remove('icon-tile--active'));
        btn.classList.add('icon-tile--active');
        $<HTMLInputElement>('#edit-marker-icon-url').value = '';
        updateColorEnabled();
      });
    });
  }

  function currentIconSelection(): string | undefined {
    const customUrl = $<HTMLInputElement>('#edit-marker-icon-url').value.trim();
    if (customUrl) return customUrl;
    const active = $<HTMLDivElement>('#edit-marker-icons').querySelector('.icon-tile--active') as HTMLButtonElement | null;
    const url = active?.dataset.url ?? '';
    return url || undefined;
  }

  function updateColorEnabled() {
    const hasIcon = !!currentIconSelection();
    const colorInput = $<HTMLInputElement>('#edit-marker-color');
    colorInput.disabled = hasIcon;
    colorInput.style.opacity = hasIcon ? '0.5' : '1';
  }

  modeBtn.addEventListener('click', () => {
    markerModeActive = !markerModeActive;
    state.set('markerMode', markerModeActive);
    bus.emit('mode:marker', { active: markerModeActive });

    modeBtn.textContent = markerModeActive ? 'Отключить режим меток' : 'Режим добавления меток';
    modeBtn.classList.toggle('btn--danger', markerModeActive);
    modeBtn.classList.toggle('btn--primary', !markerModeActive);

    const indicator = document.getElementById('mode-indicator')!;
    if (markerModeActive) {
      indicator.textContent = '📍 Режим добавления меток (Esc — выход)';
      indicator.style.display = '';
      getMap().getContainer().style.cursor = 'crosshair';
    } else {
      indicator.style.display = 'none';
      getMap().getContainer().style.cursor = '';
    }
  });

  // Escape to exit marker mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && markerModeActive) {
      modeBtn.click();
    }
  });

  // Click on map to add marker
  getMap().on('click', (e: LeafletMouseEvent) => {
    if (!state.get('markerMode')) return;

    const type = $<HTMLSelectElement>('#select-marker-type').value as MarkerType;
    const name = $<HTMLInputElement>('#input-marker-name').value;
    const description = $<HTMLTextAreaElement>('#input-marker-desc').value;

    addMarker({ lat: e.latlng.lat, lng: e.latlng.lng }, type, name, description);

    // Clear name field for next marker
    $<HTMLInputElement>('#input-marker-name').value = '';
  });

  // Point labels toggle
  $<HTMLInputElement>('#chk-point-labels').addEventListener('change', (e) => {
    state.set('showPointLabels', (e.target as HTMLInputElement).checked);
    bus.emit('grid:display-changed');
  });

  $<HTMLInputElement>('#input-point-font').addEventListener('change', (e) => {
    state.set('pointFontSize', parseInt((e.target as HTMLInputElement).value) || 12);
    bus.emit('grid:display-changed');
  });

  // Render markers list
  function renderMarkersList() {
    const markers = state.get('markers');
    const list = $<HTMLDivElement>('#markers-list');
    $<HTMLSpanElement>('#marker-count').textContent = String(markers.length);

    if (markers.length === 0) {
      list.innerHTML = '<div style="font-size:0.8rem;color:var(--color-text-secondary);padding:0.5rem 0;">Нет меток</div>';
      return;
    }

    list.innerHTML = markers.map(m => {
      const color = MARKER_COLORS[m.type];
      return `<div class="marker-item" data-id="${m.id}" style="display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0;border-bottom:1px solid var(--color-border);font-size:0.8rem;">
        <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></span>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.name || MARKER_TYPE_NAMES[m.type]}</div>
          <div style="color:var(--color-text-secondary);font-size:0.75rem;">${m.latlng.lat.toFixed(4)}, ${m.latlng.lng.toFixed(4)}</div>
        </div>
        <button class="btn btn--ghost btn--sm marker-edit" title="Редактировать">✏️</button>
        <button class="btn btn--ghost btn--sm marker-delete" title="Удалить">🗑️</button>
      </div>`;
    }).join('');

    // Event delegation
    list.querySelectorAll('.marker-item').forEach(item => {
      const id = (item as HTMLElement).dataset.id!;

      item.querySelector('.marker-edit')?.addEventListener('click', () => {
        openEditor(id);
      });

      item.querySelector('.marker-delete')?.addEventListener('click', () => {
        removeMarker(id);
      });

      // Click on item → pan to marker
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        const m = state.get('markers').find(x => x.id === id);
        if (m) getMap().panTo([m.latlng.lat, m.latlng.lng]);
      });
    });
  }

  // === Marker editor handlers ===
  $<HTMLButtonElement>('#edit-marker-save').addEventListener('click', () => {
    if (!editingId) return;
    const type = $<HTMLSelectElement>('#edit-marker-type').value as MarkerType;
    const icon = currentIconSelection();
    const colorInput = $<HTMLInputElement>('#edit-marker-color');
    const color = icon ? undefined : colorInput.value;
    const name = $<HTMLInputElement>('#edit-marker-name').value;
    const description = $<HTMLTextAreaElement>('#edit-marker-desc').value;
    updateMarker(editingId, { type, icon, color, name, description });
    closeEditor();
  });

  $<HTMLButtonElement>('#edit-marker-cancel').addEventListener('click', closeEditor);

  $<HTMLInputElement>('#edit-marker-icon-url').addEventListener('input', () => {
    const grid = $<HTMLDivElement>('#edit-marker-icons');
    grid.querySelectorAll('.icon-tile').forEach(b => (b as HTMLElement).classList.remove('icon-tile--active'));
    updateColorEnabled();
  });

  bus.on('marker:edit-request', ({ id }) => openEditor(id));

  bus.on('marker:added', renderMarkersList);
  bus.on('marker:updated', renderMarkersList);
  bus.on('marker:removed', renderMarkersList);
  bus.on('markers:cleared', renderMarkersList);
  bus.on('project:loaded', renderMarkersList);
  bus.on('state:reset', renderMarkersList);
  renderMarkersList();
}
