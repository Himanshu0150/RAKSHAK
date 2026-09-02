import { Entity, Relationship, GraphNode, GraphLink } from '../types/investigation';

export interface GraphAnalyticsResult {
  nodes: GraphNode[];
  links: GraphLink[];
  centralityScores: Record<string, { degree: number; betweenness: number }>;
  bridgeEntities: Array<{ id: string; name: string; score: number; reason: string }>;
  communities: Array<{ id: number; name: string; nodeIds: string[]; size: number }>;
}

export interface PathfindingResult {
  sourceId: string;
  targetId: string;
  found: boolean;
  hopCount: number;
  pathNodes: Entity[];
  pathRelationships: Array<{
    source: Entity;
    target: Entity;
    relationType: string;
    evidenceId?: string;
    description: string;
  }>;
  explanation: string;
}

export function computeGraphAnalytics(entities: Entity[] = [], relationships: Relationship[] = []): GraphAnalyticsResult {
  const safeEntities = entities || [];
  const safeRelationships = relationships || [];
  const nodeMap = new Map<string, GraphNode>();
  const adjacency = new Map<string, Set<string>>();
  const linkList: GraphLink[] = [];

  safeEntities.forEach(e => {
    nodeMap.set(e.id, {
      id: e.id,
      name: e.name,
      type: e.type,
      caseIds: e.linkedCaseIds || [],
      risk: e.flaggedRisk,
      degree: 0,
      betweenness: 0,
      community: 0
    });
    adjacency.set(e.id, new Set<string>());
  });

  safeRelationships.forEach(r => {
    const src = nodeMap.get(r.source);
    const tgt = nodeMap.get(r.target);
    if (src && tgt) {
      adjacency.get(r.source)?.add(r.target);
      adjacency.get(r.target)?.add(r.source);
      linkList.push({
        id: r.id,
        source: r.source,
        target: r.target,
        relationType: r.relationType,
        evidenceId: r.evidenceId,
        weight: r.weight || 1
      });
    }
  });

  // Calculate Degree Centrality
  const centralityScores: Record<string, { degree: number; betweenness: number }> = {};
  entities.forEach(e => {
    const deg = adjacency.get(e.id)?.size || 0;
    const node = nodeMap.get(e.id);
    if (node) node.degree = deg;
    centralityScores[e.id] = { degree: deg, betweenness: 0 };
  });

  // Approximate Betweenness Centrality (Brandes Algorithm on unweighted graph)
  const nodeIds = Array.from(nodeMap.keys());
  const CB: Record<string, number> = {};
  nodeIds.forEach(v => { CB[v] = 0; });

  for (const s of nodeIds) {
    const S: string[] = [];
    const P: Record<string, string[]> = {};
    const sigma: Record<string, number> = {};
    const d: Record<string, number> = {};
    const delta: Record<string, number> = {};

    nodeIds.forEach(w => {
      P[w] = [];
      sigma[w] = 0;
      d[w] = -1;
      delta[w] = 0;
    });

    sigma[s] = 1;
    d[s] = 0;
    const Q: string[] = [s];

    while (Q.length > 0) {
      const v = Q.shift()!;
      S.push(v);
      const neighbors = adjacency.get(v) || new Set();
      for (const w of neighbors) {
        if (d[w] < 0) {
          Q.push(w);
          d[w] = d[v] + 1;
        }
        if (d[w] === d[v] + 1) {
          sigma[w] += sigma[v];
          P[w].push(v);
        }
      }
    }

    while (S.length > 0) {
      const w = S.pop()!;
      for (const v of P[w]) {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      }
      if (w !== s) {
        CB[w] += delta[w];
      }
    }
  }

  // Normalize betweenness
  const n = nodeIds.length;
  const normFactor = n > 2 ? 1 / ((n - 1) * (n - 2)) : 1;
  const bridgeEntities: Array<{ id: string; name: string; score: number; reason: string }> = [];

  entities.forEach(e => {
    const rawB = (CB[e.id] || 0) / 2; // undirected
    const normB = rawB * normFactor;
    const node = nodeMap.get(e.id);
    if (node) {
      node.betweenness = Number(normB.toFixed(4));
    }
    if (centralityScores[e.id]) {
      centralityScores[e.id].betweenness = Number(normB.toFixed(4));
    }

    if (normB > 0.04 || (adjacency.get(e.id)?.size || 0) >= 5) {
      bridgeEntities.push({
        id: e.id,
        name: e.name,
        score: normB,
        reason: `High intermediary betweenness (${(normB * 100).toFixed(1)}%). Connects ${adjacency.get(e.id)?.size || 0} distinct entities across investigative clusters.`
      });
    }
  });

  bridgeEntities.sort((a, b) => b.score - a.score);

  // Simple Louvain-like connected component / cluster partition
  const visited = new Set<string>();
  const communities: Array<{ id: number; name: string; nodeIds: string[]; size: number }> = [];
  let commIndex = 1;

  for (const id of nodeIds) {
    if (!visited.has(id)) {
      const comp: string[] = [];
      const q: string[] = [id];
      visited.add(id);

      while (q.length > 0) {
        const curr = q.shift()!;
        comp.push(curr);
        const node = nodeMap.get(curr);
        if (node) node.community = commIndex;

        const nbrs = adjacency.get(curr) || new Set();
        for (const nbr of nbrs) {
          if (!visited.has(nbr)) {
            visited.add(nbr);
            q.push(nbr);
          }
        }
      }

      const dominantType = comp.map(n => nodeMap.get(n)?.type).filter(Boolean);
      const topTypeName = dominantType[0] ? `${dominantType[0].toUpperCase()} NETWORK` : 'CLUSTER';

      communities.push({
        id: commIndex,
        name: `Group ${commIndex} (${topTypeName})`,
        nodeIds: comp,
        size: comp.length
      });
      commIndex++;
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    links: linkList,
    centralityScores,
    bridgeEntities,
    communities
  };
}

export function findEvidenceSupportedPath(
  sourceId: string,
  targetId: string,
  entities: Entity[],
  relationships: Relationship[]
): PathfindingResult {
  const entityMap = new Map(entities.map(e => [e.id, e]));
  const srcEntity = entityMap.get(sourceId);
  const tgtEntity = entityMap.get(targetId);

  if (!srcEntity || !tgtEntity) {
    return {
      sourceId,
      targetId,
      found: false,
      hopCount: 0,
      pathNodes: [],
      pathRelationships: [],
      explanation: 'One or both entities not found in the active investigation dataset.'
    };
  }

  if (sourceId === targetId) {
    return {
      sourceId,
      targetId,
      found: true,
      hopCount: 0,
      pathNodes: [srcEntity],
      pathRelationships: [],
      explanation: 'Source and target are the same entity.'
    };
  }

  // BFS to find shortest path
  const adj = new Map<string, Array<{ neighborId: string; rel: Relationship }>>();
  entities.forEach(e => adj.set(e.id, []));

  relationships.forEach(r => {
    adj.get(r.source)?.push({ neighborId: r.target, rel: r });
    adj.get(r.target)?.push({ neighborId: r.source, rel: r });
  });

  const queue: string[] = [sourceId];
  const parent = new Map<string, { prevNodeId: string; rel: Relationship }>();
  const visited = new Set<string>([sourceId]);

  let found = false;

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === targetId) {
      found = true;
      break;
    }

    const nbrs = adj.get(curr) || [];
    for (const { neighborId, rel } of nbrs) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        parent.set(neighborId, { prevNodeId: curr, rel });
        queue.push(neighborId);
      }
    }
  }

  if (!found) {
    return {
      sourceId,
      targetId,
      found: false,
      hopCount: 0,
      pathNodes: [],
      pathRelationships: [],
      explanation: `No direct or multi-hop path connects "${srcEntity.name}" to "${tgtEntity.name}" within current investigative boundaries.`
    };
  }

  // Reconstruct path
  const pathNodeIds: string[] = [];
  const pathRels: Relationship[] = [];
  let curr = targetId;

  while (curr !== sourceId) {
    pathNodeIds.unshift(curr);
    const p = parent.get(curr)!;
    pathRels.unshift(p.rel);
    curr = p.prevNodeId;
  }
  pathNodeIds.unshift(sourceId);

  const pathNodes = pathNodeIds.map(id => entityMap.get(id)!).filter(Boolean);
  const pathDetails = pathRels.map((r, idx) => {
    const s = entityMap.get(r.source)!;
    const t = entityMap.get(r.target)!;
    return {
      source: s,
      target: t,
      relationType: r.relationType,
      evidenceId: r.evidenceId,
      description: `${s.name} [${s.type.toUpperCase()}] --(${r.relationType})--> ${t.name} [${t.type.toUpperCase()}]${r.evidenceId ? ` (Ref: ${r.evidenceId})` : ''}`
    };
  });

  const explanation = `Discovered ${pathRels.length}-hop connection chain: ${pathNodes.map(n => `[${n.name} - ${n.type}]`).join(' ➔ ')}. Validated with ${pathRels.filter(r => r.evidenceId).length} verified evidence references.`;

  return {
    sourceId,
    targetId,
    found: true,
    hopCount: pathRels.length,
    pathNodes,
    pathRelationships: pathDetails,
    explanation
  };
}

