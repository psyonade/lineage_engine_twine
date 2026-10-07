import { describe, it, expect } from 'vitest';
import { adjustHouseRelation, createActorDTO, createInitialGameState, createUnionDTO, ensureHouse } from '../src/scripts/stateSchema.js';
import { advanceSeason, calculateCourtshipChance, calculateSeductionChance, getActorAge, initiatePregnancy, killActor, switchPlayerCharacter } from '../src/scripts/simulation.js';
import { getDialogueGreeting } from '../src/scripts/worldContent.js';
import { hashSeed } from '../src/scripts/rng.js';
import LineageEngine from '../src/scripts/index.js';

describe('Living World & Generational Simulation Suite', () => {
  it('runs a headless 120-season (30-year) simulation loop without entity corruption or dangling references', () => {
    let state = createInitialGameState('Pendelton');
    state = LineageEngine.initGameWorld(state);

    const initialActorCount = Object.keys(state.$actors).length;
    expect(initialActorCount).toBeGreaterThan(0);

    for (let seasonIndex = 0; seasonIndex < 120; seasonIndex++) {
      advanceSeason(state);
    }

    expect(state.$world.year).toBe(31);

    const actorMap = state.$actors;
    const unionMap = state.$unions;

    for (const actor of Object.values(actorMap)) {
      if (actor.parents) {
        actor.parents.forEach(pId => {
          expect(actorMap[pId]).toBeDefined();
        });
      }

      if (actor.children) {
        actor.children.forEach(cId => {
          expect(actorMap[cId]).toBeDefined();
          expect(actorMap[cId].parents).toContain(actor.id);
        });
      }

      if (actor.spouseId) {
        const spouse = actorMap[actor.spouseId];
        expect(spouse).toBeDefined();
        expect(spouse.spouseId).toBe(actor.id);
      }

      for (const unionId of actor.unions || []) {
        expect(unionMap[unionId]).toBeDefined();
        expect(unionMap[unionId].partners).toContain(actor.id);
      }
    }

    for (const union of Object.values(unionMap)) {
      union.partners.forEach(pId => {
        expect(actorMap[pId]).toBeDefined();
        expect(actorMap[pId].unions).toContain(union.id);
      });
      union.children.forEach(cId => {
        expect(actorMap[cId]).toBeDefined();
      });
    }
  });

  it('correctly deactivates spouse links and updates chronicle upon actor death', () => {
    let state = createInitialGameState('Pendelton');
    state = LineageEngine.initGameWorld(state);

    const player = state.$actors[state.$playerId];
    expect(player.isAlive).toBe(true);

    killActor(state, player.id, 'battle injuries');

    expect(player.isAlive).toBe(false);
    expect(player.deathYear).toBe(state.$world.year);

    const lastChronicle = state.$chronicle[state.$chronicle.length - 1];
    expect(lastChronicle.type).toBe('death');
    expect(lastChronicle.actorIds).toContain(player.id);
  });

  it('AP economy restores to maxAp and clears seasonal NPC interaction cooldowns upon advancing season', () => {
    let state = createInitialGameState('Pendelton');
    state = LineageEngine.initGameWorld(state);

    state.$world.ap = 0;
    state.$world.actedThisSeason = { char_2: ['converse', 'flirt'] };

    advanceSeason(state);

    expect(state.$world.ap).toBe(state.$world.maxAp);
    expect(Object.keys(state.$world.actedThisSeason).length).toBe(0);
  });

  it('pregnancy gestation lasts 3 seasons before delivering child into $actors', () => {
    let state = createInitialGameState('Pendelton');
    state = LineageEngine.initGameWorld(state);

    const player = state.$actors[state.$playerId];
    const candidate = Object.values(state.$actors).find(a =>
      a.id !== player.id &&
      a.gender !== player.gender &&
      a.isAlive &&
      !a.spouseId &&
      state.$world.year - a.birthYear >= (state.$world.config?.ROMANCE_MIN_AGE ?? 16)
    );
    expect(candidate).toBeDefined();

    const u = LineageEngine.formUnion(state, player.id, candidate.id);
    expect(u).toBeDefined();
    const motherId = player.gender === 'female' ? player.id : candidate.id;
    const fatherId = player.gender === 'female' ? candidate.id : player.id;

    const ok = LineageEngine.initiatePregnancy(state, motherId, fatherId, u.id);
    expect(ok).toBe(true);

    const mother = state.$actors[motherId];
    expect(mother.isPregnant).toBe(true);

    const initialActorCount = Object.keys(state.$actors).length;

    advanceSeason(state, () => 0.99);
    advanceSeason(state, () => 0.99);
    expect(mother.isPregnant).toBe(true);

    const res3 = advanceSeason(state, () => 0.99);
    expect(mother.isPregnant).toBe(false);
    expect(Object.keys(state.$actors).length).toBe(initialActorCount + 1);
    expect(res3.childbirthEvents.length).toBeGreaterThan(0);
  });

  it('supports conception without a prior union and records non-marital parentage', () => {
    const state = LineageEngine.initGameWorld(createInitialGameState('Parentage Test'));
    const mother = createActorDTO({ id: 'parentage_mother', gender: 'female', birthYear: state.$world.year - 24, house: 'Parentage Test' });
    const father = createActorDTO({ id: 'parentage_father', gender: 'male', birthYear: state.$world.year - 25, house: 'Other House' });
    state.$actors = { [mother.id]: mother, [father.id]: father };
    state.$unions = {};
    state.$playerId = mother.id;

    expect(initiatePregnancy(state, mother.id, father.id, null, 1)).toBe(true);
    const parentage = state.$unions[mother.pregnancy.unionId];
    expect(parentage.type).toBe('parentage');
    expect(parentage.active).toBe(false);
    expect(mother.spouseId).toBeNull();
    expect(father.spouseId).toBeNull();
    expect(initiatePregnancy(state, mother.id, mother.id, null, 1)).toBe(false);

    for (let season = 0; season < 3; season += 1) advanceSeason(state, () => 0.99);

    const child = state.$actors[parentage.children[0]];
    expect(child.parents).toEqual([mother.id, father.id]);
    expect(mother.children).toContain(child.id);
    expect(father.children).toContain(child.id);
  });


  it('uses the configured conception probability for both successful and failed rolls', () => {
    const attempt = seed => {
      const state = LineageEngine.initGameWorld(createInitialGameState('Chance Test'));
      const mother = createActorDTO({ id: 'chance_mother', gender: 'female', birthYear: state.$world.year - 24 });
      const father = createActorDTO({ id: 'chance_father', gender: 'male', birthYear: state.$world.year - 24 });
      state.$actors = { [mother.id]: mother, [father.id]: father };
      state.$unions = {};
      state.$world.seed = seed;
      state.$world.rngState = hashSeed(seed);
      const conceived = initiatePregnancy(state, mother.id, father.id, null, 0.45);
      return { conceived, state, mother, father };
    };

    expect(attempt('seed-1').conceived).toBe(false);
    const success = attempt('seed-3');
    expect(success.conceived).toBe(true);
    expect(success.mother.isPregnant).toBe(true);
    expect(success.father.unions).toHaveLength(1);
  });

  it('varies seduction odds by approach, rapport, traits, and character stats', () => {
    const state = LineageEngine.initGameWorld(createInitialGameState('Seduction Test'));
    const actor = createActorDTO({ id: 'seducer', stats: { diplomacy: 50, intrigue: 50 } });
    const target = createActorDTO({ id: 'target', stats: { diplomacy: 50, intrigue: 50 } });
    state.$actors = { [actor.id]: actor, [target.id]: target };
    actor.relationships[target.id] = { affinity: 50, romance: 0 };
    target.relationships[actor.id] = { affinity: 50, romance: 0 };

    const baseline = calculateSeductionChance(state, actor, target, 'sincere');
    const baselinePlayful = calculateSeductionChance(state, actor, target, 'playful');
    actor.stats.diplomacy = 100;
    actor.stats.intrigue = 100;
    actor.traits = ['Charming', 'Silver-Tongued', 'Fierce'];
    const improvedSincere = calculateSeductionChance(state, actor, target, 'sincere');
    const improvedBold = calculateSeductionChance(state, actor, target, 'bold');

    expect(baseline).toBeGreaterThanOrEqual(5);
    expect(baseline).toBeLessThan(100);
    expect(baselinePlayful).not.toBe(baseline);
    expect(improvedSincere).toBeGreaterThan(baseline);
    expect(improvedBold).toBeGreaterThan(baseline);
    expect(improvedSincere).toBeLessThanOrEqual(85);
    expect(improvedBold).toBeLessThanOrEqual(85);
  });

  it('calculates chance-based courtship from rapport, compatibility, traits, and stats', () => {
    const state = LineageEngine.initGameWorld(createInitialGameState('Courtship Test'));
    const actor = createActorDTO({ id: 'courtship_actor', gender: 'male', stats: { diplomacy: 50, intrigue: 50 } });
    const target = createActorDTO({ id: 'courtship_target', gender: 'female', stats: { diplomacy: 50, intrigue: 50 } });
    state.$actors = { [actor.id]: actor, [target.id]: target };
    actor.relationships[target.id] = { affinity: 50, romance: 0 };
    target.relationships[actor.id] = { affinity: 50, romance: 0 };

    const baseline = calculateCourtshipChance(state, actor, target);
    actor.stats.diplomacy = 100;
    target.stats.intrigue = 20;
    actor.traits = ['Charming', 'Silver-Tongued'];
    actor.relationships[target.id] = { affinity: 90, romance: 40 };
    target.relationships[actor.id] = { affinity: 90, romance: 40 };
    const improved = calculateCourtshipChance(state, actor, target);

    expect(baseline).toBeGreaterThanOrEqual(5);
    expect(baseline).toBeLessThan(100);
    expect(improved).toBeGreaterThan(baseline);
    expect(improved).toBeLessThanOrEqual(90);
  });

  it('multi-slot save serialization saves and restores state across slots and synchronizes ID counters', () => {
    let state = createInitialGameState('Pendelton');
    state = LineageEngine.initGameWorld(state);

    const slotsKey = 'lineage_save_slots_v2';
    const fakeLocalStorage = {};

    const slots = {
      slot_1: { state, metadata: { name: 'Alistair' } },
      slot_auto: { state, metadata: { name: 'Alistair' } }
    };
    fakeLocalStorage[slotsKey] = JSON.stringify(slots);

    const loadedSlots = JSON.parse(fakeLocalStorage[slotsKey]);
    expect(loadedSlots.slot_1.state.$world.dynastyName).toBe('Pendelton');
    expect(loadedSlots.slot_auto.state.$world.dynastyName).toBe('Pendelton');
  });

  it('blocks underage unions and conception, including autonomous conception attempts', () => {
    const state = LineageEngine.initGameWorld(createInitialGameState('Age Gate'));
    const mother = createActorDTO({ id: 'minor_mother', gender: 'female', birthYear: state.$world.year - 15 });
    const father = createActorDTO({ id: 'minor_father', gender: 'male', birthYear: state.$world.year - 15 });
    state.$actors[mother.id] = mother;
    state.$actors[father.id] = father;
    state.$unions.minor_union = createUnionDTO({ id: 'minor_union', partners: [mother.id, father.id] });

    expect(LineageEngine.formUnion(state, mother.id, father.id)).toBeNull();
    expect(initiatePregnancy(state, mother.id, father.id, 'minor_union')).toBe(false);
    state.$unions.minor_union.children = [];
    for (let season = 0; season < 3; season += 1) advanceSeason(state, () => 0);
    expect(mother.isPregnant).toBe(false);
    expect(state.$unions.minor_union.children).toEqual([]);
  });

  it('does not autonomously conceive with the player character', () => {
    const state = LineageEngine.initGameWorld(createInitialGameState('Player Agency'));
    const player = state.$actors[state.$playerId];
    player.gender = 'female';
    player.birthYear = state.$world.year - 24;
    const partner = createActorDTO({ id: 'player_partner', gender: 'male', birthYear: state.$world.year - 25, house: 'Guest House' });
    state.$actors[partner.id] = partner;
    const union = LineageEngine.formUnion(state, player.id, partner.id);
    expect(union).toBeDefined();

    for (let season = 0; season < 8; season += 1) advanceSeason(state, () => 0);

    expect(player.isPregnant).toBe(false);
    expect(player.pregnancy).toBeNull();
    expect(union.children).toEqual([]);
  });

  it('never autonomously marries the player character', () => {
    const state = createInitialGameState('Player Agency');
    const player = createActorDTO({ id: 'player', gender: 'male', birthYear: state.$world.year - 30, house: 'Player House', tier: 'player-connected' });
    const npc = createActorDTO({ id: 'npc', gender: 'female', birthYear: state.$world.year - 28, house: 'Guest House', tier: 'important' });
    state.$playerId = player.id;
    state.$actors = { [player.id]: player, [npc.id]: npc };
    state.$world.config.AUTO_UNION_CHANCE = 1;
    state.$world.config.COMPAT_MIN = 0;

    advanceSeason(state, () => 0);

    expect(player.spouseId).toBeNull();
    expect(npc.spouseId).toBeNull();
    expect(Object.values(state.$unions)).toHaveLength(0);
  });

  it('Short-Lived mortality starts at age 40 while ordinary mortality does not', () => {
    const state = LineageEngine.initGameWorld(createInitialGameState('Mortality Gate'));
    state.$actors = {};
    state.$unions = {};
    const shortLived = createActorDTO({ id: 'short_lived', birthYear: state.$world.year - 40, traits: ['Short-Lived'], genetics: { vitality: 50 } });
    const ordinary = createActorDTO({ id: 'ordinary', birthYear: state.$world.year - 40, traits: [], genetics: { vitality: 50 } });
    state.$actors[shortLived.id] = shortLived;
    state.$actors[ordinary.id] = ordinary;

    for (let season = 0; season < 4; season += 1) advanceSeason(state, () => 0.05);

    expect(shortLived.isAlive).toBe(false);
    expect(ordinary.isAlive).toBe(true);
  });

  it('keeps an underage successor in a ward period until the configured age', () => {
    const state = LineageEngine.initGameWorld(createInitialGameState('Ward Test'));
    const heir = createActorDTO({ id: 'ward_heir', name: 'Heir', birthYear: state.$world.year - 8, house: state.$world.dynastyName });
    const guardian = createActorDTO({ id: 'ward_guardian', name: 'Guardian', birthYear: state.$world.year - 35, house: state.$world.dynastyName });
    state.$actors[heir.id] = heir;
    state.$actors[guardian.id] = guardian;
    const startingTick = state.$world.tickCount;

    expect(switchPlayerCharacter(state, heir.id)).toBe(true);

    expect(getActorAge(heir, state.$world.year)).toBe(state.$world.config.WARD_UNTIL_AGE);
    expect(state.$world.tickCount - startingTick).toBe((state.$world.config.WARD_UNTIL_AGE - 8) * 4);
    expect(state.$chronicle.some(entry => entry.type === 'ward')).toBe(true);
    expect(heir.guardianId).toBeNull();
  });

  it('reproduces the same complete dynasty from the same seed', () => {
    const makeRun = () => {
      let state = createInitialGameState('Seeded House');
      state = LineageEngine.initGameWorld(state, { name: 'Seeded Founder', house: 'Seeded House', seed: 'repeatable-seed' });
      for (let season = 0; season < 120; season += 1) advanceSeason(state);
      return state;
    };

    expect(makeRun()).toEqual(makeRun());
  });

  it('carries an unscripted house feud into family memories and descendant dialogue', () => {
    const state = LineageEngine.initGameWorld(createInitialGameState('Feud Test'));
    const founder = createActorDTO({ id: 'feud_founder', name: 'Founder', house: 'House North', tier: 'player-connected' });
    const spouse = createActorDTO({ id: 'feud_spouse', name: 'Spouse', house: 'House South', tier: 'player-connected' });
    const descendant = createActorDTO({ id: 'feud_descendant', name: 'Descendant', house: 'House North', parents: [founder.id, spouse.id], tier: 'background' });
    const npc = createActorDTO({ id: 'feud_npc', name: 'Witness', house: 'House South', tier: 'important' });
    const union = createUnionDTO({ id: 'feud_union', partners: [founder.id, spouse.id], children: [descendant.id] });
    founder.spouseId = spouse.id;
    spouse.spouseId = founder.id;
    founder.unions.push(union.id);
    spouse.unions.push(union.id);
    founder.children.push(descendant.id);
    spouse.children.push(descendant.id);
    state.$actors = { [founder.id]: founder, [spouse.id]: spouse, [descendant.id]: descendant, [npc.id]: npc };
    state.$unions = { [union.id]: union };
    state.$playerId = founder.id;
    ensureHouse(state, founder.house);
    ensureHouse(state, spouse.house);
    adjustHouseRelation(state, founder.house, spouse.house, -45);

    advanceSeason(state, () => 0.99);

    expect(state.$world.conflicts['house_north:house_south'].status).toBe('feud');
    expect(state.$chronicle.some(entry => entry.type === 'house_feud' && entry.actorIds.includes(founder.id))).toBe(true);
    expect(spouse.memories.some(memory => memory.type === 'family_feud')).toBe(true);
    const greeting = getDialogueGreeting(npc, descendant, state.$actors, state.$houses, state.$world.config, state.$world.flags);
    expect(greeting).toContain('ancestor Founder');
    expect(greeting).toContain('entered a feud with House North');
  });
});
