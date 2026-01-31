/**
 * RainDrop - 雨滴粒子
 * 基于 C# JxqyHD/Engine/Weather/RainDrop.cs
 */

export class RainDrop {
  /** 是否显示 */
  isShow: boolean = false;

  /** 在窗口中的位置 */
  position: { x: number; y: number };

  /** 显示状态剩余帧数 */
  private showFrames: number = 0;

  /** 隐藏状态剩余帧数 */
  private hideFrames: number = 0;

  /** 雨滴长度（随机） */
  private length: number;

  /** 雨滴宽度（随机） */
  private width: number;

  /** 雨滴透明度（随机） */
  private alpha: number;

  constructor(x: number, y: number) {
    this.position = { x, y };
    // 随机大小：长度 12-28px，宽度 1-2px
    this.length = Math.floor(Math.random() * 16) + 12;
    this.width = Math.random() < 0.7 ? 1 : 2;
    // 随机透明度 0.3-0.6
    this.alpha = Math.random() * 0.3 + 0.3;
    // 初始化时随机设置隐藏状态
    this.hideFrames = Math.floor(Math.random() * 60) + 30;
  }

  /**
   * 更新雨滴状态
   * 改进版：雨滴显示/隐藏有持续时间，避免每帧闪烁
   */
  update(): void {
    if (this.isShow) {
      // 正在显示，减少显示帧数
      this.showFrames--;
      if (this.showFrames <= 0) {
        this.isShow = false;
        // 设置隐藏持续时间（40-100帧，约0.7-1.7秒）
        this.hideFrames = Math.floor(Math.random() * 60) + 40;
      }
    } else {
      // 正在隐藏，减少隐藏帧数
      this.hideFrames--;
      if (this.hideFrames <= 0) {
        this.isShow = true;
        // 设置显示持续时间（5-12帧，约0.08-0.2秒，模拟雨滴划过）
        this.showFrames = Math.floor(Math.random() * 7) + 5;
      }
    }
  }

  /**
   * 绘制雨滴
   * 使用半透明白色，随机大小
   */
  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.isShow) return;

    const x = this.position.x;
    const y = this.position.y;

    ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
    ctx.fillRect(x, y, this.width, this.length);
  }
}
