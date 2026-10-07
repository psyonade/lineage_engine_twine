import { describe, it, expect } from 'vitest';
import {
  generateRandomGenetics,
  generateOffspringGenetics,
  inheritTraits,
  calculateCompatibility,
} from '../src/scripts/genetics.js';
import { createActorDTO, clamp } from '../src/scripts/stateSchema.js';

describe('Genetics & Trait Inheritance Suite', () => {
  it('clamp helper restricts out-of-bound values strictly to [min, max]', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(42, 0, 100)).toBe(42);
    expect(clamp(NaN, 0, 100)).toBe(0);
  });

  it('generateRandomGenetics produces valid bounded genes [0, 100]', () => {
    const genetics = generateRandomGenetics();
    expect(genetics.skinTone).toBeGreaterThanOrEqual(0);
    expect(genetics.skinTone).toBeLessThanOrEqual(100);
    expect(genetics.hairColor).toBeGreaterThanOrEqual(0);
    expect(genetics.hairColor).toBeLessThanOrEqual(100);
    expect(genetics.vitality).toBeGreaterThanOrEqual(0);
    expect(genetics.vitality).toBeLessThanOrEqual(100);
  });

  it('generateOffspringGenetics blends continuous traits with controlled variance', () => {
    const parentA = createActorDTO({ genetics: { skinTone: 10, hairColor: 20, vitality: 80 } });
    const parentB = createActorDTO({ genetics: { skinTone: 90, hairColor: 80, vitality: 40 } });

    let rngVal = 0.5;
    const mockRng = () => rngVal;

    const childGenetics = generateOffspringGenetics(parentA, parentB, mockRng);

    expect(childGenetics.skinTone).toBeGreaterThanOrEqual(0);
    expect(childGenetics.skinTone).toBeLessThanOrEqual(100);
    expect(childGenetics.hairColor).toBeGreaterThanOrEqual(0);
    expect(childGenetics.hairColor).toBeLessThanOrEqual(100);
    for (const gene of ['faceLength', 'cheekbones', 'bodyFrame', 'hairStyle', 'hairLength', 'hairTexture', 'hairPart', 'facialHair', 'noseShape', 'eyeShape', 'eyeSpacing', 'mouthShape', 'freckles']) {
      expect(childGenetics[gene]).toBeGreaterThanOrEqual(0);
      expect(childGenetics[gene]).toBeLessThanOrEqual(100);
    }
  });

  it('inherits appearance genes from both parents instead of dropping them', () => {
    const parentA = createActorDTO({ genetics: { hairStyle: 10, hairLength: 15, faceLength: 25, bodyFrame: 20, eyeShape: 10, mouthShape: 15 } });
    const parentB = createActorDTO({ genetics: { hairStyle: 90, hairLength: 85, faceLength: 75, bodyFrame: 80, eyeShape: 90, mouthShape: 85 } });
    const child = generateOffspringGenetics(parentA, parentB, () => 0.5);
    expect(child.hairStyle).toBeGreaterThan(10);
    expect(child.hairStyle).toBeLessThan(90);
    expect(child.hairLength).toBeGreaterThan(15);
    expect(child.hairLength).toBeLessThan(85);
    expect(child.faceLength).toBeGreaterThan(25);
    expect(child.faceLength).toBeLessThan(75);
    expect(child.bodyFrame).toBeGreaterThan(20);
    expect(child.bodyFrame).toBeLessThan(80);
    expect(child.eyeShape).toBeGreaterThan(10);
    expect(child.eyeShape).toBeLessThan(90);
    expect(child.mouthShape).toBeGreaterThan(15);
    expect(child.mouthShape).toBeLessThan(85);
  });

  it('inheritTraits preserves high inheritance chance when both parents share a trait', () => {
    const parentA = createActorDTO({ traits: ['Strong', 'Quick'] });
    const parentB = createActorDTO({ traits: ['Strong', 'Charming'] });

    const alwaysTrueRng = () => 0.01;
    const traits = inheritTraits(parentA, parentB, alwaysTrueRng);

    expect(traits).toContain('Strong');
    expect(traits).toContain('Quick');
    expect(traits).toContain('Charming');
  });

  it('calculateCompatibility evaluates traits and stat alignment symmetrically', () => {
    const actorA = createActorDTO({
      traits: ['Charming', 'Strong'],
      stats: { martial: 80, diplomacy: 70, stewardship: 60, intrigue: 50, learning: 50 },
    });
    const actorB = createActorDTO({
      traits: ['Charming', 'Quick'],
      stats: { martial: 75, diplomacy: 65, stewardship: 55, intrigue: 45, learning: 45 },
    });

    const compatAtoB = calculateCompatibility(actorA, actorB);
    const compatBtoA = calculateCompatibility(actorB, actorA);

    expect(compatAtoB).toBe(compatBtoA);
    expect(compatAtoB).toBeGreaterThanOrEqual(50);
  });

  it('applies progressively weaker penalties to siblings, cousins, and unrelated characters', () => {
    const actors = {
      parent_1: createActorDTO({ id: 'parent_1', traits: [], stats: {} }),
      parent_2: createActorDTO({ id: 'parent_2', traits: [], stats: {} }),
      parent_3: createActorDTO({ id: 'parent_3', traits: [], stats: {} }),
      parent_4: createActorDTO({ id: 'parent_4', traits: [], stats: {} }),
      parent_5: createActorDTO({ id: 'parent_5', traits: [], stats: {} }),
      parent_6: createActorDTO({ id: 'parent_6', traits: [], stats: {} }),
      grandparent: createActorDTO({ id: 'grandparent', traits: [], stats: {} }),
      sibling_a: createActorDTO({ id: 'sibling_a', parents: ['parent_1', 'parent_2'], traits: [], stats: {} }),
      sibling_b: createActorDTO({ id: 'sibling_b', parents: ['parent_1', 'parent_2'], traits: [], stats: {} }),
      cousin_parent_a: createActorDTO({ id: 'cousin_parent_a', parents: ['grandparent', 'parent_1'], traits: [], stats: {} }),
      cousin_parent_b: createActorDTO({ id: 'cousin_parent_b', parents: ['grandparent', 'parent_2'], traits: [], stats: {} }),
      cousin_a: createActorDTO({ id: 'cousin_a', parents: ['cousin_parent_a', 'parent_3'], traits: [], stats: {} }),
      cousin_b: createActorDTO({ id: 'cousin_b', parents: ['cousin_parent_b', 'parent_4'], traits: [], stats: {} }),
      unrelated: createActorDTO({ id: 'unrelated', parents: ['parent_5', 'parent_6'], traits: [], stats: {} }),
    };
    const baseline = calculateCompatibility(actors.sibling_a, actors.unrelated, actors);
    const cousinScore = calculateCompatibility(actors.cousin_a, actors.cousin_b, actors);
    const siblingScore = calculateCompatibility(actors.sibling_a, actors.sibling_b, actors);

    expect(siblingScore).toBeLessThan(cousinScore);
    expect(cousinScore).toBeLessThan(baseline);
  });
});
