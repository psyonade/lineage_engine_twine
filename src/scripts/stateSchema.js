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
  const config = {
    AP_PER_SEASON: 4, HEALTH_REGEN: 10, GESTATION_SEASONS: 3,
    COMPAT_BASELINE: 45, COMPAT_MIN: 50, COMPAT_SHARED_TRAIT: 10, COMPAT_BAD_PAIR: -15, COMPAT_CHARMING: 10,
    COMPAT_STAT_SIMILARITY: 15, COMPAT_STAT_SIMILARITY_MAX_DIFF: 15, COMPAT_STAT_DIFFERENCE: -10, COMPAT_STAT_DIFFERENCE_MIN: 40, COMPAT_CLOSE_KIN: 40, COMPAT_EXTENDED_KIN: 20,
    ROMANCE_MIN_AGE: 16, CONCEPTION_CHANCE: 0.45, CONCEPTION_MAX_AGE: 44,
    SEDUCTION_CHANCE_MIN: 5, SEDUCTION_CHANCE_MAX: 85,
    CHILD_AGE: 12, YOUTH_AGE: 16, ELDER_AGE: 55, DEATH_START_AGE: 55, DEATH_START_SHORTLIVED: 40,
    DEATH_SLOPE: 0.035, DEATH_VITALITY_FACTOR: 0.001, DEATH_FRAGILE_BONUS: 0.05, DEATH_RESILIENT_REDUCTION: 0.03, DEATH_SHORTLIVED_BONUS: 0.10,
    DEATH_CHANCE_MIN: 0.01, DEATH_CHANCE_MAX: 0.90,
    DEATH_SAVE_BASE: 40, DEATH_SAVE_VIT: 0.4, SPAR_VARIANCE: 20, MENTOR_GAINS: [3, 2, 1],
    TRAIT_SHARED_CHANCE: 0.75, TRAIT_SINGLE_CHANCE: 0.4, LEGENDARY_INHERIT_CHANCE: 0.3, LEGENDARY_SPONTANEOUS_CHANCE: 0.02, TRAIT_MUTATION_CHANCE: 0.25, STANDARD_MUTATION_WEIGHT: 0.8,
    AUTO_UNION_CHANCE: 0.2, AUTO_CONCEIVE_CHANCE: 0.25, MOVEMENT_GOAL_CHANCE: 0.7, MOVEMENT_WEALTH_CHANCE: 0.55, MOVEMENT_DEFEND_CHANCE: 0.65, MOVEMENT_PROTECT_CHANCE: 0.7, MOVEMENT_WANDER_CHANCE: 0.25,
    RIVALRY_THRESHOLD: -15, FEUD_THRESHOLD: -40, ALLIANCE_THRESHOLD: 30, NEUTRAL_THRESHOLD: -15,
    RIVALRY_ESCALATION_CHANCE: 0.18, FEUD_ESCALATION_CHANCE: 0.12, SEASONAL_EVENT_CHANCE: 0.2, QUEST_PRESSURE_MAX: 5, QUEST_PRESSURE_GOLD_PENALTY: 5, QUEST_PRESSURE_RENOWN_PENALTY: 1, HOUSE_RENOWN_MAX: 1000, HOUSE_RENOWN_REPUTED: 25, GOLD_INHERIT: 0.7, WARD_UNTIL_AGE: 12,
    GENE_MIDPOINT_WEIGHT: 0.4, MEMORY_CAP: 12, CHRONICLE_KEEP: 200,
  };
  return {
    year: 1,
    season: 'Spring',
    tickCount: 0,
    dynastyName: dynastyName,
    ap: config.AP_PER_SEASON,
    maxAp: config.AP_PER_SEASON,
    gold: 50,
    health: 100,
    maxHealth: 100,
    location: 'tavern',
    actedThisSeason: {},
    seed: null,
    rngState: null,
    wounded: false,
    config,
    flags: {},
    conflicts: {},
  };
}

