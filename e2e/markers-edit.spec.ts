import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5174/?skip-help=1';

async function addMarker(page: Page, name: string) {
  await page.click('.tabs__btn[data-tab="markers"]');
  await page.fill('#input-marker-name', name);
  await page.click('#btn-marker-mode');
  // Клик по центру карты
  const map = page.locator('#map');
  const box = await map.boundingBox();
  if (!box) throw new Error('map not found');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  // Выйти из режима
  await page.click('#btn-marker-mode');
}

test.describe('Редактирование меток', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.leaflet-container', { timeout: 15000 });
  });

  test('открытие редактора и смена типа', async ({ page }) => {
    await addMarker(page, 'testmarker');
    await page.click('.marker-edit');
    await expect(page.locator('#marker-editor')).toBeVisible();
    await page.selectOption('#edit-marker-type', 'danger');
    await page.click('#edit-marker-save');
    await expect(page.locator('#marker-editor')).toBeHidden();
    // в списке — счётчик остался 1
    await expect(page.locator('#marker-count')).toHaveText('1');
  });

  test('выбор курируемой иконки дизейблит цвет', async ({ page }) => {
    await addMarker(page, 'iconic');
    await page.click('.marker-edit');
    // Выбрать первую курируемую иконку (не "Без иконки")
    await page.locator('#edit-marker-icons .icon-tile').nth(1).click();
    await expect(page.locator('#edit-marker-color')).toBeDisabled();
    // Вернуть "Без иконки"
    await page.locator('#edit-marker-icons .icon-tile').first().click();
    await expect(page.locator('#edit-marker-color')).toBeEnabled();
  });

  test('отмена не сохраняет изменения', async ({ page }) => {
    await addMarker(page, 'cancelme');
    await page.click('.marker-edit');
    await page.fill('#edit-marker-name', 'CHANGED');
    await page.click('#edit-marker-cancel');
    await expect(page.locator('#marker-editor')).toBeHidden();
    // Имя в списке не поменялось
    await expect(page.locator('.marker-item').first()).toContainText('cancelme');
  });
});
