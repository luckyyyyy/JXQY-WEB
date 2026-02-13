/**
 * Rain - 雨效果系统（改进版）
 * 基于JxqyHD/Engine/Weather/Rain.cs
 *
 * 改进点：
 * - 雨滴真实下落（从顶部到底部连续运动）
 * - 三层纵深效果（远/中/近），速度和大小不同
 * - 摄像机移动时雨滴有视差偏移，不再感觉"粘在屏幕上"
 * - 溅射效果：雨滴落到底部时产生小水花
 * - 雷声和闪电效果（保留原版）
 * - 背景雨声（保留原版）
 */

import type { AudioManager } from "../audio";
import { logger } from "../core/logger";
import type { IRenderer } from "../renderer/i-renderer";
import { RainDrop, RainLayer } from "./raindrop";
import { ScreenDroplet, clearDropletTextureCache } from "./screen-droplet";

// 下雨时的地图/精灵颜色（灰色）
export const RAIN_COLOR = { r: 128, g: 128, b: 128 };

// 闪电/雷声参数
const THUNDER_INTERVAL_MIN = 5; // 两次雷暴最小间隔（秒）
const THUNDER_INTERVAL_MAX = 14; // 两次雷暴最大间隔（秒）
const THUNDER_FIRST_MIN = 2; // 开始下雨后首次雷暴最小延迟
const THUNDER_FIRST_MAX = 7; // 开始下雨后首次雷暴最大延迟

// 各层雨滴数量（远景多一些增加密度感，近景少一些避免太密）
const DROP_COUNT_FAR = 90;
const DROP_COUNT_MID = 55;
const DROP_COUNT_NEAR = 28;

// 摄像机视差系数：摄像机移动时不同层的偏移比例
const PARALLAX_FAR = 0.05;
const PARALLAX_MID = 0.12;
const PARALLAX_NEAR = 0.22;

/** 溅射粒子 */
interface Splash {
  x: number;
  y: number;
  /** 剩余生命（秒） */
  life: number;
  /** 初始生命（秒） */
  maxLife: number;
  /** 半径 */
  radius: number;
}

// 屏幕水滴参数（数量更多，间隔随机化）
const MAX_SCREEN_DROPLETS = 22;
const DROPLET_SPAWN_INTERVAL_MIN = 0.2; // 秒
const DROPLET_SPAWN_INTERVAL_MAX = 0.7; // 秒

export class Rain {
  /** 各层雨滴 */
  private farDrops: RainDrop[] = [];
  private midDrops: RainDrop[] = [];
  private nearDrops: RainDrop[] = [];

  /** 溅射粒子 */
  private splashes: Splash[] = [];

  /** 屏幕水滴（雨滴打在镜头上的效果） */
  private screenDroplets: ScreenDroplet[] = [];
  private dropletSpawnTimer: number = 0;

  /** 是否正在下雨 */
  private _isRaining: boolean = false;

  /** 是否正在闪电（当前帧） */
  private isInFlash: boolean = false;

  // 闪电爆发系统：2-4下快速闪电 → 间隔 → 雷声
  private thunderCooldown = 0; // 下次雷暴倒计时（秒）
  private flashSchedule: { onAt: number; offAt: number }[] = [];
  private thunderPlayAt = -1;
  private sequenceTimer = 0;
  private sequenceActive = false;
  private thunderPlayed = false;

  /** 音频管理器 */
  private audioManager: AudioManager;

  /** 屏幕尺寸 */
  private windowWidth: number = 800;
  private windowHeight: number = 600;

  /** 上一帧摄像机位置（用于计算视差偏移） */
  private lastCameraX: number = 0;
  private lastCameraY: number = 0;
  private cameraInitialized: boolean = false;