export function createActorDTO(params = {}) {
  const id = params.id || generateActorId();
  const traits = Array.isArray(params.traits) ? [...params.traits] : [];
  const genetics = params.genetics ? { ...params.genetics } : {};
  const baseStats = { ...(params.stats || {}) };
  for (const [trait, stat, gain] of [['Strong', 'martial', 5], ['Charming', 'diplomacy', 5], ['Keen Eye', 'learning', 5], ['Stoic', 'stewardship', 5], ['Melancholic', 'learning', 5], ['Short-Tempered', 'martial', 5], ['Dragon Blood', 'martial', 10], ['Silver-Tongued', 'diplomacy', 10], ['Aether Sight', 'learning', 10], ['Iron Mind', 'learning', 10]]) {
    if (traits.includes(trait)) baseStats[stat] = (baseStats[stat] ?? 50) + gain;
  }
  return {
    id,
    name: params.name || 'Unnamed',
    gender: params.gender || 'male',
    birthYear: params.birthYear ?? 1,
    deathYear: params.deathYear ?? null,
    isAlive: params.isAlive ?? true,
    house: params.house || 'Commoner',
    location: params.location || 'tavern',
    isPregnant: params.isPregnant ?? false,
    pregnancy: params.pregnancy ?? null,
    adoptive: params.adoptive ?? false,
    parents: Array.isArray(params.parents) ? [...params.parents] : [],
    spouseId: params.spouseId ?? null,
    unions: Array.isArray(params.unions) ? [...params.unions] : [],
    children: Array.isArray(params.children) ? [...params.children] : [],
    genetics,
    traits,
    stats: clampStats(baseStats),
    relationships: params.relationships ? { ...params.relationships } : {},
    tier: params.tier ?? 'background',
    goals: Array.isArray(params.goals) ? params.goals.map(goal => ({ ...goal })) : [],
    memories: Array.isArray(params.memories) ? params.memories.map(memory => ({ ...memory })) : [],
    relationshipHistory: params.relationshipHistory ? { ...params.relationshipHistory } : {},
  };
}

