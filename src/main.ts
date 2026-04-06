import { initMap } from './core/map';
import { createGrid } from './core/grid-render';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="map" style="width:100vw;height:100vh;"></div>
`;

const map = initMap('map');

// Temp test: create grid after map loads
map.whenReady(() => {
  setTimeout(() => createGrid(), 500);
});
