import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const gameUrl = pathToFileURL(resolve('dist/index.html')).href;

async function openIntimacy(page, partnerGender) {
  await page.goto(gameUrl);
  await page.locator('#btn-quick-start').click();
  const targetId = await page.evaluate(partnerGender => {
    const state = window.SugarCube.State.variables;
    const player = state.$actors[state.$playerId];
    const target = Object.values(state.$actors).find(actor => actor.id !== player.id && actor.isAlive);
    player.gender = 'male';
    player.birthYear = state.$world.year - 25;
    player.spouseId = null;
    player.unions = [];
    player.children = [];
    player.relationships = {};
    target.gender = partnerGender;
    target.birthYear = state.$world.year - 24;
    target.isAlive = true;
    target.spouseId = null;
    target.unions = [];
    target.children = [];
    target.parents = [];
    target.location = state.$world.location;
    target.relationships = {};
    target.memories = [];
    target.tier = 'important';
    for (const [unionId, union] of Object.entries(state.$unions)) {
      if (union.partners.includes(player.id) || union.partners.includes(target.id)) delete state.$unions[unionId];
    }
    state.$world.ap = 4;
    state.$world.config.CONCEPTION_CHANCE = 1;
    state.$world.rngState = 1;
    return target.id;
  }, partnerGender);

  await page.locator('#btn-nav-world').click();
  await page.locator(`.character-card[data-actor-id="${targetId}"]`).click();
  await expect(page.locator('#act-intimacy')).toBeEnabled();
  return targetId;
}

test('intimacy can conceive without courtship or marriage and records co-parentage', async ({ page }) => {
  const targetId = await openIntimacy(page, 'female');
  const playerId = await page.evaluate(() => window.SugarCube.State.variables.$playerId);
  await expect(page.locator('#intimacy-conception-chance')).toContainText('100% if the approach is reciprocated');
  const sincereChance = await page.locator('#intimacy-success-chance').innerText();
  await page.locator('#intimacy-approach').selectOption('bold');
  await expect(page.locator('#intimacy-success-chance')).not.toHaveText(sincereChance);

  await page.locator('#act-intimacy').click();

  const result = await page.evaluate(({ playerId, targetId }) => {
    const state = window.SugarCube.State.variables;
    const player = state.$actors[playerId];
    const target = state.$actors[targetId];
    const parentage = Object.values(state.$unions).find(union => union.type === 'parentage' && union.partners.includes(playerId) && union.partners.includes(targetId));
    return {
      pregnant: target.isPregnant,
      parentage: Boolean(parentage),
      married: Boolean(player.spouseId || target.spouseId),
      playerMemory: player.memories.some(memory => memory.type === 'intimacy'),
      targetMemory: target.memories.some(memory => memory.type === 'intimacy'),
      conceptionMemory: player.memories.some(memory => memory.type === 'conception'),
      relationship: player.relationships[targetId],
    };
  }, { playerId, targetId });

  expect(result).toMatchObject({ pregnant: true, parentage: true, married: false, playerMemory: true, targetMemory: true, conceptionMemory: true });
  expect(result.relationship.romance).toBeGreaterThan(0);
});

test('same-sex intimacy records the interaction without a conception chance', async ({ page }) => {
  const targetId = await openIntimacy(page, 'male');
  const playerId = await page.evaluate(() => window.SugarCube.State.variables.$playerId);
  await expect(page.locator('#intimacy-conception-chance')).toContainText('0% for this pairing');

  await page.locator('#act-intimacy').click();

  const result = await page.evaluate(({ playerId, targetId }) => {
    const state = window.SugarCube.State.variables;
    const player = state.$actors[playerId];
    const target = state.$actors[targetId];
    return {
      pregnant: player.isPregnant || target.isPregnant,
      parentage: Object.values(state.$unions).some(union => union.type === 'parentage' && union.partners.includes(playerId) && union.partners.includes(targetId)),
      playerMemory: player.memories.some(memory => memory.type === 'intimacy'),
      targetMemory: target.memories.some(memory => memory.type === 'intimacy'),
      affinity: player.relationships[targetId]?.affinity,
    };
  }, { playerId, targetId });

  expect(result).toMatchObject({ pregnant: false, parentage: false, playerMemory: true, targetMemory: true });
  expect(result.affinity).toBeGreaterThan(0);
  await expect(page.locator('#interaction-feedback')).toContainText('cannot result in conception');
});

