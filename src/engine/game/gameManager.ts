/**
 * GameManager - 游戏逻辑管理器
 *
 * ================== 职责边界 ==================
 *
 * GameManager 负责「游戏层」：
 * 1. 游戏逻辑更新 - update() 协调各子系统
 * 2. 游戏状态管理 - variables, eventId, gameTime, 地图信息
 * 3. 角色系统协调 - Player, NpcManager, ObjManager
 * 4. 脚本系统 - ScriptExecutor, ScriptContext
 * 5. GUI 协调 - GuiManager 状态管理
 * 6. 新游戏/存档 - 委托给 Loader
 *
 * GameManager 不负责：
 * - 游戏循环（由 GameEngine 处理）
 * - 渲染（由 GameEngine 处理）
 * - 输入事件转换（由 GameEngine 处理）
 * - 全局资源初始化（由 GameEngine 处理）
 *
 * ================== 模块拆分 ==================
 *
 * - Loader: 新游戏/存档加载保存
 * - ScriptContextFactory: 脚本执行上下文
 * - CollisionChecker: 瓦片可行走检查
 * - CameraController: 脚本控制相机移动
 * - MagicHandler: 武功使用和管理
 * - InputHandler: 键盘和鼠标输入处理
 * - SpecialActionHandler: 特殊动作状态更新
 *
 * ================================================
 */

import type { AudioManager } from "../audio";
import type { Npc } from "../character/npc";
import { NpcManager } from "../character/npcManager";
import type { EventEmitter } from "../core/eventEmitter";
import { GameEvents } from "../core/gameEvents";
import { logger } from "../core/logger";
import type { JxqyMapData } from "../core/mapTypes";
import type { GameVariables, InputState, Vector2 } from "../core/types";
import { parseIni } from "../utils";
import type { DebugManager } from "../debug";
import type { ScreenEffects } from "../effects";
import { BuyManager } from "../gui/buyManager";
import { GuiManager } from "../gui/guiManager";
import type { MemoListManager, TalkTextListManager } from "../listManager";
import type { MagicItemInfo } from "../magic";
import { MagicManager } from "../magic";
import { MapBase } from "../map/mapBase";
import type { ObjManager } from "../obj";
import type { Good, GoodsListManager } from "../player/goods";
import type { MagicListManager } from "../player/magic/magicListManager";
import { Player } from "../player/player";
import { type ScriptContext, ScriptExecutor } from "../script/executor";
import type { TimerManager } from "../timer";
import type { WeatherManager } from "../weather";
import { CameraController } from "./cameraController";
import { InputHandler } from "./inputHandler";
import { InteractionManager } from "./interactionManager";
import { Loader } from "./loader";
import { MagicHandler } from "./magicHandler";
// Import refactored modules
import { createScriptContext } from "./scriptContextFactory";
import { SpecialActionHandler } from "./specialActionHandler";
import { ResourcePath } from "@/config/resourcePaths";

export interface GameManagerConfig {
  onMapChange?: (mapPath: string) => Promise<JxqyMapData | null>;
  onLoadComplete?: () => void;
  getCanvas?: () => HTMLCanvasElement | null;
  // 立即将摄像机居中到玩家位置（用于加载存档后避免摄像机飞过去）
  centerCameraOnPlayer?: () => void;
}

/**
 * 依赖注入 - GameManager 需要的所有外部依赖
 */
export interface GameManagerDeps {
  events: EventEmitter;
  audioManager: AudioManager;
  screenEffects: ScreenEffects;
  objManager: ObjManager;
  talkTextList: TalkTextListManager;
  debugManager: DebugManager;
  memoListManager: MemoListManager;
  weatherManager: WeatherManager;
  timerManager: TimerManager;
  clearMouseInput?: () => void; // 清除鼠标按住状态（对话框弹出时调用）
}

export class GameManager {
  // Injected dependencies
  private events: EventEmitter;
  private talkTextList: TalkTextListManager;
  private memoListManager: MemoListManager;

  // Core systems
  private player: Player;
  private npcManager: NpcManager;
  private objManager: ObjManager;
  private scriptExecutor: ScriptExecutor;
  private guiManager: GuiManager;
  private audioManager: AudioManager;
  private screenEffects: ScreenEffects;
  private debugManager: DebugManager;
  private goodsListManager: GoodsListManager;
  private magicListManager: MagicListManager;
  private magicManager: MagicManager;

  // Shop system
  private buyManager: BuyManager;
  private buyVersion: number = 0;

  // Refactored modules
  private weatherManager: WeatherManager;
  private timerManager: TimerManager;
  private loader!: Loader;
  private cameraController: CameraController;
  private magicHandler!: MagicHandler;
  private inputHandler!: InputHandler;
  private specialActionHandler!: SpecialActionHandler;
  private interactionManager: InteractionManager;

