import { describe, it, expect } from "vitest";
import { getNeighbors } from "../../src/utils/neighbors";

describe("getNeighbors", () => {
  it("returns 8 neighbors", () => {
    expect(getNeighbors({ x: 5, y: 4 })).toHaveLength(8);
  });

  it("even row: South is (x, y+2)", () => {
    const neighbors = getNeighbors({ x: 3, y: 4 });
    expect(neighbors[0]).toEqual({ x: 3, y: 6 }); // South
  });

  it("even row: North is (x, y-2)", () => {
    const neighbors = getNeighbors({ x: 3, y: 4 });
    expect(neighbors[4]).toEqual({ x: 3, y: 2 }); // North
  });

  it("even row: West is (x-1, y)", () => {
    const neighbors = getNeighbors({ x: 3, y: 4 });
    expect(neighbors[2]).toEqual({ x: 2, y: 4 }); // West
  });

  it("even row: East is (x+1, y)", () => {
    const neighbors = getNeighbors({ x: 3, y: 4 });
    expect(neighbors[6]).toEqual({ x: 4, y: 4 }); // East
  });

  it("odd row: has different diagonal offsets than even row", () => {
    const evenNeighbors = getNeighbors({ x: 3, y: 4 });
    const oddNeighbors = getNeighbors({ x: 3, y: 5 });
    // SouthWest differs: even (x-1, y+1) vs odd (x, y+1)
    expect(evenNeighbors[1]).toEqual({ x: 2, y: 5 }); // even SouthWest
    expect(oddNeighbors[1]).toEqual({ x: 3, y: 6 }); // odd SouthWest
  });

  it("odd row: SouthEast is (x+1, y+1)", () => {
    const neighbors = getNeighbors({ x: 3, y: 5 });
    expect(neighbors[7]).toEqual({ x: 4, y: 6 });
  });

  it("odd row: NorthEast is (x+1, y-1)", () => {
    const neighbors = getNeighbors({ x: 3, y: 5 });
    expect(neighbors[5]).toEqual({ x: 4, y: 4 });
  });

  it("even and odd rows share same South and North", () => {
    const even = getNeighbors({ x: 3, y: 4 });
    const odd = getNeighbors({ x: 3, y: 5 });
    // South: both (x, y+2)
    expect(even[0]).toEqual({ x: 3, y: 6 });
    expect(odd[0]).toEqual({ x: 3, y: 7 });
    // North: both (x, y-2)
    expect(even[4]).toEqual({ x: 3, y: 2 });
    expect(odd[4]).toEqual({ x: 3, y: 3 });
  });
});
