import { $ } from '../utils/dom';
import { clearGrid } from '../core/grid-render';
import { clearMarkers } from '../core/markers';
import { clearZone } from '../core/zone';
import { importFile } from '../export/kml-parser';
import { renderAll } from '../core/grid-render';
import { renderAllMarkers } from '../core/markers-render';
import { listProjects, saveProject, loadProject, deleteProject } from '../core/projects';
import { state } from '../core/state';
import { bus } from '../core/events';

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

  // Projects list
  function renderProjectsList() {
    const projects = listProjects();
    const list = $<HTMLDivElement>('#projects-list');

    if (projects.length === 0) {
      list.innerHTML = '<div style="font-size:0.8rem;color:var(--color-text-secondary);">Нет проектов</div>';
      return;
    }

    list.innerHTML = projects.map(p => {
      const date = new Date(p.updatedAt).toLocaleDateString('ru-RU');
      return `<div style="display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0;border-bottom:1px solid var(--color-border);font-size:0.8rem;" data-project="${p.id}">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:500;">${p.name}</div>
          <div style="color:var(--color-text-secondary);font-size:0.7rem;">${date}</div>
        </div>
        <button class="btn btn--secondary btn--sm project-load">Загрузить</button>
        <button class="btn btn--ghost btn--sm project-delete">🗑️</button>
      </div>`;
    }).join('');

    list.querySelectorAll('[data-project]').forEach(item => {
      const id = (item as HTMLElement).dataset.project!;
      item.querySelector('.project-load')?.addEventListener('click', () => {
        if (confirm('Загрузить проект? Текущие данные будут заменены.')) {
          loadProject(id);
          renderAll();
          renderAllMarkers();
        }
      });
      item.querySelector('.project-delete')?.addEventListener('click', () => {
        if (confirm('Удалить проект?')) {
          deleteProject(id);
          renderProjectsList();
        }
      });
    });
  }

  $<HTMLButtonElement>('#btn-save-project').addEventListener('click', () => {
    const nameInput = $<HTMLInputElement>('#input-project-name');
    const name = nameInput.value.trim();
    if (!name) { alert('Введите название проекта'); return; }
    if (state.get('markers').length === 0 && state.get('gridSquares').length === 0) {
      alert('Нечего сохранять — создайте сетку или добавьте метки');
      return;
    }
    saveProject(name);
    nameInput.value = '';
    renderProjectsList();
  });

  bus.on('project:loaded', renderProjectsList);
  renderProjectsList();
}