  // Game state
  private variables: GameVariables = {};
  private currentMapPath: string = "";
  private currentMapName: string = "";
  private mapData: JxqyMapData | null = null;
  private saveEnabled: boolean = true;
  private dropEnabled: boolean = true;
  private scriptShowMapPos: boolean = false;
  private mapTime: number = 0;

  // Configuration
  private config: GameManagerConfig;

  // Timing
  private gameTime: number = 0;
  private isPaused: boolean = false;

  // Goods UI version (increment to trigger re-render)
  private goodsVersion: number = 0;

  // Magic UI version (increment to trigger re-render)
  private magicVersion: number = 0;

  // Event tracking
  private eventId: number = 0;

  // Level/experience file
  private levelFile: string = "";

  // Input control callback
  private clearMouseInput?: () => void;

  constructor(deps: GameManagerDeps, config: GameManagerConfig = {}) {
    this.config = config;

    // Store injected dependencies
    this.events = deps.events;
    this.audioManager = deps.audioManager;
    this.screenEffects = deps.screenEffects;
    this.objManager = deps.objManager;
    this.talkTextList = deps.talkTextList;
    this.debugManager = deps.debugManager;
    this.memoListManager = deps.memoListManager;
    this.weatherManager = deps.weatherManager;
    this.timerManager = deps.timerManager;
    this.clearMouseInput = deps.clearMouseInput;

    // Initialize systems
    // Character/Npc/Player 通过 IEngineContext.map 获取 MapBase.Instance
    this.player = new Player();

    this.npcManager = new NpcManager();
    // NPC 现在通过 IEngineContext.player 获取 Player 引用
    // AudioManager, ObjManager, MagicManager 现在由各组件通过 IEngineContext 获取
    this.guiManager = new GuiManager(this.events, this.memoListManager);

    // Initialize interaction manager
    this.interactionManager = new InteractionManager();

    // 从 Player 获取 GoodsListManager 和 MagicListManager
    // Player 持有这些 manager，GameManager 只是引用它们
    this.goodsListManager = this.player.getGoodsListManager();
    this.magicListManager = this.player.getMagicListManager();

    // Set up goods manager callbacks
    this.goodsListManager.setCallbacks({
      onEquiping: (good: Good | null, currentEquip: Good | null) => {
        if (good) this.player.equiping(good, currentEquip);
      },
      onUnEquiping: (good: Good | null) => {
        if (good) this.player.unEquiping(good);
      },
      onUpdateView: () => {
        this.goodsVersion++;
        this.events.emit(GameEvents.UI_GOODS_CHANGE, { version: this.goodsVersion });
      },
    });

    // Set up magic manager callbacks for UI updates
    // 注意：不能覆盖 Player 已设置的回调，需要添加而不是替换
    this.magicListManager.addCallbacks({
      onUpdateView: () => {
        this.magicVersion++;
        this.events.emit(GameEvents.UI_MAGIC_CHANGE, { version: this.magicVersion });
      },
    });

    // Initialize magic manager (for magic sprites/effects)
    this.magicManager = new MagicManager({
      player: this.player,
      npcManager: this.npcManager,
      guiManager: this.guiManager,
      screenEffects: this.screenEffects,
      audioManager: this.audioManager,
      magicListManager: this.magicListManager,
    });

    // MagicManager 现在由 NPCs 通过 IEngineContext 获取

    // Add sprite destroyed listener for logging
    // this.magicManager.onSpriteDestroyed((sprite) => {
    //   logger.log(`[Magic] Sprite destroyed: ${sprite.magic.name}`);
    // });

    // Initialize buy manager (shop system)
    this.buyManager = new BuyManager();
    this.buyManager.setCallbacks({
      onShowMessage: (msg) => this.guiManager.showMessage(msg),
      onUpdateView: () => {
        this.buyVersion++;
        this.events.emit(GameEvents.UI_BUY_CHANGE, { isOpen: this.buyManager.isOpen(), version: this.buyVersion });
      },
    });

    // Set up system references for notifications
    // Player 通过 IEngineContext 获取 GuiManager
    this.player.setOnMoneyChange(() => {
      this.goodsVersion++;
      this.events.emit(GameEvents.UI_GOODS_CHANGE, { version: this.goodsVersion });
    });
    // DebugManager 通过 IEngineContext 获取 Player, NpcManager, GuiManager, ObjManager

    // Initialize camera controller
    this.cameraController = new CameraController();

    // Create script context
    const scriptContext = this.createScriptContext();
    this.scriptExecutor = new ScriptExecutor(scriptContext);

    // Set up runParallelScript callback (after ScriptExecutor is created)
    // C# Reference: ScriptManager.RunParallelScript
    scriptContext.runParallelScript = (scriptFile: string, delay?: number) => {
      this.scriptExecutor.runParallelScript(scriptFile, delay || 0);
    };

    // Set up extended systems for debug manager (after scriptExecutor is created)
    // GoodsListManager 和 MagicListManager 通过 Player 访问
    this.debugManager.setExtendedSystems(
      this.scriptExecutor,
      () => this.variables,
      () => ({ mapName: this.currentMapName, mapPath: this.currentMapPath }),
      () => MapBase.GetIgnoredTrapIndices()
    );

    // Initialize loader (after scriptExecutor is created)
    // GoodsListManager 和 MagicListManager 由 Player 持有，Loader 通过 player 访问
    this.loader = new Loader({
      player: this.player,
      npcManager: this.npcManager,
      objManager: this.objManager,
      audioManager: this.audioManager,
      screenEffects: this.screenEffects,
      memoListManager: this.memoListManager,
      guiManager: this.guiManager,
      getScriptExecutor: () => this.scriptExecutor,
      loadMap: (mapPath) => this.loadMap(mapPath),
      parseIni: parseIni,
      clearScriptCache: () => this.scriptExecutor?.clearCache(),
      clearVariables: () => {
        this.variables = { Event: 0 };
        logger.debug(`[GameManager] Variables cleared`);
      },
      resetEventId: () => {
        this.eventId = 0;
      },
      resetGameTime: () => {
        this.gameTime = 0;
      },
      loadPlayerSprites: (npcIni) => this.loadPlayerSprites(npcIni),
      // 存档相关依赖
      getVariables: () => this.variables,
      setVariables: (vars) => {
        this.variables = { ...vars };
        logger.debug(`[GameManager] Variables restored: ${Object.keys(this.variables).length} keys`);
      },
      getCurrentMapName: () => this.currentMapName,
      getCanvas: () => this.config.getCanvas?.() ?? null,
      // 加载存档后立即居中摄像机（避免摄像机飞过去）
      centerCameraOnPlayer: () => this.config.centerCameraOnPlayer?.(),

      // === 游戏选项和计时器 ===
      // mapTime
      getMapTime: () => this.mapTime,
      setMapTime: (time) => this.setMapTime(time),
      // save/drop flags
      isSaveEnabled: () => this.saveEnabled,
      setSaveEnabled: (enabled) => {
        this.saveEnabled = enabled;
        logger.debug(`[GameManager] Save ${enabled ? "enabled" : "disabled"}`);
      },
      isDropEnabled: () => this.dropEnabled,
      setDropEnabled: (enabled) => {
        this.dropEnabled = enabled;
        logger.debug(`[GameManager] Drop ${enabled ? "enabled" : "disabled"}`);
      },
      // weather
      getWeatherState: () => ({
        isSnowing: this.weatherManager.isSnowing,
        isRaining: this.weatherManager.isRaining,
      }),
      setWeatherState: (state) => {
        this.weatherManager.showSnow(state.snowShow);
        if (state.rainFile) {
          this.weatherManager.beginRain(state.rainFile);
        } else {
          this.weatherManager.stopRain();
        }
        logger.debug(`[GameManager] Weather restored: snow=${state.snowShow}, rain=${!!state.rainFile}`);
      },
      // timer
      getTimerState: () => {
        const timerState = this.timerManager.getState();
        const timeScript = timerState.timeScripts[0];
        return {
          isOn: timerState.isRunning,
          totalSecond: timerState.seconds,
          isHidden: timerState.isHidden,
          isScriptSet: timerState.timeScripts.length > 0,
          timerScript: timeScript?.scriptFileName ?? "",
          triggerTime: timeScript?.triggerSeconds ?? 0,
        };
      },
      setTimerState: (state) => {
        if (state.isOn) {
          this.timerManager.openTimeLimit(state.totalSecond);
          if (state.isHidden) {
            this.timerManager.hideTimerWnd();
          }
          if (state.isScriptSet && state.timerScript) {
            this.timerManager.setTimeScript(state.triggerTime, state.timerScript);
          }
        } else {
          this.timerManager.closeTimeLimit();
        }
        logger.debug(`[GameManager] Timer restored: on=${state.isOn}, seconds=${state.totalSecond}`);
      },

      // === 新增: 脚本显示地图坐标、水波效果、并行脚本 ===
      // 脚本显示地图坐标
      isScriptShowMapPos: () => this.scriptShowMapPos,
      setScriptShowMapPos: (show) => this.setScriptShowMapPos(show),
      // 水波效果
      isWaterEffectEnabled: () => this.screenEffects.isWaterEffectEnabled(),
      setWaterEffectEnabled: (enabled) => {
        if (enabled) {
          this.screenEffects.openWaterEffect();
        } else {
          this.screenEffects.closeWaterEffect();
        }
        logger.debug(`[GameManager] Water effect ${enabled ? "enabled" : "disabled"}`);
      },
      // 并行脚本
      getParallelScripts: () => this.scriptExecutor.getParallelScriptsForSave(),
      loadParallelScripts: (scripts) => this.scriptExecutor.loadParallelScriptsFromSave(scripts),
    });

    // Subscribe to GUI events via EventEmitter
    this.subscribeToGuiEvents();

    // Initialize handlers (after scriptExecutor is created)
    this.initializeHandlers();
  }

