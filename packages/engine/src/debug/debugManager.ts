/**
 * Debug Manager - 调试功能模块
 * Based on JxqyHD Helper/cheat.txt and GameEditor/GameEditor.cs
 *
 * 调试快捷键 (需要 Shift 组合键):
 * - Shift+A: 生命、体力、内力全满
 * - Shift+L: 升1级
 * - Shift+K: 当前修炼武功升级
 * - Shift+M: 增加 1000 金钱
 * - Shift+G: 切换无敌模式
 * - Shift+U: 关闭无敌时减少 1000 生命
 * - Shift+Backspace: 消灭所有敌人
 * - Shift+I: 重置物品和武功
 *
 * 所有调试面板功能都从此模块导出
 */

import { ALL_PLAYER_MAGICS } from "../constants/gameData";
import { getEngineContext } from "../core/engineContext";
import { logger } from "../core/logger";
import type { GameVariables } from "../core/types";
import type { GuiManager } from "../gui/guiManager";
import type { MagicItemInfo } from "../magic";
import type { NpcManager } from "../npc";
import type { ObjManager } from "../obj";
import type { GoodsListManager } from "../player/goods";
import type { MagicListManager } from "../player/magic/magicListManager";
import type { Player } from "../player/player";
import type { ScriptExecutor } from "../script/executor";

// Re-export for backward compatibility
export { ALL_PLAYER_MAGICS };

export interface DebugManagerConfig {
  onMessage?: (message: string) => void;
}

/**
 * 玩家状态信息（用于调试面板显示）
 */
export interface PlayerStatsInfo {
  level: number;
  life: number;
  lifeMax: number;
  thew: number;
  thewMax: number;
  mana: number;
  manaMax: number;
  exp: number;
  levelUpExp: number;
  money: number;
  state: number;
  isInFighting: boolean;
}

/**
 * 加载资源信息
 */
export interface LoadedResourcesInfo {
  mapName: string;
  mapPath: string;
  npcCount: number;
  objCount: number;
  npcFile: string;
  objFile: string;
}

export class DebugManager {
  private godMode: boolean = false;
  // Player, NpcManager, ObjManager, GuiManager 现在通过 IEngineContext 获取
  private scriptExecutor: ScriptExecutor | null = null;
  private getVariables: (() => GameVariables) | null = null;
  private getMapInfo: (() => { mapName: string; mapPath: string }) | null = null;
  private getTriggeredTraps: (() => number[]) | null = null;
  private config: DebugManagerConfig;

  /**
   * 获取 Player（通过 IEngineContext）
   */
  private get player(): Player {
    const ctx = getEngineContext();
    return ctx.player as Player;
  }

  /**
   * 获取 NpcManager（通过 IEngineContext）
   */
  private get npcManager(): NpcManager {
    const ctx = getEngineContext();
    return ctx.npcManager as NpcManager;
  }

  /**
   * 获取 ObjManager（通过 IEngineContext）
   */
  private get objManager(): ObjManager {
    const ctx = getEngineContext();
    return ctx.getManager("obj") as ObjManager;
  }

  /**
   * 获取 GuiManager（通过 IEngineContext）
   */
  private get guiManager(): GuiManager {
    const ctx = getEngineContext();
    return ctx.getManager("gui") as GuiManager;
  }

  // 脚本执行历史（包含完整内容，最多20条）
  private scriptHistory: {
    filePath: string;
    totalLines: number;
    allCodes: string[];
    timestamp: number;
    executedLines: Set<number>; // 实际被执行的行号集合
  }[] = [];

  constructor(config: DebugManagerConfig = {}) {
    this.config = config;
  }

  /**
   * 脚本开始执行时的回调（由 ScriptExecutor 调用）
   */
  onScriptStart = (filePath: string, totalLines: number, allCodes: string[]): void => {
    // 避免连续重复添加相同的脚本
    if (this.scriptHistory.length > 0 && this.scriptHistory[0].filePath === filePath) {
      // 如果是同一个脚本，重置 executedLines
      this.scriptHistory[0].executedLines.clear();
      return;
    }
    this.scriptHistory.unshift({
      filePath,
      totalLines,
      allCodes,
      timestamp: Date.now(),
      executedLines: new Set<number>(),
    });
    // 最多保存20条
    if (this.scriptHistory.length > 20) {
      this.scriptHistory.pop();
    }
  };

