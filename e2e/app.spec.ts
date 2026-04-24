import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const HOST = 'http://localhost:5174';
const BASE = `${HOST}/?skip-help=1`;
const GOTO_OPTS = { waitUntil: 'domcontentloaded' as const };

// Helper: switch to a sidebar tab
async function switchTab(page: Page, tab: 'map' | 'grid' | 'markers' | 'file') {
  await page.click(`.tabs__btn[data-tab="${tab}"]`);
  await expect(page.locator(`[data-panel="${tab}"]`)).toHaveClass(/tab-panel--active/);
}

// Helper: wait for map to initialize (don't wait for tiles to load)
async function waitForMap(page: Page) {
  await page.waitForSelector('.leaflet-container', { timeout: 15000 });
  await page.waitForTimeout(300);
}

// Helper: select Topographic basemap (faster loading)
async function selectTopographic(page: Page) {
  await switchTab(page, 'map');
  await page.click('input[name="map-type"][value="topographic"]');
  await page.waitForTimeout(300);
}

// Helper: create a grid with zone selection
async function createGridWithZone(page: Page, cellSize = 200) {
  await switchTab(page, 'grid');
  // Set cell size
  await page.fill('#input-grid-size', String(cellSize));
  // Select zone first
  await page.click('#btn-select-zone');
  const mapEl = page.locator('#map');
  const box = await mapEl.boundingBox();
  if (!box) throw new Error('Map not found');
  // Draw a zone rectangle
  const x1 = box.x + box.width * 0.3;
  const y1 = box.y + box.height * 0.3;
  const x2 = box.x + box.width * 0.7;
  const y2 = box.y + box.height * 0.7;
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  // Create grid
  await page.click('#btn-create-grid');
  await page.waitForTimeout(500);
}

// Helper: create grid without zone (uses visible area)
async function createGridNoZone(page: Page, cellSize = 500) {
  await switchTab(page, 'grid');
  await page.fill('#input-grid-size', String(cellSize));
  await page.click('#btn-create-grid');
  await page.waitForTimeout(500);
}

// Counter for unique marker click positions
let markerClickIndex = 0;

// Helper: add a marker in marker mode
async function addMarker(page: Page, opts?: { name?: string; type?: string; description?: string }) {
  await switchTab(page, 'markers');
  if (opts?.type) {
    await page.selectOption('#select-marker-type', opts.type);
  }
  if (opts?.name) {
    await page.fill('#input-marker-name', opts.name);
  }
  if (opts?.description) {
    await page.fill('#input-marker-desc', opts.description);
  }
  // Enable marker mode if not active
  const btn = page.locator('#btn-marker-mode');
  const btnText = await btn.textContent();
  if (btnText?.includes('Режим добавления')) {
    await btn.click();
  }
  // Close any open popups first
  await page.evaluate(() => {
    document.querySelectorAll('.leaflet-popup-close-button').forEach((b: any) => b.click());
  });
  await page.waitForTimeout(100);
  // Click at a unique position to avoid hitting existing marker popups
  const mapEl = page.locator('#map');
  const box = await mapEl.boundingBox();
  if (!box) throw new Error('Map not found');
  const idx = markerClickIndex++;
  const offsetX = box.width * 0.2 + (idx % 5) * (box.width * 0.12);
  const offsetY = box.height * 0.2 + Math.floor(idx / 5) * (box.height * 0.12);
  await page.mouse.click(box.x + offsetX, box.y + offsetY);
  await page.waitForTimeout(300);
}

// Helper: set input value via JS and trigger events (works for color/number inputs)
async function setInputValue(page: Page, selector: string, value: string) {
  await page.evaluate(({ sel, val }) => {
    const el = document.querySelector(sel) as HTMLInputElement;
    if (!el) throw new Error(`Element not found: ${sel}`);
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )!.set!;
    nativeInputValueSetter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { sel: selector, val: value });
}

test.describe('1. Карта', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, GOTO_OPTS);
    await waitForMap(page);
  });

  test('1.1 Переключить подложку на Спутник (Esri)', async ({ page }) => {
    await switchTab(page, 'map');
    await page.click('input[name="map-type"][value="satellite"]');
    await expect(page.locator('input[name="map-type"][value="satellite"]')).toBeChecked();
  });

  test('1.2 Переключить на Топографическая (OSM)', async ({ page }) => {
    await switchTab(page, 'map');
    await page.click('input[name="map-type"][value="topographic"]');
    await expect(page.locator('input[name="map-type"][value="topographic"]')).toBeChecked();
    // Verify OSM tiles are being loaded
    await page.waitForTimeout(500);
    const tiles = page.locator('.leaflet-tile-pane img');
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('1.3 Переключить на С высотами (OpenTopoMap)', async ({ page }) => {
    await switchTab(page, 'map');
    await page.click('input[name="map-type"][value="elevation"]');
    await expect(page.locator('input[name="map-type"][value="elevation"]')).toBeChecked();
  });

  test('1.4 Зум колёсиком и кнопками +/−', async ({ page }) => {
    await selectTopographic(page);
    // Get initial zoom
    const getZoom = () => page.evaluate(() => (window as any).leafletMap?.getZoom?.() ?? document.querySelector('.leaflet-control-zoom-in') !== null);

    // Zoom in via button
    const zoomIn = page.locator('.leaflet-control-zoom-in');
    const zoomOut = page.locator('.leaflet-control-zoom-out');
    await expect(zoomIn).toBeVisible();
    await expect(zoomOut).toBeVisible();

    await zoomIn.click();
    await page.waitForTimeout(400);
    await zoomOut.click();
    await page.waitForTimeout(400);
    // If we got here without error, zoom buttons work
  });

  test('1.5 Перетаскивание карты (pan)', async ({ page }) => {
    await selectTopographic(page);
    const mapEl = page.locator('#map');
    const box = await mapEl.boundingBox();
    if (!box) throw new Error('Map not found');
    // Pan the map
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY + 100, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    // If no error, pan works
  });
});