  /**
   * Subscribe to GUI events for script system integration
   */
  private subscribeToGuiEvents(): void {
    // 对话框关闭事件 - 通知脚本系统继续执行
    this.events.on(GameEvents.UI_DIALOG_CLOSED, () => {
      this.scriptExecutor.onDialogClosed();
    });
  }

  /**
   * Initialize handlers after core systems are ready
   */
  private initializeHandlers(): void {
    // Initialize magic handler
    // MagicHandler 通过 IEngineContext 获取 Player, GuiManager, MagicManager, MagicListManager
    this.magicHandler = new MagicHandler({
      getLastInput: () => this.inputHandler?.getLastInput() ?? null,
    });

    // Initialize input handler
    // InputHandler 通过 IEngineContext 获取各管理器，只需传入碰撞检测回调
    this.inputHandler = new InputHandler({
      isTileWalkable: (tile: Vector2) => MapBase.Instance.isTileWalkable(tile),
    });

    // Initialize special action handler
    // SpecialActionHandler 通过 IEngineContext 获取 Player 和 NpcManager
    this.specialActionHandler = new SpecialActionHandler();
  }

  /**
   * Load player sprites
   * Called by SaveManager after loading player config
   * Uses Player's loadSpritesFromNpcIni method directly
   */
  async loadPlayerSprites(npcIni: string): Promise<void> {
    const loaded = await this.player.loadSpritesFromNpcIni(npcIni);
    if (!loaded) {
      logger.warn(`[GameManager] Failed to load player sprites from ${npcIni}`);
    }
  }

