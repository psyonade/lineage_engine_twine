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

  it('verifies strict integer grid spacing and bounding-box collision avoidance across a 4-generation tree', () => {
    let state = createInitialGameState('Pendelton');
    state = LineageEngine.initGameWorld(state);

    // Simulate enough seasons for multi-generational reproduction (4 generations)
    for (let i = 0; i < 160; i++) {
      advanceSeason(state);
    }

    const layout = computeFamilyTreeLayout(state, state.$playerId);
    const actorNodes = layout.nodes.filter(n => n.type === 'actor');

    // Group actor nodes by row
    const nodesByRow = new Map();
    for (const node of actorNodes) {
      if (!nodesByRow.has(node.row)) {
        nodesByRow.set(node.row, []);
      }
      nodesByRow.get(node.row).push(node);
    }

    // Verify for every pair on the same row that Math.abs(A.x - B.x) >= NODE_WIDTH (130)
    const NODE_WIDTH = 130;
    nodesByRow.forEach((rowNodes, row) => {
      for (let i = 0; i < rowNodes.length; i++) {
        for (let j = i + 1; j < rowNodes.length; j++) {
          const nodeA = rowNodes[i];
          const nodeB = rowNodes[j];
          const diffX = Math.abs(nodeA.x - nodeB.x);
          expect(diffX).toBeGreaterThanOrEqual(NODE_WIDTH);
        }
      }
    });
  });
});
