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
});
