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

import { getEngineContext } from "../core/engine-context";
import { logger } from "../core/logger";
import type { Direction, GameVariables } from "../core/types";
import type { Difficulty } from "../character/level/difficulty";
import { getGameSlug, getMagicsData, loadSceneNpcEntries, loadSceneObjEntries } from "../data/game-data-api";
import { parseNpcData } from "../npc/npc-persistence";
import type { GuiManager } from "../gui/gui-manager";
import type { MagicItemInfo } from "../magic";
import type { NpcManager } from "../npc";
import type { ObjManager } from "../obj";
import type { GoodsListManager } from "../player/goods";
import type { PlayerMagicInventory } from "../player/magic/player-magic-inventory";
import type { Player, PlayerStatsInfo } from "../player/player";
import type { ScriptExecutor } from "../script/executor";
import { LuaExecutor } from "../script/lua";
import { resolveScriptPath, ResourcePath } from "../resource/resource-paths";
import { loadScript } from "../script/parser";

export interface DebugManagerConfig {
  onMessage?: (message: string) => void;
}

export type { PlayerStatsInfo };

/**
 * 配角信息
 */
export interface PartnerInfo {
  name: string;
  level: number;
  exp: number;
  levelUpExp: number;
  life: number;
  lifeMax: number;
  thew: number;
  thewMax: number;
  mana: number;
  manaMax: number;
  attack: number;
  defend: number;
  evade: number;
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

/**
 * NPC 详细信息（供调试面板弹窗使用）
 */
export interface NpcDetailInfo {
  id: string;
  name: string;
  kind: number;
  relation: number;
  group: number;
  state: number;
  level: number;
  life: number;
  lifeMax: number;
  mana: number;
  manaMax: number;
  thew: number;
  thewMax: number;
  attack: number;
  defend: number;
  evade: number;
  exp: number;
  levelUpExp: number;
  mapX: number;
  mapY: number;
  isDeath: boolean;
  isDeathInvoked: boolean;
  isHide: boolean;
  isVisible: boolean;
  isInFighting: boolean;
  isSitted: boolean;
  isPlayer: boolean;
  isPartner: boolean;
  isEventer: boolean;
  walkSpeed: number;
  visionRadius: number;
  attackRadius: number;
  dialogRadius: number;
  aiType: number;
  isPoisoned: boolean;
  isFrozen: boolean;
  isPetrified: boolean;
  isImmobilized: boolean;
  npcIni: string;
  scriptFile: string;
  scriptFileRight: string;
  deathScript: string;
  dropIni: string;
  invincible: number;
  followNpcName: string;
  flyIni: string;
  flyIni2: string;
  flyInis: string;
}

/**
 * 物体详细信息（供调试面板弹窗使用）
 */
export interface ObjDetailInfo {
  id: string;
  objName: string;
  fileName: string;
  kind: number;
  mapX: number;
  mapY: number;
  isRemoved: boolean;
  isShow: boolean;
  damage: number;
  frame: number;
  height: number;
  lum: number;
  offX: number;
  offY: number;
  scriptFile: string;
  scriptFileRight: string;
  timerScriptFile: string;
  timerScriptInterval: number;
  wavFile: string;
  isObstacle: boolean;
  isTrap: boolean;
  isBody: boolean;
  isDrop: boolean;
  isInteractive: boolean;
}

export class DebugManager {
  protected get engine() {
    return getEngineContext();
  }

  private godMode: boolean = false;
  // Player, NpcManager, ObjManager, GuiManager 现在通过 EngineContext 获取
  private scriptExecutor: ScriptExecutor | null = null;
  private luaExecutor: LuaExecutor | null = null;
  private getVariables: (() => GameVariables) | null = null;
  private setVariableCallback: ((name: string, value: number) => void) | null = null;
  private getMapInfo: (() => { mapName: string; mapPath: string }) | null = null;
  private getTrapStateFn:
    | (() => { snapshot: Record<number, string>; group: Record<number, string> })
    | null = null;
  private getBaseTrapEntriesFn: (() => Record<number, string>) | null = null;
  private debugTriggerTrapFn: ((trapIndex: number) => boolean) | null = null;
  private config: DebugManagerConfig;

  private get player(): Player {
    return this.engine.player;
  }

  private get npcManager(): NpcManager {
    return this.engine.npcManager;
  }

  private get objManager(): ObjManager {
    return this.engine.objManager;
  }

