import '../styles/main.css';
import '../styles/converter.css';
import { convertFile } from './converter/converter';
import { downloadBlob, downloadText } from './utils/download';
import { $ } from './utils/dom';

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = $<HTMLInputElement>('#input-file');
  const fileName = $<HTMLSpanElement>('#file-name');
  const outputName = $<HTMLInputElement>('#input-output-name');
  const convertBtn = $<HTMLButtonElement>('#btn-convert');
  const resultsDiv = $<HTMLDivElement>('#results');
  const resultsList = $<HTMLDivElement>('#results-list');

  let selectedFile: File | null = null;

  fileInput.addEventListener('change', () => {
    selectedFile = fileInput.files?.[0] ?? null;
    if (selectedFile) {
      fileName.textContent = selectedFile.name;
      const baseName = selectedFile.name.replace(/\.\w+$/, '');
      outputName.value = baseName;
      convertBtn.disabled = false;
    }
  });

  convertBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    convertBtn.disabled = true;
    convertBtn.textContent = 'Конвертация...';

    try {
      const result = await convertFile(selectedFile);
      const name = outputName.value.trim() || 'converted';

      resultsDiv.style.display = '';
      resultsList.innerHTML = `
        <div class="result-item">
          <span>📄 ${name}.kml</span>
          <button class="btn btn--secondary btn--sm" id="dl-kml">Скачать</button>
        </div>
        <div class="result-item">
          <span>📦 ${name}.kmz</span>
          <button class="btn btn--secondary btn--sm" id="dl-kmz">Скачать</button>
        </div>
        <div class="result-item">
          <span>📍 ${name}.gpx</span>
          <button class="btn btn--secondary btn--sm" id="dl-gpx">Скачать</button>
        </div>
      `;

      $<HTMLButtonElement>('#dl-kml').addEventListener('click', () =>
        downloadText(result.kml, `${name}.kml`, 'application/vnd.google-earth.kml+xml'));
      $<HTMLButtonElement>('#dl-kmz').addEventListener('click', () =>
        downloadBlob(result.kmz, `${name}.kmz`));
      $<HTMLButtonElement>('#dl-gpx').addEventListener('click', () =>
        downloadText(result.gpx, `${name}.gpx`, 'application/gpx+xml'));

    } catch (err) {
      alert('Ошибка конвертации: ' + (err as Error).message);
    } finally {
      convertBtn.disabled = false;
      convertBtn.textContent = 'Конвертировать';
    }
  });
});
