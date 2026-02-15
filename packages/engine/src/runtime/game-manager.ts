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
 * - MagicCaster: 武功使用和管理
 * - InputHandler: 键盘和鼠标输入处理
 * - SpecialActionHandler: 特殊动作状态更新
 *
 * ================================================
 */

import type { AudioManager } from "../audio";
import type { TypedEventEmitter } from "../core/event-emitter";
import { type GameEventMap, GameEvents } from "../core/game-events";
import { logger } from "../core/logger";
import type { GameVariables, Vector2 } from "../core/types";
import { CharacterState } from "../core/types";
import { BuyManager } from "../gui/buy-manager";
import { GuiManager } from "../gui/gui-manager";
import type { MemoListManager } from "../gui/memo-list-manager";
import type { TalkTextListManager } from "../gui/talk-text-list";
import type { MagicItemInfo } from "../magic";
import { MagicSpriteManager } from "../magic";
import { MagicCaster } from "../magic/magic-caster";
import type { MagicRenderer } from "../magic/magic-renderer";
import type { MapBase } from "../map/map-base";
import { clearMpcAtlasCache } from "../map/map-renderer";
import type { MiuMapData } from "../map/types";
import type { Npc } from "../npc";
import { NpcManager } from "../npc";
import type { Obj, ObjManager } from "../obj";
import type { Good, GoodsListManager } from "../player/goods";
import type { GoodsItemInfo } from "../player/goods/goods-list-manager";
import type { PlayerMagicInventory } from "../player/magic/player-magic-inventory";
import type { PartnerListManager } from "../player/partner-list";
import { Player } from "../player/player";
import type { Renderer } from "../renderer/renderer";
import type { ScreenEffects } from "../renderer/screen-effects";
import { clearAsfCache } from "../resource/format/asf";
import { clearMpcCache } from "../resource/format/mpc";
import { ResourcePath } from "../resource/resource-paths";
import type { ScriptCommandContext } from "../script/api/types";
import { ScriptExecutor } from "../script/executor";
// Import refactored modules
import { createScriptAPI } from "../script/script-context-factory";
import { Sprite } from "../sprite/sprite";
import { Loader } from "../storage/game-save-manager";
import type { SaveData } from "../storage/save-types";
import type { WeatherManager } from "../weather";
import { CameraController } from "./camera-controller";
import type { DebugManager } from "./debug-manager";
import { InputHandler } from "./input-handler";
import type { InputState } from "./input-types";
import { InteractionManager } from "./interaction-manager";
import { ItemActionHandler } from "./item-action-handler";
import type { TimerManager } from "./timer-manager";

export interface GameManagerConfig {
  onMapChange: (mapPath: string) => Promise<MiuMapData>;
  // 立即将摄像机居中到玩家位置（用于加载存档后避免摄像机飞过去）
  centerCameraOnPlayer: () => void;
  // 通知 UI 刷新玩家状态（切换角色、读档等）
  notifyPlayerStateChanged: () => void;
  /** 设置地图 MPC/MSF 加载进度回调（由 Loader 控制） */
  setMapProgressCallback: (callback: ((progress: number, text: string) => void) | null) => void;
}

/**
 * 依赖注入 - GameManager 需要的所有外部依赖
 */
export interface GameManagerDeps {
  events: TypedEventEmitter<GameEventMap>;
  audioManager: AudioManager;
  screenEffects: ScreenEffects;
  objManager: ObjManager;
  talkTextList: TalkTextListManager;
  debugManager: DebugManager;
  memoListManager: MemoListManager;
  weatherManager: WeatherManager;
  timerManager: TimerManager;
  map: MapBase;
  magicRenderer: MagicRenderer;
  partnerList: PartnerListManager;
  clearMouseInput?: () => void; // 清除鼠标按住状态（对话框弹出时调用）
}

export class GameManager {
  // Injected dependencies
  private events: TypedEventEmitter<GameEventMap>;
  private talkTextList: TalkTextListManager;
  private memoListManager: MemoListManager;
  private readonly magicRenderer: MagicRenderer;
  private readonly partnerList: PartnerListManager;

