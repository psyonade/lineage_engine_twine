import { describe, expect, it } from 'vitest';
import { createActorDTO, createInitialGameState, createSaveSnapshot } from '../src/scripts/stateSchema.js';

describe('save snapshot compaction', () => {
  it('keeps a dead character and family history while trimming non-family data', () => {
    const state = createInitialGameState('Pendelton');
    const parent = createActorDTO({ id: 'char_1', name: 'Parent', children: ['char_2'] });
    const deceased = createActorDTO({
      id: 'char_2',
      name: 'Deceased Heir',
      isAlive: false,
      deathYear: 20,
      parents: ['char_1'],
      genetics: { skinTone: 21, hairColor: 37, eyeColor: 68, faceShape: 41, jawWidth: 53 },
      traits: ['Resilient'],
      relationships: {
        char_1: { affinity: 90, romance: 0, respect: 80 },
        char_3: { affinity: -80, romance: 0, respect: 10 },
      },
      relationshipHistory: {
        char_1: [{ type: 'mentored', year: 10, context: 'A parent taught them to read.' }],
        char_3: [{ type: 'spar', year: 11, context: 'A stranger challenged them.' }],
      },
      goals: [{ type: 'wealth', priority: 1 }],
      memories: [
        { type: 'marriage', weight: 3, significant: true, context: 'Married into the family.' },
        ...Array.from({ length: 10 }, (_, index) => ({ type: 'quest', weight: 5, context: `Important event ${index}.` })),
        { type: 'conversation', weight: 1, context: 'A passing remark.' },
      ],
    });
    const stranger = createActorDTO({ id: 'char_3', name: 'Unrelated Stranger' });
    state.$actors = { [parent.id]: parent, [deceased.id]: deceased, [stranger.id]: stranger };
    state.$playerId = parent.id;

    const originalSize = JSON.stringify(state).length;
    const snapshot = createSaveSnapshot(state);
    const compacted = snapshot.$actors[deceased.id];

    expect(compacted).not.toBe(deceased);
    expect(compacted.isAlive).toBe(false);
    expect(compacted.genetics).toEqual(deceased.genetics);
    expect(compacted.traits).toEqual(['Resilient']);
    expect(compacted.parents).toContain(parent.id);
    expect(Object.keys(compacted.relationships)).toEqual([parent.id]);
    expect(Object.keys(compacted.relationshipHistory)).toEqual([parent.id]);
    expect(compacted.goals).toEqual([]);
    expect(compacted.memories).toHaveLength(6);
    expect(compacted.memories.every(memory => memory.weight >= 4 || memory.significant)).toBe(true);
    expect(JSON.stringify(snapshot).length).toBeLessThan(originalSize);

    expect(Object.keys(deceased.relationships)).toEqual([parent.id, stranger.id]);
    expect(deceased.goals).toHaveLength(1);
    expect(deceased.memories).toHaveLength(12);
  });
});
