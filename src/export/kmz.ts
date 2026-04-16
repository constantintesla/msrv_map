import JSZip from 'jszip';
import { state } from '../core/state';
import { buildKml } from './kml-builder';
import { downloadBlob, downloadText } from '../utils/download';

/** Build KML content from current state */
function buildStateKml() {
  return buildKml({
    markers: state.get('markers'),
    squares: state.get('gridSquares'),
    gridBounds: state.get('gridBounds'),
    gridSize: state.get('gridSize'),
    gridColor: state.get('gridColor'),
    gridWeight: state.get('gridWeight'),
    showSquareNames: state.get('showSquareNames'),
    showPointLabels: state.get('showPointLabels'),
    showEdgeLabels: state.get('showEdgeLabels'),
    startLetter: state.get('startLetter'),
  });
}

/** Export KMZ file (vector KML packed in ZIP) */
export async function exportKmz(): Promise<void> {
  const squares = state.get('gridSquares');

  if (squares.length === 0 && state.get('markers').length === 0) {
    alert('Нечего экспортировать. Создайте сетку или добавьте метки.');
    return;
  }

  const zip = new JSZip();
  zip.file('doc.kml', buildStateKml());

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, 'map.kmz');
}

/** Export KML file (vector grid) */
export function exportKml(): void {
  downloadText(buildStateKml(), 'map.kml', 'application/vnd.google-earth.kml+xml');
}

/** Unpack KMZ to KML string */
export async function unpackKmz(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  let kmlPath = '';
  zip.forEach((path) => {
    if (path.endsWith('.kml') && !kmlPath) {
      kmlPath = path;
    }
  });

  if (!kmlPath) throw new Error('KML файл не найден в KMZ архиве');

  return await zip.file(kmlPath)!.async('text');
}
