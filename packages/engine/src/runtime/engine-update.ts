/**
 * Engine Update — 每帧更新逻辑
 *
 * 从 GameEngine.update() 提取的帧更新管线。
 * 按照 C# 版 Update 顺序：视野预计算 → 鼠标悬浮 → 音频 → WASM 障碍同步
 * → 游戏逻辑 → 相机 → 天气 → 计时器 → 颜色效果。
 */

import type { AudioManager } from "../audio";
import type { MapRenderer } from "../map/map-renderer";
import type { ScreenEffects } from "../renderer/screen-effects";
import { setSpriteDrawColor } from "../sprite/sprite";
import { syncDynamicObstacles } from "../wasm/wasm-path-finder";
import type { WeatherManager } from "../weather";
import type { EngineCamera } from "./engine-camera";
import type { EngineInput } from "./engine-input";
import type { GameEngineState } from "./game-engine";
import type { GameManager } from "./game-manager";
import type { PerformanceStats } from "./performance-stats";
import type { TimerManager } from "./timer-manager";

/** updateFrame 所需的上下文 */
export interface EngineUpdateContext {
  state: GameEngineState;
  config: { width: number; height: number };
  gameManager: GameManager;
  mapRenderer: MapRenderer;
  performanceStats: PerformanceStats;
  engineInput: EngineInput;
  audio: AudioManager;
  engineCamera: EngineCamera;
  weatherManager: WeatherManager;
  timerManager: TimerManager;
  screenEffects: ScreenEffects;
}

/**
 * 执行一帧的游戏逻辑更新
 */
export function updateFrame(ctx: EngineUpdateContext, deltaTime: number): void {
  const { gameManager, screenEffects } = ctx;

  // loading 状态下只推进脚本/特效/GUI，避免访问未加载的地图数据
  if (ctx.state === "loading") {
    gameManager.scriptExecutor.update(deltaTime * 1000);
    gameManager.screenEffects.update(deltaTime);
    gameManager.guiManager.update(deltaTime);
    return;
  }

  const { width, height } = ctx.config;

  // 计算视野区域（复用于多个子系统）
  const viewRect = {
    x: ctx.mapRenderer.camera.x,
    y: ctx.mapRenderer.camera.y,
    width,
    height,
  };

  // === 性能优化：Update 阶段预计算视野内对象 ===
  gameManager.npcManager.updateNpcsInView(viewRect);
  gameManager.objManager.updateObjsInView(viewRect);

  // 更新性能统计中的对象数量
  const magicMgr = gameManager.magicSpriteManager;
  ctx.performanceStats.updateObjectStats(
    gameManager.npcManager.npcsInView.length,
    gameManager.objManager.objsInView.length,
    magicMgr ? magicMgr.getMagicSprites().size + magicMgr.getEffectSprites().size : 0
  );

  // Update mouse hover state for interaction highlights
  gameManager
    .getInputHandler()
    .updateMouseHover(
      ctx.engineInput.state.mouseWorldX,
      ctx.engineInput.state.mouseWorldY,
      viewRect
    );

  // 更新音频监听者位置（玩家位置）
  const player = gameManager.player;
  ctx.audio.setListenerPosition(player.pixelPosition);
  // 更新玩家遮挡状态（用于半透明效果）
  player.updateOcclusionState();

  // === WASM 寻路：每帧同步动态障碍物 ===
  if (magicMgr) {
    syncDynamicObstacles(gameManager.npcManager, gameManager.objManager, magicMgr, player);
  }

  // 更新游戏逻辑
  gameManager.update(deltaTime, ctx.engineInput.state);

  // 更新相机
  ctx.engineCamera.updateCamera(deltaTime);

  // 更新天气系统
  ctx.weatherManager.update(deltaTime, ctx.mapRenderer.camera.x, ctx.mapRenderer.camera.y);

  // 更新计时器系统
  ctx.timerManager.update(deltaTime);

  // 雨天时设置地图/精灵颜色为灰色
  if (ctx.weatherManager.isRaining) {
    const color = ctx.weatherManager.rainColor;
    if (ctx.weatherManager.isFlashing) {
      screenEffects.setMapColor(255, 255, 255);
      screenEffects.setSpriteColor(255, 255, 255);
    } else {
      screenEffects.setMapColor(color.r, color.g, color.b);
      screenEffects.setSpriteColor(color.r, color.g, color.b);
    }
  }

  // 同步 Sprite.drawColor（ChangeAsfColor 效果）
  if (screenEffects.isSpriteGrayscale()) {
    setSpriteDrawColor("black");
  } else {
    setSpriteDrawColor("white");
  }
}