  /**
   * Create script context for script executor
   */
  private createScriptContext(): ScriptContext {
    const context = createScriptContext({
      player: this.player,
      npcManager: this.npcManager,
      guiManager: this.guiManager,
      objManager: this.objManager,
      audioManager: this.audioManager,
      screenEffects: this.screenEffects,
      talkTextList: this.talkTextList,
      memoListManager: this.memoListManager,
      weatherManager: this.weatherManager,
      timerManager: this.timerManager,
      buyManager: this.buyManager,
      getVariables: () => this.variables,
      setVariable: (name, value) => {
        this.variables[name] = value;
      },
      getCurrentMapName: () => this.currentMapName,
      loadMap: (mapPath) => this.loadMap(mapPath),
      loadNpcFile: (fileName) => this.loadNpcFile(fileName),
      loadGameSave: (index) => this.loadGameSave(index),
      setMapTrap: (trapIndex, trapFileName, mapName) => {
        MapBase.Instance.setMapTrap(trapIndex, trapFileName, mapName);
      },
      checkTrap: (tile) => this.checkTrap(tile),
      cameraMoveTo: (direction, distance, speed) => {
        this.cameraController.moveTo(direction, distance, speed);
      },
      cameraMoveToPosition: (destX, destY, speed) => {
        this.cameraMoveToPosition(destX, destY, speed);
      },
      isCameraMoving: () => this.cameraController.isMovingByScript(),
      isCameraMoveToPositionEnd: () => this.isCameraMoveToPositionEnd(),
      setCameraPosition: (pixelX, pixelY) => {
        this.setCameraPosition(pixelX, pixelY);
      },
      centerCameraOnPlayer: () => {
        this.centerCameraOnPlayer();
      },
      runScript: (scriptFile) => this.scriptExecutor.runScript(scriptFile),
      // Save/Drop flags
      enableSave: () => this.enableSave(),
      disableSave: () => this.disableSave(),
      enableDrop: () => this.enableDrop(),
      disableDrop: () => this.disableDrop(),
      // Show map pos flag
      setScriptShowMapPos: (show) => this.setScriptShowMapPos(show),
      // Map time
      setMapTime: (time) => this.setMapTime(time),
      // Trap save
      saveMapTrap: () => this.saveMapTrap(),
      // Debug hooks
      onScriptStart: this.debugManager.onScriptStart,
      onLineExecuted: this.debugManager.onLineExecuted,
      // Input control
      clearMouseInput: this.clearMouseInput,
      // Return to title
      returnToTitle: () => {
        // C# Reference: ScriptExecuter.ReturnToTitle()
        // 1. 清除并行脚本
        this.scriptExecutor.clearParallelScripts();
        // 2. 停止所有脚本执行
        this.scriptExecutor.stopAllScripts();
        // 3. 发送返回标题事件，由 React 层处理 GUI 和状态重置
        this.events.emit(GameEvents.RETURN_TO_TITLE, {});
      },
    });

    // Override getCurrentMapPath to return the actual value
    context.getCurrentMapPath = () => this.currentMapPath;

    return context;
  }

  /**
   * Get base path for scripts
   */
  getScriptBasePath(): string {
    const basePath = this.currentMapName
      ? ResourcePath.scriptMap(this.currentMapName)
      : ResourcePath.scriptCommon("").replace(/\/$/, "");
    return basePath;
  }

