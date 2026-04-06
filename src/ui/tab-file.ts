import { $ } from '../utils/dom';
import { clearGrid } from '../core/grid-render';
import { clearMarkers } from '../core/markers';
import { clearZone } from '../core/zone';
import { importFile } from '../export/kml-parser';
import { renderAll } from '../core/grid-render';
import { renderAllMarkers } from '../core/markers-render';

export function initTabFile(): void {
  const container = $<HTMLDivElement>('#tab-file');

  container.innerHTML = `
    <div class="section">
      <div class="section__title">Проект</div>
      <div class="field">
        <label class="label">Название</label>
        <input type="text" class="input" id="input-project-name" placeholder="Название проекта">
      </div>
      <button class="btn btn--success btn--full" id="btn-save-project" style="margin-top:0.4rem;">Сохранить проект</button>
      <div style="margin-top:0.75rem;">
        <div style="font-size:0.8rem;font-weight:600;color:var(--color-text-secondary);margin-bottom:0.4rem;">Сохранённые:</div>
        <div id="projects-list" style="max-height:200px;overflow-y:auto;">
          <div style="font-size:0.8rem;color:var(--color-text-secondary);">Нет проектов</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section__title">Импорт</div>
      <label class="btn btn--primary btn--full" style="cursor:pointer;">
        Импортировать KMZ/KML
        <input type="file" id="input-import" accept=".kmz,.kml" style="display:none;">
      </label>
      <div style="font-size:0.75rem;color:var(--color-text-secondary);margin-top:0.3rem;">
        ⚠ Текущие данные будут заменены
      </div>
    </div>

    <div class="section">
      <div class="section__title">Очистка</div>
      <div style="display:flex;flex-direction:column;gap:0.3rem;">
        <button class="btn btn--secondary btn--full" id="btn-clear-grid-file">Очистить сетку</button>
        <button class="btn btn--secondary btn--full" id="btn-clear-markers-file">Очистить метки</button>
        <button class="btn btn--danger btn--full" id="btn-clear-all">Очистить всё</button>
      </div>
    </div>
  `;

  // Clear buttons
  $<HTMLButtonElement>('#btn-clear-grid-file').addEventListener('click', clearGrid);

  $<HTMLButtonElement>('#btn-clear-markers-file').addEventListener('click', () => {
    if (confirm('Удалить все метки?')) clearMarkers();
  });

  $<HTMLButtonElement>('#btn-clear-all').addEventListener('click', () => {
    if (confirm('Удалить сетку, метки и выбранную зону?')) {
      clearGrid();
      clearMarkers();
      clearZone();
    }
  });

  // Wire import
  $<HTMLInputElement>('#input-import').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!confirm('Текущие данные будут заменены. Продолжить?')) return;
    try {
      await importFile(file);
      renderAll();
      renderAllMarkers();
    } catch (err) {
      alert('Ошибка импорта: ' + (err as Error).message);
    }
    (e.target as HTMLInputElement).value = '';
  });
}