  // Core systems — 公开只读，GameEngine 直接访问（避免纯透传 getter）
  readonly player: Player;
  readonly npcManager: NpcManager;
  readonly objManager: ObjManager;
  readonly scriptExecutor!: ScriptExecutor;
  readonly guiManager: GuiManager;
  readonly audioManager: AudioManager;
  readonly screenEffects: ScreenEffects;
  readonly debugManager: DebugManager;
  readonly goodsListManager: GoodsListManager;
  readonly magicInventory: PlayerMagicInventory;
  readonly magicSpriteManager: MagicSpriteManager;

  // Shop system
  readonly buyManager: BuyManager;
  private buyVersion: number = 0;

  // 地图基类（由引擎注入）
  private readonly map: MapBase;

  // Refactored modules
  private weatherManager: WeatherManager;
  private timerManager: TimerManager;
  private loader: Loader;
  private cameraController: CameraController;
  magicCaster!: MagicCaster;
  private inputHandler!: InputHandler;
  interactionManager!: InteractionManager;
  private itemActionHandler!: ItemActionHandler;

  // Game state
  private variables: GameVariables = {};
  private currentMapPath: string = "";
  private currentMapName: string = "";
  private mapData!: MiuMapData;
  private hasMapData: boolean = false;
  private saveEnabled: boolean = true;
  private dropEnabled: boolean = true;
  private scriptShowMapPos: boolean = false;
  private mapTime: number = 0;

  // Configuration
  private config: GameManagerConfig;

  // Timing
  private gameTime: number = 0;
  private isPaused: boolean = false;

  // Good UI version (increment to trigger re-render)
  private goodsVersion: number = 0;

  // Magic UI version (increment to trigger re-render)
  private magicVersion: number = 0;

  // Event tracking
  private eventId: number = 0;

  // Level/experience file
  private levelFile: string = "";

  // Input control callback
  private clearMouseInput?: () => void;

