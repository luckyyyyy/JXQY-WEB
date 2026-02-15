/**
 * Snow - 雪效果系统（改进版）
 * 基于JxqyHD/Engine/Weather/Snow.cs
 *
 * 改进点：
 * - 两层纵深（远景小像素 + 近景大柔和雪花）
 * - 雪花横向摆动，模拟真实飘落
 * - 近景大雪花带径向渐变，有体积感
 * - 更自然的密度分布
 */
import type { Renderer } from "../renderer/renderer";
import { clearSnowTextureCache, SnowFlake, type SnowFlakeType } from "./snowflake";

// 雪花生成间隔（毫秒）
const INTERVAL_MILLISECONDS = 300;

// 雪花基础速度（像素/秒）
const BASE_SPEED = 100;

export class Snow {
  /** 雪花列表 */
  private snowFlakes: SnowFlake[] = [];

  /** 是否正在下雪 */
  private _isSnowing: boolean = false;

  /** 累计时间 */
  private elapsedMilliSeconds: number = 0;

  /** 屏幕尺寸 */
  private windowWidth: number = 800;
  private windowHeight: number = 600;

  get isSnowing(): boolean {
    return this._isSnowing;
  }

  /**
   * 设置屏幕尺寸
   */
  setWindowSize(width: number, height: number): void {
    this.windowWidth = width;
    this.windowHeight = height;
  }

  /**
   * 生成一排雪花（混合小型像素和大型柔和）
   */
  private generateSnowFlakes(cameraX: number, cameraY: number): void {
    // 远景小雪花（像素风格），间距较密
    for (let i = 0; i < this.windowWidth; i += 40) {
      const dirX = Math.random() * 20 - 10;
      const direction = { x: dirX, y: 10 };
      const speedMultiplier = Math.floor(Math.random() * 3) + 1;
      const velocity = BASE_SPEED * speedMultiplier;

      // 0-3: 小型像素雪花
      const type = Math.floor(Math.random() * 4) as SnowFlakeType;
      const snowFlake = new SnowFlake({ x: i + cameraX, y: cameraY }, direction, velocity, type);
      this.snowFlakes.push(snowFlake);
    }

    // 近景大雪花（柔和渐变），间距较稀
    for (let i = 0; i < this.windowWidth; i += 120) {
      if (Math.random() < 0.4) continue; // 随机跳过，避免太规律

      const dirX = Math.random() * 14 - 7;
      const direction = { x: dirX, y: 10 };
      // 大雪花更慢
      const velocity = BASE_SPEED * (0.6 + Math.random() * 1.2);

      // 4-5: 大型柔和雪花
      const type = (Math.random() < 0.6 ? 4 : 5) as SnowFlakeType;
      const snowFlake = new SnowFlake(
        { x: i + cameraX + Math.random() * 60, y: cameraY - Math.random() * 30 },
        direction,
        velocity,
        type
      );
      this.snowFlakes.push(snowFlake);
    }
  }

  /**
   * 显示/隐藏雪效果
   */
  show(isShow: boolean): void {
    this.snowFlakes = [];
    this._isSnowing = isShow;
    if (!isShow) {
      clearSnowTextureCache();
    }
  }

  /**
   * 更新雪效果
   * @param deltaTime 时间差（秒）
   * @param cameraX 相机 X 位置
   * @param cameraY 相机 Y 位置
   */
  update(deltaTime: number, cameraX: number, cameraY: number): void {
    if (!this._isSnowing) return;

    // 定时生成新雪花
    this.elapsedMilliSeconds += deltaTime * 1000;
    if (this.elapsedMilliSeconds >= INTERVAL_MILLISECONDS) {
      this.elapsedMilliSeconds = 0;
      this.generateSnowFlakes(cameraX, cameraY);
    }

    const xBound = this.windowWidth;
    const yBound = this.windowHeight;

    // 更新所有雪花，原地移除飘出屏幕的（swap-and-pop 避免每帧分配新数组）
    for (let i = this.snowFlakes.length - 1; i >= 0; i--) {
      const snowFlake = this.snowFlakes[i];
      snowFlake.update(deltaTime);

      // 检查是否飘出屏幕（Y 方向移动超过屏幕高度）
      if (snowFlake.movedYDistance >= yBound) {
        const last = this.snowFlakes.length - 1;
        if (i !== last) this.snowFlakes[i] = this.snowFlakes[last];
        this.snowFlakes.pop();
        continue;
      }

      // 屏幕边界循环处理
      let screenX = snowFlake.positionInWorld.x - cameraX;
      let screenY = snowFlake.positionInWorld.y - cameraY;

      if (screenX > xBound) {
        screenX = screenX % xBound;
      } else if (screenX < 0) {
        screenX = (screenX % xBound) + xBound;
      }

      if (screenY > yBound) {
        screenY = screenY % yBound;
      } else if (screenY < 0) {
        screenY = (screenY % yBound) + yBound;
      }

      snowFlake.positionInWorld.x = screenX + cameraX;
      snowFlake.positionInWorld.y = screenY + cameraY;
    }
  }

  /**
   * 绘制雪效果
   */
  draw(renderer: Renderer, cameraX: number, cameraY: number): void {
    if (!this._isSnowing || this.snowFlakes.length === 0) return;

    const color = "white";

    for (const snowFlake of this.snowFlakes) {
      snowFlake.draw(renderer, cameraX, cameraY, color);
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.snowFlakes = [];
    clearSnowTextureCache();
  }
}
