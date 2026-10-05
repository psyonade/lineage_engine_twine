import { describe, it, expect } from 'vitest';
import { createInitialGameState } from '../src/scripts/stateSchema.js';
import { computeFamilyTreeLayout, getLineageSets } from '../src/scripts/familyTree.js';
import LineageEngine from '../src/scripts/index.js';
import { advanceSeason } from '../src/scripts/simulation.js';

describe('Family Tree Absolute Grid Layout & Path Routing Suite', () => {
  it('computes finite non-overlapping coordinates and valid orthogonal paths for multi-generational trees', () => {
    let state = createInitialGameState('Pendelton');
    state = LineageEngine.initGameWorld(state);

    for (let i = 0; i < 80; i++) {
      advanceSeason(state);
    }

    const layout = computeFamilyTreeLayout(state, state.$playerId);

    expect(layout.nodes.length).toBeGreaterThan(0);
    expect(layout.bounds.width).toBeGreaterThan(0);
    expect(layout.bounds.height).toBeGreaterThan(0);

    const actorNodes = layout.nodes.filter(n => n.type === 'actor');
    const coordSet = new Set();

    for (const node of actorNodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(Number.isFinite(node.row)).toBe(true);
      expect(Number.isFinite(node.col)).toBe(true);

      const coordKey = `${node.row},${node.col}`;
      expect(coordSet.has(coordKey)).toBe(false);
      coordSet.add(coordKey);
    }

    for (const conn of layout.connections) {
      expect(conn.pathD).not.toContain('NaN');
      expect(conn.pathD).toMatch(/^M\s+[\d\.]+\s+[\d\.]+/);
    }
  });

  it('correctly calculates direct ancestral and descendant lineage sets for highlighting', () => {
    let state = createInitialGameState('Pendelton');
    state = LineageEngine.initGameWorld(state);

    const lineage = getLineageSets(state, state.$playerId);

    expect(lineage.ancestors.has(state.$playerId)).toBe(true);
    expect(lineage.descendants.has(state.$playerId)).toBe(true);
  });
});
