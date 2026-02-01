/**
 * GameEngine - 游戏引擎单例
 *
 * ================== 职责边界 ==================
 *
 * GameEngine 负责「引擎层」：
 * 1. 单例容器 - 持有所有子系统实例（依赖注入的根）
 * 2. 游戏循环 - start/stop/gameLoop (requestAnimationFrame)
 * 3. 渲染管线 - render(), 相机控制, 交错渲染
 * 4. 输入转换 - 键盘/鼠标事件 → InputState
 * 5. 画布管理 - setCanvas, resize
 * 6. 全局资源初始化 - TalkTextList
 * 7. React 桥接 - 提供 getter/事件 给 UI 层
 *
 * GameEngine 不负责：
 * - 游戏逻辑（由 GameManager 处理）
 * - 脚本执行（由 ScriptExecutor 处理）
 * - 角色行为（由 Player/NPC 处理）
 *
 * ================== 初始化流程 ==================
 *
 * 1. initialize() - 引擎初始化（只执行一次）
 *    - 加载全局资源 (TalkTextList)
 *    - 创建渲染器、游戏管理器
 *
 * 2. newGame() - 开始新游戏
 *    - 委托给 GameManager.newGame()
 *    - 设置加载进度、状态
 *
 * 3. loadGame(index) - 读取存档
 *    - 委托给 GameManager.loadGameSave()
 *
 * ================================================
 */

// 子系统
import { AudioManager } from "../audio";
import type { Character } from "../character/character";
import { type IEngineContext, setEngineContext } from "../core/engineContext";
import { EventEmitter } from "../core/eventEmitter";
import { GameEvents, type GameLoadProgressEvent } from "../core/gameEvents";
import { logger } from "../core/logger";
import type { JxqyMapData } from "../core/mapTypes";
import type { InputState, Vector2 } from "../core/types";
import { CharacterState } from "../core/types";
import { pixelToTile } from "../utils";
import { DebugManager } from "../debug";
import { ScreenEffects } from "../effects";
import type { GuiManagerState } from "../gui/types";
import { MemoListManager, TalkTextListManager, partnerList } from "../listManager";
import type { MagicItemInfo } from "../magic";
import { magicRenderer } from "../magic/magicRenderer";
import { loadMap, MapBase } from "../map";
import {
  createMapRenderer,
  loadMapMpcs,
  type MapRenderer,
  renderMapInterleaved,
} from "../map/renderer";
import { ObjManager } from "../obj";
import { ObjRenderer } from "../obj/objRenderer";
import { GoodKind, getEquipSlotIndex, type GoodsListManager } from "../player/goods";
import type { Player } from "../player/player";
import { TimerManager } from "../timer";
import { WeatherManager } from "../weather";
import type { IUIBridge, UIPanelName } from "../ui/contract";
import { UIBridge, type UIBridgeDeps } from "../ui/uiBridge";
import { GameManager } from "./gameManager";
import { PerformanceStats, type PerformanceStatsData } from "./performanceStats";
import { ResourcePath } from "@/config/resourcePaths";

export interface GameEngineConfig {
  width: number;
  height: number;
}

export interface CanvasRenderInfo {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

/**
 * 游戏引擎状态
 */
export type GameEngineState = "uninitialized" | "loading" | "running" | "paused";

/**
 * GameEngine 单例类 - 所有子系统的容器
 * 实现 IEngineContext 接口，为 Sprite 及其子类提供引擎服务访问
 */
export class GameEngine implements IEngineContext {
  private static instance: GameEngine | null = null;

  // ============= 全局资源 =============
  readonly talkTextList: TalkTextListManager;

  // ============= 核心子系统（公开只读）=============
  readonly events: EventEmitter;
  readonly audioManager: AudioManager;
  readonly screenEffects: ScreenEffects;
  readonly objManager: ObjManager;
  readonly debugManager: DebugManager;
  readonly memoListManager: MemoListManager;
  readonly weatherManager: WeatherManager;
  readonly timerManager: TimerManager;

  // ============= 游戏相关（延迟初始化）=============
  private _gameManager: GameManager | null = null;
  private _mapRenderer: MapRenderer | null = null;
  private _objRenderer: ObjRenderer | null = null;
  private _uiBridge: UIBridge | null = null;

  // 断言已初始化的 getter（内部使用，避免大量 ?. 检查）
  private get gameManager(): GameManager {
    if (!this._gameManager) throw new Error("GameManager not initialized");
    return this._gameManager;
  }

  private get mapRenderer(): MapRenderer {
    if (!this._mapRenderer) throw new Error("MapRenderer not initialized");
    return this._mapRenderer;
  }

  private get objRenderer(): ObjRenderer {
    if (!this._objRenderer) throw new Error("ObjRenderer not initialized");
    return this._objRenderer;
  }

  // 游戏循环
  private animationFrameId: number = 0;
  private lastTime: number = 0;
  private isRunning: boolean = false;

  // 帧率控制 - 锁定 60 FPS（与 C# XNA 版本一致）
  private static readonly TARGET_FPS = 60;
  private static readonly FRAME_INTERVAL = 1000 / GameEngine.TARGET_FPS; // ~16.67ms
  private nextFrameTime: number = 0;

  // 性能统计
  private readonly performanceStats = new PerformanceStats();

  // 配置
  private config: GameEngineConfig;

  // 输入状态
  private inputState: InputState = {
    keys: new Set<string>(),
    mouseX: 0,
    mouseY: 0,
    mouseWorldX: 0,
    mouseWorldY: 0,
    isMouseDown: false,
    isRightMouseDown: false,
    clickedTile: null,
    isShiftDown: false,
    isAltDown: false,
    isCtrlDown: false,
  };

  // 画布信息（由React组件设置）
  private canvasInfo: CanvasRenderInfo | null = null;

  // 状态
  private state: GameEngineState = "uninitialized";
  private loadProgress: number = 0;
  private loadingText: string = "";

  // 摄像机跟随 - 记录上次玩家位置，只有玩家移动时才更新摄像机
  // 对应 C# Carmera._lastPlayerPosition
  private lastPlayerPositionForCamera: Vector2 | null = null;

  // 引擎是否已完成一次性初始化（全局资源已加载）
  private isEngineInitialized: boolean = false;

  private constructor(config: GameEngineConfig) {
    this.config = config;

    // 设置全局引擎上下文（让 Sprite 及其子类能访问引擎服务）
    setEngineContext(this);

    // 创建全局资源
    this.talkTextList = new TalkTextListManager();

    // 创建所有子系统
    this.events = new EventEmitter();
    this.audioManager = new AudioManager();
    this.screenEffects = new ScreenEffects();
    this.objManager = new ObjManager();
    this.debugManager = new DebugManager();
    this.memoListManager = new MemoListManager(this.talkTextList);
    this.weatherManager = new WeatherManager(this.audioManager);
    this.timerManager = new TimerManager();

    // 设置天气系统窗口尺寸
    this.weatherManager.setWindowSize(config.width, config.height);

    // ObjManager 的音频管理器现在通过 IEngineContext 获取

    // 从 localStorage 加载音频设置
    this.loadAudioSettingsFromStorage();
  }

