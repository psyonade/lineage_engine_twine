import {
  SEASONS,
  clamp,
  createUnionDTO,
  createActorDTO,
  addChronicleEntry,
} from './stateSchema.js';
import {
  generateOffspringGenetics,
  inheritTraits,
  calculateCompatibility,
} from './genetics.js';

export function getLifeStage(age) {
  if (age < 12) return 'Child';
  if (age < 16) return 'Youth';
  if (age < 55) return 'Adult';
  return 'Elder';
}

export function getActorAge(actor, currentYear) {
  if (!actor) return 0;
  if (!actor.isAlive && actor.deathYear !== null) {
    return actor.deathYear - actor.birthYear;
  }
  return currentYear - actor.birthYear;
}

export function advanceSeason(state, rng = Math.random) {
  if (!state.$world) return;

  const world = state.$world;
  world.tickCount = (world.tickCount || 0) + 1;

  const currentSeasonIndex = SEASONS.indexOf(world.season);
  const nextSeasonIndex = (currentSeasonIndex + 1) % 4;
  world.season = SEASONS[nextSeasonIndex];

  let yearPassed = false;
  if (nextSeasonIndex === 0) {
    world.year += 1;
    yearPassed = true;
  }

  if (yearPassed) {
    processYearlyAgingAndMortality(state, rng);
  }

  processAutonomousUnionsAndOffspring(state, rng);

  return {
    yearPassed,
    year: world.year,
    season: world.season,
  };
}

function processYearlyAgingAndMortality(state, rng) {
  const currentYear = state.$world.year;
  const actors = Object.values(state.$actors || {});

  for (const actor of actors) {
    if (!actor.isAlive) continue;

    const age = getActorAge(actor, currentYear);

    if (age >= 55) {
      const vitality = actor.genetics?.vitality ?? 50;
      let baseMortalityChance = (age - 55) * 0.035;

      const vitalityModifier = (50 - vitality) * 0.001;
      baseMortalityChance += vitalityModifier;

      if (actor.traits?.includes('Fragile')) baseMortalityChance += 0.05;
      if (actor.traits?.includes('Resilient')) baseMortalityChance -= 0.03;
      if (actor.traits?.includes('Short-Lived') && age >= 40) baseMortalityChance += 0.10;

      baseMortalityChance = clamp(baseMortalityChance, 0.01, 0.90);

      if (rng() < baseMortalityChance) {
        killActor(state, actor.id, 'old age or natural causes');
      }
    }
  }
}

export function killActor(state, actorId, cause = 'natural causes') {
  const actor = state.$actors?.[actorId];
  if (!actor || !actor.isAlive) return;

  actor.isAlive = false;
  actor.deathYear = state.$world?.year ?? 1;

  if (actor.spouseId) {
    const spouse = state.$actors[actor.spouseId];
    if (spouse) {
      spouse.spouseId = null;
    }
    actor.spouseId = null;
  }

  addChronicleEntry(
    state,
    `${actor.name} of House ${actor.house} passed away from ${cause} at age ${getActorAge(actor, state.$world.year)}.`,
    'death',
    [actorId]
  );
}

function processAutonomousUnionsAndOffspring(state, rng) {
  const currentYear = state.$world.year;
  const actors = Object.values(state.$actors || {}).filter(a => a.isAlive);

  const unmarriedAdults = actors.filter(a => {
    const age = getActorAge(a, currentYear);
    return age >= 16 && age <= 50 && !a.spouseId;
  });

  for (const actor of unmarriedAdults) {
    if (actor.spouseId) continue;
    if (rng() > 0.20) continue;

    const candidates = unmarriedAdults.filter(other => {
      if (other.id === actor.id || other.spouseId) return false;
      if (other.house === actor.house && actor.house !== 'Commoner') return false;
      const otherAge = getActorAge(other, currentYear);
      return Math.abs(getActorAge(actor, currentYear) - otherAge) <= 20;
    });

    for (const candidate of candidates) {
      const compat = calculateCompatibility(actor, candidate);
      if (compat >= 50) {
        formUnion(state, actor.id, candidate.id);
        break;
      }
    }
  }

  const unions = Object.values(state.$unions || {}).filter(u => u.active);

  for (const union of unions) {
    const [p1Id, p2Id] = union.partners;
    const partner1 = state.$actors[p1Id];
    const partner2 = state.$actors[p2Id];

    if (!partner1 || !partner2 || !partner1.isAlive || !partner2.isAlive) {
      union.active = false;
      continue;
    }

    if (union.children.length >= 5) continue;

    const age1 = getActorAge(partner1, currentYear);
    const age2 = getActorAge(partner2, currentYear);

    const femalePartner = partner1.gender === 'female' ? partner1 : (partner2.gender === 'female' ? partner2 : null);

    if (femalePartner) {
      const femaleAge = getActorAge(femalePartner, currentYear);
      if (femaleAge < 16 || femaleAge > 44) continue;
    }

    if (age1 < 16 || age2 < 16) continue;

    if (rng() < 0.25) {
      produceOffspring(state, union.id, rng);
    }
  }
}

