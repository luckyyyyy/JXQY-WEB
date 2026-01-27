/**
 * Magic Renderer - 武功渲染器
 * C# Reference: MagicSprite.Draw, MagicManager rendering
 * 负责将武功精灵渲染到 Canvas
 */

import { MagicSprite } from './magicSprite';
import type { AsfData } from '../sprite/asf';
import { loadAsf, getFrameCanvas } from '../sprite/asf';
import { getDirectionIndex } from './magicUtils';

/**
 * 武功精灵缓存
 */
interface CachedMagicAsf {
  asf: AsfData;
  totalFrames: number;
  framesPerDirection: number;  // 每方向帧数 (来自 ASF)
  interval: number;            // 帧间隔 (来自 ASF，毫秒)
  frameWidth: number;
  frameHeight: number;
}

/**
 * 武功渲染器
 */
export class MagicRenderer {
  private asfCache: Map<string, CachedMagicAsf | null> = new Map();
  private loadingAsf: Set<string> = new Set();

  /**
   * 获取或加载 ASF 精灵
   */
  async getAsf(asfPath: string): Promise<CachedMagicAsf | null> {
    // 检查缓存
    if (this.asfCache.has(asfPath)) {
      return this.asfCache.get(asfPath) || null;
    }

    // 检查是否正在加载
    if (this.loadingAsf.has(asfPath)) {
      return null;
    }

    // 开始加载
    this.loadingAsf.add(asfPath);

    try {
      // asfPath 可能是以下格式:
      // 1. "asf/effect/xxx.asf" - 完整相对路径
      // 2. "xxx.asf" - 仅文件名
      // 构建可能的路径列表
      const possiblePaths: string[] = [];

      if (asfPath.startsWith('asf/')) {
        // 已经是完整相对路径
        possiblePaths.push(`/resources/${asfPath}`);
      } else {
        // 仅文件名，尝试多个目录
        possiblePaths.push(`/resources/asf/effect/${asfPath}`);
        possiblePaths.push(`/resources/asf/magic/${asfPath}`);
        possiblePaths.push(`/resources/asf/${asfPath}`);
      }

      let asfData = null;
      for (const path of possiblePaths) {
        asfData = await loadAsf(path);
        if (asfData) {
          console.log(`[MagicRenderer] Loaded ASF from: ${path}`);
          break;
        }
      }

      if (asfData) {
        const cached: CachedMagicAsf = {
          asf: asfData,
          totalFrames: asfData.frameCount || 1,
          framesPerDirection: asfData.framesPerDirection || 1,
          interval: asfData.interval || 50,  // C# 默认值
          frameWidth: asfData.width || 64,
          frameHeight: asfData.height || 64,
        };
        this.asfCache.set(asfPath, cached);
        this.loadingAsf.delete(asfPath);
        return cached;
      }
    } catch (error) {
      console.warn(`[MagicRenderer] Failed to load ASF: ${asfPath}`, error);
    }

    console.warn(`[MagicRenderer] ASF not found: ${asfPath}`);
    this.asfCache.set(asfPath, null);
    this.loadingAsf.delete(asfPath);
    return null;
  }

