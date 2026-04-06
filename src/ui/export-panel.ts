import { $ } from '../utils/dom';

export function initExportPanel(handlers: {
  onExportKMZ: () => void;
  onExportKML: () => void;
  onExportPNG: () => void;
}): void {
  const container = $<HTMLDivElement>('#export-panel');

  container.innerHTML = `
    <div class="export-panel__title">Экспорт</div>
    <div class="export-panel__buttons">
      <button class="btn btn--success btn--sm" id="btn-export-kmz">KMZ</button>
      <button class="btn btn--success btn--sm" id="btn-export-kml">KML</button>
      <button class="btn btn--success btn--sm" id="btn-export-png">PNG 🔍</button>
    </div>
  `;

  $<HTMLButtonElement>('#btn-export-kmz').addEventListener('click', handlers.onExportKMZ);
  $<HTMLButtonElement>('#btn-export-kml').addEventListener('click', handlers.onExportKML);
  $<HTMLButtonElement>('#btn-export-png').addEventListener('click', handlers.onExportPNG);
}
