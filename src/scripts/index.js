import {
  createInitialGameState,
  createActorDTO,
  createUnionDTO,
  addChronicleEntry,
  generateActorId,
  resetIdCounters,
  clampStats,
  clampRelationship,
  clamp,
  addMemory,
  createSaveSnapshot,
  migrateGameState,
  ensureHouse,
} from './stateSchema.js';
import {
  generateRandomGenetics,
  generateOffspringGenetics,
  inheritTraits,
  calculateCompatibility,
  LEGENDARY_TRAITS,
  STANDARD_TRAITS,
  CONGENITAL_TRAITS,
} from './genetics.js';
import {
  advanceSeason,
  getLifeStage,
  getActorAge,
  getEligibleHeirs,
  switchPlayerCharacter,
  killActor,
  formUnion,
  produceOffspring,
  generateUniqueName,
  initiatePregnancy,
  calculateSeductionChance,
  calculateCourtshipChance,
  adoptChild,
  resolveQuestOutcome,
  resolveSeasonalEvent,
} from './simulation.js';
import { renderPortraitSVG } from './portraitSvg.js';
import { hashSeed, nextRandom, createSeededRng } from './rng.js';
import { computeFamilyTreeLayout, getLineageSets } from './familyTree.js';
import {
  LOCATIONS,
  INITIAL_QUESTS,
  PROCEDURAL_ENCOUNTERS,
  getDialogueGreeting,
} from './worldContent.js';

function recordAetherFragmentDiscovery(state, outcome) {
  const player = state.$actors?.[state.$playerId];
  if (!player) return outcome;
  const quest = state.$quests?.relic_bloodline;
  let result = outcome;

  if (quest && quest.status !== 'completed' && quest.stage === 1) {
    quest.stage = 2;
    quest.status = 'active';
    const goal = (player.goals || []).find(item => item.questId === quest.id);
    if (goal) goal.progress = quest.stage;
    result = `${outcome} The fragment matches the shrine scholar's account and reveals the sealed vault; you can now decide what to do with the relic.`;
    addMemory(state, player.id, { type: 'quest', actorIds: [player.id], context: `The rune fragment revealed the sealed vault in ${quest.title}.`, weight: 5 });
    addChronicleEntry(state, `${player.name} used the rune fragment to locate the sealed vault in ${quest.title}.`, 'quest', [player.id]);
  }

  return result;
}

export const ORIGINS = {
  wayfarer: {
    id: 'wayfarer',
    name: 'Wayfarer / Wanderer',
    description: 'A free spirit who has walked many roads. Balanced stats and versatile mind.',
    location: 'tavern',
    gold: 50,
    statBonus: { diplomacy: 5, learning: 5 },
    extraTraitSlots: 0,
  },
  sellsword: {
    id: 'sellsword',
    name: 'Sellsword / Mercenary',
    description: 'A hardened veteran of blade and battlefield. High Martial and Vitality.',
    location: 'keep',
    gold: 40,
    statBonus: { martial: 15 },
    extraTraitSlots: 0,
  },
  scholar: {
    id: 'scholar',
    name: "Hedge Scholar / Mystic",
    description: 'A seeker of forgotten lore and hidden secrets. High Learning and Intrigue.',
    location: 'shrine',
    gold: 45,
    statBonus: { learning: 10, intrigue: 10 },
    extraTraitSlots: 0,
  },
  artisan: {
    id: 'artisan',
    name: 'Artisan / Merchant',
    description: 'A shrewd trader skilled in crafts and coin. Starts with extra Gold and Stewardship.',
    location: 'market',
    gold: 100,
    statBonus: { stewardship: 10, diplomacy: 5 },
    extraTraitSlots: 0,
  },
  outcast: {
    id: 'outcast',
    name: 'Lowborn Outcast',
    description: 'Scorned by high society, but resourceful and adaptable. Starts with less Gold but +1 extra Trait slot.',
    location: 'woods',
    gold: 20,
    statBonus: { intrigue: 5 },
    extraTraitSlots: 1,
  },
};

