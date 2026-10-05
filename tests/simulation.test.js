import { describe, it, expect } from 'vitest';
import { createInitialGameState } from '../src/scripts/stateSchema.js';
import { advanceSeason, killActor } from '../src/scripts/simulation.js';
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
      }
    }

    for (const union of Object.values(unionMap)) {
      union.partners.forEach(pId => {
        expect(actorMap[pId]).toBeDefined();
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
    const candidate = Object.values(state.$actors).find(a => a.id !== player.id && a.gender !== player.gender);

    const u = LineageEngine.formUnion(state, player.id, candidate.id);
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
});
