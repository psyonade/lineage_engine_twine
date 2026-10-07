import {
  SEASONS,
  clamp,
  createUnionDTO,
  createActorDTO,
  addChronicleEntry,
  addMemory,
  adjustHouseRelation,
  addHouseRenown,
  clampStats,
  clampRelationship,
} from './stateSchema.js';
import { stateRng, nextRandom } from './rng.js';
import {
  generateOffspringGenetics,
  inheritTraits,
  calculateCompatibility,
} from './genetics.js';
import { BLOODLINE_LEGACY_QUEST } from './worldContent.js';

export function getLifeStage(age, config = {}) {
  if (age < (config.CHILD_AGE ?? 12)) return 'Child';
  if (age < (config.YOUTH_AGE ?? 16)) return 'Youth';
  if (age < (config.ELDER_AGE ?? 55)) return 'Adult';
  return 'Elder';
}

export function getActorAge(actor, currentYear) {
  if (!actor) return 0;
  if (!actor.isAlive && actor.deathYear !== null) {
    return actor.deathYear - actor.birthYear;
  }
  return currentYear - actor.birthYear;
}

export function calculateSeductionChance(state, actor, target, approach = 'sincere') {
  if (!state?.$world || !actor || !target) return 0;
  const approaches = {
    sincere: { base: 30, actorStat: 'diplomacy', targetStat: 'intrigue', statWeight: 0.20, compatibilityWeight: 0.32, affinityWeight: 0.20, bonuses: { Charming: 8, 'Silver-Tongued': 12 }, targetPenalties: { 'Short-Tempered': 4 } },
    playful: { base: 27, actorStat: 'diplomacy', targetStat: 'learning', statWeight: 0.14, compatibilityWeight: 0.45, affinityWeight: 0.22, bonuses: { Charming: 9, Quick: 6 }, targetPenalties: { Melancholic: 5 } },
    bold: { base: 22, actorStat: 'intrigue', targetStat: 'diplomacy', statWeight: 0.22, compatibilityWeight: 0.24, affinityWeight: 0.16, bonuses: { Fierce: 10, 'Short-Tempered': 5 }, targetPenalties: { Stoic: 8 } },
  };
  const style = approaches[approach] || approaches.sincere;
  const actorRelationship = actor.relationships?.[target.id] || {};
  const targetRelationship = target.relationships?.[actor.id] || {};
  const averageAffinity = ((actorRelationship.affinity ?? 50) + (targetRelationship.affinity ?? 50)) / 2;
  const averageRomance = ((actorRelationship.romance ?? 0) + (targetRelationship.romance ?? 0)) / 2;
  const actorSkill = actor.stats?.[style.actorStat] ?? 50;
  const targetSkill = target.stats?.[style.targetStat] ?? 50;
  const traitBonus = Object.entries(style.bonuses).reduce((total, [trait, bonus]) => total + (actor.traits?.includes(trait) ? bonus : 0), 0);
  const resistance = Object.entries(style.targetPenalties).reduce((total, [trait, penalty]) => total + (target.traits?.includes(trait) ? penalty : 0), 0);
  const compatibility = calculateCompatibility(actor, target, state.$actors, state.$world.config);
  const rawChance = style.base +
    ((compatibility - 50) * style.compatibilityWeight) +
    ((averageAffinity - 50) * style.affinityWeight) +
    (averageRomance * 0.10) +
    ((actorSkill - targetSkill) * style.statWeight) +
    traitBonus - resistance;
  return Math.round(clamp(rawChance, state.$world.config?.SEDUCTION_CHANCE_MIN ?? 5, state.$world.config?.SEDUCTION_CHANCE_MAX ?? 85));
}

export function calculateCourtshipChance(state, actor, target) {
  if (!state?.$world || !actor || !target) return 0;
  const actorRelationship = actor.relationships?.[target.id] || {};
  const targetRelationship = target.relationships?.[actor.id] || {};
  const averageAffinity = ((actorRelationship.affinity ?? 50) + (targetRelationship.affinity ?? 50)) / 2;
  const averageRomance = ((actorRelationship.romance ?? 0) + (targetRelationship.romance ?? 0)) / 2;
  const compatibility = calculateCompatibility(actor, target, state.$actors, state.$world.config);
  const diplomacy = actor.stats?.diplomacy ?? 50;
  const resistance = target.stats?.intrigue ?? 50;
  const traitBonus = (actor.traits?.includes('Charming') ? 8 : 0) +
    (actor.traits?.includes('Silver-Tongued') ? 10 : 0);
  const traitResistance = (target.traits?.includes('Short-Tempered') ? 5 : 0) +
    (target.traits?.includes('Stoic') ? 4 : 0);
  const rawChance = 38 +
    ((compatibility - 50) * 0.36) +
    ((averageAffinity - 50) * 0.28) +
    (averageRomance * 0.12) +
    ((diplomacy - resistance) * 0.16) +
    traitBonus - traitResistance;
  return Math.round(clamp(rawChance, state.$world.config?.COURTSHIP_CHANCE_MIN ?? 5, state.$world.config?.COURTSHIP_CHANCE_MAX ?? 90));
}

export function initiatePregnancy(state, motherId, fatherId, unionId, chance = 1) {
  const mother = state.$actors[motherId];
  const father = state.$actors[fatherId];
  const union = state.$unions?.[unionId];
  const minAge = state.$world.config?.ROMANCE_MIN_AGE ?? 16;
  if (!mother || !father || mother.gender !== 'female' || father.gender !== 'male' || mother.isPregnant || !mother.isAlive || !father.isAlive || getActorAge(mother, state.$world.year) < minAge || getActorAge(father, state.$world.year) < minAge || getActorAge(mother, state.$world.year) > (state.$world.config?.CONCEPTION_MAX_AGE ?? 44)) return false;
  if (unionId && (!union || !union.partners.includes(motherId) || !union.partners.includes(fatherId))) return false;
  if (nextRandom(state) >= chance) return false;

  let conceptionLink = union;
  if (!conceptionLink) {
    conceptionLink = createUnionDTO({
      partners: [motherId, fatherId],
      formedYear: state.$world.year,
      active: false,
      type: 'parentage',
    });
    state.$unions[conceptionLink.id] = conceptionLink;
    mother.unions ||= [];
    father.unions ||= [];
    mother.unions.push(conceptionLink.id);
    father.unions.push(conceptionLink.id);
  }

  mother.isPregnant = true;
  mother.pregnancy = {
    motherId,
    fatherId,
    unionId: conceptionLink.id,
    dueTick: (state.$world.tickCount || 0) + (state.$world.config?.GESTATION_SEASONS ?? 3),
  };
  return true;
}