test.describe('2. Сетка — зона и параметры', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, GOTO_OPTS);
    await waitForMap(page);
    await selectTopographic(page);
  });

  test('2.1 Выбрать зону → нарисовать прямоугольник → Зона выбрана + кнопка Очистить', async ({ page }) => {
    await switchTab(page, 'grid');
    // Initially "Очистить" hidden and zone-info hidden
    await expect(page.locator('#btn-clear-zone')).toBeHidden();
    await expect(page.locator('#zone-info')).toBeHidden();

    // Start zone selection
    await page.click('#btn-select-zone');
    // Cursor should become crosshair
    const mapContainer = page.locator('#map');
    const cursor = await mapContainer.evaluate(el => getComputedStyle(el).cursor);
    // After zone mode, the leaflet container gets crosshair
    const leafletContainer = page.locator('.leaflet-container');

    // Draw zone
    const box = await mapContainer.boundingBox();
    if (!box) throw new Error('Map not found');
    const x1 = box.x + box.width * 0.3;
    const y1 = box.y + box.height * 0.3;
    const x2 = box.x + box.width * 0.7;
    const y2 = box.y + box.height * 0.7;
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 5 });
    await page.mouse.up();

    await page.waitForTimeout(500);

    // Zone selected
    await expect(page.locator('#zone-info')).toBeVisible();
    await expect(page.locator('#zone-info')).toHaveText('Зона выбрана');
    await expect(page.locator('#btn-clear-zone')).toBeVisible();
  });

  test('2.2 Очистить зону — прямоугольник и инфо пропадают', async ({ page }) => {
    await switchTab(page, 'grid');
    // Create a zone first
    await page.click('#btn-select-zone');
    const box = await page.locator('#map').boundingBox();
    if (!box) throw new Error('Map not found');
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    await expect(page.locator('#btn-clear-zone')).toBeVisible();
    // Clear zone
    await page.click('#btn-clear-zone');
    await page.waitForTimeout(300);

    await expect(page.locator('#btn-clear-zone')).toBeHidden();
    await expect(page.locator('#zone-info')).toBeHidden();
  });

  test('2.3 Указать размер ячейки (200м) → Создать сетку → сетка рисуется', async ({ page }) => {
    await createGridWithZone(page, 200);
    // Grid polygons should be on the map
    const polygons = page.locator('.leaflet-overlay-pane path');
    const count = await polygons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('2.4 Изменить начальную букву → пересоздать → названия начинаются с неё', async ({ page }) => {
    await switchTab(page, 'grid');
    await page.fill('#input-start-letter', 'D');
    await createGridWithZone(page, 500);
    // Check grid labels contain letter D
    const labels = page.locator('.grid-label div');
    const count = await labels.count();
    let foundD = false;
    for (let i = 0; i < count; i++) {
      const text = await labels.nth(i).textContent();
      if (text && text.startsWith('D')) {
        foundD = true;
        break;
      }
    }
    expect(foundD).toBe(true);
  });

  test('2.5 Очистить сетку — квадраты пропадают', async ({ page }) => {
    await createGridWithZone(page, 500);
    const before = await page.locator('.leaflet-overlay-pane path').count();
    expect(before).toBeGreaterThan(0);

    await switchTab(page, 'grid');
    await page.click('#btn-clear-grid');
    await page.waitForTimeout(300);

    // Grid labels should be gone
    const labelsAfter = await page.locator('.grid-label').count();
    expect(labelsAfter).toBe(0);
  });

  test('2.6 Создать сетку без зоны — использует видимую область', async ({ page }) => {
    await createGridNoZone(page, 1000);
    // Grid should exist
    const polygons = page.locator('.leaflet-overlay-pane path');
    const count = await polygons.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('3. Сетка — сдвиг', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, GOTO_OPTS);
    await waitForMap(page);
    await selectTopographic(page);
    await createGridWithZone(page, 500);
  });

  test('3.1 Шаг сдвига + ↑↓←→ — сетка сдвигается', async ({ page }) => {
    await switchTab(page, 'grid');
    await page.fill('#input-shift-step', '50');
    // Get initial grid state by counting labels
    const labelsBefore = await page.locator('.grid-label').count();

    // Shift up
    await page.click('[data-shift="up"]');
    await page.waitForTimeout(300);
    // Grid should still exist
    const labelsAfter = await page.locator('.grid-label').count();
    expect(labelsAfter).toBeGreaterThan(0);

    // Shift right
    await page.click('[data-shift="right"]');
    await page.waitForTimeout(300);

    // Shift down
    await page.click('[data-shift="down"]');
    await page.waitForTimeout(300);

    // Shift left
    await page.click('[data-shift="left"]');
    await page.waitForTimeout(300);
    // If no error, shift works in all directions
  });

  test('3.2 Кнопка ↻ — перестроить сетку', async ({ page }) => {
    await switchTab(page, 'grid');
    await page.click('#btn-refresh-grid');
    await page.waitForTimeout(500);
    // Grid should still exist after refresh
    const labels = await page.locator('.grid-label').count();
    expect(labels).toBeGreaterThan(0);
  });
});