  /**
   * Get MapBase for IEngineContext
   */
  getMapService() {
    return MapBase.Instance;
  }

  /**
   * Handle selection made (from DialogUI or SelectionUI)
   */
  onSelectionMade(index: number): void {
    this.scriptExecutor.onSelectionMade(index);
  }

  /**
   * Check and trigger trap at tile
   */
  private checkTrap(tile: Vector2): void {
    MapBase.CheckTrap(
      tile,
      this.mapData,
      this.currentMapName,
      () => this.scriptExecutor.isRunning(),
      () => this.scriptExecutor.isWaitingForInput(),
      () => this.getScriptBasePath(),
      (scriptPath) => this.scriptExecutor.runScript(scriptPath),
      // C#: Globals.ThePlayer.StandingImmediately()
      // Player should stop immediately when trap is triggered
      () => this.player.standingImmediately()
    );
  }

  /**
   * Load a map
   */
  async loadMap(mapPath: string): Promise<void> {
    logger.debug(`[GameManager] Loading map: ${mapPath}`);
    this.currentMapPath = mapPath;

    // Extract map name from path
    const mapFileName = mapPath.split("/").pop() || mapPath;
    this.currentMapName = mapFileName.replace(/\.map$/i, "");

    // Clear NPCs and Objs
    this.npcManager.clearAllNpcs();
    this.objManager.clearAll();
    // NOTE: 不要在换地图时清除脚本缓存！
    // 脚本缓存是全局的，应该在游戏运行期间保持
    // 只在新游戏/加载存档时才应该清除缓存（在 loader.ts 中处理）
    // this.scriptExecutor.clearCache();

    // 注意：不清空 ignoredTrapIndices
    // C# 中 _ingnoredTrapsIndex 只在 LoadTrap（加载存档时）才会清空
    // 因为 ignoredTrapIndices 是跨地图的全局状态
    // this.trapManager.clearIgnoredTraps(); // 移除此调用

    // Load map data via callback
    if (this.config.onMapChange) {
      this.mapData = await this.config.onMapChange(mapPath);

      if (this.mapData) {
        logger.debug(
          `[GameManager] Map loaded: ${this.mapData.mapColumnCounts}x${this.mapData.mapRowCounts} tiles`
        );

        // Update MapBase with new map data
        MapBase.Instance.setMapData(this.mapData);

        // MagicManager 现在通过 IEngineContext 获取碰撞检测器
        // 无需手动设置 setMapObstacleChecker

        // Debug trap info
        MapBase.DebugLogTraps(this.mapData, this.currentMapName);
      }
    }
    logger.debug(`[GameManager] Map loaded successfully`);
  }

  /**
   * Load NPC file
   */
  async loadNpcFile(fileName: string): Promise<void> {
    logger.log(`[GameManager] Loading NPC file: ${fileName}`);
    await this.npcManager.loadNpcFile(fileName);
  }

  /**
   * Load game save from a save slot
   * Delegates to Loader
   *
   * C#: LoadGame(index)
   * - index 0 = initial save (used by NewGame)
   * - index 1-7 = user save slots
   */
  async loadGameSave(index: number): Promise<void> {
    // 只在加载用户存档时清空脚本历史（index 0 是 NewGame 调用的初始存档）
    if (index !== 0) {
      this.debugManager.clearScriptHistory();
    }
    await this.loader.loadGame(index);
  }

  /**
   * 从 localStorage 槽位加载存档 (JSON)
   *
   * @param index 存档槽位索引 (1-7)
   */
  async loadGameFromSlot(index: number): Promise<boolean> {
    // 清空脚本历史和当前脚本状态
    this.debugManager.clearScriptHistory();
    return await this.loader.loadGameFromSlot(index);
  }

  /**
   * 设置加载进度回调
   *
   * 用于在加载存档时向 UI 报告进度
   */
  setLoadProgressCallback(callback: ((progress: number, text: string) => void) | undefined): void {
    this.loader.setProgressCallback(callback);
  }

  /**
   * 保存游戏到指定槽位 (JSON -> localStorage)
   *
   * @param index 存档槽位索引 (1-7)
   */
  async saveGame(index: number): Promise<boolean> {
    return await this.loader.saveGame(index);
  }

  /**
   * 开始新游戏
   * Delegates to Loader
   *
   * 对应 C# 的 Loader.NewGame()
   */
  async newGame(): Promise<void> {
    await this.loader.newGame();
  }

  /**
   * Set map data
   * 同时更新 MapBase 单例
   */
  setMapData(mapData: JxqyMapData): void {
    this.mapData = mapData;
    MapBase.Instance.setMapData(mapData);
  }