export function advanceSeason(state, injectedRng, options = {}) {
  if (!state.$world) return;
  const rng = stateRng(state, injectedRng);

  const world = state.$world;
  world.tickCount = (world.tickCount || 0) + 1;

  // Reset AP and seasonal interaction cooldowns
  world.maxAp = world.config?.AP_PER_SEASON ?? world.maxAp ?? 4;
  world.ap = world.maxAp;
  world.quickTravelUsed = false;
  if (world.wounded) { world.ap = Math.max(1, Math.ceil((world.maxAp || 4) / 2)); world.wounded = false; }
  world.actedThisSeason = {};

  // Recover player HP
  if (typeof world.health === 'number') {
    const playerTraits = state.$actors[state.$playerId]?.traits || [];
    const regen = (world.config?.HEALTH_REGEN ?? 10) + (playerTraits.includes('Resilient') ? 5 : 0) + (playerTraits.includes('Sun-Kissed') ? 10 : 0);
    world.health = clamp(world.health + regen, 0, world.maxHealth || 100);
  }

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

  const childbirthEvents = processPregnancies(state, rng);
  processAutonomousUnionsAndOffspring(state, rng);
  processNpcLocationMovement(state, rng);
  processHousePolitics(state, rng);
  let seasonalEvent = null;
  const hasPlayerBirth = childbirthEvents.some(event => event.isPlayerChild);
  if (!options.suppressSeasonalEvent && !hasPlayerBirth && !state.$pendingSeasonalEvent && rng() < (world.config?.SEASONAL_EVENT_CHANCE ?? 0.2)) {
    seasonalEvent = createSeasonalEvent(state, rng);
    if (seasonalEvent) state.$pendingSeasonalEvent = seasonalEvent;
  }

  return {
    yearPassed,
    year: world.year,
    season: world.season,
    childbirthEvents,
    seasonalEvent,
  };
}

function createSeasonalEvent(state, rng) {
  const player = state.$actors?.[state.$playerId];
  if (!player?.isAlive) return null;
  const season = state.$world.season;
  const child = (player.children || []).map(id => state.$actors[id]).find(actor => actor?.isAlive && getActorAge(actor, state.$world.year) >= 5 && getActorAge(actor, state.$world.year) < 16);
  const house = state.$houses?.[String(player.house || '').toLowerCase().replace(/[^a-z0-9]+/g, '_')];
  const politicalTie = Object.entries(house?.relations || {}).find(([, value]) => value <= -15 || value >= 30);
  const candidates = [];

  const activeQuest = Object.values(state.$quests || {}).find(quest => quest.status === 'active');
  if (activeQuest) candidates.push({
    id: 'quest_complication', title: `Trouble with ${activeQuest.title}`, questId: activeQuest.id, actorIds: [player.id],
    text: `New trouble threatens the unfinished matter of ${activeQuest.title}. Your family can spend resources to contain it, or leave it for another season.`,
    choices: [
      { id: 'address', label: 'Address the complication', description: 'Spend 5 Gold to keep the situation from worsening.', effects: { gold: -5, questPressure: -1, memory: `You spent resources to contain a complication in ${activeQuest.title}.` }, costGold: 5 },
      { id: 'defer', label: 'Leave it for another season', description: 'Keep your Gold, but let the unfinished situation grow more difficult.', effects: { questPressure: 1, memory: `You deferred a complication in ${activeQuest.title}.` } },
    ],
  });

  if (season === 'Autumn') candidates.push({
    id: 'harvest_festival', title: 'Harvest Gathering', actorIds: [player.id],
    text: 'The harvest festival brings neighbors together. Several villagers ask your house to help lead the celebration.',
    choices: [
      { id: 'host', label: 'Host the gathering', description: 'Spend 10 Gold and strengthen your house’s standing.', effects: { gold: -10, houseRenown: 3, memory: 'You hosted the harvest gathering and brought the village together.' }, costGold: 10 },
      { id: 'attend', label: 'Attend as a guest', description: 'Share the evening without taking on the expense.', effects: { health: 5, memory: 'You shared an evening with the village at the harvest gathering.' } },
    ],
  });
  if (season === 'Winter') candidates.push({
    id: 'winter_fever', title: 'Fever in the Cold', actorIds: [player.id],
    text: 'A winter fever is spreading through the settlement. A healer offers medicine, though the ingredients are costly.',
    choices: [
      { id: 'medicine', label: 'Buy the healer’s medicine', description: 'Spend 10 Gold to recover health and support the healer.', effects: { gold: -10, health: 15, houseRenown: 2, memory: 'You bought medicine during the winter fever and helped the healer.' }, costGold: 10 },
      { id: 'rest', label: 'Stay home and rest', description: 'Avoid the cost, but lose some health to the fever.', effects: { health: -10, memory: 'You endured the winter fever at home.' } },
    ],
  });
  if (child) candidates.push({
    id: 'child_question', title: `${child.name} Asks About the Family`, actorIds: [player.id, child.id], targetId: child.id,
    text: `${child.name} asks what an ancestor was like and whether the family still remembers them.`,
    choices: [
      { id: 'share', label: 'Share a family story', description: 'Build the child’s curiosity and strengthen your bond.', effects: { stats: { learning: 1 }, affinity: 5, memory: `You shared a family story with ${child.name}.` } },
      { id: 'defer', label: 'Say you will tell them another time', description: 'The conversation ends, leaving the question unanswered.', effects: { affinity: -2, memory: `You postponed ${child.name}’s question about the family.` } },
    ],
  });
  if (politicalTie) {
    const [otherKey, relation] = politicalTie;
    const otherHouse = state.$houses?.[otherKey]?.name || otherKey;
    candidates.push({
      id: 'political_visitor', title: 'A Political Visitor', actorIds: [player.id], otherHouse,
      text: relation < 0 ? `A messenger from House ${otherHouse} arrives to discuss the long tension between your houses.` : `A representative of House ${otherHouse} arrives to renew the good relations between your houses.`,
      choices: [
        { id: 'welcome', label: relation < 0 ? 'Offer a path to peace' : 'Welcome the representative', description: 'Spend 5 Gold to improve relations between the houses.', effects: { gold: -5, houseRelation: { first: player.house, second: otherHouse, delta: 8 }, houseRenown: 2, memory: `You received a representative from House ${otherHouse} and improved relations.` }, costGold: 5 },
        { id: 'decline', label: relation < 0 ? 'Refuse the meeting' : 'Keep the visit brief', description: 'Leave house relations unchanged.', effects: { memory: `You met a representative from House ${otherHouse}, but made no new agreement.` } },
      ],
    });
  }
  return candidates.length ? candidates[Math.floor(rng() * candidates.length)] : null;
}

