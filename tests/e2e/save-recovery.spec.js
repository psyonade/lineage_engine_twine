import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const gameUrl = pathToFileURL(resolve('dist/index.html')).href;

test('storage-full warning asks before deleting the oldest manual save and retries autosave', async ({ page }) => {
  await page.addInitScript(() => {
    const key = 'lineage_save_slots_v2';
    const originalSetItem = Storage.prototype.setItem;
    window.__blockLineageStorageWrites = true;
    Storage.prototype.setItem = function (storageKey, value) {
      if (storageKey === key && window.__blockLineageStorageWrites) {
        throw new DOMException('Simulated storage quota exceeded', 'QuotaExceededError');
      }
      return originalSetItem.call(this, storageKey, value);
    };
    originalSetItem.call(localStorage, key, JSON.stringify({
      slot_1: {
        state: {},
        savedAt: '2020-01-01T00:00:00.000Z',
        savedAtMs: 1,
        metadata: { name: 'Old Save', house: 'Pendelton', age: 24, season: 'Spring', year: 1, location: 'The Crossroads Tavern', gold: 50 },
      },
    }));
  });

  await page.goto(gameUrl);
  await page.locator('#btn-quick-start').click();
  await expect(page.getByRole('alert')).toContainText('storage is full');
  await page.locator('#btn-save-load-modal').click();
  await expect(page.locator('#storage-recovery')).toBeVisible();
  await expect(page.locator('#storage-recovery')).toContainText('Slot 1');

  await page.evaluate(() => { window.__blockLineageStorageWrites = false; });
  await page.locator('#btn-confirm-free-save-space').click();
  await expect(page.locator('#save-banner')).toContainText('Autosave succeeded');
  expect(await page.evaluate(() => {
    const slots = JSON.parse(localStorage.getItem('lineage_save_slots_v2') || '{}');
    return { oldManualSave: Boolean(slots.slot_1), autosave: Boolean(slots.slot_auto) };
  })).toEqual({ oldManualSave: false, autosave: true });
});