  /**
   * Set current map name
   * 同时更新 MapBase 的地图文件名
   */
  setCurrentMapName(mapName: string): void {
    this.currentMapName = mapName;
    // 更新 MapBase 的地图信息
    MapBase.MapFileNameWithoutExtension = mapName;
    MapBase.MapFileName = `${mapName}.map`;
  }

  /**
   * Handle keyboard input
   * Delegates to InputHandler
   */
  handleKeyDown(code: string, shiftKey: boolean = false): boolean {
    return this.inputHandler.handleKeyDown(code, shiftKey);
  }

  /**
   * Use magic from bottom slot index (0-4)
   * Delegates to MagicHandler
   * C# Reference: Character.UseMagic and PerformeAttack
   */
  async useMagicByBottomSlot(slotIndex: number): Promise<void> {
    await this.magicHandler.useMagicByBottomSlot(slotIndex);
  }

  /**
   * Handle mouse click
   * Delegates to InputHandler
   */
  handleClick(
    worldX: number,
    worldY: number,
    button: "left" | "right",
    ctrlKey: boolean = false,
    altKey: boolean = false
  ): void {
    this.inputHandler.handleClick(worldX, worldY, button, ctrlKey, altKey);
  }

  /**
   * Handle continuous mouse input for movement
   * Delegates to InputHandler
   */
  handleContinuousMouseInput(input: InputState): void {
    this.inputHandler.handleContinuousMouseInput(input);
  }

  /**
   * Interact with an NPC
   * Delegates to InputHandler
   */
  async interactWithNpc(npc: Npc): Promise<void> {
    await this.inputHandler.interactWithNpc(npc);
  }

  /**
   * Update game state
   */
  update(deltaTime: number, input: InputState): void {
    if (this.isPaused) return;

    // Store input for mouse position access in other methods (e.g., magic targeting)
    // C# Reference: Player.cs tracks mouseState for UseMagic destination
    this.inputHandler.setLastInput(input);

    this.gameTime += deltaTime;

    // ========== SuperMode 优先处理 ==========
    // C# Reference: JxqyGame.UpdatePlaying
    // if (Globals.IsInSuperMagicMode) {
    //     Globals.SuperModeMagicSprite.Update(gameTime);
    //     return; // Just update super magic
    // }
    // 在 SuperMode 时，只更新 MagicManager（它内部只更新 SuperMode 精灵）
    // 其他系统（Player、NPC、ObjManager 等）都暂停
    if (this.magicManager.isInSuperMagicMode) {
      this.magicManager.update(deltaTime * 1000);
      // Update screen effects (for vibration, etc.)
      this.screenEffects.update(deltaTime);
      return;
    }

    // Update script executor
    this.scriptExecutor.update(deltaTime * 1000);

    // Reset trap flag when trap script finishes
    if (
      MapBase.IsInRunMapTrap &&
      !this.scriptExecutor.isRunning() &&
      !this.scriptExecutor.isWaitingForInput()
    ) {
      MapBase.IsInRunMapTrap = false;
    }

    // Update screen effects
    this.screenEffects.update(deltaTime);

    // Update GUI
    this.guiManager.update(deltaTime);

    // Check for special action completion
    this.specialActionHandler.update();

    // C#: CanInput = !Globals.IsInputDisabled && !ScriptManager.IsInRunningScript && MouseInBound()
    // Don't process USER input if GUI is blocking OR script is running
    // This matches C# behavior where player cannot move via mouse/keyboard during script execution
    // BUT we still need to update player movement for script-controlled movement (PlayerGoto, etc.)
    const canInput = this.inputHandler.canProcessInput();

    if (canInput) {
      // Handle mouse held for continuous movement
      if (input.isMouseDown && input.clickedTile) {
        this.handleContinuousMouseInput(input);
      }

      // Handle keyboard and mouse movement
      this.player.handleInput(input, 0, 0);
    }

    // Update player - always runs, needed for script-controlled movement (PlayerGoto, etc.)
    this.player.update(deltaTime);

    // Update auto-attack behavior
    // C# Reference: Player.UpdateAutoAttack
    this.player.updateAutoAttack(deltaTime);

    // Check for pending interaction targets (player walking to interact with NPC/Obj)
    // C# Reference: Character.InteractIsOk called during Update
    this.inputHandler.update();

    // Check for trap at player's position
    if (!MapBase.IsInRunMapTrap) {
      const playerTile = this.player.tilePosition;
      this.checkTrap(playerTile);
    }

    // Update NPCs
    this.npcManager.update(deltaTime);

    // Update Objects (animation, PlayFrames, trap damage, etc.)
    // C# Reference: ObjManager.Update - updates all Obj sprites
    // Obj 内部通过 engine (IEngineContext) 直接访问 NpcManager、Player 和 ScriptExecutor
    this.objManager.update(deltaTime);

    // Update magic system - cooldowns and active magic sprites
    this.magicListManager.updateCooldowns(deltaTime * 1000);
    this.magicManager.update(deltaTime * 1000);

    // Update HUD
    this.guiManager.updateHud(
      this.player.life,
      this.player.lifeMax,
      this.player.mana,
      this.player.manaMax,
      this.player.thew,
      this.player.thewMax
    );
  }