export function resolveSeasonalEvent(state, choiceId) {
  const event = state.$pendingSeasonalEvent;
  const player = state.$actors?.[state.$playerId];
  const choice = event?.choices?.find(item => item.id === choiceId);
  if (!event || !player || !choice || (choice.costGold && (state.$world.gold || 0) < choice.costGold)) return false;
  const effects = choice.effects || {};
  state.$world.gold = Math.max(0, (state.$world.gold || 0) + (effects.gold || 0));
  state.$world.health = clamp((state.$world.health || 100) + (effects.health || 0), 0, state.$world.maxHealth || 100);
  if (effects.stats) player.stats = clampStats(Object.fromEntries(Object.entries(player.stats || {}).map(([key, value]) => [key, value + (effects.stats[key] || 0)])));
  if (effects.houseRenown) addHouseRenown(state, player.house, effects.houseRenown);
  if (effects.houseRelation) adjustHouseRelation(state, effects.houseRelation.first, effects.houseRelation.second, effects.houseRelation.delta);
  const quest = event.questId ? state.$quests?.[event.questId] : null;
  if (quest && effects.questPressure) {
    const previousPressure = quest.pressure || 0;
    quest.pressure = clamp(previousPressure + effects.questPressure, 0, state.$world.config?.QUEST_PRESSURE_MAX ?? 5);
    quest.eventHistory ||= [];
    quest.eventHistory.push({ year: state.$world.year, season: state.$world.season, title: event.title, choice: choice.label, pressure: quest.pressure });
  }
  if (effects.affinity && event.targetId) {
    player.relationships ||= {};
    const target = state.$actors[event.targetId];
    player.relationships[event.targetId] = clampRelationship({ ...(player.relationships[event.targetId] || {}), affinity: (player.relationships[event.targetId]?.affinity ?? 50) + effects.affinity });
    if (target) {
      target.relationships ||= {};
      target.relationships[player.id] = clampRelationship({ ...(target.relationships[player.id] || {}), affinity: (target.relationships[player.id]?.affinity ?? 50) + effects.affinity });
    }
  }
  if (effects.memory) {
    addMemory(state, player.id, { type: event.id, actorIds: event.actorIds || [player.id], context: effects.memory, weight: 4 });
    if (event.targetId) addMemory(state, event.targetId, { type: event.id, actorIds: event.actorIds || [player.id, event.targetId], context: effects.memory, weight: 4 });
  }
  addChronicleEntry(state, `${event.title}: ${choice.description}`, 'seasonal_event', event.actorIds || [player.id]);
  state.$pendingSeasonalEvent = null;
  return true;
}

function processPregnancies(state, rng) {
  const childbirthEvents = [];
  const actors = Object.values(state.$actors || {});

  for (const actor of actors) {
    if (!actor.isAlive || !actor.isPregnant || !actor.pregnancy) continue;

    if (state.$world.tickCount >= actor.pregnancy.dueTick) {
      const { unionId, motherId, fatherId } = actor.pregnancy;
      const child = produceOffspring(state, unionId, rng);

      actor.isPregnant = false;
      actor.pregnancy = null;

      if (child) {
        const isPlayerChild = motherId === state.$playerId || fatherId === state.$playerId;
        childbirthEvents.push({
          child,
          motherId,
          fatherId,
          isPlayerChild,
        });
      }
    }
  }

  return childbirthEvents;
}

function processNpcLocationMovement(state, rng) {
  const locations = ['tavern', 'market', 'woods', 'ruins', 'shrine', 'keep'];
  const player = state.$actors[state.$playerId];
  const playerSpouseId = player?.spouseId;

  for (const actor of Object.values(state.$actors || {})) {
    if (!actor.isAlive || actor.id === state.$playerId) continue;

    // Spouses and young children stay near player's location
    const age = getActorAge(actor, state.$world.year);
    if (actor.id === playerSpouseId || age < (state.$world.config?.CHILD_AGE ?? 12)) {
      if (player?.location) actor.location = state.$world.location || 'tavern';
      continue;
    }

    const goal = (actor.goals || []).slice().sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    if (goal?.targetLocation && rng() < (state.$world.config?.MOVEMENT_GOAL_CHANCE ?? 0.7)) {
      actor.location = goal.targetLocation;
      continue;
    }
    if (goal?.type === 'wealth' && rng() < (state.$world.config?.MOVEMENT_WEALTH_CHANCE ?? 0.55)) {
      actor.location = 'market';
      goal.progress = (goal.progress || 0) + 1;
      continue;
    }
    if (goal?.type === 'defend_house' && rng() < (state.$world.config?.MOVEMENT_DEFEND_CHANCE ?? 0.65)) {
      actor.location = 'keep';
      goal.progress = (goal.progress || 0) + 1;
      continue;
    }
    if (goal?.type === 'protect_family') {
      const family = [...(actor.children || []), ...(actor.spouseId ? [actor.spouseId] : [])].map(id => state.$actors[id]).find(relative => relative?.isAlive);
      if (family && rng() < (state.$world.config?.MOVEMENT_PROTECT_CHANCE ?? 0.7)) { actor.location = family.location; goal.progress = (goal.progress || 0) + 1; continue; }
    }
    if (rng() < (state.$world.config?.MOVEMENT_WANDER_CHANCE ?? 0.25)) {
      const newLoc = locations[Math.floor(rng() * locations.length)];
      actor.location = newLoc;
    }
  }
}