  /**
   * 记录执行过的行号（由 ScriptExecutor 调用）
   */
  onLineExecuted = (filePath: string, lineNumber: number): void => {
    // 找到对应的脚本记录
    const scriptRecord = this.scriptHistory.find((s) => s.filePath === filePath);
    if (scriptRecord) {
      scriptRecord.executedLines.add(lineNumber);
    }
  };

  // Player, NpcManager, ObjManager, GuiManager 现在通过 getter 从 IEngineContext 获取

  /**
   * 设置扩展系统引用（脚本等）
   * GoodsListManager 和 MagicListManager 通过 Player 访问
   */
  setExtendedSystems(
    scriptExecutor: ScriptExecutor,
    getVariables: () => GameVariables,
    getMapInfo: () => { mapName: string; mapPath: string },
    getTriggeredTraps?: () => number[]
  ): void {
    this.scriptExecutor = scriptExecutor;
    this.getVariables = getVariables;
    this.getMapInfo = getMapInfo;
    this.getTriggeredTraps = getTriggeredTraps ?? null;
  }

  /**
   * 获取 GoodsListManager（通过 Player）
   */
  private get goodsListManager(): GoodsListManager {
    return this.player.getGoodsListManager();
  }

  /**
   * 获取 MagicListManager（通过 Player）
   */
  private get magicListManager(): MagicListManager {
    return this.player.getMagicListManager();
  }

  /**
   * 显示消息
   */
  private showMessage(message: string): void {
    logger.log(`[DebugManager] ${message}`);
    this.guiManager.showMessage(message);
    this.config.onMessage?.(message);
  }

  // ============= 状态查询 =============

  /**
   * 无敌模式状态
   */
  isGodMode(): boolean {
    return this.godMode;
  }

  /**
   * 获取玩家状态
   */
  getPlayerStats(): PlayerStatsInfo | null {
    const stats = this.player.getStats();
    return {
      level: stats.level,
      life: stats.life,
      lifeMax: stats.lifeMax,
      thew: stats.thew,
      thewMax: stats.thewMax,
      mana: stats.mana,
      manaMax: stats.manaMax,
      exp: stats.exp,
      levelUpExp: stats.levelUpExp,
      money: this.player.money,
      state: this.player.state,
      isInFighting: this.player.isInFighting,
    };
  }

  /**
   * 获取玩家位置
   */
  getPlayerPosition(): { x: number; y: number } | null {
    return this.player.tilePosition;
  }

  /**
   * 获取游戏变量
   */
  getGameVariables(): GameVariables | undefined {
    return this.getVariables?.();
  }

  /**
   * 获取修炼武功信息
   */
  getXiuLianMagic(): MagicItemInfo | null {
    return this.magicListManager.getItemInfo(49);
  }

  /**
   * 获取加载资源信息
   */
  getLoadedResources(): LoadedResourcesInfo | null {
    const mapInfo = this.getMapInfo?.();
    if (!mapInfo) return null;

    return {
      mapName: mapInfo.mapName,
      mapPath: mapInfo.mapPath,
      npcCount: this.npcManager.getAllNpcs().size,
      objCount: this.objManager.getAllObjs().length,
      npcFile: this.npcManager.getFileName(),
      objFile: this.objManager.getFileName(),
    };
  }

  /**
   * 获取已触发的陷阱 ID 列表（全局）
   */
  getTriggeredTrapIds(): number[] {
    return this.getTriggeredTraps?.() ?? [];
  }

  /**
   * 获取当前脚本信息（历史中的第一条 + 实时执行状态）
   */
  getCurrentScriptInfo(): {
    filePath: string;
    currentLine: number;
    totalLines: number;
    allCodes: string[];
    isCompleted: boolean;
    executedLines: Set<number>;
  } | null {
    if (this.scriptHistory.length === 0) return null;

    const latest = this.scriptHistory[0];
    const state = this.scriptExecutor?.getState();

    // 使用 isRunning() 统一判断脚本是否正在执行
    const isRunning = this.scriptExecutor?.isRunning() ?? false;
    const isSameScript = state?.currentScript?.fileName === latest.filePath;

    if (isRunning && isSameScript) {
      return {
        filePath: latest.filePath,
        currentLine: state!.currentLine,
        totalLines: latest.totalLines,
        allCodes: latest.allCodes,
        isCompleted: false,
        executedLines: latest.executedLines,
      };
    }

    // 脚本已完成
    return {
      filePath: latest.filePath,
      currentLine: latest.totalLines, // 指向末尾
      totalLines: latest.totalLines,
      allCodes: latest.allCodes,
      isCompleted: true,
      executedLines: latest.executedLines,
    };
  }