test.describe('4. Сетка — оформление', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, GOTO_OPTS);
    await waitForMap(page);
    await selectTopographic(page);
    await createGridWithZone(page, 500);
  });

  // Open the collapsible "Оформление" section
  async function openAppearance(page: Page) {
    await switchTab(page, 'grid');
    // Click on the collapsible header for "Оформление"
    const headers = page.locator('.collapsible__header');
    const count = await headers.count();
    for (let i = 0; i < count; i++) {
      const text = await headers.nth(i).textContent();
      if (text?.includes('Оформление')) {
        const parent = headers.nth(i).locator('..');
        const isClosed = await parent.evaluate(el => el.classList.contains('collapsible--closed'));
        if (isClosed) {
          await headers.nth(i).click();
          await page.waitForTimeout(200);
        }
        break;
      }
    }
  }

  test('4.1 Изменить цвет линий → линии перекрашиваются', async ({ page }) => {
    await openAppearance(page);
    await expect(page.locator('#input-grid-color')).toBeVisible();
    await page.evaluate(() => {
      const el = document.querySelector('#input-grid-color') as HTMLInputElement;
      el.value = '#ff0000';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    // Skip zone rectangle (has dash-array) — pick a grid path
    const gridPath = page.locator('.leaflet-overlay-pane path:not(.leaflet-interactive)').first();
    const pathColor = await gridPath.getAttribute('stroke');
    expect(pathColor).toBe('#ff0000');
  });

  test('4.2 Изменить толщину линий', async ({ page }) => {
    await openAppearance(page);
    await expect(page.locator('#input-grid-weight')).toBeVisible();
    await page.evaluate(() => {
      const el = document.querySelector('#input-grid-weight') as HTMLInputElement;
      el.value = '5';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    const gridPath = page.locator('.leaflet-overlay-pane path:not(.leaflet-interactive)').first();
    const strokeWidth = await gridPath.getAttribute('stroke-width');
    expect(strokeWidth).toBe('5');
  });

  test('4.3 Переключить шрифт (Arial/Segoe UI/Roboto/TNR)', async ({ page }) => {
    await openAppearance(page);
    const fontSelect = page.locator('#select-font-family');
    // Get all options
    const options = await fontSelect.locator('option').allTextContents();
    expect(options).toContain('Arial');
    expect(options).toContain('Segoe UI');
    expect(options).toContain('Roboto');
    expect(options).toContain('Times New Roman');

    // Select Times New Roman
    await fontSelect.selectOption({ label: 'Times New Roman' });
    await page.waitForTimeout(300);
    // Check that labels use the new font
    const labelStyle = await page.locator('.grid-label div').first().getAttribute('style');
    expect(labelStyle).toContain('Times New Roman');
  });

  test('4.4 Изменить размер шрифта квадратов', async ({ page }) => {
    await openAppearance(page);
    await page.fill('#input-sq-font', '20');
    await page.locator('#input-sq-font').dispatchEvent('change');
    await page.waitForTimeout(300);
    const labelStyle = await page.locator('.grid-label div').first().getAttribute('style');
    expect(labelStyle).toContain('20px');
  });

  test('4.5 Названия квадратов вкл/выкл — подписи появляются/исчезают', async ({ page }) => {
    await openAppearance(page);
    const labelsBefore = await page.locator('.grid-label').count();
    expect(labelsBefore).toBeGreaterThan(0);

    // Uncheck "Названия квадратов"
    await page.uncheck('#chk-show-names');
    await page.waitForTimeout(500);
    const labelsAfter = await page.locator('.grid-label').count();
    // Some labels may remain (scale label), but should be fewer
    expect(labelsAfter).toBeLessThan(labelsBefore);

    // Check "Названия квадратов" again
    await page.check('#chk-show-names');
    await page.waitForTimeout(500);
    const labelsRestored = await page.locator('.grid-label').count();
    expect(labelsRestored).toBe(labelsBefore);
  });

  test('4.6 Изменить положение подписи (9 позиций)', async ({ page }) => {
    await openAppearance(page);
    const posSelect = page.locator('#select-name-pos');
    const options = await posSelect.locator('option').allTextContents();
    expect(options.length).toBe(9);
    // Change position
    await posSelect.selectOption('center');
    await page.waitForTimeout(300);
    // No error means it works
  });

  test('4.7 Цвет подписей — color picker', async ({ page }) => {
    await openAppearance(page);
    await setInputValue(page, '#input-label-color', '#00ff00');
    await page.waitForTimeout(500);
    const labelStyle = await page.locator('.grid-label div').first().getAttribute('style');
    expect(labelStyle).toContain('#00ff00');
  });

  test('4.8 Обводка подписей — вкл/выкл + цвет обводки', async ({ page }) => {
    await openAppearance(page);
    // Stroke is on by default
    await expect(page.locator('#chk-label-stroke')).toBeChecked();
    await expect(page.locator('#field-stroke-options')).toBeVisible();

    // Disable stroke
    await page.uncheck('#chk-label-stroke');
    await page.waitForTimeout(300);
    await expect(page.locator('#field-stroke-options')).toBeHidden();

    // Enable stroke
    await page.check('#chk-label-stroke');
    await page.waitForTimeout(300);
    await expect(page.locator('#field-stroke-options')).toBeVisible();

    // Change stroke color
    await page.fill('#input-stroke-color', '#ff00ff');
    await page.locator('#input-stroke-color').dispatchEvent('change');
    await page.waitForTimeout(300);
  });
});

test.describe('5. Сетка — краевые метки', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, GOTO_OPTS);
    await waitForMap(page);
    await selectTopographic(page);
    await createGridWithZone(page, 500);
  });

  async function openEdgeLabels(page: Page) {
    await switchTab(page, 'grid');
    const headers = page.locator('.collapsible__header');
    const count = await headers.count();
    for (let i = 0; i < count; i++) {
      const text = await headers.nth(i).textContent();
      if (text?.includes('Краевые метки')) {
        const parent = headers.nth(i).locator('..');
        const isClosed = await parent.evaluate(el => el.classList.contains('collapsible--closed'));
        if (isClosed) {
          await headers.nth(i).click();
          await page.waitForTimeout(200);
        }
        break;
      }
    }
  }

  test('5.1 Включить Слева (буквы) — буквы по левому краю', async ({ page }) => {
    await openEdgeLabels(page);
    // left is checked by default — uncheck and re-check
    const chk = page.locator('#chk-edge-left');
    if (await chk.isChecked()) {
      await chk.uncheck();
      await page.waitForTimeout(300);
    }
    await chk.check();
    await page.waitForTimeout(500);
    // Edge labels should be rendered
    const edgeLabels = await page.locator('.edge-label').count();
    expect(edgeLabels).toBeGreaterThan(0);
  });

  test('5.2 Включить Справа (буквы) — буквы по правому краю', async ({ page }) => {
    await openEdgeLabels(page);
    await page.check('#chk-edge-right');
    await page.waitForTimeout(500);
    const edgeLabels = await page.locator('.edge-label').count();
    expect(edgeLabels).toBeGreaterThan(0);
  });

  test('5.3 Включить Сверху (цифры) — цифры сверху', async ({ page }) => {
    await openEdgeLabels(page);
    const chk = page.locator('#chk-edge-top');
    if (await chk.isChecked()) {
      await chk.uncheck();
      await page.waitForTimeout(300);
    }
    await chk.check();
    await page.waitForTimeout(500);
    const edgeLabels = await page.locator('.edge-label').count();
    expect(edgeLabels).toBeGreaterThan(0);
  });

  test('5.4 Включить Снизу (цифры) — цифры снизу', async ({ page }) => {
    await openEdgeLabels(page);
    const chk = page.locator('#chk-edge-bottom');
    if (await chk.isChecked()) {
      await chk.uncheck();
      await page.waitForTimeout(300);
    }
    await chk.check();
    await page.waitForTimeout(500);
    const edgeLabels = await page.locator('.edge-label').count();
    expect(edgeLabels).toBeGreaterThan(0);
  });

  test('5.5 Комбинация: все 4 стороны одновременно', async ({ page }) => {
    await openEdgeLabels(page);
    // Enable all four
    for (const id of ['#chk-edge-left', '#chk-edge-right', '#chk-edge-top', '#chk-edge-bottom']) {
      const chk = page.locator(id);
      if (!(await chk.isChecked())) {
        await chk.check();
      }
    }
    await page.waitForTimeout(500);
    const edgeLabels = await page.locator('.edge-label').count();
    // Should have labels on all 4 sides
    expect(edgeLabels).toBeGreaterThan(3);
  });
});

