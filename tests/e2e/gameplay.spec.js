import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const gameUrl = pathToFileURL(resolve('dist/index.html')).href;

test('travel, quest actions, autosave reload, and new dynasty reset work', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(gameUrl);
  await page.locator('#btn-quick-start').click();
  await expect(page.locator('#viewport-slot h2').first()).toHaveText('The Crossroads Tavern');
  await expect(page.locator('#sidebar-current-lead')).toContainText('The Whispering Beast');
  await page.locator('#btn-save-load-modal').click();
  await page.locator('.btn-save-slot[data-slot="slot_1"]').click();
  await page.locator('#btn-close-saveload').click();

  await page.locator('.travel-btn').filter({ hasText: 'Highcrest Keep' }).click();
  await expect(page.locator('#viewport-slot h2').first()).toHaveText('Highcrest Keep');

  await page.locator('#btn-nav-quests').click();
  await page.locator('.quest-adv-btn').first().click();
  expect(await page.evaluate(() => window.SugarCube.State.variables.$world.location)).toBe('tavern');
  await expect(page.locator('#quest-feedback')).toContainText('Travelled to The Crossroads Tavern');
  await page.locator('.quest-adv-btn').first().click();
  await expect(page.locator('#quest-feedback')).toContainText('Completed objective');
  await expect(page.locator('.quest-adv-btn').first()).toContainText('Travel to');
  await page.locator('.quest-adv-btn').first().click();
  expect(await page.evaluate(() => window.SugarCube.State.variables.$world.location)).toBe('woods');
  await expect(page.locator('#quest-feedback')).toContainText('Travelled to The Whispering Woods');

  await page.evaluate(() => { window.SugarCube.State.variables.$world.ap = 4; });
  await page.locator('#btn-nav-world').click();
  await page.locator('#act-explore').click();
  await expect(page.locator('.lineage-modal-content h3')).toHaveText('Roadside Ambush');
  await page.locator('.enc-choice-btn').first().click();
  await expect(page.locator('#enc-result-text')).not.toBeEmpty();
  await page.locator('#btn-close-enc').click();
  expect(await page.evaluate(() => window.SugarCube.State.variables.$actors[window.SugarCube.State.variables.$playerId].memories.some(memory => memory.type === 'exploration'))).toBe(true);

  await page.locator('.travel-btn').filter({ hasText: 'Sunken Aether Ruins' }).click();
  await page.locator('.act-local-btn').filter({ hasText: 'Delve Ancient Vaults' }).click();
  await expect(page.locator('#location-feedback')).not.toBeEmpty();

  await page.reload();
  await expect(page.locator('#viewport-slot h2').first()).toHaveText('Sunken Aether Ruins');
  await expect(page.locator('#btn-quick-start')).toHaveCount(0);

  await page.locator('#btn-save-load-modal').click();
  await page.locator('#btn-new-dynasty').click();
  await expect(page.locator('#new-dynasty-confirmation')).toBeVisible();
  await page.locator('#btn-confirm-new-dynasty').click();
  await expect(page.locator('#btn-quick-start')).toBeVisible();
  expect(await page.evaluate(() => {
    const slots = JSON.parse(localStorage.getItem('lineage_save_slots_v2') || '{}');
    return { hasAutosave: Boolean(slots.slot_auto), hasManualSave: Boolean(slots.slot_1) };
  })).toEqual({ hasAutosave: false, hasManualSave: true });
  await page.reload();
  await expect(page.locator('#btn-quick-start')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('a fresh season links a quest, local encounter, NPC interaction, and time advance', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(gameUrl);
  await page.locator('#btn-quick-start').click();
  const startingDate = await page.locator('.sidebar-season-title').innerText();

  await page.locator('#btn-nav-quests').click();
  await page.locator('.quest-adv-btn').first().click();
  await expect(page.locator('#quest-feedback')).toContainText('Completed objective');

  await page.locator('#btn-nav-world').click();
  await page.locator('#act-explore').click();
  await expect(page.locator('.lineage-modal-content h3')).toHaveText('Distressed Traveler');
  await page.locator('.enc-choice-btn').first().click();
  await expect(page.locator('#enc-result-text')).not.toBeEmpty();
  await page.locator('#btn-close-enc').click();

  const firstNpc = page.locator('.character-card').first();
  await expect(firstNpc).toBeVisible();
  await firstNpc.click();
  await page.locator('#act-converse').click();
  await expect(page.locator('#interaction-feedback')).toContainText('Both gained Affinity');
  await expect(page.locator('#viewport-slot')).toContainText('view of you');

  await page.locator('#btn-adv-season').click();
  const seasonalChoice = page.locator('.seasonal-choice-btn').first();
  if (await seasonalChoice.count()) await seasonalChoice.click();
  await expect(page.locator('.sidebar-season-title')).not.toHaveText(startingDate);
  expect(errors).toEqual([]);
});

test('the in-game quest walkthrough leads through travel, every objective, and a final outcome', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(gameUrl);
  await page.locator('#btn-quick-start').click();
  await page.locator('#btn-nav-quests').click();

  const quest = page.locator('.quest-route[aria-label="The Whispering Beast walkthrough"]').locator('xpath=../..');
  await expect(page.locator('#quest-walkthrough')).toContainText('If you are elsewhere, it travels there');
  await expect(quest.locator('.quest-route-step').nth(0)).toContainText('Now: Investigate reports at The Crossroads Tavern');
  await expect(quest.locator('.quest-route-step').nth(1)).toContainText('Next: Track the beast through The Whispering Woods');

  await quest.locator('.quest-adv-btn').click();
  await expect(quest.locator('.quest-route-step').nth(0)).toContainText('Done: Investigate reports');
  await expect(quest.locator('.quest-route-step').nth(1)).toContainText('Now: Track the beast');
  await expect(quest.locator('.quest-adv-btn')).toContainText('Travel to The Whispering Woods');

  await quest.locator('.quest-adv-btn').click();
  await expect(page.locator('#quest-feedback')).toContainText('Travelled to The Whispering Woods');
  await quest.locator('.quest-adv-btn').click();
  await expect(quest.locator('.quest-route-step').nth(1)).toContainText('Done: Track the beast');
  await expect(quest.locator('.quest-route-step').nth(2)).toContainText('Now: Confront the beast');
  await expect(quest.locator('.quest-outcome-btn')).toHaveCount(2);

  await quest.locator('.quest-outcome-btn[data-outcome-id="soothe"]').click();
  await expect(page.locator('#quest-feedback')).toContainText('The Whispering Beast resolved: Soothe the spirit');
  await expect(quest.locator('.badge').first()).toContainText('Completed');
  expect(await page.evaluate(() => window.SugarCube.State.variables.$quests.whispering_beast.status)).toBe('completed');
  expect(errors).toEqual([]);
});

