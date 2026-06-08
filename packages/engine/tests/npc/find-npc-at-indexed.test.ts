/**
 * findNpcAt indexed-vs-scan equivalence tests
 *
 * Verifies that routing tile lookups through the per-frame `tileIndex` returns
 * the exact same NPC (including first-in-Map-order tie-break) as the legacy
 * full-Map scan, for stacked tiles, predicate filtering and empty tiles.
 */
import { describe, expect, it } from "vitest";
import { findNpcAt, npcTileKey, type NpcTileIndex } from "../../src/npc/npc-tile-queries";
import type { Npc } from "../../src/npc/npc";

interface MockNpc {
  id: string;
  mapX: number;
  mapY: number;
  isEnemy: boolean;
}

function mockNpc(id: string, mapX: number, mapY: number, isEnemy = false): MockNpc {
  return { id, mapX, mapY, isEnemy };
}

function buildMap(...npcs: MockNpc[]): Map<string, Npc> {
  const map = new Map<string, Npc>();
  for (const npc of npcs) {
    map.set(npc.id, npc as unknown as Npc);
  }
  return map;
}

/** Mirror of NpcManager.rebuildTileIndex — preserves Map insertion order. */
function buildIndex(npcs: Map<string, Npc>): NpcTileIndex {
  const index = new Map<number, Npc[]>();
  for (const [, npc] of npcs) {
    const key = npcTileKey(npc.mapX, npc.mapY);
    let arr = index.get(key);
    if (!arr) {
      arr = [];
      index.set(key, arr);
    }
    arr.push(npc);
  }
  return index;
}

describe("findNpcAt — indexed vs full-scan equivalence", () => {
  it("returns null for empty tile (both modes)", () => {
    const npcs = buildMap(mockNpc("a", 1, 1), mockNpc("b", 2, 2));
    const index = buildIndex(npcs);
    expect(findNpcAt(npcs, { x: 5, y: 5 })).toBeNull();
    expect(findNpcAt(npcs, { x: 5, y: 5 }, undefined, index)).toBeNull();
  });

  it("returns null when tile bucket is missing in index", () => {
    const npcs = buildMap(mockNpc("a", 1, 1));
    const index = buildIndex(npcs);
    expect(findNpcAt(npcs, { x: 9, y: 9 }, undefined, index)).toBeNull();
  });

  it("returns first-in-Map-order NPC for stacked tile (tie-break preserved)", () => {
    const npcs = buildMap(
      mockNpc("first", 3, 4),
      mockNpc("second", 3, 4),
      mockNpc("third", 3, 4),
      mockNpc("elsewhere", 0, 0)
    );
    const index = buildIndex(npcs);
    const scan = findNpcAt(npcs, { x: 3, y: 4 });
    const indexed = findNpcAt(npcs, { x: 3, y: 4 }, undefined, index);
    expect(scan).not.toBeNull();
    expect(indexed).toBe(scan);
    expect((indexed as unknown as MockNpc).id).toBe("first");
  });

  it("predicate filtering returns identical NPC across modes", () => {
    const npcs = buildMap(
      mockNpc("friendlyA", 7, 7, false),
      mockNpc("enemyA", 7, 7, true),
      mockNpc("enemyB", 7, 7, true)
    );
    const index = buildIndex(npcs);
    const pred = (n: Npc) => (n as unknown as MockNpc).isEnemy;
    const scan = findNpcAt(npcs, { x: 7, y: 7 }, pred);
    const indexed = findNpcAt(npcs, { x: 7, y: 7 }, pred, index);
    expect(scan).not.toBeNull();
    expect(indexed).toBe(scan);
    expect((indexed as unknown as MockNpc).id).toBe("enemyA");
  });

  it("predicate with no matches returns null in both modes", () => {
    const npcs = buildMap(mockNpc("a", 2, 2, false), mockNpc("b", 2, 2, false));
    const index = buildIndex(npcs);
    const pred = (n: Npc) => (n as unknown as MockNpc).isEnemy;
    expect(findNpcAt(npcs, { x: 2, y: 2 }, pred)).toBeNull();
    expect(findNpcAt(npcs, { x: 2, y: 2 }, pred, index)).toBeNull();
  });

  it("npcTileKey is unique per (x, y) in expected tile range", () => {
    const seen = new Set<number>();
    for (let x = 0; x < 32; x++) {
      for (let y = 0; y < 32; y++) {
        const key = npcTileKey(x, y);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});