test('courtship shows a non-guaranteed chance and records reciprocal relationship changes', async ({ page }) => {
  await page.goto(gameUrl);
  await page.locator('#btn-quick-start').click();
  const { playerId, targetId } = await page.evaluate(() => {
    const state = window.SugarCube.State.variables;
    const player = state.$actors[state.$playerId];
    const target = Object.values(state.$actors).find(actor => actor.id !== player.id && actor.gender === 'female' && actor.isAlive && !actor.spouseId);
    player.gender = 'male';
    player.birthYear = state.$world.year - 25;
    player.relationships = {};
    target.birthYear = state.$world.year - 24;
    target.spouseId = null;
    target.location = state.$world.location;
    target.relationships = {};
    player.relationships[target.id] = { affinity: 50, romance: 0, respect: 50 };
    target.relationships[player.id] = { affinity: 50, romance: 0, respect: 50 };
    state.$world.ap = 4;
    state.$world.rngState = 1;
    return { playerId: player.id, targetId: target.id };
  });

  await page.locator('#btn-nav-world').click();
  await page.locator(`.character-card[data-actor-id="${targetId}"]`).click();
  const button = page.locator('#act-flirt');
  const label = await button.innerText();
  const displayedChance = Number(label.match(/(\d+)%/)?.[1]);
  expect(displayedChance).toBeGreaterThan(0);
  expect(displayedChance).toBeLessThan(100);
  await expect(page.locator('#courtship-chance-explanation')).toContainText('compatibility');

  await button.click();
  const result = await page.evaluate(({ playerId, targetId }) => {
    const state = window.SugarCube.State.variables;
    const player = state.$actors[playerId];
    const target = state.$actors[targetId];
    return {
      playerRelation: player.relationships[targetId],
      targetRelation: target.relationships[playerId],
      playerMemory: player.memories.some(memory => memory.type === 'courtship'),
      targetMemory: target.memories.some(memory => memory.type === 'courtship'),
      ap: state.$world.ap,
    };
  }, { playerId, targetId });

  expect(result.playerRelation.romance).toBeGreaterThan(0);
  expect(result.targetRelation.romance).toBeGreaterThan(0);
  expect(result.playerMemory).toBe(true);
  expect(result.targetMemory).toBe(true);
  expect(result.ap).toBe(3);
  await expect(page.locator('#interaction-feedback')).toContainText(`Chance: ${displayedChance}%`);
});

test('a rejected courtship costs 1 AP, lowers both affinities, and records the rejection', async ({ page }) => {
  await page.goto(gameUrl);
  await page.locator('#btn-quick-start').click();
  const { playerId, targetId } = await page.evaluate(() => {
    const state = window.SugarCube.State.variables;
    const player = state.$actors[state.$playerId];
    const target = Object.values(state.$actors).find(actor => actor.id !== player.id && actor.gender === 'female' && actor.isAlive && !actor.spouseId);
    player.gender = 'male';
    player.birthYear = state.$world.year - 25;
    target.birthYear = state.$world.year - 24;
    target.spouseId = null;
    target.location = state.$world.location;
    player.relationships[target.id] = { affinity: 50, romance: 0, respect: 50 };
    target.relationships[player.id] = { affinity: 50, romance: 0, respect: 50 };
    state.$world.ap = 4;
    let candidate = 1;
    while (candidate < 1000000) {
      let roll = candidate >>> 0;
      roll ^= roll << 13;
      roll ^= roll >>> 17;
      roll ^= roll << 5;
      if ((roll >>> 0) / 0x100000000 > 0.95) break;
      candidate += 1;
    }
    state.$world.rngState = candidate;
    return { playerId: player.id, targetId: target.id };
  });

  await page.locator('#btn-nav-world').click();
  await page.locator(`.character-card[data-actor-id="${targetId}"]`).click();
  const initialChance = Number((await page.locator('#act-flirt').innerText()).match(/(\d+)%/)?.[1]);
  expect(initialChance).toBeLessThanOrEqual(90);
  await page.locator('#act-flirt').click();

  const result = await page.evaluate(({ playerId, targetId }) => {
    const state = window.SugarCube.State.variables;
    const player = state.$actors[playerId];
    const target = state.$actors[targetId];
    return {
      playerAffinity: player.relationships[targetId].affinity,
      targetAffinity: target.relationships[playerId].affinity,
      playerRejection: player.memories.some(memory => memory.type === 'rejection' && memory.actorIds?.includes(targetId)),
      targetRejection: target.memories.some(memory => memory.type === 'rejection' && memory.actorIds?.includes(playerId)),
      ap: state.$world.ap,
    };
  }, { playerId, targetId });

  expect(result).toMatchObject({ playerAffinity: 46, targetAffinity: 48, playerRejection: true, targetRejection: true, ap: 3 });
  await expect(page.locator('#interaction-feedback')).toContainText('declined your courtship');
});
