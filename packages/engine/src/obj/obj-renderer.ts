/**
 * Obj Renderer - Handles rendering of interactive objects
 * Updated to use ASF-based rendering matching 's Sprite.Draw
 *
 * Enhanced with highlight support for interaction:
 *
 *边缘检测算法
 * - When mouse hovers over interactive object, draw colored edge
 *
 * 重要：高亮边缘应在所有内容绘制完成后单独绘制（在最高层）
 */

import type { Camera } from "../map/types";
import { getFrameAtlasInfo, getFrameCanvas } from "../resource/format/asf";
import { tileToPixel } from "../utils";
import { getOuterEdge } from "../sprite/edge-detection";
import type { IRenderer } from "../renderer/i-renderer";
import type { Obj } from "./obj";

export class ObjRenderer {
  /**
   * Draw a single object (without highlight - highlight is drawn separately on top layer)
   * @param isHighlighted If true, prepare for highlight but don't draw edge here
   * @param highlightColor Edge color for highlight (used in separate draw call)
   */
  drawObj(
    renderer: IRenderer,
    obj: Obj,
    cameraX: number,
    cameraY: number,
    _isHighlighted: boolean = false,
    _highlightColor: string = "rgba(255, 255, 0, 0.6)"
  ): void {
    // Skip invisible/removed objects or those without texture
    if (!obj.isShow || obj.isRemoved || !obj.texture) return;

    // Calculate world pixel position from tile position
    const pixelPos = tileToPixel(obj.tilePosition.x, obj.tilePosition.y);

    // draws at: PositionInWorld.X - Texture.Left + OffX, PositionInWorld.Y - Texture.Bottom + OffY
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
      // 使用 atlas 绘制（减少纹理切换）
      const atlasInfo = getFrameAtlasInfo(obj.texture, frameIndex);
      renderer.drawSourceEx(atlasInfo.canvas, screenX, screenY, {
        srcX: atlasInfo.srcX,
        srcY: atlasInfo.srcY,
        srcWidth: atlasInfo.srcWidth,
        srcHeight: atlasInfo.srcHeight,
      });
    }
  }

  /**
   * Draw highlight edge for an object (called separately to ensure it's on top layer)
   * 末尾绘制 OutEdgeSprite
   * 边缘检测算法
   */
  drawObjHighlight(
    renderer: IRenderer,
    obj: Obj,
    cameraX: number,
    cameraY: number,
    highlightColor: string = "rgba(255, 255, 0, 0.6)"
  ): void {
    // Skip invisible/removed objects or those without texture
    if (!obj.isShow || obj.isRemoved || !obj.texture) return;

    // Calculate world pixel position from tile position
    const pixelPos = tileToPixel(obj.tilePosition.x, obj.tilePosition.y);

    // draws at: PositionInWorld.X - Texture.Left + OffX, PositionInWorld.Y - Texture.Bottom + OffY
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

      // 使用边缘检测生成边缘纹理
      const edgeCanvas = getOuterEdge(canvas, highlightColor);

      // 绘制边缘
      renderer.drawSource(edgeCanvas, screenX, screenY);
    }
  }

  /**
   * Draw all objects in view
   */
  drawAllObjs(renderer: IRenderer, objs: Obj[], camera: Camera): void {
    // Sort by Y position for proper layering (objects lower on screen drawn last)
    const sorted = [...objs].sort((a, b) => {
      const aY = tileToPixel(a.tilePosition.x, a.tilePosition.y).y;
      const bY = tileToPixel(b.tilePosition.x, b.tilePosition.y).y;
      return aY - bY;
    });

    // Draw each object
    for (const obj of sorted) {
      this.drawObj(renderer, obj, camera.x, camera.y);
    }
  }

  /**
   * Clear all cached textures (no longer needed with ASF-based approach)
   */
  clearCache(): void {
    // No longer needed - ASF cache is managed by ObjManager
  }
}
