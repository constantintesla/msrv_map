import { initMap } from './core/map';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="map" style="width:100vw;height:100vh;"></div>
`;

initMap('map');
