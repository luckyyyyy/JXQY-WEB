/**
 * EngineContext - 引擎上下文接口
 *
 * 这是一个轻量级接口，避免循环依赖。
 * Sprite 及其子类通过这个接口访问引擎服务。
 *
 * 设计原则：
 * 1. 核心服务用只读属性（player, npcManager, map, audio）
 * 2. 便捷方法用于高频操作（runScript, queueScript）
 * 3. 低频管理器通过 getManager() 获取
 */

import type { AudioManager } from "../audio";
import type { DebugManager } from "../debug/debugManager";
import type { InteractionManager } from "../game/interactionManager";
import type { MagicHandler } from "../game/magicHandler";
import type { BuyManager } from "../gui/buyManager";
import type { GuiManager } from "../gui/guiManager";
import type { MagicManager } from "../magic/magicManager";
import type { MapBase } from "../map/mapBase";
import type { MapRenderer } from "../map/renderer";
import type { ObjManager } from "../obj/objManager";
import type { WeatherManager } from "../weather/weatherManager";
import type { Vector2 } from "./types";

/**
 * Character 访问接口（避免直接引用 Character 类）
 */
export interface ICharacter {
  mapX: number;
  mapY: number;
  name: string;
  takeDamage(damage: number, attacker: unknown): void;
}

/**
 * NPC 访问接口（避免直接引用 Npc 类）
 */
export interface INpc extends ICharacter {
  isFighter: boolean;
  isEventer: boolean;
  tilePosition: Vector2;
  canLevelUp: number;
  isVisible: boolean;
  isHide: boolean;
  regionInWorld: { x: number; y: number; width: number; height: number };
  addExp(amount: number): void;
}

/**
 * Player 访问接口（避免直接引用 Player 类）
 */
export interface IPlayer extends ICharacter {
  tilePosition: Vector2;
  addExp(amount: number, addMagicExp?: boolean): void;
}

/**
 * 脚本执行器接口
 */
export interface IScriptExecutor {
  runScript(scriptPath: string): Promise<void>;
  isRunning(): boolean;
}

/**
 * NPC 管理器接口
 */
export interface INpcManager {
  getAllNpcs(): Map<string, INpc>;

  /**
   * 检查瓦片是否有 NPC 障碍
   */
  isObstacle(tileX: number, tileY: number): boolean;

  /**
   * 获取预计算的视野内 NPC 列表（只读）
   */
  readonly npcsInView: readonly INpc[];

  /**
   * 获取视野内的 NPC
   */
  getNpcsInView(viewRect: { x: number; y: number; width: number; height: number }): INpc[];

  /**
   * 获取指定位置的 Eventer NPC
   */
  getEventer(tile: Vector2): INpc | null;

  /**
   * 根据名字获取 NPC
   */
  getNpc(name: string): INpc | null;

  /**
   * 获取邻近的敌人
   */
  getNeighborEnemy(character: ICharacter): ICharacter[];

  /**
   * 获取邻近的中立战斗者
   */
  getNeighborNeutralFighter(character: ICharacter): ICharacter[];

  /**
   * 清除所有 NPC 对指定角色的追踪目标
   * C# Reference: NpcManager.CleartFollowTargetIfEqual
   */
  clearFollowTargetIfEqual(target: ICharacter): void;
}

// IMapService 已删除，直接使用 MapBase

/**
 * 管理器类型枚举
 */
export type ManagerType =
  | "magic"
  | "obj"
  | "gui"
  | "debug"
  | "weather"
  | "buy"
  | "interaction"
  | "magicHandler"
  | "mapRenderer"
  | "script";

/**
 * 管理器类型映射
 */
export interface ManagerMap {
  magic: MagicManager;
  obj: ObjManager;
  gui: GuiManager;
  debug: DebugManager;
  weather: WeatherManager;
  buy: BuyManager;
  interaction: InteractionManager;
  magicHandler: MagicHandler;
  mapRenderer: MapRenderer | null;
  script: IScriptExecutor;
}

/**
 * 引擎上下文接口 - Sprite 及其子类通过此接口访问引擎服务
 *
 * 设计分层：
 * - 核心服务：player, npcManager, map, audio（只读属性）
 * - 便捷方法：runScript, queueScript
 * - 低频管理器：getManager<T>()
 */
export interface IEngineContext {
  // ===== 核心服务（只读属性）=====
  /** 玩家实例 */
  readonly player: IPlayer;
  /** NPC 管理器 */
  readonly npcManager: INpcManager;
  /** 地图基类（障碍检测、陷阱、坐标转换） */
  readonly map: MapBase;
  /** 音频管理器（完整实例，支持 3D 音效等） */
  readonly audio: AudioManager;

  // ===== 便捷方法（高频操作）=====
  /**
   * 运行脚本（等待完成）
   */
  runScript(scriptPath: string, belongObject?: { type: string; id: string }): Promise<void>;

  /**
   * 将脚本加入队列（不等待）
   */
  queueScript(scriptPath: string): void;

  /**
   * 获取当前地图名称
   */
  getCurrentMapName(): string;

  /**
   * 获取脚本基础路径
   */
  getScriptBasePath(): string;

  /**
   * 检查物品掉落是否启用
   */
  isDropEnabled(): boolean;

  // ===== 低频管理器（按需获取）=====
  /**
   * 获取指定类型的管理器
   * @example engine.getManager('magic')
   * @example engine.getManager('gui')
   */
  getManager<T extends ManagerType>(type: T): ManagerMap[T];
}

/**
 * 全局引擎上下文引用
 * 由 GameEngine 初始化时设置
 */
let globalEngineContext: IEngineContext | null = null;

/**
 * 设置全局引擎上下文
 * @internal 仅由 GameEngine 调用
 */
export function setEngineContext(context: IEngineContext | null): void {
  globalEngineContext = context;
}

/**
 * 获取全局引擎上下文
 * 引擎初始化完成后保证返回非空值
 * @throws 如果在引擎初始化前调用会抛出错误
 */
export function getEngineContext(): IEngineContext {
  if (!globalEngineContext) {
    throw new Error("Engine context not initialized. Call setEngineContext first.");
  }
  return globalEngineContext;
}