export function filterNetworkHops(
  centerEntityId: string,
  maxHops: number,
  entities: Entity[],
  relationships: Relationship[]
): { entities: Entity[]; relationships: Relationship[] } {
  if (maxHops <= 0 || !centerEntityId) {
    return { entities, relationships };
  }

  const adj = new Map<string, string[]>();
  entities.forEach(e => adj.set(e.id, []));
  relationships.forEach(r => {
    adj.get(r.source)?.push(r.target);
    adj.get(r.target)?.push(r.source);
  });

  const reachable = new Map<string, number>(); // entityId -> hop distance
  reachable.set(centerEntityId, 0);
  const queue: Array<{ id: string; hop: number }> = [{ id: centerEntityId, hop: 0 }];

  while (queue.length > 0) {
    const { id, hop } = queue.shift()!;
    if (hop < maxHops) {
      const nbrs = adj.get(id) || [];
      for (const nbr of nbrs) {
        if (!reachable.has(nbr)) {
          reachable.set(nbr, hop + 1);
          queue.push({ id: nbr, hop: hop + 1 });
        }
      }
    }
  }

  const filteredEntities = entities.filter(e => reachable.has(e.id));
  const filteredRelationships = relationships.filter(r => reachable.has(r.source) && reachable.has(r.target));

  return {
    entities: filteredEntities,
    relationships: filteredRelationships
  };
}

