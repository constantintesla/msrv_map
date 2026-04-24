import { $ } from '../utils/dom';

/** Initialize tab switching */
export function initSidebar(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.tabs__btn');
  const panels = document.querySelectorAll<HTMLDivElement>('.tab-panel');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab!;

      buttons.forEach(b => b.classList.remove('tabs__btn--active'));
      panels.forEach(p => p.classList.remove('tab-panel--active'));

      btn.classList.add('tabs__btn--active');
      $(`[data-panel="${tab}"]`).classList.add('tab-panel--active');
    });
  });
}

/** Switch to a specific tab programmatically */
export function switchTab(tab: string): void {
  const btn = document.querySelector<HTMLButtonElement>(`.tabs__btn[data-tab="${tab}"]`);
  btn?.click();
}

/** Toggle collapsible sections */
export function initCollapsibles(): void {
  document.querySelectorAll('.collapsible__header').forEach(header => {
    header.addEventListener('click', () => {
      header.parentElement!.classList.toggle('collapsible--closed');
    });
  });
}