export function createUnionDTO(params = {}) {
  const id = params.id || generateUnionId();
  return {
    id,
    type: params.type ?? 'marriage',
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
  const keep = state.$world?.config?.CHRONICLE_KEEP ?? 200;
  const significant = new Set(['birth', 'death', 'union', 'marriage', 'succession', 'dynasty_start']);
  const summaries = new Map();
  const detailed = [];
  const recordSummary = (decade, count, eventCounts = {}) => {
    const key = String(decade);
    const summary = summaries.get(key) || { year: decade, season: 'Spring', decade, count: 0, eventCounts: {}, type: 'summary', actorIds: [] };
    summary.count += count;
    for (const [eventType, eventCount] of Object.entries(eventCounts)) summary.eventCounts[eventType] = (summary.eventCounts[eventType] || 0) + eventCount;
    summaries.set(key, summary);
  };

  // Rebuild the compacted view each time so milestone entries are never duplicated
  // when they eventually move out of the detailed window.
  const ordinary = state.$chronicle.filter(item => item.type !== 'summary');
  const cutoff = Math.max(0, ordinary.length - keep);
  const older = ordinary.slice(0, cutoff);
  const recent = ordinary.slice(cutoff);
  for (const item of state.$chronicle) {
    if (item.type === 'summary') recordSummary(item.decade ?? (Math.floor(((item.year ?? 1) - 1) / 10) * 10 + 1), item.count ?? 1, item.eventCounts || { prior_events: 1 });
  }
  for (const item of older) {
    if (significant.has(item.type)) detailed.push(item);
    else {
      const decade = Math.floor(((item.year ?? 1) - 1) / 10) * 10 + 1;
      recordSummary(decade, 1, { [item.type]: 1 });
    }
  }
  state.$chronicle = [...summaries.values(), ...detailed, ...recent]
    .sort((a, b) => (a.year ?? 1) - (b.year ?? 1) || (a.type === 'summary' ? -1 : b.type === 'summary' ? 1 : 0));
  for (const summary of state.$chronicle) {
    if (summary.type === 'summary') {
      const count = summary.count;
      summary.description = `${count} earlier events from years ${summary.decade}–${summary.decade + 9}, summarized by decade.`;
    }
  }
  return entry;
}

export function addMemory(state, actorId, memory) {
  const actor = state.$actors?.[actorId];
  if (!actor || actor.tier === 'background' || !actor.isAlive) return null;
  const record = { ...memory, weight: memory.weight ?? 1, year: state.$world?.year ?? 1, season: state.$world?.season ?? 'Spring', location: memory.location ?? actor.location };
  actor.memories ||= [];
  actor.memories.push(record);
  const cap = state.$world?.config?.MEMORY_CAP ?? 12;
  if (actor.memories.length > cap) {
    const removable = actor.memories.findIndex(item => !['death', 'marriage', 'betrayal', 'child'].includes(item.type));
    if (removable >= 0) actor.memories.splice(removable, 1);
    else {
      const [first, second] = actor.memories.splice(0, 2);
      actor.memories.unshift({ type: 'summary', context: `${first.context} Later: ${second.context}`, actorIds: [...new Set([...(first.actorIds || []), ...(second.actorIds || [])])], year: first.year, season: first.season, location: first.location, weight: Math.max(first.weight || 1, second.weight || 1), significant: true });
    }
  }
  return record;
}

export function ensureHouse(state, name) {
  state.$houses ||= {};
  const key = String(name || 'Commoner').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (!state.$houses[key]) state.$houses[key] = { name: name || 'Commoner', renown: 0, status: 'active', relations: {} };
  return state.$houses[key];
}

export function addHouseRenown(state, name, amount) {
  const house = ensureHouse(state, name);
  const maximum = state.$world?.config?.HOUSE_RENOWN_MAX ?? 1000;
  house.renown = clamp((Number(house.renown) || 0) + (Number(amount) || 0), 0, maximum);
  return house.renown;
}

export function adjustHouseRelation(state, firstName, secondName, amount) {
  const firstKey = String(firstName || 'Commoner').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const secondKey = String(secondName || 'Commoner').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const first = ensureHouse(state, firstName);
  const second = ensureHouse(state, secondName);
  first.relations[secondKey] = clamp((first.relations[secondKey] ?? 0) + amount, -100, 100);
  second.relations[firstKey] = first.relations[secondKey];
}

export function createInitialGameState(dynastyName = 'Pendelton') {
  resetIdCounters(0, 0);
  return {
    $schemaVersion: 4,
    $world: createWorldState(dynastyName),
    $playerId: null,
    $actors: {},
    $unions: {},
    $chronicle: [],
    $quests: {},
    $houses: {},
  };
}

export function migrateGameState(state) {
  if (!state || typeof state !== 'object') return createInitialGameState();
  state.$actors ||= {};
  state.$unions ||= {};
  state.$chronicle ||= [];
  state.$quests ||= {};
  state.$houses ||= {};
  const defaults = createWorldState(state.$world?.dynastyName);
  state.$world = { ...defaults, ...(state.$world || {}), config: { ...defaults.config, ...(state.$world?.config || {}) } };
  for (const actor of Object.values(state.$actors)) {
    actor.tier ||= actor.id === state.$playerId ? 'player-connected' : 'background';
    actor.goals ||= [];
    actor.memories ||= [];
    actor.relationshipHistory ||= {};
    actor.genetics ||= {};
    actor.unions ||= [];
    actor.children ||= [];
    actor.parents ||= [];
    actor.relationships ||= {};
    actor.isPregnant = Boolean(actor.pregnancy || actor.isPregnant);
    actor.adoptive ||= false;
  }
  const maxActorId = Math.max(0, ...Object.keys(state.$actors).map(id => Number(id.replace('char_', '')) || 0));
  const maxUnionId = Math.max(0, ...Object.keys(state.$unions).map(id => Number(id.replace('union_', '')) || 0));
  resetIdCounters(maxActorId, maxUnionId);
  state.$schemaVersion = 4;
  return state;
}

export function createSaveSnapshot(state) {
  const snapshot = JSON.parse(JSON.stringify(state));
  const ancestorCache = new Map();
  const keyMemoryTypes = new Set([
    'death', 'marriage', 'betrayal', 'child', 'adoption', 'conception',
    'quest', 'inherited_quest', 'bloodline_discovery', 'succession',
  ]);
  const getAncestors = (actorId, path = new Set()) => {
    if (ancestorCache.has(actorId)) return ancestorCache.get(actorId);
    if (path.has(actorId)) return new Set();
    const nextPath = new Set(path).add(actorId);
    const ancestors = new Set();
    for (const parentId of snapshot.$actors?.[actorId]?.parents || []) {
      ancestors.add(parentId);
      for (const ancestorId of getAncestors(parentId, nextPath)) ancestors.add(ancestorId);
    }
    ancestorCache.set(actorId, ancestors);
    return ancestors;
  };

  for (const actor of Object.values(snapshot.$actors || {})) {
    if (actor.isAlive) continue;

    const ancestors = getAncestors(actor.id);
    const relatives = new Set([actor.id, ...ancestors, ...(actor.children || [])]);
    for (const candidate of Object.values(snapshot.$actors || {})) {
      if (candidate.id === actor.id) continue;
      const candidateAncestors = getAncestors(candidate.id);
      if (candidateAncestors.has(actor.id) || [...ancestors].some(id => candidateAncestors.has(id))) relatives.add(candidate.id);
    }
    if (actor.spouseId) relatives.add(actor.spouseId);
    for (const unionId of actor.unions || []) {
      for (const partnerId of snapshot.$unions?.[unionId]?.partners || []) relatives.add(partnerId);
    }
    for (const parentId of actor.parents || []) {
      for (const siblingId of snapshot.$actors[parentId]?.children || []) relatives.add(siblingId);
      const parentSpouseId = snapshot.$actors[parentId]?.spouseId;
      if (parentSpouseId) relatives.add(parentSpouseId);
    }
    for (const childId of actor.children || []) {
      const childSpouseId = snapshot.$actors[childId]?.spouseId;
      if (childSpouseId) relatives.add(childSpouseId);
    }

    actor.relationships = Object.fromEntries(Object.entries(actor.relationships || {}).filter(([id]) => relatives.has(id)));
    actor.relationshipHistory = Object.fromEntries(Object.entries(actor.relationshipHistory || {}).filter(([id]) => relatives.has(id)));
    actor.goals = [];
    actor.memories = (actor.memories || [])
      .filter(memory => memory.significant || (memory.weight || 0) >= 4 || keyMemoryTypes.has(memory.type))
      .slice(-6);
  }

  return snapshot;
}
