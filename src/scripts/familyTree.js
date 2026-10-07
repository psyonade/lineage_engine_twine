export const NODE_WIDTH = 130;
export const NODE_HEIGHT = 160;
export const COL_SPACING = 170;
export const ROW_SPACING = 220;
export const PADDING_X = 60;
export const PADDING_Y = 60;

export function getDynastyRoot(state, startActorId) {
  let current = state.$actors?.[startActorId];
  if (!current) return startActorId;

  const visited = new Set();
  while (current && current.parents && current.parents.length > 0) {
    if (visited.has(current.id)) break;
    visited.add(current.id);

    const parentId = current.parents.find(pId => state.$actors[pId]) || current.parents[0];
    if (!parentId || !state.$actors[parentId]) break;
    current = state.$actors[parentId];
  }
  return current ? current.id : startActorId;
}

export function computeFamilyTreeLayout(state, rootId) {
  const topRootId = getDynastyRoot(state, rootId);
  const nodes = new Map();
  const connections = [];

  const visitedActors = new Set();
  const visitedUnions = new Set();

  function nextFreeActorCol(row, preferredCol) {
    const occupied = new Set(
      Array.from(nodes.values())
        .filter(node => node.type === 'actor' && node.row === row)
        .map(node => node.col),
    );
    let col = preferredCol;
    while (occupied.has(col)) col += 1;
    return col;
  }

  function layoutActor(actorId, gen, startCol) {
    if (visitedActors.has(actorId)) {
      return startCol + 1;
    }
    visitedActors.add(actorId);

    const actor = state.$actors[actorId];
    if (!actor) return startCol + 1;

    let currentCol = startCol;
    let actorNode = nodes.get(actor.id);
    if (!actorNode) {
      currentCol = nextFreeActorCol(gen, currentCol);
      actorNode = {
        id: actor.id,
        type: 'actor',
        actorId: actor.id,
        row: gen,
        col: currentCol,
        x: currentCol * COL_SPACING + PADDING_X,
        y: gen * ROW_SPACING + PADDING_Y,
      };
      nodes.set(actor.id, actorNode);
    } else {
      currentCol = Math.max(currentCol, actorNode.col);
    }
    const actorCol = actorNode.col;

    const activeUnions = (actor.unions || []).filter(uId => state.$unions[uId]);

    if (activeUnions.length === 0) {
      return currentCol + 1;
    }

    for (const uId of activeUnions) {
      if (visitedUnions.has(uId)) continue;
      visitedUnions.add(uId);

      const union = state.$unions[uId];
      const partnerId = union.partners.find(pId => pId !== actorId);
      const partner = partnerId ? state.$actors[partnerId] : null;

      let spouseCol = currentCol + 1;
      if (partner) {
        const existingPartnerNode = nodes.get(partner.id);
        if (existingPartnerNode) spouseCol = existingPartnerNode.col;
        else {
          spouseCol = nextFreeActorCol(gen, spouseCol);
          visitedActors.add(partner.id);
          nodes.set(partner.id, {
            id: partner.id,
            type: 'actor',
            actorId: partner.id,
            row: gen,
            col: spouseCol,
            x: spouseCol * COL_SPACING + PADDING_X,
            y: gen * ROW_SPACING + PADDING_Y,
          });
        }
      }

      const unionCol = (actorCol + spouseCol) / 2;
      const unionNodeId = union.id;

      nodes.set(unionNodeId, {
        id: unionNodeId,
        type: 'union',
        unionId: union.id,
        row: gen,
        col: unionCol,
        x: unionCol * COL_SPACING + PADDING_X,
        y: gen * ROW_SPACING + PADDING_Y + 40,
      });

      let childStartCol = Math.min(actorCol, spouseCol);

      for (const childId of (union.children || [])) {
        const nextCol = layoutActor(childId, gen + 1, childStartCol);
        childStartCol = nextCol;
      }

      currentCol = Math.max(currentCol, spouseCol + 1, childStartCol);
    }

    return currentCol;
  }

  layoutActor(topRootId, 0, 0);

  nodes.forEach((node) => {
    if (node.type === 'union') {
      const union = state.$unions[node.unionId];
      if (!union) return;

      const [p1Id, p2Id] = union.partners;
      const p1Node = nodes.get(p1Id);
      const p2Node = nodes.get(p2Id);

      const uX = node.x + 20;
      const uY = node.y + 20;

      if (p1Node) {
        const p1X = p1Node.x + NODE_WIDTH / 2;
        const p1Y = p1Node.y + NODE_HEIGHT;
        const pathD = `M ${p1X} ${p1Y} V ${uY} H ${uX}`;
        connections.push({ fromId: p1Id, toId: node.id, type: 'parent-union', pathD });
      }

      if (p2Node) {
        const p2X = p2Node.x + NODE_WIDTH / 2;
        const p2Y = p2Node.y + NODE_HEIGHT;
        const pathD = `M ${p2X} ${p2Y} V ${uY} H ${uX}`;
        connections.push({ fromId: p2Id, toId: node.id, type: 'parent-union', pathD });
      }

      const yMid = uY + (ROW_SPACING - NODE_HEIGHT) / 2 + 20;

      for (const childId of (union.children || [])) {
        const childNode = nodes.get(childId);
        if (childNode) {
          const cX = childNode.x + NODE_WIDTH / 2;
          const cY = childNode.y;
          const pathD = `M ${uX} ${uY} V ${yMid} H ${cX} V ${cY}`;
          connections.push({ fromId: node.id, toId: childId, type: 'union-child', pathD });
        }
      }
    }
  });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_WIDTH);
    maxY = Math.max(maxY, n.y + NODE_HEIGHT);
  });

  if (minX === Infinity) {
    minX = 0; minY = 0; maxX = 800; maxY = 600;
  }

  return {
    nodes: Array.from(nodes.values()),
    connections,
    bounds: {
      width: Math.max(800, maxX + PADDING_X),
      height: Math.max(600, maxY + PADDING_Y),
    },
  };
}

export function getLineageSets(state, targetActorId) {
  const ancestors = new Set();
  const descendants = new Set();
  const unions = new Set();

  if (!targetActorId || !state.$actors?.[targetActorId]) {
    return { ancestors, descendants, unions };
  }

  const queueUp = [targetActorId];
  while (queueUp.length > 0) {
    const currId = queueUp.shift();
    const curr = state.$actors[currId];
    if (!curr) continue;

    ancestors.add(currId);
    if (curr.unions) {
      curr.unions.forEach(uId => unions.add(uId));
    }

    if (curr.parents) {
      curr.parents.forEach(pId => {
        if (!ancestors.has(pId)) queueUp.push(pId);
      });
    }
  }

  const queueDown = [targetActorId];
  while (queueDown.length > 0) {
    const currId = queueDown.shift();
    const curr = state.$actors[currId];
    if (!curr) continue;

    descendants.add(currId);
    if (curr.unions) {
      curr.unions.forEach(uId => {
        unions.add(uId);
        const union = state.$unions[uId];
        if (union && union.children) {
          union.children.forEach(cId => {
            if (!descendants.has(cId)) queueDown.push(cId);
          });
        }
      });
    }
  }

  return { ancestors, descendants, unions };
}