  /**
   * 渲染武功精灵
   * C# Reference: MagicSprite.Draw
   */
  render(
    ctx: CanvasRenderingContext2D,
    sprite: MagicSprite,
    cameraX: number,
    cameraY: number
  ): void {
    if (sprite.isDestroyed) return;

    // 计算屏幕位置
    const screenX = sprite.position.x - cameraX;
    const screenY = sprite.position.y - cameraY;

    // 首次渲染调试（只打印一次）
    if (!sprite._debugRendered) {
      sprite._debugRendered = true;
      console.log(`[MagicRenderer] First render id=${sprite.id}: world=(${sprite.position.x.toFixed(0)}, ${sprite.position.y.toFixed(0)}), camera=(${cameraX.toFixed(0)}, ${cameraY.toFixed(0)}), screen=(${screenX.toFixed(0)}, ${screenY.toFixed(0)})`);
    }

    // 屏幕外裁剪
    if (
      screenX < -100 ||
      screenX > ctx.canvas.width + 100 ||
      screenY < -100 ||
      screenY > ctx.canvas.height + 100
    ) {
      return;
    }

    // 获取当前使用的 ASF 路径
    const asfPath = sprite.isInDestroy
      ? sprite.vanishAsfPath || sprite.magic.vanishImage
      : sprite.flyingAsfPath || sprite.magic.flyingImage;

    if (!asfPath) {
      // 没有图像，绘制占位符
      this.renderPlaceholder(ctx, screenX, screenY, sprite);
      return;
    }

    // 尝试获取缓存的 ASF
    const cached = this.asfCache.get(asfPath);

    if (cached === undefined) {
      // 还没尝试加载，启动加载
      this.getAsf(asfPath);
      this.renderPlaceholder(ctx, screenX, screenY, sprite);
      return;
    }

    if (cached === null) {
      // 加载失败，绘制占位符
      this.renderPlaceholder(ctx, screenX, screenY, sprite);
      return;
    }

    // 计算当前帧
    // C# 中根据方向索引和帧计算总帧号
    // 通常格式是 directionCount * framesPerDirection + frameIndex
    // 使用 ASF 的 framesPerDirection（来自文件头）
    const asfFramesPerDirection = cached.framesPerDirection;
    const asfInterval = cached.interval;
    const asfDirections = cached.asf.directions || 1;

    // 根据 ASF 的实际方向数量重新计算方向索引
    // C# Reference: SetDirection(Vector2) -> Utils.GetDirectionIndex(direction, Texture.DirectionCounts)
    // C# 中每次设置 Texture 或调用 SetDirection 时都会用纹理的方向数重新计算
    const effectiveDirectionIndex = getDirectionIndex(sprite.direction, asfDirections);

    // 更新精灵的帧信息（根据当前状态：飞行或消失）
    // C# Reference: MagicSprite.ResetPlay() - 设置实际播放帧数
    // C# Reference: Sprite.Texture setter - 设置 Texture 时也会重置帧间隔
    if (sprite.isInDestroy) {
      // 消失动画：更新 vanishFramesPerDirection 和 frameInterval
      if (sprite.vanishFramesPerDirection !== asfFramesPerDirection) {
        sprite.vanishFramesPerDirection = asfFramesPerDirection;
        sprite.frameInterval = asfInterval;  // 使用消失动画的 interval
        // 确保 currentFrame 不超过新的帧数
        if (sprite.currentFrame >= asfFramesPerDirection) {
          sprite.currentFrame = sprite.currentFrame % asfFramesPerDirection;
        }
        console.log(`[MagicRenderer] Updated vanish animation: framesPerDir=${asfFramesPerDirection}, interval=${asfInterval}`);
      }
    } else {
      // 飞行动画：更新 framesPerDirection 和 frameInterval
      if (sprite.framesPerDirection !== asfFramesPerDirection) {
        console.log(`[MagicRenderer] Updating flying animation for ${sprite.magic.name}: framesPerDir ${sprite.framesPerDirection} -> ${asfFramesPerDirection}, interval=${asfInterval}`);
        sprite.framesPerDirection = asfFramesPerDirection;
        sprite.frameInterval = asfInterval;  // 使用飞行动画的 interval
        // 如果 LifeFrame == 0，则播放一轮动画
        if (sprite.magic.lifeFrame === 0) {
          console.log(`[MagicRenderer] LifeFrame=0, setting totalFrames from ${sprite.totalFrames} to ${asfFramesPerDirection}`);
          sprite.totalFrames = asfFramesPerDirection;
        }
        // 确保 currentFrame 不超过新的帧数
        if (sprite.currentFrame >= asfFramesPerDirection) {
          sprite.currentFrame = sprite.currentFrame % asfFramesPerDirection;
        }
      }
    }

    // 使用当前状态对应的每方向帧数来计算帧索引
    // directionFrame 使用转换后的方向索引
    const directionFrame = effectiveDirectionIndex * asfFramesPerDirection;
    // frameInDirection 使用 currentFrame，确保在范围内
    const frameInDirection = sprite.currentFrame % asfFramesPerDirection;
    let frameIndex = directionFrame + frameInDirection;

    // 确保帧索引有效
    if (frameIndex >= cached.totalFrames) {
      frameIndex = frameIndex % cached.totalFrames;
    }

    // 获取帧图像
    const frame = cached.asf.frames[frameIndex];
    if (!frame) {
      this.renderPlaceholder(ctx, screenX, screenY, sprite);
      return;
    }

    // 获取帧的 canvas（会缓存）
    const frameCanvas = getFrameCanvas(frame);

    // 计算绘制位置
    // C# Reference: Sprite.Draw
    // Rectangle des = Globals.TheCarmera.ToViewRegion(new Rectangle(
    //   (int)PositionInWorld.X - Texture.Left + offX,
    //   (int)PositionInWorld.Y - Texture.Bottom + offY,
    //   texture.Width, texture.Height));
    // 注意：ASF 的 left 和 bottom 是锚点偏移量
    const drawX = screenX - cached.asf.left;
    const drawY = screenY - cached.asf.bottom;

    // 绘制帧
    ctx.drawImage(frameCanvas, drawX, drawY);
  }