  private get guiManager(): GuiManager {
    return this.engine.guiManager;
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

  // Player, NpcManager, ObjManager, GuiManager 现在通过 getter 从 EngineContext 获取

  /**
   * 设置扩展系统引用（脚本等）
   * GoodsListManager 和 PlayerMagicInventory 通过 Player 访问
   */
  setExtendedSystems(
    scriptExecutor: ScriptExecutor,
    getVariables: () => GameVariables,
    getMapInfo: () => { mapName: string; mapPath: string },
    getTrapState?: () => { snapshot: Record<number, string>; group: Record<number, string> },
    setVariable?: (name: string, value: number) => void,
    getBaseTrapEntries?: () => Record<number, string>,
    debugTriggerTrap?: (trapIndex: number) => boolean,
  ): void {
    this.scriptExecutor = scriptExecutor;
    this.getVariables = getVariables;
    this.getMapInfo = getMapInfo;
    this.getTrapStateFn = getTrapState ?? null;
    this.setVariableCallback = setVariable ?? null;
    this.getBaseTrapEntriesFn = getBaseTrapEntries ?? null;
    this.debugTriggerTrapFn = debugTriggerTrap ?? null;
  }

  /**
   * 获取 GoodsListManager（通过 Player）
   */
  private get goodsListManager(): GoodsListManager {
    return this.player.getGoodsListManager();
  }

  /**
   * 获取 PlayerMagicInventory（通过 Player）
   */
  private get magicInventory(): PlayerMagicInventory {
    return this.player.getPlayerMagicInventory();
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
    return this.player.getStatsInfo();
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
   * 设置游戏变量
   */
  setGameVariable(name: string, value: number): void {
    this.setVariableCallback?.(name, value);
  }

  /**
   * 获取修炼武功信息
   */
  getXiuLianMagic(): MagicItemInfo | null {
    return this.magicInventory.getXiuLianMagic();
  }

  // ============= 配角系统 =============

  /**
   * 获取所有配角信息
   */
  getPartnersData(): PartnerInfo[] {
    const partners = this.npcManager.getAllPartner();
    return partners.map((npc) => ({
      name: npc.name,
      level: npc.level,
      exp: npc.exp,
      levelUpExp: npc.levelUpExp,
      life: npc.life,
      lifeMax: npc.lifeMax,
      thew: npc.thew,
      thewMax: npc.thewMax,
      mana: npc.mana,
      manaMax: npc.manaMax,
      attack: npc.attack,
      defend: npc.defend,
      evade: npc.evade,
    }));
  }

  /**
   * 配角升级
   */
  partnerLevelUp(name: string): void {
    const partners = this.npcManager.getAllPartner();
    const partner = partners.find((n) => n.name === name);
    if (!partner) {
      this.showMessage(`配角 "${name}" 不存在`);
      return;
    }
    const nextLevel = partner.level + 1;
    partner.levelUpTo(nextLevel);
    this.showMessage(`${name} 升至 ${partner.level} 级`);
  }

  /**
   * 配角降级
   */
  partnerLevelDown(name: string): void {
    const partners = this.npcManager.getAllPartner();
    const partner = partners.find((n) => n.name === name);
    if (!partner) {
      this.showMessage(`配角 "${name}" 不存在`);
      return;
    }
    if (partner.level <= 1) {
      this.showMessage(`${name} 已是最低等级`);
      return;
    }
    partner.levelUpTo(partner.level - 1);
    this.showMessage(`${name} 降至 ${partner.level} 级`);
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
   * 获取所有 NPC 详细信息
   */
  getAllNpcDetails(): NpcDetailInfo[] {
    const result: NpcDetailInfo[] = [];
    for (const [, npc] of this.npcManager.getAllNpcs()) {
      result.push({
        id: npc.id,
        name: npc.name,
        kind: npc.kind,
        relation: npc.relation,
        group: npc.group,
        state: npc.state,
        level: npc.level,
        life: npc.life,
        lifeMax: npc.lifeMax,
        mana: npc.mana,
        manaMax: npc.manaMax,
        thew: npc.thew,
        thewMax: npc.thewMax,
        attack: npc.attack,
        defend: npc.defend,
        evade: npc.evade,
        exp: npc.exp,
        levelUpExp: npc.levelUpExp,
        mapX: npc.mapX,
        mapY: npc.mapY,
        isDeath: npc.isDeath,
        isDeathInvoked: npc.isDeathInvoked,
        isHide: npc.isHide,
        isVisible: npc.isVisible,
        isInFighting: npc.isInFighting,
        isSitted: npc.isSitted,
        isPlayer: npc.isPlayer,
        isPartner: npc.isPartner,
        isEventer: npc.isEventer,
        walkSpeed: npc.walkSpeed,
        visionRadius: npc.visionRadius,
        attackRadius: npc.attackRadius,
        dialogRadius: npc.dialogRadius,
        aiType: npc.aiType,
        isPoisoned: npc.isPoisoned,
        isFrozen: npc.isFrozen,
        isPetrified: npc.isPetrified,
        isImmobilized: npc.isImmobilized,
        npcIni: npc.npcIni,
        scriptFile: npc.scriptFile,
        scriptFileRight: npc.scriptFileRight,
        deathScript: npc.deathScript,
        dropIni: npc.dropIni,
        invincible: npc.invincible,
        followNpcName: npc.followNpcName,
        flyIni: npc.flyIni,
        flyIni2: npc.flyIni2,
        flyInis: npc.flyInis,
      });
    }
    return result;
  }

  /**
   * 获取所有物体详细信息
   */
  getAllObjDetails(): ObjDetailInfo[] {
    return this.objManager.getAllObjs().map((obj) => ({
      id: obj.id,
      objName: obj.objName,
      fileName: obj.fileName,
      kind: obj.kind,
      mapX: obj.mapX,
      mapY: obj.mapY,
      isRemoved: obj.isRemoved,
      isShow: obj.isShow,
      damage: obj.damage,
      frame: obj.frame,
      height: obj.height,
      lum: obj.lum,
      offX: obj.offX,
      offY: obj.offY,
      scriptFile: obj.scriptFile,
      scriptFileRight: obj.scriptFileRight,
      timerScriptFile: obj.timerScriptFile,
      timerScriptInterval: obj.timerScriptInterval,
      wavFile: obj.wavFile,
      isObstacle: obj.isObstacle,
      isTrap: obj.isTrap,
      isBody: obj.isBody,
      isDrop: obj.isDrop,
      isInteractive: obj.isInteractive,
    }));
  }

  /**
   * 获取当前地图陷阱状态（snapshot + group KV）
   * - snapshot：当前地图运行时表，进入地图时 = clone(group[mapName])，踩中后 idx 标 ""
   * - group：当前地图持久化缓存，由 SetTrap / SaveMapTrap 写入
   * 触发查找顺序：snapshot → MMF 基础表（group 不参与触发）
   */
  getTrapState(): { snapshot: Record<number, string>; group: Record<number, string> } {
    return this.getTrapStateFn?.() ?? { snapshot: {}, group: {} };
  }

  /** 获取 MMF 资源文件中的陷阱基础表（trapIndex → scriptPath） */
  getBaseTrapEntries(): Record<number, string> {
    return this.getBaseTrapEntriesFn?.() ?? {};
  }

  /** 调试触发陷阱：绕过快照限制，允许重复触发 */
  debugTriggerTrap(trapIndex: number): boolean {
    return this.debugTriggerTrapFn?.(trapIndex) ?? false;
  }

  /** 脚本是否正在执行中（含陷阱脚本） */
  isScriptRunning(): boolean {
    return this.scriptExecutor?.isRunning() ?? false;
  }

  /** 加载陷阱脚本内容（返回每行文本） */
  async loadTrapScriptContent(scriptName: string): Promise<string[]> {
    const mapInfo = this.getMapInfo?.();
    const basePath = mapInfo?.mapName
      ? ResourcePath.scriptMap(mapInfo.mapName)
      : ResourcePath.scriptCommon("").replace(/\/$/, "");
    const fullPath = resolveScriptPath(basePath, scriptName);
    const script = await loadScript(fullPath);
    if (!script) return [];
    return script.codes.map((c) => c.literal);
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
   * 获取当前难度
   */
  getDifficulty(): Difficulty {
    return this.engine.getDifficulty();
  }

  /**
   * 切换难度（玩家+所有伙伴重算属性）
   */
  async setDifficulty(d: Difficulty): Promise<void> {
    if (d === this.engine.getDifficulty()) {
      this.showMessage(`当前已是${d === "easy" ? "简单" : "困难"}难度`);
      return;
    }
    await this.engine.setDifficulty(d);
    this.showMessage(`难度切换为${d === "easy" ? "简单" : "困难"}`);
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
   * 与 NPC 对话（触发其 scriptFile，跳过走路）
   */
  async talkToNpc(npcId: string): Promise<void> {
    const npc = this.npcManager.getAllNpcs().get(npcId);
    if (!npc) {
      this.showMessage("NPC 不存在");
      return;
    }
    if (!npc.scriptFile) {
      this.showMessage(`${npc.name} 没有对话脚本`);
      return;
    }

    const player = this.player;
    const scriptExecutor = this.scriptExecutor;
    if (!scriptExecutor) {
      this.showMessage("脚本执行器未就绪");
      return;
    }

    // 面向彼此
    const dx = npc.pixelPosition.x - player.pixelPosition.x;
    const dy = npc.pixelPosition.y - player.pixelPosition.y;
    player.setDirectionFromDelta(dx, dy);
    npc.setDirectionFromDelta(-dx, -dy);

    // 停止玩家移动
    player.stopMovement();

    // 冻结 NPC AI
    const wasAIDisabled = npc.isAIDisabled;
    npc.standingImmediately();
    if (!wasAIDisabled) npc.isAIDisabled = true;

    const basePath = this.engine.getScriptBasePath();
    try {
      await scriptExecutor.runScript(resolveScriptPath(basePath, npc.scriptFile), {
        type: "npc",
        id: npc.id,
      });
    } finally {
      if (!wasAIDisabled && npc.isAIDisabled) npc.isAIDisabled = false;
    }
  }

  /**
   * 与物体交互（复用 Obj.startInteract 流程）
   */
  async interactWithObj(objId: string): Promise<void> {
    const obj = this.objManager.getObjById(objId);
    if (!obj) {
      this.showMessage("物体不存在");
      return;
    }
    if (!obj.canInteract()) {
      this.showMessage(`${obj.objName} 不可交互`);
      return;
    }

    const player = this.player;

    // 播放物体音效
    if (obj.hasSound && this.engine.audio) {
      this.engine.audio.playSound(obj.getSoundFile());
    }

    // 标记已交互
    this.engine.interactionManager.markObjInteracted(obj.id);

    // 面向物体
    const objPixelPos = obj.positionInWorld;
    const dx = objPixelPos.x - player.pixelPosition.x;
    const dy = objPixelPos.y - player.pixelPosition.y;
    player.setDirectionFromDelta(dx, dy);

    // 停止玩家移动
    player.stopMovement();

    // 执行物体脚本
    obj.startInteract(false);
  }

  /**
   * 获取当前场景的 NPC 条目列表（来自 Scene API）
   */
  async getSceneNpcEntries(): Promise<{ name: string; kind: number; data: Record<string, unknown> }[]> {
    const sceneKey = this.engine.getCurrentMapName();
    const npcFile = this.npcManager.getFileName();
    const gameSlug = getGameSlug();
    if (!gameSlug || !sceneKey || !npcFile) return [];

    const entries = await loadSceneNpcEntries(sceneKey, npcFile);
    if (!entries) return [];

    return entries.map((e) => ({
      name: String(e.name ?? "?"),
      kind: Number(e.kind ?? 0),
      data: e,
    }));
  }

  /**
   * 获取当前场景的物体条目列表（来自 Scene API）
   */
  async getSceneObjEntries(): Promise<{ name: string; kind: number; data: Record<string, unknown> }[]> {
    const sceneKey = this.engine.getCurrentMapName();
    const objFile = this.objManager.getFileName();
    const gameSlug = getGameSlug();
    if (!gameSlug || !sceneKey || !objFile) return [];

    const entries = await loadSceneObjEntries(sceneKey, objFile);
    if (!entries) return [];

    return entries.map((e) => ({
      name: String(e.objName ?? "?"),
      kind: Number(e.kind ?? 0),
      data: e,
    }));
  }

  /**
   * 从场景条目数据添加 NPC 到玩家位置
   */
  async addNpcFromSceneEntry(data: Record<string, unknown>): Promise<void> {
    const { config, dir } = parseNpcData(data);
    const playerTile = this.player.tilePosition;
    const npc = await this.npcManager.addNpcWithConfig(config, playerTile.x, playerTile.y, dir as Direction);
    if (npc) {
      this.showMessage(`已添加 NPC: ${npc.name}`);
    } else {
      this.showMessage("添加 NPC 失败");
    }
  }

  /**
   * 从场景条目数据添加物体到玩家位置
   */
  async addObjFromSceneEntry(data: Record<string, unknown>): Promise<void> {
    const playerTile = this.player.tilePosition;
    await this.objManager.addObjFromEntry(data, playerTile.x, playerTile.y);
    const objName = String(data.objName ?? "?");
    this.showMessage(`已添加物体: ${objName}`);
  }

  /**
   * 杀死指定 NPC（以玩家为 killer）
   */
  killNpc(npcId: string): void {
    const npc = this.npcManager.getAllNpcs().get(npcId);
    if (!npc) {
      this.showMessage("NPC 不存在");
      return;
    }
    if (npc.isDeath || npc.isDeathInvoked) {
      this.showMessage(`${npc.name} 已经死亡`);
      return;
    }
    npc.death(this.player);
    this.showMessage(`已杀死 ${npc.name}`);
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
  addItem(itemFile: string): boolean {
    if (!this.goodsListManager) {
      this.showMessage("物品管理器未就绪。");
      return false;
    }

    const result = this.goodsListManager.addGoodToList(itemFile);
    if (result.success && result.good) {
      this.showMessage(`获得物品: ${result.good.name}`);
      return true;
    }
    return false;
  }

  // ============= 武功系统 =============

  /**
   * 添加武功
   * 委托给 Player.addMagic（消息由 Player.addMagic 统一显示）
   */
  async addMagic(magicFile: string): Promise<boolean> {
    if (!this.player) {
      this.showMessage("玩家对象未就绪。");
      return false;
    }

    return await this.player.addMagic(magicFile);
  }

  /**
   * 添加所有武功
   */
  async addAllMagics(): Promise<number> {
    if (!this.player) {
      this.showMessage("玩家对象未就绪。");
      return 0;
    }

    // 从 API 数据获取所有玩家武功（userType === "player"），避免依赖 key 前缀约定
    const magicsData = getMagicsData();
    const playerMagics = magicsData?.player.map((m) => m.key) ?? [];

    let addedCount = 0;
    for (const magicFile of playerMagics) {
      const result = await this.player.addMagic(magicFile);
      if (result) addedCount++;
    }
    this.showMessage(`习得 ${addedCount} 门武功`);
    return addedCount;
  }

  /**
   * 修炼武功升级
   */
  xiuLianLevelUp(): void {
    if (!this.magicInventory) {
      this.showMessage("武功管理器未就绪。");
      return;
    }

    const xiuLian = this.magicInventory.getXiuLianMagic();
    if (xiuLian?.magic) {
      // 没有等级数据的武功不能升级
      if (!xiuLian.magic.levels || xiuLian.magic.levels.size === 0) {
        this.showMessage(`${xiuLian.magic.name} 无法升级`);
        return;
      }
      const maxLevel = xiuLian.magic.maxLevel || 10;
      const newLevel = Math.min(xiuLian.level + 1, maxLevel);
      if (newLevel > xiuLian.level) {
        this.magicInventory.setXiuLianMagicLevel(newLevel);
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
    if (!this.magicInventory) {
      this.showMessage("武功管理器未就绪。");
      return;
    }

    const xiuLian = this.magicInventory.getXiuLianMagic();
    if (xiuLian?.magic) {
      // 没有等级数据的武功不能调整等级
      if (!xiuLian.magic.levels || xiuLian.magic.levels.size === 0) {
        this.showMessage(`${xiuLian.magic.name} 无法调整等级`);
        return;
      }
      const newLevel = Math.max(xiuLian.level - 1, 1);
      if (newLevel < xiuLian.level) {
        this.magicInventory.setXiuLianMagicLevel(newLevel);
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
   * 执行 TXT 脚本
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

  /**
   * 执行 Lua 脚本
   */
  async executeLuaScript(scriptContent: string): Promise<string | null> {
    if (!this.scriptExecutor) {
      return "脚本执行器未就绪";
    }

    try {
      const trimmed = scriptContent.trim();
      if (!trimmed) {
        return "脚本内容为空";
      }

      // 懒初始化 LuaExecutor
      if (!this.luaExecutor) {
        const api = this.scriptExecutor.getGameAPI();
        this.luaExecutor = new LuaExecutor(api);
      }
      await this.luaExecutor.init();
      await this.luaExecutor.runString(trimmed, "[调试-lua]");
      return null;
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