test('a rune fragment found during the relic quest advances the existing objective', async ({ page }) => {
  await page.goto(gameUrl);
  await page.locator('#btn-quick-start').click();
  await page.evaluate(() => {
    const state = window.SugarCube.State.variables;
    const player = state.$actors[state.$playerId];
    const quest = state.$quests.relic_bloodline;
    quest.stage = 1;
    quest.status = 'active';
    player.goals.push({ type: 'quest', questId: quest.id, priority: 3, progress: 1 });
    state.$world.location = 'ruins';
    player.location = 'ruins';
    state.$world.ap = 4;
    delete state.$world.flags.aetherFragmentFound;
    let candidate = 1;
    while (candidate < 1000000) {
      let roll = candidate >>> 0;
      roll ^= roll << 13;
      roll ^= roll >>> 17;
      roll ^= roll << 5;
      const value = (roll >>> 0) / 0x100000000;
      if (value >= 0.30 && value < 0.60) break;
      candidate += 1;
    }
    state.$world.rngState = candidate;
  });

  await page.locator('#btn-nav-world').click();
  await page.locator('.act-local-btn[data-act-id="delve_ruins"]').click();
  await expect(page.locator('#location-feedback')).toContainText('reveals the sealed vault');
  expect(await page.evaluate(() => {
    const state = window.SugarCube.State.variables;
    return {
      fragment: state.$world.flags.aetherFragmentFound,
      stage: state.$quests.relic_bloodline.stage,
      active: state.$quests.relic_bloodline.status,
      chronicle: state.$chronicle.some(entry => entry.description.includes('used the rune fragment to locate the sealed vault')),
    };
  })).toEqual({ fragment: true, stage: 2, active: 'active', chronicle: true });
});