  /**
   * Draw character placeholder (fallback when sprites not loaded)
   */
  private drawCharacterPlaceholder(
    ctx: CanvasRenderingContext2D,
    character: Character,
    camera: { x: number; y: number },
    width: number,
    height: number
  ): void {
    const screenX = character.pixelPosition.x - camera.x;
    const screenY = character.pixelPosition.y - camera.y;

    // Skip if off-screen
    if (screenX < -50 || screenX > width + 50 || screenY < -50 || screenY > height + 50) {
      return;
    }

    // Draw character circle
    ctx.save();
    ctx.translate(screenX, screenY);

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const isPlayer = character.name === "杨影枫";
    const color = isPlayer ? "#4a90d9" : "#d9a04a";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -20, 15, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator
    const dirAngles = [
      -Math.PI / 2, // North
      -Math.PI / 4, // NorthEast
      0, // East
      Math.PI / 4, // SouthEast
      Math.PI / 2, // South
      (3 * Math.PI) / 4, // SouthWest
      Math.PI, // West
      (-3 * Math.PI) / 4, // NorthWest
    ];
    const angle = dirAngles[character.direction] || 0;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(Math.cos(angle) * 12, -20 + Math.sin(angle) * 12);
    ctx.stroke();

    // Name tag
    ctx.fillStyle = "#fff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(character.config.name, 0, -40);

    // Walking animation indicator
    if (character.state === CharacterState.Walk) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.arc(0, -20, 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: GameEngineConfig): GameEngine {
    if (!GameEngine.instance) {
      if (!config) {
        config = { width: 800, height: 600 };
      }
      GameEngine.instance = new GameEngine(config);
    }
    return GameEngine.instance;
  }

  /**
   * 销毁单例（用于测试或完全重置）
   */
  static destroy(): void {
    if (GameEngine.instance) {
      GameEngine.instance.stop();
      GameEngine.instance.events.clear();
      GameEngine.instance = null;
      // 同时清除便捷函数的缓存
      engineInstance = null;
    }
  }

  // ============= 初始化 =============

  /**
   * 初始化游戏引擎（只执行一次）
   *
   * 加载全局资源，创建渲染器和游戏管理器。
   * 这一步不会开始游戏，只是准备好引擎。
   *
   * 对应 C# 的 JxqyGame.Initialize() + LoadContent()
   */
  async initialize(): Promise<void> {
    if (this.isEngineInitialized) {
      logger.warn("[GameEngine] Engine already initialized");
      return;
    }

    this.state = "loading";
    this.emitLoadProgress(0, "初始化引擎...");

    try {
      // ========== 阶段1：加载全局资源（只加载一次）==========
      // - TalkTextList (对话文本)
      // 注：LevelManager 由 Player 持有，MagicExpConfig 由 MagicListManager 持有
      this.emitLoadProgress(10, "加载全局资源...");
      await this.talkTextList.initialize();
      await partnerList.initialize();

      // ========== 阶段2：创建渲染器 ==========
      this.emitLoadProgress(20, "创建渲染器...");
      this._objRenderer = new ObjRenderer();
      this._mapRenderer = createMapRenderer();
      this._mapRenderer.camera = {
        x: 0,
        y: 0,
        width: this.config.width,
        height: this.config.height,
      };

      // ========== 阶段3：创建游戏管理器 ==========
      this.emitLoadProgress(30, "创建游戏管理器...");
      this._gameManager = new GameManager(
        {
          events: this.events,
          audioManager: this.audioManager,
          screenEffects: this.screenEffects,
          objManager: this.objManager,
          talkTextList: this.talkTextList,
          debugManager: this.debugManager,
          memoListManager: this.memoListManager,
          weatherManager: this.weatherManager,
          timerManager: this.timerManager,
          clearMouseInput: () => this.clearMouseInput(),
        },
        {
          onMapChange: async (mapPath) => {
            return this.handleMapChange(mapPath);
          },
          getCanvas: () => this.getCanvas(),
          // 加载存档后立即将摄像机居中到玩家位置（避免摄像机飞过去）
          centerCameraOnPlayer: () => this.centerCameraOnPlayer(),
        }
      );

      // 设置计时器脚本执行回调
      // C#: ScriptExecuter.Update 中使用 Utils.GetScriptParser(_timeScriptFileName) 获取脚本
      // Utils.GetScriptParser 会根据 **当前地图** 构建路径，而不是设置时的地图
      this.timerManager.setScriptRunner((scriptFileName) => {
        // 根据当前地图构建完整脚本路径
        const basePath = this.getScriptBasePath();
        const fullPath = `${basePath}/${scriptFileName}`;
        logger.log(`[GameEngine] Timer script triggered: ${scriptFileName} -> ${fullPath}`);
        this.gameManager.runScript(fullPath).catch((err: unknown) => {
          logger.error(`[GameEngine] Timer script failed: ${fullPath}`, err);
        });
      });

      // ========== 阶段4：创建 UI 桥接器 ==========
      this._uiBridge = this.createUIBridge();

      this.isEngineInitialized = true;
      this.emitLoadProgress(40, "引擎初始化完成");
      logger.log("[GameEngine] Engine initialization completed (global resources loaded)");
    } catch (error) {
      logger.error("[GameEngine] Engine initialization failed:", error);
      this.events.emit(GameEvents.GAME_INITIALIZED, { success: false });
      throw error;
    }
  }

  /**
   * 开始新游戏
   *
   * 运行 NewGame.txt 脚本，该脚本会调用 LoadGame(0) 加载初始存档。
   * 必须先调用 initialize() 完成引擎初始化。
   *
   * 对应 C# 的 Loader.NewGame()
   */
  async newGame(): Promise<void> {
    if (!this.isEngineInitialized) {
      logger.error("[GameEngine] Cannot start new game: engine not initialized");
      throw new Error("Engine not initialized. Call initialize() first.");
    }

    this.state = "loading";
    this.emitLoadProgress(50, "开始新游戏...");

    try {
      // 运行新游戏脚本
      // NewGame.txt 内容: StopMusic() -> LoadGame(0) -> PlayMovie() -> RunScript("Begin.txt")
      // LoadGame(0) 会从初始存档加载武功，不需要额外初始化
      this.emitLoadProgress(60, "执行初始化脚本...");
      await this.gameManager.newGame();

      this.emitLoadProgress(100, "游戏开始");
      this.state = "running";

      // 发送初始化完成事件
      this.events.emit(GameEvents.GAME_INITIALIZED, { success: true });

      logger.log("[GameEngine] New game started");
    } catch (error) {
      logger.error("[GameEngine] Failed to start new game:", error);
      this.events.emit(GameEvents.GAME_INITIALIZED, { success: false });
      throw error;
    }
  }

  /**
   * 读取存档
   *
   * @param index 存档索引 (1-7)，0 表示初始存档
   *
   * 对应 C# 的 Loader.LoadGame(index)
   */
  async loadGame(index: number): Promise<void> {
    if (!this.isEngineInitialized) {
      logger.error("[GameEngine] Cannot load game: engine not initialized");
      throw new Error("Engine not initialized. Call initialize() first.");
    }

    this.state = "loading";
    this.emitLoadProgress(50, `读取存档 ${index}...`);

    try {
      // 存档加载会恢复武功数据，不需要额外初始化 initializePlayerMagics
      await this.gameManager.loadGameSave(index);

      this.emitLoadProgress(100, "存档加载完成");
      this.state = "running";

      logger.log(`[GameEngine] Game loaded from save ${index}`);
    } catch (error) {
      logger.error(`[GameEngine] Failed to load game ${index}:`, error);
      throw error;
    }
  }

  /**
   * 初始化并开始新游戏（便捷方法）
   *
   * 组合调用 initialize() 和 newGame()，用于快速启动游戏。
   */
  async initializeAndStartNewGame(): Promise<void> {
    await this.initialize();
    await this.newGame();
  }

  /**
   * 初始化并从存档加载游戏
   *
   * @param index 存档槽位索引 (1-7)
   */
  async initializeAndLoadGame(index: number): Promise<void> {
    await this.initialize();
    await this.loadGameFromSlot(index);
  }

  /**
   * 从 localStorage 存档槽位加载游戏
   *
   * @param index 存档槽位索引 (1-7)
   */
  async loadGameFromSlot(index: number): Promise<void> {
    if (!this.isEngineInitialized) {
      logger.error("[GameEngine] Cannot load game: engine not initialized");
      throw new Error("Engine not initialized. Call initialize() first.");
    }

    this.state = "loading";
    this.emitLoadProgress(0, `读取存档 ${index}...`);

    // 设置进度回调，将 Loader 的进度转发到 UI
    this.gameManager.setLoadProgressCallback((progress, text) => {
      this.emitLoadProgress(progress, text);
    });

    try {
      // JSON 存档加载会恢复武功数据，不需要额外初始化 initializePlayerMagics
      const success = await this.gameManager.loadGameFromSlot(index);
      if (!success) {
        throw new Error(`存档 ${index} 不存在`);
      }

      this.emitLoadProgress(100, "存档加载完成");
      this.state = "running";

      // 发送初始化完成事件（让 UI 层知道加载完成）
      this.events.emit(GameEvents.GAME_INITIALIZED, { success: true });

      logger.log(`[GameEngine] Game loaded from slot ${index}`);
    } catch (error) {
      logger.error(`[GameEngine] Failed to load game from slot ${index}:`, error);
      this.events.emit(GameEvents.GAME_INITIALIZED, { success: false });
      throw error;
    } finally {
      // 清除进度回调
      this.gameManager.setLoadProgressCallback(undefined);
    }
  }

  /**
   * 保存游戏到指定槽位
   *
   * @param index 存档槽位索引 (1-7)
   * @returns 是否保存成功
   */
  async saveGameToSlot(index: number): Promise<boolean> {
    if (!this.isEngineInitialized || !this._gameManager) {
      logger.error("[GameEngine] Cannot save game: not initialized");
      return false;
    }

    try {
      return await this.gameManager.saveGame(index);
    } catch (error) {
      logger.error(`[GameEngine] Failed to save game to slot ${index}:`, error);
      return false;
    }
  }

  /**
   * 获取当前画布（用于截图）
   */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvasInfo?.ctx.canvas ?? null;
  }

