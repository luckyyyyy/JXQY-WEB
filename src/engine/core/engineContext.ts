/**
 * EngineContext - 引擎上下文接口
 *
 * 这是一个轻量级接口，避免循环依赖。
 * Sprite 及其子类通过这个接口访问引擎服务。
 *
 * 设计原则：
 * 1. 只暴露必要的服务访问器
 * 2. 使用接口而非具体类，避免循环引用
 * 3. 所有方法返回类型使用 any 或泛型，具体类型由使用方断言
 */

import type { AudioManager } from "../audio";
import type { DebugManager } from "../debug/debugManager";
import type { InteractionManager } from "../game/interactionManager";
import type { MagicHandler } from "../game/magicHandler";
import type { BuyManager } from "../gui/buyManager";
import type { GuiManager } from "../gui/guiManager";
import type { MagicManager } from "../magic/magicManager";
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
   * 获取视野内的 NPC
   * C# Reference: NpcManager.GetNpcsInView()
   */
  getNpcsInView(viewRect: { x: number; y: number; width: number; height: number }): INpc[];

  /**
   * 获取指定位置的 Eventer NPC
   * C# Reference: NpcManager.GetEventer(tilePosition)
   */
  getEventer(tile: Vector2): INpc | null;

  /**
   * 根据名字获取 NPC
   * C# Reference: NpcManager.GetNpc(name)
   */
  getNpc(name: string): INpc | null;

  /**
   * 获取邻近的敌人
   * C# Reference: NpcManager.GetNeighborEnemy(Character character)
   */
  getNeighborEnemy(character: ICharacter): ICharacter[];

  /**
   * 获取邻近的中立战斗者
   * C# Reference: NpcManager.GetNeighborNuturalFighter(Character character)
   */
  getNeighborNeutralFighter(character: ICharacter): ICharacter[];
}

/**
 * 碰撞检测接口
 */
export interface ICollisionChecker {
  /**
   * 检查瓦片是否可行走（检查地图障碍 + NPC/Obj）
   */
  isTileWalkable(tile: Vector2): boolean;

  /**
   * 检查瓦片是否为地图角色障碍（检查 Obstacle + Trans）
   * C# Reference: MapBase.IsObstacleForCharacter
   * 用于寻路时过滤邻居瓦片
   */
  isMapObstacleForCharacter(tile: Vector2): boolean;

  /**
   * 检查瓦片是否为硬障碍（只检查 Obstacle 标志）
   * C# Reference: MapBase.IsObstacle
   * 用于对角线阻挡
   */
  isMapOnlyObstacle(tile: Vector2): boolean;

  /**
   * 检查瓦片是否为跳跃障碍
   * C# Reference: MapBase.Instance.IsObstacleForCharacterJump
   */
  isMapObstacleForJump(tile: Vector2): boolean;

  /**
   * 检查瓦片是否为武功障碍
   * C# Reference: JxqyMap.IsObstacleForMagic
   */
  isObstacleForMagic(tile: Vector2): boolean;
}

/**
 * 地图陷阱管理器接口
 */
export interface IMapTrapManager {
  /**
   * 检查指定瓦片是否有陷阱脚本（简化版，需要完整上下文请用 hasTrapScriptWithContext）
   */
  hasTrapScript(tile: Vector2): boolean;
}

/**
 * 引擎上下文接口 - Sprite 及其子类通过此接口访问引擎服务
 *
 * 注意：所有方法都保证返回非空值。引擎初始化完成后这些系统必然存在。
 */
export interface IEngineContext {
  /**
   * 获取玩家实例
   */
  getPlayer(): IPlayer;

  /**
   * 获取 NPC 管理器
   */
  getNpcManager(): INpcManager;

  /**
   * 获取脚本执行器
   */
  getScriptExecutor(): IScriptExecutor;

  /**
   * 运行脚本
   * @param scriptPath 脚本路径
   * @param belongObject 可选的所属对象（用于脚本上下文）
   */
  runScript(scriptPath: string, belongObject?: { type: string; id: string }): Promise<void>;

  /**
   * 将脚本加入队列（不等待执行完成）
   * 用于外部触发的脚本（如死亡脚本），确保多个同时触发时按顺序执行
   * C# Reference: ScriptManager.RunScript - 加入 _list 队列，Update 中处理
   * @param scriptPath 脚本路径
   */
  queueScript(scriptPath: string): void;

  /**
   * 获取音频管理器
   */
  getAudioManager(): AudioManager;

  /**
   * 获取碰撞检测器
   */
  getCollisionChecker(): ICollisionChecker;

  /**
   * 获取陷阱管理器
   */
  getTrapManager(): IMapTrapManager;

  /**
   * 检查指定瓦片是否有陷阱脚本（带完整上下文）
   * C# Reference: MapBase.Instance.HasTrapScript(TilePosition)
   */
  hasTrapScript(tile: Vector2): boolean;

  /**
   * 获取当前地图名称
   */
  getCurrentMapName(): string;

  /**
   * 获取脚本基础路径
   */
  getScriptBasePath(): string;

  /**
   * 获取武功管理器
   */
  getMagicManager(): MagicManager;

  /**
   * 获取物体管理器
   */
  getObjManager(): ObjManager;

  /**
   * 获取 GUI 管理器
   */
  getGuiManager(): GuiManager;

  /**
   * 获取调试管理器
   */
  getDebugManager(): DebugManager;

  /**
   * 获取交互管理器
   */
  getInteractionManager(): InteractionManager;

  /**
   * 获取武功处理器
   */
  getMagicHandler(): MagicHandler;

  /**
   * 获取天气管理器
   */
  getWeatherManager(): WeatherManager;

  /**
   * 获取商店管理器
   * C# Reference: BuyInterface (通过 GuiManager 访问)
   */
  getBuyManager(): BuyManager;

  /**
   * 获取地图渲染器
   * C# Reference: MapBase.Instance - 用于获取瓦片纹理区域等
   */
  getMapRenderer(): MapRenderer | null;
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
