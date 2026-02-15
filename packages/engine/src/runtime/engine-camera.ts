/**
 * Engine Camera — player-following camera logic
 *
 * Extracted from GameEngine to reduce God Class size.
 * Handles Carmera.UpdatePlayerView equivalent:
 * - Follow PlayerKindCharacter (NPC with Kind=Player > ControledCharacter > ThePlayer)
 * - Handle SetPlayerScn (center on player), SetMapPos (set camera position)
 * - Handle MoveScreen/MoveScreenEx (script-driven camera)
 * - Clamp camera to map boundaries
 */

import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import type { MapRenderer } from "../map/map-renderer";
import type { ScreenEffects } from "../renderer/screen-effects";
import type { GameEngineConfig } from "./game-engine";
import type { GameManager } from "./game-manager";

// ============= Types =============

export interface EngineCameraDeps {
  readonly config: GameEngineConfig;
  readonly getMapRenderer: () => MapRenderer;
  readonly getGameManager: () => GameManager;
  readonly screenEffects: ScreenEffects;
}

// ============= Camera State =============

/**
 * Manages player-following camera behavior.
 *
 * Responsibilities:
 * 1. Follow PlayerKindCharacter with dead-zone (only follow when player crosses screen center)
 * 2. Respond to SetPlayerScn / SetMapPos / MoveScreen commands
 * 3. Clamp camera within map boundaries
 */
export class EngineCamera {
  /** 上次玩家位置（用于检测移动方向） */
  private lastPlayerPosition: Vector2 | null = null;

  constructor(private readonly deps: EngineCameraDeps) {}

  /**
   * 获取当前相机跟踪的角色位置
   * C# Globals.PlayerKindCharacter / Globals.PlayerPositionInWorld
   * 优先级: NPC with Kind=Player > ControledCharacter > ThePlayer
   */
  getPlayerKindPosition(): Vector2 {
    const gm = this.deps.getGameManager();
    const npcWithPlayerKind = gm.npcManager.getPlayerKindCharacter();
    if (npcWithPlayerKind) return npcWithPlayerKind.pixelPosition;
    const player = gm.player;
    if (player.controledCharacter) return player.controledCharacter.pixelPosition;
    return player.pixelPosition;
  }

  /**
   * 更新相机（每帧调用）
   * Reference: Carmera.UpdatePlayerView
   */
  updateCamera(deltaTime: number): void {
    const { config, getMapRenderer, getGameManager, screenEffects } = this.deps;
    const { width, height } = config;
    const camera = getMapRenderer().camera;
    const gm = getGameManager();
    const playerPos = this.getPlayerKindPosition();

    // 检查是否有 SetPlayerScn 请求（居中到玩家）
    const pendingCenter = gm.consumePendingCenterOnPlayer();
    if (pendingCenter) {
      camera.x = playerPos.x - width / 2;
      camera.y = playerPos.y - height / 2;
      this.lastPlayerPosition = { ...playerPos };
    }

    // 检查是否有 SetMapPos 设置的待处理摄像机位置
    const pendingPos = gm.consumePendingCameraPosition();
    if (pendingPos) {
      camera.x = pendingPos.x;
      camera.y = pendingPos.y;
      this.lastPlayerPosition = { ...playerPos };
    } else if (gm.isCameraMovingByScript()) {
      // 脚本控制相机 (MoveScreen/MoveScreenEx)
      const newCameraPos = gm.updateCameraMovement(camera.x, camera.y, deltaTime * 1000);
      if (newCameraPos) {
        camera.x = newCameraPos.x;
        camera.y = newCameraPos.y;
      }
      // C# 中 UpdatePlayerView 在每帧都会执行（包括 MoveScreenEx 期间），
      // 始终更新 _lastPlayerPosition。TS 中需要同步更新以防止
      // MoveScreenEx 结束后因 lastPlayerPosition 过时导致相机跳跃。
      this.lastPlayerPosition = { ...playerPos };
    } else {
      // 正常跟随 PlayerKindCharacter
      this.followPlayer(playerPos, camera, width, height, screenEffects);
    }

    // 限制相机在地图范围内
    const mapData = gm.getMapData();
    camera.x = Math.max(0, Math.min(camera.x, mapData.mapPixelWidth - width));
    camera.y = Math.max(0, Math.min(camera.y, mapData.mapPixelHeight - height));
  }

  /**
   * 立即将摄像机居中到玩家位置
   * 用于加载存档后避免摄像机从 (0,0) 飞到玩家位置
   */
  centerCameraOnPlayer(): void {
    const { config, getMapRenderer, getGameManager } = this.deps;
    const { width, height } = config;
    const playerPos = this.getPlayerKindPosition();
    const camera = getMapRenderer().camera;
    const mapData = getGameManager().getMapData();

    let targetX = playerPos.x - width / 2;
    let targetY = playerPos.y - height / 2;

    // 限制在地图范围内
    targetX = Math.max(0, Math.min(targetX, mapData.mapPixelWidth - width));
    targetY = Math.max(0, Math.min(targetY, mapData.mapPixelHeight - height));

    camera.x = targetX;
    camera.y = targetY;
    this.lastPlayerPosition = { ...playerPos };

    logger.debug(`[EngineCamera] Camera centered on player at (${targetX}, ${targetY})`);
  }

  // ============= Private =============

  /**
   * Carmera.UpdatePlayerView — dead-zone following logic.
   * Camera only follows when player moves past the screen center in the movement direction.
   */
  private followPlayer(
    playerPos: Vector2,
    camera: { x: number; y: number },
    width: number,
    height: number,
    screenEffects: ScreenEffects
  ): void {
    const lastPos = this.lastPlayerPosition;
    const offsetX = lastPos ? playerPos.x - lastPos.x : 0;
    const offsetY = lastPos ? playerPos.y - lastPos.y : 0;
    const hasPlayerMoved = offsetX !== 0 || offsetY !== 0;

    if (!hasPlayerMoved && lastPos) return;

    const halfW = width / 2;
    const halfH = height / 2;
    let centerX = camera.x + halfW;
    let centerY = camera.y + halfH;

    // 全黑屏幕或首次 → 直接跳转
    if (screenEffects.isScreenBlack() || !lastPos) {
      centerX = playerPos.x;
      centerY = playerPos.y;
    } else {
      if ((offsetX > 0 && playerPos.x > centerX) || (offsetX < 0 && playerPos.x < centerX)) {
        centerX = playerPos.x;
      }
      if ((offsetY > 0 && playerPos.y > centerY) || (offsetY < 0 && playerPos.y < centerY)) {
        centerY = playerPos.y;
      }
    }

    camera.x = centerX - halfW;
    camera.y = centerY - halfH;
    this.lastPlayerPosition = { ...playerPos };
  }
}
