/**
 * Snow - 雪效果系统
 * 基于 C# JxqyHD/Engine/Weather/Snow.cs
 *
 * 特性：
 * - 从屏幕顶部生成雪花
 * - 雪花带有随机方向和速度
 * - 屏幕边界循环（雪花飘出边界时从另一侧进入）
 */
import { SnowFlake, type SnowFlakeType } from "./snowflake";

// 雪花生成间隔（毫秒）
const INTERVAL_MILLISECONDS = 300;

// 雪花基础速度（像素/秒）
const BASE_SPEED = 100;

export class Snow {
  /** 雪花链表 */
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
   * 生成一排雪花
   * C#: GenerateSnowFlakes
   */
  private generateSnowFlakes(cameraX: number, cameraY: number): void {
    // 在屏幕顶部生成雪花，水平间距 50 像素
    for (let i = 0; i < this.windowWidth; i += 50) {
      // 随机方向：X 分量 -10 到 10，Y 分量固定为 10（向下）
      const dirX = Math.random() * 20 - 10;
      const direction = { x: dirX, y: 10 };

      // 随机速度：1-3 倍基础速度
      const speedMultiplier = Math.floor(Math.random() * 3) + 1;
      const velocity = BASE_SPEED * speedMultiplier;

      // 随机雪花类型
      const type = Math.floor(Math.random() * 4) as SnowFlakeType;

      const snowFlake = new SnowFlake({ x: i + cameraX, y: cameraY }, direction, velocity, type);

      this.snowFlakes.push(snowFlake);
    }
  }

  /**
   * 显示/隐藏雪效果
   * C#: Show(bool isShow)
   */
  show(isShow: boolean): void {
    this.snowFlakes = [];
    this._isSnowing = isShow;
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

    // 更新所有雪花，移除飘出屏幕的
    const remainingFlakes: SnowFlake[] = [];

    for (const snowFlake of this.snowFlakes) {
      snowFlake.update(deltaTime);

      // 检查是否飘出屏幕（Y 方向移动超过屏幕高度）
      if (snowFlake.movedYDistance >= yBound) {
        // 移除这个雪花
        continue;
      }

      // 屏幕边界循环处理
      // 将世界坐标转换为屏幕坐标
      let screenX = snowFlake.positionInWorld.x - cameraX;
      let screenY = snowFlake.positionInWorld.y - cameraY;

      // X 方向循环
      if (screenX > xBound) {
        screenX = screenX % xBound;
      } else if (screenX < 0) {
        screenX = (screenX % xBound) + xBound;
      }

      // Y 方向循环
      if (screenY > yBound) {
        screenY = screenY % yBound;
      } else if (screenY < 0) {
        screenY = (screenY % yBound) + yBound;
      }

      // 更新世界坐标
      snowFlake.positionInWorld.x = screenX + cameraX;
      snowFlake.positionInWorld.y = screenY + cameraY;

      remainingFlakes.push(snowFlake);
    }

    this.snowFlakes = remainingFlakes;
  }

  /**
   * 绘制雪效果
   * 性能优化：批量设置 fillStyle，避免每个雪花都调用 save()/restore()
   */
  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void {
    if (!this._isSnowing || this.snowFlakes.length === 0) return;

    // 批量设置填充样式，所有雪花共用白色
    ctx.fillStyle = "white";

    for (const snowFlake of this.snowFlakes) {
      snowFlake.draw(ctx, cameraX, cameraY);
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.snowFlakes = [];
  }
}
