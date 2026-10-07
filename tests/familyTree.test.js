import { describe, it, expect } from 'vitest';
import { createActorDTO, createInitialGameState, createUnionDTO } from '../src/scripts/stateSchema.js';
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

  it('keeps a four-generation tree with multiple unions and adopted children collision-free', () => {
    const state = LineageEngine.initGameWorld(createInitialGameState('Branching House'));
    const addActor = (id, parents = [], adoptive = false) => {
      const actor = createActorDTO({ id, name: id, birthYear: state.$world.year - 30, parents, adoptive, house: state.$world.dynastyName });
      state.$actors[id] = actor;
      for (const parentId of parents) state.$actors[parentId]?.children.push(id);
      return actor;
    };
    const addUnion = (id, firstId, secondId, childIds) => {
      const union = createUnionDTO({ id, partners: [firstId, secondId], children: childIds });
      state.$unions[id] = union;
      for (const partnerId of union.partners) {
        const partner = state.$actors[partnerId];
        partner.unions.push(id);
        partner.spouseId = partnerId === firstId ? secondId : firstId;
      }
      return union;
    };

    const root = addActor('tree_root');
    addActor('tree_partner_a');
    addActor('tree_partner_b');
    addActor('tree_child_a', [root.id, 'tree_partner_a']);
    addActor('tree_adopted', [root.id, 'tree_partner_b'], true);
    addUnion('tree_union_a', root.id, 'tree_partner_a', ['tree_child_a']);
    addUnion('tree_union_b', root.id, 'tree_partner_b', ['tree_adopted']);
    addActor('tree_grandchild', ['tree_child_a', 'tree_mate']);
    addActor('tree_mate');
    addUnion('tree_child_union', 'tree_child_a', 'tree_mate', ['tree_grandchild']);
    addActor('tree_great_grandchild', ['tree_grandchild', 'tree_great_mate']);
    addActor('tree_great_mate');
    addUnion('tree_grandchild_union', 'tree_grandchild', 'tree_great_mate', ['tree_great_grandchild']);

    for (let season = 0; season < 160; season += 1) advanceSeason(state);

    const layout = computeFamilyTreeLayout(state, root.id);
    const actorNodes = layout.nodes.filter(node => node.type === 'actor');
    const actorIds = actorNodes.map(node => node.actorId);
    expect(new Set(actorIds).size).toBe(actorIds.length);
    expect(actorNodes.map(node => node.actorId)).toEqual(expect.arrayContaining([
      'tree_root', 'tree_child_a', 'tree_adopted', 'tree_grandchild', 'tree_great_grandchild',
    ]));
    expect(actorNodes.find(node => node.actorId === root.id)).toMatchObject({ row: 0, col: 0 });
    expect(state.$actors.tree_adopted.adoptive).toBe(true);

    const nodesByRow = new Map();
    for (const node of actorNodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      if (!nodesByRow.has(node.row)) nodesByRow.set(node.row, []);
      nodesByRow.get(node.row).push(node);
    }
    for (const rowNodes of nodesByRow.values()) {
      for (let first = 0; first < rowNodes.length; first += 1) {
        for (let second = first + 1; second < rowNodes.length; second += 1) {
          expect(Math.abs(rowNodes[first].x - rowNodes[second].x)).toBeGreaterThanOrEqual(130);
        }
      }
    }
    const gridPositions = actorNodes.map(node => `${node.row},${node.col}`);
    expect(new Set(gridPositions).size).toBe(gridPositions.length);
    for (const connection of layout.connections) {
      expect(connection.pathD).toMatch(/^M\s+[\d.]+\s+[\d.]+\s+V\s+[\d.]+\s+H\s+[\d.]+(?:\s+V\s+[\d.]+)?$/);
      expect(connection.pathD).not.toContain('NaN');
    }
  });
});
