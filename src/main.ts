import '../styles/main.css';
import '../styles/sidebar.css';
import '../styles/map.css';
import { initMap } from './core/map';
import { initSidebar, initCollapsibles } from './ui/sidebar';
// Import render modules to register event listeners
import './core/grid-render';
import './core/markers-render';

document.addEventListener('DOMContentLoaded', () => {
  initMap('map');
  initSidebar();
  initCollapsibles();
});
