/**
 * Coordinate conversion utilities for isometric tile map
 * 坐标转换工具 - 等角瓦片地图
 */
import type { Vector2 } from "../core/types";
import { TILE_HEIGHT, TILE_WIDTH } from "../core/types";

/**
 * Convert tile position to pixel position (isometric)
 * 瓦片坐标转像素坐标
 *
 * @param out Optional reusable Vector2 to write into (avoids allocation)
 */
export function tileToPixel(tileX: number, tileY: number, out?: Vector2): Vector2 {
  const baseX = (tileY % 2) * 32 + TILE_WIDTH * tileX;
  const baseY = 16 * tileY;
  if (out) {
    out.x = baseX;
    out.y = baseY;
    return out;
  }
  return { x: baseX, y: baseY };
}

/**
 * Convert pixel position to tile position (isometric)
 * 像素坐标转瓦片坐标
 *
 * @param out Optional reusable Vector2 to write into (avoids allocation)
 */
export function pixelToTile(pixelX: number, pixelY: number, out?: Vector2): Vector2 {
  if (pixelX < 0 || pixelY < 0) {
    if (out) {
      out.x = 0;
      out.y = 0;
      return out;
    }
    return { x: 0, y: 0 };
  }

  let nx = Math.floor(pixelX / TILE_WIDTH);
  let ny = 1 + Math.floor(pixelY / TILE_HEIGHT) * 2;

  // Calculate real position (isometric adjustment)
  const dx = pixelX - nx * TILE_WIDTH;
  const dy = pixelY - Math.floor(ny / 2) * TILE_HEIGHT;

  if (dx < 32) {
    if (dy < (32 - dx) / 2) {
      ny--;
    } else if (dy > dx / 2 + 16) {
      ny++;
    }
  }
  if (dx > 32) {
    if (dy < (dx - 32) / 2) {
      nx++;
      ny--;
    } else if (dy > (64 - dx) / 2 + 16) {
      nx++;
      ny++;
    }
  }

  if (out) {
    out.x = nx;
    out.y = ny;
    return out;
  }
  return { x: nx, y: ny };
}
