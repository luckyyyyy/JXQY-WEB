/**
 * EngineContext - 引擎上下文接口
 *
 * 这是一个轻量级接口，避免循环依赖。
 * Sprite 及其子类通过这个接口访问引擎服务。
 *
 * 设计原则：
 * 1. 核心服务用只读属性（player, npcManager, map, audio）
 * 2. 便捷方法用于高频操作（runScript, queueScript）
 * 3. 低频管理器通过直接属性访问
 */

import type { AudioManager } from "../audio";
import type { DebugManager } from "../runtime/debug-manager";
import type { InteractionManager } from "../runtime/interaction-manager";
import type { MagicHandler } from "../magic/magic-handler";
import type { BuyManager } from "../gui/buy-manager";
import type { GuiManager } from "../gui/gui-manager";
import type { MagicManager } from "../magic";
import type { MapBase } from "../map/map-base";
import type { MapRenderer } from "../map/map-renderer";
import type { ObjManager } from "../obj/obj-manager";
import type { WeatherManager } from "../weather/weather-manager";
import type { Vector2 } from "./types";

/**
 * Character 访问接口（避免直接引用 Character 类）
 */
export interface ICharacter {
  mapX: number;
  mapY: number;
  name: string;
  level: number;
  expBonus: number;
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
  /** 结束对角色的控制 */
  endControlCharacter(): void;
  /** 重置伙伴位置到玩家周围 */
  resetPartnerPosition(): void;
}

/**
 * 脚本执行器接口
 */
export interface IScriptExecutor {
  runScript(
    scriptPath: string,
    belongObject?: { type: "npc" | "obj" | "good"; id: string }
  ): Promise<void>;
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
   */
  clearFollowTargetIfEqual(target: ICharacter): void;
}

// IMapService 已删除，直接使用 MapBase

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
  /** Obj 管理器 */
  readonly objManager: ObjManager;
  /** GUI 管理器 */
  readonly guiManager: GuiManager;
  /** Debug 管理器 */
  readonly debugManager: DebugManager;
  /** 天气管理器 */
  readonly weatherManager: WeatherManager;
  /** 商店管理器 */
  readonly buyManager: BuyManager;
  /** 交互管理器 */
  readonly interactionManager: InteractionManager;
  /** 武功处理器 */
  readonly magicHandler: MagicHandler;
  /** 武功管理器 */
  readonly magicManager: MagicManager;
  /** 地图渲染器 */
  readonly mapRenderer: MapRenderer;
  /** 脚本执行器 */
  readonly scriptExecutor: IScriptExecutor;

  // ===== 便捷方法（高频操作）=====
  /**
   * 运行脚本（等待完成）
   */
  runScript(scriptPath: string, belongObject?: { type: "npc" | "obj" | "good"; id: string }): Promise<void>;

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

  /**
   * 获取脚本变量值
   * Reference: ScriptExecuter.GetVariablesValue("$" + VariableName)
   */
  getScriptVariable(name: string): number;

  // ===== UI 通知 =====
  /**
   * 通知玩家状态变更（切换角色、读档等）
   * 调用后会刷新 F1 状态面板
   */
  notifyPlayerStateChanged(): void;

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
