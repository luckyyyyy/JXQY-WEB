/**
 * EngineContext - 引擎上下文接口
 *
 * Sprite 及其子类通过 `this.engine` 访问引擎服务。
 * 使用 `import type` 引用具体类型，无循环依赖问题。
 */

import type { AudioManager } from "../audio";
import type { BuyManager } from "../gui/buy-manager";
import type { GuiManager } from "../gui/gui-manager";
import type { MagicSpriteManager } from "../magic";
import type { MagicCaster } from "../magic/magic-caster";
import type { MapBase } from "../map/map-base";
import type { MapRenderer } from "../map/map-renderer";
import type { NpcManager } from "../npc/npc-manager";
import type { ObjManager } from "../obj/obj-manager";
import type { Player } from "../player/player";
import type { DebugManager } from "../runtime/debug-manager";
import type { InteractionManager } from "../runtime/interaction-manager";
import type { ScriptExecutor } from "../script/executor";
import type { WeatherManager } from "../weather/weather-manager";

// IMapService 已删除，直接使用 MapBase

/**
 * 引擎上下文接口 - Sprite 及其子类通过此接口访问引擎服务
 *
 * 设计分层：
 * - 核心服务：player, npcManager, map, audio（只读属性）
 * - 便捷方法：runScript, queueScript
 * - 低频管理器：getManager<T>()
 */
export interface EngineContext {
  // ===== 核心服务（只读属性）=====
  /** 玩家实例 */
  readonly player: Player;
  /** NPC 管理器 */
  readonly npcManager: NpcManager;
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
  readonly magicCaster: MagicCaster;
  /** 武功管理器 */
  readonly magicSpriteManager: MagicSpriteManager;
  /** 地图渲染器 */
  readonly mapRenderer: MapRenderer;
  /** 脚本执行器 */
  readonly scriptExecutor: ScriptExecutor;

  // ===== 便捷方法（高频操作）=====
  /**
   * 运行脚本（等待完成）
   */
  runScript(
    scriptPath: string,
    belongObject?: { type: "npc" | "obj" | "good"; id: string }
  ): Promise<void>;

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
let globalEngineContext: EngineContext | null = null;

/**
 * 设置全局引擎上下文
 * @internal 仅由 GameEngine 调用
 */
export function setEngineContext(context: EngineContext | null): void {
  globalEngineContext = context;
}

/**
 * 获取全局引擎上下文
 * 引擎初始化完成后保证返回非空值
 * @throws 如果在引擎初始化前调用会抛出错误
 */
export function getEngineContext(): EngineContext {
  if (!globalEngineContext) {
    throw new Error("Engine context not initialized. Call setEngineContext first.");
  }
  return globalEngineContext;
}
