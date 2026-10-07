import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const gameUrl = pathToFileURL(resolve('dist/index.html')).href;

test('50-seed diagnostics summarize the world without changing the active dynasty', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(gameUrl);
  await page.locator('#btn-quick-start').click();
  const before = await page.evaluate(() => {
    const state = window.SugarCube.State.variables;
    return { seed: state.$world.seed, tick: state.$world.tickCount, actorCount: Object.keys(state.$actors).length };
  });

  await page.locator('#btn-nav-debug').click();
  await page.locator('#dbg-run-seeds').click();
  await expect(page.locator('#seed-diagnostics-status')).toHaveText('Diagnostics complete. The active dynasty was not changed.', { timeout: 120_000 });
  await expect(page.locator('#seed-diagnostics-output')).toContainText('50 seeds · 30 simulated years');
  await expect(page.locator('#seed-diagnostics-output')).toContainText('Average gene variance:');
  await expect(page.locator('#seed-diagnostics-output')).toContainText('Median dynasty lifespan:');
  await expect(page.locator('#seed-diagnostics-output')).toContainText('persistent traces:');

  const after = await page.evaluate(() => {
    const state = window.SugarCube.State.variables;
    return { seed: state.$world.seed, tick: state.$world.tickCount, actorCount: Object.keys(state.$actors).length };
  });
  expect(after).toEqual(before);
  expect(pageErrors).toEqual([]);
});
