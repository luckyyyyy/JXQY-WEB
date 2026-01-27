/**
 * Obj Renderer - Handles rendering of interactive objects
 * Updated to use ASF-based rendering matching C#'s Sprite.Draw
 *
 * Enhanced with highlight support for interaction:
 * - C# Reference: Globals.OutEdgeObj, OutEdgeColor
 * - C# Reference: TextureGenerator.GetOuterEdge - 边缘检测算法
 * - When mouse hovers over interactive object, draw colored edge
 *
 * 重要：高亮边缘应在所有内容绘制完成后单独绘制（在最高层）
 */
import type { Obj } from "./obj";
import type { Camera } from "../core/mapTypes";
import { tileToPixel } from "../core/utils";
import { getFrameCanvas } from "../sprite/asf";
import { getOuterEdge } from "../utils/edgeDetection";

export class ObjRenderer {
  /**
   * Draw a single object (without highlight - highlight is drawn separately on top layer)
   * @param isHighlighted If true, prepare for highlight but don't draw edge here
   * @param highlightColor Edge color for highlight (used in separate draw call)
   */
  drawObj(
    ctx: CanvasRenderingContext2D,
    obj: Obj,
    cameraX: number,
    cameraY: number,
    isHighlighted: boolean = false,
    highlightColor: string = "rgba(255, 255, 0, 0.6)"
  ): void {
    // Skip invisible/removed objects or those without texture
    if (!obj.isShow || obj.isRemoved || !obj.texture) return;

    // Calculate world pixel position from tile position
    const pixelPos = tileToPixel(obj.tilePosition.x, obj.tilePosition.y);

    // C# draws at: PositionInWorld.X - Texture.Left + OffX, PositionInWorld.Y - Texture.Bottom + OffY
    const screenX = pixelPos.x - obj.texture.left + obj.offX - cameraX;
    const screenY = pixelPos.y - obj.texture.bottom + obj.offY - cameraY;

    // Get the frame
    // Handle case where framesPerDirection is 0 (single frame shared across directions)
    const framesPerDir = obj.texture.framesPerDirection || 1;
    const dir = Math.min(obj.currentDirection, Math.max(0, obj.texture.directions - 1));
    const frameIndex = Math.min(
      dir * framesPerDir + (obj.currentFrameIndex % framesPerDir),
      obj.texture.frames.length - 1
    );

    if (frameIndex >= 0 && frameIndex < obj.texture.frames.length) {
      const frame = obj.texture.frames[frameIndex];
      const canvas = getFrameCanvas(frame);

      // 注意：不在这里绘制高亮边缘
      // 高亮边缘应该在所有内容渲染完后由 drawObjHighlight 单独绘制

      ctx.drawImage(canvas, screenX, screenY);
    }
  }

  /**
   * Draw highlight edge for an object (called separately to ensure it's on top layer)
   * C# Reference: Player.Draw 末尾绘制 OutEdgeSprite
   * C# Reference: TextureGenerator.GetOuterEdge - 边缘检测算法
   */
  drawObjHighlight(
    ctx: CanvasRenderingContext2D,
    obj: Obj,
    cameraX: number,
    cameraY: number,
    highlightColor: string = "rgba(255, 255, 0, 0.6)"
  ): void {
    // Skip invisible/removed objects or those without texture
    if (!obj.isShow || obj.isRemoved || !obj.texture) return;

    // Calculate world pixel position from tile position
    const pixelPos = tileToPixel(obj.tilePosition.x, obj.tilePosition.y);

    // C# draws at: PositionInWorld.X - Texture.Left + OffX, PositionInWorld.Y - Texture.Bottom + OffY
    const screenX = pixelPos.x - obj.texture.left + obj.offX - cameraX;
    const screenY = pixelPos.y - obj.texture.bottom + obj.offY - cameraY;

    // Get the frame
    const framesPerDir = obj.texture.framesPerDirection || 1;
    const dir = Math.min(obj.currentDirection, Math.max(0, obj.texture.directions - 1));
    const frameIndex = Math.min(
      dir * framesPerDir + (obj.currentFrameIndex % framesPerDir),
      obj.texture.frames.length - 1
    );

    if (frameIndex >= 0 && frameIndex < obj.texture.frames.length) {
      const frame = obj.texture.frames[frameIndex];
      const canvas = getFrameCanvas(frame);

      // 使用边缘检测生成边缘纹理（C# GetOuterEdge算法）
      const edgeCanvas = getOuterEdge(canvas, highlightColor);

      // 绘制边缘
      ctx.drawImage(edgeCanvas, screenX, screenY);
    }
  }

  /**
   * Draw all objects in view
   */
  drawAllObjs(
    ctx: CanvasRenderingContext2D,
    objs: Obj[],
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
