export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

export function clamp(val, min = 0, max = 100) {
  if (typeof val !== 'number' || isNaN(val)) return min;
  return Math.min(Math.max(val, min), max);
}

export function clampStats(stats) {
  return {
    martial: clamp(stats?.martial ?? 50, 0, 100),
    diplomacy: clamp(stats?.diplomacy ?? 50, 0, 100),
    stewardship: clamp(stats?.stewardship ?? 50, 0, 100),
    intrigue: clamp(stats?.intrigue ?? 50, 0, 100),
    learning: clamp(stats?.learning ?? 50, 0, 100),
  };
}

export function clampRelationship(rel) {
  return {
    affinity: clamp(rel?.affinity ?? 50, -100, 100),
    romance: clamp(rel?.romance ?? 0, 0, 100),
    respect: clamp(rel?.respect ?? 50, 0, 100),
    flags: Array.isArray(rel?.flags) ? [...rel.flags] : [],
  };
}

let actorCounter = 0;
let unionCounter = 0;

export function resetIdCounters(actorSeed = 0, unionSeed = 0) {
  actorCounter = actorSeed;
  unionCounter = unionSeed;
}

export function generateActorId() {
  actorCounter += 1;
  return `char_${actorCounter}`;
}

export function generateUnionId() {
  unionCounter += 1;
  return `union_${unionCounter}`;
}

export function createWorldState(dynastyName = 'Pendelton') {
  return {
    year: 1,
    season: 'Spring',
    tickCount: 0,
    dynastyName: dynastyName,
  };
}

export function createActorDTO(params = {}) {
  const id = params.id || generateActorId();
  return {
    id,
    name: params.name || 'Unnamed',
    gender: params.gender || 'male',
    birthYear: params.birthYear ?? 1,
    deathYear: params.deathYear ?? null,
    isAlive: params.isAlive ?? true,
    house: params.house || 'Commoner',
    parents: Array.isArray(params.parents) ? [...params.parents] : [],
    spouseId: params.spouseId ?? null,
    unions: Array.isArray(params.unions) ? [...params.unions] : [],
    children: Array.isArray(params.children) ? [...params.children] : [],
    genetics: params.genetics ? { ...params.genetics } : {},
    traits: Array.isArray(params.traits) ? [...params.traits] : [],
    stats: clampStats(params.stats),
    relationships: params.relationships ? { ...params.relationships } : {},
  };
}

export function createUnionDTO(params = {}) {
  const id = params.id || generateUnionId();
  return {
    id,
    partners: Array.isArray(params.partners) ? [...params.partners] : [],
    children: Array.isArray(params.children) ? [...params.children] : [],
    formedYear: params.formedYear ?? 1,
    active: params.active ?? true,
  };
}

export function addChronicleEntry(state, description, type = 'event', actorIds = []) {
  if (!state.$chronicle) {
    state.$chronicle = [];
  }
  const entry = {
    year: state.$world?.year ?? 1,
    season: state.$world?.season ?? 'Spring',
    type,
    description,
    actorIds: [...actorIds],
  };
  state.$chronicle.push(entry);
  return entry;
}

export function createInitialGameState(dynastyName = 'Pendelton') {
  resetIdCounters(0, 0);
  return {
    $world: createWorldState(dynastyName),
    $playerId: null,
    $actors: {},
    $unions: {},
    $chronicle: [],
  };
}