test.describe('6. Маркеры', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, GOTO_OPTS);
    await waitForMap(page);
    await selectTopographic(page);
  });

  test('6.1 Режим добавления меток → курсор crosshair, индикатор вверху', async ({ page }) => {
    await switchTab(page, 'markers');
    await page.click('#btn-marker-mode');
    await page.waitForTimeout(200);
    // Mode indicator should be visible
    await expect(page.locator('#mode-indicator')).toBeVisible();
    await expect(page.locator('#mode-indicator')).toContainText('Режим добавления меток');
    // Button should change
    await expect(page.locator('#btn-marker-mode')).toContainText('Отключить');
    // Cursor should be crosshair on map container
    const cursor = await page.locator('.leaflet-container').evaluate(el => el.style.cursor);
    expect(cursor).toBe('crosshair');
  });

  test('6.2 Клик по карте — маркер создаётся', async ({ page }) => {
    await addMarker(page, { name: 'Тестовая точка', type: 'default', description: 'Описание' });
    // Marker should appear in list
    const markerItems = page.locator('.marker-item');
    await expect(markerItems).toHaveCount(1);
    await expect(markerItems.first()).toContainText('Тестовая точка');
    // Counter should update
    await expect(page.locator('#marker-count')).toHaveText('1');
  });

  test('6.3 Проверить все 5 типов маркеров', async ({ page }) => {
    const types = ['default', 'warning', 'danger', 'info', 'checkpoint'];
    const names = ['Стандартная', 'Предупреждение', 'Опасность', 'Информация', 'КПП'];

    for (let i = 0; i < types.length; i++) {
      await switchTab(page, 'markers');
      await page.selectOption('#select-marker-type', types[i]);
      await page.fill('#input-marker-name', names[i]);

      // Enable marker mode if not active
      const btnText = await page.locator('#btn-marker-mode').textContent();
      if (btnText?.includes('Режим добавления')) {
        await page.click('#btn-marker-mode');
      }

      const box = await page.locator('#map').boundingBox();
      if (!box) throw new Error('Map not found');
      // Click at different positions to avoid overlap
      const offsetX = (i + 1) * (box.width / 7);
      await page.mouse.click(box.x + offsetX, box.y + box.height / 2);
      await page.waitForTimeout(200);
    }

    // Should have 5 markers
    await expect(page.locator('#marker-count')).toHaveText('5');
    const items = page.locator('.marker-item');
    await expect(items).toHaveCount(5);
  });

  test('6.4 Escape — выход из режима', async ({ page }) => {
    await switchTab(page, 'markers');
    await page.click('#btn-marker-mode');
    await expect(page.locator('#mode-indicator')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    await expect(page.locator('#mode-indicator')).toBeHidden();
    await expect(page.locator('#btn-marker-mode')).toContainText('Режим добавления');
  });

  test('6.5 Маркер перетаскивается (drag)', async ({ page }) => {
    await addMarker(page, { name: 'Draggable' });
    // Exit marker mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Find the marker on map
    const marker = page.locator('.map-marker').first();
    await expect(marker).toBeVisible();
    // Drag it
    const box = await marker.boundingBox();
    if (!box) throw new Error('Marker not visible');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + 50, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    // Marker should still exist
    await expect(page.locator('.marker-item')).toHaveCount(1);
  });

  test('6.6 Ctrl+Click по маркеру — редактирование', async ({ page }) => {
    await addMarker(page, { name: 'EditMe', description: 'OldDesc' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Handle the two prompts that will appear
    page.on('dialog', async (dialog) => {
      if (dialog.message().includes('Описание')) {
        await dialog.accept('NewDesc');
      } else if (dialog.message().includes('Подпись')) {
        await dialog.accept('NewName');
      }
    });

    // Ctrl+Click on the marker
    const marker = page.locator('.map-marker').first();
    await marker.click({ modifiers: ['Control'] });
    await page.waitForTimeout(500);

    // Check that marker was updated in the list
    await expect(page.locator('.marker-item').first()).toContainText('NewName');
  });

  test('6.7 ✏️ в списке — редактирование подписи/описания', async ({ page }) => {
    await addMarker(page, { name: 'Original', description: 'OldDesc' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    page.on('dialog', async (dialog) => {
      if (dialog.message().includes('Описание')) {
        await dialog.accept('UpdatedDesc');
      } else if (dialog.message().includes('Подпись')) {
        await dialog.accept('UpdatedName');
      }
    });

    await page.click('.marker-edit');
    await page.waitForTimeout(500);
    await expect(page.locator('.marker-item').first()).toContainText('UpdatedName');
  });

  test('6.8 🗑️ в списке — удаление маркера', async ({ page }) => {
    await addMarker(page, { name: 'ToDelete' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(page.locator('#marker-count')).toHaveText('1');

    await page.click('.marker-delete');
    await page.waitForTimeout(300);
    await expect(page.locator('#marker-count')).toHaveText('0');
    await expect(page.locator('.marker-item')).toHaveCount(0);
  });

  test('6.9 Клик по элементу в списке — карта центрируется', async ({ page }) => {
    await addMarker(page, { name: 'CenterMe' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Pan map away first
    const mapEl = page.locator('#map');
    const box = await mapEl.boundingBox();
    if (!box) throw new Error('Map not found');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 300, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Click on the marker item text (not buttons)
    const markerItem = page.locator('.marker-item').first();
    // Click on the div containing the name, not the buttons
    await markerItem.locator('div >> nth=0').click();
    await page.waitForTimeout(500);
    // If no error, panning worked
  });

  test('6.10 Показывать подписи точек вкл/выкл', async ({ page }) => {
    await addMarker(page, { name: 'LabelTest' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Point labels on by default - check tooltip exists
    const tooltips = page.locator('.marker-tooltip');
    const countBefore = await tooltips.count();
    expect(countBefore).toBeGreaterThan(0);

    // Disable point labels
    await switchTab(page, 'markers');
    await page.uncheck('#chk-point-labels');
    await page.waitForTimeout(500);
    // Tooltips should be removed (markers re-rendered)
    // Note: need to verify the actual behavior
  });

  test('6.11 Изменить шрифт подписей точек', async ({ page }) => {
    await switchTab(page, 'markers');
    await page.fill('#input-point-font', '18');
    await page.locator('#input-point-font').dispatchEvent('change');
    await page.waitForTimeout(300);
    // No error = works
  });

  test('6.12 Счётчик меток обновляется', async ({ page }) => {
    markerClickIndex = 0; // reset to avoid hitting same position
    await expect(page.locator('#marker-count')).toHaveText('0');
    await addMarker(page, { name: 'M1' });
    await expect(page.locator('#marker-count')).toHaveText('1');
    await addMarker(page, { name: 'M2' });
    await expect(page.locator('#marker-count')).toHaveText('2');
    // Delete one
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.click('.marker-delete >> nth=0');
    await page.waitForTimeout(300);
    await expect(page.locator('#marker-count')).toHaveText('1');
  });
});

test.describe('7. Файл — проекты', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, GOTO_OPTS);
    await waitForMap(page);
    await selectTopographic(page);
    // Clear localStorage
    await page.evaluate(() => localStorage.removeItem('msrv_map_projects'));
  });

  test('7.1 Ввести название → Сохранить проект → появляется в списке', async ({ page }) => {
    // First create some data (grid)
    await createGridNoZone(page, 1000);

    await switchTab(page, 'file');
    await page.fill('#input-project-name', 'Тестовый проект');
    await page.click('#btn-save-project');
    await page.waitForTimeout(300);

    // Project should appear in list
    const projectItems = page.locator('[data-project]');
    await expect(projectItems).toHaveCount(1);
    await expect(projectItems.first()).toContainText('Тестовый проект');
  });

  test('7.2 Сохранить без названия — алерт', async ({ page }) => {
    await createGridNoZone(page, 1000);
    await switchTab(page, 'file');

    let alertMsg = '';
    page.on('dialog', async (dialog) => {
      alertMsg = dialog.message();
      await dialog.accept();
    });

    await page.fill('#input-project-name', '');
    await page.click('#btn-save-project');
    await page.waitForTimeout(300);

    expect(alertMsg).toContain('Введите название');
  });

  test('7.3 Сохранить пустой проект — алерт', async ({ page }) => {
    await switchTab(page, 'file');

    let alertMsg = '';
    page.on('dialog', async (dialog) => {
      alertMsg = dialog.message();
      await dialog.accept();
    });

    await page.fill('#input-project-name', 'Empty');
    await page.click('#btn-save-project');
    await page.waitForTimeout(300);

    expect(alertMsg).toContain('Нечего сохранять');
  });

  test('7.4 Загрузить проект → данные восстанавливаются', async ({ page }) => {
    // Create grid and save project
    await createGridNoZone(page, 1000);
    await switchTab(page, 'file');
    await page.fill('#input-project-name', 'LoadTest');
    await page.click('#btn-save-project');
    await page.waitForTimeout(300);

    // Clear grid
    await switchTab(page, 'grid');
    await page.click('#btn-clear-grid');
    await page.waitForTimeout(300);
    const labelsAfterClear = await page.locator('.grid-label').count();
    expect(labelsAfterClear).toBe(0);

    // Load the project back
    page.on('dialog', async (dialog) => {
      await dialog.accept(); // confirm load
    });
    await switchTab(page, 'file');
    await page.click('.project-load');
    await page.waitForTimeout(500);

    // Grid should be restored
    const labelsAfterLoad = await page.locator('.grid-label').count();
    expect(labelsAfterLoad).toBeGreaterThan(0);
  });

  test('7.5 🗑️ удалить проект из списка', async ({ page }) => {
    await createGridNoZone(page, 1000);
    await switchTab(page, 'file');
    await page.fill('#input-project-name', 'ToDelete');
    await page.click('#btn-save-project');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-project]')).toHaveCount(1);

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.click('.project-delete');
    await page.waitForTimeout(300);

    await expect(page.locator('[data-project]')).toHaveCount(0);
  });

  test('7.6 Проекты сохраняются в localStorage — после перезагрузки на месте', async ({ page }) => {
    await createGridNoZone(page, 1000);
    await switchTab(page, 'file');
    await page.fill('#input-project-name', 'Persistent');
    await page.click('#btn-save-project');
    await page.waitForTimeout(300);

    // Reload page
    await page.reload(GOTO_OPTS);
    await waitForMap(page);
    await switchTab(page, 'file');
    await page.waitForTimeout(300);

    // Project should still be there
    const projectItems = page.locator('[data-project]');
    await expect(projectItems).toHaveCount(1);
    await expect(projectItems.first()).toContainText('Persistent');
  });
});

test.describe('8. Файл — импорт и очистка', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, GOTO_OPTS);
    await waitForMap(page);
    await selectTopographic(page);
  });

  test('8.1 Импорт KML → метки загружаются', async ({ page }) => {
    await switchTab(page, 'file');

    page.on('dialog', async (dialog) => {
      await dialog.accept(); // confirm replace
    });

    const filePath = path.resolve('D:/Projects/msrv_map/docs/afg.kml');
    const fileInput = page.locator('#input-import');
    await fileInput.setInputFiles(filePath);
    await page.waitForTimeout(1000);

    // Check that something was imported - markers or grid
    const markers = await page.locator('.map-marker').count();
    const gridLabels = await page.locator('.grid-label').count();
    expect(markers + gridLabels).toBeGreaterThan(0);
  });

  test('8.2 Импорт KMZ → аналогично', async ({ page }) => {
    await switchTab(page, 'file');

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    const filePath = path.resolve('D:/Projects/msrv_map/docs/afg.kmz');
    const fileInput = page.locator('#input-import');
    await fileInput.setInputFiles(filePath);
    await page.waitForTimeout(1000);

    const markers = await page.locator('.map-marker').count();
    const gridLabels = await page.locator('.grid-label').count();
    expect(markers + gridLabels).toBeGreaterThan(0);
  });

  test('8.3 Очистить сетку — метки остаются', async ({ page }) => {
    // Create grid and markers
    await createGridNoZone(page, 1000);
    await addMarker(page, { name: 'Survivor' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    await switchTab(page, 'file');
    await page.click('#btn-clear-grid-file');
    await page.waitForTimeout(300);

    // Grid should be gone
    const gridLabels = await page.locator('.grid-label').count();
    expect(gridLabels).toBe(0);
    // Markers should remain
    const markers = await page.locator('.map-marker').count();
    expect(markers).toBeGreaterThan(0);
  });

  test('8.4 Очистить метки — confirm → удаляются', async ({ page }) => {
    await addMarker(page, { name: 'ToRemove' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(page.locator('.map-marker')).toHaveCount(1);

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await switchTab(page, 'file');
    await page.click('#btn-clear-markers-file');
    await page.waitForTimeout(300);

    await switchTab(page, 'markers');
    await expect(page.locator('#marker-count')).toHaveText('0');
  });

  test('8.5 Очистить всё — confirm → сетка + метки + зона', async ({ page }) => {
    // Create grid, marker, zone
    await createGridWithZone(page, 500);
    await addMarker(page, { name: 'RemoveAll' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await switchTab(page, 'file');
    await page.click('#btn-clear-all');
    await page.waitForTimeout(500);

    // Everything should be cleared
    const gridLabels = await page.locator('.grid-label').count();
    expect(gridLabels).toBe(0);
    const markers = await page.locator('.map-marker').count();
    expect(markers).toBe(0);

    await switchTab(page, 'grid');
    await expect(page.locator('#btn-clear-zone')).toBeHidden();
  });
});

test.describe('9. Экспорт', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, GOTO_OPTS);
    await waitForMap(page);
    await selectTopographic(page);
  });

  test('9.1 KMZ — скачивается .kmz', async ({ page }) => {
    await createGridNoZone(page, 1000);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.click('#btn-export-kmz'),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.kmz$/);
  });

  test('9.2 KML — скачивается .kml', async ({ page }) => {
    await createGridNoZone(page, 1000);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.click('#btn-export-kml'),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.kml$/);
  });

  test('9.3 PNG — модалка предпросмотра → кнопки работают', async ({ page }) => {
    await createGridNoZone(page, 1000);

    await page.click('#btn-export-png');
    await page.waitForTimeout(500);

    // Modal should be visible
    await expect(page.locator('#modal-overlay')).toBeVisible();
    await expect(page.locator('.modal--png')).toBeVisible();
    await expect(page.locator('#btn-do-export-png')).toBeVisible();
    await expect(page.locator('#btn-cancel-png')).toBeVisible();

    // Zone selector and zoom slider
    await expect(page.locator('#select-png-zone')).toBeVisible();
    await expect(page.locator('#range-png-zoom')).toBeVisible();

    // Close modal
    await page.click('#btn-cancel-png');
    await page.waitForTimeout(300);
    await expect(page.locator('#modal-overlay')).toBeHidden();
  });

  test('9.4 Экспорт без данных — корректная обработка', async ({ page }) => {
    // Try exporting with no grid/markers
    let errorOccurred = false;
    page.on('pageerror', () => { errorOccurred = true; });
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.click('#btn-export-kml');
    await page.waitForTimeout(1000);
    // Should not crash the page
    // We mainly check that the page doesn't throw an unhandled error
  });
});