  /**
   * 获取脚本执行历史（不含第一条，第一条显示在"当前脚本"）
   */
  getScriptHistory(): {
    filePath: string;
    totalLines: number;
    allCodes: string[];
    timestamp: number;
    executedLines: Set<number>;
  }[] {
    return this.scriptHistory.slice(1);
  }

  /**
   * 清空脚本历史（读取存档时调用）
   */
  clearScriptHistory(): void {
    this.scriptHistory = [];
  }

  // ============= 键盘输入处理 =============

  /**
   * 处理调试快捷键
   */
  handleInput(code: string, shiftKey: boolean): boolean {
    if (!shiftKey) {
      return false;
    }

    switch (code) {
      case "KeyA":
        this.fullAll();
        return true;
      case "KeyL":
        this.levelUp();
        return true;
      case "KeyK":
        this.xiuLianLevelUp();
        return true;
      case "KeyM":
        this.addMoney();
        return true;
      case "KeyG":
        this.toggleGodMode();
        return true;
      case "KeyU":
        this.reduceLife();
        return true;
      case "Backspace":
        this.killAllEnemies();
        return true;
      case "KeyI":
        this.resetItems();
        return true;
      case "KeyP":
        this.showPosition();
        return true;
      case "KeyV":
        this.showVariablesMessage();
        return true;
      default:
        return false;
    }
  }

  // ============= 核心调试功能 =============

  /**
   * 一键全满 - 生命、体力、内力全满
   */
  fullAll(): void {
    this.player.fullAll();
    this.showMessage("生命、体力、内力已恢复满。");
  }

  /**
   * 切换无敌模式
   */
  toggleGodMode(): void {
    this.godMode = !this.godMode;
    const status = this.godMode ? "开启" : "关闭";
    this.showMessage(`无敌模式${status}。`);
  }

  /**
   * 设置等级
   */
  setLevel(level: number): void {
    const currentLevel = this.player.getStats().level;
    if (level === currentLevel) {
      this.showMessage(`当前等级已是 ${level} 级`);
      return;
    }
    this.player.setLevelTo(level);
    this.showMessage(`等级设置为 ${level} 级`);
  }

  /**
   * 升1级
   */
  levelUp(): void {
    const success = this.player.levelUp();
    if (!success) {
      const level = this.player.getStats().level;
      this.showMessage(`已达到最高等级: ${level}`);
    }
  }

  /**
   * 添加金钱
   */
  addMoney(amount: number = 1000): void {
    this.player.addMoney(amount);
  }

  /**
   * 减少生命
   */
  reduceLife(amount: number = 1000): void {
    if (this.godMode) {
      this.showMessage("无敌模式开启中，无法减血。");
      return;
    }

    this.player.addLife(-amount);
    const stats = this.player.getStats();
    this.showMessage(`减少 ${amount} 点生命，剩余 ${stats.life} 点。`);

    if (stats.life <= 0) {
      this.showMessage("主角死亡！");
    }
  }

  /**
   * 消灭所有敌人
   */
  killAllEnemies(): void {
    if (!this.npcManager) {
      this.showMessage("NPC管理器未就绪。");
      return;
    }

    const killed = this.npcManager.killAllEnemies();
    this.showMessage(`消灭了 ${killed} 个敌人。`);
  }

  /**
   * 重置物品和武功
   */
  resetItems(): void {
    this.showMessage("重置物品和武功 (未实现)");
  }

  // ============= 物品系统 =============

  /**
   * 添加物品
   */
  async addItem(itemFile: string): Promise<boolean> {
    if (!this.goodsListManager) {
      this.showMessage("物品管理器未就绪。");
      return false;
    }

    const result = await this.goodsListManager.addGoodToList(itemFile);
    if (result.success && result.good) {
      this.showMessage(`获得物品: ${result.good.name}`);
      return true;
    }
    return false;
  }

  // ============= 武功系统 =============

  /**
   * 添加武功
   * 委托给 Player.addMagic
   */
  async addMagic(magicFile: string): Promise<boolean> {
    if (!this.player) {
      this.showMessage("玩家对象未就绪。");
      return false;
    }

    const result = await this.player.addMagic(magicFile);
    if (result) {
      this.showMessage(`习得武功: ${magicFile}`);
      return true;
    }
    // 如果添加失败可能是已有该武功
    const magicListManager = this.magicListManager;
    if (magicListManager) {
      const existingMagic = magicListManager.getMagicByFileName(magicFile);
      if (existingMagic?.magic) {
        this.showMessage(`已拥有: ${existingMagic.magic.name}`);
        return true;
      }
    }
    return false;
  }

