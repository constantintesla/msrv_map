import { $ } from '../utils/dom';
import { renderToCanvas, getRecommendedZoom } from '../export/png-renderer';

let modalVisible = false;

export function showPngPreviewModal(onExport: (zoneMode: string, zoom: number) => void): void {
  if (modalVisible) return;
  modalVisible = true;

  const defaultZoom = getRecommendedZoom('grid');

  const overlay = $<HTMLDivElement>('#modal-overlay');
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="modal modal--png">
      <div class="modal__header">
        <span class="modal__title">Экспорт PNG</span>
        <button class="modal__close" id="btn-close-png">&times;</button>
      </div>
      <div class="modal__body">
        <div class="preview-controls">
          <div class="field--inline">
            <label class="label" style="margin:0;">Зона:</label>
            <select class="select" id="select-png-zone" style="width:auto;">
              <option value="grid">По сетке</option>
              <option value="zone">Выбранная зона</option>
              <option value="screen">Текущий экран</option>
            </select>
          </div>
          <div class="field--inline">
            <label class="label" style="margin:0;">Масштаб:</label>
            <input type="range" id="range-png-zoom" min="10" max="19" step="0.5" value="${defaultZoom}" style="width:120px;">
            <span id="png-zoom-value" style="font-size:0.8rem;min-width:24px;">${defaultZoom}</span>
          </div>
        </div>
        <div class="preview-container" id="png-preview-container">
          <div class="preview-loading" id="png-preview-loading" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-secondary);font-size:0.85rem;">
            Загрузка предпросмотра...
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="btn-cancel-png">Отмена</button>
        <button class="btn btn--success" id="btn-do-export-png">Экспортировать PNG</button>
      </div>
    </div>
  `;

  const zoomRange = $<HTMLInputElement>('#range-png-zoom');
  const zoomValue = $<HTMLSpanElement>('#png-zoom-value');
  const previewContainer = $<HTMLDivElement>('#png-preview-container');

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function updatePreview() {
    const loading = document.getElementById('png-preview-loading');
    if (!loading) {
      previewContainer.innerHTML = '<div id="png-preview-loading" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-secondary);font-size:0.85rem;">Загрузка предпросмотра...</div>';
    } else {
      loading.style.display = 'flex';
    }

    const zoneMode = $<HTMLSelectElement>('#select-png-zone').value;
    const zoom = parseFloat(zoomRange.value);

    const canvas = await renderToCanvas(zoneMode, zoom, 800);
    if (!modalVisible) return;

    previewContainer.innerHTML = '';
    if (canvas) {
      canvas.style.maxWidth = '100%';
      canvas.style.maxHeight = '100%';
      canvas.style.objectFit = 'contain';
      previewContainer.appendChild(canvas);
    } else {
      previewContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-secondary);font-size:0.85rem;">Нет данных для предпросмотра</div>';
    }
  }

  function schedulePreview() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updatePreview, 300);
  }

  zoomRange.addEventListener('input', () => {
    zoomValue.textContent = zoomRange.value;
    schedulePreview();
  });

  $<HTMLSelectElement>('#select-png-zone').addEventListener('change', schedulePreview);

  // Initial preview
  updatePreview();

  function close() {
    modalVisible = false;
    if (debounceTimer) clearTimeout(debounceTimer);
    overlay.style.display = 'none';
    overlay.innerHTML = '';
  }

  $<HTMLButtonElement>('#btn-close-png').addEventListener('click', close);
  $<HTMLButtonElement>('#btn-cancel-png').addEventListener('click', close);

  $<HTMLButtonElement>('#btn-do-export-png').addEventListener('click', () => {
    const zoneMode = $<HTMLSelectElement>('#select-png-zone').value;
    const zoom = parseFloat(zoomRange.value);
    close();
    onExport(zoneMode, zoom);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}
