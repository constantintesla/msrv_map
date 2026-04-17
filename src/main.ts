import '../styles/main.css';
import '../styles/sidebar.css';
import '../styles/map.css';
import '../styles/modals.css';
import { initMap } from './core/map';
import { initSidebar, initCollapsibles } from './ui/sidebar';
import { initTabMap } from './ui/tab-map';
import { initTabGrid } from './ui/tab-grid';
import { initTabMarkers } from './ui/tab-markers';
import { initTabFile } from './ui/tab-file';
import { initExportPanel } from './ui/export-panel';
import { showPngPreviewModal } from './ui/modal-png';
import { showHelpModal } from './ui/modal-help';
import { exportKmz, exportKml } from './export/kmz';
import { exportPng } from './export/png-renderer';
// Import render modules to register event listeners
import './core/grid-render';
import './core/markers-render';

document.addEventListener('DOMContentLoaded', () => {
  initMap('map');
  initSidebar();
  initTabMap();
  initTabGrid();
  initTabMarkers();
  initTabFile();
  initCollapsibles();
  initExportPanel({
    onExportKMZ: () => exportKmz(),
    onExportKML: () => exportKml(),
    onExportPNG: () => showPngPreviewModal((zoneMode, zoom) => {
      exportPng(zoneMode, zoom);
    }),
  });

  const helpBtn = document.getElementById('btn-header-help');
  helpBtn?.addEventListener('click', () => showHelpModal());

  // Show instructions on first render of the session
  showHelpModal();
});
