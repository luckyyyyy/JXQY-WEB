import { describe, it, expect } from "vitest";
import { tileToPixel, pixelToTile } from "../../src/utils/coordinate";

describe("tileToPixel", () => {
  it("converts origin tile (0,0) correctly", () => {
    const result = tileToPixel(0, 0);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("converts even-row tile correctly", () => {
    const result = tileToPixel(1, 0);
    // TILE_WIDTH = 64, so baseX = 0 + 64*1, baseY = 0
    expect(result.x).toBe(64);
    expect(result.y).toBe(0);
  });

  it("handles odd-row offset (staggered isometric)", () => {
    const result = tileToPixel(0, 1);
    // baseX = (1%2)*32 + 64*0 = 32, baseY = 16*1 = 16
    expect(result.x).toBe(32);
    expect(result.y).toBe(16);
  });

  it("converts tile (2, 3) correctly", () => {
    const result = tileToPixel(2, 3);
    // baseX = (3%2)*32 + 64*2 = 32 + 128 = 160, baseY = 16*3 = 48
    expect(result.x).toBe(160);
    expect(result.y).toBe(48);
  });

  it("converts tile (1, 2) even row correctly", () => {
    const result = tileToPixel(1, 2);
    // baseX = (2%2)*32 + 64*1 = 0 + 64 = 64, baseY = 16*2 = 32
    expect(result.x).toBe(64);
    expect(result.y).toBe(32);
  });
});

describe("pixelToTile", () => {
  it("handles negative coordinates", () => {
    const result = pixelToTile(-1, -1);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("converts pixel at tile center (0,1)", () => {
    // pixelToTile(32,16): nx=0, ny=1, dx=32, dy=16 → no adjustment
    const tile = pixelToTile(32, 16);
    expect(tile.x).toBe(0);
    expect(tile.y).toBe(1);
  });

  it("converts pixel at origin tile", () => {
    // pixelToTile(0,0): nx=0, ny=1, dx=0, dy=0 → ny-- → ny=0
    const tile = pixelToTile(0, 0);
    expect(tile.x).toBe(0);
    expect(tile.y).toBe(0);
  });
});