export function calculateDegreeCentrality(entities: Entity[], relationships: Relationship[]): Map<string, number> {
  const map = new Map<string, number>();
  entities.forEach(e => map.set(e.id, 0));
  relationships.forEach(r => {
    map.set(r.source, (map.get(r.source) || 0) + 1);
    map.set(r.target, (map.get(r.target) || 0) + 1);
  });
  return map;
}

export function calculateBetweennessCentrality(entities: Entity[], relationships: Relationship[]): Map<string, number> {
  const analytics = computeGraphAnalytics(entities, relationships);
  const map = new Map<string, number>();
  entities.forEach(e => {
    map.set(e.id, analytics.centralityScores[e.id]?.betweenness || 0);
  });
  return map;
}

export function detectCommunities(entities: Entity[], relationships: Relationship[]): Map<string, number> {
  const analytics = computeGraphAnalytics(entities, relationships);
  const map = new Map<string, number>();
  analytics.nodes.forEach(n => {
    map.set(n.id, n.community || 0);
  });
  return map;
}

export function findShortestPathWithEvidence(
  entities: Entity[],
  relationships: Relationship[],
  sourceId: string,
  targetId: string
): { pathNodeIds: string[]; pathLinks: Relationship[] } | null {
  const res = findEvidenceSupportedPath(sourceId, targetId, entities, relationships);
  if (!res.found || res.pathNodes.length === 0) {
    return null;
  }
  const entityMap = new Map(entities.map(e => [e.id, e]));
  const pathNodeIds = res.pathNodes.map(n => n.id);
  const pathLinks: Relationship[] = [];
  for (let i = 0; i < pathNodeIds.length - 1; i++) {
    const s = pathNodeIds[i];
    const t = pathNodeIds[i + 1];
    const rel = relationships.find(
      r => (r.source === s && r.target === t) || (r.source === t && r.target === s)
    );
    if (rel) {
      pathLinks.push(rel);
    }
  }
  return {
    pathNodeIds,
    pathLinks
  };
}

