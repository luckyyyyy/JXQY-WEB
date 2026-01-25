/**
 * Obj Renderer - Handles rendering of interactive objects
 * Updated to use ASF-based rendering matching C#'s Sprite.Draw
 */
import type { ObjData, ObjKind } from "./obj/objManager";
import type { Camera } from "./types";
import { tileToPixel } from "./core/utils";
import { getFrameCanvas } from "./asf";

export class ObjRenderer {
  /**
   * Draw a single object
   */
  drawObj(
    ctx: CanvasRenderingContext2D,
    obj: ObjData,
    cameraX: number,
    cameraY: number
  ): void {
    // Skip invisible/removed objects or those without ASF
    if (!obj.isVisible || obj.isRemoved || !obj.asf) return;

    // Calculate world pixel position from tile position
    const pixelPos = tileToPixel(obj.tilePosition.x, obj.tilePosition.y);

    // C# draws at: PositionInWorld.X - Texture.Left + OffX, PositionInWorld.Y - Texture.Bottom + OffY
    const screenX = pixelPos.x - obj.asf.left + obj.offX - cameraX;
    const screenY = pixelPos.y - obj.asf.bottom + obj.offY - cameraY;

    // Get the frame
    const framesPerDir = obj.asf.framesPerDirection;
    const dir = Math.min(obj.direction, Math.max(0, obj.asf.directions - 1));
    const frameIndex = dir * framesPerDir + (obj.currentFrame % framesPerDir);

    if (frameIndex >= 0 && frameIndex < obj.asf.frames.length) {
      const frame = obj.asf.frames[frameIndex];
      const canvas = getFrameCanvas(frame);
      ctx.drawImage(canvas, screenX, screenY);
    }
  }

  /**
   * Draw all objects in view
   */
  drawAllObjs(
    ctx: CanvasRenderingContext2D,
    objs: ObjData[],
    camera: Camera
  ): void {
    // Sort by Y position for proper layering (objects lower on screen drawn last)
    const sorted = [...objs].sort((a, b) => {
      const aY = tileToPixel(a.tilePosition.x, a.tilePosition.y).y;
      const bY = tileToPixel(b.tilePosition.x, b.tilePosition.y).y;
      return aY - bY;
    });

    // Draw each object
    for (const obj of sorted) {
      this.drawObj(ctx, obj, camera.x, camera.y);
    }
  }

  /**
   * Clear all cached textures (no longer needed with ASF-based approach)
   */
  clearCache(): void {
    // No longer needed - ASF cache is managed by ObjManager
  }
}

// Singleton instance
let objRendererInstance: ObjRenderer | null = null;

export function getObjRenderer(): ObjRenderer {
  if (!objRendererInstance) {
    objRendererInstance = new ObjRenderer();
  }
  return objRendererInstance;
}

export function resetObjRenderer(): void {
  objRendererInstance = null;
}
