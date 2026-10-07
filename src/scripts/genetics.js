import { clamp } from './stateSchema.js';
import { rng as seededRng } from './rng.js';

export const LEGENDARY_TRAITS = [
  'Dragon Blood',
  'Silver-Tongued',
  'Sun-Kissed',
  'Aether Sight',
  'Iron Mind',
];

export const STANDARD_TRAITS = [
  'Strong',
  'Quick',
  'Charming',
  'Resilient',
  'Fierce',
  'Keen Eye',
  'Stoic',
];

export const CONGENITAL_TRAITS = [
  'Fragile',
  'Short-Lived',
  'Melancholic',
  'Short-Tempered',
];

export function generateRandomGenetics(random = seededRng) {
  return {
    skinTone: Math.floor(random() * 100), hairColor: Math.floor(random() * 100),
    eyeColor: Math.floor(random() * 100), faceShape: Math.floor(random() * 100),
    jawWidth: Math.floor(random() * 100), eyeSlant: Math.floor(random() * 100),
    noseBridge: Math.floor(random() * 100), height: Math.floor(random() * 100),
    vitality: clamp(40 + Math.floor(random() * 50), 0, 100),
    // Appearance genes are numeric so they can blend naturally across generations.
    faceLength: Math.floor(random() * 100), cheekbones: Math.floor(random() * 100),
    bodyFrame: Math.floor(random() * 100), hairStyle: Math.floor(random() * 100),
    hairLength: Math.floor(random() * 100), hairTexture: Math.floor(random() * 100),
    hairPart: Math.floor(random() * 100), facialHair: Math.floor(random() * 100),
    noseShape: Math.floor(random() * 100), eyeShape: Math.floor(random() * 100),
    eyeSpacing: Math.floor(random() * 100), mouthShape: Math.floor(random() * 100),
    freckles: Math.floor(random() * 100),
  };
}

export function generateOffspringGenetics(parentA, parentB, rng = seededRng, config = {}) {
  const genA = parentA?.genetics || generateRandomGenetics(rng);
  const genB = parentB?.genetics || generateRandomGenetics(rng);

  const blendGene = (valA, valB, variance = 10) => {
    const parentChoice = rng() > 0.5 ? valA : valB;
    const midpoint = (valA + valB) / 2;
    const midpointWeight = config.GENE_MIDPOINT_WEIGHT ?? 0.4;
    const base = (1 - midpointWeight) * parentChoice + midpointWeight * midpoint;
    const delta = (rng() * 2 - 1) * variance;
    return clamp(Math.round(base + delta), 0, 100);
  };

  return {
    skinTone: blendGene(genA.skinTone ?? 50, genB.skinTone ?? 50, 8),
    hairColor: blendGene(genA.hairColor ?? 50, genB.hairColor ?? 50, 10),
    eyeColor: blendGene(genA.eyeColor ?? 50, genB.eyeColor ?? 50, 10),
    faceShape: blendGene(genA.faceShape ?? 50, genB.faceShape ?? 50, 12),
    jawWidth: blendGene(genA.jawWidth ?? 50, genB.jawWidth ?? 50, 12),
    eyeSlant: blendGene(genA.eyeSlant ?? 50, genB.eyeSlant ?? 50, 10),
    noseBridge: blendGene(genA.noseBridge ?? 50, genB.noseBridge ?? 50, 10),
    height: blendGene(genA.height ?? 50, genB.height ?? 50, 12),
    vitality: blendGene(genA.vitality ?? 50, genB.vitality ?? 50, 10),
    faceLength: blendGene(genA.faceLength ?? 50, genB.faceLength ?? 50, 10),
    cheekbones: blendGene(genA.cheekbones ?? 50, genB.cheekbones ?? 50, 12),
    bodyFrame: blendGene(genA.bodyFrame ?? 50, genB.bodyFrame ?? 50, 12),
    hairStyle: blendGene(genA.hairStyle ?? 50, genB.hairStyle ?? 50, 16),
    hairLength: blendGene(genA.hairLength ?? 50, genB.hairLength ?? 50, 16),
    hairTexture: blendGene(genA.hairTexture ?? 50, genB.hairTexture ?? 50, 14),
    hairPart: blendGene(genA.hairPart ?? 50, genB.hairPart ?? 50, 16),
    facialHair: blendGene(genA.facialHair ?? 50, genB.facialHair ?? 50, 14),
    noseShape: blendGene(genA.noseShape ?? 50, genB.noseShape ?? 50, 12),
    eyeShape: blendGene(genA.eyeShape ?? 50, genB.eyeShape ?? 50, 12),
    eyeSpacing: blendGene(genA.eyeSpacing ?? 50, genB.eyeSpacing ?? 50, 10),
    mouthShape: blendGene(genA.mouthShape ?? 50, genB.mouthShape ?? 50, 12),
    freckles: blendGene(genA.freckles ?? 50, genB.freckles ?? 50, 14),
  };
}