  get isRaining(): boolean {
    return this._isRaining;
  }

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager;
  }

  /**
   * 设置屏幕尺寸
   */
  setWindowSize(width: number, height: number): void {
    this.windowWidth = width;
    this.windowHeight = height;
  }

  /**
   * 创建一个雨滴，随机分布在屏幕范围上方
   * 增加了更大的水平随机范围和垂直分散
   */
  private createDrop(layer: RainLayer, spreadVertically: boolean): RainDrop {
    // 水平位置：超出屏幕边界更多（保证边缘也有雨滴）
    const x = Math.random() * (this.windowWidth + 120) - 60;
    // 垂直位置：初始化时分散在整个屏幕+上方区域，之后只在顶部生成
    const y = spreadVertically
      ? Math.random() * (this.windowHeight * 1.2) - this.windowHeight * 0.3
      : -(Math.random() * this.windowHeight * 0.4 + 10);
    return new RainDrop(x, y, layer);
  }

  /**
   * 生成所有层的雨滴
   */
  private generateRainDrops(): void {
    this.farDrops = [];
    this.midDrops = [];
    this.nearDrops = [];
    this.splashes = [];

    for (let i = 0; i < DROP_COUNT_FAR; i++) {
      this.farDrops.push(this.createDrop(RainLayer.Far, true));
    }
    for (let i = 0; i < DROP_COUNT_MID; i++) {
      this.midDrops.push(this.createDrop(RainLayer.Mid, true));
    }
    for (let i = 0; i < DROP_COUNT_NEAR; i++) {
      this.nearDrops.push(this.createDrop(RainLayer.Near, true));
    }
  }

  /**
   * 播放雨声（通过 AudioManager 循环播放）
   */
  private playRainSound(): void {
    this.audioManager.playAmbientLoop("背-下雨");
  }

  /**
   * 停止雨声
   */
  private stopRainSound(): void {
    this.audioManager.stopAmbientLoop();
  }

  /**
   * 开始/停止下雨
   */
  setRaining(isRain: boolean): void {
    this._isRaining = isRain;
    this.cameraInitialized = false;

    if (isRain) {
      this.generateRainDrops();
      this.playRainSound();
      // 首次雷暴延迟
      this.thunderCooldown = THUNDER_FIRST_MIN + Math.random() * (THUNDER_FIRST_MAX - THUNDER_FIRST_MIN);
      this.sequenceActive = false;
      this.isInFlash = false;
    } else {
      this.farDrops = [];
      this.midDrops = [];
      this.nearDrops = [];
      this.splashes = [];
      this.screenDroplets = [];
      this.dropletSpawnTimer = 0;
      clearDropletTextureCache();
      this.stopRainSound();
    }

    logger.debug(
      `[Rain] setRaining(${isRain}), drops: far=${this.farDrops.length} mid=${this.midDrops.length} near=${this.nearDrops.length}, windowSize: ${this.windowWidth}x${this.windowHeight}`
    );
  }

  /**
   * 回收超出屏幕的雨滴，重新从顶部生成
   */
  private recycleDrops(drops: RainDrop[], layer: RainLayer, cameraDx: number, parallax: number): void {
    const margin = 40;
    const bottomLimit = this.windowHeight + margin;
    const rightLimit = this.windowWidth + margin;

    for (let i = 0; i < drops.length; i++) {
      const drop = drops[i];

      // 应用摄像机视差偏移
      drop.x -= cameraDx * parallax;

      if (drop.y > bottomLimit || drop.x > rightLimit || drop.x < -margin) {
        // 在顶部重新生成
        drops[i] = this.createDrop(layer, false);
      }
    }
  }

  /**
   * 更新雨效果
   * @param deltaTime 时间差（秒）
   * @param cameraX 摄像机世界 X
   * @param _cameraY 摄像机世界 Y（保留参数）
   * @returns 返回是否需要闪电
   */
  update(deltaTime: number, cameraX: number = 0, _cameraY: number = 0): { isFlashing: boolean } {
    if (!this._isRaining) {
      return { isFlashing: false };
    }

    // 计算摄像机偏移
    let cameraDx = 0;
    if (this.cameraInitialized) {
      cameraDx = cameraX - this.lastCameraX;
    }
    this.lastCameraX = cameraX;
    this.lastCameraY = _cameraY;
    this.cameraInitialized = true;

    // 更新各层雨滴位置
    for (const drop of this.farDrops) drop.update(deltaTime);
    for (const drop of this.midDrops) drop.update(deltaTime);
    for (const drop of this.nearDrops) drop.update(deltaTime);

    // 回收超出屏幕的雨滴（含视差偏移）
    this.recycleDrops(this.farDrops, RainLayer.Far, cameraDx, PARALLAX_FAR);
    this.recycleDrops(this.midDrops, RainLayer.Mid, cameraDx, PARALLAX_MID);
    this.recycleDrops(this.nearDrops, RainLayer.Near, cameraDx, PARALLAX_NEAR);

    // 近景雨滴落到底部时生成溅射
    for (const drop of this.nearDrops) {
      if (drop.y > this.windowHeight - 10 && drop.y < this.windowHeight + 5) {
        if (Math.random() < 0.3) {
          this.splashes.push({
            x: drop.x,
            y: this.windowHeight - 2 - Math.random() * 6,
            life: 0.08 + Math.random() * 0.06,
            maxLife: 0.14,
            radius: 1.5 + Math.random() * 1.5,
          });
        }
      }
    }

    // 更新溅射粒子
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      this.splashes[i].life -= deltaTime;
      if (this.splashes[i].life <= 0) {
        this.splashes.splice(i, 1);
      }
    }

    // 更新屏幕水滴（随机间隔，位置分布更广）
    this.dropletSpawnTimer += deltaTime;
    const spawnInterval = DROPLET_SPAWN_INTERVAL_MIN + Math.random() * (DROPLET_SPAWN_INTERVAL_MAX - DROPLET_SPAWN_INTERVAL_MIN);
    if (this.dropletSpawnTimer >= spawnInterval && this.screenDroplets.length < MAX_SCREEN_DROPLETS) {
      this.dropletSpawnTimer = 0;
      // 整个屏幕范围内随机生成，但上半部概率更高
      const dx = Math.random() * this.windowWidth;
      // 用平方分布让上半部更密集
      const dy = Math.random() ** 0.7 * this.windowHeight * 0.85;
      this.screenDroplets.push(new ScreenDroplet(dx, dy));
    }

    // 更新屏幕水滴（反向遍历，移除消亡的）
    for (let i = this.screenDroplets.length - 1; i >= 0; i--) {
      if (!this.screenDroplets[i].update(deltaTime)) {
        this.screenDroplets.splice(i, 1);
      }
    }

    // 闪电/雷声爆发系统
    this.updateLightning(deltaTime);

    return { isFlashing: this.isInFlash };
  }

  /**
   * 生成一次闪电序列：2-4 下快闪 + 间隔 + 雷声
   */
  private generateLightningSequence(): void {
    const flashCount = 2 + Math.floor(Math.random() * 3); // 2-4 下闪电
    this.flashSchedule = [];
    let t = 0;

    for (let i = 0; i < flashCount; i++) {
      // 每下闪电持续 50-130ms
      const flashDur = 0.05 + Math.random() * 0.08;
      this.flashSchedule.push({ onAt: t, offAt: t + flashDur });
      t += flashDur;

      // 闪电之间的暗间隔 40-120ms（最后一下后不加）
      if (i < flashCount - 1) {
        t += 0.04 + Math.random() * 0.08;
      }
    }

    // 雷声在最后一下闪电结束后 0.15-0.4s 响起（模拟光速>音速）
    this.thunderPlayAt = t + 0.15 + Math.random() * 0.25;
    this.sequenceTimer = 0;
    this.sequenceActive = true;
    this.thunderPlayed = false;
  }

  /**
   * 更新闪电/雷声状态
   */
  private updateLightning(deltaTime: number): void {
    if (this.sequenceActive) {
      this.sequenceTimer += deltaTime;

      // 检查当前帧是否处于任一闪光区间
      this.isInFlash = false;
      for (const flash of this.flashSchedule) {
        if (this.sequenceTimer >= flash.onAt && this.sequenceTimer < flash.offAt) {
          this.isInFlash = true;
          break;
        }
      }

      // 到达雷声时间点，播放雷声
      if (!this.thunderPlayed && this.sequenceTimer >= this.thunderPlayAt) {
        this.audioManager.playSound("背-打雷");
        this.thunderPlayed = true;
      }

      // 序列结束（雷声后 0.5s 缓冲）
      if (this.sequenceTimer > this.thunderPlayAt + 0.5) {
        this.sequenceActive = false;
        this.isInFlash = false;
        this.thunderCooldown =
          THUNDER_INTERVAL_MIN + Math.random() * (THUNDER_INTERVAL_MAX - THUNDER_INTERVAL_MIN);
      }
    } else {
      // 倒计时到下一次雷暴
      this.thunderCooldown -= deltaTime;
      if (this.thunderCooldown <= 0) {
        this.generateLightningSequence();
      }
    }
  }

  /**
   * 绘制雨效果
   */
  draw(renderer: IRenderer): void {
    if (!this._isRaining) return;

    // 按远到近顺序绘制，实现层次感
    for (const drop of this.farDrops) drop.draw(renderer);
    for (const drop of this.midDrops) drop.draw(renderer);
    for (const drop of this.nearDrops) drop.draw(renderer);

    // 绘制溅射粒子（更透明）
    for (const splash of this.splashes) {
      const alpha = (splash.life / splash.maxLife) * 0.25;
      const r = splash.radius * (1 - splash.life / splash.maxLife);
      renderer.fillRect({
        x: splash.x - r,
        y: splash.y,
        width: r * 2,
        height: 1,
        color: `rgba(200,210,225,${alpha.toFixed(2)})`,
      });
    }

    // 绘制屏幕水滴（最后绘制，覆盖在所有雨滴上面）
    // 需要把当前游戏画布传给水滴，用于采样折射
    const gameCanvas = renderer.getCanvas();
    for (const droplet of this.screenDroplets) {
      droplet.draw(renderer, gameCanvas);
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopRainSound();
    this.farDrops = [];
    this.midDrops = [];
    this.nearDrops = [];
    this.splashes = [];
    this.screenDroplets = [];
    clearDropletTextureCache();
  }
}