function processYearlyAgingAndMortality(state, rng) {
  const world = state.$world;
  const currentYear = state.$world.year;
  const actors = Object.values(state.$actors || {});

  for (const actor of actors) {
    if (!actor.isAlive) continue;

    const age = getActorAge(actor, currentYear);

    const shortLived = actor.traits?.includes('Short-Lived');
    if (age >= (shortLived ? (world.config?.DEATH_START_SHORTLIVED ?? 40) : (world.config?.DEATH_START_AGE ?? 55))) {
      const vitality = clamp((actor.genetics?.vitality ?? 50) + (actor.traits?.includes('Resilient') ? 5 : 0) + (actor.traits?.includes('Dragon Blood') ? 10 : 0));
      let baseMortalityChance = (age - (shortLived ? (world.config?.DEATH_START_SHORTLIVED ?? 40) : (world.config?.DEATH_START_AGE ?? 55))) * (world.config?.DEATH_SLOPE ?? 0.035);

      const vitalityModifier = (50 - vitality) * (world.config?.DEATH_VITALITY_FACTOR ?? 0.001);
      baseMortalityChance += vitalityModifier;

      if (actor.traits?.includes('Fragile')) baseMortalityChance += world.config?.DEATH_FRAGILE_BONUS ?? 0.05;
      if (actor.traits?.includes('Resilient')) baseMortalityChance -= world.config?.DEATH_RESILIENT_REDUCTION ?? 0.03;
      if (actor.traits?.includes('Short-Lived') && age >= (world.config?.DEATH_START_SHORTLIVED ?? 40)) baseMortalityChance += world.config?.DEATH_SHORTLIVED_BONUS ?? 0.10;

      baseMortalityChance = clamp(baseMortalityChance, world.config?.DEATH_CHANCE_MIN ?? 0.01, world.config?.DEATH_CHANCE_MAX ?? 0.90);

      if (rng() < baseMortalityChance) {
        killActor(state, actor.id, 'old age or natural causes');
      }
    }
  }
}

function processHousePolitics(state, rng) {
  const world = state.$world;
  world.conflicts ||= {};
  const houses = Object.entries(state.$houses || {});
  for (let i = 0; i < houses.length; i += 1) {
    const [firstKey, firstHouse] = houses[i];
    for (let j = i + 1; j < houses.length; j += 1) {
      const [secondKey, secondHouse] = houses[j];
      const relation = firstHouse.relations?.[secondKey] ?? 0;
      const conflictKey = [firstKey, secondKey].sort().join(':');
      const conflict = world.conflicts[conflictKey];
      const nextStatus = relation <= (world.config?.FEUD_THRESHOLD ?? -40) ? 'feud' : relation <= (world.config?.RIVALRY_THRESHOLD ?? -15) ? 'rivalry' : relation >= (world.config?.ALLIANCE_THRESHOLD ?? 30) ? 'alliance' : 'neutral';
      const previousStatus = conflict?.status || 'neutral';

      if (nextStatus !== previousStatus) {
        if (nextStatus === 'feud') {
          world.conflicts[conflictKey] = { houses: [firstKey, secondKey], status: 'feud', startedYear: world.year, startedSeason: world.season, pressure: 0, familyEntanglements: [] };
          const involved = Object.values(state.$actors || {}).filter(actor => actor.isAlive && (actor.house === firstHouse.name || actor.house === secondHouse.name));
          const priorityIds = [state.$playerId, state.$actors[state.$playerId]?.spouseId].filter(id => id && involved.some(actor => actor.id === id));
          const actorIds = [...priorityIds, ...involved.filter(actor => actor.tier !== 'background').map(actor => actor.id)].filter((id, index, ids) => ids.indexOf(id) === index).slice(0, 12);
          addChronicleEntry(state, `House ${firstHouse.name} and House ${secondHouse.name} fell into open feud as their relations reached ${relation}.`, 'house_feud', actorIds);
          for (const actor of involved) {
            addMemory(state, actor.id, { type: 'house_feud', actorIds, context: `Your house entered a feud with ${actor.house === firstHouse.name ? secondHouse.name : firstHouse.name}.`, weight: 5 });
            actor.goals ||= [];
            const rivalHouse = actor.house === firstHouse.name ? secondHouse.name : firstHouse.name;
            if (actor.tier !== 'background' && !actor.goals.some(goal => goal.type === 'defend_house' && goal.targetHouse === actor.house && goal.opponentHouse === rivalHouse)) actor.goals.push({ type: 'defend_house', targetHouse: actor.house, opponentHouse: rivalHouse, priority: 2, progress: 0 });
          }
          const feudHouseNames = new Set([firstHouse.name, secondHouse.name]);
          for (const union of Object.values(state.$unions || {})) {
            if (!union.active || union.partners?.length < 2) continue;
            const partners = union.partners.map(id => state.$actors[id]).filter(actor => actor?.isAlive);
            if (partners.length < 2 || partners[0].house === partners[1].house || !partners.every(actor => feudHouseNames.has(actor.house))) continue;
            const children = (union.children || []).map(id => state.$actors[id]).filter(actor => actor?.isAlive);
            const familyIds = [...partners, ...children].map(actor => actor.id);
            const householdHasImportantCharacter = [...partners, ...children].some(actor => actor.tier !== 'background');
            if (!householdHasImportantCharacter) continue;
            world.conflicts[conflictKey].familyEntanglements.push({ unionId: union.id, actorIds: familyIds });
            for (const partner of partners) {
              const other = partners.find(actor => actor.id !== partner.id);
              addMemory(state, partner.id, { type: 'family_feud', actorIds: familyIds, context: `Your marriage to ${other.name} ties you to both houses while House ${firstHouse.name} and House ${secondHouse.name} are at feud.`, weight: 8 });
              partner.goals ||= [];
              if (!partner.goals.some(goal => goal.type === 'protect_family' && goal.conflictKey === conflictKey)) partner.goals.push({ type: 'protect_family', conflictKey, priority: 4, progress: 0 });
              const relationship = partner.relationships?.[other.id];
              if (relationship) {
                relationship.flags ||= [];
                if (!relationship.flags.includes('Caught Between Houses')) relationship.flags.push('Caught Between Houses');
              }
            }
            for (const child of children) addMemory(state, child.id, { type: 'family_feud', actorIds: familyIds, context: `Your parents' marriage ties you to both House ${firstHouse.name} and House ${secondHouse.name} during their feud.`, weight: 7 });
            const connectedIds = familyIds.filter(id => state.$actors[id]?.tier !== 'background');
            addChronicleEntry(state, `${partners[0].name} of House ${partners[0].house} and ${partners[1].name} of House ${partners[1].house} were caught between their marriage and their houses' feud.`, 'family_divided', connectedIds);
          }
          for (const actor of Object.values(state.$actors || {})) {
            for (const [targetId, relationship] of Object.entries(actor.relationships || {})) {
              const target = state.$actors[targetId];
              if (!target || !((actor.house === firstHouse.name && target.house === secondHouse.name) || (actor.house === secondHouse.name && target.house === firstHouse.name))) continue;
              relationship.flags ||= [];
              if (!relationship.flags.includes('House Feud')) relationship.flags.push('House Feud');
              relationship.affinity = clamp((relationship.affinity ?? 50) - 5, -100, 100);
            }
          }
        } else if (conflict && conflict.status === 'feud' && nextStatus !== 'feud') {
          conflict.status = nextStatus;
          conflict.resolvedYear = world.year;
          addChronicleEntry(state, `The feud between House ${firstHouse.name} and House ${secondHouse.name} eased as relations recovered to ${relation}.`, 'peace', []);
          for (const actor of Object.values(state.$actors || {})) actor.goals = (actor.goals || []).filter(goal => !(goal.type === 'defend_house' && ((goal.targetHouse === firstHouse.name && goal.opponentHouse === secondHouse.name) || (goal.targetHouse === secondHouse.name && goal.opponentHouse === firstHouse.name))));
        } else if (nextStatus === 'rivalry' || nextStatus === 'alliance') {
          world.conflicts[conflictKey] = { houses: [firstKey, secondKey], status: nextStatus, startedYear: world.year, startedSeason: world.season };
          addChronicleEntry(state, `Relations between House ${firstHouse.name} and House ${secondHouse.name} shifted to ${nextStatus} (${relation}).`, `house_${nextStatus}`, []);
        } else if (conflict) {
          conflict.status = 'neutral';
        }
      }

      const activeConflict = world.conflicts[conflictKey];
      if (activeConflict?.status === 'rivalry' && relation < (world.config?.RIVALRY_THRESHOLD ?? -15) && rng() < (world.config?.RIVALRY_ESCALATION_CHANCE ?? 0.18)) {
        adjustHouseRelation(state, firstHouse.name, secondHouse.name, -1);
        activeConflict.pressure = (activeConflict.pressure || 0) + 1;
        if (activeConflict.pressure % 5 === 0) addChronicleEntry(state, `Resentment between House ${firstHouse.name} and House ${secondHouse.name} deepened.`, 'house_tension', []);
      }
      if (activeConflict?.status === 'feud' && relation > -100 && rng() < (world.config?.FEUD_ESCALATION_CHANCE ?? 0.12)) {
        adjustHouseRelation(state, firstHouse.name, secondHouse.name, -1);
        activeConflict.pressure = (activeConflict.pressure || 0) + 1;
        if (activeConflict.pressure % 5 === 0) addChronicleEntry(state, `Tensions between House ${firstHouse.name} and House ${secondHouse.name} deepened during the feud.`, 'house_tension', []);
      }
    }
  }
}

