/**
 * Magic Renderer - 武功渲染器
 * MagicManager rendering
 * 负责将武功精灵渲染到 Canvas
 */

import { ResourcePath, isResourcePath } from "../resource/resource-paths";
import { logger } from "../core/logger";
import type { AsfData } from "../resource/format/asf";
import { getFrameAtlasInfo, loadAsf } from "../resource/format/asf";
import { getDirectionIndex } from "../utils/direction";
import type { IRenderer } from "../renderer/i-renderer";
import type { MagicSprite } from "./magic-sprite";

/**
 * 武功精灵缓存
 */
interface CachedMagicAsf {
  asf: AsfData;
  totalFrames: number;
  framesPerDirection: number; // 每方向帧数 (来自 ASF)
  interval: number; // 帧间隔 (来自 ASF，毫秒)
  frameWidth: number;
  frameHeight: number;
}

/**
 * 武功渲染器
 */
export class MagicRenderer {
  private asfCache: Map<string, CachedMagicAsf | null> = new Map();
  // 改为存储加载 Promise，实现去重
  private loadingPromises: Map<string, Promise<CachedMagicAsf | null>> = new Map();

  /**
   * 同步获取已缓存的 ASF（渲染时使用）
   * 如果还没加载完成，返回 null，不会触发加载
   */
  getCachedAsf(asfPath: string): CachedMagicAsf | null {
    return this.asfCache.get(asfPath) ?? null;
  }

  /**
   * 预加载 ASF（创建精灵时调用，异步加载不阻塞）
   */
  preloadAsf(asfPath: string): void {
    // 已缓存或正在加载，跳过
    if (this.asfCache.has(asfPath) || this.loadingPromises.has(asfPath)) {
      return;
    }
    // 触发异步加载（不等待）
    this.getAsf(asfPath);
  }

  /**
   * 获取或加载 ASF 精灵（异步）
   * 使用 Promise 去重，确保同一个 ASF 不会被加载多次
   */
  async getAsf(asfPath: string): Promise<CachedMagicAsf | null> {
    // 检查缓存
    if (this.asfCache.has(asfPath)) {
      return this.asfCache.get(asfPath) || null;
    }

    // 检查是否正在加载 - 如果是，返回相同的 Promise
    const existingPromise = this.loadingPromises.get(asfPath);
    if (existingPromise) {
      return existingPromise;
    }

    // 创建加载 Promise 并存储
    const loadPromise = this._loadAsfInternal(asfPath);
    this.loadingPromises.set(asfPath, loadPromise);

    const result = await loadPromise;
    this.loadingPromises.delete(asfPath);
    return result;
  }

  /**
   * 内部加载 ASF 的实际实现
   */
  private async _loadAsfInternal(asfPath: string): Promise<CachedMagicAsf | null> {
    try {
      // asfPath 可能是以下格式:
      // 1. "/game/xxx/resources/asf/effect/xxx.asf" - 已解析的完整资源路径
      // 2. "asf/effect/xxx.asf" - 完整相对路径
      // 3. "xxx.asf" - 仅文件名
      // 构建可能的路径列表
      const possiblePaths: string[] = [];

      if (isResourcePath(asfPath)) {
        // 已经是完整的资源路径，直接使用
        possiblePaths.push(asfPath);
      } else if (asfPath.startsWith("asf/")) {
        // 已经是完整相对路径
        possiblePaths.push(ResourcePath.from(asfPath));
      } else {
        // 仅文件名，尝试多个目录
        possiblePaths.push(ResourcePath.asfEffect(asfPath));
        possiblePaths.push(ResourcePath.asfMagic(asfPath));
        possiblePaths.push(ResourcePath.asfRoot(asfPath));
      }

      let asfData = null;
      for (const path of possiblePaths) {
        asfData = await loadAsf(path);
        if (asfData) {
          break;
        }
      }

      if (asfData) {
        const cached: CachedMagicAsf = {
          asf: asfData,
          totalFrames: asfData.frameCount || 1,
          framesPerDirection: asfData.framesPerDirection || 1,
          interval: asfData.interval, // 保留原始值
          frameWidth: asfData.width || 64,
          frameHeight: asfData.height || 64,
        };
        this.asfCache.set(asfPath, cached);
        return cached;
      }
    } catch (error) {
      logger.warn(`[MagicRenderer] Failed to load ASF: ${asfPath}`, error);
    }

    logger.warn(`[MagicRenderer] ASF not found: ${asfPath}`);
    this.asfCache.set(asfPath, null);
    return null;
  }