  /**
   * 获取音频管理器
   */
  getAudioManager(): AudioManager {
    return this.audioManager;
  }

  /**
   * 从 localStorage 加载音频设置并应用到 AudioManager（内部使用）
   */
  private loadAudioSettingsFromStorage(): void {
    try {
      const musicVolume = localStorage.getItem("jxqy_music_volume");
      const soundVolume = localStorage.getItem("jxqy_sound_volume");
      const ambientVolume = localStorage.getItem("jxqy_ambient_volume");

      if (musicVolume !== null) {
        this.audioManager.setMusicVolume(parseFloat(musicVolume));
      }
      if (soundVolume !== null) {
        this.audioManager.setSoundVolume(parseFloat(soundVolume));
      }
      if (ambientVolume !== null) {
        this.audioManager.setAmbientVolume(parseFloat(ambientVolume));
      }

      logger.log("[GameEngine] Audio settings loaded from localStorage");
    } catch (error) {
      logger.warn("[GameEngine] Failed to load audio settings:", error);
    }
  }

  /**
   * 处理地图切换
   *
   * 状态管理：
   * - 初始加载时：外部流程已设置 state="loading"，此函数不改变状态
   * - 游戏内切换：当前 state="running"，临时切换到 loading 显示进度，完成后恢复
   */
  private async handleMapChange(mapPath: string): Promise<JxqyMapData | null> {
    // 确保屏幕是黑的，防止在地图加载过程中看到摄像机移动
    // 如果脚本已经执行了 FadeOut，这里只是确保；如果没有，这会立即设置黑屏
    if (!this.screenEffects.isScreenBlack()) {
      this.screenEffects.setFadeTransparency(1);
    }

    // 记录调用前的状态
    // - 如果是 running：游戏内切换地图，需要自己管理加载状态
    // - 如果是 loading：初始加载流程，外部已管理状态，不改变
    const wasRunning = this.state === "running";

    if (wasRunning) {
      this.state = "loading";
    }
    this.emitLoadProgress(0, "加载地图...");

    // 构建完整地图路径
    let fullMapPath = mapPath;
    if (!mapPath.startsWith("/")) {
      const mapName = mapPath.replace(".map", "");
      fullMapPath = ResourcePath.map(`${mapName}.map`);
    }

    logger.debug(`[GameEngine] Loading map: ${fullMapPath}`);

    try {
      const mapData = await loadMap(fullMapPath);
      if (mapData) {
        const mapName = fullMapPath.split("/").pop()?.replace(".map", "") || "";

        // C#: 加载新地图时清空已触发的陷阱列表
        // 参考 JxqyMap.LoadMapFromBuffer() 中的 _ingnoredTrapsIndex.Clear()
        MapBase.ClearIgnoredTraps();

        // 更新地图渲染器
        this.mapRenderer.mapData = mapData;

        // 加载地图MPC资源
        // 进度映射：MPC 加载进度 (0-1) 映射到 0-100% 的加载进度范围
        await loadMapMpcs(this.mapRenderer, mapData, mapName, (progress) => {
          const mappedProgress = Math.round(progress * 100);
          this.emitLoadProgress(mappedProgress, "加载地图资源...");
        });

        // 更新游戏管理器的地图名称
        this.gameManager.setCurrentMapName(mapName);

        // 地图加载后立即居中摄像机到玩家位置
        // 这样在后续 SetPlayerPos + FadeIn 时摄像机已经准备好
        this.centerCameraOnPlayer();

        // 发送地图加载事件
        this.events.emit(GameEvents.GAME_MAP_LOAD, {
          mapPath: fullMapPath,
          mapName,
        });

        logger.log(`[GameEngine] Map loaded: ${mapName}`);

        // 只有游戏内切换地图时才恢复状态
        // 初始加载时，外部流程会在所有加载完成后设置 running
        if (wasRunning) {
          this.state = "running";
          this.emitLoadProgress(100, "地图加载完成");
        }

        return mapData;
      }

      // 地图加载失败，恢复状态
      if (wasRunning) {
        this.state = "running";
        this.emitLoadProgress(100, "");
      }
      return null;
    } catch (error) {
      logger.error(`[GameEngine] Failed to load map: ${fullMapPath}`, error);
      // 出错时也要恢复状态
      if (wasRunning) {
        this.state = "running";
        this.emitLoadProgress(100, "");
      }
      return null;
    }
  }

  /**
   * 发送加载进度事件
   */
  private emitLoadProgress(progress: number, text: string): void {
    this.loadProgress = progress;
    this.loadingText = text;
    this.events.emit<GameLoadProgressEvent>(GameEvents.GAME_LOAD_PROGRESS, {
      progress,
      text,
    });
  }

  // ============= 游戏循环 =============

  /**
   * 启动游戏循环
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("[GameEngine] Game loop already running");
      return;
    }

    if (this.state !== "running" && this.state !== "paused") {
      logger.error("[GameEngine] Cannot start: not initialized");
      return;
    }

    this.isRunning = true;
    this.lastTime = performance.now();
    this.nextFrameTime = performance.now(); // 初始化帧率控制
    this.state = "running";

    this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
    logger.log("[GameEngine] Game loop started (60 FPS locked)");
  }

  /**
   * 停止游戏循环
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
    logger.log("[GameEngine] Game loop stopped");
  }

  /**
   * 暂停游戏
   */
  pause(): void {
    if (this.state === "running") {
      this.state = "paused";
      this.gameManager.pause();
      this.events.emit(GameEvents.GAME_PAUSE, {});
    }
  }

  /**
   * 恢复游戏
   */
  resume(): void {
    if (this.state === "paused") {
      this.state = "running";
      this.gameManager.resume();
      this.events.emit(GameEvents.GAME_RESUME, {});
    }
  }