const LineageEngine = {
  createInitialGameState,
  createActorDTO,
  createUnionDTO,
  addChronicleEntry,
  generateRandomGenetics,
  generateOffspringGenetics,
  inheritTraits,
  calculateCompatibility,
  LEGENDARY_TRAITS,
  STANDARD_TRAITS,
  CONGENITAL_TRAITS,
  advanceSeason,
  getLifeStage,
  getActorAge,
  calculateSeductionChance,
  calculateCourtshipChance,
  getEligibleHeirs,
  switchPlayerCharacter,
  killActor,
  formUnion,
  produceOffspring,
  initiatePregnancy,
  adoptChild,
  resolveQuestOutcome,
  renderPortraitSVG,
  computeFamilyTreeLayout,
  getLineageSets,

  initGameWorld: function (state, founderParams = {}) {
    const origin = ORIGINS[founderParams.originId] || ORIGINS.wayfarer;
    const startingAge = founderParams.age ?? 24;
    state.$world.seed = founderParams.seed ?? `${founderParams.name || 'Alistair'}|${founderParams.house || 'Pendelton'}|${founderParams.originId || 'wayfarer'}|${startingAge}`;
    state.$world.rngState = hashSeed(state.$world.seed);
    const worldRng = () => nextRandom(state);
    const founderId = generateActorId();

    const founderStats = clampStats({
      martial: 50 + (origin.statBonus.martial || 0),
      diplomacy: 50 + (origin.statBonus.diplomacy || 0),
      stewardship: 50 + (origin.statBonus.stewardship || 0),
      intrigue: 50 + (origin.statBonus.intrigue || 0),
      learning: 50 + (origin.statBonus.learning || 0),
    });

    const founder = createActorDTO({
      id: founderId,
      name: founderParams.name || 'Alistair',
      gender: founderParams.gender || 'male',
      birthYear: 1 - startingAge,
      house: founderParams.house || 'Pendelton',
      genetics: founderParams.genetics || generateRandomGenetics(worldRng),
      traits: founderParams.traits || ['Strong', 'Charming'],
      stats: founderStats,
      location: origin.location,
      tier: 'player-connected',
    });

    state.$actors[founder.id] = founder;
    state.$playerId = founder.id;
    state.$world.dynastyName = founder.house;
    state.$world.gold = origin.gold;
    state.$world.location = origin.location;
    state.$world.maxHealth = 100 + (founder.traits.includes('Strong') ? 10 : 0) - (founder.traits.includes('Fragile') ? 10 : 0);
    state.$world.health = state.$world.maxHealth;

    // Initialize quests
    state.$quests = JSON.parse(JSON.stringify(INITIAL_QUESTS));
    for (const quest of Object.values(state.$quests)) {
      quest.originatorId = founder.id;
      quest.currentHolderId = founder.id;
      quest.handoffs = [];
    }

    // Generate surrounding living houses
    const houses = ['Vane', 'Aethelgard', 'Draven', 'Valerius'];
    [...houses, founder.house, 'Oakhaven Guild', 'Marlowe Guild'].forEach(name => ensureHouse(state, name));
    const locationsList = ['tavern', 'market', 'woods', 'ruins', 'shrine', 'keep'];

    houses.forEach((houseName, index) => {
      const loc = locationsList[index % locationsList.length];

      const fatherName = generateUniqueName(state, 'male', houseName);
      const father = createActorDTO({
        name: fatherName,
        gender: 'male',
        birthYear: -45,
        house: houseName,
        location: loc,
        genetics: generateRandomGenetics(worldRng),
        traits: ['Resilient'],
        tier: 'important',
        goals: [{ type: 'wealth', priority: 2, progress: 0 }],
      });
      state.$actors[father.id] = father;

      const motherName = generateUniqueName(state, 'female', houseName);
      const mother = createActorDTO({
        name: motherName,
        gender: 'female',
        birthYear: -42,
        house: houseName,
        location: loc,
        genetics: generateRandomGenetics(worldRng),
        traits: ['Charming'],
        tier: 'important',
        goals: [{ type: 'protect_family', priority: 2, progress: 0 }],
      });
      state.$actors[mother.id] = mother;

      const u = createUnionDTO({
        partners: [father.id, mother.id],
        formedYear: -20,
      });
      father.spouseId = mother.id;
      mother.spouseId = father.id;
      father.unions.push(u.id);
      mother.unions.push(u.id);
      state.$unions[u.id] = u;

      const sonName = generateUniqueName(state, 'male', houseName);
      const son = createActorDTO({
        name: sonName,
        gender: 'male',
        birthYear: -22,
        house: houseName,
        location: loc,
        parents: [father.id, mother.id],
        genetics: generateOffspringGenetics(father, mother, worldRng, state.$world.config),
        traits: inheritTraits(father, mother, worldRng, state.$world.config),
      });
      state.$actors[son.id] = son;

      const daughterName = generateUniqueName(state, 'female', houseName);
      const daughter = createActorDTO({
        name: daughterName,
        gender: 'female',
        birthYear: -20,
        house: houseName,
        location: loc,
        parents: [father.id, mother.id],
        genetics: generateOffspringGenetics(father, mother, worldRng, state.$world.config),
        traits: inheritTraits(father, mother, worldRng, state.$world.config),
      });
      state.$actors[daughter.id] = daughter;

      u.children.push(son.id, daughter.id);
      father.children.push(son.id, daughter.id);
      mother.children.push(son.id, daughter.id);
    });

    addChronicleEntry(
      state,
      `House ${founder.house} was established under ${founder.name} (${origin.name}).`,
      'dynasty_start',
      [founder.id]
    );

    return state;
  },

  runSeededDiagnostics: async function (sourceState, onProgress = () => {}, seedCount = 50, seasonCount = 120) {
    const sourcePlayer = sourceState.$actors[sourceState.$playerId];
    const geneKeys = ['skinTone', 'hairColor', 'eyeColor', 'faceShape', 'jawWidth', 'eyeSlant', 'noseBridge', 'height', 'vitality'];
    const metrics = [];
    const significantEventTypes = new Set([
      'birth', 'death', 'union', 'adoption', 'house_feud', 'family_divided',
      'house_tension', 'house_alliance', 'house_rivalry', 'peace', 'quest',
      'quest_outcome', 'quest_inherited', 'bloodline_discovery', 'succession',
    ]);

    const hasPersistentEventTrace = (entry, state) => {
      const actorIds = entry.actorIds || [];
      const memoryTypes = {
        birth: ['child'], death: ['death'], union: ['marriage'], adoption: ['child'],
        house_feud: ['house_feud', 'family_feud'], family_divided: ['family_feud'],
        quest: ['quest'], quest_outcome: ['quest'], quest_inherited: ['inherited_quest'],
        bloodline_discovery: ['bloodline_discovery'], succession: ['inherited_quest'],
      }[entry.type] || [];
      const hasMemory = actorIds.some(id => (state.$actors[id]?.memories || []).some(memory =>
        memoryTypes.includes(memory.type) && memory.year === entry.year && memory.season === entry.season
      ));
      if (hasMemory) return true;

      if (entry.type === 'death') return actorIds.some(id => !state.$actors[id]?.isAlive && state.$actors[id]?.deathYear !== null);
      if (entry.type === 'birth' || entry.type === 'adoption') {
        const child = state.$actors[actorIds[0]];
        return Boolean(child && (child.parents || []).some(id => actorIds.includes(id)) && (entry.type !== 'adoption' || child.adoptive));
      }
      if (entry.type === 'union') {
        return Object.values(state.$unions).some(union => actorIds.every(id => union.partners.includes(id)));
      }
      if (entry.type === 'family_divided') {
        return Object.values(state.$world.conflicts || {}).some(conflict => conflict.familyEntanglements?.some(item => actorIds.every(id => item.actorIds.includes(id))));
      }
      if (entry.type.startsWith('house_') || entry.type === 'peace') return Object.keys(state.$world.conflicts || {}).length > 0;
      if (entry.type.startsWith('quest') || entry.type === 'bloodline_discovery') {
        return actorIds.some(id => (state.$actors[id]?.goals || []).some(goal => goal.type === 'quest')) || Object.values(state.$quests || {}).some(quest => quest.stage > 0 || quest.status === 'completed');
      }
      if (entry.type === 'succession') return actorIds.includes(state.$playerId);
      return false;
    };

    const getLineage = (state, founderId) => {
      const ids = new Set([founderId]);
      for (const actor of Object.values(state.$actors)) {
        if (!ids.has(actor.id) && (actor.parents || []).some(parentId => ids.has(parentId))) {
          ids.add(actor.id);
        }
      }
      return [...ids].map(id => state.$actors[id]).filter(Boolean);
    };

    const getGenerations = (lineage, founderId) => {
      const generations = new Map([[founderId, 0]]);
      for (const actor of lineage) {
        if (generations.has(actor.id)) continue;
        const parentGenerations = (actor.parents || []).map(id => generations.get(id)).filter(Number.isFinite);
        if (parentGenerations.length) {
          generations.set(actor.id, Math.max(...parentGenerations) + 1);
        }
      }
      return generations;
    };

    const variance = values => {
      if (values.length < 2) return 0;
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      return values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
    };

    const sourceSeed = sourceState.$world.seed || 'lineage';
    const startingAge = clamp(getActorAge(sourcePlayer, sourceState.$world.year), 14, 60);

    for (let run = 0; run < seedCount; run++) {
      const initialState = createInitialGameState(sourcePlayer.house);
      const simulated = LineageEngine.initGameWorld(initialState, {
        name: sourcePlayer.name,
        house: sourcePlayer.house,
        gender: sourcePlayer.gender,
        age: startingAge,
        originId: 'wayfarer',
        traits: [...(sourcePlayer.traits || [])],
        genetics: { ...(sourcePlayer.genetics || {}) },
        seed: `${sourceSeed}:diagnostic:${run + 1}`,
      });
      const founderId = simulated.$playerId;
      const eligiblePartner = Object.values(simulated.$actors).find(actor =>
        actor.id !== founderId &&
        actor.isAlive &&
        !actor.spouseId &&
        actor.gender !== simulated.$actors[founderId].gender &&
        getActorAge(actor, simulated.$world.year) >= (simulated.$world.config?.ROMANCE_MIN_AGE ?? 16)
      );
      if (eligiblePartner) formUnion(simulated, founderId, eligiblePartner.id);
      const initialLivingPopulation = Object.values(simulated.$actors).filter(actor => actor.isAlive).length;
      const initialSaveSize = JSON.stringify(simulated).length;
      const seenEvents = new Set(simulated.$chronicle.map(entry => `${entry.year}:${entry.season}:${entry.type}:${entry.description}`));
      let extinctionSeason = null;
      let totalLineagePopulation = 0;
      let maxGeneration = 0;
      let autonomousRelationships = 0;
      let meaningfulAutonomousRelationships = 0;
      let significantEvents = 0;
      let significantEventsWithTrace = 0;

      for (let season = 1; season <= seasonCount; season++) {
        const priorUnionIds = new Set(Object.keys(simulated.$unions));
        advanceSeason(simulated, undefined, { suppressSeasonalEvent: true });
        for (const [unionId, union] of Object.entries(simulated.$unions)) {
          if (priorUnionIds.has(unionId)) continue;
          autonomousRelationships += 1;
          const [firstId, secondId] = union.partners;
          if (union.active && simulated.$actors[firstId]?.spouseId === secondId && simulated.$actors[secondId]?.spouseId === firstId) {
            meaningfulAutonomousRelationships += 1;
          }
        }
        for (const entry of simulated.$chronicle) {
          const eventKey = `${entry.year}:${entry.season}:${entry.type}:${entry.description}`;
          if (seenEvents.has(eventKey)) continue;
          seenEvents.add(eventKey);
          if (!significantEventTypes.has(entry.type)) continue;
          significantEvents += 1;
          if (hasPersistentEventTrace(entry, simulated)) significantEventsWithTrace += 1;
        }
        const lineage = getLineage(simulated, founderId);
        const generations = getGenerations(lineage, founderId);
        const livingLineage = lineage.filter(actor => actor.isAlive);
        totalLineagePopulation += livingLineage.length;
        if (generations.size) maxGeneration = Math.max(maxGeneration, ...generations.values());
        if (!livingLineage.length && extinctionSeason === null) extinctionSeason = season;
      }

      const lineage = getLineage(simulated, founderId);
      const livingWorld = Object.values(simulated.$actors).filter(actor => actor.isAlive);
      const unionValues = Object.values(simulated.$unions);
      const memories = Object.values(simulated.$actors).reduce((total, actor) => total + (actor.memories?.length || 0), 0);
      const geneVariances = Object.fromEntries(geneKeys.map(key => [key, variance(lineage.map(actor => actor.genetics?.[key]).filter(Number.isFinite))]));
      metrics.push({
        lifespanYears: (extinctionSeason ?? seasonCount) / 4,
        extinct: extinctionSeason !== null,
        maxGeneration,
        finalLineagePopulation: lineage.filter(actor => actor.isAlive).length,
        meanLineagePopulation: totalLineagePopulation / seasonCount,
        worldPopulationChange: livingWorld.length - initialLivingPopulation,
        importantNpcCount: livingWorld.filter(actor => ['important', 'player-connected'].includes(actor.tier)).length,
        childrenPerUnion: unionValues.length ? unionValues.reduce((total, union) => total + union.children.length, 0) / unionValues.length : 0,
        memoryCount: memories,
        saveSizeGrowthKb: (JSON.stringify(simulated).length - initialSaveSize) / 1024,
        geneVariances,
        autonomousRelationships,
        meaningfulAutonomousRelationships,
        significantEvents,
        significantEventsWithTrace,
      });

      onProgress(run + 1, seedCount);
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const average = key => metrics.reduce((total, metric) => total + metric[key], 0) / metrics.length;
    const maxActorId = Math.max(0, ...Object.keys(sourceState.$actors).map(id => Number(id.replace('char_', '')) || 0));
    const maxUnionId = Math.max(0, ...Object.keys(sourceState.$unions).map(id => Number(id.replace('union_', '')) || 0));
    resetIdCounters(maxActorId, maxUnionId);

    const lifespans = metrics.map(metric => metric.lifespanYears).sort((a, b) => a - b);
    const middle = Math.floor(lifespans.length / 2);
    const medianLifespanYears = lifespans.length % 2
      ? lifespans[middle]
      : (lifespans[middle - 1] + lifespans[middle]) / 2;
    const sumMetric = key => metrics.reduce((total, metric) => total + metric[key], 0);
    const autonomousRelationshipCount = sumMetric('autonomousRelationships');
    const significantEventCount = sumMetric('significantEvents');

    return {
      runs: seedCount,
      seasons: seasonCount,
      extinctionRate: (metrics.filter(metric => metric.extinct).length / metrics.length) * 100,
      averageLifespanYears: average('lifespanYears'),
      medianLifespanYears,
      averageExtinctionGeneration: metrics.filter(metric => metric.extinct).length
        ? metrics.filter(metric => metric.extinct).reduce((total, metric) => total + metric.maxGeneration, 0) / metrics.filter(metric => metric.extinct).length
        : null,
      averageFinalLineagePopulation: average('finalLineagePopulation'),
      averageLineagePopulation: average('meanLineagePopulation'),
      averageWorldPopulationChange: average('worldPopulationChange'),
      averageImportantNpcCount: average('importantNpcCount'),
      averageChildrenPerUnion: average('childrenPerUnion'),
      averageMemoryCount: average('memoryCount'),
      averageSaveSizeGrowthKb: average('saveSizeGrowthKb'),
      meaningfulAutonomousRelationshipRate: autonomousRelationshipCount
        ? (sumMetric('meaningfulAutonomousRelationships') / autonomousRelationshipCount) * 100
        : null,
      significantEventTraceRate: significantEventCount
        ? (sumMetric('significantEventsWithTrace') / significantEventCount) * 100
        : null,
      averageGeneVariance: Object.fromEntries(geneKeys.map(key => [key, metrics.reduce((total, metric) => total + metric.geneVariances[key], 0) / metrics.length])),
    };
  },

  renderSidebar: function (containerEl, state, onNavigate) {
    if (!containerEl || !state) return;

    const player = state.$actors?.[state.$playerId];
    const world = state.$world || {};

    const age = player ? getActorAge(player, world.year) : 0;
    const stage = player ? getLifeStage(age) : '';
    const portraitSvg = player ? renderPortraitSVG(player, 140, world.year, world.config) : '';
    const stats = player?.stats || { martial: 50, diplomacy: 50, stewardship: 50, intrigue: 50, learning: 50 };
    const eligibleHeirs = getEligibleHeirs(state, state.$playerId);
    const currentLocation = LOCATIONS[world.location || 'tavern']?.name || 'Unknown Realm';
    const leadQuest = Object.values(state.$quests || {}).find(quest => quest.status === 'active') ||
      Object.values(state.$quests || {}).find(quest => quest.status === 'available');
    const leadObjective = leadQuest?.stages?.[leadQuest.stage];
    const leadLocation = LOCATIONS[leadObjective?.location]?.name;

    containerEl.innerHTML = `
      <div class="lineage-sidebar">
        <div class="sidebar-portrait-container">
          ${portraitSvg}
        </div>
        <div class="sidebar-ruler-info">
          <div class="sidebar-ruler-name">${player ? player.name : 'Unknown'}</div>
          <div class="sidebar-ruler-details">House ${player ? player.house : ''} | ${stage} (${age})</div>
          <div style="font-size:0.75rem; color:var(--accent-gold); margin-top:0.3rem;">
            Location: <strong>${currentLocation}</strong>
          </div>
          <div style="font-size:0.8rem; margin-top:0.4rem; display:grid; grid-template-columns:1fr 1fr; gap:0.2rem 0.5rem; background:#0f172a; padding:0.4rem; border-radius:6px; border:1px solid var(--border-subtle);">
            <span style="color:#38bdf8;">AP: <strong>${world.ap ?? 4}/${world.maxAp ?? 4}</strong></span>
            <span style="color:#ef4444;">HP: <strong>${world.health ?? 100}/${world.maxHealth ?? 100}</strong></span>
            <span style="color:#f59e0b; grid-column: span 2;">Gold: <strong>${world.gold ?? 50} g</strong></span>
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.4rem; display:grid; grid-template-columns:1fr 1fr; gap:0.2rem 0.5rem;">
            <span>MAR: ${stats.martial}</span>
            <span>DIP: ${stats.diplomacy}</span>
            <span>STE: ${stats.stewardship}</span>
            <span>INT: ${stats.intrigue}</span>
            <span style="grid-column: span 2;">LEA: ${stats.learning}</span>
          </div>
          <div class="badge-list" style="margin-top:0.5rem;">
            ${(player?.traits || []).map(t => `<span class="badge">${t}</span>`).join('')}
          </div>
        </div>

        <div class="sidebar-world-box">
          <div class="sidebar-season-title">${world.season || 'Spring'}, Year ${world.year || 1}</div>
          ${leadQuest ? `<div id="sidebar-current-lead" style="margin-top:0.45rem; padding:0.55rem; text-align:left; background:#0f172a; border-radius:6px; font-size:0.75rem;"><strong style="color:var(--accent-gold);">Current lead: ${leadQuest.title}</strong><br><span style="color:var(--text-muted);">${leadObjective?.text || 'Choose an outcome'}${leadLocation ? ` · ${leadLocation}` : ''}</span></div>` : ''}
        </div>

        <div class="sidebar-nav-buttons">
          <button class="lineage-btn lineage-btn-primary" id="btn-adv-season">Coast / Advance Season</button>
          <button class="lineage-btn" id="btn-nav-world">World Locations</button>
          <button class="lineage-btn" id="btn-nav-hub">Court & Kin</button>
          <button class="lineage-btn" id="btn-nav-tree">Family Tree</button>
          <button class="lineage-btn" id="btn-nav-quests">Quests & Journal</button>
          <button class="lineage-btn" id="btn-nav-chronicle">Chronicle</button>
          <button class="lineage-btn" id="btn-save-load-modal" style="margin-top:0.5rem; border-color:var(--border-gold);">Save / Load Manager</button>
          ${eligibleHeirs.length > 0 ? `<button class="lineage-btn" id="btn-abdicate" style="margin-top:0.5rem; border-color:var(--accent-gold); color:var(--accent-gold);">Abdicate Throne</button>` : ''}
          <button class="lineage-btn" id="btn-nav-debug" style="margin-top:0.5rem; border-color:#e11d48; color:#fda4af;">Debug Inspector</button>
        </div>
      </div>
    `;

    containerEl.querySelector('#btn-adv-season')?.addEventListener('click', () => onNavigate('advance_season'));
    containerEl.querySelector('#btn-nav-world')?.addEventListener('click', () => onNavigate('world_location'));
    containerEl.querySelector('#btn-nav-hub')?.addEventListener('click', () => onNavigate('hub'));
    containerEl.querySelector('#btn-nav-tree')?.addEventListener('click', () => onNavigate('family_tree'));
    containerEl.querySelector('#btn-nav-quests')?.addEventListener('click', () => onNavigate('quests'));
    containerEl.querySelector('#btn-nav-chronicle')?.addEventListener('click', () => onNavigate('chronicle'));
    containerEl.querySelector('#btn-save-load-modal')?.addEventListener('click', () => onNavigate('save_load_modal'));
    containerEl.querySelector('#btn-abdicate')?.addEventListener('click', () => onNavigate('abdicate'));
    containerEl.querySelector('#btn-nav-debug')?.addEventListener('click', () => onNavigate('debug_modal'));
  },

  renderFounderCreationView: function (containerEl, onComplete) {
    let name = 'Alistair';
    let house = 'Pendelton';
    let gender = 'male';
    let startingAge = 24;
    let seed = '1';
    let appearanceRoll = 0;
    let originId = 'wayfarer';
    let showLegendary = false;
    let selectedTraits = ['Strong', 'Charming'];
    let genetics = generateRandomGenetics(createSeededRng(seed));

    const render = () => {
      const origin = ORIGINS[originId] || ORIGINS.wayfarer;
      const maxTraits = 3 + origin.extraTraitSlots;

      const previewActor = createActorDTO({
        id: 'preview_founder',
        name,
        gender,
        house,
        birthYear: 1 - startingAge,
        genetics,
        traits: selectedTraits,
      });

      const traitPool = [
        ...STANDARD_TRAITS,
        ...CONGENITAL_TRAITS,
        ...(showLegendary ? LEGENDARY_TRAITS : [])
      ];

      containerEl.innerHTML = `
        <div style="max-width:850px; margin:1.5rem auto; background:var(--bg-card); padding:2rem; border-radius:12px; border:2px solid var(--border-gold); box-sizing:border-box;">
          <h2 style="color:var(--accent-gold-bright); text-align:center; margin-top:0;">Unrestricted Character Creator</h2>
          <p style="color:var(--text-muted); text-align:center;">Forge your dynasty's founder, heritage, genetics, and background.</p>

          <div style="display:flex; gap:2rem; margin-top:1.5rem; align-items:flex-start; flex-wrap:wrap;">
            <div style="text-align:center; flex:0 0 200px;">
              <div id="founder-preview-portrait">${renderPortraitSVG(previewActor, 180, 1)}</div>
              <div id="founder-age-summary" style="font-size:0.8rem; color:var(--text-muted); margin-top:0.4rem;">Age ${startingAge} (${getLifeStage(startingAge)})</div>
              <button class="lineage-btn" id="btn-randomize-genetics" style="margin-top:0.75rem; width:100%; font-size:0.8rem;">Randomize Appearance</button>
            </div>

            <div style="flex:1; min-width:300px; display:flex; flex-direction:column; gap:1rem;">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                <div>
                  <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:0.25rem;">Founder Name</label>
                  <input type="text" id="input-name" value="${name}" style="width:100%; padding:0.5rem; background:#0f172a; border:1px solid var(--border-subtle); color:#fff; border-radius:6px; box-sizing:border-box;"/>
                </div>
                <div>
                  <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:0.25rem;">Surname / Family Name (Optional)</label>
                  <input type="text" id="input-house" value="${house}" style="width:100%; padding:0.5rem; background:#0f172a; border:1px solid var(--border-subtle); color:#fff; border-radius:6px; box-sizing:border-box;"/>
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                <div>
                  <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:0.25rem;">Gender</label>
                  <select id="select-gender" style="width:100%; padding:0.5rem; background:#0f172a; border:1px solid var(--border-subtle); color:#fff; border-radius:6px;">
                    <option value="male" ${gender === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${gender === 'female' ? 'selected' : ''}>Female</option>
                  </select>
                </div>
                <div>
                  <label id="founder-age-label" style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:0.25rem;">Starting Age: <strong>${startingAge}</strong></label>
                  <input type="range" id="slider-age" min="14" max="60" value="${startingAge}" style="width:100%; cursor:pointer;"/>
                  <div id="founder-age-warning" style="color:#fbbf24; font-size:0.75rem; display:${startingAge > 45 ? 'block' : 'none'};">Starting this late without heirs risks an early end to the house.</div>
                </div>
              </div>
              <div><label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:0.25rem;">Dynasty Seed</label><input type="text" id="input-seed" value="${seed}" style="width:100%; padding:0.5rem; background:#0f172a; border:1px solid var(--border-subtle); color:#fff; border-radius:6px; box-sizing:border-box;"/><small style="color:var(--text-muted);">The same seed and choices reproduce the same world.</small></div>

              <div>
                <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:0.25rem;">Origin / Background Selection</label>
                <select id="select-origin" style="width:100%; padding:0.5rem; background:#0f172a; border:1px solid var(--border-subtle); color:#fff; border-radius:6px;">
                  ${Object.values(ORIGINS).map(o => `
                    <option value="${o.id}" ${originId === o.id ? 'selected' : ''}>${o.name} (${o.gold} Gold, starts at ${LOCATIONS[o.location].name})</option>
                  `).join('')}
                </select>
                <div style="font-size:0.8rem; color:var(--accent-gold); margin-top:0.25rem;">${origin.description}</div>
              </div>

              <details style="background:#0f172a; padding:0.75rem; border-radius:6px; border:1px solid var(--border-subtle);">
                <summary style="cursor:pointer; font-weight:bold; color:var(--accent-gold); font-size:0.85rem;">Direct Genetic / Appearance Sliders</summary>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.5rem; font-size:0.8rem;">
                  <div>
                    <label>Skin Tone: ${genetics.skinTone}</label>
                    <input type="range" class="gen-slider" data-gene="skinTone" min="0" max="100" value="${genetics.skinTone}" style="width:100%;"/>
                  </div>
                  <div>
                    <label>Hair Color: ${genetics.hairColor}</label>
                    <input type="range" class="gen-slider" data-gene="hairColor" min="0" max="100" value="${genetics.hairColor}" style="width:100%;"/>
                  </div>
                  <div>
                    <label>Eye Color: ${genetics.eyeColor}</label>
                    <input type="range" class="gen-slider" data-gene="eyeColor" min="0" max="100" value="${genetics.eyeColor}" style="width:100%;"/>
                  </div>
                  <div>
                    <label>Jaw Width: ${genetics.jawWidth}</label>
                    <input type="range" class="gen-slider" data-gene="jawWidth" min="0" max="100" value="${genetics.jawWidth}" style="width:100%;"/>
                  </div>
                  <div>
                    <label>Face Shape: ${genetics.faceShape}</label>
                    <input type="range" class="gen-slider" data-gene="faceShape" min="0" max="100" value="${genetics.faceShape}" style="width:100%;"/>
                  </div>
                </div>
              </details>

              <div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <label style="font-size:0.85rem; color:var(--text-muted);">Starting Traits (up to ${maxTraits} ordinary + 1 legendary)</label>
                  <label style="font-size:0.75rem; color:var(--accent-gold); cursor:pointer;">
                    <input type="checkbox" id="chk-toggle-legendary" ${showLegendary ? 'checked' : ''}/> Include Legendary Bloodlines
                  </label>
                </div>
                <div style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-top:0.4rem; max-height:120px; overflow-y:auto; background:#0f172a; padding:0.5rem; border-radius:6px; border:1px solid var(--border-subtle);">
                  ${traitPool.map(t => {
                    const isChecked = selectedTraits.includes(t);
                    return `
                      <label style="font-size:0.75rem; background:${isChecked ? 'var(--border-gold)' : '#1e293b'}; padding:0.2rem 0.5rem; border-radius:4px; border:1px solid var(--border-subtle); cursor:pointer;">
                        <input type="checkbox" class="chk-trait" value="${t}" ${isChecked ? 'checked' : ''}/> ${t}
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          </div>

          <div style="display:flex; gap:1rem; margin-top:1.5rem; justify-content:center;">
            <button class="lineage-btn" id="btn-quick-start">Randomize / Quick Start</button>
            <button class="lineage-btn lineage-btn-primary" id="btn-confirm-founder">Found Dynasty</button>
          </div>
        </div>
      `;

      const refreshPreview = () => {
        const preview = createActorDTO({ id: 'preview_founder', name, gender, house, birthYear: 1 - startingAge, genetics, traits: selectedTraits });
        const portrait = containerEl.querySelector('#founder-preview-portrait');
        if (portrait) portrait.innerHTML = renderPortraitSVG(preview, 180, 1);
        const ageSummary = containerEl.querySelector('#founder-age-summary');
        if (ageSummary) ageSummary.innerText = `Age ${startingAge} (${getLifeStage(startingAge)})`;
      };

      containerEl.querySelector('#input-name')?.addEventListener('input', (e) => { name = e.target.value; });
      containerEl.querySelector('#input-seed')?.addEventListener('input', (e) => { seed = e.target.value || '1'; });
      containerEl.querySelector('#input-house')?.addEventListener('input', (e) => { house = e.target.value; refreshPreview(); });
      containerEl.querySelector('#select-gender')?.addEventListener('change', (e) => {
        gender = e.target.value;
        render();
      });

      containerEl.querySelector('#slider-age')?.addEventListener('input', (e) => {
        startingAge = parseInt(e.target.value, 10);
        const label = containerEl.querySelector('#founder-age-label');
        if (label) label.innerHTML = `Starting Age: <strong>${startingAge}</strong>`;
        const warning = containerEl.querySelector('#founder-age-warning');
        if (warning) warning.style.display = startingAge > 45 ? 'block' : 'none';
        refreshPreview();
      });

      containerEl.querySelector('#select-origin')?.addEventListener('change', (e) => {
        originId = e.target.value;
        render();
      });

      containerEl.querySelector('#chk-toggle-legendary')?.addEventListener('change', (e) => {
        showLegendary = e.target.checked;
        render();
      });

      containerEl.querySelectorAll('.gen-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
          const gene = e.target.getAttribute('data-gene');
          genetics[gene] = parseInt(e.target.value, 10);
          const label = e.target.parentElement.querySelector('label');
          if (label) label.innerText = `${gene.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase())}: ${genetics[gene]}`;
          refreshPreview();
        });
      });

      containerEl.querySelectorAll('.chk-trait').forEach(chk => {
        chk.addEventListener('change', () => {
          const origin = ORIGINS[originId] || ORIGINS.wayfarer;
          const maxTraits = 3 + origin.extraTraitSlots;

          const checked = Array.from(containerEl.querySelectorAll('.chk-trait:checked')).map(c => c.value);
          const legendaryCount = checked.filter(t => LEGENDARY_TRAITS.includes(t)).length;
          const ordinaryCount = checked.length - legendaryCount;
          if (legendaryCount <= 1 && ordinaryCount <= maxTraits) {
            selectedTraits = checked;
          } else {
            chk.checked = false;
          }
          const label = chk.closest('label');
          if (label) label.style.background = chk.checked ? 'var(--border-gold)' : '#1e293b';
        });
      });

      containerEl.querySelector('#btn-randomize-genetics')?.addEventListener('click', () => {
        appearanceRoll += 1;
        genetics = generateRandomGenetics(createSeededRng(`${seed}:appearance:${appearanceRoll}`));
        render();
      });

      containerEl.querySelector('#btn-quick-start')?.addEventListener('click', () => {
        genetics = generateRandomGenetics(createSeededRng(`${seed}:quick`));
        name = gender === 'male' ? 'Alistair' : 'Aurelia';
        house = 'Pendelton';
        startingAge = 24;
        originId = 'wayfarer';
        selectedTraits = ['Strong', 'Charming'];
        seed = '1';
        onComplete({ name, house, gender, age: startingAge, originId, traits: selectedTraits, genetics, seed });
      });

      containerEl.querySelector('#btn-confirm-founder')?.addEventListener('click', () => {
        const nameVal = containerEl.querySelector('#input-name')?.value || name;
        const houseVal = containerEl.querySelector('#input-house')?.value || house;
        const genderVal = containerEl.querySelector('#select-gender')?.value || gender;
        onComplete({ name: nameVal, house: houseVal, gender: genderVal, age: startingAge, originId, traits: selectedTraits, genetics, seed });
      });
    };

    render();
  },

  renderWorldLocationView: function (containerEl, state, onNavigate, initialFeedback = '') {
    const world = state.$world;
    const player = state.$actors[state.$playerId];
    let activityFeedback = initialFeedback;
    let viewTab = 'present'; // 'present' or 'kin'

    const render = () => {
    const locationKey = world.location || 'tavern';
    const locInfo = LOCATIONS[locationKey] || LOCATIONS.tavern;
    const quickTravelAvailable = (player?.traits || []).includes('Quick') && !world.quickTravelUsed;
    const travelCostLabel = quickTravelAvailable ? 'Free quick travel' : '1 AP';
    let locationDescription = locInfo.description;
    if (locationKey === 'woods' && world.flags?.beastPacified) locationDescription = 'The ancient guardian watches over the Whispering Woods in peace. Farmers and hunters return without fear.';
    if (locationKey === 'woods' && world.flags?.beastSlain) locationDescription = 'The beast is gone, and hunters have begun to reclaim the Whispering Woods. Stories of your family’s deed travel along the paths.';
    if (locationKey === 'ruins' && world.flags?.firstBloodlineRelic === 'dynasty') locationDescription = 'The vault stands open and empty. The First Bloodline relic now rests with your house.';
    if (locationKey === 'ruins' && world.flags?.bloodlineTruth === 'shared') locationDescription = 'The sealed chamber has yielded its inscription. Scholars have begun sharing the First Bloodline discovery across the region.';
    if (locationKey === 'ruins' && world.flags?.bloodlineTruth === 'guarded') locationDescription = 'The sealed chamber has yielded its inscription, now held as a guarded secret of your house.';
    if (locationKey === 'shrine' && world.flags?.firstBloodlineRelic === 'shrine') locationDescription = 'Scholars study the First Bloodline relic here, preserving the knowledge your ancestor placed in their care.';
    if (locationKey === 'keep' && world.flags?.bladeContract === 'fulfilled') locationDescription = 'The keep’s officers remember that your family honored the old contract.';
    if (locationKey === 'keep' && world.flags?.bladeContract === 'withdrawn') locationDescription = 'The commander prepared the keep after your ancestor warned them of the contract’s danger.';

      let npcs = Object.values(state.$actors).filter(a => a.isAlive && a.id !== state.$playerId);

      if (viewTab === 'present') {
        npcs = npcs.filter(a => (a.location || 'tavern') === locationKey);
      } else {
        npcs = npcs.filter(a => a.house === player.house || (player.children && player.children.includes(a.id)) || (player.parents && player.parents.includes(a.id)));
      }

      containerEl.innerHTML = `
        <div style="background:var(--bg-card); padding:1.5rem; border-radius:10px; border:1px solid var(--border-gold); margin-bottom:1.5rem;">
          <h2 style="color:var(--accent-gold-bright); margin-top:0;">${locInfo.name}</h2>
          <p style="color:var(--text-muted); font-size:0.95rem; line-height:1.5;">${locationDescription}</p>

          <div style="margin-top:1rem; display:flex; gap:0.75rem; flex-wrap:wrap;">
            <button class="lineage-btn lineage-btn-primary" id="act-explore">Explore ${locInfo.name} (1 AP)</button>
            ${(locInfo.activities || []).map(act => `
              <button class="lineage-btn act-local-btn" data-act-id="${act.id}" title="${act.desc}">${act.name} (${act.costAp ?? 1} AP)</button>
            `).join('')}
          </div>

          <div id="location-feedback" role="status" aria-live="polite" style="margin-top:1rem; color:var(--accent-gold); font-weight:bold; min-height:1.2rem;">${activityFeedback}</div>
        </div>

        <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="color:var(--accent-gold); margin:0;">Travel to Another Location (${travelCostLabel})</h3>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem; margin-bottom:2rem;">
          ${Object.values(LOCATIONS).map(l => `
            <button class="lineage-btn travel-btn ${l.id === locationKey ? 'lineage-btn-primary' : ''}" data-loc-id="${l.id}" ${l.id === locationKey ? 'disabled' : ''}>
              ${l.name} ${l.id === locationKey ? '(Here)' : `(${travelCostLabel})`}
            </button>
          `).join('')}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h3 style="color:var(--accent-gold); margin:0;">People in the Area</h3>
          <div>
            <button class="lineage-btn ${viewTab === 'present' ? 'lineage-btn-primary' : ''}" id="tab-loc-present">Present Here (${npcs.length})</button>
            <button class="lineage-btn ${viewTab === 'kin' ? 'lineage-btn-primary' : ''}" id="tab-loc-kin">Known Kin Elsewhere</button>
          </div>
        </div>

        <div class="character-grid">
          ${npcs.length === 0 ? `<p style="color:var(--text-muted); grid-column:span 3;">No characters currently present at this location.</p>` : ''}
          ${npcs.map(actor => {
            const age = getActorAge(actor, state.$world.year);
            const stage = getLifeStage(age);
            const compat = player ? calculateCompatibility(player, actor, state.$actors, world.config) : 50;

            return `
              <div class="character-card" data-actor-id="${actor.id}">
                ${renderPortraitSVG(actor, 120, state.$world.year, state.$world.config)}
                <div class="character-card-name">${actor.name}</div>
                <div class="character-card-meta">House ${actor.house} | ${stage} (${age})</div>
                <div class="character-card-meta" style="color:var(--accent-gold);">Loc: ${LOCATIONS[actor.location || 'tavern']?.name || 'Unknown'}</div>
                <div class="badge-list">
                  ${actor.traits.map(t => `<span class="badge">${t}</span>`).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      containerEl.querySelector('#tab-loc-present')?.addEventListener('click', () => { viewTab = 'present'; render(); });
      containerEl.querySelector('#tab-loc-kin')?.addEventListener('click', () => { viewTab = 'kin'; render(); });

      containerEl.querySelectorAll('.character-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-actor-id');
          onNavigate('interaction', id);
        });
      });

      containerEl.querySelectorAll('.travel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const newLoc = btn.getAttribute('data-loc-id');
          const quickMove = (player?.traits || []).includes('Quick') && !world.quickTravelUsed;
          if (!quickMove && world.ap <= 0) {
            const fb = containerEl.querySelector('#location-feedback');
            if (fb) fb.innerText = 'You are out of Action Points (AP)! Advance Season / Rest to recover.';
            return;
          }
          if (quickMove) world.quickTravelUsed = true;
          else world.ap -= 1;
          world.location = newLoc;
          if (player) player.location = newLoc;
          activityFeedback = `Travelled to ${LOCATIONS[newLoc]?.name || 'the new location'} (${quickMove ? 'free quick travel' : '1 AP'}).`;
          onNavigate('world_location', activityFeedback);
        });
      });

      containerEl.querySelector('#act-explore')?.addEventListener('click', () => {
        if (world.ap <= 0) {
          const fb = containerEl.querySelector('#location-feedback');
          if (fb) fb.innerText = 'You are out of Action Points (AP)! Advance Season / Rest to recover.';
          return;
        }
        world.ap -= 1;
        LineageEngine.triggerProceduralEncounterModal(state, () => {
          onNavigate('world_location');
        });
      });

      containerEl.querySelectorAll('.act-local-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const actId = btn.getAttribute('data-act-id');
          const act = (locInfo.activities || []).find(a => a.id === actId);
          if (!act) return;

          const actionCost = Math.max(0, Number(act.costAp ?? 1));
          if ((world.ap || 0) < actionCost) {
            activityFeedback = 'You are out of Action Points (AP)! Advance Season / Rest to recover.';
            render();
            return;
          }

          if (act.goldCost && (world.gold || 0) < act.goldCost) {
            activityFeedback = `You need at least ${act.goldCost} Gold for this activity.`;
            render();
            return;
          }

          world.ap -= actionCost;
          if (act.goldCost) world.gold -= act.goldCost;
          if (act.goldGain) world.gold = (world.gold || 0) + act.goldGain;
          if (act.healthGain) world.health = clamp((world.health || 100) + act.healthGain, 0, world.maxHealth || 100);

          if (act.statGain && player) {
            player.stats[act.statGain] = clamp((player.stats[act.statGain] || 50) + 2, 0, 100);
          }

          if (actId === 'delve_ruins') {
            const roll = nextRandom(state);
            let outcome;
            if (roll < 0.30) {
              world.gold = (world.gold || 0) + 30;
              outcome = 'You uncover a sealed coin cache among the fallen stones and gain 30 Gold.';
            } else if (roll < 0.60) {
              player.stats.learning = clamp((player.stats.learning || 50) + 2, 0, 100);
              world.flags ||= {};
              world.flags.aetherFragmentFound = true;
              outcome = recordAetherFragmentDiscovery(state, 'You decipher a fragment of runes and gain 2 Learning. The fragment is recorded in your discoveries.');
            } else if (roll < 0.80) {
              world.health = clamp((world.health || 100) - 12, 0, world.maxHealth || 100);
              outcome = 'A shifting stone trap catches you. You escape, but lose 12 Health.';
            } else {
              outcome = 'You hear stone shifting deeper in the vault, but cannot safely continue this season. The passage may be worth another attempt.';
            }
            addMemory(state, player.id, { type: 'ruins_expedition', actorIds: [player.id], context: outcome, weight: 3 });
            addChronicleEntry(state, `${player.name} delved into the Sunken Aether Ruins. ${outcome}`, 'exploration', [player.id]);
            activityFeedback = outcome;
          } else {
            activityFeedback = `Activity completed: ${act.desc}`;
          }
          onNavigate('world_location', activityFeedback);
        });
      });
    };

    render();
  },

  triggerProceduralEncounterModal: function (state, onClose) {
    const modalSlot = document.getElementById('modal-slot');
    if (!modalSlot) return;

    const location = state.$world.location || 'tavern';
    const localEncounters = PROCEDURAL_ENCOUNTERS.filter(encounter => !encounter.locations?.length || encounter.locations.includes(location));
    const encounterPool = localEncounters.length ? localEncounters : PROCEDURAL_ENCOUNTERS;
    const enc = encounterPool[Math.floor(nextRandom(state) * encounterPool.length)];
    const player = state.$actors[state.$playerId];

    modalSlot.innerHTML = `
      <div class="lineage-modal-overlay">
        <div class="lineage-modal-content" style="max-width:550px;">
          <h3 style="color:var(--accent-gold-bright); margin-top:0;">${enc.title}</h3>
          <p style="color:var(--text-muted); line-height:1.5;">${enc.text}</p>

          <div style="display:flex; flex-direction:column; gap:0.75rem; margin-top:1.5rem;" id="enc-choices-box">
            ${enc.choices.map((c, idx) => `
              <button class="lineage-btn enc-choice-btn" data-choice-idx="${idx}" ${c.costGold && (state.$world.gold || 0) < c.costGold ? 'disabled title="You do not have enough Gold for this choice."' : ''} style="text-align:left; padding:0.75rem;">
                ${c.text}
              </button>
            `).join('')}
          </div>

          <div id="enc-result-box" style="display:none; margin-top:1.5rem;">
            <p id="enc-result-text" role="status" aria-live="polite" style="font-weight:bold; color:var(--accent-gold);"></p>
            <button class="lineage-btn lineage-btn-primary" id="btn-close-enc" style="width:100%; margin-top:1rem;">Continue Journey</button>
          </div>
        </div>
      </div>
    `;

    modalSlot.querySelectorAll('.enc-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-choice-idx'), 10);
        const choice = enc.choices[idx];

        let success = true;
        if (choice.check && player) {
          const statVal = player.stats[choice.check] || 50;
          const roll = statVal + Math.floor(nextRandom(state) * 30);
          success = roll >= choice.dc;
        }

        if (choice.costGold) {
          if ((state.$world.gold || 0) < choice.costGold) {
            success = false;
          } else {
            state.$world.gold -= choice.costGold;
          }
        }

        const resBox = modalSlot.querySelector('#enc-result-box');
        const choicesBox = modalSlot.querySelector('#enc-choices-box');
        const resText = modalSlot.querySelector('#enc-result-text');

        if (choicesBox) choicesBox.style.display = 'none';
        if (resBox) resBox.style.display = 'block';

        if (success) {
          if (choice.successGold) state.$world.gold = (state.$world.gold || 0) + choice.successGold;
          if (choice.successHp) state.$world.health = clamp((state.$world.health || 100) + choice.successHp, 0, state.$world.maxHealth || 100);
          if (choice.successStat && player) {
            Object.entries(choice.successStat).forEach(([st, val]) => {
              player.stats[st] = clamp((player.stats[st] || 50) + val, 0, 100);
            });
          }
          if (resText) resText.innerText = choice.successText || 'You succeeded!';
        } else {
          if (choice.failGold) state.$world.gold = Math.max(0, (state.$world.gold || 0) + choice.failGold);
          if (choice.failHp) state.$world.health = clamp((state.$world.health || 100) + choice.failHp, 0, state.$world.maxHealth || 100);
          if (resText) resText.innerText = choice.failText || 'You failed the attempt.';
        }

        const resultText = resText?.innerText || (success ? choice.successText : choice.failText) || 'The encounter is over.';
        addMemory(state, player.id, { type: 'exploration', actorIds: [player.id], location: state.$world.location, context: `${enc.title}: ${resultText}`, weight: 3 });
        addChronicleEntry(state, `${player.name} encountered ${enc.title} at ${LOCATIONS[state.$world.location]?.name || state.$world.location}. ${resultText}`, 'exploration', [player.id]);

        modalSlot.querySelector('#btn-close-enc')?.addEventListener('click', () => {
          modalSlot.innerHTML = '';
          onClose();
        });
      });
    });
  },

  openSeasonalEventModal: function (state, event, onClose) {
    const modalSlot = document.getElementById('modal-slot');
    if (!modalSlot || !event) return;
    modalSlot.innerHTML = `
      <div class="lineage-modal-overlay">
        <div class="lineage-modal-content" style="max-width:560px;">
          <h3 style="color:var(--accent-gold-bright); margin-top:0;">${event.title}</h3>
          <p style="color:var(--text-muted); line-height:1.5;">${event.text}</p>
          <div style="display:flex; flex-direction:column; gap:0.75rem; margin-top:1.25rem;">
            ${event.choices.map(choice => `<button class="lineage-btn seasonal-choice-btn" data-choice-id="${choice.id}" ${choice.costGold && (state.$world.gold || 0) < choice.costGold ? 'disabled' : ''} style="text-align:left; padding:0.8rem;"><strong>${choice.label}</strong><br><small style="color:var(--text-muted);">${choice.description}</small></button>`).join('')}
          </div>
        </div>
      </div>
    `;
    modalSlot.querySelectorAll('.seasonal-choice-btn').forEach(button => {
      button.addEventListener('click', () => {
        const choiceId = button.getAttribute('data-choice-id');
        if (!resolveSeasonalEvent(state, choiceId)) return;
        modalSlot.innerHTML = '';
        onClose();
      });
    });
  },

  renderQuestsView: function (containerEl, state, onUpdate = () => {}, initialFeedback = '', onFeedback = () => {}) {
    const quests = state.$quests || {};
    let questFeedback = initialFeedback;
    const showQuestFeedback = message => {
      questFeedback = message;
      onFeedback(message);
    };
    const currentPlayer = state.$actors?.[state.$playerId];
    const quickTravelAvailable = (currentPlayer?.traits || []).includes('Quick') && !state.$world.quickTravelUsed;
    const travelCostLabel = quickTravelAvailable ? 'Free quick travel' : '1 AP';
    const currentHouse = Object.values(state.$houses || {}).find(house => house.name === currentPlayer?.house);
    const houseRelations = [];
    for (const [houseKey, house] of Object.entries(state.$houses || {})) {
      for (const [otherKey, value] of Object.entries(house.relations || {})) {
        if (houseKey < otherKey && value !== 0) {
          const status = value <= -40 ? 'Feud' : value <= -15 ? 'Rivalry' : value >= 30 ? 'Alliance' : 'Strained';
          houseRelations.push({ first: house.name, second: state.$houses[otherKey]?.name || otherKey, value, status });
        }
      }
    }

    containerEl.innerHTML = `
      <h2 style="color:var(--accent-gold-bright); margin-top:0;">Quests & Journal</h2>
      <p style="color:var(--text-muted);">Track ongoing story arcs, rumored relics, and generational goals.</p>
      <div id="quest-feedback" role="status" aria-live="polite" style="min-height:1.2rem; color:var(--accent-gold); font-weight:bold;">${questFeedback}</div>

      <div style="display:flex; flex-direction:column; gap:1rem; margin-top:1.5rem;">
        ${Object.values(quests).map(q => {
          const curStageText = q.stages[q.stage]?.text || 'Quest completed!';
          const isAtLocation = (state.$world.location || 'tavern') === q.stages[q.stage]?.location;
          const isFinalChoice = q.stage === q.maxStage - 1 && q.outcomes?.length;

          return `
            <div style="background:var(--bg-card); padding:1.25rem; border-radius:8px; border:1px solid var(--border-subtle); display:flex; flex-wrap:wrap; gap:1rem; align-items:flex-start;">
              <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <h3 style="color:var(--accent-gold); margin:0;">${q.title}</h3>
                  <span class="badge" style="background:#0f172a;">${q.status === 'completed' ? 'Completed' : `${q.status === 'active' ? 'Active' : 'Available'} · Stage ${q.stage + 1} / ${q.maxStage}`}</span>
                </div>
                <p style="color:var(--text-muted); font-size:0.85rem; margin:0.4rem 0;">${q.description}</p>
                ${q.id === 'relic_bloodline' && state.$world.flags?.aetherFragmentFound && q.status !== 'completed' ? `<p class="quest-discovery-hint" style="color:var(--accent-gold); font-size:0.82rem; margin:0 0 0.5rem;">Discovery: Your rune fragment can guide you to the sealed vault. ${q.stage === 0 ? 'First consult the scholar at the shrine.' : ''}</p>` : ''}
                ${q.status === 'completed' && q.outcomeId ? `<p style="color:var(--accent-gold); font-size:0.8rem; margin:0 0 0.5rem;">Outcome: ${q.outcomes?.find(outcome => outcome.id === q.outcomeId)?.label || q.outcomeId}</p>` : ''}
                ${q.handoffs?.length ? `<p style="color:var(--accent-gold); font-size:0.8rem; margin:0 0 0.5rem;">Carried by ${q.handoffs.length} heir${q.handoffs.length === 1 ? '' : 's'} since ${state.$actors[q.originatorId]?.name || 'an earlier generation'}.</p>` : ''}
                ${q.pressure ? `<p style="color:#fca5a5; font-size:0.8rem; margin:0 0 0.5rem;">Pressure: ${q.pressure}/${state.$world.config?.QUEST_PRESSURE_MAX ?? 5} · Unresolved complications may reduce the final reward.</p>` : ''}
                <div style="background:#0f172a; padding:0.6rem; border-radius:6px; border:1px solid var(--border-subtle); font-size:0.85rem; color:#fff;">
                  <strong>Current Objective:</strong> ${q.id === 'relic_bloodline' && q.stage === 1 && state.$world.flags?.aetherFragmentFound ? 'Use the rune fragment to locate the sealed vault.' : curStageText}<br>
                  <small style="color:var(--text-muted);">Destination: ${LOCATIONS[q.stages[q.stage]?.location]?.name || 'Complete'} · ${isAtLocation ? 'Progress costs 1 AP' : `Travel costs ${travelCostLabel}`}</small>
                </div>
              </div>
              ${q.status !== 'completed' && isFinalChoice && isAtLocation ? `
                <div style="display:flex; flex-direction:column; gap:0.4rem; min-width:230px;">${q.outcomes.map(outcome => {
                  const effects = outcome.consequences || {};
                  const preview = [
                    effects.gold ? `${effects.gold > 0 ? '+' : ''}${effects.gold} Gold` : '',
                    ...Object.entries(effects.stats || {}).map(([stat, amount]) => `${amount > 0 ? '+' : ''}${amount} ${stat}`),
                    effects.houseRenown ? `+${effects.houseRenown} House Renown` : '',
                    ...(effects.houseRelations || []).map(relation => `${relation.a} / ${relation.b} relations ${relation.delta > 0 ? '+' : ''}${relation.delta}`),
                    ...Object.entries(effects.worldFlags || {}).map(([flag, value]) => `World: ${flag.replaceAll('_', ' ')} → ${String(value)}`),
                  ].filter(Boolean).join(' · ');
                  return `<button class="lineage-btn quest-outcome-btn" data-quest-id="${q.id}" data-outcome-id="${outcome.id}">${outcome.label} (1 AP)</button><small style="color:var(--text-muted);">${outcome.description}${preview ? `<br><strong>Effects:</strong> ${preview}` : ''}</small>`;
                }).join('')}</div>
              ` : q.status !== 'completed' && q.stage < q.maxStage ? `
                <button class="lineage-btn quest-adv-btn ${isAtLocation ? 'lineage-btn-primary' : ''}" data-quest-id="${q.id}">
                  ${isAtLocation ? 'Progress Quest (1 AP)' : `Travel to ${LOCATIONS[q.stages[q.stage]?.location]?.name} (${travelCostLabel})`}
                </button>
              ` : `<span class="badge" style="background:var(--accent-gold); color:#000;">COMPLETED</span>`}
            </div>
          `;
        }).join('')}
      </div>
      <section style="margin-top:2rem; padding:1rem; background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:8px;">
        <h3 style="margin:0 0 0.75rem; color:var(--accent-gold);">House Relations</h3>
        ${currentPlayer ? `<p style="margin:0 0 0.75rem; color:var(--text-muted);">House ${currentPlayer.house} Renown: <strong style="color:var(--accent-gold);">${currentHouse?.renown ?? 0}</strong> · Descendants carry this reputation forward.</p>` : ''}
        ${houseRelations.length ? houseRelations.map(relation => `<div style="padding:0.35rem 0;">${relation.first} and ${relation.second}: <strong style="color:${relation.value < 0 ? '#f87171' : '#86efac'}">${relation.status} (${relation.value > 0 ? '+' : ''}${relation.value})</strong></div>`).join('') : '<div style="color:var(--text-muted);">No significant alliances or rivalries have formed yet.</div>'}
      </section>
    `;

    containerEl.querySelectorAll('.quest-adv-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = btn.getAttribute('data-quest-id');
        const q = state.$quests[qId];
        if (!q) return;

        const stageLocation = q.stages[q.stage]?.location;
        if (stageLocation && stageLocation !== (state.$world.location || 'tavern')) {
          const player = state.$actors[state.$playerId];
          const quickMove = (player?.traits || []).includes('Quick') && !state.$world.quickTravelUsed;
          if (!quickMove && (state.$world.ap || 0) <= 0) {
            const feedback = containerEl.querySelector('#quest-feedback');
            showQuestFeedback('You are out of Action Points (AP)! Advance Season / Rest to recover.');
            if (feedback) feedback.innerText = questFeedback;
            return;
          }
          if (quickMove) state.$world.quickTravelUsed = true;
          else state.$world.ap -= 1;
          state.$world.location = stageLocation;
          if (player) player.location = stageLocation;
          let travelMessage = `Travelled to ${LOCATIONS[stageLocation]?.name || stageLocation} to pursue ${q.title}.`;
          if (q.id === 'relic_bloodline' && q.stage === 1 && state.$world.flags?.aetherFragmentFound) {
            q.stage = 2;
            q.status = 'active';
            const goal = (player?.goals || []).find(item => item.questId === q.id);
            if (goal) goal.progress = q.stage;
            travelMessage += ' Your rune fragment leads you directly to the sealed vault; choose what to do with the relic.';
            addMemory(state, player.id, { type: 'quest', actorIds: [player.id], context: `The rune fragment led you to the sealed vault in ${q.title}.`, weight: 5 });
            addChronicleEntry(state, `${player.name} followed the rune fragment to the sealed vault in ${q.title}.`, 'quest', [player.id]);
          }
          addChronicleEntry(state, `${player?.name || 'The player'} travelled to ${LOCATIONS[stageLocation]?.name || stageLocation} to pursue ${q.title}.`, 'travel', player ? [player.id] : []);
          showQuestFeedback(`${travelMessage} Travel cost: ${quickMove ? 'free quick travel' : '1 AP'}.`);
          onUpdate();
          return;
        }

        if ((state.$world.ap || 0) <= 0) {
          const feedback = containerEl.querySelector('#quest-feedback');
          showQuestFeedback('You are out of Action Points (AP)! Advance Season / Rest to recover.');
          if (feedback) feedback.innerText = questFeedback;
          return;
        }

        const completedObjective = q.stages[q.stage]?.text || q.title;
        state.$world.ap -= 1;
        q.stage += 1;
        const player = state.$actors[state.$playerId];
        q.status = 'active';
        const goal = (player?.goals || []).find(item => item.questId === q.id);
        if (goal) goal.progress = q.stage;
        else if (player) player.goals.push({ type: 'quest', questId: q.id, priority: 3, progress: q.stage });
        addChronicleEntry(state, `${player?.name || 'The player'} advanced “${q.title}”: ${q.stages[q.stage - 1]?.text || q.title}.`, 'quest', player ? [player.id] : []);
        if (q.stage >= q.maxStage && !q.outcomes?.length) {
          state.$world.gold = (state.$world.gold || 0) + 50;
          q.status = 'completed';
          if (player) addMemory(state, player.id, { type: 'quest', actorIds: [player.id], context: `Completed ${q.title} and earned 50 Gold.`, weight: 4 });
          addChronicleEntry(state, `Completed quest: ${q.title}! (+50 Gold)`, 'quest', player ? [player.id] : []);
        }

        showQuestFeedback(q.status === 'completed'
          ? `Completed ${q.title}. The reward and result are recorded in your chronicle.`
          : `Completed objective: ${completedObjective} Current objective: ${q.stages[q.stage]?.text || 'Choose an outcome'}. Cost: 1 AP.`);
        onUpdate();
      });
    });
    containerEl.querySelectorAll('.quest-outcome-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = btn.getAttribute('data-quest-id');
        const outcomeId = btn.getAttribute('data-outcome-id');
        const quest = state.$quests[qId];
        if (!quest || (state.$world.location || 'tavern') !== quest.stages[quest.stage]?.location) return;
        if (!resolveQuestOutcome(state, qId, outcomeId)) {
          const feedback = containerEl.querySelector('#quest-feedback');
          showQuestFeedback('You need at least 1 Action Point to resolve this quest.');
          if (feedback) feedback.innerText = questFeedback;
          return;
        }
        const selectedOutcome = quest.outcomes.find(outcome => outcome.id === outcomeId);
        showQuestFeedback(`${quest.title} resolved: ${selectedOutcome?.label || outcomeId}. The result is recorded in your memory and chronicle.`);
        onUpdate();
      });
    });
  },

  renderHubView: function (containerEl, state, onSelectNPC) {
    const player = state.$actors[state.$playerId];
    let currentFilter = 'all';

    const render = () => {
      let actors = Object.values(state.$actors).filter(a => a.id !== state.$playerId && a.isAlive);

      if (currentFilter === 'kin') {
        actors = actors.filter(a => a.house === player.house || (player.children && player.children.includes(a.id)) || (player.parents && player.parents.includes(a.id)));
      } else if (currentFilter === 'court') {
        actors = actors.filter(a => a.house !== player.house);
      } else if (currentFilter === 'candidates') {
        actors = actors.filter(a => {
          const age = getActorAge(a, state.$world.year);
          return age >= 16 && age <= 50 && !a.spouseId;
        });
      }

      containerEl.innerHTML = `
        <h2 style="color:var(--accent-gold-bright); margin-top:0;">Dynastic Court & Kin</h2>
        <p style="color:var(--text-muted);">Interact with Court Members, Rivals, and Kin to build alliances or produce heirs.</p>

        <div style="display:flex; gap:0.5rem; margin-bottom:1.5rem; flex-wrap:wrap;">
          <button class="lineage-btn ${currentFilter === 'all' ? 'lineage-btn-primary' : ''}" id="tab-all">All</button>
          <button class="lineage-btn ${currentFilter === 'kin' ? 'lineage-btn-primary' : ''}" id="tab-kin">Family & Kin</button>
          <button class="lineage-btn ${currentFilter === 'court' ? 'lineage-btn-primary' : ''}" id="tab-court">Court & Houses</button>
          <button class="lineage-btn ${currentFilter === 'candidates' ? 'lineage-btn-primary' : ''}" id="tab-candidates">Marriage Candidates</button>
        </div>

        <div class="character-grid">
          ${actors.map(actor => {
            const age = getActorAge(actor, state.$world.year);
            const stage = getLifeStage(age);
            const compat = player ? calculateCompatibility(player, actor, state.$actors, state.$world.config) : 50;

            return `
              <div class="character-card" data-actor-id="${actor.id}">
                ${renderPortraitSVG(actor, 120, state.$world.year, state.$world.config)}
                <div class="character-card-name">${actor.name}</div>
                <div class="character-card-meta">House ${actor.house} | ${stage} (${age})</div>
                <div class="character-card-meta" style="color:var(--accent-gold);">Compat: ${compat}%</div>
                <div class="badge-list">
                  ${actor.traits.map(t => `<span class="badge">${t}</span>`).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      containerEl.querySelector('#tab-all')?.addEventListener('click', () => { currentFilter = 'all'; render(); });
      containerEl.querySelector('#tab-kin')?.addEventListener('click', () => { currentFilter = 'kin'; render(); });
      containerEl.querySelector('#tab-court')?.addEventListener('click', () => { currentFilter = 'court'; render(); });
      containerEl.querySelector('#tab-candidates')?.addEventListener('click', () => { currentFilter = 'candidates'; render(); });

      containerEl.querySelectorAll('.character-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-actor-id');
          onSelectNPC(id);
        });
      });
    };

    render();
  },

  renderInteractionView: function (containerEl, state, targetActorId, onBack, onUpdate = () => {}) {
    const player = state.$actors[state.$playerId];
    const target = state.$actors[targetActorId];

    if (!target) {
      containerEl.innerHTML = `<p>Character not found. <button class="lineage-btn" id="btn-back">Back</button></p>`;
      containerEl.querySelector('#btn-back')?.addEventListener('click', onBack);
      return;
    }

    if (!player.relationships) player.relationships = {};
    if (!player.relationships[target.id]) {
      player.relationships[target.id] = clampRelationship({});
    }
    if (!target.relationships) target.relationships = {};
    if (!target.relationships[player.id]) {
      target.relationships[player.id] = clampRelationship({});
    }

    const age = getActorAge(target, state.$world.year);
    const playerAge = getActorAge(player, state.$world.year);
    const romanceAllowed = player.isAlive && target.isAlive && playerAge >= (state.$world.config?.ROMANCE_MIN_AGE ?? 16) && age >= (state.$world.config?.ROMANCE_MIN_AGE ?? 16);
    const compat = calculateCompatibility(player, target, state.$actors, state.$world.config);
    const isChildOrYouth = age < 16;
    const isFemaleMalePair = new Set([player.gender, target.gender]).has('female') && new Set([player.gender, target.gender]).has('male');
    const possibleMother = player.gender === 'female' ? player : target.gender === 'female' ? target : null;
    const existingParentage = player.unions.map(id => state.$unions[id]).find(union => union?.partners.includes(target.id));
    const conceptionChance = state.$world.config?.CONCEPTION_CHANCE ?? 0.45;
    const conceptionMaxAge = state.$world.config?.CONCEPTION_MAX_AGE ?? 44;
    const conceptionIsEligible = isFemaleMalePair && romanceAllowed && possibleMother &&
      getActorAge(possibleMother, state.$world.year) <= conceptionMaxAge &&
      !possibleMother.isPregnant && (existingParentage?.children?.length || 0) < 5;
    const conceptionUnavailableReason = !isFemaleMalePair
      ? 'Conception requires one female and one male character.'
      : !romanceAllowed
        ? `Both characters must be alive and at least ${state.$world.config?.ROMANCE_MIN_AGE ?? 16}.`
        : possibleMother?.isPregnant
          ? 'The eligible female character is already pregnant.'
          : possibleMother && getActorAge(possibleMother, state.$world.year) > conceptionMaxAge
            ? `The eligible female character is over the conception age limit of ${conceptionMaxAge}.`
            : (existingParentage?.children?.length || 0) >= 5
              ? 'This pair already has the maximum of five children.'
              : '';
    const conceptionChanceText = conceptionIsEligible
      ? `${Math.round(conceptionChance * 100)}% if the approach is reciprocated`
      : isFemaleMalePair
        ? `0% currently — conception requires an eligible, non-pregnant female aged ${state.$world.config?.ROMANCE_MIN_AGE ?? 16}–${conceptionMaxAge}`
        : '0% for this pairing — conception requires one female and one male character';
    const greeting = getDialogueGreeting(target, player, state.$actors, state.$houses, state.$world.config, state.$world.flags);
    let selectedIntimacyApproach = 'sincere';

      const render = () => {
      const curRelP = clampRelationship(player.relationships[target.id]);
      const reciprocalRelation = clampRelationship(target.relationships[player.id]);
      const tStats = clampStats(target.stats);
      const actedList = state.$world.actedThisSeason?.[target.id] || [];
      const seductionChance = calculateSeductionChance(state, player, target, selectedIntimacyApproach);
      const courtshipChance = calculateCourtshipChance(state, player, target);

      const isSpouse = player.spouseId === target.id;
      const isPregnantOrPartner = target.isPregnant || player.isPregnant;
      const targetIsChild = player.children?.includes(target.id) || target.parents?.includes(player.id);
      const relationshipState = targetIsChild ? 'Child' : isSpouse ? 'Spouse' : curRelP.affinity <= -40 ? 'Enemy' : curRelP.affinity <= 0 ? 'Rival' : curRelP.romance >= 20 ? 'Lover' : curRelP.affinity >= 75 ? 'Trusted Friend' : curRelP.affinity >= 55 ? 'Friend' : 'Acquaintance';

      containerEl.innerHTML = `
        <button class="lineage-btn" id="btn-back" style="margin-bottom:1rem;">&larr; Back to Realm</button>
        <div style="display:flex; gap:2rem; background:var(--bg-card); padding:1.5rem; border-radius:10px; border:1px solid var(--border-subtle); flex-wrap:wrap;">
          <div>
            ${renderPortraitSVG(target, 180, state.$world.year, state.$world.config)}
            <div style="margin-top:1rem; background:#0f172a; padding:0.75rem; border-radius:6px; border:1px solid var(--border-subtle); font-size:0.85rem;">
              <div style="font-weight:bold; color:var(--accent-gold); margin-bottom:0.4rem;">Attributes</div>
              <div>Martial: ${tStats.martial}</div>
              <div>Diplomacy: ${tStats.diplomacy}</div>
              <div>Stewardship: ${tStats.stewardship}</div>
              <div>Intrigue: ${tStats.intrigue}</div>
              <div>Learning: ${tStats.learning}</div>
            </div>
          </div>
          <div style="flex:1; min-width:300px;">
            <h2 style="color:var(--accent-gold-bright); margin-top:0;">${target.name}</h2>
            <p style="color:var(--text-muted);">House ${target.house} | ${target.gender} | Age ${age}</p>
            <p style="color:var(--accent-gold);">Relationship: <strong>${relationshipState}</strong>${target.adoptive ? ' · Adopted into the family' : ''}</p>
            ${target.goals?.length ? `<p style="color:var(--text-muted);">Current aim: ${target.goals.slice().sort((a, b) => (b.priority || 0) - (a.priority || 0))[0].type.replaceAll('_', ' ')}.</p>` : ''}

              <div style="background:#0f172a; padding:1rem; border-radius:8px; border:1px solid var(--border-gold); margin-bottom:1rem; font-style:italic; color:#e2e8f0; font-size:0.95rem; line-height:1.4;">
                ${greeting}
            </div>

            <p><strong>Compatibility Rating:</strong> <span style="color:var(--accent-gold);">${compat}%</span></p>
            <p id="courtship-chance-explanation" style="margin:-0.5rem 0 1rem; color:var(--text-muted); font-size:0.82rem;">Courtship chance uses compatibility, both characters’ affinity and romance, your Diplomacy against their Intrigue, and relevant traits.</p>

            <div style="background:#0f172a; padding:0.75rem; border-radius:6px; margin:1rem 0; border:1px solid var(--border-subtle);">
              <div style="font-weight:bold; color:var(--accent-gold); margin-bottom:0.4rem;">Relationships</div>
              <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.4rem;">Your view of ${target.name}</div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; font-size:0.85rem;">
                <div><strong>Affinity:</strong> ${curRelP.affinity}</div>
                <div><strong>Romance:</strong> ${curRelP.romance}</div>
                <div><strong>Respect:</strong> ${curRelP.respect}</div>
              </div>
              <div style="font-size:0.78rem; color:var(--text-muted); margin:0.55rem 0 0.4rem;">${target.name}’s view of you</div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; font-size:0.85rem;">
                <div><strong>Affinity:</strong> ${reciprocalRelation.affinity}</div>
                <div><strong>Romance:</strong> ${reciprocalRelation.romance}</div>
                <div><strong>Respect:</strong> ${reciprocalRelation.respect}</div>
              </div>
            </div>

            <div style="margin:1rem 0;">
              <strong>Traits:</strong>
              <div class="badge-list" style="justify-content:flex-start; margin-top:0.4rem;">
                ${target.traits.map(t => `<span class="badge">${t}</span>`).join('')}
              </div>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center; margin:1rem 0;">
              <label for="intimacy-approach" style="font-weight:bold;">Approach:</label>
              <select id="intimacy-approach" style="padding:0.45rem; background:#0f172a; color:#fff; border:1px solid var(--border-subtle); border-radius:6px;">
                <option value="sincere" ${selectedIntimacyApproach === 'sincere' ? 'selected' : ''}>Sincere (Diplomacy)</option>
                <option value="playful" ${selectedIntimacyApproach === 'playful' ? 'selected' : ''}>Playful (Compatibility)</option>
                <option value="bold" ${selectedIntimacyApproach === 'bold' ? 'selected' : ''}>Bold (Intrigue)</option>
              </select>
              <span id="intimacy-success-chance" style="color:var(--text-muted); font-size:0.85rem;">Reciprocation chance: <strong>${seductionChance}%</strong></span>
            </div>

            <div id="interaction-feedback" role="status" aria-live="polite" style="margin:1rem 0; color:var(--accent-gold); min-height:1.5rem; font-weight:bold;"></div>

            <div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-top:1.5rem;">
              <button class="lineage-btn" id="act-converse" ${actedList.includes('converse') ? 'disabled title="You have already conversed with this character this season."' : ''}>Converse (${player.traits?.includes('Silver-Tongued') && !actedList.includes('converse') ? 'Free' : '1 AP'})</button>
              <button class="lineage-btn" id="act-flirt" ${(actedList.includes('flirt') || !romanceAllowed) ? `disabled title="${!romanceAllowed ? 'Both characters must be alive and meet the minimum romance age.' : 'You have already courted this character this season.'}"` : ''}>Court / Romance (${courtshipChance}%, 1 AP)</button>
              <button class="lineage-btn" id="act-intimacy" ${(actedList.includes('intimacy') || !romanceAllowed) ? `disabled title="${!romanceAllowed ? 'Both characters must be alive and meet the minimum romance age.' : 'You have already attempted intimacy with this character this season.'}"` : ''} title="Does not require an existing relationship. Success depends on the selected approach and both characters.">Attempt Seduction (${seductionChance}%, 1 AP)</button>
              <button class="lineage-btn" id="act-spar" ${actedList.includes('spar') ? 'disabled title="You have already sparred with this character this season."' : ''}>Spar (1 AP)</button>
              ${isChildOrYouth ? `<button class="lineage-btn" id="act-mentor" ${actedList.includes('mentor') ? 'disabled title="You have already mentored this character this season."' : ''}>Mentor Child (1 AP)</button>` : ''}
              ${(!player.spouseId && !target.spouseId && romanceAllowed) ? `<button class="lineage-btn lineage-btn-primary" id="act-propose">Propose Union (No AP)</button>` : ''}
              ${isSpouse ? `
                <button class="lineage-btn lineage-btn-primary" id="act-offspring" ${(isPregnantOrPartner || !conceptionIsEligible || actedList.includes('offspring')) ? `disabled title="${actedList.includes('offspring') ? 'You have already attempted conception this season.' : conceptionUnavailableReason}"` : ''}>
                  ${isPregnantOrPartner ? `Pregnant (Due in ${Math.max(1, (target.pregnancy?.dueTick || player.pregnancy?.dueTick || state.$world.tickCount + 3) - state.$world.tickCount)} seasons)` : !conceptionIsEligible ? 'Conception unavailable' : actedList.includes('offspring') ? 'Attempted this season' : 'Try for Child (1 AP)'}
                </button>
                <button class="lineage-btn" id="act-adopt" ${actedList.includes('adopt') ? 'disabled title="You have already attempted adoption this season."' : ''}>Adopt a Child (1 AP)</button>
              ` : ''}
            </div>
            <p id="intimacy-conception-chance" style="margin:0.5rem 0; color:var(--text-muted); font-size:0.85rem;">Conception chance: <strong>${conceptionChanceText}</strong>. The roll uses the world’s seeded random stream.${isSpouse && !conceptionIsEligible ? ` ${conceptionUnavailableReason}` : ''}</p>
          </div>
        </div>
      `;

      containerEl.querySelector('#btn-back')?.addEventListener('click', onBack);
      containerEl.querySelector('#intimacy-approach')?.addEventListener('change', event => {
        selectedIntimacyApproach = event.target.value;
        const chance = calculateSeductionChance(state, player, target, selectedIntimacyApproach);
        const chanceLabel = containerEl.querySelector('#intimacy-success-chance');
        if (chanceLabel) chanceLabel.innerHTML = `Reciprocation chance: <strong>${chance}%</strong>`;
      });

      const trackAction = (actType, cost = 1) => {
        state.$world.ap -= cost;
        if (!state.$world.actedThisSeason[target.id]) {
          state.$world.actedThisSeason[target.id] = [];
        }
        state.$world.actedThisSeason[target.id].push(actType);
      };

      const refreshAfterAction = () => {
        render();
        onUpdate();
      };
      const remember = (type, context, weight = 1, targetContext = null) => {
        const memory = { type, context, actorIds: [player.id, target.id], location: state.$world.location, weight };
        addMemory(state, player.id, memory);
        target.tier = target.tier === 'background' ? 'important' : target.tier;
        if (target.id === player.spouseId || target.children?.includes(player.id) || player.children?.includes(target.id)) target.tier = 'player-connected';
        addMemory(state, target.id, { ...memory, context: targetContext || context.replace(player.name, 'you') });
        player.relationshipHistory ||= {};
        player.relationshipHistory[target.id] ||= [];
        player.relationshipHistory[target.id].push({ year: state.$world.year, season: state.$world.season, type, location: state.$world.location, context });
      };

      containerEl.querySelector('#act-converse')?.addEventListener('click', () => {
        const freeConverse = player.traits?.includes('Silver-Tongued') && !actedList.includes('converse');
        if (state.$world.ap <= 0 && !freeConverse) {
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = 'Out of Action Points (AP)! Advance Season / Rest to recover.';
          return;
        }
        trackAction('converse', freeConverse ? 0 : 1);
        const affinityGain = Math.max(1, 10 - (player.traits?.includes('Melancholic') ? 2 : 0));
        curRelP.affinity += affinityGain;
        curRelP.respect += 5;
        player.relationships[target.id] = clampRelationship(curRelP);
        const otherRel = clampRelationship(target.relationships[player.id]); otherRel.affinity += affinityGain; otherRel.respect += 5; target.relationships[player.id] = clampRelationship(otherRel);
        remember('conversation', `You spoke with ${target.name}.`, 1, `${player.name} spoke with you.`);
        refreshAfterAction();
        const fb = containerEl.querySelector('#interaction-feedback');
        if (fb) fb.innerText = `You had an engaging conversation with ${target.name}. (Both gained Affinity +${affinityGain} and Respect +5)`;
      });

      containerEl.querySelector('#act-flirt')?.addEventListener('click', () => {
        if (state.$world.ap <= 0) {
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = 'Out of Action Points (AP)! Advance Season / Rest to recover.';
          return;
        }
        trackAction('flirt');
        if (getActorAge(player, state.$world.year) < (state.$world.config?.ROMANCE_MIN_AGE ?? 16) || age < (state.$world.config?.ROMANCE_MIN_AGE ?? 16)) return;
        const chance = calculateCourtshipChance(state, player, target);
        const reciprocated = nextRandom(state) * 100 < chance;
        const targetRelation = clampRelationship(target.relationships[player.id]);
        if (reciprocated) {
          curRelP.romance += 12;
          curRelP.affinity += 5;
          player.relationships[target.id] = clampRelationship(curRelP);
          targetRelation.romance += 12;
          targetRelation.affinity += 5;
          target.relationships[player.id] = clampRelationship(targetRelation);
          remember('courtship', `You courted ${target.name}, and they returned your interest.`, 2, `${player.name} courted you, and you returned their interest.`);
          refreshAfterAction();
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `${target.name} returned your interest. (Chance: ${chance}%; both gained Romance +12 and Affinity +5)`;
        } else {
          curRelP.affinity -= 4;
          player.relationships[target.id] = clampRelationship(curRelP);
          targetRelation.affinity -= 2;
          target.relationships[player.id] = clampRelationship(targetRelation);
          remember('rejection', `${target.name} declined your courtship.`, 2, `You declined ${player.name}'s courtship.`);
          refreshAfterAction();
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `${target.name} declined your courtship. (Chance: ${chance}%; your Affinity -4, theirs -2)`;
        }
      });

      containerEl.querySelector('#act-intimacy')?.addEventListener('click', () => {
        if (state.$world.ap <= 0) {
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = 'Out of Action Points (AP)! Advance Season / Rest to recover.';
          return;
        }
        if (actedList.includes('intimacy') || !romanceAllowed) return;
        const approach = containerEl.querySelector('#intimacy-approach')?.value || selectedIntimacyApproach;
        const chance = calculateSeductionChance(state, player, target, approach);
        trackAction('intimacy');
        if (nextRandom(state) * 100 >= chance) {
          curRelP.affinity -= 4;
          curRelP.romance -= 2;
          player.relationships[target.id] = clampRelationship(curRelP);
          const targetRelation = clampRelationship(target.relationships[player.id]);
          targetRelation.affinity -= 2;
          target.relationships[player.id] = clampRelationship(targetRelation);
          const approachLabel = { sincere: 'sincere', playful: 'playful', bold: 'bold' }[approach] || 'sincere';
          remember('rejection', `${target.name} declined your ${approachLabel} invitation.`, 3, `You declined ${player.name}'s ${approachLabel} invitation.`);
          refreshAfterAction();
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `${target.name} declined the ${approachLabel} approach. (Chance: ${chance}%; your Affinity -4, theirs -2)`;
          return;
        }
        curRelP.romance += 10;
        curRelP.affinity += 4;
        player.relationships[target.id] = clampRelationship(curRelP);
        const targetRelation = clampRelationship(target.relationships[player.id]);
        targetRelation.romance += 10;
        targetRelation.affinity += 4;
        target.relationships[player.id] = clampRelationship(targetRelation);
        remember('intimacy', `You shared an intimate moment with ${target.name}.`, 4, `You shared an intimate moment with ${player.name}.`);

        let conceived = false;
        if (isFemaleMalePair) {
          const mother = player.gender === 'female' ? player : target;
          const father = player.gender === 'male' ? player : target;
          const existingUnionId = player.unions.find(id => state.$unions[id]?.partners.includes(target.id));
          conceived = initiatePregnancy(
            state,
            mother.id,
            father.id,
            existingUnionId,
            state.$world.config?.CONCEPTION_CHANCE ?? 0.45,
          );
          if (conceived) remember('conception', `You and ${target.name} are expecting a child.`, 5, `You and ${player.name} are expecting a child.`);
        }

        refreshAfterAction();
        const fb = containerEl.querySelector('#interaction-feedback');
        if (fb) {
          if (conceived) fb.innerText = `You shared an intimate moment with ${target.name}. Both gained Romance +10 and Affinity +4; a child is expected in ${state.$world.config?.GESTATION_SEASONS ?? 3} seasons.`;
          else if (isFemaleMalePair) fb.innerText = `You shared an intimate moment with ${target.name}. Both gained Romance +10 and Affinity +4; no child is expected this time.`;
          else fb.innerText = `You shared an intimate moment with ${target.name}. Both gained Romance +10 and Affinity +4; this pairing cannot result in conception.`;
        }
      });

      containerEl.querySelector('#act-spar')?.addEventListener('click', () => {
        if (state.$world.ap <= 0) {
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = 'Out of Action Points (AP)! Advance Season / Rest to recover.';
          return;
        }
        trackAction('spar');
        remember('spar', `You sparred with ${target.name}.`, 1, `You sparred with ${player.name}.`);
        const variance = state.$world.config?.SPAR_VARIANCE ?? 20;
        const pMar = (player.stats?.martial ?? 50) + (player.traits?.includes('Fierce') ? 5 : 0) + (player.traits?.includes('Short-Tempered') ? 5 : 0) + Math.floor(nextRandom(state) * (variance + 1));
        const tMar = (target.stats?.martial ?? 50) + (target.traits?.includes('Fierce') ? 5 : 0) + (target.traits?.includes('Short-Tempered') ? 5 : 0) + Math.floor(nextRandom(state) * (variance + 1));
        if (pMar > tMar || (pMar === tMar && player.traits?.includes('Fierce'))) {
          curRelP.respect += 10;
          player.relationships[target.id] = clampRelationship(curRelP);
          const targetRelation = clampRelationship(target.relationships[player.id]);
          targetRelation.respect += 10;
          target.relationships[player.id] = clampRelationship(targetRelation);
          refreshAfterAction();
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `You bested ${target.name} in a martial bout. Both gained Respect +10.`;
        } else {
          curRelP.respect += 5;
          player.relationships[target.id] = clampRelationship(curRelP);
          const targetRelation = clampRelationship(target.relationships[player.id]);
          targetRelation.respect += 5;
          target.relationships[player.id] = clampRelationship(targetRelation);
          refreshAfterAction();
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `${target.name} defeated you in the spar. Both gained Respect +5.`;
        }
      });

      containerEl.querySelector('#act-mentor')?.addEventListener('click', () => {
        if (state.$world.ap <= 0) {
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = 'Out of Action Points (AP)! Advance Season / Rest to recover.';
          return;
        }
        trackAction('mentor');
        const gains = state.$world.config?.MENTOR_GAINS || [3, 2, 1];
        const gainFor = value => value < 40 ? gains[0] : value < 70 ? gains[1] : gains[2];
        target.stats = clampStats({
          martial: (target.stats?.martial ?? 50) + gainFor(target.stats?.martial ?? 50),
          diplomacy: (target.stats?.diplomacy ?? 50) + gainFor(target.stats?.diplomacy ?? 50),
          stewardship: (target.stats?.stewardship ?? 50) + gainFor(target.stats?.stewardship ?? 50),
          intrigue: (target.stats?.intrigue ?? 50) + gainFor(target.stats?.intrigue ?? 50),
          learning: (target.stats?.learning ?? 50) + gainFor(target.stats?.learning ?? 50),
        });
        curRelP.affinity += 10;
        player.relationships[target.id] = clampRelationship(curRelP);
        const targetRelation = clampRelationship(target.relationships[player.id]);
        targetRelation.affinity += 10;
        target.relationships[player.id] = clampRelationship(targetRelation);
        remember('mentored', `You mentored ${target.name}.`, 3, `${player.name} mentored you.`);
        refreshAfterAction();
        const fb = containerEl.querySelector('#interaction-feedback');
        if (fb) fb.innerText = `You mentored ${target.name}. Their skills improved and both gained Affinity +10.`;
      });

      containerEl.querySelector('#act-propose')?.addEventListener('click', () => {
        const relationshipReady = curRelP.affinity >= 20 || curRelP.romance >= 20;
        const compatibilityReady = compat >= (state.$world.config?.COMPAT_MIN ?? 50) || (curRelP.affinity >= 60 && curRelP.romance >= 40);
        if (getActorAge(player, state.$world.year) >= (state.$world.config?.ROMANCE_MIN_AGE ?? 16) && age >= (state.$world.config?.ROMANCE_MIN_AGE ?? 16) && compatibilityReady && relationshipReady) {
          formUnion(state, player.id, target.id);
          remember('marriage', `You married ${target.name}.`, 5, `You married ${player.name}.`);
          refreshAfterAction();
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `Proposal accepted! ${target.name} is now your spouse. The union and its house standing are recorded in your chronicle.`;
        } else {
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `The proposal was not accepted, and no AP was spent. Requires Affinity ≥20 or Romance ≥20, plus Compatibility ≥${state.$world.config?.COMPAT_MIN ?? 50} (or Affinity ≥60 and Romance ≥40). Current: Affinity ${curRelP.affinity}, Romance ${curRelP.romance}, Compatibility ${compat}%.`;
        }
      });

      containerEl.querySelector('#act-offspring')?.addEventListener('click', () => {
        if (state.$world.ap <= 0) {
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = 'Out of Action Points (AP)! Advance Season / Rest to recover.';
          return;
        }
        if (actedList.includes('offspring')) {
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = 'You have already attempted conception with this character this season.';
          return;
        }
        if (!conceptionIsEligible) {
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `${conceptionUnavailableReason} No Action Point was spent.`;
          return;
        }
        trackAction('offspring');

        const motherId = player.gender === 'female' ? player.id : target.id;
        const fatherId = player.gender === 'female' ? target.id : player.id;
        const uId = player.unions.find(id => state.$unions[id]?.active && state.$unions[id].partners.includes(target.id));

        const ok = initiatePregnancy(state, motherId, fatherId, uId, state.$world.config?.CONCEPTION_CHANCE ?? 0.45);
        if (ok) {
          remember('conception', `You and ${target.name} are expecting a child.`, 5, `You and ${player.name} are expecting a child.`);
          refreshAfterAction();
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `Conception successful! A child is expected in 3 seasons.`;
        } else {
          refreshAfterAction();
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `No conception this time. The attempt had a ${Math.round((state.$world.config?.CONCEPTION_CHANCE ?? 0.45) * 100)}% chance; 1 AP was spent.`;
        }
      });
      containerEl.querySelector('#act-adopt')?.addEventListener('click', () => {
        if (state.$world.ap <= 0 || actedList.includes('adopt')) {
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = state.$world.ap <= 0
            ? 'Out of Action Points (AP)! Advance Season / Rest to recover.'
            : 'You have already attempted adoption with this character this season.';
          return;
        }
        trackAction('adopt');
        const unionId = player.unions.find(id => state.$unions[id]?.active && state.$unions[id].partners.includes(target.id));
        const child = adoptChild(state, unionId);
        if (child) LineageEngine.openChildbirthModal(state, child, refreshAfterAction);
        else {
          refreshAfterAction();
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = 'Adoption could not be completed. The Action Point was spent.';
        }
      });
    };

    render();
  },

  renderFamilyTreeVR: function (containerEl, state, onSelectActor) {
    const layout = computeFamilyTreeLayout(state, state.$playerId);
    const dynastyActorIds = new Set(layout.nodes.filter(node => node.type === 'actor').map(node => node.actorId));
    let selectedNodeId = state.$playerId;
    let zoomLevel = 1.0;
    let panX = 0;
    let panY = 0;
    let showExtendedFamily = false;
    let initialFitPending = true;
    let isDragging = false;
    let startX = 0, startY = 0;

    const fitTreeToView = () => {
      const viewport = containerEl.querySelector('#tree-viewport');
      const content = containerEl.querySelector('#tree-content-container');
      if (!viewport || !content) return false;
      const width = Math.max(320, viewport.clientWidth || containerEl.clientWidth || 960);
      const height = Math.max(320, viewport.clientHeight || 650);
      zoomLevel = Math.max(0.3, Math.min((width - 48) / layout.bounds.width, (height - 48) / layout.bounds.height, 1));
      panX = (width - layout.bounds.width * zoomLevel) / 2;
      panY = (height - layout.bounds.height * zoomLevel) / 2;
      content.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
      return true;
    };

    const zoomAroundCenter = nextZoom => {
      const viewport = containerEl.querySelector('#tree-viewport');
      if (!viewport) return;
      const width = viewport.clientWidth || 960;
      const height = viewport.clientHeight || 650;
      const centerX = (width / 2 - panX) / zoomLevel;
      const centerY = (height / 2 - panY) / zoomLevel;
      zoomLevel = nextZoom;
      panX = width / 2 - centerX * zoomLevel;
      panY = height / 2 - centerY * zoomLevel;
    };

    const renderTreeContent = () => {
      const lineage = getLineageSets(state, selectedNodeId);
      const selectedActor = state.$actors[selectedNodeId];
      const extendedKinById = new Map();
      for (const union of Object.values(state.$unions || {})) {
        if (!union.active || !union.partners?.some(id => dynastyActorIds.has(id))) continue;
        for (const partnerId of union.partners.filter(id => dynastyActorIds.has(id))) {
          const partner = state.$actors[partnerId];
          for (const parentId of partner?.parents || []) {
            if (dynastyActorIds.has(parentId)) continue;
            const parent = state.$actors[parentId];
            if (!parent) continue;
            const existing = extendedKinById.get(parentId) || { actor: parent, connectedThrough: new Set() };
            existing.connectedThrough.add(partner.name);
            extendedKinById.set(parentId, existing);
          }
        }
      }
      const extendedKin = [...extendedKinById.values()];

      const nodesHtml = layout.nodes.map(node => {
        if (node.type === 'actor') {
          const actor = state.$actors[node.actorId];
          if (!actor) return '';

          const isAncestor = lineage.ancestors.has(actor.id);
          const isDescendant = lineage.descendants.has(actor.id);
          const isSelected = selectedNodeId === actor.id;
          const isDimmed = selectedNodeId && !isAncestor && !isDescendant && !isSelected;

          let highlightClass = '';
          if (isSelected) highlightClass = 'highlight-path';
          else if (isAncestor) highlightClass = 'highlight-ancestor';
          else if (isDescendant) highlightClass = 'highlight-descendant';

          return `
            <div class="tree-node-card ${highlightClass} ${isDimmed ? 'dimmed' : ''}"
                 style="left:${node.x}px; top:${node.y}px;"
                 data-actor-id="${actor.id}">
              ${renderPortraitSVG(actor, 65, state.$world.year, state.$world.config)}
              <div style="font-weight:bold; font-size:0.75rem; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%;">${actor.name}</div>
              <div style="font-size:0.65rem; color:var(--text-muted);">${actor.isAlive ? `Age ${getActorAge(actor, state.$world.year)}` : 'Deceased'}</div>
              ${actor.adoptive ? '<div style="font-size:0.6rem; color:#c4b5fd;">Adopted</div>' : ''}
            </div>
          `;
        } else if (node.type === 'union') {
          const union = state.$unions[node.unionId];
          const isParentage = union?.type === 'parentage';
          return `
            <div class="tree-node-union-junction" title="${isParentage ? 'Co-parent relationship' : 'Union'}" style="left:${node.x}px; top:${node.y}px;">${isParentage ? '&amp;' : '&infin;'}</div>
          `;
        }
      }).join('');

      const svgPathsHtml = layout.connections.map(conn => {
        const isFromHighlight = lineage.ancestors.has(conn.fromId) || lineage.descendants.has(conn.fromId);
        const isToHighlight = lineage.ancestors.has(conn.toId) || lineage.descendants.has(conn.toId);
        const isHighlighted = isFromHighlight && isToHighlight;

        const adopted = conn.type === 'union-child' && state.$actors[conn.toId]?.adoptive;
        return `<path class="tree-connector-path ${isHighlighted ? 'highlight-path' : 'dimmed-path'}" ${adopted ? 'stroke-dasharray="7 5"' : ''} d="${conn.pathD}"/>`;
      }).join('');

      const extendedFamilyHtml = showExtendedFamily ? `
        <section style="margin-top:1rem; padding:1rem; background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:8px;">
          <h3 style="margin:0 0 0.75rem; color:var(--accent-gold);">Extended Family</h3>
          <p style="margin:0 0 0.75rem; color:var(--text-muted); font-size:0.85rem;">Parents of spouses and partners who married into the dynasty.</p>
          ${extendedKin.length ? `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:0.6rem;">${extendedKin.map(({ actor, connectedThrough }) => `
            <button class="lineage-btn extended-kin-card" data-actor-id="${actor.id}" style="display:flex; align-items:center; gap:0.6rem; text-align:left; border-color:${selectedNodeId === actor.id ? 'var(--accent-gold)' : 'var(--border-subtle)'};">
              ${renderPortraitSVG(actor, 48, state.$world.year, state.$world.config)}
              <span><strong>${actor.name}</strong><br><small style="color:var(--text-muted);">House ${actor.house} · Parent of ${[...connectedThrough].join(', ')}</small></span>
            </button>`).join('')}</div>` : '<p style="margin:0; color:var(--text-muted);">No in-law parents are recorded yet.</p>'}
        </section>
      ` : '';

      let inspectorHtml = '';
      if (selectedActor) {
        const age = getActorAge(selectedActor, state.$world.year);
        const stage = getLifeStage(age, state.$world.config);
        const gen = selectedActor.genetics || {};
        const stats = clampStats(selectedActor.stats);
        const canInteract = selectedActor.isAlive && selectedActor.id !== state.$playerId;
        const activePlayer = state.$actors[state.$playerId];
        const sharedRelationship = selectedActor.relationships?.[activePlayer?.id] || activePlayer?.relationships?.[selectedActor.id];
        const parentNames = (selectedActor.parents || []).map(id => state.$actors[id]?.name).filter(Boolean);
        const childNames = (selectedActor.children || []).map(id => state.$actors[id]?.name).filter(Boolean);
        const unionNames = (selectedActor.unions || []).map(id => state.$unions[id]).filter(union => union?.active || union?.type === 'parentage').map(union => {
          const partnerNames = union.partners.filter(id => id !== selectedActor.id).map(id => state.$actors[id]?.name).filter(Boolean).join(' & ');
          return partnerNames && union.type === 'parentage' ? `Co-parent: ${partnerNames}` : partnerNames;
        }).filter(Boolean);
        const adoptionNotes = [];
        if (selectedActor.adoptive) adoptionNotes.push(`${selectedActor.name} was adopted into the family.`);
        if (activePlayer?.id !== selectedActor.id && activePlayer?.adoptive) adoptionNotes.push(`${activePlayer.name}, the current heir, was adopted into the family.`);
        const sharedHistory = selectedActor.relationshipHistory?.[activePlayer?.id] || activePlayer?.relationshipHistory?.[selectedActor.id] || [];
        const firstContact = sharedHistory.find(item => ['conversation', 'courtship', 'mentored', 'spar'].includes(item.type));
        const sharedChronicle = (state.$chronicle || []).filter(entry => entry.actorIds?.includes(selectedActor.id) && entry.actorIds?.includes(activePlayer?.id)).slice(-4).reverse();
        const memoryHistory = (selectedActor.memories || []).filter(memory => memory.actorIds?.includes(activePlayer?.id)).slice(-4).reverse();

        inspectorHtml = `
          <div style="margin-top:1.5rem; background:var(--bg-card); padding:1.25rem; border-radius:10px; border:1px solid var(--border-gold); display:flex; gap:1.5rem; align-items:center;">
            <div>
              ${renderPortraitSVG(selectedActor, 120, state.$world.year, state.$world.config)}
            </div>
            <div style="flex:1;">
              <h3 style="color:var(--accent-gold-bright); margin:0 0 0.25rem 0;">${selectedActor.name}</h3>
              <p style="color:var(--text-muted); margin:0 0 0.5rem 0; font-size:0.9rem;">House ${selectedActor.house} | ${stage} (${age}) | ${selectedActor.isAlive ? 'Living' : 'Deceased'}</p>

              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:0.5rem; font-size:0.8rem; background:#0f172a; padding:0.6rem; border-radius:6px; border:1px solid var(--border-subtle); margin-bottom:0.75rem;">
                <div><strong>Martial:</strong> ${stats.martial}</div>
                <div><strong>Diplomacy:</strong> ${stats.diplomacy}</div>
                <div><strong>Stewardship:</strong> ${stats.stewardship}</div>
                <div><strong>Intrigue:</strong> ${stats.intrigue}</div>
                <div><strong>Learning:</strong> ${stats.learning}</div>
                <div><strong>Skin/Hair/Eye:</strong> ${gen.skinTone ?? 50}/${gen.hairColor ?? 50}/${gen.eyeColor ?? 50}</div>
              </div>

              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:0.5rem; font-size:0.8rem; background:#0f172a; padding:0.6rem; border-radius:6px; border:1px solid var(--border-subtle); margin-bottom:0.75rem;">
                <div><strong>Parents:</strong> ${parentNames.join(', ') || 'Unknown'}</div>
                <div><strong>Children:</strong> ${childNames.join(', ') || 'None recorded'}</div>
                <div><strong>Partners:</strong> ${unionNames.join(', ') || 'None recorded'}</div>
                ${sharedRelationship ? `<div><strong>With current heir:</strong> Affinity ${sharedRelationship.affinity ?? 50}, Romance ${sharedRelationship.romance ?? 0}, Respect ${sharedRelationship.respect ?? 0}</div>` : ''}
                ${adoptionNotes.length ? `<div style="color:#c4b5fd;"><strong>Adoption:</strong> ${adoptionNotes.join(' ')} Dashed tree links mark adoptive parentage.</div>` : ''}
              </div>

              <div class="badge-list" style="justify-content:flex-start;">
                ${selectedActor.traits.map(t => `<span class="badge">${t}</span>`).join('')}
              </div>
                <div style="margin-top:0.75rem; padding:0.7rem; background:#0f172a; border-radius:6px; font-size:0.8rem;">
                  <strong style="color:var(--accent-gold);">How they connect to your history</strong>
                <div style="margin-top:0.35rem;">${firstContact ? `First recorded connection: ${firstContact.season}, Year ${firstContact.year} at ${LOCATIONS[firstContact.location]?.name || firstContact.location}. ${firstContact.context}` : 'No personal encounter has been recorded yet.'}</div>
                ${sharedChronicle.length ? `<div style="margin-top:0.35rem;">Shared events: ${sharedChronicle.map(entry => `${entry.season}, Year ${entry.year}: ${entry.description}`).join(' | ')}</div>` : ''}
                ${memoryHistory.length ? `<div style="margin-top:0.35rem;">Memories: ${memoryHistory.map(memory => `${memory.season}, Year ${memory.year}: ${memory.context}`).join(' | ')}</div>` : ''}
                ${selectedActor.goals?.length ? `<div style="margin-top:0.35rem;">Current aims: ${selectedActor.goals.map(goal => `${goal.type.replaceAll('_', ' ')}${goal.complete ? ' (fulfilled)' : ''}`).join(', ')}</div>` : ''}
              </div>
            </div>
            ${canInteract ? `
              <div>
                <button class="lineage-btn lineage-btn-primary" id="btn-tree-interact">Interact / Visit</button>
              </div>
            ` : ''}
          </div>
        `;
      }

      containerEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <div>
            <h2 style="color:var(--accent-gold-bright); margin:0;">Dynasty Family Tree</h2>
            <span style="color:var(--text-muted); font-size:0.85rem;">Click a character to highlight family paths. Dashed connectors mark adoption.</span>
          </div>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <button class="lineage-btn ${showExtendedFamily ? 'lineage-btn-primary' : ''}" id="btn-extended-family">${showExtendedFamily ? 'Hide Extended Family' : 'Show Extended Family'}</button>
            <button class="lineage-btn" id="btn-zoom-in">+</button>
            <button class="lineage-btn" id="btn-zoom-out">-</button>
            <button class="lineage-btn" id="btn-zoom-reset">Reset / Center</button>
          </div>
        </div>

        <div class="family-tree-viewport" id="tree-viewport" style="overflow:hidden; cursor:grab; position:relative;">
          <div id="tree-content-container" style="transform: translate(${panX}px, ${panY}px) scale(${zoomLevel}); transform-origin: 0 0; position:relative; width:${layout.bounds.width}px; height:${layout.bounds.height}px;">
            <svg class="family-tree-svg-canvas" width="${layout.bounds.width}" height="${layout.bounds.height}">
              ${svgPathsHtml}
            </svg>
            ${nodesHtml}
          </div>
        </div>

        ${extendedFamilyHtml}
        ${inspectorHtml}
      `;

      const viewportEl = containerEl.querySelector('#tree-viewport');
      if (initialFitPending && fitTreeToView()) initialFitPending = false;

      containerEl.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
        zoomAroundCenter(Math.min(zoomLevel + 0.15, 2.0));
        renderTreeContent();
      });

      containerEl.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
        zoomAroundCenter(Math.max(zoomLevel - 0.15, 0.3));
        renderTreeContent();
      });

      containerEl.querySelector('#btn-zoom-reset')?.addEventListener('click', () => {
        fitTreeToView();
        renderTreeContent();
      });

      containerEl.querySelector('#btn-extended-family')?.addEventListener('click', () => {
        showExtendedFamily = !showExtendedFamily;
        renderTreeContent();
      });

      containerEl.querySelectorAll('.extended-kin-card').forEach(card => {
        card.addEventListener('click', () => {
          selectedNodeId = card.getAttribute('data-actor-id');
          renderTreeContent();
        });
      });

      if (viewportEl) {
        viewportEl.addEventListener('mousedown', (e) => {
          if (e.target.closest('.tree-node-card')) return;
          isDragging = true;
          startX = e.clientX - panX;
          startY = e.clientY - panY;
          viewportEl.style.cursor = 'grabbing';
        });

        viewportEl.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          panX = e.clientX - startX;
          panY = e.clientY - startY;
          const content = containerEl.querySelector('#tree-content-container');
          if (content) {
            content.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
          }
        });

        viewportEl.addEventListener('mouseup', () => {
          isDragging = false;
          if (viewportEl) viewportEl.style.cursor = 'grab';
        });

        viewportEl.addEventListener('mouseleave', () => {
          isDragging = false;
          if (viewportEl) viewportEl.style.cursor = 'grab';
        });
      }

      containerEl.querySelectorAll('.tree-node-card').forEach(card => {
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = card.getAttribute('data-actor-id');
          selectedNodeId = id;
          renderTreeContent();
        });
      });

      containerEl.querySelector('#btn-tree-interact')?.addEventListener('click', () => {
        if (selectedNodeId && onSelectActor) {
          onSelectActor(selectedNodeId);
        }
      });
    };

    renderTreeContent();
  },

  renderChronicleView: function (containerEl, state) {
    const entries = state.$chronicle || [];

    containerEl.innerHTML = `
      <h2 style="color:var(--accent-gold-bright); margin-top:0;">Dynasty Chronicle</h2>
      <p style="color:var(--text-muted);">Historical records of births, marriages, successions, and key events.</p>

      <div style="display:flex; flex-direction:column; gap:0.75rem; margin-top:1.5rem;">
        ${entries.slice().reverse().map(e => `
          <div style="background:var(--bg-card); padding:1rem; border-radius:8px; border-left:4px solid var(--accent-gold);">
            <div style="font-size:0.8rem; color:var(--text-muted);">${e.season}, Year ${e.year}</div>
            <div style="margin-top:0.25rem; font-size:0.95rem;">${e.description}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderSuccessionView: function (containerEl, state, onContinuation) {
    const deceased = state.$actors[state.$playerId];
    const heirs = getEligibleHeirs(state, state.$playerId);

    if (heirs.length === 0) {
      containerEl.innerHTML = `
        <div style="text-align:center; padding:3rem 1rem;">
          <h1 style="color:#ef4444; font-size:2.5rem;">DYNASTY EXTINGUISHED</h1>
          <p style="color:var(--text-muted); font-size:1.1rem; max-width:500px; margin:1rem auto;">
            Lord ${deceased ? deceased.name : ''} has died without leaving any living bloodline heirs. House ${deceased ? deceased.house : ''} fades into legend.
          </p>
          <button class="lineage-btn lineage-btn-primary" id="btn-restart" style="margin-top:1.5rem;">Start New Dynasty</button>
        </div>
      `;

      containerEl.querySelector('#btn-restart')?.addEventListener('click', () => {
        onContinuation('restart');
      });
      return;
    }

    containerEl.innerHTML = `
      <div style="text-align:center; margin-bottom:2rem;">
        <h1 style="color:var(--accent-gold-bright); margin-bottom:0.5rem;">THE RULER HAS FALLEN</h1>
        <p style="color:var(--text-muted);">${deceased ? deceased.name : ''} has passed away. Select an heir to continue the dynasty lineage.</p>
      </div>

      <div class="character-grid">
        ${heirs.map((candidate, idx) => {
          const heirActor = candidate.actor;
          const isPrimary = idx === 0;

          return `
            <div class="character-card" data-heir-id="${heirActor.id}" style="${isPrimary ? 'border-color:var(--accent-gold);' : ''}">
              ${isPrimary ? `<span class="badge" style="background:var(--accent-gold); color:#000; font-weight:bold;">PRIMARY HEIR</span>` : ''}
              ${renderPortraitSVG(heirActor, 120, state.$world.year, state.$world.config)}
              <div class="character-card-name">${heirActor.name}</div>
              <div class="character-card-meta">${candidate.relationshipLabel} | Age ${candidate.age}</div>
              <button class="lineage-btn lineage-btn-primary" style="margin-top:1rem; width:100%;">Ascend as Head</button>
            </div>
          `;
        }).join('')}
      </div>
    `;

    containerEl.querySelectorAll('.character-card').forEach(card => {
      card.addEventListener('click', () => {
        const heirId = card.getAttribute('data-heir-id');
        switchPlayerCharacter(state, heirId);
        onContinuation();
      });
    });
  },

  openSaveLoadModal: function (state, onUpdate, { storageWarning = '', onStorageRecovered = () => {} } = {}) {
    const modalSlot = document.getElementById('modal-slot');
    if (!modalSlot) return;

    const slotsKey = 'lineage_save_slots_v2';

    const getSlots = () => {
      try {
        const json = localStorage.getItem(slotsKey);
        return json ? JSON.parse(json) : {};
      } catch (e) {
        return {};
      }
    };

    const getOldestManualSlot = slots => Object.entries(slots)
      .filter(([id, slot]) => /^slot_[1-5]$/.test(id) && slot)
      .sort((a, b) => {
        const savedAt = slot => Number(slot.savedAtMs) || Date.parse(slot.savedAt) || 0;
        return savedAt(a[1]) - savedAt(b[1]);
      })[0]?.[0] || null;
    let saveBannerText = storageWarning;
    let recoveryPrompt = storageWarning
      ? { targetSlot: 'slot_auto', oldestSlotId: getOldestManualSlot(getSlots()) }
      : null;
    let pendingImport = null;

    const saveSlot = (slotId) => {
      const existingSlots = getSlots();
      const slots = { ...existingSlots };
      const player = state.$actors[state.$playerId];
      const world = state.$world;

      slots[slotId] = {
        state: createSaveSnapshot(state),
        savedAt: new Date().toLocaleString(),
        savedAtMs: Date.now(),
        metadata: {
          name: player ? player.name : 'Unknown',
          house: player ? player.house : 'Unknown',
          age: player ? getActorAge(player, world.year) : 0,
          location: LOCATIONS[world.location || 'tavern']?.name || 'Unknown',
          season: world.season,
          year: world.year,
          gold: world.gold,
        }
      };

      try {
        localStorage.setItem(slotsKey, JSON.stringify(slots));
        return { success: true };
      } catch (error) {
        const isQuotaError = error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014;
        return { success: false, isQuotaError, oldestSlotId: isQuotaError ? getOldestManualSlot(existingSlots) : null };
      }
    };

    const loadSlot = (slotId) => {
      const slots = getSlots();
      const slot = slots[slotId];
      if (!slot || !slot.state) return null;

      const loadedState = migrateGameState(slot.state);

      let maxActorNum = 0;
      if (loadedState.$actors) {
        Object.keys(loadedState.$actors).forEach(id => {
          const num = parseInt(id.replace('char_', ''), 10);
          if (!isNaN(num) && num > maxActorNum) maxActorNum = num;
        });
      }

      let maxUnionNum = 0;
      if (loadedState.$unions) {
        Object.keys(loadedState.$unions).forEach(id => {
          const num = parseInt(id.replace('union_', ''), 10);
          if (!isNaN(num) && num > maxUnionNum) maxUnionNum = num;
        });
      }

      resetIdCounters(maxActorNum, maxUnionNum);
      return loadedState;
    };

    const exportSlot = slotId => {
      const slot = getSlots()[slotId];
      if (!slot?.state) return;
      const exportData = {
        format: 'lineage-engine-save',
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        sourceSlot: slotId,
        metadata: slot.metadata || {},
        state: slot.state,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const house = String(slot.metadata?.house || 'dynasty').replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
      link.href = url;
      link.download = `lineage-engine-${house}-${slotId}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      saveBannerText = `Exported ${slotId === 'slot_auto' ? 'autosave' : slotId.replace('slot_', 'Slot ')} to a JSON file.`;
      renderModal();
    };

    const parseImportFile = text => {
      if (text.length > 10 * 1024 * 1024) throw new Error('Save files must be smaller than 10 MB.');
      const fileData = JSON.parse(text);
      if (fileData?.format !== 'lineage-engine-save' || fileData.formatVersion !== 1) {
        throw new Error('This is not a supported Lineage Engine save file.');
      }
      const importedState = fileData.state;
      if (!importedState || typeof importedState !== 'object' || !importedState.$world || typeof importedState.$world !== 'object' ||
          !importedState.$actors || typeof importedState.$actors !== 'object' || Array.isArray(importedState.$actors) ||
          typeof importedState.$playerId !== 'string' || !importedState.$actors[importedState.$playerId]) {
        throw new Error('The save is missing a valid world, actor list, or player character.');
      }
      for (const [id, actor] of Object.entries(importedState.$actors)) {
        if (!actor || typeof actor !== 'object' || actor.id !== id || !/^char_[a-z0-9_-]+$/i.test(id)) {
          throw new Error('The save contains an invalid character record.');
        }
      }
      for (const [id, union] of Object.entries(importedState.$unions || {})) {
        if (!union || typeof union !== 'object' || union.id !== id || !/^union_[a-z0-9_-]+$/i.test(id) || !Array.isArray(union.partners)) {
          throw new Error('The save contains an invalid family relationship record.');
        }
      }
      const containsHtmlTag = value => {
        if (typeof value === 'string') return /<\s*\/?\s*[a-z!][^>]*>/i.test(value);
        if (Array.isArray(value)) return value.some(containsHtmlTag);
        if (value && typeof value === 'object') return Object.values(value).some(containsHtmlTag);
        return false;
      };
      if (containsHtmlTag(importedState)) throw new Error('The save contains markup and cannot be imported.');

      const currentActorId = Math.max(0, ...Object.keys(state.$actors || {}).map(id => Number(id.replace('char_', '')) || 0));
      const currentUnionId = Math.max(0, ...Object.keys(state.$unions || {}).map(id => Number(id.replace('union_', '')) || 0));
      let normalizedState;
      try {
        normalizedState = migrateGameState(JSON.parse(JSON.stringify(importedState)));
      } finally {
        resetIdCounters(currentActorId, currentUnionId);
      }
      const player = normalizedState.$actors[normalizedState.$playerId];
      if (!Number.isFinite(normalizedState.$world.year) || !player?.name || !player?.house) {
        throw new Error('The save contains incomplete dynasty data.');
      }
      return {
        state: createSaveSnapshot(normalizedState),
        metadata: {
          name: player.name,
          house: player.house,
          age: getActorAge(player, normalizedState.$world.year),
          location: LOCATIONS[normalizedState.$world.location || 'tavern']?.name || 'Unknown',
          season: normalizedState.$world.season || 'Spring',
          year: normalizedState.$world.year,
          gold: Number(normalizedState.$world.gold) || 0,
        },
      };
    };

    const deleteSlot = (slotId) => {
      const slots = getSlots();
      delete slots[slotId];
      try {
        localStorage.setItem(slotsKey, JSON.stringify(slots));
      } catch (e) {}
    };

    const renderModal = () => {
      const slots = getSlots();
      const slotKeys = ['slot_auto', 'slot_1', 'slot_2', 'slot_3', 'slot_4', 'slot_5'];

      modalSlot.innerHTML = `
        <div class="lineage-modal-overlay">
          <div class="lineage-modal-content" style="max-width:650px;">
            <div class="lineage-modal-header">
              <span>Save & Load Manager</span>
              <button class="lineage-btn" id="btn-close-saveload" style="padding:0.2rem 0.6rem;">&times;</button>
            </div>

            <div style="display:flex; justify-content:flex-end; margin-top:0.75rem;">
              <button class="lineage-btn" id="btn-new-dynasty" style="border-color:#ef4444; color:#fca5a5;">Start New Dynasty</button>
            </div>
            <section id="new-dynasty-confirmation" role="group" aria-label="Confirm new dynasty" hidden style="margin-top:0.75rem; padding:0.8rem; border:1px solid #ef4444; border-radius:8px;">
              <p style="margin:0 0 0.75rem; color:var(--text-muted);">This clears the current autosave and starts founder creation. Manual save slots will be kept.</p>
              <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                <button class="lineage-btn" id="btn-cancel-new-dynasty">Cancel</button>
                <button class="lineage-btn" id="btn-confirm-new-dynasty" style="border-color:#ef4444; color:#fca5a5;">Clear Autosave & Start New</button>
              </div>
            </section>

            <div id="save-banner" style="margin:0.5rem 0; min-height:1.2rem; color:var(--accent-gold); font-weight:bold;"></div>
            <div id="storage-recovery" ${recoveryPrompt ? '' : 'hidden'} role="group" aria-label="Recover browser save space" style="padding:0.8rem; border:1px solid #ef4444; border-radius:8px; color:var(--text-muted);">
              <p style="margin:0 0 0.75rem;">${recoveryPrompt?.oldestSlotId ? `Delete the oldest manual save (${recoveryPrompt.oldestSlotId.replace('slot_', 'Slot ')}) to free space, then retry this save?` : 'No manual save is available to delete. Delete a manual slot to make room, then retry this save.'}</p>
              ${recoveryPrompt?.oldestSlotId ? `<button class="lineage-btn" id="btn-confirm-free-save-space" style="border-color:#ef4444; color:#fca5a5;">Delete Oldest Manual Save & Retry</button>` : ''}
              <button class="lineage-btn" id="btn-cancel-free-save-space">Cancel</button>
            </div>

            <div style="display:flex; flex-direction:column; gap:0.75rem; max-height:400px; overflow-y:auto; margin-top:1rem;">
              ${slotKeys.map(sKey => {
                const sl = slots[sKey];
                const isAuto = sKey === 'slot_auto';
                const label = isAuto ? 'Autosave Slot' : `Manual Slot ${sKey.replace('slot_', '')}`;

                return `
                  <div style="background:#0f172a; padding:0.75rem 1rem; border-radius:8px; border:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                      <div style="font-weight:bold; color:var(--accent-gold);">${label}</div>
                      ${sl ? `
                        <div style="font-size:0.8rem; color:#fff; margin-top:0.2rem;">
                          ${sl.metadata.name} of House ${sl.metadata.house} (Age ${sl.metadata.age})
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">
                          ${sl.metadata.season}, Year ${sl.metadata.year} | ${sl.metadata.location} | ${sl.metadata.gold} Gold
                        </div>
                        <div style="font-size:0.7rem; color:var(--text-muted);">Saved: ${sl.savedAt}</div>
                      ` : `<div style="font-size:0.8rem; color:var(--text-muted);">Empty Slot</div>`}
                    </div>

                    <div style="display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end;">
                      ${!isAuto ? `<button class="lineage-btn btn-save-slot" data-slot="${sKey}">Save</button>` : ''}
                      ${sl ? `<button class="lineage-btn lineage-btn-primary btn-load-slot" data-slot="${sKey}">Load</button>` : ''}
                      ${sl ? `<button class="lineage-btn btn-export-slot" data-slot="${sKey}">Export</button>` : ''}
                      ${(sl && !isAuto) ? `<button class="lineage-btn btn-del-slot" data-slot="${sKey}" style="border-color:#ef4444; color:#ef4444;">Del</button>` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            <section style="margin-top:1rem; padding:0.8rem; border:1px solid var(--border-subtle); border-radius:8px;">
              <h3 style="margin:0 0 0.5rem; color:var(--accent-gold);">Import Save</h3>
              <p style="margin:0 0 0.75rem; color:var(--text-muted); font-size:0.85rem;">Choose a Lineage Engine JSON export and a manual slot. Importing into an occupied slot replaces that slot.</p>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                <input id="input-import-save" type="file" accept=".json,application/json" aria-label="Choose a save file" style="max-width:100%;" />
                <select id="select-import-slot" aria-label="Import destination slot" style="padding:0.5rem; background:#0f172a; color:#fff; border:1px solid var(--border-subtle); border-radius:6px;">
                  ${['slot_1', 'slot_2', 'slot_3', 'slot_4', 'slot_5'].map((slotId, index) => `<option value="${slotId}">Manual Slot ${index + 1}</option>`).join('')}
                </select>
                <button class="lineage-btn" id="btn-import-save" disabled>Import Save</button>
              </div>
              <div id="import-save-status" role="status" aria-live="polite" style="margin-top:0.5rem; min-height:1.1rem; color:var(--text-muted); font-size:0.85rem;"></div>
            </section>
          </div>
        </div>
      `;

      const saveBanner = modalSlot.querySelector('#save-banner');
      if (saveBanner) saveBanner.innerText = saveBannerText;

      modalSlot.querySelector('#btn-cancel-free-save-space')?.addEventListener('click', () => {
        recoveryPrompt = null;
        saveBannerText = 'Save recovery canceled. Existing save slots were kept.';
        renderModal();
      });
      modalSlot.querySelector('#btn-confirm-free-save-space')?.addEventListener('click', () => {
        if (!recoveryPrompt?.oldestSlotId) return;
        const { targetSlot, oldestSlotId } = recoveryPrompt;
        const slots = getSlots();
        delete slots[oldestSlotId];
        try {
          localStorage.setItem(slotsKey, JSON.stringify(slots));
        } catch (error) {
          saveBannerText = 'Could not free browser storage. Existing saves were not changed.';
          recoveryPrompt = null;
          renderModal();
          return;
        }

        const retry = saveSlot(targetSlot);
        if (retry.success) {
          saveBannerText = `${targetSlot === 'slot_auto' ? 'Autosave' : 'Save'} succeeded after deleting ${oldestSlotId.replace('slot_', 'Slot ')}.`;
          recoveryPrompt = null;
          onStorageRecovered();
        } else if (retry.isQuotaError) {
          saveBannerText = `Storage is still full after deleting ${oldestSlotId.replace('slot_', 'Slot ')}.`;
          recoveryPrompt = { targetSlot, oldestSlotId: retry.oldestSlotId };
        } else {
          saveBannerText = 'The save could not be written because browser storage is unavailable.';
          recoveryPrompt = null;
        }
        renderModal();
      });

      modalSlot.querySelector('#btn-close-saveload')?.addEventListener('click', () => {
        modalSlot.innerHTML = '';
      });

      modalSlot.querySelectorAll('.btn-export-slot').forEach(btn => {
        btn.addEventListener('click', () => exportSlot(btn.getAttribute('data-slot')));
      });

      modalSlot.querySelector('#input-import-save')?.addEventListener('change', async event => {
        const file = event.target.files?.[0];
        const status = modalSlot.querySelector('#import-save-status');
        const importButton = modalSlot.querySelector('#btn-import-save');
        pendingImport = null;
        if (importButton) importButton.disabled = true;
        if (!file) return;
        try {
          if (file.size > 10 * 1024 * 1024) throw new Error('Save files must be smaller than 10 MB.');
          pendingImport = parseImportFile(await file.text());
          if (status) status.innerText = `Validated save: ${pendingImport.metadata.name} of House ${pendingImport.metadata.house}, Year ${pendingImport.metadata.year}.`;
          if (importButton) importButton.disabled = false;
        } catch (error) {
          if (status) status.innerText = error instanceof SyntaxError ? 'Could not read this file as valid JSON.' : (error?.message || 'This save file could not be imported.');
        }
      });

      modalSlot.querySelector('#btn-import-save')?.addEventListener('click', () => {
        if (!pendingImport) return;
        const slotId = modalSlot.querySelector('#select-import-slot')?.value;
        if (!/^slot_[1-5]$/.test(slotId || '')) return;
        const slots = getSlots();
        if (slots[slotId] && !window.confirm(`Replace Manual ${slotId.replace('slot_', 'Slot ')} with this imported save?`)) return;
        const importedAt = new Date();
        slots[slotId] = {
          state: pendingImport.state,
          savedAt: importedAt.toLocaleString(),
          savedAtMs: importedAt.getTime(),
          metadata: pendingImport.metadata,
        };
        try {
          localStorage.setItem(slotsKey, JSON.stringify(slots));
          saveBannerText = `Imported ${pendingImport.metadata.name}'s save into ${slotId.replace('slot_', 'Slot ')}.`;
          pendingImport = null;
          recoveryPrompt = null;
          renderModal();
        } catch (error) {
          const status = modalSlot.querySelector('#import-save-status');
          if (status) status.innerText = error?.name === 'QuotaExceededError'
            ? 'Browser storage is full. No existing save was replaced.'
            : 'Could not import the save because browser storage is unavailable.';
        }
      });

      modalSlot.querySelector('#btn-new-dynasty')?.addEventListener('click', () => {
        const confirmation = modalSlot.querySelector('#new-dynasty-confirmation');
        if (confirmation) confirmation.hidden = false;
      });
      modalSlot.querySelector('#btn-cancel-new-dynasty')?.addEventListener('click', () => {
        const confirmation = modalSlot.querySelector('#new-dynasty-confirmation');
        if (confirmation) confirmation.hidden = true;
      });
      modalSlot.querySelector('#btn-confirm-new-dynasty')?.addEventListener('click', () => {
        modalSlot.innerHTML = '';
        onUpdate('new_game');
      });

      modalSlot.querySelectorAll('.btn-save-slot').forEach(btn => {
        btn.addEventListener('click', () => {
          const sKey = btn.getAttribute('data-slot');
          const result = saveSlot(sKey);
          if (result.success) {
            saveBannerText = `Saved successfully to ${sKey.replace('slot_', 'Slot ')}!`;
            recoveryPrompt = null;
            renderModal();
          } else if (result.isQuotaError) {
            saveBannerText = result.oldestSlotId
              ? `Browser storage is full. ${result.oldestSlotId.replace('slot_', 'Slot ')} is the oldest manual save.`
              : 'Browser storage is full, and there are no manual saves available to remove.';
            recoveryPrompt = { targetSlot: sKey, oldestSlotId: result.oldestSlotId };
            renderModal();
          } else {
            saveBannerText = 'Could not save. Browser storage is unavailable.';
            recoveryPrompt = null;
            renderModal();
          }
        });
      });

      modalSlot.querySelectorAll('.btn-load-slot').forEach(btn => {
        btn.addEventListener('click', () => {
          const sKey = btn.getAttribute('data-slot');
          const loaded = loadSlot(sKey);
          if (loaded) {
            modalSlot.innerHTML = '';
            onUpdate(loaded);
          }
        });
      });

      modalSlot.querySelectorAll('.btn-del-slot').forEach(btn => {
        btn.addEventListener('click', () => {
          const sKey = btn.getAttribute('data-slot');
          deleteSlot(sKey);
          renderModal();
        });
      });
    };

    renderModal();
  },

  openChildbirthModal: function (state, child, onClose) {
    const modalSlot = document.getElementById('modal-slot');
    if (!modalSlot) return;

    modalSlot.innerHTML = `
      <div class="lineage-modal-overlay">
        <div class="lineage-modal-content" style="max-width:450px; text-align:center;">
          <h2 style="color:var(--accent-gold-bright); margin-top:0;">${child.adoptive ? 'A Child Joins the Family' : 'A Child is Born!'}</h2>
          ${renderPortraitSVG(child, 140, state.$world.year, state.$world.config)}

          <div style="margin:1rem 0;">
            <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:0.25rem;">Name Your Newborn</label>
            <input type="text" id="input-baby-name" value="${child.name}" style="width:100%; padding:0.5rem; background:#0f172a; border:1px solid var(--border-subtle); color:#fff; border-radius:6px; box-sizing:border-box; text-align:center; font-size:1.1rem;"/>
          </div>

          <div class="badge-list" style="margin-bottom:1.5rem;">
            ${child.traits.map(t => `<span class="badge">${t}</span>`).join('')}
          </div>

          <button class="lineage-btn lineage-btn-primary" id="btn-confirm-baby" style="width:100%;">Welcome to the House</button>
        </div>
      </div>
    `;

    modalSlot.querySelector('#btn-confirm-baby')?.addEventListener('click', () => {
      const newName = modalSlot.querySelector('#input-baby-name')?.value;
      if (newName) child.name = newName;
      modalSlot.innerHTML = '';
      onClose();
    });
  },

  openDebugModal: function (state, onUpdate) {
    const modalSlot = document.getElementById('modal-slot');
    if (!modalSlot) return;

    modalSlot.innerHTML = `
      <div class="lineage-modal-overlay">
        <div class="lineage-modal-content">
          <div class="lineage-modal-header">
            <span>God-Mode Debug Inspector</span>
            <button class="lineage-btn" id="btn-close-debug" style="padding:0.2rem 0.6rem;">&times;</button>
          </div>
          <p style="color:var(--text-muted); font-size:0.85rem;">Instantly trigger state mutations or stress-test dynastic generational growth.</p>

          <div class="debug-actions-grid">
            <button class="lineage-btn" id="dbg-plus-1">+1 Season</button>
            <button class="lineage-btn" id="dbg-plus-20">+5 Years (20 Seasons)</button>
            <button class="lineage-btn" id="dbg-force-offspring">Force Offspring</button>
            <button class="lineage-btn" id="dbg-add-trait">Add Legendary Trait</button>
            <button class="lineage-btn" id="dbg-heal-stats">Max Out Stats</button>
            <button class="lineage-btn lineage-btn-primary" id="dbg-stress-test">Stress Test (4 Gens)</button>
            <button class="lineage-btn lineage-btn-primary" id="dbg-run-seeds">Run 50 Seeds</button>
          </div>
          <div id="seed-diagnostics-status" role="status" aria-live="polite" style="margin-top:0.75rem; color:var(--text-muted);"></div>
          <pre id="seed-diagnostics-output" style="white-space:pre-wrap; color:var(--accent-gold); font-size:0.8rem;"></pre>
        </div>
      </div>
    `;

    const closeModal = () => {
      modalSlot.innerHTML = '';
      onUpdate();
    };

    modalSlot.querySelector('#btn-close-debug')?.addEventListener('click', closeModal);

    modalSlot.querySelector('#dbg-plus-1')?.addEventListener('click', () => {
      advanceSeason(state);
      closeModal();
    });

    modalSlot.querySelector('#dbg-plus-20')?.addEventListener('click', () => {
      for (let i = 0; i < 20; i++) advanceSeason(state);
      closeModal();
    });

    modalSlot.querySelector('#dbg-force-offspring')?.addEventListener('click', () => {
      const player = state.$actors[state.$playerId];
      if (player && player.unions && player.unions.length > 0) {
        produceOffspring(state, player.unions[0]);
      }
      closeModal();
    });

    modalSlot.querySelector('#dbg-add-trait')?.addEventListener('click', () => {
      const player = state.$actors[state.$playerId];
      if (player && !player.traits.includes('Dragon Blood')) {
        player.traits.push('Dragon Blood');
      }
      closeModal();
    });

    modalSlot.querySelector('#dbg-heal-stats')?.addEventListener('click', () => {
      const player = state.$actors[state.$playerId];
      if (player) {
        player.stats = { martial: 100, diplomacy: 100, stewardship: 100, intrigue: 100, learning: 100 };
      }
      closeModal();
    });

    modalSlot.querySelector('#dbg-stress-test')?.addEventListener('click', () => {
      for (let i = 0; i < 120; i++) {
        advanceSeason(state);
      }
      closeModal();
    });

    modalSlot.querySelector('#dbg-run-seeds')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const status = modalSlot.querySelector('#seed-diagnostics-status');
      const output = modalSlot.querySelector('#seed-diagnostics-output');
      button.disabled = true;
      if (output) output.innerText = '';
      if (status) status.innerText = 'Preparing 50 seeded dynasties…';

      try {
        const result = await LineageEngine.runSeededDiagnostics(state, (completed, total) => {
          if (status) status.innerText = `Simulating seed ${completed} of ${total}…`;
        });
        const format = value => Number(value).toFixed(2);
        if (output) output.innerText = [
          `${result.runs} seeds · ${result.seasons / 4} simulated years`,
          `Extinction by horizon: ${format(result.extinctionRate)}%`,
          `Mean dynasty lifespan: ${format(result.averageLifespanYears)} years`,
          `Median dynasty lifespan: ${format(result.medianLifespanYears)} years`,
          `Mean generation reached at extinction: ${result.averageExtinctionGeneration === null ? 'no extinctions observed' : format(result.averageExtinctionGeneration)}`,
          `Mean living lineage: ${format(result.averageFinalLineagePopulation)} at horizon; ${format(result.averageLineagePopulation)} across seasons`,
          `Mean world population change: ${format(result.averageWorldPopulationChange)} people`,
          `Mean important / player-connected NPCs: ${format(result.averageImportantNpcCount)}`,
          `Mean children per union: ${format(result.averageChildrenPerUnion)}`,
          `Mean stored memories: ${format(result.averageMemoryCount)}`,
          `Mean save growth: ${format(result.averageSaveSizeGrowthKb)} KB`,
          `Autonomous relationships with lasting state changes: ${result.meaningfulAutonomousRelationshipRate === null ? 'no autonomous unions observed' : `${format(result.meaningfulAutonomousRelationshipRate)}%`}`,
          `Significant events with persistent traces: ${result.significantEventTraceRate === null ? 'no significant events observed' : `${format(result.significantEventTraceRate)}%`}`,
          'Average gene variance:',
          ...Object.entries(result.averageGeneVariance).map(([gene, value]) => `  ${gene}: ${format(value)}`),
        ].join('\n');
        if (status) status.innerText = 'Diagnostics complete. The active dynasty was not changed.';
      } catch (error) {
        if (status) status.innerText = `Diagnostics failed: ${error.message}`;
      } finally {
        button.disabled = false;
      }
    });
  },

  initStandaloneApp: function () {
    const slotsKey = 'lineage_save_slots_v2';
    let state = null;
    let activeView = 'founder_creation';
    let selectedInteractionActorId = null;
    let worldLocationFeedback = '';
    let questFeedback = '';
    let seasonalModalOpen = false;
    let storageWarning = '';

    const saveAutosave = () => {
      if (!state?.$world || !state?.$actors?.[state.$playerId]) return;
      try {
        const slots = JSON.parse(localStorage.getItem(slotsKey) || '{}');
        const player = state.$actors[state.$playerId];
        slots.slot_auto = {
          state: createSaveSnapshot(state),
          savedAt: new Date().toLocaleString(),
          savedAtMs: Date.now(),
          metadata: {
            name: player.name,
            house: player.house,
            age: getActorAge(player, state.$world.year),
            location: LOCATIONS[state.$world.location || 'tavern']?.name || 'Unknown',
            season: state.$world.season,
            year: state.$world.year,
            gold: state.$world.gold,
          }
        };
        localStorage.setItem(slotsKey, JSON.stringify(slots));
        storageWarning = '';
      } catch (error) {
        storageWarning = error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014
          ? 'Autosave failed because browser storage is full. Open Save / Load Manager to free space.'
          : 'Autosave failed because browser storage is unavailable.';
      }
    };

    try {
      const slots = JSON.parse(localStorage.getItem(slotsKey) || '{}');
      if (slots.slot_auto?.state) {
        state = migrateGameState(slots.slot_auto.state);
        activeView = state.$actors?.[state.$playerId]?.isAlive ? 'world_location' : 'succession';
      }
    } catch (e) {
      // Ignore invalid or unavailable browser storage and start a new game.
    }

    const startNewDynasty = () => {
      try {
        const slots = JSON.parse(localStorage.getItem(slotsKey) || '{}');
        delete slots.slot_auto;
        localStorage.setItem(slotsKey, JSON.stringify(slots));
      } catch (e) {
        // Continue to founder creation even if browser storage is unavailable.
      }
      state = null;
      activeView = 'founder_creation';
      selectedInteractionActorId = null;
      worldLocationFeedback = '';
      questFeedback = '';
      seasonalModalOpen = false;
      renderApp();
    };

    const renderApp = () => {
      saveAutosave();
      const body = document.body;
      let appContainer = document.querySelector('.lineage-app-container');

      if (!appContainer) {
        body.innerHTML = `
          <div class="lineage-app-container">
            <div id="sidebar-slot"></div>
            <div class="lineage-main-viewport" id="viewport-slot"></div>
          </div>
          <div id="modal-slot"></div>
        `;
        appContainer = document.querySelector('.lineage-app-container');
      }

      const sidebarSlot = document.getElementById('sidebar-slot');
      const viewportSlot = document.getElementById('viewport-slot');

      if (activeView === 'founder_creation') {
        sidebarSlot.innerHTML = '';
        LineageEngine.renderFounderCreationView(viewportSlot, (founderParams) => {
          state = createInitialGameState(founderParams.house);
          state = LineageEngine.initGameWorld(state, founderParams);
          activeView = 'world_location';
          renderApp();
        });
        return;
      }

      if (state?.$pendingSeasonalEvent && !seasonalModalOpen) {
        seasonalModalOpen = true;
        LineageEngine.openSeasonalEventModal(state, state.$pendingSeasonalEvent, () => {
          seasonalModalOpen = false;
          renderApp();
        });
      }

      const player = state.$actors[state.$playerId];

      // Check for zero health defeat or death
      if (player && state.$world.health <= 0 && player.isAlive && activeView !== 'succession') {
        const vitality = Math.min(100, (player.genetics?.vitality ?? 50) + (player.traits?.includes('Resilient') ? 5 : 0) + (player.traits?.includes('Dragon Blood') ? 10 : 0));
        const surviveChance = (state.$world.config?.DEATH_SAVE_BASE ?? 40) + vitality * (state.$world.config?.DEATH_SAVE_VIT ?? 0.4);
        if (nextRandom(state) * 100 < surviveChance) {
          state.$world.health = 10;
          state.$world.wounded = true;
          addChronicleEntry(state, `${player.name} survived a mortal wound and will begin next season with half AP.`, 'wounded', [player.id]);
        } else {
          killActor(state, state.$playerId, 'fatal wounds sustained during an expedition');
          activeView = 'succession';
        }
      }
      if (player && !player.isAlive && activeView !== 'succession') {
        activeView = 'succession';
      }

      LineageEngine.renderSidebar(sidebarSlot, state, (action, extraData) => {
        if (action === 'advance_season') {
          questFeedback = '';
          const res = advanceSeason(state);

          saveAutosave();

          // Check childbirth modal for player
          if (res?.childbirthEvents) {
            const playerBirth = res.childbirthEvents.find(e => e.isPlayerChild);
            if (playerBirth) {
              LineageEngine.openChildbirthModal(state, playerBirth.child, () => {
                renderApp();
              });
              return;
            }
          }

          renderApp();
        } else if (action === 'debug_modal') {
          LineageEngine.openDebugModal(state, renderApp);
        } else if (action === 'save_load_modal') {
          LineageEngine.openSaveLoadModal(state, (newState) => {
            if (newState === 'new_game') {
              startNewDynasty();
            } else if (newState) {
              state = newState;
              questFeedback = '';
              renderApp();
            }
          }, {
            storageWarning,
            onStorageRecovered: () => {
              storageWarning = '';
              renderApp();
            },
          });
        } else if (action === 'abdicate') {
          const heirs = getEligibleHeirs(state, state.$playerId);
          if (heirs.length > 0) {
            killActor(state, state.$playerId, 'voluntary abdication of the throne');
            activeView = 'succession';
            renderApp();
          }
        } else if (action === 'interaction') {
          selectedInteractionActorId = extraData;
          activeView = 'interaction';
          renderApp();
        } else {
          if (action !== 'quests') questFeedback = '';
          activeView = action;
          renderApp();
        }
      });

      if (storageWarning) {
        const warning = document.createElement('div');
        warning.setAttribute('role', 'alert');
        warning.style.cssText = 'margin:0.75rem; padding:0.75rem; border:1px solid #ef4444; border-radius:6px; color:#fca5a5; font-size:0.8rem;';
        warning.innerText = storageWarning;
        sidebarSlot.prepend(warning);
      }

      if (activeView === 'world_location') {
        LineageEngine.renderWorldLocationView(viewportSlot, state, (view, extraData) => {
          if (view === 'interaction') {
            selectedInteractionActorId = extraData;
            activeView = 'interaction';
          } else {
            activeView = view;
            worldLocationFeedback = view === 'world_location' ? (extraData || '') : '';
          }
          renderApp();
        }, worldLocationFeedback);
        worldLocationFeedback = '';
      } else if (activeView === 'hub') {
        LineageEngine.renderHubView(viewportSlot, state, (targetActorId) => {
          selectedInteractionActorId = targetActorId;
          activeView = 'interaction';
          renderApp();
        });
      } else if (activeView === 'interaction') {
        LineageEngine.renderInteractionView(viewportSlot, state, selectedInteractionActorId, () => {
          activeView = 'world_location';
          renderApp();
        }, renderApp);
      } else if (activeView === 'family_tree') {
        LineageEngine.renderFamilyTreeVR(viewportSlot, state, (targetActorId) => {
          selectedInteractionActorId = targetActorId;
          activeView = 'interaction';
          renderApp();
        });
      } else if (activeView === 'quests') {
        LineageEngine.renderQuestsView(viewportSlot, state, renderApp, questFeedback, message => { questFeedback = message; });
      } else if (activeView === 'chronicle') {
        LineageEngine.renderChronicleView(viewportSlot, state);
      } else if (activeView === 'succession') {
        LineageEngine.renderSuccessionView(viewportSlot, state, (action) => {
          if (action === 'restart') {
            startNewDynasty();
          } else {
            activeView = 'world_location';
            renderApp();
          }
        });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', saveAutosave);
      window.SugarCube = window.SugarCube || {};
      window.SugarCube.State = window.SugarCube.State || {};
      Object.defineProperty(window.SugarCube.State, 'variables', {
        get() { return state; },
        set(v) { state = v; },
        configurable: true,
        enumerable: true
      });
      window.SugarCube.Engine = window.SugarCube.Engine || {
        play(viewName) {
          if (viewName === 'founder_creation' || viewName === 'Hub' || viewName === 'hub') activeView = 'world_location';
          else if (viewName === 'FamilyTree' || viewName === 'family_tree') activeView = 'family_tree';
          else if (viewName === 'Interaction' || viewName === 'interaction') activeView = 'interaction';
          else if (viewName === 'Succession' || viewName === 'succession') activeView = 'succession';
          else if (viewName === 'DebugModal' || viewName === 'debug_modal') activeView = 'debug_modal';
          else activeView = viewName;
          renderApp();
        }
      };
      window.State = window.SugarCube.State;
    }

    renderApp();
  }
};

if (typeof window !== 'undefined') {
  window.setup = window.setup || {};
  window.setup.Lineage = LineageEngine;
}

export default LineageEngine;
