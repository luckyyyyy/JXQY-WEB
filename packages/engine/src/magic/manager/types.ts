/**
 * Magic Manager Types - 管理器模块共享类型定义
 */

import type { Character } from "../../character/character";
import type { EngineContext } from "../../core/engine-context";
import type { Vector2 } from "../../core/types";
import type { PlayerMagicInventory } from "../../player/magic/player-magic-inventory";
import type { ScreenEffects } from "../../renderer/screen-effects";
import type { CharacterRef } from "../effects";
import type { MagicRenderer } from "../magic-renderer";
import type { MagicSprite, WorkItem } from "../magic-sprite";
import type { Kind19MagicInfo, MagicData } from "../types";

/**
 * MagicSpriteManager 构造函数参数
 */
export interface MagicSpriteManagerDeps
  extends Pick<EngineContext, "player" | "npcManager" | "guiManager" | "audio"> {
  screenEffects: ScreenEffects;
  magicInventory: PlayerMagicInventory;
  magicRenderer: MagicRenderer;
  /** 震屏回调 */
  vibrateScreen?: (intensity: number) => void;
}

/**
 * MagicSpriteManager 内部状态（供子模块访问）
 */
export interface MagicSpriteManagerState {
  // 活动的武功精灵
  magicSprites: Map<number, MagicSprite>;
  // 工作队列（延迟添加的武功）
  workList: WorkItem[];
  // 特效精灵
  effectSprites: Map<number, MagicSprite>;
  // 最大武功数量（性能限制）
  maxMagicUnit: number;

  // SuperMode 状态
  isInSuperMagicMode: boolean;
  superModeMagicSprite: MagicSprite | null;

  // TimeStop 状态
  timeStopperMagicSprite: MagicSprite | null;

  // Kind19 持续留痕武功列表
  kind19Magics: Kind19MagicInfo[];

  // 性能优化：预计算按行分组的精灵
  magicSpritesByRow: Map<number, MagicSprite[]>;
  effectSpritesByRow: Map<number, MagicSprite[]>;
}

/**
 * 角色辅助方法接口
 */
export interface CharacterHelper {
  getCharacterRef(characterId: string): CharacterRef | null;
  getCharacter(characterId: string): Character | null;
  getCharacterFromRef(ref: CharacterRef): Character;
  getCharacterPosition(characterId: string): Vector2 | null;
  getBelongCharacter(characterId: string): Character | null;
  getPositionInDirection(origin: Vector2, direction: number): Vector2;
  getEnemiesInView(userId: string, magic: MagicData): string[];
  findClosestEnemy(sprite: MagicSprite): string | null;
}

/**
 * 精灵添加回调
 */
export interface SpriteAdder {
  addMagicSprite(sprite: MagicSprite): void;
  addWorkItem(delayMs: number, sprite: MagicSprite): void;
  initializeSpriteEffects(sprite: MagicSprite): void;
}

/**
 * 碰撞处理器接口
 */
export interface CollisionHandler {
  checkCollision(sprite: MagicSprite): boolean;
  checkMapObstacle(sprite: MagicSprite): boolean;
  characterHited(sprite: MagicSprite, character: Character | null): boolean;
}

/**
 * 精灵工厂回调（用于获取状态和触发事件）
 */
export interface SpriteFactoryCallbacks {
  addMagicSprite(sprite: MagicSprite): void;
  addWorkItem(delayMs: number, sprite: MagicSprite): void;
  initializeSpriteEffects(sprite: MagicSprite): void;
  useMagic(params: {
    userId: string;
    magic: MagicData;
    origin: Vector2;
    destination: Vector2;
    targetId?: string;
  }): void;
  setSuperModeState(sprite: MagicSprite | null): void;
  setTimeStopperSprite(sprite: MagicSprite | null): void;
  getKind19Magics(): Kind19MagicInfo[];
  addKind19Magic(info: Kind19MagicInfo): void;
}