  // ============= Getters =============

  /**
   * Get player instance
   */
  getPlayer(): Player {
    return this.player;
  }

  getNpcManager(): NpcManager {
    return this.npcManager;
  }

  /**
   * Run a script file
   */
  async runScript(scriptPath: string): Promise<void> {
    return this.scriptExecutor.runScript(scriptPath);
  }

  /**
   * Queue a script for execution (non-blocking)
   * Used for externally triggered scripts (e.g., death scripts)
   * C# Reference: ScriptManager.RunScript adds to _list queue
   */
  queueScript(scriptPath: string): void {
    this.scriptExecutor.queueScript(scriptPath);
  }

  getObjManager(): ObjManager {
    return this.objManager;
  }

  getGuiManager(): GuiManager {
    return this.guiManager;
  }

  getGoodsListManager(): GoodsListManager {
    return this.goodsListManager;
  }

  getMagicListManager(): MagicListManager {
    return this.magicListManager;
  }

  getMagicManager(): MagicManager {
    return this.magicManager;
  }

  getGoodsVersion(): number {
    return this.goodsVersion;
  }

  incrementGoodsVersion(): void {
    this.goodsVersion++;
  }

  getMagicVersion(): number {
    return this.magicVersion;
  }

  incrementMagicVersion(): void {
    this.magicVersion++;
  }

  getBuyManager(): BuyManager {
    return this.buyManager;
  }

  getBuyVersion(): number {
    return this.buyVersion;
  }

  getMemoList(): string[] {
    return this.guiManager.getMemoList();
  }

  getScriptExecutor(): ScriptExecutor {
    return this.scriptExecutor;
  }

  getVariables(): GameVariables {
    return this.variables;
  }

  setVariable(name: string, value: number): void {
    this.variables[name] = value;
  }

  getVariable(name: string): number {
    return this.variables[name] || 0;
  }

  getCurrentMapName(): string {
    return this.currentMapName;
  }

  getCurrentMapPath(): string {
    return this.currentMapPath;
  }

  getMapData(): JxqyMapData | null {
    return this.mapData;
  }