  /**
   * 游戏主循环
   * 锁定 60 FPS，与 C# XNA 版本保持一致
   */
  private gameLoop(timestamp: number): void {
    if (!this.isRunning) return;

    // 帧率控制：检查是否到达下一帧时间
    if (timestamp < this.nextFrameTime) {
      // 还没到下一帧，继续等待
      this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
      return;
    }

    // 更新下一帧目标时间
    // 使用累加方式保持稳定帧率，避免漂移
    this.nextFrameTime += GameEngine.FRAME_INTERVAL;
    // 防止掉帧后追帧：如果落后太多，重置到当前时间
    if (timestamp - this.nextFrameTime > GameEngine.FRAME_INTERVAL * 2) {
      this.nextFrameTime = timestamp + GameEngine.FRAME_INTERVAL;
    }

    // 标记帧开始
    this.performanceStats.beginFrame();

    // 固定 deltaTime = 1/60 秒（与 C# XNA IsFixedTimeStep 一致）
    const fixedDeltaTime = 1 / GameEngine.TARGET_FPS;

    // 更新游戏逻辑
    this.performanceStats.beginUpdate();
    this.update(fixedDeltaTime);
    this.performanceStats.endUpdate();

    // 渲染
    this.performanceStats.beginRender();
    this.render();
    this.performanceStats.endRender();

    // 标记帧结束并更新统计
    this.performanceStats.endFrame(fixedDeltaTime);

    // 继续循环
    this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
  }

  /**
   * 更新游戏逻辑
   */
  private update(deltaTime: number): void {
    if (!this.gameManager || !this.mapRenderer) return;

    const { width, height } = this.config;

    // 计算视野区域（复用于多个子系统）
    const viewRect = {
      x: this.mapRenderer.camera.x,
      y: this.mapRenderer.camera.y,
      width,
      height,
    };

    // === 性能优化：Update 阶段预计算视野内对象 ===
    // C# Reference: JxqyGame.UpdatePlaying 中调用 UpdateNpcsInView, UpdateObjsInView
    // 这样 Render 阶段直接使用预计算结果，避免每帧重复遍历
    this.gameManager.getNpcManager().updateNpcsInView(viewRect);
    this.gameManager.getObjManager().updateObjsInView(viewRect);

    // 更新性能统计中的对象数量
    const magicMgr = this.gameManager.getMagicManager();
    this.performanceStats.updateObjectStats(
      this.gameManager.getNpcManager().npcsInView.length,
      this.gameManager.getObjManager().objsInView.length,
      magicMgr ? magicMgr.getMagicSprites().size + magicMgr.getEffectSprites().size : 0
    );

    // Update mouse hover state for interaction highlights
    // C# Reference: Player.cs HandleMouseInput - updates OutEdgeNpc/OutEdgeObj
    this.gameManager.updateMouseHover(
      this.inputState.mouseWorldX,
      this.inputState.mouseWorldY,
      viewRect
    );

    // 更新音频监听者位置（玩家位置）
    // C# Reference: Globals.ListenerPosition = ThePlayer.PositionInWorld
    const player = this.gameManager.getPlayer();
    if (player) {
      this.audioManager.setListenerPosition(player.pixelPosition);
      // 更新玩家遮挡状态（用于半透明效果）
      player.updateOcclusionState();
    }

    // 更新游戏
    this.gameManager.update(deltaTime, this.inputState);

    // 注意：clickedTile不再在这里清除，而是在mouseUp时清除
    // 这样可以支持长按鼠标连续移动

    // 更新相机
    this.updateCamera(deltaTime);

    // 更新天气系统
    // C# Reference: WeatherManager.Update(gameTime)
    this.weatherManager.update(deltaTime, this.mapRenderer.camera.x, this.mapRenderer.camera.y);

    // 更新计时器系统
    // C# Reference: TimerGui.Update(gameTime)
    this.timerManager.update(deltaTime);

    // 雨天时设置地图/精灵颜色为灰色
    // C# Reference: Sprite.DrawColor = MapBase.DrawColor = RainMapColor
    if (this.weatherManager.isRaining) {
      const color = this.weatherManager.rainColor;
      // 闪电时屏幕变白
      if (this.weatherManager.isFlashing) {
        this.screenEffects.setMapColor(255, 255, 255);
        this.screenEffects.setSpriteColor(255, 255, 255);
      } else {
        this.screenEffects.setMapColor(color.r, color.g, color.b);
        this.screenEffects.setSpriteColor(color.r, color.g, color.b);
      }
    }
  }

  /**
   * 更新相机
   */
  private updateCamera(deltaTime: number): void {
    if (!this.gameManager || !this.mapRenderer) return;

    const player = this.gameManager.getPlayer();
    const { width, height } = this.config;

    // 检查是否有 SetPlayerScn 请求（居中到玩家）
    const pendingCenter = this.gameManager.consumePendingCenterOnPlayer();
    if (pendingCenter) {
      // C#: CenterPlayerInCamera - 将摄像机居中到玩家
      const targetCameraX = player.pixelPosition.x - width / 2;
      const targetCameraY = player.pixelPosition.y - height / 2;
      this.mapRenderer.camera.x = targetCameraX;
      this.mapRenderer.camera.y = targetCameraY;
      // 更新上次玩家位置
      this.lastPlayerPositionForCamera = { ...player.pixelPosition };
    }

    // 检查是否有 SetMapPos 设置的待处理摄像机位置
    const pendingPos = this.gameManager.consumePendingCameraPosition();
    if (pendingPos) {
      this.mapRenderer.camera.x = pendingPos.x;
      this.mapRenderer.camera.y = pendingPos.y;
      // SetMapPos 后重置上次玩家位置，这样只有玩家移动后摄像机才会开始跟随
      this.lastPlayerPositionForCamera = { ...player.pixelPosition };
    } else if (this.gameManager.isCameraMovingByScript()) {
      // 检查是否由脚本控制相机 (MoveScreen)
      const newCameraPos = this.gameManager.updateCameraMovement(
        this.mapRenderer.camera.x,
        this.mapRenderer.camera.y,
        deltaTime * 1000
      );
      if (newCameraPos) {
        this.mapRenderer.camera.x = newCameraPos.x;
        this.mapRenderer.camera.y = newCameraPos.y;
      }
    } else {
      // 正常跟随玩家
      // 对应 C# Carmera.UpdatePlayerView - 只有玩家位置改变时才更新摄像机
      const currentPlayerPos = player.pixelPosition;
      const lastPos = this.lastPlayerPositionForCamera;

      // 计算玩家位置偏移
      const offsetX = lastPos ? currentPlayerPos.x - lastPos.x : 0;
      const offsetY = lastPos ? currentPlayerPos.y - lastPos.y : 0;
      const hasPlayerMoved = offsetX !== 0 || offsetY !== 0;

      if (hasPlayerMoved || !lastPos) {
        // C# Carmera.UpdatePlayerView 逻辑：
        // 当玩家向某个方向移动时，如果玩家已经超过屏幕中心，相机才会跟随
        // 这样可以让玩家在中心区域移动时相机保持不动
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        let centerX = this.mapRenderer.camera.x + halfWidth;
        let centerY = this.mapRenderer.camera.y + halfHeight;

        // 当屏幕接近全黑时或首次初始化时，直接跳转到目标位置
        if (this.screenEffects.isScreenBlack() || !lastPos) {
          centerX = currentPlayerPos.x;
          centerY = currentPlayerPos.y;
        } else {
          // C#: 根据玩家移动方向，只有当玩家超过中心点时才更新相机
          if ((offsetX > 0 && currentPlayerPos.x > centerX) ||
              (offsetX < 0 && currentPlayerPos.x < centerX)) {
            centerX = currentPlayerPos.x;
          }
          if ((offsetY > 0 && currentPlayerPos.y > centerY) ||
              (offsetY < 0 && currentPlayerPos.y < centerY)) {
            centerY = currentPlayerPos.y;
          }
        }

        this.mapRenderer.camera.x = centerX - halfWidth;
        this.mapRenderer.camera.y = centerY - halfHeight;

        // 更新上次玩家位置
        this.lastPlayerPositionForCamera = { ...currentPlayerPos };
      }
      // 如果玩家没有移动，摄像机保持在当前位置（SetMapPos 设置的位置）
    }

    // 限制相机在地图范围内
    const mapData = this.gameManager.getMapData();
    if (mapData) {
      this.mapRenderer.camera.x = Math.max(
        0,
        Math.min(this.mapRenderer.camera.x, mapData.mapPixelWidth - width)
      );
      this.mapRenderer.camera.y = Math.max(
        0,
        Math.min(this.mapRenderer.camera.y, mapData.mapPixelHeight - height)
      );
    }
  }