export function killActor(state, actorId, cause = 'natural causes') {
  const actor = state.$actors?.[actorId];
  if (!actor || !actor.isAlive) return;

  addMemory(state, actorId, { type: 'death', actorIds: [actorId], context: `Died from ${cause}.`, weight: 10 });

  actor.isAlive = false;
  actor.deathYear = state.$world?.year ?? 1;

  if (actor.spouseId) {
    const spouse = state.$actors[actor.spouseId];
    if (spouse) {
      spouse.spouseId = null;
      actor.survivingSpouseId = spouse.isAlive ? spouse.id : null;
    }
    actor.spouseId = null;
  }
  for (const unionId of actor.unions || []) {
    const union = state.$unions?.[unionId];
    if (union) union.active = false;
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

  // NPC unions are autonomous; the player must never be married without choosing it.
  const unmarriedAdults = actors.filter(a => {
    const age = getActorAge(a, currentYear);
    return a.id !== state.$playerId && age >= 16 && age <= 50 && !a.spouseId;
  });

  for (const actor of unmarriedAdults) {
    if (actor.spouseId) continue;
    if (rng() > (state.$world.config?.AUTO_UNION_CHANCE ?? 0.20)) continue;

    const candidates = unmarriedAdults.filter(other => {
      if (other.id === actor.id || other.spouseId) return false;
      if (other.house === actor.house && actor.house !== 'Commoner') return false;
      const otherAge = getActorAge(other, currentYear);
      return Math.abs(getActorAge(actor, currentYear) - otherAge) <= 20;
    });

    candidates.sort((a, b) => {
      const goal = (actor.goals || []).slice().sort((x, y) => (y.priority || 0) - (x.priority || 0))[0];
      const score = candidate => calculateCompatibility(actor, candidate, state.$actors, state.$world.config) + (candidate.location === actor.location ? 8 : 0) + (goal?.targetHouse === candidate.house ? 30 : 0);
      return score(b) - score(a);
    });
    for (const candidate of candidates) {
      const compat = calculateCompatibility(actor, candidate, state.$actors, state.$world.config);
      if (compat >= (state.$world.config?.COMPAT_MIN ?? 50)) {
        const newUnion = formUnion(state, actor.id, candidate.id);
        const goal = (actor.goals || []).find(item => ['marry', 'marry_into_house', 'protect_family'].includes(item.type));
        if (goal && newUnion) { goal.progress = (goal.progress || 0) + 1; goal.complete = true; }
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
      if (femaleAge < (state.$world.config?.ROMANCE_MIN_AGE ?? 16) || femaleAge > (state.$world.config?.CONCEPTION_MAX_AGE ?? 44)) continue;
    }

    if (age1 < (state.$world.config?.ROMANCE_MIN_AGE ?? 16) || age2 < (state.$world.config?.ROMANCE_MIN_AGE ?? 16)) continue;

    if (partner1.id !== state.$playerId && partner2.id !== state.$playerId && rng() < (state.$world.config?.AUTO_CONCEIVE_CHANCE ?? 0.25) && femalePartner && !femalePartner.isPregnant) {
      const malePartner = partner1.gender === 'male' ? partner1 : partner2;
      initiatePregnancy(state, femalePartner.id, malePartner.id, union.id, 1);
    }
  }
}

export function formUnion(state, actor1Id, actor2Id) {
  const actor1 = state.$actors[actor1Id];
  const actor2 = state.$actors[actor2Id];

  if (!actor1 || !actor2 || actor1Id === actor2Id || !actor1.isAlive || !actor2.isAlive || actor1.spouseId || actor2.spouseId) return null;
  if (getActorAge(actor1, state.$world.year) < (state.$world.config?.ROMANCE_MIN_AGE ?? 16) || getActorAge(actor2, state.$world.year) < (state.$world.config?.ROMANCE_MIN_AGE ?? 16)) return null;

  const union = createUnionDTO({
    partners: [actor1Id, actor2Id],
    formedYear: state.$world?.year ?? 1,
    active: true,
  });

  state.$unions[union.id] = union;

  actor1.spouseId = actor2Id;
  actor2.spouseId = actor1Id;
  actor1.tier = actor2.tier = 'player-connected';
  if (actor1.house !== actor2.house) adjustHouseRelation(state, actor1.house, actor2.house, 10);

  if (!actor1.unions.includes(union.id)) actor1.unions.push(union.id);
  if (!actor2.unions.includes(union.id)) actor2.unions.push(union.id);

  addChronicleEntry(
    state,
    `${actor1.name} of House ${actor1.house} and ${actor2.name} of House ${actor2.house} formed a sacred union.`,
    'union',
    [actor1Id, actor2Id]
  );
  addMemory(state, actor1.id, { type: 'marriage', actorIds: [actor1Id, actor2Id], context: `Married ${actor2.name}.`, significant: true });
  addMemory(state, actor2.id, { type: 'marriage', actorIds: [actor1Id, actor2Id], context: `Married ${actor1.name}.`, significant: true });

  return union;
}

export const MALE_NAMES = [
  'Arthur', 'Cedric', 'Gareth', 'Julian', 'Tristan', 'Eldrin', 'Dorian', 'Valerius', 'Rowan', 'Kaelen',
  'Magnus', 'Leander', 'Cassian', 'Hadrian', 'Lucian', 'Alistair', 'Benedict', 'Caelum', 'Dominic', 'Evander',
  'Felix', 'Gideon', 'Ignatius', 'Jasper', 'Kieran', 'Lysander', 'Maximilian', 'Nathaniel', 'Oberon', 'Percival',
  'Quentin', 'Roderick', 'Silas', 'Thaddeus', 'Uther', 'Victor', 'Winston', 'Xavier', 'Yael', 'Zephyr',
  'Alden', 'Balthazar', 'Cyprian', 'Darian', 'Emrys', 'Finnian', 'Godfrey', 'Hector', 'Ivar', 'Jorund',
  'Kendrick', 'Letholdus', 'Malachi', 'Nicanor', 'Orson', 'Phineas', 'Ragnar', 'Soren', 'Tiberius', 'Vance',
  'Walden', 'Yvaine', 'Zacharias', 'Ambrose', 'Corin', 'Daven', 'Eamon', 'Fintan', 'Gawain', 'Holden'
];

export const FEMALE_NAMES = [
  'Aurelia', 'Genevieve', 'Lyra', 'Rosalind', 'Isolde', 'Elysia', 'Seraphina', 'Vivienne', 'Helena', 'Celeste',
  'Morgana', 'Maeve', 'Evangeline', 'Lyanna', 'Cassandra', 'Adelaide', 'Beatrix', 'Cressida', 'Diana', 'Elowen',
  'Florence', 'Gwendolyn', 'Isadora', 'Jocelyn', 'Katarina', 'Lorelei', 'Mirabel', 'Nicolette', 'Ophelia', 'Penelope',
  'Rhiannon', 'Sylvia', 'Talia', 'Ursula', 'Valeria', 'Willa', 'Xanthe', 'Yvaine', 'Zora', 'Amara',
  'Briar', 'Clara', 'Dahlia', 'Elspeth', 'Fiona', 'Guinevere', 'Hestia', 'Ingrid', 'Jessamine', 'Kendra', 'Lillith',
  'Mireille', 'Noelle', 'Odette', 'Priscilla', 'Rowena', 'Sybil', 'Theodora', 'Vesper', 'Winifred', 'Anya', 'Blythe'
];

export function generateUniqueName(state, gender = 'male', house = null, injectedRng) {
  const rng = stateRng(state, injectedRng);
  const pool = gender === 'male' ? MALE_NAMES : FEMALE_NAMES;
  const livingActors = Object.values(state.$actors || {}).filter(a => a.isAlive);
  const livingNames = new Set(livingActors.map(a => a.name));

  const available = pool.filter(n => !livingNames.has(n));

  if (available.length > 0) {
    const idx = Math.floor(rng() * available.length);
    return available[idx];
  }

  const baseName = pool[Math.floor(rng() * pool.length)];
  let sameNameCount = 1;

  Object.values(state.$actors || {}).forEach(a => {
    if (a.name.startsWith(baseName)) sameNameCount++;
  });

  const numerals = ['II', 'III', 'IV', 'V', 'VI'];
  const suffix = numerals[sameNameCount - 2] || `II${sameNameCount}`;
  return `${baseName} ${suffix}`;
}

export function produceOffspring(state, unionId, injectedRng, customChildName = null, customGender = null) {
  const rng = stateRng(state, injectedRng);
  const union = state.$unions[unionId];
  if (!union) return null;

  const [p1Id, p2Id] = union.partners;
  const parent1 = state.$actors[p1Id];
  const parent2 = state.$actors[p2Id];

  if (!parent1 || !parent2) return null;

  const gender = customGender || (rng() < 0.5 ? 'male' : 'female');
  const name = customChildName || generateUniqueName(state, gender, parent1.house, rng);

  const genetics = generateOffspringGenetics(parent1, parent2, rng, state.$world.config);
  const traits = inheritTraits(parent1, parent2, rng, state.$world.config);

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
    tier: parent1.id === state.$playerId || parent2.id === state.$playerId ? 'player-connected' : 'important',
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
  if (child.tier === 'player-connected') {
    addMemory(state, p1Id, { type: 'child', actorIds: [child.id], context: `${child.name} was born.`, significant: true });
    addMemory(state, p2Id, { type: 'child', actorIds: [child.id], context: `${child.name} was born.`, significant: true });
  }

  return child;
}

export function adoptChild(state, unionId, injectedRng, customChildName = null) {
  const union = state.$unions?.[unionId];
  if (!union?.active || union.partners.length !== 2 || union.children.length >= 5) return null;
  const rng = stateRng(state, injectedRng);
  const [p1Id, p2Id] = union.partners;
  const parent1 = state.$actors[p1Id];
  const parent2 = state.$actors[p2Id];
  if (!parent1?.isAlive || !parent2?.isAlive) return null;
  const gender = rng() < 0.5 ? 'male' : 'female';
  const child = createActorDTO({ name: customChildName || generateUniqueName(state, gender, parent1.house, rng), gender, birthYear: state.$world.year, house: parent1.house === state.$world.dynastyName || parent2.house === state.$world.dynastyName ? state.$world.dynastyName : parent1.house, location: state.$world.location, parents: [p1Id, p2Id], adoptive: true, tier: p1Id === state.$playerId || p2Id === state.$playerId ? 'player-connected' : 'important', genetics: generateOffspringGenetics(parent1, parent2, rng, state.$world.config), traits: inheritTraits(parent1, parent2, rng, state.$world.config) });
  state.$actors[child.id] = child;
  union.children.push(child.id);
  for (const parent of [parent1, parent2]) {
    parent.children.push(child.id);
    addMemory(state, parent.id, { type: 'child', actorIds: [child.id], context: `${child.name} joined the family through adoption.`, weight: 10 });
  }
  addChronicleEntry(state, `${child.name} was adopted by ${parent1.name} and ${parent2.name}.`, 'adoption', [child.id, p1Id, p2Id]);
  return child;
}

export function resolveQuestOutcome(state, questId, outcomeId) {
  const quest = state.$quests?.[questId];
  const player = state.$actors?.[state.$playerId];
  const outcome = quest?.outcomes?.find(item => item.id === outcomeId);
  if (!quest || !player || !outcome || quest.status === 'completed' || quest.stage !== quest.maxStage - 1 || state.$world.ap <= 0) return false;

  state.$world.ap -= 1;
  quest.stage += 1;
  quest.status = 'completed';
  quest.outcomeId = outcome.id;
  const effects = outcome.consequences || {};
  const pressure = quest.pressure || 0;
  const pressureGoldPenalty = pressure * (state.$world.config?.QUEST_PRESSURE_GOLD_PENALTY ?? 5);
  const adjustedGold = (effects.gold || 0) > 0 ? Math.max(0, effects.gold - pressureGoldPenalty) : (effects.gold || 0);
  state.$world.gold = Math.max(0, (state.$world.gold || 0) + adjustedGold);
  state.$world.health = clamp((state.$world.health || 100) + (effects.health || 0), 0, state.$world.maxHealth || 100);
  if (effects.stats) player.stats = clampStats(Object.fromEntries(Object.entries(player.stats || {}).map(([key, value]) => [key, value + (effects.stats[key] || 0)])));
  if (effects.worldFlags) Object.assign(state.$world.flags ||= {}, effects.worldFlags);
  for (const relation of effects.houseRelations || []) adjustHouseRelation(state, relation.a, relation.b, relation.delta);
  const renownGained = Math.max(0, (Number(effects.houseRenown) || 0) - pressure * (state.$world.config?.QUEST_PRESSURE_RENOWN_PENALTY ?? 1));
  if (renownGained > 0) addHouseRenown(state, player.house, renownGained);
  player.goals = (player.goals || []).filter(goal => goal.questId !== quest.id);
  const legacyText = renownGained > 0 ? ` House ${player.house} gained ${renownGained} renown.` : '';
  const pressureText = pressure > 0 ? ` The matter had built up ${pressure} levels of pressure, reducing its reward.` : '';
  addMemory(state, player.id, { type: 'quest', actorIds: [player.id], context: `Chose to ${outcome.label.toLowerCase()} in ${quest.title}. ${outcome.description}${pressureText}${legacyText}`, weight: 4 });
  addChronicleEntry(state, `${player.name} chose to ${outcome.label.toLowerCase()} in ${quest.title}. ${outcome.description}${pressureText}${legacyText}`, 'quest_outcome', [player.id]);
  return true;
}

export function getEligibleHeirs(state, playerId) {
  const player = state.$actors[playerId];
  if (!player) return [];

  const candidates = [];
  const visited = new Set();

  const addCandidate = (actorId, relationshipLabel, tier) => {
    if (!actorId || visited.has(actorId)) return;
    visited.add(actorId);

    const actor = state.$actors[actorId];
    if (actor && actor.isAlive) {
      candidates.push({
        actor,
        relationshipLabel,
        tier,
        age: getActorAge(actor, state.$world.year),
      });
    }
  };

  let generation = [...(player.children || [])];
  let tier = 0;
  while (generation.length) {
    const labels = ['Child', 'Grandchild', 'Descendant'];
    generation.forEach(id => addCandidate(id, labels[Math.min(tier, 2)], tier));
    generation = generation.flatMap(id => state.$actors[id]?.children || []);
    tier += 1;
  }
  for (const parentId of player.parents || []) {
    const siblings = (state.$actors[parentId]?.children || []).filter(id => id !== playerId);
    siblings.forEach(id => addCandidate(id, 'Sibling', 10));
    siblings.flatMap(id => state.$actors[id]?.children || []).forEach(id => addCandidate(id, 'Niece / Nephew', 11));
  }

  candidates.sort((a, b) => a.tier - b.tier || Number(b.age >= 12) - Number(a.age >= 12) || b.age - a.age);

  return candidates;
}

export function switchPlayerCharacter(state, newPlayerId) {
  const newPlayer = state.$actors[newPlayerId];
  if (!newPlayer || !newPlayer.isAlive) return false;

  const previous = state.$actors[state.$playerId];
  const oldPlayerId = state.$playerId;
  state.$playerId = newPlayerId;
  const heirAge = getActorAge(newPlayer, state.$world.year);
  const wardTarget = state.$world.config?.WARD_UNTIL_AGE ?? 12;
  if (heirAge < wardTarget) {
    let guardian = previous?.survivingSpouseId ? state.$actors[previous.survivingSpouseId] : null;
    if (!guardian?.isAlive) guardian = Object.values(state.$actors).filter(a => a.isAlive && a.id !== newPlayerId && getActorAge(a, state.$world.year) >= 18 && (a.house === newPlayer.house || a.parents?.includes(newPlayerId))).sort((a, b) => getActorAge(b, state.$world.year) - getActorAge(a, state.$world.year))[0];
    newPlayer.guardianId = guardian?.id ?? null;
    if (!guardian) {
      const yearsToWard = wardTarget - heirAge;
      state.$world.gold = Math.floor((state.$world.gold || 0) * 0.5);
      newPlayer.location = 'woods';
      state.$world.location = 'woods';
      const yearsAtStart = state.$world.year;
      const targetTick = state.$world.tickCount + yearsToWard * 4;
      while (state.$world.tickCount < targetTick && newPlayer.isAlive) {
        const beforeYear = state.$world.year;
        advanceSeason(state, undefined, { suppressSeasonalEvent: true });
        if (state.$world.year > beforeYear) addChronicleEntry(state, `${newPlayer.name} endured another year as an orphan in the Whispering Woods.`, 'ward_year', [newPlayerId]);
      }
      addChronicleEntry(state, `${newPlayer.name} took control at age ${getActorAge(newPlayer, state.$world.year)} after ${state.$world.year - yearsAtStart} years without a guardian.`, 'ward', [newPlayerId]);
      if (!newPlayer.isAlive) return false;
    } else {
      const seasonsNeeded = (wardTarget - heirAge) * 4;
      const targetTick = state.$world.tickCount + seasonsNeeded;
      addChronicleEntry(state, `${newPlayer.name} entered a ward period under ${guardian.name}.`, 'ward', [newPlayerId, guardian.id]);
      while (state.$world.tickCount < targetTick && newPlayer.isAlive) {
        const beforeYear = state.$world.year;
        advanceSeason(state, undefined, { suppressSeasonalEvent: true });
        if (state.$world.year > beforeYear) addChronicleEntry(state, `${newPlayer.name}'s ward year passed under ${guardian.name}'s care.`, 'ward_year', [newPlayerId, guardian.id]);
      }
      newPlayer.guardianId = null;
      if (!newPlayer.isAlive) return false;
    }
  }
  for (const quest of Object.values(state.$quests || {})) {
    if (['completed', 'failed'].includes(quest.status)) continue;
    quest.originatorId ||= oldPlayerId || newPlayerId;
    quest.handoffs ||= [];
    if (quest.currentHolderId !== newPlayerId) {
      const fromId = quest.currentHolderId || oldPlayerId;
      if (fromId) quest.handoffs.push({ fromId, toId: newPlayerId, year: state.$world.year });
      quest.currentHolderId = newPlayerId;
      const predecessor = state.$actors[fromId];
      const handoffText = `${quest.title} passed to ${newPlayer.name}${predecessor ? ` from ${predecessor.name}` : ''}.`;
      addMemory(state, newPlayerId, { type: 'inherited_quest', actorIds: [fromId, newPlayerId].filter(Boolean), context: handoffText, weight: 6 });
      addChronicleEntry(state, handoffText, 'quest_inherited', [fromId, newPlayerId].filter(Boolean));
    }
    newPlayer.goals ||= [];
    if (!newPlayer.goals.some(goal => goal.questId === quest.id)) newPlayer.goals.push({ type: 'quest', questId: quest.id, priority: 3, progress: quest.stage || 0 });
  }
  const relicQuest = state.$quests?.relic_bloodline;
  let dynastyFounder = state.$actors[oldPlayerId] || newPlayer;
  const founderWalk = new Set();
  while (dynastyFounder?.parents?.length && !founderWalk.has(dynastyFounder.id)) {
    founderWalk.add(dynastyFounder.id);
    const parent = dynastyFounder.parents.map(id => state.$actors[id]).find(Boolean);
    if (!parent) break;
    dynastyFounder = parent;
  }
  const founderId = relicQuest?.originatorId || dynastyFounder?.id;
  if (relicQuest && founderId) relicQuest.originatorId ||= founderId;
  let isFounderDescendant = false;
  if (founderId && founderId !== newPlayerId) {
    const queue = [founderId];
    const visited = new Set();
    while (queue.length && !isFounderDescendant) {
      const ancestorId = queue.shift();
      if (visited.has(ancestorId)) continue;
      visited.add(ancestorId);
      const ancestor = state.$actors[ancestorId];
      if ((ancestor?.children || []).includes(newPlayerId)) { isFounderDescendant = true; break; }
      queue.push(...(ancestor?.children || []));
    }
  }
  if (state.$world.flags?.firstBloodlineRelic === 'dynasty' && isFounderDescendant && !state.$quests?.bloodline_legacy) {
    const legacyQuest = JSON.parse(JSON.stringify(BLOODLINE_LEGACY_QUEST));
    legacyQuest.originatorId = newPlayerId;
    legacyQuest.currentHolderId = newPlayerId;
    legacyQuest.handoffs = [];
    state.$quests.bloodline_legacy = legacyQuest;
    newPlayer.goals ||= [];
    newPlayer.goals.push({ type: 'quest', questId: legacyQuest.id, priority: 4, progress: 0 });
    const discoveryText = `${newPlayer.name} discovered an unfinished mystery in the First Bloodline relic kept by their ancestor.`;
    addMemory(state, newPlayerId, { type: 'bloodline_discovery', actorIds: [founderId, newPlayerId], context: discoveryText, weight: 8 });
    addChronicleEntry(state, discoveryText, 'bloodline_discovery', [founderId, newPlayerId]);
  }
  if (previous) state.$world.gold = Math.floor((state.$world.gold || 0) * (state.$world.config?.GOLD_INHERIT ?? 0.7));
  state.$world.location = newPlayer.location || state.$world.location;
  state.$world.health = 100;
  state.$world.maxHealth = 100 + (newPlayer.traits?.includes('Strong') ? 10 : 0) - (newPlayer.traits?.includes('Fragile') ? 10 : 0);
  state.$world.health = state.$world.maxHealth;
  state.$world.ap = state.$world.maxAp || 4;
  if (oldPlayerId && newPlayer.relationships) newPlayer.tier = 'player-connected';
  addChronicleEntry(
    state,
    `${newPlayer.name} has ascended as the head of House ${newPlayer.house}.`,
    'succession',
    [newPlayerId]
  );
  return true;
}