  /**
   * Check if tile has a trap script
   * IEngineContext 接口实现
   */
  hasTrapScript(tile: Vector2): boolean {
    return MapBase.HasTrapScriptWithMapData(tile, this.mapData, this.currentMapName);
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  getGameTime(): number {
    return this.gameTime;
  }

  setEventId(id: number): void {
    this.eventId = id;
    this.variables.Event = id;
  }

  getEventId(): number {
    return this.eventId;
  }

  async addDemoNpcs(): Promise<void> {
    const demoNpcs = [
      { name: "章妈", file: "忘忧岛章妈.ini", x: 15, y: 20 },
      { name: "居民1", file: "忘忧岛居民1.ini", x: 18, y: 25 },
      { name: "居民2", file: "忘忧岛居民2.ini", x: 22, y: 22 },
    ];

    for (const npc of demoNpcs) {
      await this.npcManager.addNpc(ResourcePath.npc(npc.file), npc.x, npc.y);
    }
  }

  // ============= Audio and Effects =============

  getAudioManager(): AudioManager {
    return this.audioManager;
  }

  getScreenEffects(): ScreenEffects {
    return this.screenEffects;
  }

  drawScreenEffects(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.screenEffects.drawFade(ctx, width, height);
    this.screenEffects.drawFlash(ctx, width, height);
  }

  isFading(): boolean {
    return this.screenEffects.isFading();
  }

  getLevelFile(): string {
    return this.levelFile;
  }

  getLevelManager() {
    return this.player.levelManager;
  }

  getDebugManager(): DebugManager {
    return this.debugManager;
  }

  getInteractionManager(): InteractionManager {
    return this.interactionManager;
  }

  getMagicHandler(): MagicHandler {
    return this.magicHandler;
  }

  isGodMode(): boolean {
    return this.debugManager.isGodMode();
  }

  // ============= Save/Drop Flags =============

  enableSave(): void {
    this.saveEnabled = true;
  }

  disableSave(): void {
    this.saveEnabled = false;
  }

  isSaveEnabled(): boolean {
    return this.saveEnabled;
  }

  enableDrop(): void {
    this.dropEnabled = true;
  }

  disableDrop(): void {
    this.dropEnabled = false;
  }

  isDropEnabled(): boolean {
    return this.dropEnabled;
  }

  // ============= Show Map Pos =============

  setScriptShowMapPos(show: boolean): void {
    this.scriptShowMapPos = show;
  }

  isScriptShowMapPos(): boolean {
    return this.scriptShowMapPos;
  }

  // ============= Map Time =============

  setMapTime(time: number): void {
    this.mapTime = time;
    logger.debug(`[GameManager] SetMapTime: ${time}`);
  }

  getMapTime(): number {
    return this.mapTime;
  }

  // ============= Map Trap =============

  /**
   * Save map trap configuration
   * C#: MapBase.SaveTrap(@"save\game\Traps.ini")
   */
  saveMapTrap(): void {
    const trapData = MapBase.CollectTrapDataForSave();
    try {
      localStorage.setItem("jxqy_traps", JSON.stringify(trapData));
      logger.log(`[GameManager] SaveMapTrap: saved ${trapData.ignoreList.length} ignored indices`);
    } catch (e) {
      logger.error("[GameManager] SaveMapTrap failed:", e);
    }
  }

  // ============= Camera =============

  cameraMoveTo(direction: number, distance: number, speed: number): void {
    // 取消待处理的居中请求，因为脚本明确要移动相机
    this.pendingCenterOnPlayer = false;
    this.cameraController.moveTo(direction, distance, speed);
  }

  cameraMoveToPosition(destX: number, destY: number, speed: number): void {
    // 取消待处理的居中请求，因为脚本明确要移动相机
    this.pendingCenterOnPlayer = false;
    this.cameraController.moveToPosition(destX, destY, speed);
  }

  isCameraMoveToPositionEnd(): boolean {
    return !this.cameraController.isMovingToPositionActive();
  }

  updateCameraMovement(
    cameraX: number,
    cameraY: number,
    deltaTime: number
  ): { x: number; y: number } | null {
    return this.cameraController.update(cameraX, cameraY, deltaTime);
  }

  isCameraMovingByScript(): boolean {
    return this.cameraController.isMovingByScript();
  }

  /**
   * Set camera position directly (for SetMapPos command)
   * Will be applied by GameEngine
   */
  private pendingCameraPosition: { x: number; y: number } | null = null;

  setCameraPosition(pixelX: number, pixelY: number): void {
    this.pendingCameraPosition = { x: pixelX, y: pixelY };
  }

  /**
   * Get pending camera position (consumed by GameEngine)
   */
  consumePendingCameraPosition(): { x: number; y: number } | null {
    const pos = this.pendingCameraPosition;
    this.pendingCameraPosition = null;
    return pos;
  }

  /**
   * Request to center camera on player
   * C#: Carmera.CenterPlayerInCamera()
   */
  private pendingCenterOnPlayer: boolean = false;

  centerCameraOnPlayer(): void {
    this.pendingCenterOnPlayer = true;
  }

  /**
   * Check and consume pending center on player request
   */
  consumePendingCenterOnPlayer(): boolean {
    const pending = this.pendingCenterOnPlayer;
    this.pendingCenterOnPlayer = false;
    return pending;
  }

  // ============= Interaction System =============

  /**
   * Update mouse hover state for interaction highlights
   * C# Reference: Player.cs HandleMouseInput - OutEdge detection
   *
   * @param worldX Mouse world X coordinate
   * @param worldY Mouse world Y coordinate
   * @param viewRect View rectangle for visible entities
   */
  updateMouseHover(
    worldX: number,
    worldY: number,
    viewRect: { x: number; y: number; width: number; height: number }
  ): void {
    this.inputHandler.updateMouseHover(worldX, worldY, viewRect);
  }

  // ============= Script Execution =============

  async executeScript(input: string): Promise<string | null> {
    try {
      const trimmed = input.trim();
      logger.log(`[GameManager] Executing script content directly`);
      await this.scriptExecutor.runScriptContent(trimmed, "DebugPanel");
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[GameManager] Script execution error:`, error);
      return errorMessage;
    }
  }

  /**
   * Add magic to player's magic list
   * Used by script commands (AddMagic)
   */
  async addPlayerMagic(magicFile: string, level: number = 1): Promise<boolean> {
    return this.magicHandler.addPlayerMagic(magicFile, level);
  }

  /**
   * Get magic items for bottom slots (for UI display)
   * Returns 5 MagicItemInfo for bottom slots
   */
  getBottomMagics(): (MagicItemInfo | null)[] {
    return this.magicHandler.getBottomMagics();
  }

  /**
   * Get magic items for store (for MagicGui display)
   * Returns all magics in store area (indices 1-36)
   */
  getStoreMagics(): (MagicItemInfo | null)[] {
    return this.magicHandler.getStoreMagics();
  }

  /**
   * Handle magic drag-drop from MagicGui to BottomGui
   */
  handleMagicDrop(sourceStoreIndex: number, targetBottomSlot: number): void {
    this.magicHandler.handleMagicDrop(sourceStoreIndex, targetBottomSlot);
  }

  /**
   * Right-click magic in MagicGui to add to first empty bottom slot
   * C# Reference: MagicGui.MouseRightClickdHandler
   */
  handleMagicRightClick(storeIndex: number): void {
    this.magicHandler.handleMagicRightClick(storeIndex);
  }
}
