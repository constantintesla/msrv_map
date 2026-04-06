import { $ } from '../utils/dom';

let modalVisible = false;

export function showPngPreviewModal(onExport: (zoneMode: string, zoom: number) => void): void {
  if (modalVisible) return;
  modalVisible = true;

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
            <input type="range" id="range-png-zoom" min="10" max="18" step="0.5" value="14" style="width:120px;">
            <span id="png-zoom-value" style="font-size:0.8rem;min-width:24px;">14</span>
          </div>
        </div>
        <div class="preview-container" id="png-preview-container">
          <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-secondary);font-size:0.85rem;">
            Предпросмотр будет здесь
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
  zoomRange.addEventListener('input', () => {
    zoomValue.textContent = zoomRange.value;
  });

  function close() {
    overlay.style.display = 'none';
    overlay.innerHTML = '';
    modalVisible = false;
  }

  $<HTMLButtonElement>('#btn-close-png').addEventListener('click', close);
  $<HTMLButtonElement>('#btn-cancel-png').addEventListener('click', close);

  $<HTMLButtonElement>('#btn-do-export-png').addEventListener('click', () => {
    const zoneMode = $<HTMLSelectElement>('#select-png-zone').value;
    const zoom = parseFloat(zoomRange.value);
    close();
    onExport(zoneMode, zoom);
  });

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Close on Escape
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}