  constructor(deps: GameManagerDeps, config: GameManagerConfig) {
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
    this.map = deps.map;
    this.magicRenderer = deps.magicRenderer;
    this.partnerList = deps.partnerList;

    // Initialize systems
    this.player = new Player();

    this.npcManager = new NpcManager();
    // NPC 现在通过 EngineContext.player 获取 Player 引用
    // AudioManager, ObjManager, MagicSpriteManager 现在由各组件通过 EngineContext 获取
    this.guiManager = new GuiManager(this.events, this.memoListManager);

    // Initialize camera controller (before MagicSpriteManager, as it needs vibrateScreen callback)
    this.cameraController = new CameraController();

    // Initialize interaction manager
    this.interactionManager = new InteractionManager();

    // 从 Player 获取 GoodsListManager 和 PlayerMagicInventory
    // Player 持有这些 manager，GameManager 只是引用它们
    this.goodsListManager = this.player.getGoodsListManager();
    this.magicInventory = this.player.getPlayerMagicInventory();

    // Set up goods manager callbacks
    this.goodsListManager.setCallbacks({
      onEquiping: (good: Good | null, currentEquip: Good | null, justEffectType?: boolean) => {
        if (good) this.player.equiping(good, currentEquip, justEffectType);
      },
      onUnEquiping: (good: Good | null, justEffectType?: boolean) => {
        if (good) this.player.unEquiping(good, justEffectType);
      },
      onUpdateView: () => {
        this.goodsVersion++;
        this.events.emit(GameEvents.UI_GOODS_CHANGE, { version: this.goodsVersion });
      },
    });

    // Set up magic manager callbacks for UI updates
    // 注意：不能覆盖 Player 已设置的回调，需要添加而不是替换
    this.magicInventory.addCallbacks({
      onUpdateView: () => {
        this.magicVersion++;
        this.events.emit(GameEvents.UI_MAGIC_CHANGE, { version: this.magicVersion });
      },
    });

    // Initialize magic manager (for magic sprites/effects)
    this.magicSpriteManager = new MagicSpriteManager({
      player: this.player,
      npcManager: this.npcManager,
      guiManager: this.guiManager,
      screenEffects: this.screenEffects,
      audio: this.audioManager,
      magicInventory: this.magicInventory,
      magicRenderer: this.magicRenderer,
      vibrateScreen: (intensity) => this.cameraController.vibrateScreen(intensity),
    });

    // MagicSpriteManager 现在由 NPCs 通过 EngineContext 获取

    // Initialize buy manager (shop system)
    this.buyManager = new BuyManager();
    this.buyManager.setCallbacks({
      onShowMessage: (msg) => this.guiManager.showMessage(msg),
      onUpdateView: () => {
        this.buyVersion++;
        this.events.emit(GameEvents.UI_BUY_CHANGE, {
          isOpen: this.buyManager.isOpen(),
          version: this.buyVersion,
        });
      },
    });

    // Set up system references for notifications
    // Player 通过 EngineContext 获取 GuiManager
    this.player.setOnMoneyChange(() => {
      this.goodsVersion++;
      this.events.emit(GameEvents.UI_GOODS_CHANGE, { version: this.goodsVersion });
    });
    // DebugManager 通过 EngineContext 获取 Player, NpcManager, GuiManager, ObjManager

    // Create script API
    const { api, resolver, debugHooks, setRunParallelScript } = this.buildScriptAPI();
    this.scriptExecutor = new ScriptExecutor(api, resolver, debugHooks);

    // Set up runParallelScript callback (after ScriptExecutor is created)
    setRunParallelScript((scriptFile: string, delay: number) => {
      this.scriptExecutor.runParallelScript(scriptFile, delay);
    });

    // Set up extended systems for debug manager (after scriptExecutor is created)
    // GoodsListManager 和 PlayerMagicInventory 通过 Player 访问
    this.debugManager.setExtendedSystems(
      this.scriptExecutor,
      () => this.variables,
      () => ({ mapName: this.currentMapName, mapPath: this.currentMapPath }),
      () => this.map.getIgnoredTrapIndices(),
      (name, value) => this.setVariable(name, value)
    );

    // Initialize loader (after scriptExecutor is created)
    // GoodsListManager 和 PlayerMagicInventory 由 Player 持有，Loader 通过 player 访问
    this.loader = new Loader({
      player: this.player,
      npcManager: this.npcManager,
      objManager: this.objManager,
      audioManager: this.audioManager,
      screenEffects: this.screenEffects,
      memoListManager: this.memoListManager,
      guiManager: this.guiManager,
      map: this.map,
      getScriptExecutor: () => this.scriptExecutor,
      loadMap: (mapPath) => this.loadMap(mapPath),
      clearScriptCache: () => this.scriptExecutor.clearCache(),
      clearResourceCaches: () => {
        // 清理精灵缓存（SpriteSet 持有 AsfData 和 atlas canvas）
        Sprite.clearCache();
        // 清理 ASF 解析缓存（从 resourceLoader.iniCache 删除 asf: 前缀条目）
        clearAsfCache();
        // 清理 MPC 解析缓存（从 resourceLoader.iniCache 删除 mpc: 前缀条目）
        clearMpcCache();
        // 清理 MPC atlas canvas 缓存
        clearMpcAtlasCache();
        // 清理武功效果 ASF 缓存
        this.magicRenderer.clearCache();
        logger.debug("[GameManager] Resource caches cleared (sprite, asf, mpc, magic)");
      },
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
      setMapProgressCallback: (cb) => this.config.setMapProgressCallback(cb),
      // 存档相关依赖
      getVariables: () => this.variables,
      setVariables: (vars) => {
        this.variables = { ...vars };
        logger.debug(
          `[GameManager] Variables restored: ${Object.keys(this.variables).length} keys`
        );
      },
      getCurrentMapName: () => this.currentMapName,
      // 加载存档后立即居中摄像机（避免摄像机飞过去）
      centerCameraOnPlayer: () => this.config.centerCameraOnPlayer(),

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
        logger.debug(
          `[GameManager] Weather restored: snow=${state.snowShow}, rain=${!!state.rainFile}`
        );
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
        logger.debug(
          `[GameManager] Timer restored: on=${state.isOn}, seconds=${state.totalSecond}`
        );
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
    // MagicCaster 通过 EngineContext 获取 Player, GuiManager, MagicSpriteManager, PlayerMagicInventory
    this.magicCaster = new MagicCaster({
      getLastInput: () => this.inputHandler.getLastInput(),
    });

    // Initialize input handler
    // InputHandler 通过 EngineContext 获取各管理器，只需传入碰撞检测回调
    this.inputHandler = new InputHandler({
      isTileWalkable: (tile: Vector2) => this.map.isTileWalkable(tile),
    });

    // Initialize item action handler
    this.itemActionHandler = new ItemActionHandler({
      player: this.player,
      goodsListManager: this.goodsListManager,
      buyManager: this.buyManager,
      guiManager: this.guiManager,
      npcManager: this.npcManager,
    });
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
   * Create script API for script executor
   */
  private buildScriptAPI() {
    const getCharacterByName = (name: string) => {
      if (this.player.name === name) return this.player;
      return this.npcManager.getNpc(name);
    };
    const getCharactersByName = (name: string) => {
      const result: (Npc | Player)[] = [];
      if (this.player.name === name) result.push(this.player);
      result.push(...this.npcManager.getAllNpcsByName(name));
      return result;
    };
    const getScriptBasePath = (): string => {
      return this.currentMapName
        ? ResourcePath.scriptMap(this.currentMapName)
        : ResourcePath.scriptCommon("").replace(/\/$/, "");
    };

    const ctx: ScriptCommandContext = {
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
      partnerList: this.partnerList,
      levelManager: this.player.levelManager,
      goodsListManager: this.player.getGoodsListManager(),
      getCharacterByName,
      getCharactersByName,
      getScriptBasePath,
      getVariables: () => this.variables,
      setVariable: (name, value) => {
        this.variables[name] = value;
      },
      getCurrentMapName: () => this.currentMapName,
      getCurrentMapPath: () => this.currentMapPath,
      loadMap: (mapPath) => this.loadMap(mapPath),
      loadNpcFile: (fileName) => this.loadNpcFile(fileName),
      loadGameSave: (index) => this.loadGameSave(index),
      setMapTrap: (trapIndex, trapFileName, mapName) =>
        this.map.setMapTrap(trapIndex, trapFileName, mapName),
      checkTrap: (tile) => this.checkTrap(tile),
      cameraMoveTo: (direction, distance, speed) =>
        this.cameraController.moveTo(direction, distance, speed),
      cameraMoveToPosition: (destX, destY, speed) => this.cameraMoveToPosition(destX, destY, speed),
      isCameraMoving: () => this.cameraController.isMovingByScript(),
      isCameraMoveToPositionEnd: () => this.isCameraMoveToPositionEnd(),
      setCameraPosition: (pixelX, pixelY) => this.setCameraPosition(pixelX, pixelY),
      centerCameraOnPlayer: () => this.centerCameraOnPlayer(),
      runScript: (scriptFile) => this.scriptExecutor.runScript(scriptFile),
      enableSave: () => this.enableSave(),
      disableSave: () => this.disableSave(),
      enableDrop: () => this.enableDrop(),
      disableDrop: () => this.disableDrop(),
      isMapObstacleForCharacter: (x, y) => this.map.isObstacleForCharacter(x, y),
      setScriptShowMapPos: (show) => this.setScriptShowMapPos(show),
      setMapTime: (time) => this.setMapTime(time),
      saveMapTrap: () => this.saveMapTrap(),
      changePlayer: async (index) => {
        this.loader.saveCurrentPlayerToMemory();
        this.player.setPlayerIndexSilent(index);
        await this.loader.loadPlayerDataFromMemory();
        this.config.notifyPlayerStateChanged();
      },
      onScriptStart: this.debugManager.onScriptStart,
      onLineExecuted: this.debugManager.onLineExecuted,
      clearMouseInput: this.clearMouseInput,
      returnToTitle: () => {
        this.scriptExecutor.clearParallelScripts();
        this.scriptExecutor.stopAllScripts();
        this.events.emit(GameEvents.RETURN_TO_TITLE, {});
      },
    };
    return createScriptAPI(ctx);
  }

  getScriptBasePath(): string {
    return this.currentMapName
      ? ResourcePath.scriptMap(this.currentMapName)
      : ResourcePath.scriptCommon("").replace(/\/$/, "");
  }

  getMapService() {
    return this.map;
  }
  onSelectionMade(index: number): void {
    this.scriptExecutor.onSelectionMade(index);
  }

  /**
   * Check and trigger trap at tile
   */
  private checkTrap(tile: Vector2): void {
    const mapData = this.requireMapData();
    this.map.checkTrap(
      tile,
      mapData,
      this.currentMapName,
      () => this.scriptExecutor.isRunning(),
      () => this.scriptExecutor.isWaitingForInput(),
      () => this.getScriptBasePath(),
      (scriptPath) => this.scriptExecutor.runScript(scriptPath),
      // Globals.ThePlayer.StandingImmediately()
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

    // Extract map name from path (strip both .map and .mmf extensions)
    const mapFileName = mapPath.split("/").pop() || mapPath;
    this.currentMapName = mapFileName.replace(/\.(map|mmf)$/i, "");

    // Clear NPCs and Objs (keep partners)
    this.npcManager.clearAllNpcAndKeepPartner();
    this.objManager.clearAll();
    // NOTE: 不要在换地图时清除脚本缓存！
    // 脚本缓存是全局的，应该在游戏运行期间保持
    // 只在新游戏/加载存档时才应该清除缓存（在 loader.ts 中处理）
    // this.scriptExecutor.clearCache();

    // 注意：不清空 ignoredTrapIndices
    // 中 _ignoredTrapsIndex 只在 LoadTrap（加载存档时）才会清空
    // 因为 ignoredTrapIndices 是跨地图的全局状态
    // this.trapManager.clearIgnoredTraps(); // 移除此调用

    // Load map data via callback
    const mapData = await this.config.onMapChange(mapPath);
    this.mapData = mapData;
    this.hasMapData = true;

    logger.debug(
      `[GameManager] Map loaded: ${mapData.mapColumnCounts}x${mapData.mapRowCounts} tiles`
    );

    // Update MapBase with new map data
    this.map.setMapData(mapData);

    // MagicSpriteManager 现在通过 EngineContext 获取碰撞检测器
    // 无需手动设置 setMapObstacleChecker

    // Debug trap info
    this.map.debugLogTraps(mapData, this.currentMapName);
    logger.debug(`[GameManager] Map loaded successfully`);
  }

  async loadNpcFile(fileName: string): Promise<void> {
    logger.log(`[GameManager] Loading NPC file: ${fileName}`);
    await this.npcManager.loadNpcFile(fileName);
  }

  /** Load game save (index 0 = initial save for NewGame, 1-7 = user slots) */
  async loadGameSave(index: number): Promise<void> {
    if (index !== 0) this.debugManager.clearScriptHistory();
    await this.loader.loadGame(index);
  }

  setLoadProgressCallback(callback: ((progress: number, text: string) => void) | undefined): void {
    this.loader.setProgressCallback(callback);
  }
  setLoadCompleteCallback(callback: (() => void) | undefined): void {
    this.loader.setLoadCompleteCallback(callback);
  }
  collectSaveData(): SaveData {
    return this.loader.collectSaveData();
  }
  async loadGameFromJSON(data: SaveData): Promise<void> {
    return this.loader.loadGameFromJSON(data);
  }
  async newGame(): Promise<void> {
    await this.loader.newGame();
  }

  setMapData(mapData: MiuMapData): void {
    this.mapData = mapData;
    this.hasMapData = true;
    this.map.setMapData(mapData);
  }

  setCurrentMapName(mapName: string): void {
    this.currentMapName = mapName;
    this.map.mapFileNameWithoutExtension = mapName;
    this.map.mapFileName = `${mapName}.map`;
  }

  getInputHandler(): InputHandler {
    return this.inputHandler;
  }
  async useMagicByBottomSlot(slotIndex: number): Promise<void> {
    await this.magicCaster.useMagicByBottomSlot(slotIndex);
  }
  async interactWithNpc(npc: Npc): Promise<void> {
    await this.inputHandler.interactWithNpc(npc);
  }
  async interactWithObj(obj: Obj): Promise<void> {
    await this.inputHandler.interactWithObj(obj);
  }

  /**
   * Update game state
   */
  update(deltaTime: number, input: InputState): void {
    if (this.isPaused) return;

    // Store input for mouse position access in other methods (e.g., magic targeting)
    // tracks mouseState for UseMagic destination
    this.inputHandler.setLastInput(input);

    this.gameTime += deltaTime;

    // ========== SuperMode 优先处理 ==========
    // 在 SuperMode 时，只更新 MagicSpriteManager（它内部只更新 SuperMode 精灵）
    // 其他系统（Player、NPC、ObjManager 等）都暂停
    if (this.magicSpriteManager.isInSuperMagicMode) {
      this.magicSpriteManager.update(deltaTime * 1000);
      // Update screen effects (for vibration, etc.)
      this.screenEffects.update(deltaTime);
      return;
    }

    // Update screen effects
    this.screenEffects.update(deltaTime);

    // Update GUI
    this.guiManager.update(deltaTime);

    // CanInput = !Globals.IsInputDisabled && !ScriptManager.IsInRunningScript && MouseInBound()
    // Don't process USER input if GUI is blocking OR script is running
    // This matches behavior where player cannot move via mouse/keyboard during script execution
    // BUT we still need to update player movement for script-controlled movement (PlayerGoto, etc.)
    const canInput = this.inputHandler.canProcessInput();

    if (canInput) {
      // Handle mouse held for continuous movement
      if (input.isMouseDown && input.clickedTile) {
        this.inputHandler.handleContinuousMouseInput(input);
      }

      // Handle keyboard and mouse movement
      this.player.handleInput(input, 0, 0);
    }

    // Update player - always runs, needed for script-controlled movement (PlayerGoto, etc.)
    this.player.update(deltaTime);

    // Update auto-attack behavior
    this.player.updateAutoAttack(deltaTime);

    // Check for pending interaction targets (player walking to interact with NPC/Obj)
    // called during Update
    this.inputHandler.update();

    // Check for trap at player's position
    if (!this.map.isInRunMapTrap) {
      const playerTile = this.player.tilePosition;
      this.checkTrap(playerTile);
    }

    // Update NPCs
    this.npcManager.update(deltaTime);

    // Update Objects (animation, PlayFrames, trap damage, etc.)
    // updates all Obj sprites
    // Obj 内部通过 engine (EngineContext) 直接访问 NpcManager、Player 和 ScriptExecutor
    this.objManager.update(deltaTime);

    // Update magic system - cooldowns and active magic sprites
    this.magicInventory.updateCooldowns(deltaTime * 1000);
    this.magicSpriteManager.update(deltaTime * 1000);

    // Check for special action completion (non-blocking NpcSpecialAction)
    this.updateSpecialActions();

    // Update script executor — AFTER character updates (matches C# update order)
    // C# 中 ScriptManager.Update 在角色更新之后运行，确保同帧内检测到动画结束
    this.scriptExecutor.update(deltaTime * 1000);

    // Reset trap flag when trap script finishes
    if (
      this.map.isInRunMapTrap &&
      !this.scriptExecutor.isRunning() &&
      !this.scriptExecutor.isWaitingForInput()
    ) {
      this.map.isInRunMapTrap = false;
    }

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
   * Run a script file
   */
  async runScript(scriptPath: string): Promise<void> {
    return this.scriptExecutor.runScript(scriptPath);
  }
  /** Queue a script for execution (non-blocking) */
  queueScript(scriptPath: string): void {
    this.scriptExecutor.queueScript(scriptPath);
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
  getBuyVersion(): number {
    return this.buyVersion;
  }
  getMemoList(): string[] {
    return this.guiManager.getMemoList();
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
  getMapData(): MiuMapData {
    return this.requireMapData();
  }
  isMapLoaded(): boolean {
    return this.hasMapData;
  }

  private requireMapData(): MiuMapData {
    if (!this.hasMapData) {
      throw new Error("Map data not loaded. Call loadMap() first.");
    }
    return this.mapData;
  }

  hasTrapScript(tile: Vector2): boolean {
    return this.map.hasTrapScriptWithMapData(tile, this.requireMapData(), this.currentMapName);
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
  getEventId(): number {
    return this.eventId;
  }

  setEventId(id: number): void {
    this.eventId = id;
    this.variables.Event = id;
  }

  // ============= Audio and Effects =============

  drawScreenEffects(renderer: Renderer, width: number, height: number): void {
    this.screenEffects.drawFade(renderer, width, height);
    this.screenEffects.drawFlash(renderer, width, height);
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

  // ============= Show Map Pos / Map Time =============

  setScriptShowMapPos(show: boolean): void {
    this.scriptShowMapPos = show;
  }
  isScriptShowMapPos(): boolean {
    return this.scriptShowMapPos;
  }

  setMapTime(time: number): void {
    this.mapTime = time;
    logger.debug(`[GameManager] SetMapTime: ${time}`);
  }

  getMapTime(): number {
    return this.mapTime;
  }

  /** Save map trap (Web version: data persists in memory, saved with collectSaveData) */
  saveMapTrap(): void {
    const { ignoreList, mapTraps } = this.map.collectTrapDataForSave();
    logger.log(
      `[GameManager] SaveMapTrap: ${ignoreList.length} indices, ${Object.keys(mapTraps).length} trap groups`
    );
  }

  // ============= Camera =============

  cameraMoveTo(direction: number, distance: number, speed: number): void {
    this.cameraController.cancelPendingCenter();
    this.cameraController.moveTo(direction, distance, speed);
  }

  cameraMoveToPosition(destX: number, destY: number, speed: number): void {
    this.cameraController.moveToPositionCentered(
      destX,
      destY,
      speed,
      this.map.viewWidth,
      this.map.viewHeight,
      this.hasMapData ? this.mapData.mapPixelWidth : undefined,
      this.hasMapData ? this.mapData.mapPixelHeight : undefined
    );
  }

  isCameraMoveToPositionEnd(): boolean {
    return !this.cameraController.isMovingToPositionActive();
  }
  updateCameraMovement(cameraX: number, cameraY: number, deltaTime: number) {
    return this.cameraController.update(cameraX, cameraY, deltaTime);
  }
  isCameraMovingByScript(): boolean {
    return this.cameraController.isMovingByScript();
  }
  adjustCameraForViewportResize(dw: number, dh: number): void {
    this.cameraController.adjustForViewportResize(dw, dh);
  }
  setCameraPosition(pixelX: number, pixelY: number): void {
    this.cameraController.setCameraPosition(pixelX, pixelY);
  }
  consumePendingCameraPosition() {
    return this.cameraController.consumePendingCameraPosition();
  }
  centerCameraOnPlayer(): void {
    this.cameraController.requestCenterOnPlayer();
  }
  consumePendingCenterOnPlayer(): boolean {
    return this.cameraController.consumePendingCenterOnPlayer();
  }

  // ============= Script Execution =============

  async executeScript(input: string): Promise<string | null> {
    try {
      await this.scriptExecutor.runScriptContent(input.trim(), "DebugPanel");
      return null;
    } catch (error) {
      logger.error(`[GameManager] Script execution error:`, error);
      return error instanceof Error ? error.message : String(error);
    }
  }

  async addPlayerMagic(magicFile: string, level: number = 1): Promise<boolean> {
    return this.magicCaster.addPlayerMagic(magicFile, level);
  }
  getBottomMagics(): (MagicItemInfo | null)[] {
    return this.magicCaster.getBottomMagics();
  }
  getStoreMagics(): (MagicItemInfo | null)[] {
    return this.magicCaster.getStoreMagics();
  }
  handleMagicDrop(sourceStoreIndex: number, targetBottomSlot: number): void {
    this.magicCaster.handleMagicDrop(sourceStoreIndex, targetBottomSlot);
  }
  handleMagicRightClick(storeIndex: number): void {
    this.magicCaster.handleMagicRightClick(storeIndex);
  }
  getBottomGoods(): (GoodsItemInfo | null)[] {
    return this.player.getGoodsListManager().getBottomItems();
  }

  // ============= UI Action Handlers =============

  handleUseItem(index: number): void {
    this.itemActionHandler.handleUseItem(index);
  }
  async handleBuyItem(shopIndex: number): Promise<boolean> {
    return this.itemActionHandler.handleBuyItem(shopIndex);
  }
  handleSellItem(bagIndex: number): void {
    this.itemActionHandler.handleSellItem(bagIndex);
  }
  handleCloseShop(): void {
    this.itemActionHandler.handleCloseShop();
  }

  /**
   * Check for special action completion (player + NPCs)
   * Inlined from SpecialActionHandler
   */
  private updateSpecialActions(): void {
    // Player special action check
    if (this.player.isInSpecialAction) {
      if (this.player.isSpecialActionEnd()) {
        this.player.endSpecialAction();
      }
    }

    // NPC special action check
    for (const [, npc] of this.npcManager.getAllNpcs()) {
      if (npc.isInSpecialAction) {
        if (npc.isSpecialActionEnd()) {
          logger.log(`[SpecialAction] NPC "${npc.config.name}" special action ended`);
          npc.endSpecialAction();

          if (
            npc.state === CharacterState.Magic ||
            npc.state === CharacterState.Attack ||
            npc.state === CharacterState.Attack1 ||
            npc.state === CharacterState.Attack2
          ) {
            npc.state = CharacterState.Stand;
          }
        }
      }
    }
  }
}