  /**
   * 渲染武功精灵
   */
  render(
    renderer: IRenderer,
    sprite: MagicSprite,
    cameraX: number,
    cameraY: number
  ): void {
    if (sprite.isDestroyed) return;

    // SuperMode 特殊处理
    // if (BelongMagic.MoveKind == 15 && IsInDestroy) {
    //     foreach (var sprite in _superModeDestroySprites) sprite.Draw(spriteBatch, color);
    // }
    // base.Draw(spriteBatch, color); <- 也调用了 base.Draw
    if (sprite.isSuperMode && sprite.isInDestroy) {
      // SuperMode 销毁状态：渲染所有特效精灵
      for (const effectSprite of sprite.superModeDestroySprites) {
        this.renderSingleSprite(renderer, effectSprite, cameraX, cameraY);
      }
      // 调用完 superModeDestroySprites 后也调用 base.Draw
      // 但因为 flyingAsfPath 已被清除（Texture = null），base.Draw 实际不会绘制任何东西
      // 这里为了完全一致，我们也尝试渲染主精灵（会因为 asfPath 为空而跳过）
      this.renderSingleSprite(renderer, sprite, cameraX, cameraY);
      return;
    }

    // 普通渲染
    this.renderSingleSprite(renderer, sprite, cameraX, cameraY);
  }

  /**
   * 渲染单个精灵（内部方法）
   */
  private renderSingleSprite(
    renderer: IRenderer,
    sprite: MagicSprite,
    cameraX: number,
    cameraY: number
  ): void {
    if (sprite.isDestroyed) return;

    // 计算屏幕位置
    const screenX = sprite.position.x - cameraX;
    const screenY = sprite.position.y - cameraY;

    // 屏幕外裁剪
    if (
      screenX < -100 ||
      screenX > renderer.width + 100 ||
      screenY < -100 ||
      screenY > renderer.height + 100
    ) {
      return;
    }

    // 获取当前使用的 ASF 路径
    const asfPath = sprite.isInDestroy
      ? sprite.vanishAsfPath || sprite.magic.vanishImage
      : sprite.flyingAsfPath || sprite.magic.flyingImage;

    if (!asfPath) {
      // 没有图像（如普通攻击），跳过渲染
      // 中使用 Asf.Empty 代表空精灵，不绘制任何东西
      return;
    }

    // 尝试获取缓存的 ASF（同步，不触发加载）
    const cached = this.getCachedAsf(asfPath);

    if (cached === null) {
      // 还没加载完成或加载失败，绘制占位符
      this.renderPlaceholder(renderer, screenX, screenY, sprite);
      return;
    }

    // 计算当前帧
    // 中根据方向索引和帧计算总帧号
    // 通常格式是 directionCount * framesPerDirection + frameIndex
    // 使用 ASF 的 framesPerDirection（来自文件头）
    const asfFramesPerDirection = cached.framesPerDirection;
    const asfInterval = cached.interval;
    const asfDirections = cached.asf.directions || 1;

    // 根据 ASF 的实际方向数量重新计算方向索引
    // Reference: SetDirection(Vector2) -> Utils.GetDirectionIndex(direction, Texture.DirectionCounts)
    // 中每次设置 Texture 或调用 SetDirection 时都会用纹理的方向数重新计算
    const effectiveDirectionIndex = getDirectionIndex(sprite.direction, asfDirections);

    // 更新精灵的帧信息（根据当前状态：飞行或消失）
    // Reference: MagicSprite.ResetPlay() - 设置实际播放帧数
    // setter - 设置 Texture 时也会重置帧间隔
    if (sprite.isInDestroy) {
      // 消失动画：更新 vanishFramesPerDirection、frameInterval 和 leftFrameToPlay
      if (
        sprite.vanishFramesPerDirection !== asfFramesPerDirection ||
        sprite.frameInterval !== asfInterval
      ) {
        // const oldFrameInterval = sprite.frameInterval;
        // const oldLeftFrameToPlay = sprite.leftFrameToPlay;
        sprite.vanishFramesPerDirection = asfFramesPerDirection;
        sprite.frameInterval = asfInterval;
        // 更新 leftFrameToPlay 为实际帧数（替换 startDestroyAnimation 中的占位值）
        sprite.leftFrameToPlay = asfFramesPerDirection;
        // 确保 currentFrameIndex 不超过新的帧数
        if (sprite.currentFrameIndex >= asfFramesPerDirection) {
          sprite.currentFrameIndex = sprite.currentFrameIndex % asfFramesPerDirection;
        }
      }
    } else {
      // 飞行动画：更新 frameCountsPerDirection 和 frameInterval
      if (
        sprite.frameCountsPerDirection !== asfFramesPerDirection ||
        sprite.frameInterval !== asfInterval
      ) {
        sprite.frameCountsPerDirection = asfFramesPerDirection; // 更新帧数
        sprite.frameInterval = asfInterval; // 使用飞行动画的 interval
        // 确保 currentFrameIndex 不超过新的帧数
        if (sprite.currentFrameIndex >= asfFramesPerDirection) {
          sprite.currentFrameIndex = sprite.currentFrameIndex % asfFramesPerDirection;
        }
        // 注意：不重置 leftFrameToPlay，因为 LifeFrame=0 表示无限飞行
        // 让碰撞检测来决定生命结束
      }
    }

    // 使用当前状态对应的每方向帧数来计算帧索引
    // directionFrame 使用转换后的方向索引
    const directionFrame = effectiveDirectionIndex * asfFramesPerDirection;
    // frameInDirection 使用 currentFrameIndex，确保在范围内
    const frameInDirection = sprite.currentFrameIndex % asfFramesPerDirection;
    let frameIndex = directionFrame + frameInDirection;

    // 确保帧索引有效
    if (frameIndex >= cached.totalFrames) {
      frameIndex = frameIndex % cached.totalFrames;
    }

    // 获取帧图像
    const frame = cached.asf.frames[frameIndex];
    if (!frame) {
      this.renderPlaceholder(renderer, screenX, screenY, sprite);
      return;
    }

    // 计算绘制位置
    const drawX = screenX - cached.asf.left;
    const drawY = screenY - cached.asf.bottom;

    // 使用 atlas 绘制（减少纹理切换）
    const atlasInfo = getFrameAtlasInfo(cached.asf, frameIndex);
    renderer.drawSourceEx(atlasInfo.canvas, drawX, drawY, {
      srcX: atlasInfo.srcX,
      srcY: atlasInfo.srcY,
      srcWidth: atlasInfo.srcWidth,
      srcHeight: atlasInfo.srcHeight,
    });
  }

