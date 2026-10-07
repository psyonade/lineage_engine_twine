import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const gameUrl = pathToFileURL(resolve('dist/index.html')).href;

test('exports a save and imports it into another manual slot', async ({ page }) => {
  await page.goto(gameUrl);
  await page.locator('#btn-quick-start').click();
  await page.evaluate(() => { window.SugarCube.State.variables.$world.gold = 777; });
  await page.locator('#btn-save-load-modal').click();
  await page.locator('.btn-save-slot[data-slot="slot_1"]').click();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('.btn-export-slot[data-slot="slot_1"]').click();
  const download = await downloadPromise;
  const exportData = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exportData.format).toBe('lineage-engine-save');
  expect(exportData.formatVersion).toBe(1);
  expect(exportData.state.$world.gold).toBe(777);

  await page.locator('#input-import-save').setInputFiles({
    name: 'lineage-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exportData)),
  });
  await expect(page.locator('#import-save-status')).toContainText('Validated save');
  await page.locator('#select-import-slot').selectOption('slot_2');
  await page.locator('#btn-import-save').click();
  await expect(page.locator('#save-banner')).toContainText('Imported');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lineage_save_slots_v2')).slot_2.state.$world.gold)).toBe(777);

  await page.locator('.btn-load-slot[data-slot="slot_2"]').click();
  expect(await page.evaluate(() => window.SugarCube.State.variables.$world.gold)).toBe(777);
});

test('rejects invalid and markup-bearing imports without changing existing saves', async ({ page }) => {
  await page.goto(gameUrl);
  await page.locator('#btn-quick-start').click();
  await page.evaluate(() => { window.SugarCube.State.variables.$world.gold = 321; });
  await page.locator('#btn-save-load-modal').click();
  await page.locator('.btn-save-slot[data-slot="slot_1"]').click();

  await page.locator('#input-import-save').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  await expect(page.locator('#import-save-status')).toContainText('valid JSON');
  await expect(page.locator('#btn-import-save')).toBeDisabled();

  const unsafeExport = await page.evaluate(() => {
    const state = JSON.parse(JSON.stringify(window.SugarCube.State.variables));
    const player = state.$actors[state.$playerId];
    player.name = '<img src=x onerror=alert(1)>';
    return { format: 'lineage-engine-save', formatVersion: 1, state };
  });
  await page.locator('#input-import-save').setInputFiles({
    name: 'unsafe.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(unsafeExport)),
  });
  await expect(page.locator('#import-save-status')).toContainText('contains markup');
  await expect(page.locator('#btn-import-save')).toBeDisabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lineage_save_slots_v2')).slot_1.state.$world.gold)).toBe(321);
});
