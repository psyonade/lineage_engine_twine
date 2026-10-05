import { clamp } from './stateSchema.js';

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

export function generateRandomGenetics(rng = Math.random) {
  return {
    skinTone: Math.floor(rng() * 100),
    hairColor: Math.floor(rng() * 100),
    eyeColor: Math.floor(rng() * 100),
    faceShape: Math.floor(rng() * 100),
    jawWidth: Math.floor(rng() * 100),
    eyeSlant: Math.floor(rng() * 100),
    noseBridge: Math.floor(rng() * 100),
    height: Math.floor(rng() * 100),
    vitality: clamp(40 + Math.floor(rng() * 50), 0, 100),
  };
}

export function generateOffspringGenetics(parentA, parentB, rng = Math.random) {
  const genA = parentA?.genetics || generateRandomGenetics(rng);
  const genB = parentB?.genetics || generateRandomGenetics(rng);

  const blendGene = (valA, valB, variance = 10) => {
    const parentChoice = rng() > 0.5 ? valA : valB;
    const midpoint = (valA + valB) / 2;
    const base = 0.6 * parentChoice + 0.4 * midpoint;
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
  };
}

export function inheritTraits(parentA, parentB, rng = Math.random) {
  const traitsA = parentA?.traits || [];
  const traitsB = parentB?.traits || [];
  const combinedParentTraits = Array.from(new Set([...traitsA, ...traitsB]));
  const childTraits = new Set();

  for (const trait of combinedParentTraits) {
    const hasBoth = traitsA.includes(trait) && traitsB.includes(trait);
    const chance = hasBoth ? 0.75 : 0.40;
    if (rng() < chance) {
      childTraits.add(trait);
    }
  }

  for (const legTrait of LEGENDARY_TRAITS) {
    if (!childTraits.has(legTrait)) {
      const parentHasLeg = traitsA.includes(legTrait) || traitsB.includes(legTrait);
      const chance = parentHasLeg ? 0.30 : 0.02;
      if (rng() < chance) {
        childTraits.add(legTrait);
      }
    }
  }

  if (childTraits.size < 3 && rng() < 0.25) {
    const pool = rng() < 0.8 ? STANDARD_TRAITS : CONGENITAL_TRAITS;
    const randomTrait = pool[Math.floor(rng() * pool.length)];
    childTraits.add(randomTrait);
  }

  return Array.from(childTraits);
}

export function calculateCompatibility(actorA, actorB) {
  if (!actorA || !actorB) return 50;

  let score = 50;

  const traitsA = actorA.traits || [];
  const traitsB = actorB.traits || [];

  for (const tA of traitsA) {
    if (traitsB.includes(tA)) {
      score += 10;
    }
  }

  if ((traitsA.includes('Fierce') && traitsB.includes('Melancholic')) ||
      (traitsB.includes('Fierce') && traitsA.includes('Melancholic'))) {
    score -= 15;
  }
  if ((traitsA.includes('Stoic') && traitsB.includes('Short-Tempered')) ||
      (traitsB.includes('Stoic') && traitsA.includes('Short-Tempered'))) {
    score -= 15;
  }
  if (traitsA.includes('Charming') || traitsB.includes('Charming')) {
    score += 10;
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
  if (avgDiff < 15) {
    score += 15;
  } else if (avgDiff > 40) {
    score -= 10;
  }

  const parentsA = actorA.parents || [];
  const parentsB = actorB.parents || [];
  const isDirectSibling = parentsA.length > 0 && parentsB.length > 0 &&
    parentsA.some(p => parentsB.includes(p));
  const isParentChild = parentsA.includes(actorB.id) || parentsB.includes(actorA.id);

  if (isDirectSibling || isParentChild) {
    score -= 40;
  }

  return clamp(Math.round(score), 0, 100);
}