  /**
   * 渲染占位符（当 ASF 未加载或不存在时）
   * 占位符使用 Canvas2D API（text, arc 等），通过 getContext2D 回退
   */
  private renderPlaceholder(
    renderer: IRenderer,
    screenX: number,
    screenY: number,
    sprite: MagicSprite
  ): void {
    const ctx = renderer.getContext2D();
    if (!ctx) return;

    const size = 32;

    // 根据武功类型选择颜色
    let color = "rgba(255, 100, 50, 0.8)"; // 默认火焰色
    const magicName = sprite.magic.name.toLowerCase();
    if (magicName.includes("冰") || magicName.includes("寒")) {
      color = "rgba(100, 200, 255, 0.8)";
    } else if (magicName.includes("雷") || magicName.includes("电")) {
      color = "rgba(255, 255, 100, 0.8)";
    } else if (magicName.includes("毒")) {
      color = "rgba(100, 255, 100, 0.8)";
    }

    // 脉动效果
    const pulse = Math.sin(sprite.elapsedMilliseconds / 100) * 0.3 + 0.7;
    const currentSize = size * pulse;

    ctx.save();

    // 发光效果
    ctx.shadowColor = color;
    ctx.shadowBlur = 20 * pulse;

    // 主体圆形
    ctx.beginPath();
    ctx.arc(screenX, screenY, currentSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // 中心亮点
    ctx.beginPath();
    ctx.arc(screenX, screenY, currentSize / 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();

    // 消失特效时添加爆炸效果
    if (sprite.isInDestroy) {
      const expandSize = currentSize * (1 + sprite.currentFrameIndex / 10);
      ctx.beginPath();
      ctx.arc(screenX, screenY, expandSize, 0, Math.PI * 2);
      ctx.strokeStyle = color.replace("0.8", "0.4");
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 渲染所有武功精灵（供 Game 组件调用）
   */
  renderAll(
    renderer: IRenderer,
    sprites: Map<number, MagicSprite>,
    effectSprites: Map<number, MagicSprite>,
    cameraX: number,
    cameraY: number
  ): void {
    // 先渲染飞行中的武功
    for (const sprite of sprites.values()) {
      this.render(renderer, sprite, cameraX, cameraY);
    }

    // 再渲染特效（消失动画）
    for (const sprite of effectSprites.values()) {
      this.render(renderer, sprite, cameraX, cameraY);
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.asfCache.clear();
    this.loadingPromises.clear();
  }
}
