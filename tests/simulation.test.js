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
});
