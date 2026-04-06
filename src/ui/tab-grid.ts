import { $ } from '../utils/dom';
import { state } from '../core/state';
import { bus } from '../core/events';
import { createGrid, clearGrid, shiftGrid, refreshGrid } from '../core/grid-render';
import { startZoneSelection, clearZone } from '../core/zone';

export function initTabGrid(): void {
  const container = $<HTMLDivElement>('#tab-grid');

  container.innerHTML = `
    <!-- Zone -->
    <div class="section">
      <div class="section__title">Зона</div>
      <div class="field--row">
        <button class="btn btn--primary btn--full" id="btn-select-zone">Выбрать зону</button>
        <button class="btn btn--secondary btn--full" id="btn-clear-zone" style="display:none;">Очистить</button>
      </div>
      <div id="zone-info" style="display:none; margin-top:0.4rem; font-size:0.8rem; color:var(--color-text-secondary);"></div>
    </div>

    <!-- Grid params -->
    <div class="section">
      <div class="section__title">Параметры</div>
      <div class="field">
        <label class="label">Размер ячейки (м)</label>
        <input type="number" class="input" id="input-grid-size" value="${state.get('gridSize')}" min="10" max="10000" step="10">
      </div>
      <div class="field">
        <label class="label">Начальная буква</label>
        <input type="text" class="input" id="input-start-letter" value="${state.get('startLetter')}" maxlength="1" style="width:60px;">
      </div>
      <div class="field--row" style="margin-top:0.5rem;">
        <button class="btn btn--primary btn--full" id="btn-create-grid">Создать сетку</button>
        <button class="btn btn--secondary btn--full" id="btn-clear-grid">Очистить</button>
      </div>
    </div>

    <!-- Shift -->
    <div class="section">
      <div class="section__title">Сдвиг сетки</div>
      <div class="field--inline">
        <label class="label" style="margin:0;">Шаг:</label>
        <input type="number" class="input input--sm" id="input-shift-step" value="${state.get('gridShiftStep')}" min="1" max="10000">
        <span style="font-size:0.8rem;">м</span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-top:0.4rem; max-width:150px;">
        <div></div>
        <button class="btn btn--secondary btn--sm" data-shift="up">↑</button>
        <div></div>
        <button class="btn btn--secondary btn--sm" data-shift="left">←</button>
        <button class="btn btn--secondary btn--sm" id="btn-refresh-grid">↻</button>
        <button class="btn btn--secondary btn--sm" data-shift="right">→</button>
        <div></div>
        <button class="btn btn--secondary btn--sm" data-shift="down">↓</button>
        <div></div>
      </div>
    </div>

    <!-- Appearance (collapsible) -->
    <div class="section collapsible collapsible--closed">
      <div class="collapsible__header section__title">Оформление</div>
      <div class="collapsible__body">
        <div class="field">
          <label class="label">Цвет линий</label>
          <input type="color" class="input" id="input-grid-color" value="${state.get('gridColor')}" style="height:32px;padding:2px;">
        </div>
        <div class="field">
          <label class="label">Толщина линий (px)</label>
          <input type="number" class="input input--sm" id="input-grid-weight" value="${state.get('gridWeight')}" min="1" max="10">
        </div>
        <div class="field">
          <label class="label">Шрифт</label>
          <select class="select" id="select-font-family">
            <option value="Arial, sans-serif">Arial</option>
            <option value="'Segoe UI', sans-serif">Segoe UI</option>
            <option value="'Roboto', sans-serif">Roboto</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
          </select>
        </div>
        <div class="field">
          <label class="label">Шрифт квадратов (px)</label>
          <input type="number" class="input input--sm" id="input-sq-font" value="${state.get('squareFontSize')}" min="8" max="48">
        </div>
        <div class="field">
          <label class="label">Шрифт краевых меток (px)</label>
          <input type="number" class="input input--sm" id="input-edge-font" value="${state.get('edgeFontSize')}" min="8" max="48">
        </div>
        <div class="field">
          <label class="checkbox">
            <input type="checkbox" id="chk-show-names" ${state.get('showSquareNames') ? 'checked' : ''}>
            Названия квадратов
          </label>
        </div>
        <div class="field">
          <label class="label">Положение подписи</label>
          <select class="select" id="select-name-pos">
            <option value="top-left">Лево-верх</option>
            <option value="top-center">Центр-верх</option>
            <option value="top-right">Право-верх</option>
            <option value="center-left">Лево-центр</option>
            <option value="center">Центр</option>
            <option value="center-right">Право-центр</option>
            <option value="bottom-left">Лево-низ</option>
            <option value="bottom-center">Центр-низ</option>
            <option value="bottom-right" selected>Право-низ</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Edge labels (collapsible) -->
    <div class="section collapsible collapsible--closed">
      <div class="collapsible__header section__title">Краевые метки</div>
      <div class="collapsible__body">
        <label class="checkbox"><input type="checkbox" id="chk-edge-left" ${state.get('showEdgeLabels').left ? 'checked' : ''}> Слева (буквы)</label>
        <label class="checkbox"><input type="checkbox" id="chk-edge-right" ${state.get('showEdgeLabels').right ? 'checked' : ''}> Справа (буквы)</label>
        <label class="checkbox"><input type="checkbox" id="chk-edge-top" ${state.get('showEdgeLabels').top ? 'checked' : ''}> Сверху (цифры)</label>
        <label class="checkbox"><input type="checkbox" id="chk-edge-bottom" ${state.get('showEdgeLabels').bottom ? 'checked' : ''}> Снизу (цифры)</label>
      </div>
    </div>
  `;

  // Wire up events
  $<HTMLButtonElement>('#btn-select-zone').addEventListener('click', startZoneSelection);
  $<HTMLButtonElement>('#btn-clear-zone').addEventListener('click', clearZone);

  $<HTMLButtonElement>('#btn-create-grid').addEventListener('click', () => {
    state.set('gridSize', parseInt($<HTMLInputElement>('#input-grid-size').value) || 100);
    state.set('startLetter', $<HTMLInputElement>('#input-start-letter').value || 'A');
    createGrid();
  });
  $<HTMLButtonElement>('#btn-clear-grid').addEventListener('click', clearGrid);

  // Shift buttons
  container.querySelectorAll<HTMLButtonElement>('[data-shift]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.set('gridShiftStep', parseInt($<HTMLInputElement>('#input-shift-step').value) || 10);
      shiftGrid(btn.dataset.shift as any);
    });
  });

  $<HTMLButtonElement>('#btn-refresh-grid').addEventListener('click', refreshGrid);

  // Style changes
  const styleInputs = ['#input-grid-color', '#input-grid-weight', '#select-font-family',
    '#input-sq-font', '#input-edge-font', '#chk-show-names', '#select-name-pos',
    '#chk-edge-left', '#chk-edge-right', '#chk-edge-top', '#chk-edge-bottom'];

  function syncStyleState() {
    state.patch({
      gridColor: $<HTMLInputElement>('#input-grid-color').value,
      gridWeight: parseInt($<HTMLInputElement>('#input-grid-weight').value) || 2,
      fontFamily: $<HTMLSelectElement>('#select-font-family').value,
      squareFontSize: parseInt($<HTMLInputElement>('#input-sq-font').value) || 11,
      edgeFontSize: parseInt($<HTMLInputElement>('#input-edge-font').value) || 12,
      showSquareNames: $<HTMLInputElement>('#chk-show-names').checked,
      squareNamePosition: $<HTMLSelectElement>('#select-name-pos').value as any,
      showEdgeLabels: {
        left: $<HTMLInputElement>('#chk-edge-left').checked,
        right: $<HTMLInputElement>('#chk-edge-right').checked,
        top: $<HTMLInputElement>('#chk-edge-top').checked,
        bottom: $<HTMLInputElement>('#chk-edge-bottom').checked,
      },
    });
    bus.emit('grid:style-changed');
  }

  styleInputs.forEach(sel => {
    const el = container.querySelector(sel);
    if (el) el.addEventListener('change', syncStyleState);
  });

  // Zone events
  bus.on('zone:selected', () => {
    $<HTMLButtonElement>('#btn-clear-zone').style.display = '';
    $<HTMLDivElement>('#zone-info').style.display = '';
    $<HTMLDivElement>('#zone-info').textContent = 'Зона выбрана';
  });

  bus.on('zone:cleared', () => {
    $<HTMLButtonElement>('#btn-clear-zone').style.display = 'none';
    $<HTMLDivElement>('#zone-info').style.display = 'none';
  });
}
