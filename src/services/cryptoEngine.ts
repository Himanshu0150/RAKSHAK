/**
 * C3PL — Cryptographic Chain of Custody & Evidence Integrity Engine
 * Provides SHA-256 hashing, Merkle Tree construction, proof verification,
 * and tamper detection simulation.
 */

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  isLeaf?: boolean;
  leafIndex?: number;
  evidenceId?: string;
  isCorrupted?: boolean;
}

export interface MerkleTree {
  rootHash: string;
  leaves: string[];
  evidenceMap: Record<string, string>; // evidenceId -> leafHash
  depth: number;
  totalLeaves: number;
  treeRootNode: MerkleNode | null;
}

export async function computeSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function syncHashPlaceholder(text: string): string {
  // Simple fast deterministic fallback for immediate UI rendering before async resolution
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `sha256_${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}`.substring(0, 64);
}

export async function buildMerkleTree(evidenceItems: Array<{ id: string; rawPayload: string; tampered?: boolean; tamperedHash?: string }>): Promise<MerkleTree> {
  if (evidenceItems.length === 0) {
    const emptyHash = await computeSHA256('EMPTY_EVIDENCE_TREE');
    return {
      rootHash: emptyHash,
      leaves: [],
      evidenceMap: {},
      depth: 0,
      totalLeaves: 0,
      treeRootNode: null
    };
  }

  const leafNodes: MerkleNode[] = [];
  const evidenceMap: Record<string, string> = {};
  const leafHashes: string[] = [];

  for (let i = 0; i < evidenceItems.length; i++) {
    const item = evidenceItems[i];
    let hash: string;
    if (item.tampered && item.tamperedHash) {
      hash = item.tamperedHash;
    } else {
      hash = await computeSHA256(item.rawPayload);
    }
    
    evidenceMap[item.id] = hash;
    leafHashes.push(hash);
    leafNodes.push({
      hash,
      isLeaf: true,
      leafIndex: i,
      evidenceId: item.id,
      isCorrupted: !!item.tampered
    });
  }

  // Build tree bottom-up
  let currentLevel = [...leafNodes];
  let depth = 1;

  while (currentLevel.length > 1) {
    const nextLevel: MerkleNode[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : left;
      const combined = left.hash + right.hash;
      const parentHash = await computeSHA256(combined);
      const isCorrupted = left.isCorrupted || right.isCorrupted;

      nextLevel.push({
        hash: parentHash,
        left,
        right: (i + 1 < currentLevel.length) ? right : undefined,
        isCorrupted
      });
    }
    currentLevel = nextLevel;
    depth++;
  }

  const rootNode = currentLevel[0] || null;

  return {
    rootHash: rootNode ? rootNode.hash : '',
    leaves: leafHashes,
    evidenceMap,
    depth,
    totalLeaves: leafNodes.length,
    treeRootNode: rootNode
  };
}

export function generateCustodyChainHash(prevHash: string, eventDetails: string): string {
  // Sync simulation of block hash chaining
  let combined = prevHash + ":" + eventDetails;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `c3pl_${hex}${hex}${hex}${hex}`.substring(0, 64);
}