  /**
   * 添加所有武功
   */
  async addAllMagics(): Promise<number> {
    if (!this.player) {
      this.showMessage("玩家对象未就绪。");
      return 0;
    }

    let addedCount = 0;
    for (const magic of ALL_PLAYER_MAGICS) {
      const result = await this.player.addMagic(magic.file);
      if (result) addedCount++;
    }
    this.showMessage(`习得 ${addedCount} 门武功`);
    return addedCount;
  }

  /**
   * 修炼武功升级
   */
  xiuLianLevelUp(): void {
    if (!this.magicListManager) {
      this.showMessage("武功管理器未就绪。");
      return;
    }

    const xiuLian = this.magicListManager.getItemInfo(49);
    if (xiuLian?.magic) {
      const maxLevel = xiuLian.magic.maxLevel || 10;
      const newLevel = Math.min(xiuLian.level + 1, maxLevel);
      if (newLevel > xiuLian.level) {
        this.magicListManager.setMagicLevel(xiuLian.magic.fileName, newLevel);
        this.showMessage(`${xiuLian.magic.name} 升至 ${newLevel} 级`);
      } else {
        this.showMessage(`${xiuLian.magic.name} 已达最高级`);
      }
    } else {
      this.showMessage("当前没有修炼武功");
    }
  }

  /**
   * 修炼武功降级
   */
  xiuLianLevelDown(): void {
    if (!this.magicListManager) {
      this.showMessage("武功管理器未就绪。");
      return;
    }

    const xiuLian = this.magicListManager.getItemInfo(49);
    if (xiuLian?.magic) {
      const newLevel = Math.max(xiuLian.level - 1, 1);
      if (newLevel < xiuLian.level) {
        this.magicListManager.setMagicLevel(xiuLian.magic.fileName, newLevel);
        this.showMessage(`${xiuLian.magic.name} 降至 ${newLevel} 级`);
      } else {
        this.showMessage(`${xiuLian.magic.name} 已是最低级`);
      }
    } else {
      this.showMessage("当前没有修炼武功");
    }
  }

  // ============= 脚本系统 =============

  /**
   * 执行脚本
   */
  async executeScript(scriptContent: string): Promise<string | null> {
    if (!this.scriptExecutor) {
      return "脚本执行器未就绪";
    }

    try {
      const trimmed = scriptContent.trim();
      if (!trimmed) {
        return "脚本内容为空";
      }
      // skipHistory=true: 调试执行的脚本不记录到历史
      await this.scriptExecutor.runScriptContent(trimmed, "[调试]", true);
      return null; // 成功
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  // ============= 调试显示 =============

  /**
   * 显示玩家位置
   */
  showPosition(): void {
    const tile = this.player.tilePosition;
    const pixel = this.player.pixelPosition;
    this.showMessage(
      `位置: 格(${tile.x}, ${tile.y}) 像素(${Math.round(pixel.x)}, ${Math.round(pixel.y)})`
    );
  }

  /**
   * 显示变量消息
   */
  showVariablesMessage(): void {
    const vars = this.getVariables?.();
    if (vars) {
      const count = Object.keys(vars).length;
      this.showMessage(`当前有 ${count} 个游戏变量`);
    } else {
      this.showMessage("无法获取游戏变量");
    }
  }

  /**
   * 传送到指定位置
   */
  teleport(tileX: number, tileY: number): void {
    this.player.setPosition(tileX, tileY);
    this.showMessage(`传送到 (${tileX}, ${tileY})`);
  }

  /**
   * 设置金钱（绝对值）
   */
  setPlayerMoney(amount: number): void {
    this.player.setMoney(amount);
    this.showMessage(`设置金钱为 ${amount}`);
  }

  /**
   * 添加经验
   */
  addExp(amount: number): void {
    this.player.addExp(amount);
    const stats = this.player.getStats();
    this.showMessage(`获得 ${amount} 经验，当前: ${stats.exp}/${stats.levelUpExp}`);
  }

  /**
   * 检查是否应该受到伤害（无敌模式检查）
   */
  shouldTakeDamage(): boolean {
    return !this.godMode;
  }

  /**
   * 获取调试状态显示文本
   */
  getStatusDisplay(): string {
    const parts: string[] = [];
    if (this.godMode) parts.push("无敌");
    return parts.length > 0 ? `[${parts.join("/")}]` : "";
  }
}