export function inheritTraits(parentA, parentB, rng = seededRng, config = {}) {
  const traitsA = parentA?.traits || [];
  const traitsB = parentB?.traits || [];
  const combinedParentTraits = Array.from(new Set([...traitsA, ...traitsB]));
  const childTraits = new Set();

  for (const trait of combinedParentTraits) {
    if (LEGENDARY_TRAITS.includes(trait)) continue;
    const hasBoth = traitsA.includes(trait) && traitsB.includes(trait);
    const chance = hasBoth ? (config.TRAIT_SHARED_CHANCE ?? 0.75) : (config.TRAIT_SINGLE_CHANCE ?? 0.40);
    if (rng() < chance) {
      childTraits.add(trait);
    }
  }

  for (const legTrait of LEGENDARY_TRAITS) {
    if (!childTraits.has(legTrait)) {
      const parentHasLeg = traitsA.includes(legTrait) || traitsB.includes(legTrait);
      const chance = parentHasLeg ? (config.LEGENDARY_INHERIT_CHANCE ?? 0.30) : (config.LEGENDARY_SPONTANEOUS_CHANCE ?? 0.02);
      if (rng() < chance) {
        childTraits.add(legTrait);
      }
    }
  }

  if (childTraits.size < 3 && rng() < (config.TRAIT_MUTATION_CHANCE ?? 0.25)) {
    const pool = rng() < (config.STANDARD_MUTATION_WEIGHT ?? 0.8) ? STANDARD_TRAITS : CONGENITAL_TRAITS;
    const eligibleTraits = pool.filter(trait => !childTraits.has(trait));
    if (eligibleTraits.length) childTraits.add(eligibleTraits[Math.floor(rng() * eligibleTraits.length)]);
  }

  const selected = Array.from(childTraits);
  const legendary = selected.filter(trait => LEGENDARY_TRAITS.includes(trait));
  const ordinary = selected.filter(trait => !LEGENDARY_TRAITS.includes(trait));
  // Legendary inheritance wins its dedicated slot; shared traits outrank single-parent traits.
  const chosenLegendary = legendary.length ? legendary[Math.floor(rng() * legendary.length)] : null;
  const shuffle = items => {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };
  const shared = shuffle(ordinary.filter(trait => traitsA.includes(trait) && traitsB.includes(trait)));
  const singleParent = shuffle(ordinary.filter(trait => !(traitsA.includes(trait) && traitsB.includes(trait))));
  return [...(chosenLegendary ? [chosenLegendary] : []), ...[...shared, ...singleParent].slice(0, 3)];
}

export function calculateCompatibility(actorA, actorB, actorMap = {}, config = {}) {
  if (!actorA || !actorB) return 50;

  let score = config.COMPAT_BASELINE ?? 45;

  const traitsA = actorA.traits || [];
  const traitsB = actorB.traits || [];

  for (const tA of traitsA) {
    if (traitsB.includes(tA)) {
      score += config.COMPAT_SHARED_TRAIT ?? 10;
    }
  }

  if ((traitsA.includes('Fierce') && traitsB.includes('Melancholic')) ||
      (traitsB.includes('Fierce') && traitsA.includes('Melancholic'))) {
    score += config.COMPAT_BAD_PAIR ?? -15;
  }
  if ((traitsA.includes('Stoic') && traitsB.includes('Short-Tempered')) ||
      (traitsB.includes('Stoic') && traitsA.includes('Short-Tempered'))) {
    score += config.COMPAT_BAD_PAIR ?? -15;
  }
  if (traitsA.includes('Charming') || traitsB.includes('Charming')) {
    score += config.COMPAT_CHARMING ?? 10;
  }

  const statsA = actorA.stats || {};
  const statsB = actorB.stats || {};

  const statDiff =
    Math.abs((statsA.martial ?? 50) - (statsB.martial ?? 50)) +
    Math.abs((statsA.diplomacy ?? 50) - (statsB.diplomacy ?? 50)) +
    Math.abs((statsA.stewardship ?? 50) - (statsB.stewardship ?? 50)) +
    Math.abs((statsA.intrigue ?? 50) - (statsB.intrigue ?? 50)) +
    Math.abs((statsA.learning ?? 50) - (statsB.learning ?? 50));

  const avgDiff = statDiff / 5;
  if (avgDiff < (config.COMPAT_STAT_SIMILARITY_MAX_DIFF ?? 15)) {
    score += config.COMPAT_STAT_SIMILARITY ?? 15;
  } else if (avgDiff > (config.COMPAT_STAT_DIFFERENCE_MIN ?? 40)) {
    score += config.COMPAT_STAT_DIFFERENCE ?? -10;
  }

  const ancestors = (actor, depth) => {
    const found = new Map();
    let layer = (actor.parents || []).map(id => ({ id, distance: 1 }));
    while (layer.length) {
      const next = [];
      for (const item of layer) {
        if (found.has(item.id) && found.get(item.id) <= item.distance) continue;
        found.set(item.id, item.distance);
        if (item.distance < depth) for (const parentId of (actorLookup.get(item.id)?.parents || [])) next.push({ id: parentId, distance: item.distance + 1 });
      }
      layer = next;
    }
    return found;
  };
  const actorLookup = new Map([...Object.entries(actorMap).map(([id, actor]) => [id, actor]), [actorA.id, actorA], [actorB.id, actorB]]);
  const ancA = ancestors(actorA, 3);
  const ancB = ancestors(actorB, 3);
  let penalty = 0;
  if (ancA.has(actorB.id) || ancB.has(actorA.id)) penalty = config.COMPAT_CLOSE_KIN ?? 40;
  else {
    const common = [...ancA.keys()].filter(id => ancB.has(id));
    if (common.some(id => ancA.get(id) === 1 && ancB.get(id) === 1)) penalty = config.COMPAT_CLOSE_KIN ?? 40;
    else if (common.some(id => (ancA.get(id) === 1 && ancB.get(id) === 2) || (ancA.get(id) === 2 && ancB.get(id) === 1))) penalty = config.COMPAT_CLOSE_KIN ?? 40;
    else if (common.some(id => ancA.get(id) === 2 && ancB.get(id) === 2)) penalty = config.COMPAT_EXTENDED_KIN ?? 20;
  }
  score -= penalty;

  return clamp(Math.round(score), 0, 100);
}