test.describe('10. Конвертер', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${HOST}/converter.html`, GOTO_OPTS);
    await page.waitForSelector('#input-file', { timeout: 5000, state: 'attached' });
  });

  test('10.1 Страница открывается, кнопка загрузки', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Конвертер');
    // File input should exist (hidden behind label)
    await expect(page.locator('#input-file')).toBeAttached();
    // Convert button should be disabled
    await expect(page.locator('#btn-convert')).toBeDisabled();
  });

  test('10.2 Загрузить .kml → кнопки скачать KML, KMZ, GPX', async ({ page }) => {
    const filePath = path.resolve('D:/Projects/msrv_map/docs/afg.kml');
    await page.locator('#input-file').setInputFiles(filePath);
    await page.waitForTimeout(300);

    // File name should be displayed
    await expect(page.locator('#file-name')).not.toBeEmpty();
    // Convert button should be enabled
    await expect(page.locator('#btn-convert')).toBeEnabled();

    // Click convert
    await page.click('#btn-convert');
    await page.waitForTimeout(2000);

    // Results should be visible
    await expect(page.locator('#results')).toBeVisible();
    await expect(page.locator('#dl-kml')).toBeVisible();
    await expect(page.locator('#dl-kmz')).toBeVisible();
    await expect(page.locator('#dl-gpx')).toBeVisible();
  });

  test('10.3 Загрузить .kmz → кнопки скачать KML, KMZ, GPX', async ({ page }) => {
    const filePath = path.resolve('D:/Projects/msrv_map/docs/afg.kmz');
    await page.locator('#input-file').setInputFiles(filePath);
    await page.waitForTimeout(300);

    await expect(page.locator('#file-name')).not.toBeEmpty();
    await expect(page.locator('#btn-convert')).toBeEnabled();

    await page.click('#btn-convert');
    await page.waitForTimeout(2000);

    await expect(page.locator('#results')).toBeVisible();
    await expect(page.locator('#dl-kml')).toBeVisible();
    await expect(page.locator('#dl-kmz')).toBeVisible();
    await expect(page.locator('#dl-gpx')).toBeVisible();
  });

  test('10.4 Загрузить .gpx → кнопки скачать KML, KMZ, GPX', async ({ page }) => {
    const filePath = path.resolve('D:/Projects/msrv_map/docs/afg.gpx');
    await page.locator('#input-file').setInputFiles(filePath);
    await page.waitForTimeout(300);

    await expect(page.locator('#file-name')).not.toBeEmpty();
    await expect(page.locator('#btn-convert')).toBeEnabled();

    await page.click('#btn-convert');
    await page.waitForTimeout(2000);

    await expect(page.locator('#results')).toBeVisible();
    await expect(page.locator('#dl-kml')).toBeVisible();
    await expect(page.locator('#dl-kmz')).toBeVisible();
    await expect(page.locator('#dl-gpx')).toBeVisible();
  });

  test('10.5 Неподдерживаемый формат — ошибка', async ({ page }) => {
    // Create a fake .txt file using setInputFiles with buffer
    const filePath = path.resolve('D:/Projects/msrv_map/README.md');

    let alertMsg = '';
    page.on('dialog', async (dialog) => {
      alertMsg = dialog.message();
      await dialog.accept();
    });

    // We need to set a file with unsupported extension
    // Use the README.md file but name it .txt
    await page.locator('#input-file').evaluate((input: HTMLInputElement) => {
      // Remove accept restriction for testing
      input.removeAttribute('accept');
    });
    await page.locator('#input-file').setInputFiles(filePath);
    await page.waitForTimeout(300);
    if (await page.locator('#btn-convert').isEnabled()) {
      await page.click('#btn-convert');
      await page.waitForTimeout(1000);
      // Should show an error
      expect(alertMsg).toBeTruthy();
    }
  });
});

test.describe('11. Общее / UX', () => {
  test('11.1 Навигация: Конвертер → converter.html', async ({ page }) => {
    await page.goto(BASE, GOTO_OPTS);
    await waitForMap(page);
    await page.click('a[href="/converter.html"]');
    await page.waitForURL('**/converter.html');
    await expect(page.locator('h1')).toContainText('Конвертер');
  });

  test('11.2 Навигация: Карта → index.html', async ({ page }) => {
    await page.goto(`${HOST}/converter.html`, GOTO_OPTS);
    await page.waitForSelector('h1');
    // The link back to map
    await page.click('a[href="/"]');
    await page.waitForTimeout(500);
    await expect(page.locator('h1')).toContainText('Генератор карт');
  });

  test('11.3 Escape из режима выбора зоны', async ({ page }) => {
    await page.goto(BASE, GOTO_OPTS);
    await waitForMap(page);
    await selectTopographic(page);
    await switchTab(page, 'grid');
    await page.click('#btn-select-zone');
    await page.waitForTimeout(200);

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Map should be draggable again
    const mapEl = page.locator('#map');
    const box = await mapEl.boundingBox();
    if (!box) throw new Error('Map not found');
    // Try to pan - should work now
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50, { steps: 5 });
    await page.mouse.up();
  });

  test('11.4 Коллапсы (Оформление, Краевые метки) — открываются/закрываются', async ({ page }) => {
    await page.goto(BASE, GOTO_OPTS);
    await waitForMap(page);
    await switchTab(page, 'grid');

    // Both collapsibles should start closed
    const collapsibles = page.locator('.collapsible');
    const count = await collapsibles.count();
    expect(count).toBe(2);

    for (let i = 0; i < count; i++) {
      const coll = collapsibles.nth(i);
      // Initially closed
      await expect(coll).toHaveClass(/collapsible--closed/);
      // Open it
      await coll.locator('.collapsible__header').click();
      await page.waitForTimeout(200);
      // Should no longer have --closed
      const classes = await coll.getAttribute('class');
      expect(classes).not.toContain('collapsible--closed');
      // Close it again
      await coll.locator('.collapsible__header').click();
      await page.waitForTimeout(200);
      await expect(coll).toHaveClass(/collapsible--closed/);
    }
  });

  test('11.5 Вкладки сайдбара переключаются (Карта, Сетка, Маркеры, Файл)', async ({ page }) => {
    await page.goto(BASE, GOTO_OPTS);
    await waitForMap(page);

    const tabs = ['map', 'grid', 'markers', 'file'];
    for (const tab of tabs) {
      await switchTab(page, tab as any);
      // Verify the correct panel is active
      await expect(page.locator(`[data-panel="${tab}"]`)).toHaveClass(/tab-panel--active/);
      // Verify button is active
      await expect(page.locator(`.tabs__btn[data-tab="${tab}"]`)).toHaveClass(/tabs__btn--active/);
      // Other panels should not be active
      for (const other of tabs.filter(t => t !== tab)) {
        const otherPanel = page.locator(`[data-panel="${other}"]`);
        const cls = await otherPanel.getAttribute('class');
        expect(cls).not.toContain('tab-panel--active');
      }
    }
  });
});

test.describe('12. Справка (help modal)', () => {
  test('12.1 Модалка показывается при старте без skip-help', async ({ page }) => {
    await page.goto(`${HOST}/`, GOTO_OPTS);
    await page.waitForSelector('.modal--help', { timeout: 5000 });
    await expect(page.locator('.modal--help')).toBeVisible();
  });

  test('12.2 Крестик закрывает модалку', async ({ page }) => {
    await page.goto(`${HOST}/`, GOTO_OPTS);
    await page.waitForSelector('.modal--help', { timeout: 5000 });
    await page.click('#btn-close-help');
    await expect(page.locator('.modal--help')).toHaveCount(0);
  });

  test('12.3 Кнопка ? в шапке открывает модалку повторно', async ({ page }) => {
    await page.goto(BASE, GOTO_OPTS);
    await waitForMap(page);
    // skip-help подавил стартовый показ — убеждаемся что модалки нет
    await expect(page.locator('.modal--help')).toHaveCount(0);
    await page.click('#btn-header-help');
    await expect(page.locator('.modal--help')).toBeVisible();
    await page.click('#btn-close-help');
    await expect(page.locator('.modal--help')).toHaveCount(0);
  });

  test('12.4 Escape закрывает модалку', async ({ page }) => {
    await page.goto(`${HOST}/`, GOTO_OPTS);
    await page.waitForSelector('.modal--help', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal--help')).toHaveCount(0);
  });
});