  /**
   * 立即将摄像机居中到玩家位置
   * 用于加载存档后避免摄像机从 (0,0) 飞到玩家位置
   */
  private centerCameraOnPlayer(): void {
    if (!this._gameManager || !this._mapRenderer) return;

    const player = this._gameManager?.getPlayer();
    if (!player) return;

    const { width, height } = this.config;

    // 直接设置摄像机位置到玩家中心（无平滑过渡）
    let targetX = player.pixelPosition.x - width / 2;
    let targetY = player.pixelPosition.y - height / 2;

    // 限制在地图范围内
    const mapData = this._gameManager.getMapData();
    if (mapData) {
      targetX = Math.max(0, Math.min(targetX, mapData.mapPixelWidth - width));
      targetY = Math.max(0, Math.min(targetY, mapData.mapPixelHeight - height));
    }

    this._mapRenderer.camera.x = targetX;
    this._mapRenderer.camera.y = targetY;
    // 更新上次玩家位置
    this.lastPlayerPositionForCamera = { ...player.pixelPosition };

    logger.debug(`[GameEngine] Camera centered on player at (${targetX}, ${targetY})`);
  }

  /**
   * 渲染游戏画面
   */
  private render(): void {
    if (!this.canvasInfo || !this.gameManager || !this.mapRenderer) return;

    const { ctx, width, height } = this.canvasInfo;

    // 禁用图像平滑（像素风格游戏）- 只需设置一次，Canvas 会保持这个状态
    ctx.imageSmoothingEnabled = false;

    // 清空画布
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // 渲染地图和角色（使用交错渲染）
    this.renderMapInterleaved(ctx);

    // 应用地图颜色叠加（ChangeMapColor 效果）
    // C#: 使用 Color.Multiply 将颜色应用到地图和精灵
    const screenEffects = this.gameManager.getScreenEffects();
    if (screenEffects.isMapTinted()) {
      const tint = screenEffects.getMapTintColor();
      ctx.save();
      // 使用 multiply 混合模式来模拟颜色相乘效果
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = `rgb(${tint.r}, ${tint.g}, ${tint.b})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // 渲染天气效果（雨、雪）
    // C# Reference: WeatherManager.Draw(spriteBatch)
    this.weatherManager.draw(ctx, this.mapRenderer.camera.x, this.mapRenderer.camera.y);

    // 渲染屏幕特效（淡入淡出、闪烁）
    this.gameManager.drawScreenEffects(ctx, width, height);
  }

  /**
   * 交错渲染地图、NPC、玩家、物体
   * Enhanced with interaction highlights
   *
   * C# Reference: Player.Draw 中高亮边缘在所有内容绘制完成后单独绘制
   */
  private renderMapInterleaved(ctx: CanvasRenderingContext2D): void {
    if (!this.mapRenderer || !this.gameManager || !this.objRenderer) return;

    const renderer = this.mapRenderer;
    const { width, height } = this.config;

    if (renderer.isLoading || !renderer.mapData) return;

    // 获取玩家
    const player = this.gameManager.getPlayer();

    // 获取交互管理器
    const interactionManager = this.gameManager.getInteractionManager();
    const hoverTarget = interactionManager.getHoverTarget();
    const edgeColor = interactionManager.getEdgeColor();

    // === 性能优化：使用 Update 阶段预计算的视野内对象 ===
    // C# Reference: MapBase.Draw 中直接使用 NpcManager.NpcsInView, ObjManager.ObjsInView
    // 不再每帧重新计算和分组，直接使用预计算的按行分组结果
    const npcManager = this.gameManager.getNpcManager();
    const objManager = this.gameManager.getObjManager();

    // 武功精灵也使用 Update 阶段预计算的按行分组结果
    const magicMgr = this.gameManager.getMagicManager();

    const playerRow = player.tilePosition.y;

    // 交错渲染（不在这里绘制高亮边缘）
    renderMapInterleaved(ctx, renderer, (row: number) => {
      // 渲染该行的 NPC（使用预计算的按行分组）
      const npcsAtRow = npcManager.getNpcsAtRow(row);
      for (const npc of npcsAtRow) {
        if (npc.isSpritesLoaded()) {
          npc.draw(ctx, renderer.camera.x, renderer.camera.y);
        } else {
          this.drawCharacterPlaceholder(ctx, npc, renderer.camera, width, height);
        }
      }

      // 渲染该行的物体（使用预计算的按行分组）
      const objsAtRow = objManager.getObjsAtRow(row);
      for (const obj of objsAtRow) {
        this.objRenderer?.drawObj(ctx, obj, renderer.camera.x, renderer.camera.y);
      }

      // 渲染玩家
      if (row === playerRow) {
        if (player.isSpritesLoaded()) {
          player.draw(ctx, renderer.camera.x, renderer.camera.y);
        } else {
          this.drawCharacterPlaceholder(ctx, player, renderer.camera, width, height);
        }
      }

      // 渲染武功精灵（使用 MagicManager 预计算的按行分组）
      if (magicMgr) {
        const magicsAtRow = magicMgr.getMagicSpritesAtRow(row);
        for (const sprite of magicsAtRow) {
          magicRenderer.render(ctx, sprite, renderer.camera.x, renderer.camera.y);
        }

        // 渲染特效精灵
        const effectsAtRow = magicMgr.getEffectSpritesAtRow(row);
        for (const sprite of effectsAtRow) {
          magicRenderer.render(ctx, sprite, renderer.camera.x, renderer.camera.y);
        }
      }
    });

    // === 玩家遮挡半透明效果 ===
    // C# Reference: Player.Draw - 当玩家被遮挡物覆盖时绘制半透明效果
    // 在所有地图层和角色绘制完成后，如果玩家被遮挡，再单独绘制一层半透明玩家
    if (player.isSpritesLoaded() && player.isOccluded) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      player.drawWithColor(ctx, renderer.camera.x, renderer.camera.y, "white", 0, 0);
      ctx.restore();
    }

    // === SuperMode 精灵渲染（在所有内容之上） ===
    // C# Reference: JxqyGame.DrawGamePlay - if (Globals.IsInSuperMagicMode) { Globals.SuperModeMagicSprite.Draw(_spriteBatch); }
    // SuperMode 精灵不在普通列表中，需要单独渲染
    const superModeMagicMgr = this.getManager("magic");
    if (superModeMagicMgr?.isInSuperMagicMode) {
      const superModeSprite = superModeMagicMgr.superModeMagicSprite;
      if (superModeSprite && !superModeSprite.isDestroyed) {
        magicRenderer.render(ctx, superModeSprite, renderer.camera.x, renderer.camera.y);
      }
    }

    // === 高亮边缘在所有内容渲染完成后单独绘制（最高层） ===
    // C# Reference: Player.Draw 末尾: if (Globals.OutEdgeSprite != null) { ... }
    if (hoverTarget.type === "npc" && hoverTarget.npc) {
      const npc = hoverTarget.npc;
      if (npc.isSpritesLoaded() && npc.isVisible) {
        npc.drawHighlight(ctx, renderer.camera.x, renderer.camera.y, edgeColor);
      }
    } else if (hoverTarget.type === "obj" && hoverTarget.obj) {
      const obj = hoverTarget.obj;
      this.objRenderer?.drawObjHighlight(ctx, obj, renderer.camera.x, renderer.camera.y, edgeColor);
    }
  }

  // ============= 画布管理 =============

  /**
   * 设置画布（由React组件调用）
   */
  setCanvas(canvas: HTMLCanvasElement | null): void {
    if (!canvas) {
      this.canvasInfo = null;
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      logger.error("[GameEngine] Failed to get 2D context");
      return;
    }

    this.canvasInfo = {
      ctx,
      width: canvas.width,
      height: canvas.height,
    };
  }

  /**
   * 更新画布尺寸（窗口调整时调用）
   */
  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;

    if (this._mapRenderer) {
      this._mapRenderer.camera.width = width;
      this._mapRenderer.camera.height = height;
    }

    if (this.canvasInfo) {
      this.canvasInfo.width = width;
      this.canvasInfo.height = height;
    }

    // 重新居中镜头到玩家，确保尺寸变化时玩家始终保持在屏幕中心
    this.centerCameraOnPlayer();

    this.events.emit(GameEvents.SCREEN_RESIZE, { width, height });
  }

  // ============= 输入处理 =============

  /**
   * 处理键盘按下
   */
  handleKeyDown(code: string, shiftKey: boolean = false): boolean {
    this.inputState.keys.add(code);
    this.inputState.isShiftDown = shiftKey;

    if (this.gameManager) {
      return this.gameManager.handleKeyDown(code, shiftKey);
    }
    return false;
  }

  /**
   * 处理键盘松开
   */
  handleKeyUp(code: string): void {
    this.inputState.keys.delete(code);

    // 检查是否松开了Shift键
    if (code === "ShiftLeft" || code === "ShiftRight") {
      this.inputState.isShiftDown = false;
    }
  }

  /**
   * 更新修饰键状态（Shift/Alt/Ctrl）
   */
  updateModifierKeys(shiftKey: boolean, altKey: boolean, ctrlKey: boolean): void {
    this.inputState.isShiftDown = shiftKey;
    this.inputState.isAltDown = altKey;
    this.inputState.isCtrlDown = ctrlKey;
  }

  /**
   * 处理鼠标移动
   */
  handleMouseMove(screenX: number, screenY: number, worldX: number, worldY: number): void {
    this.inputState.mouseX = screenX;
    this.inputState.mouseY = screenY;
    this.inputState.mouseWorldX = worldX;
    this.inputState.mouseWorldY = worldY;

    // C# style: Update clickedTile while mouse is held down
    // This enables continuous walking by holding mouse button
    if (this.inputState.isMouseDown) {
      this.inputState.clickedTile = this.worldToTile(worldX, worldY);
    }
  }

  /**
   * 处理鼠标按下
   * @param ctrlKey If true, this is Ctrl+Click (attack), don't set clickedTile for movement
   * @param altKey If true, this is Alt+Click (jump), don't set clickedTile for movement
   */
  handleMouseDown(
    worldX: number,
    worldY: number,
    isRightButton: boolean = false,
    ctrlKey: boolean = false,
    altKey: boolean = false
  ): void {
    if (isRightButton) {
      this.inputState.isRightMouseDown = true;
    } else {
      this.inputState.isMouseDown = true;
    }
    this.inputState.mouseWorldX = worldX;
    this.inputState.mouseWorldY = worldY;

    // 设置点击瓦片 - 但如果是 Ctrl+Click(攻击) 或 Alt+Click(跳跃)，不设置，防止触发移动
    // C# Reference: Player.HandleMouseInput - Ctrl/Alt clicks are special actions, not movement
    if (!ctrlKey && !altKey) {
      this.inputState.clickedTile = this.worldToTile(worldX, worldY);
    }
  }

  /**
   * 处理鼠标松开
   */
  handleMouseUp(isRightButton: boolean = false): void {
    if (isRightButton) {
      this.inputState.isRightMouseDown = false;
    } else {
      this.inputState.isMouseDown = false;
      // Clear clicked tile when mouse released
      this.inputState.clickedTile = null;
    }
  }

  /**
   * 清除鼠标按住状态（陷阱触发时调用）
   * 用于打断用户的持续鼠标输入
   */
  clearMouseInput(): void {
    this.inputState.isMouseDown = false;
    this.inputState.isRightMouseDown = false;
    this.inputState.clickedTile = null;
  }

  /**
   * 处理鼠标点击
   */
  handleClick(
    worldX: number,
    worldY: number,
    button: "left" | "right",
    ctrlKey: boolean = false,
    altKey: boolean = false
  ): void {
    if (this.gameManager) {
      this.gameManager.handleClick(worldX, worldY, button, ctrlKey, altKey);
    }
  }

  /**
   * 世界坐标转瓦片坐标（等角坐标系统）
   */
  private worldToTile(worldX: number, worldY: number): Vector2 {
    return pixelToTile(worldX, worldY);
  }

  /**
   * 屏幕坐标转世界坐标
   */
  screenToWorld(screenX: number, screenY: number): Vector2 {
    if (!this._mapRenderer) {
      return { x: screenX, y: screenY };
    }
    return {
      x: screenX + this._mapRenderer.camera.x,
      y: screenY + this._mapRenderer.camera.y,
    };
  }

  // ============= API - 获取游戏状态 =============

  /**
   * 获取事件发射器（用于UI订阅事件）
   */
  getEvents(): EventEmitter {
    return this.events;
  }

  /**
   * 获取游戏管理器
   */
  getGameManager(): GameManager | null {
    return this._gameManager;
  }

  /**
   * 获取GUI状态
   */
  getGuiState(): GuiManagerState | undefined {
    return this._gameManager?.getGuiManager().getState();
  }

  /**
   * 获取玩家（内部方法，非 IEngineContext）
   */
  getPlayer(): Player {
    return this.gameManager.getPlayer();
  }

  // ============= IEngineContext 接口实现 =============

  /**
   * 核心服务：玩家
   */
  get player() {
    return this.gameManager.getPlayer();
  }

  /**
   * 核心服务：NPC 管理器
   */
  get npcManager() {
    return this.gameManager.getNpcManager();
  }

  /**
   * 核心服务：地图基类（障碍检测、陷阱、坐标转换）
   */
  get map(): MapBase {
    return MapBase.Instance;
  }

  /**
   * 核心服务：音频服务
   * 直接返回 AudioManager 实例，支持完整的音频功能
   */
  get audio(): AudioManager {
    return this.audioManager;
  }

  /**
   * 运行脚本（等待完成）
   */
  async runScript(scriptPath: string, belongObject?: { type: string; id: string }): Promise<void> {
    const executor = this.gameManager.getScriptExecutor();
    if (executor) {
      await executor.runScript(
        scriptPath,
        belongObject as { type: "npc" | "obj"; id: string } | undefined
      );
    }
  }

  /**
   * 将脚本加入队列（不等待）
   */
  queueScript(scriptPath: string): void {
    const executor = this.gameManager.getScriptExecutor();
    if (executor) {
      executor.queueScript(scriptPath);
    }
  }

  /**
   * 获取当前地图名称
   */
  getCurrentMapName(): string {
    return this.gameManager.getCurrentMapName();
  }

  /**
   * 获取脚本基础路径
   */
  getScriptBasePath(): string {
    return this.gameManager.getScriptBasePath();
  }

  /**
   * 检查物品掉落是否启用
   */
  isDropEnabled(): boolean {
    return this._gameManager?.isDropEnabled() ?? true;
  }

  /**
   * 获取指定类型的管理器
   */
  getManager<T extends import("../core/engineContext").ManagerType>(
    type: T
  ): import("../core/engineContext").ManagerMap[T] {
    let result: unknown;
    switch (type) {
      case "magic":
        result = this.gameManager.getMagicManager();
        break;
      case "obj":
        result = this.objManager;
        break;
      case "gui":
        result = this.gameManager.getGuiManager();
        break;
      case "debug":
        result = this.debugManager;
        break;
      case "weather":
        result = this.weatherManager;
        break;
      case "buy":
        result = this.gameManager.getBuyManager();
        break;
      case "interaction":
        result = this.gameManager.getInteractionManager();
        break;
      case "magicHandler":
        result = this.gameManager.getMagicHandler();
        break;
      case "mapRenderer":
        result = this._mapRenderer;
        break;
      case "script":
        result = this.gameManager.getScriptExecutor();
        break;
      default:
        throw new Error(`Unknown manager type: ${type}`);
    }
    return result as import("../core/engineContext").ManagerMap[T];
  }

  /**
   * 获取计时器管理器（非 IEngineContext，引擎内部使用）
   */
  getTimerManager(): TimerManager {
    return this.timerManager;
  }

  /**
   * 获取 UI 桥接器（非 IEngineContext，UI 层使用）
   */
  getUIBridge(): IUIBridge | null {
    return this._uiBridge;
  }

  /**
   * 创建 UI 桥接器
   * 私有方法，在初始化时调用
   */
  private createUIBridge(): UIBridge {
    // Helper to convert slot name to equip index
    // Equipment slot indices: 201-207 (Head, Neck, Body, Back, Hand, Wrist, Foot)
    const slotNameToIndex = (slot: string): number => {
      const mapping: Record<string, number> = {
        head: 201, neck: 202, body: 203, back: 204,
        hand: 205, wrist: 206, foot: 207,
      };
      return mapping[slot] ?? 201;
    };

    const deps: UIBridgeDeps = {
      events: this.events,
      getPlayer: () => this._gameManager?.getPlayer() ?? null,
      getGoodsListManager: () => this._gameManager?.getGoodsListManager() ?? null,
      getMagicListManager: () => this._gameManager?.getMagicListManager() ?? null,
      getBuyManager: () => this._gameManager?.getBuyManager() ?? null,
      getMemoListManager: () => this.memoListManager,
      getTimerManager: () => this.timerManager,

      // Panel toggles
      togglePanel: (panel: UIPanelName) => this.togglePanel(panel as keyof GuiManagerState["panels"]),

      // Actions
      useItem: (index: number) => {
        const goodsManager = this._gameManager?.getGoodsListManager();
        const entry = goodsManager?.getItemInfo(index);
        const player = this._gameManager?.getPlayer();
        const npcManager = this._gameManager?.getNpcManager();
        if (entry?.good) {
          if (entry.good.kind === GoodKind.Equipment) {
            const equipIndex = getEquipSlotIndex(entry.good.part);
            if (equipIndex > 0) {
              goodsManager?.exchangeListItemAndEquiping(index, equipIndex);
            }
          } else if (entry.good.kind === GoodKind.Drug) {
            goodsManager?.usingGood(index);
            // Apply drug effect to player
            player?.useDrug(entry.good);
            // C# Reference: Player.cs line 834-840 - Partner drug effect
            if (entry.good.followPartnerHasDrugEffect > 0 && npcManager) {
              npcManager.forEachPartner((partner) => {
                partner.useDrug(entry.good);
              });
            }
          }
        }
      },
      equipItem: (fromIndex: number, toSlot: string) => {
        const slotIndex = slotNameToIndex(toSlot);
        this._gameManager?.getGoodsListManager()?.exchangeListItemAndEquiping(fromIndex, slotIndex);
      },
      unequipItem: (slot: string) => {
        const slotIndex = slotNameToIndex(slot);
        this._gameManager?.getGoodsListManager()?.unEquipGood(slotIndex);
      },
      swapItems: (fromIndex: number, toIndex: number) => {
        this._gameManager?.getGoodsListManager()?.exchangeListItem(fromIndex, toIndex);
      },
      useBottomItem: (slotIndex: number) => {
        const actualIndex = 221 + slotIndex;
        const goodsManager = this._gameManager?.getGoodsListManager();
        const entry = goodsManager?.getItemInfo(actualIndex);
        const player = this._gameManager?.getPlayer();
        const npcManager = this._gameManager?.getNpcManager();
        goodsManager?.usingGood(actualIndex, player?.level ?? 1);
        // Apply drug effect to player and partners
        if (entry?.good && entry.good.kind === GoodKind.Drug) {
          player?.useDrug(entry.good);
          // C# Reference: Player.cs line 834-840 - Partner drug effect
          if (entry.good.followPartnerHasDrugEffect > 0 && npcManager) {
            npcManager.forEachPartner((partner) => {
              partner.useDrug(entry.good);
            });
          }
        }
      },
      swapEquipSlots: (fromSlot: string, toSlot: string) => {
        const fromIndex = slotNameToIndex(fromSlot);
        const toIndex = slotNameToIndex(toSlot);
        this._gameManager?.getGoodsListManager()?.exchangeListItem(fromIndex, toIndex);
      },
      useMagic: async (magicIndex: number) => {
        // Use magic by right-clicking (assigns to bottom slot first)
        this._gameManager?.handleMagicRightClick(magicIndex);
      },
      useMagicByBottom: async (bottomSlot: number) => {
        await this._gameManager?.useMagicByBottomSlot(bottomSlot);
      },
      setCurrentMagic: (magicIndex: number) => {
        // Convert store index to bottom index first
        // Note: setCurrentMagicByBottomIndex expects a bottom slot index (0-4)
        // This action is typically used when clicking a magic slot in the UI
        // For now, we'll use handleMagicRightClick to move it to bottom slot
        this._gameManager?.handleMagicRightClick(magicIndex);
      },
      setCurrentMagicByBottom: (bottomIndex: number) => {
        this._gameManager?.getMagicListManager()?.setCurrentMagicByBottomIndex(bottomIndex);
      },
      swapMagic: (fromIndex: number, toIndex: number) => {
        this._gameManager?.getMagicListManager()?.exchangeListItem(fromIndex, toIndex);
      },
      assignMagicToBottom: (magicIndex: number, bottomSlot: number) => {
        this.handleMagicDrop(magicIndex, bottomSlot);
      },
      setXiuLianMagic: (magicIndex: number) => {
        const xiuLianIndex = 49;
        this._gameManager?.getMagicListManager()?.exchangeListItem(magicIndex, xiuLianIndex);
      },
      buyItem: async (shopIndex: number) => {
        const buyManager = this._gameManager?.getBuyManager();
        const player = this._gameManager?.getPlayer();
        if (!buyManager || !player) return false;

        return buyManager.buyGood(
          shopIndex,
          player.money,
          async (fileName) => {
            const goodsManager = this._gameManager?.getGoodsListManager();
            if (!goodsManager) return false;
            const result = await goodsManager.addGoodToList(fileName);
            return result.success;
          },
          (amount) => {
            player.money -= amount;
          }
        );
      },
      sellItem: (bagIndex: number) => {
        const goodsManager = this._gameManager?.getGoodsListManager();
        const buyManager = this._gameManager?.getBuyManager();
        const player = this._gameManager?.getPlayer();
        if (!goodsManager || !buyManager || !player) return;

        const entry = goodsManager.getItemInfo(bagIndex);
        if (entry?.good && entry.good.sellPrice > 0 && buyManager.getCanSellSelfGoods()) {
          player.money += entry.good.sellPrice;
          goodsManager.deleteGood(entry.good.fileName);
          buyManager.addGood(entry.good);
        }
      },
      closeShop: () => {
        const buyManager = this._gameManager?.getBuyManager();
        const guiManager = this._gameManager?.getGuiManager();
        buyManager?.endBuy();
        guiManager?.closeBuyGui();
      },
      saveGame: async (slotIndex: number) => {
        return this.saveGameToSlot(slotIndex);
      },
      loadGame: async (slotIndex: number) => {
        try {
          await this.loadGameFromSlot(slotIndex);
          return true;
        } catch {
          return false;
        }
      },
      showSaveLoad: (visible: boolean) => {
        this._gameManager?.getGuiManager()?.showSaveLoad(visible);
      },
      minimapClick: (worldX: number, worldY: number) => {
        const player = this._gameManager?.getPlayer();
        if (player) {
          const tile = pixelToTile(worldX, worldY);
          player.walkTo(tile);
          this.togglePanel("littleMap");
        }
      },
      dialogClick: () => {
        this._gameManager?.getGuiManager()?.handleDialogClick();
      },
      dialogSelect: (selection: number) => {
        this._gameManager?.getGuiManager()?.onDialogSelectionMade(selection);
        this.onSelectionMade(selection);
      },
      selectionChoose: (index: number) => {
        this._gameManager?.getGuiManager()?.selectByIndex(index);
      },
      multiSelectionToggle: (index: number) => {
        this._gameManager?.getGuiManager()?.toggleMultiSelection(index);
      },
      showMessage: (text: string) => {
        this._gameManager?.getGuiManager()?.showMessage(text);
      },
      showSystem: (visible: boolean) => {
        this._gameManager?.getGuiManager()?.showSystem(visible);
      },
      onVideoEnd: () => {
        this.events.emit(GameEvents.UI_VIDEO_END, {});
      },

      // Getters for snapshot
      getPanels: () => {
        const state = this._gameManager?.getGuiManager()?.getState();
        return state?.panels ?? {
          state: false,
          equip: false,
          xiulian: false,
          goods: false,
          magic: false,
          memo: false,
          system: false,
          saveLoad: false,
          buy: false,
          npcEquip: false,
          title: false,
          timer: false,
          littleMap: false,
        };
      },
      getDialogState: () => {
        const state = this._gameManager?.getGuiManager()?.getState();
        return state?.dialog ?? {
          isVisible: false,
          text: "",
          portraitIndex: 0,
          portraitSide: "left" as const,
          nameText: "",
          textProgress: 0,
          isComplete: true,
          isInSelecting: false,
          selectA: "",
          selectB: "",
          selection: -1,
        };
      },
      getSelectionState: () => {
        const state = this._gameManager?.getGuiManager()?.getState();
        return state?.selection ?? {
          isVisible: false,
          message: "",
          options: [],
          selectedIndex: 0,
          hoveredIndex: -1,
        };
      },
      getMultiSelectionState: () => {
        const state = this._gameManager?.getGuiManager()?.getState();
        return state?.multiSelection ?? {
          isVisible: false,
          message: "",
          options: [],
          columns: 1,
          selectionCount: 1,
          selectedIndices: [],
        };
      },
      canSaveGame: () => this._gameManager?.isSaveEnabled() ?? false,
    };

    return new UIBridge(deps);
  }

  /**
   * 获取引擎状态
   */
  getState(): GameEngineState {
    return this.state;
  }

  /**
   * 获取加载进度
   */
  getLoadProgress(): { progress: number; text: string } {
    return {
      progress: this.loadProgress,
      text: this.loadingText,
    };
  }

  /**
   * 获取物品版本（用于触发UI更新）
   */
  getGoodsVersion(): number {
    return this._gameManager?.getGoodsVersion() ?? 0;
  }

  /**
   * 获取武功版本（用于触发UI更新）
   */
  getMagicVersion(): number {
    return this._gameManager?.getMagicVersion() ?? 0;
  }

  /**
   * 获取物品管理器
   */
  getGoodsListManager(): GoodsListManager | null {
    return this._gameManager?.getGoodsListManager() ?? null;
  }

  /**
   * 获取商店武功列表
   */
  getStoreMagics(): (MagicItemInfo | null)[] {
    return this._gameManager?.getStoreMagics() ?? [];
  }

  /**
   * 获取底栏武功列表
   */
  getBottomMagics(): (MagicItemInfo | null)[] {
    return this._gameManager?.getBottomMagics() ?? [];
  }

  /**
   * 判断是否正在加载
   */
  isLoading(): boolean {
    return this.state === "loading";
  }

  // ============= API - 游戏操作 =============

  /**
   * 使用底栏武功
   */
  async useMagicByBottomSlot(slotIndex: number): Promise<void> {
    await this._gameManager?.useMagicByBottomSlot(slotIndex);
  }

  /**
   * 处理武功拖放
   */
  handleMagicDrop(sourceStoreIndex: number, targetBottomSlot: number): void {
    this._gameManager?.handleMagicDrop(sourceStoreIndex, targetBottomSlot);
  }

  /**
   * 处理武功右键
   */
  handleMagicRightClick(storeIndex: number): void {
    this._gameManager?.handleMagicRightClick(storeIndex);
  }

  /**
   * 处理选择
   */
  onSelectionMade(index: number): void {
    this._gameManager?.onSelectionMade(index);
  }

  /**
   * 切换GUI面板
   */
  togglePanel(panel: keyof GuiManagerState["panels"]): void {
    const guiManager = this._gameManager?.getGuiManager();
    if (!guiManager) return;

    switch (panel) {
      case "state":
        guiManager.toggleStateGui();
        break;
      case "equip":
        guiManager.toggleEquipGui();
        break;
      case "xiulian":
        guiManager.toggleXiuLianGui();
        break;
      case "goods":
        guiManager.toggleGoodsGui();
        break;
      case "magic":
        guiManager.toggleMagicGui();
        break;
      case "memo":
        guiManager.toggleMemoGui();
        break;
      case "system":
        guiManager.toggleSystemGui();
        break;
      case "littleMap":
        guiManager.toggleMinimap();
        break;
    }
  }

  // ============= 调试功能 =============

  /**
   * 是否无敌模式
   */
  isGodMode(): boolean {
    return this._gameManager?.isGodMode() ?? false;
  }

  /**
   * 执行脚本
   */
  async executeScript(scriptContent: string): Promise<string | null> {
    return this._gameManager?.executeScript(scriptContent) ?? "游戏未初始化";
  }

  /**
   * 获取玩家状态
   */
  getPlayerStats(): any {
    const player = this._gameManager?.getPlayer();
    if (!player) return null;
    return {
      level: player.level,
      life: player.life,
      lifeMax: player.lifeMax,
      thew: player.thew,
      thewMax: player.thewMax,
      mana: player.mana,
      manaMax: player.manaMax,
      exp: player.exp,
      levelUpExp: player.levelUpExp,
      money: player.money,
    };
  }

  /**
   * 获取玩家位置
   */
  getPlayerPosition(): Vector2 | null {
    const player = this._gameManager?.getPlayer();
    if (!player) return null;
    return { x: player.tilePosition.x, y: player.tilePosition.y };
  }

  /**
   * 获取相机位置（像素坐标）
   */
  getCameraPosition(): Vector2 | null {
    if (!this._mapRenderer) return null;
    return { x: this._mapRenderer.camera.x, y: this._mapRenderer.camera.y };
  }

  /**
   * 获取当前地图数据
   */
  getMapData(): JxqyMapData | null {
    return this._gameManager?.getMapData() ?? null;
  }

  /**
   * 获取性能统计数据
   */
  getPerformanceStats(): PerformanceStatsData {
    return this.performanceStats.getStats();
  }
}

// 便捷函数 - 获取游戏引擎实例
let engineInstance: GameEngine | null = null;

export function getGameEngine(config?: GameEngineConfig): GameEngine {
  if (!engineInstance) {
    engineInstance = GameEngine.getInstance(config);
  }
  return engineInstance;
}

/**
 * 清除便捷函数的引擎实例缓存
 * 在 GameEngine.destroy() 后调用
 */
export function clearEngineInstance(): void {
  engineInstance = null;
}