  /**
   * 渲染占位符（当 ASF 未加载或不存在时）
   */
  private renderPlaceholder(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    sprite: MagicSprite
  ): void {
    const size = 32;

    // 根据武功类型选择颜色
    let color = 'rgba(255, 100, 50, 0.8)'; // 默认火焰色
    const magicName = sprite.magic.name.toLowerCase();
    if (magicName.includes('冰') || magicName.includes('寒')) {
      color = 'rgba(100, 200, 255, 0.8)';
    } else if (magicName.includes('雷') || magicName.includes('电')) {
      color = 'rgba(255, 255, 100, 0.8)';
    } else if (magicName.includes('毒')) {
      color = 'rgba(100, 255, 100, 0.8)';
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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();

    // 消失特效时添加爆炸效果
    if (sprite.isInDestroy) {
      const expandSize = currentSize * (1 + sprite.currentFrame / 10);
      ctx.beginPath();
      ctx.arc(screenX, screenY, expandSize, 0, Math.PI * 2);
      ctx.strokeStyle = color.replace('0.8', '0.4');
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 渲染所有武功精灵（供 Game 组件调用）
   */
  renderAll(
    ctx: CanvasRenderingContext2D,
    sprites: Map<number, MagicSprite>,
    effectSprites: Map<number, MagicSprite>,
    cameraX: number,
    cameraY: number
  ): void {
    // 先渲染飞行中的武功
    for (const sprite of sprites.values()) {
      this.render(ctx, sprite, cameraX, cameraY);
    }

    // 再渲染特效（消失动画）
    for (const sprite of effectSprites.values()) {
      this.render(ctx, sprite, cameraX, cameraY);
    }
  }

  /**
   * 预加载武功资源
   */
  async preloadMagicAssets(magicList: Array<{ flyingImage?: string; vanishImage?: string }>): Promise<void> {
    const paths = new Set<string>();
    for (const magic of magicList) {
      if (magic.flyingImage) paths.add(magic.flyingImage);
      if (magic.vanishImage) paths.add(magic.vanishImage);
    }

    const promises = Array.from(paths).map((path) => this.getAsf(path));
    await Promise.all(promises);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.asfCache.clear();
    this.loadingAsf.clear();
  }
}

// 单例
export const magicRenderer = new MagicRenderer();