export function formUnion(state, actor1Id, actor2Id) {
  const actor1 = state.$actors[actor1Id];
  const actor2 = state.$actors[actor2Id];

  if (!actor1 || !actor2) return null;

  const union = createUnionDTO({
    partners: [actor1Id, actor2Id],
    formedYear: state.$world?.year ?? 1,
    active: true,
  });

  state.$unions[union.id] = union;

  actor1.spouseId = actor2Id;
  actor2.spouseId = actor1Id;

  if (!actor1.unions.includes(union.id)) actor1.unions.push(union.id);
  if (!actor2.unions.includes(union.id)) actor2.unions.push(union.id);

  addChronicleEntry(
    state,
    `${actor1.name} of House ${actor1.house} and ${actor2.name} of House ${actor2.house} formed a sacred union.`,
    'union',
    [actor1Id, actor2Id]
  );

  return union;
}

const MALE_NAMES = ['Arthur', 'Cedric', 'Gareth', 'Julian', 'Tristan', 'Eldrin', 'Dorian', 'Valerius', 'Rowan', 'Kaelen', 'Magnus', 'Leander'];
const FEMALE_NAMES = ['Aurelia', 'Genevieve', 'Lyra', 'Rosalind', 'Isolde', 'Elysia', 'Seraphina', 'Vivienne', 'Helena', 'Celeste', 'Morgana', 'Maeve'];

export function produceOffspring(state, unionId, rng = Math.random, customChildName = null, customGender = null) {
  const union = state.$unions[unionId];
  if (!union) return null;

  const [p1Id, p2Id] = union.partners;
  const parent1 = state.$actors[p1Id];
  const parent2 = state.$actors[p2Id];

  if (!parent1 || !parent2) return null;

  const gender = customGender || (rng() < 0.5 ? 'male' : 'female');
  const namePool = gender === 'male' ? MALE_NAMES : FEMALE_NAMES;
  const name = customChildName || namePool[Math.floor(rng() * namePool.length)];

  const genetics = generateOffspringGenetics(parent1, parent2, rng);
  const traits = inheritTraits(parent1, parent2, rng);

  let house = parent1.house;
  if (parent2.house === state.$world?.dynastyName) {
    house = parent2.house;
  }

  const child = createActorDTO({
    name,
    gender,
    birthYear: state.$world?.year ?? 1,
    house,
    parents: [p1Id, p2Id],
    genetics,
    traits,
  });

  state.$actors[child.id] = child;

  union.children.push(child.id);
  if (!parent1.children.includes(child.id)) parent1.children.push(child.id);
  if (!parent2.children.includes(child.id)) parent2.children.push(child.id);

  addChronicleEntry(
    state,
    `${child.name} was born to ${parent1.name} and ${parent2.name} of House ${house}.`,
    'birth',
    [child.id, p1Id, p2Id]
  );

  return child;
}

export function getEligibleHeirs(state, playerId) {
  const player = state.$actors[playerId];
  if (!player) return [];

  const candidates = [];
  const visited = new Set();

  const addCandidate = (actorId, relationshipLabel, priorityScore) => {
    if (!actorId || visited.has(actorId)) return;
    visited.add(actorId);

    const actor = state.$actors[actorId];
    if (actor && actor.isAlive) {
      candidates.push({
        actor,
        relationshipLabel,
        priorityScore,
        age: getActorAge(actor, state.$world.year),
      });
    }
  };

  if (player.children) {
    player.children.forEach((childId, idx) => {
      addCandidate(childId, 'Child', 100 - idx);
    });
  }

  if (player.children) {
    player.children.forEach((childId) => {
      const child = state.$actors[childId];
      if (child && child.children) {
        child.children.forEach((grandChildId, gIdx) => {
          addCandidate(grandChildId, 'Grandchild', 80 - gIdx);
        });
      }
    });
  }

  if (player.parents && player.parents.length > 0) {
    player.parents.forEach((parentId) => {
      const p = state.$actors[parentId];
      if (p && p.children) {
        p.children.forEach((sibId, sIdx) => {
          if (sibId !== playerId) {
            addCandidate(sibId, 'Sibling', 60 - sIdx);
          }
        });
      }
    });
  }

  candidates.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return b.age - a.age;
  });

  return candidates;
}

export function switchPlayerCharacter(state, newPlayerId) {
  const newPlayer = state.$actors[newPlayerId];
  if (!newPlayer || !newPlayer.isAlive) return false;

  state.$playerId = newPlayerId;
  addChronicleEntry(
    state,
    `${newPlayer.name} has ascended as the head of House ${newPlayer.house}.`,
    'succession',
    [newPlayerId]
  );
  return true;
}
