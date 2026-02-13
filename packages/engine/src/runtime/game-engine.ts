/**
 * GameEngine - 游戏引擎
 *
 * ================== 职责边界 ==================
 *
 * GameEngine 负责「引擎层」：
 * 1. 引擎容器 - 持有所有子系统实例（依赖注入的根）
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

// 帧率控制常量
const TARGET_FPS = 60;
const FRAME_INTERVAL = 1000 / TARGET_FPS; // ~16.67ms
import type { Character } from "../character/character";
import { ResourcePath, resolveScriptPath } from "../resource/resource-paths";
import { type IEngineContext, setEngineContext } from "../core/engine-context";
import { EventEmitter } from "../core/event-emitter";
import { GameEvents, type GameLoadProgressEvent } from "../core/game-events";
import { logger } from "../core/logger";
import type { MiuMapData } from "../map/types";
import { createDefaultInputState, type InputState, type Vector2 } from "../core/types";
import { CharacterState, type Direction } from "../core/types";
import { DebugManager, type PlayerStatsInfo } from "./debug-manager";
import { ScreenEffects } from "../renderer/screen-effects";
import type { GuiManager } from "../gui/gui-manager";
import type { GuiManagerState } from "../gui/types";
import { MemoListManager } from "../data/memo-list-manager";
import { PartnerListManager } from "../data/partner-list";
import { TalkTextListManager } from "../data/talk-text-list";
import type { MagicItemInfo, MagicManager } from "../magic";
import { MagicRenderer } from "../magic/magic-renderer";
import { MapBase } from "../map";
import { parseMMF } from "../resource/format/mmf";
import { resourceLoader, getGameSlug } from "../resource/resource-loader";
import {
  createMapRenderer,
  loadMapMpcs,
  releaseMapTextures,
  clearMpcAtlasCache,
  type MapRenderer,
  renderMapInterleaved,
} from "../map/map-renderer";
import { ObjManager } from "../obj";
import { ObjRenderer } from "../obj/obj-renderer";
import { GoodKind, type GoodsListManager, getEquipSlotIndex } from "../player/goods";
import type { GoodsItemInfo } from "../player/goods/goods-list-manager";
import type { Player } from "../player/player";
import { Sprite, setSpriteDrawColor } from "../sprite/sprite";
import { clearAsfCache } from "../resource/format/asf";
import { TimerManager } from "../data/timer-manager";
import type { IUIBridge, UIPanelName } from "../gui/contract";
import { UIBridge, type UIBridgeDeps } from "../gui/ui-bridge";
import { pixelToTile } from "../utils";
import { WeatherManager } from "../weather";
import type { IRenderer } from "../renderer/i-renderer";
import { createRenderer, type RendererBackend } from "../renderer";
import { GameManager } from "./game-manager";
import { PerformanceStats, type PerformanceStatsData } from "./performance-stats";
import type { SaveData } from "../storage/storage";
import type { BuyManager } from "../gui/buy-manager";
import type { InteractionManager } from "./interaction-manager";
import type { MagicHandler } from "../magic/magic-handler";
import type { ScriptExecutor } from "../script/executor";

export interface GameEngineConfig {
  width: number;
  height: number;
}

/**
 * 游戏引擎状态
 */
export type GameEngineState = "uninitialized" | "loading" | "running" | "paused";

/**
 * GameEngine 类 - 所有子系统的容器
 * 实现 IEngineContext 接口，为 Sprite 及其子类提供引擎服务访问
 */
export class GameEngine implements IEngineContext {
  // ============= 全局资源 =============
  readonly talkTextList: TalkTextListManager;
  readonly partnerList: PartnerListManager;
  readonly magicRenderer: MagicRenderer;

  // ============= 核心子系统（公开只读）=============
  readonly events: EventEmitter;
  readonly audio: AudioManager;
  readonly screenEffects: ScreenEffects;
  readonly objManager: ObjManager;
  readonly debugManager: DebugManager;
  readonly memoListManager: MemoListManager;
  readonly weatherManager: WeatherManager;
  readonly timerManager: TimerManager;

  // ============= 游戏相关（延迟初始化）=============
  private gameManagerInstance!: GameManager;
  private mapRendererInstance!: MapRenderer;
  private objRendererInstance!: ObjRenderer;
  private uiBridgeInstance!: UIBridge;

  // 断言已初始化的 getter（内部使用，避免大量 ?. 检查）
  private get gameManager(): GameManager {
    return this.gameManagerInstance;
  }

  get mapRenderer(): MapRenderer {
    return this.mapRendererInstance;
  }

  private get objRenderer(): ObjRenderer {
    return this.objRendererInstance;
  }

  private get uiBridge(): UIBridge {
    return this.uiBridgeInstance;
  }

  // ===== IEngineContext high-frequency managers =====
  get guiManager(): GuiManager {
    return this.gameManager.getGuiManager();
  }

  get magicManager(): MagicManager {
    return this.gameManager.getMagicManager();
  }

  get buyManager(): BuyManager {
    return this.gameManager.getBuyManager();
  }

  get interactionManager(): InteractionManager {
    return this.gameManager.getInteractionManager();
  }

  get magicHandler(): MagicHandler {
    return this.gameManager.getMagicHandler();
  }

  get scriptExecutor(): ScriptExecutor {
    return this.gameManager.getScriptExecutor();
  }

  // 游戏循环
  private animationFrameId: number = 0;
  private lastTime: number = 0;
  private isRunning: boolean = false;

  /** 游戏循环是否正在运行 */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  // 帧率控制 - 锁定 60 FPS（与 XNA 版本一致）
  private nextFrameTime: number = 0;

  // 性能统计
  private readonly performanceStats = new PerformanceStats();

  // 配置
  private config: GameEngineConfig;

  // 输入状态
  private inputState: InputState = createDefaultInputState();

  // 渲染器抽象层（WebGL / Canvas2D）
  private _renderer: IRenderer | null = null;
  private rendererBackend: RendererBackend = "auto";

  // 状态
  private state: GameEngineState = "uninitialized";
  private loadProgress: number = 0;
  private loadingText: string = "";
  private hasEmittedReady: boolean = false;

  // 地图加载进度回调（用于存档加载时将 MPC 进度映射到正确范围）
  private mapLoadProgressCallback: ((progress: number, text: string) => void) | null = null;

  // 摄像机跟随 - 记录上次玩家位置，只有玩家移动时才更新摄像机
  //
  private lastPlayerPositionForCamera: Vector2 | null = null;

  // 地图基类实例（由引擎创建和持有）
  private readonly _map: MapBase;


  constructor(config: GameEngineConfig) {
    this.config = config;

    // 设置全局引擎上下文（让 Sprite 及其子类能访问引擎服务）
    setEngineContext(this);

    this._map = new MapBase();
    // 同步 MapBase 视口尺寸到实际画布尺寸
    // C# 中 Carmera.ViewWidth/ViewHeight 由游戏初始化设置
    // 避免 MoveScreenEx 等命令使用默认 800x600 计算半屏偏移导致位置偏移
    this._map.viewWidth = this.config.width;
    this._map.viewHeight = this.config.height;

    // 创建全局资源
    this.talkTextList = new TalkTextListManager();
    this.partnerList = new PartnerListManager();
    this.magicRenderer = new MagicRenderer();

    // 创建所有子系统
    this.events = new EventEmitter();
    this.audio = new AudioManager();
    this.screenEffects = new ScreenEffects();
    this.objManager = new ObjManager();
    this.debugManager = new DebugManager();
    this.memoListManager = new MemoListManager(this.talkTextList);
    this.weatherManager = new WeatherManager(this.audio);
    this.timerManager = new TimerManager();

    // 设置天气系统窗口尺寸
    this.weatherManager.setWindowSize(config.width, config.height);

    // ObjManager 的音频管理器现在通过 IEngineContext 获取

    // 从 localStorage 加载音频设置
    this.loadAudioSettingsFromStorage();
  }

  /**
   * Draw character placeholder (fallback when sprites not loaded)
   * 使用 getContext2D 回退绘制文字和形状
   */
  private drawCharacterPlaceholder(
    renderer: IRenderer,
    character: Character,
    camera: { x: number; y: number },
    width: number,
    height: number
  ): void {
    const ctx = renderer.getContext2D();
    if (!ctx) return;

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
   * 释放引擎资源（用于完全重置）
   *
   * 清理顺序：
   * 1. 停止游戏循环（cancelAnimationFrame）
   * 2. 音频系统（停止所有音乐/音效，关闭 AudioContext）
   * 3. 天气系统（停止雨雪粒子）
   * 4. 计时器系统（清除时间限制）
   * 5. 渲染器（释放 WebGL/Canvas2D 资源）
   * 6. 资源缓存（释放内存）
   * 7. 事件系统（移除所有监听器）
   * 8. 全局引擎上下文
   */
  dispose(): void {
    // 1. 停止游戏循环
    this.stop();

    // 2. 音频系统 - 停止所有音乐/音效，关闭 AudioContext
    this.audio.dispose();

    // 3. 天气系统 - 停止雨雪粒子
    this.weatherManager.dispose();

    // 4. 计时器系统 - 清除时间限制
    this.timerManager.closeTimeLimit();

    // 5. 渲染器 - 释放 WebGL/Canvas2D 资源（纹理、着色器、缓冲区）
    this._renderer?.dispose();
    this._renderer = null;

    // 6. 资源缓存 - 释放内存
    resourceLoader.clearCache();

    // 6.5 模块级缓存 - 需要单独清理，否则跨引擎实例泄漏
    Sprite.clearCache();
    clearAsfCache();
    clearMpcAtlasCache();

    // 7. 事件系统
    this.events.clear();

    // 8. 重置状态
    this.state = "uninitialized";
    this.hasEmittedReady = false;
    setEngineContext(null);

    logger.info("[GameEngine] Engine disposed - all resources released");
  }

  private emitInitialized(success: boolean): void {
    if (success) {
      if (this.hasEmittedReady) return;
      this.hasEmittedReady = true;
    }
    this.events.emit(GameEvents.GAME_INITIALIZED, { success });
  }

  private handleLoadComplete(): void {
    if (this.state !== "loading") return;

    // 核心资源已加载完成，允许进入运行态
    this.state = "running";
    this.emitInitialized(true);
  }

  // ============= 初始化 =============

  /**
   * 初始化游戏引擎（只执行一次）
   *
   * 加载全局资源，创建渲染器和游戏管理器。
   * 这一步不会开始游戏，只是准备好引擎。
   *
   * 对应JxqyGame.Initialize() + LoadContent()
   */
  async initialize(): Promise<void> {
    if (this.state !== "uninitialized") {
      logger.warn("[GameEngine] Engine already initialized");
      return;
    }

    this.state = "loading";
    this.hasEmittedReady = false;
    this.emitLoadProgress(0, "初始化引擎...");

    try {
      // ========== 阶段1：加载全局资源（只加载一次）==========
      this.emitLoadProgress(2, "加载全局资源...");
      await this.talkTextList.initialize();
      this.partnerList.initialize();

      // ========== 阶段2：创建渲染器 ==========
      this.emitLoadProgress(5, "创建渲染器...");
      this.objRendererInstance = new ObjRenderer();
      this.mapRendererInstance = createMapRenderer();
      this.mapRendererInstance.camera = {
        x: 0,
        y: 0,
        width: this.config.width,
        height: this.config.height,
      };

      // ========== 阶段3：创建游戏管理器 ==========
      this.emitLoadProgress(7, "创建游戏管理器...");
      this.gameManagerInstance = new GameManager(
        {
          events: this.events,
          audioManager: this.audio,
          screenEffects: this.screenEffects,
          objManager: this.objManager,
          talkTextList: this.talkTextList,
          debugManager: this.debugManager,
          memoListManager: this.memoListManager,
          weatherManager: this.weatherManager,
          timerManager: this.timerManager,
          map: this._map,
          magicRenderer: this.magicRenderer,
          partnerList: this.partnerList,
          clearMouseInput: () => this.clearMouseInput(),
        },
        {
          onMapChange: async (mapPath) => {
            return this.handleMapChange(mapPath);
          },
          // 加载存档后立即将摄像机居中到玩家位置（避免摄像机飞过去）
          centerCameraOnPlayer: () => this.centerCameraOnPlayer(),
          // 由 Loader 控制地图 MPC/MSF 加载进度回调
          setMapProgressCallback: (cb) => { this.mapLoadProgressCallback = cb; },
        }
      );
      this.gameManagerInstance.setLoadCompleteCallback(() => this.handleLoadComplete());

      // 设置计时器脚本执行回调
      // ScriptExecuter.Update 中使用 Utils.GetScriptParser(_timeScriptFileName) 获取脚本
      // Utils.GetScriptParser 会根据 **当前地图** 构建路径，而不是设置时的地图
      this.timerManager.setScriptRunner((scriptFileName) => {
        // 根据当前地图构建完整脚本路径
        const basePath = this.getScriptBasePath();
        const fullPath = resolveScriptPath(basePath, scriptFileName);
        logger.log(`[GameEngine] Timer script triggered: ${scriptFileName} -> ${fullPath}`);
        this.gameManager.runScript(fullPath).catch((err: unknown) => {
          logger.error(`[GameEngine] Timer script failed: ${fullPath}`, err);
        });
      });

      // ========== 阶段4：创建 UI 桥接器 ==========
      this.uiBridgeInstance = this.createUIBridge();
      this.emitLoadProgress(10, "引擎初始化完成");
      logger.log("[GameEngine] Engine initialization completed (global resources loaded)");

      // 提前启动主循环，在 loading 状态下只推进安全子系统
      if (!this.isRunning) {
        this.start();
      }
    } catch (error) {
      logger.error("[GameEngine] Engine initialization failed:", error);
      this.state = "uninitialized";
      this.emitInitialized(false);
      throw error;
    }
  }

  /**
   * 开始新游戏
   *
   * 运行 NewGame.txt 脚本，该脚本会调用 LoadGame(0) 加载初始存档。
   * 必须先调用 initialize() 完成引擎初始化。
   *
   * 对应Loader.NewGame()
   */
  async newGame(): Promise<void> {
    if (this.state === "uninitialized") {
      logger.error("[GameEngine] Cannot start new game: engine not initialized");
      throw new Error("Engine not initialized. Call initialize() first.");
    }

    this.state = "loading";
    this.emitLoadProgress(10, "开始新游戏...");

    // Loader 统一管理 0-100% 进度（包括地图 MPC 进度），
    // 映射到全局 10-98% 范围
    this.gameManager.setLoadProgressCallback((progress, text) => {
      const mapped = Math.round(10 + progress * 0.88);
      this.emitLoadProgress(mapped, text);
    });

    try {
      // 运行新游戏脚本
      // NewGame.txt 内容: StopMusic() -> LoadGame(0) -> PlayMovie() -> RunScript("Begin.txt")
      // LoadGame(0) 会从初始存档加载武功，不需要额外初始化
      await this.gameManager.newGame();

      // 先切换到 running 状态，再发送完成事件
      // 否则 LOAD_PROGRESS handler 看到 state=loading 会设置 isReady=false
      this.state = "running";
      this.emitLoadProgress(100, "游戏开始");
      this.emitInitialized(true);

      logger.log("[GameEngine] New game started");
    } catch (error) {
      logger.error("[GameEngine] Failed to start new game:", error);
      this.emitInitialized(false);
      throw error;
    } finally {
      this.gameManager.setLoadProgressCallback(undefined);
    }
  }

  /**
   * 读取存档
   *
   * @param index 存档索引 (1-7)，0 表示初始存档
   *
   * 对应Loader.LoadGame(index)
   */
  async loadGame(index: number): Promise<void> {
    if (this.state === "uninitialized") {
      logger.error("[GameEngine] Cannot load game: engine not initialized");
      throw new Error("Engine not initialized. Call initialize() first.");
    }

    this.state = "loading";
    this.emitLoadProgress(10, `读取存档 ${index}...`);

    // Loader 统一管理 0-100% 进度，映射到全局 10-98%
    this.gameManager.setLoadProgressCallback((progress, text) => {
      const mapped = Math.round(10 + progress * 0.88);
      this.emitLoadProgress(mapped, text);
    });

    try {
      await this.gameManager.loadGameSave(index);

      this.state = "running";
      this.emitLoadProgress(100, "存档加载完成");

      logger.log(`[GameEngine] Game loaded from save ${index}`);
    } catch (error) {
      logger.error(`[GameEngine] Failed to load game ${index}:`, error);
      throw error;
    } finally {
      this.gameManager.setLoadProgressCallback(undefined);
    }
  }

  /**
   * 初始化并开始新游戏（便捷方法）
   */
  async initializeAndStartNewGame(): Promise<void> {
    await this.initialize();
    await this.newGame();
  }

  /**
   * 初始化并从 JSON 数据加载存档（便捷方法）
   */
  async initializeAndLoadFromJSON(data: SaveData): Promise<void> {
    await this.initialize();
    await this.loadGameFromJSON(data);
  }

  /**
   * 从 JSON 数据加载存档
   *
   * 设置进度回调并委托给 GameManager，
   * Loader 的 0-100% 映射到全局 10-98%。
   */
  async loadGameFromJSON(data: SaveData): Promise<void> {
    if (this.state === "uninitialized") {
      logger.error("[GameEngine] Cannot load game: engine not initialized");
      throw new Error("Engine not initialized. Call initialize() first.");
    }

    this.state = "loading";
    this.emitLoadProgress(10, "加载存档...");

    // Loader 统一管理 0-100% 进度，映射到全局 10-98%
    this.gameManager.setLoadProgressCallback((progress, text) => {
      const mapped = Math.round(10 + progress * 0.88);
      this.emitLoadProgress(mapped, text);
    });

    try {
      await this.gameManager.loadGameFromJSON(data);

      this.state = "running";
      this.emitLoadProgress(100, "加载完成");
      this.emitInitialized(true);

      logger.log("[GameEngine] Game loaded from JSON save");
    } catch (error) {
      logger.error("[GameEngine] Failed to load game from JSON:", error);
      this.emitInitialized(false);
      throw error;
    } finally {
      this.gameManager.setLoadProgressCallback(undefined);
    }
  }

  /**
   * 收集当前游戏状态用于保存
   */
  collectSaveData(): SaveData {
    return this.gameManager.collectSaveData();
  }

  /**
   * 获取当前画布（用于截图）
   */
  getCanvas(): HTMLCanvasElement | null {
    return this._renderer?.getCanvas() ?? null;
  }

  /**
   * 获取音频管理器
   */
  getAudioManager(): AudioManager {
    return this.audio;
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
        this.audio.setMusicVolume(parseFloat(musicVolume));
      }
      if (soundVolume !== null) {
        this.audio.setSoundVolume(parseFloat(soundVolume));
      }
      if (ambientVolume !== null) {
        this.audio.setAmbientVolume(parseFloat(ambientVolume));
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
  private async handleMapChange(mapPath: string): Promise<MiuMapData> {
    // 确保屏幕是黑的，防止在地图加载过程中看到摄像机移动
    if (!this.screenEffects.isScreenBlack()) {
      this.screenEffects.setFadeTransparency(1);
    }

    const wasRunning = this.state === "running";
    const progressCallback = this.mapLoadProgressCallback;

    if (wasRunning) {
      this.state = "loading";
      this.emitLoadProgress(0, "加载地图...");
    } else if (progressCallback) {
      progressCallback(0, "加载地图...");
    }

    // 构建完整地图路径（MMF 格式）
    let fullMapPath = mapPath;
    if (!mapPath.startsWith("/")) {
      const mapName = mapPath.replace(/\.(map|mmf)$/i, "");
      fullMapPath = ResourcePath.map(`${mapName}.mmf`);
    }

    logger.debug(`[GameEngine] Loading map: ${fullMapPath}`);

    try {
      // 从 Scene API 加载 MMF 二进制数据
      const mapData = await this.loadMapFromSceneApi(fullMapPath);
      if (mapData) {
        const mapName = fullMapPath.split("/").pop()?.replace(/\.(map|mmf)$/i, "") || "";

        // 加载新地图时清空已触发的陷阱列表
        this._map.clearIgnoredTraps();

        // 让 GameManager 在摄像机计算前就拥有 mapData
        this.gameManager.setMapData(mapData);

        // 从 MMF 内嵌的 trapTable 初始化陷阱配置
        this._map.initTrapsFromMapData(mapName);

        // 更新地图渲染器
        this.mapRenderer.mapData = mapData;

        // 释放旧地图的 GPU 纹理
        if (this._renderer) {
          releaseMapTextures(this.mapRenderer, this._renderer);
        }

        // 加载地图 MSF 资源
        await loadMapMpcs(this.mapRenderer, mapData, mapName, (progress) => {
          if (wasRunning) {
            const mappedProgress = Math.round(progress * 100);
            this.emitLoadProgress(mappedProgress, "加载地图资源...");
          } else if (progressCallback) {
            progressCallback(progress, "加载地图资源...");
          }
        });

        // 更新游戏管理器的地图名称
        this.gameManager.setCurrentMapName(mapName);

        // 地图加载后立即居中摄像机到玩家位置
        this.centerCameraOnPlayer();

        // 发送地图加载事件
        this.events.emit(GameEvents.GAME_MAP_LOAD, {
          mapPath: fullMapPath,
          mapName,
        });

        logger.log(`[GameEngine] Map loaded: ${mapName}`);

        if (wasRunning) {
          this.state = "running";
          this.emitLoadProgress(100, "地图加载完成");
        }

        return mapData;
      }

      if (wasRunning) {
        this.state = "running";
        this.emitLoadProgress(100, "");
      }
      throw new Error(`Failed to load map: ${fullMapPath}`);
    } catch (error) {
      logger.error(`[GameEngine] Failed to load map: ${fullMapPath}`, error);
      if (wasRunning) {
        this.state = "running";
        this.emitLoadProgress(100, "");
      }
      throw error;
    }
  }

  /**
   * 从 Scene API 加载 MMF 地图二进制数据
   *
   * 从地图路径提取 sceneKey（如 "map_003_武当山下"），
   * 请求 /game/:gameSlug/api/scenes/:sceneKey/mmf
   */
  private async loadMapFromSceneApi(fullMapPath: string): Promise<MiuMapData | null> {
    const gameSlug = getGameSlug();
    if (!gameSlug) return null;

    // 从路径末尾提取 sceneKey（去掉 .mmf/.map 扩展名）
    const fileName = fullMapPath.split("/").pop() || "";
    const sceneKey = fileName.replace(/\.(mmf|map)$/i, "");
    if (!sceneKey) return null;

    try {
      const apiUrl = `/game/${gameSlug}/api/scenes/${encodeURIComponent(sceneKey)}/mmf`;
      const response = await fetch(apiUrl);
      if (!response.ok) return null;

      const buffer = await response.arrayBuffer();
      if (!buffer || buffer.byteLength === 0) return null;

      const mapData = parseMMF(buffer, fullMapPath);
      if (mapData) {
        logger.log(`[GameEngine] Map loaded from Scene API: ${sceneKey}`);
      }
      return mapData;
    } catch (_error) {
      // API 不可用，返回 null 让调用者 fallback
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

    if (this.state !== "running" && this.state !== "paused" && this.state !== "loading") {
      logger.error("[GameEngine] Cannot start: not initialized");
      return;
    }

    this.isRunning = true;
    this.lastTime = performance.now();
    this.nextFrameTime = performance.now(); // 初始化帧率控制
    if (this.state !== "loading") {
      this.state = "running";
    }

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
   * 锁定 60 FPS，与 XNA 版本保持一致
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
    this.nextFrameTime += FRAME_INTERVAL;
    // 防止掉帧后追帧：如果落后太多，重置到当前时间
    if (timestamp - this.nextFrameTime > FRAME_INTERVAL * 2) {
      this.nextFrameTime = timestamp + FRAME_INTERVAL;
    }

    // 标记帧开始
    this.performanceStats.beginFrame();

    // 固定 deltaTime = 1/60 秒（与 XNA IsFixedTimeStep 一致）
    const fixedDeltaTime = 1 / TARGET_FPS;

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
    // loading 状态下只推进脚本/特效/GUI，避免访问未加载的地图数据
    if (this.state === "loading") {
      this.gameManager.getScriptExecutor().update(deltaTime * 1000);
      this.gameManager.getScreenEffects().update(deltaTime);
      this.gameManager.getGuiManager().update(deltaTime);
      return;
    }

    const { width, height } = this.config;

    // 计算视野区域（复用于多个子系统）
    const viewRect = {
      x: this.mapRenderer.camera.x,
      y: this.mapRenderer.camera.y,
      width,
      height,
    };

    // === 性能优化：Update 阶段预计算视野内对象 ===
    // 中调用 UpdateNpcsInView, UpdateObjsInView
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
    // HandleMouseInput - updates OutEdgeNpc/OutEdgeObj
    this.gameManager.updateMouseHover(
      this.inputState.mouseWorldX,
      this.inputState.mouseWorldY,
      viewRect
    );

    // 更新音频监听者位置（玩家位置）
    // Globals.ListenerPosition = ThePlayer.PositionInWorld
    const player = this.gameManager.getPlayer();
    this.audio.setListenerPosition(player.pixelPosition);
    // 更新玩家遮挡状态（用于半透明效果）
    player.updateOcclusionState();

    // 更新游戏
    this.gameManager.update(deltaTime, this.inputState);

    // 注意：clickedTile不再在这里清除，而是在mouseUp时清除
    // 这样可以支持长按鼠标连续移动

    // 更新相机
    this.updateCamera(deltaTime);

    // 更新天气系统
    // Reference: WeatherManager.Update(gameTime)
    this.weatherManager.update(deltaTime, this.mapRenderer.camera.x, this.mapRenderer.camera.y);

    // 更新计时器系统
    // Reference: TimerGui.Update(gameTime)
    this.timerManager.update(deltaTime);

    // 雨天时设置地图/精灵颜色为灰色
    // Sprite.DrawColor = MapBase.DrawColor = RainMapColor
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

    // 同步 Sprite.drawColor（ChangeAsfColor 效果）
    // C#: Color.Black (0,0,0) 触发灰度着色器, 其他颜色为乘法着色
    // TS: "black" → grayscale filter via COLOR_FILTER_MAP
    if (this.screenEffects.isSpriteGrayscale()) {
      setSpriteDrawColor("black");
    } else {
      setSpriteDrawColor("white");
    }
  }

  /**
   * 获取当前相机跟踪的角色位置
   * C# Globals.PlayerKindCharacter / Globals.PlayerPositionInWorld
   * 优先级: NPC with Kind=Player > ControledCharacter > ThePlayer
   */
  private getPlayerKindPosition(): { x: number; y: number } {
    const npcWithPlayerKind = this.gameManager.getNpcManager().getPlayerKindCharacter();
    if (npcWithPlayerKind) return npcWithPlayerKind.pixelPosition;
    const player = this.gameManager.getPlayer();
    if (player.controledCharacter) return player.controledCharacter.pixelPosition;
    return player.pixelPosition;
  }

  /**
   * 更新相机
   */
  private updateCamera(deltaTime: number): void {
    const { width, height } = this.config;
    // C#: 相机跟踪 PlayerKindCharacter，而非固定跟踪真实玩家
    const playerPos = this.getPlayerKindPosition();

    // 检查是否有 SetPlayerScn 请求（居中到玩家）
    const pendingCenter = this.gameManager.consumePendingCenterOnPlayer();
    if (pendingCenter) {
      // 将摄像机居中到 PlayerKindCharacter
      const targetCameraX = playerPos.x - width / 2;
      const targetCameraY = playerPos.y - height / 2;
      this.mapRenderer.camera.x = targetCameraX;
      this.mapRenderer.camera.y = targetCameraY;
      // 更新上次位置
      this.lastPlayerPositionForCamera = { ...playerPos };
    }

    // 检查是否有 SetMapPos 设置的待处理摄像机位置
    const pendingPos = this.gameManager.consumePendingCameraPosition();
    if (pendingPos) {
      this.mapRenderer.camera.x = pendingPos.x;
      this.mapRenderer.camera.y = pendingPos.y;
      // SetMapPos 后重置上次位置，这样只有角色移动后摄像机才会开始跟随
      this.lastPlayerPositionForCamera = { ...playerPos };
    } else if (this.gameManager.isCameraMovingByScript()) {
      // 检查是否由脚本控制相机 (MoveScreen/MoveScreenEx)
      const newCameraPos = this.gameManager.updateCameraMovement(
        this.mapRenderer.camera.x,
        this.mapRenderer.camera.y,
        deltaTime * 1000
      );
      if (newCameraPos) {
        this.mapRenderer.camera.x = newCameraPos.x;
        this.mapRenderer.camera.y = newCameraPos.y;
      }
      // C# 中 UpdatePlayerView 在每帧都会执行（包括 MoveScreenEx 期间），
      // 始终更新 _lastPlayerPosition。TS 中需要同步更新以防止
      // MoveScreenEx 结束后因 lastPlayerPosition 过时导致相机跳跃。
      this.lastPlayerPositionForCamera = { ...playerPos };
    } else {
      // 正常跟随 PlayerKindCharacter
      // - 只有角色位置改变时才更新摄像机
      const currentPlayerPos = playerPos;
      const lastPos = this.lastPlayerPositionForCamera;

      // 计算玩家位置偏移
      const offsetX = lastPos ? currentPlayerPos.x - lastPos.x : 0;
      const offsetY = lastPos ? currentPlayerPos.y - lastPos.y : 0;
      const hasPlayerMoved = offsetX !== 0 || offsetY !== 0;

      if (hasPlayerMoved || !lastPos) {
        // Carmera.UpdatePlayerView 逻辑：
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
          // 根据玩家移动方向，只有当玩家超过中心点时才更新相机
          if (
            (offsetX > 0 && currentPlayerPos.x > centerX) ||
            (offsetX < 0 && currentPlayerPos.x < centerX)
          ) {
            centerX = currentPlayerPos.x;
          }
          if (
            (offsetY > 0 && currentPlayerPos.y > centerY) ||
            (offsetY < 0 && currentPlayerPos.y < centerY)
          ) {
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
    this.mapRenderer.camera.x = Math.max(
      0,
      Math.min(this.mapRenderer.camera.x, mapData.mapPixelWidth - width)
    );
    this.mapRenderer.camera.y = Math.max(
      0,
      Math.min(this.mapRenderer.camera.y, mapData.mapPixelHeight - height)
    );
  }

  /**
   * 立即将摄像机居中到玩家位置
   * 用于加载存档后避免摄像机从 (0,0) 飞到玩家位置
   */
  private centerCameraOnPlayer(): void {
    const { width, height } = this.config;
    // C#: CenterPlayerInCamera 使用 Globals.PlayerPositionInWorld
    const playerPos = this.getPlayerKindPosition();

    // 直接设置摄像机位置到角色中心（无平滑过渡）
    let targetX = playerPos.x - width / 2;
    let targetY = playerPos.y - height / 2;

    // 限制在地图范围内
    const mapData = this.gameManager.getMapData();
    targetX = Math.max(0, Math.min(targetX, mapData.mapPixelWidth - width));
    targetY = Math.max(0, Math.min(targetY, mapData.mapPixelHeight - height));

    this.mapRenderer.camera.x = targetX;
    this.mapRenderer.camera.y = targetY;
    // 更新上次位置
    this.lastPlayerPositionForCamera = { ...playerPos };

    logger.debug(`[GameEngine] Camera centered on player at (${targetX}, ${targetY})`);
  }

  /**
   * 渲染游戏画面
   */
  private render(): void {
    if (!this._renderer) return;
    const renderer = this._renderer;
    const { width, height } = this.config;

    // 开始渲染帧（重置统计、清屏）
    renderer.beginFrame();

    // 应用地图颜色效果（ChangeMapColor）
    // C#: Color.Black (0,0,0) 是特殊值，触发灰度着色器而非乘以黑色
    const screenEffects = this.gameManager.getScreenEffects();
    const mapGrayscale = screenEffects.isMapGrayscale();
    if (mapGrayscale) {
      renderer.save();
      renderer.setFilter("grayscale");
    }

    // 渲染地图和角色（使用交错渲染）
    this.renderMapInterleaved(renderer);

    if (mapGrayscale) {
      renderer.restore();
    }

    // === 高亮边缘在灰度/着色之后绘制（不受颜色效果影响） ===
    // C#: Globals.OutEdgeSprite 在所有效果之后绘制
    // 必须在 grayscale restore 之后，否则边缘颜色会被灰度化
    {
      const interactionManager = this.gameManager.getInteractionManager();
      const hoverTarget = interactionManager.getHoverTarget();
      const edgeColor = interactionManager.getEdgeColor();
      const mapR = this.mapRenderer;
      if (hoverTarget.type === "npc") {
        const npc = hoverTarget.npc;
        if (npc.isSpritesLoaded() && npc.isVisible) {
          npc.drawHighlight(renderer, mapR.camera.x, mapR.camera.y, edgeColor);
        }
      } else if (hoverTarget.type === "obj") {
        const obj = hoverTarget.obj;
        this.objRenderer.drawObjHighlight(renderer, obj, mapR.camera.x, mapR.camera.y, edgeColor);
      }
    }

    // 应用地图颜色叠加（非黑色的 ChangeMapColor 效果）
    // 使用 Color.Multiply 将颜色应用到地图和精灵
    if (screenEffects.isMapTinted()) {
      const tint = screenEffects.getMapTintColor();
      renderer.save();
      renderer.setBlendMode("multiply");
      renderer.fillRect({
        x: 0,
        y: 0,
        width,
        height,
        color: `rgb(${tint.r}, ${tint.g}, ${tint.b})`,
      });
      renderer.restore();
    }

    // 渲染天气效果（雨、雪）
    // Reference: WeatherManager.Draw(spriteBatch)
    this.weatherManager.draw(renderer, this.mapRenderer.camera.x, this.mapRenderer.camera.y);

    // 渲染屏幕特效（淡入淡出、闪烁）
    this.gameManager.drawScreenEffects(renderer, width, height);

    // 结束渲染帧（flush 批次、保存统计快照）
    renderer.endFrame();
  }

  /**
   * 交错渲染地图、NPC、玩家、物体
   * Enhanced with interaction highlights
   *
   * 中高亮边缘在所有内容绘制完成后单独绘制
   */
  private renderMapInterleaved(r: IRenderer): void {
    if (!this.mapRenderer || !this.gameManager || !this.objRenderer) return;

    const mapR = this.mapRenderer;
    const { width, height } = this.config;

    if (mapR.isLoading || !mapR.mapData) return;

    // 获取玩家
    const player = this.gameManager.getPlayer();

    // === 性能优化：使用 Update 阶段预计算的视野内对象 ===
    // 中直接使用 NpcManager.NpcsInView, ObjManager.ObjsInView
    // 不再每帧重新计算和分组，直接使用预计算的按行分组结果
    const npcManager = this.gameManager.getNpcManager();
    const objManager = this.gameManager.getObjManager();

    // 武功精灵也使用 Update 阶段预计算的按行分组结果
    const magicMgr = this.gameManager.getMagicManager();

    const playerRow = player.tilePosition.y;

    // 交错渲染（不在这里绘制高亮边缘）
    renderMapInterleaved(r, mapR, (row: number) => {
      // 渲染该行的 NPC（使用预计算的按行分组）
      const npcsAtRow = npcManager.getNpcsAtRow(row);
      for (const npc of npcsAtRow) {
        if (npc.isSpritesLoaded()) {
          npc.draw(r, mapR.camera.x, mapR.camera.y);
        } else {
          this.drawCharacterPlaceholder(r, npc, mapR.camera, width, height);
        }
      }

      // 渲染该行的物体（使用预计算的按行分组）
      const objsAtRow = objManager.getObjsAtRow(row);
      for (const obj of objsAtRow) {
        this.objRenderer.drawObj(r, obj, mapR.camera.x, mapR.camera.y);
      }

      // 渲染玩家
      if (row === playerRow) {
        if (player.isSpritesLoaded()) {
          player.draw(r, mapR.camera.x, mapR.camera.y);
        } else {
          this.drawCharacterPlaceholder(r, player, mapR.camera, width, height);
        }
      }

      // 渲染武功精灵（使用 MagicManager 预计算的按行分组）
      if (magicMgr) {
        const magicsAtRow = magicMgr.getMagicSpritesAtRow(row);
        for (const sprite of magicsAtRow) {
          this.magicRenderer.render(r, sprite, mapR.camera.x, mapR.camera.y);
        }

        // 渲染特效精灵
        const effectsAtRow = magicMgr.getEffectSpritesAtRow(row);
        for (const sprite of effectsAtRow) {
          this.magicRenderer.render(r, sprite, mapR.camera.x, mapR.camera.y);
        }
      }
    });

    // === 玩家遮挡半透明效果 ===
    // 当玩家被遮挡物覆盖时绘制半透明效果
    // 在所有地图层和角色绘制完成后，如果玩家被遮挡，再单独绘制一层半透明玩家
    // 注意：需要检查 isDraw，否则 ShowNpc("杨影枫", 0) 隐藏玩家时半透明层仍会显示
    if (player.isSpritesLoaded() && player.isOccluded && player.isDraw) {
      r.save();
      r.setAlpha(0.5);
      player.drawWithColor(r, mapR.camera.x, mapR.camera.y, "white", 0, 0);
      r.restore();
    }

    // === SuperMode 精灵渲染（在所有内容之上） ===
    // if (Globals.IsInSuperMagicMode) { Globals.SuperModeMagicSprite.Draw(_spriteBatch); }
    // SuperMode 精灵不在普通列表中，需要单独渲染
    const superModeMagicMgr = this.magicManager;
    if (superModeMagicMgr.isInSuperMagicMode) {
      const superModeSprite = superModeMagicMgr.superModeMagicSprite;
      if (superModeSprite && !superModeSprite.isDestroyed) {
        this.magicRenderer.render(r, superModeSprite, mapR.camera.x, mapR.camera.y);
      }
    }

    // 注意：高亮边缘不在这里绘制，移到 render() 中 grayscale restore 之后
    // 否则在 ChangeMapColor(0,0,0) 灰度模式下边缘会被灰度化而不可见
  }

  // ============= 画布管理 =============

  /**
   * 设置画布（由React组件调用）
   */
  setCanvas(canvas: HTMLCanvasElement | null): void {
    if (!canvas) {
      this._renderer?.dispose();
      this._renderer = null;
      return;
    }

    // 初始化渲染器抽象层
    try {
      this._renderer = createRenderer(canvas, this.rendererBackend);
      logger.info(`[GameEngine] Renderer initialized: ${this._renderer.type}`);
    } catch (e) {
      logger.error("[GameEngine] Failed to initialize renderer", e);
    }

  }

  /**
   * 获取渲染器抽象层
   */
  getRenderer(): IRenderer | null {
    return this._renderer;
  }

  /**
   * 设置渲染后端偏好（需要在 setCanvas 之前调用）
   */
  setRendererBackend(backend: RendererBackend): void {
    this.rendererBackend = backend;
  }

  /**
   * 更新画布尺寸（窗口调整时调用）
   */
  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;

    // 同步天气系统尺寸（初始化前也可调用）
    this.weatherManager.setWindowSize(width, height);

    if (this.state === "uninitialized" || !this.mapRendererInstance) {
      this.events.emit(GameEvents.SCREEN_RESIZE, { width, height });
      return;
    }

    this.mapRendererInstance.camera.width = width;
    this.mapRendererInstance.camera.height = height;

    // 同步 MapBase 视口尺寸（MoveScreenEx 等命令依赖此值计算半屏偏移）
    this._map.viewWidth = width;
    this._map.viewHeight = height;

    // 同步渲染器尺寸
    this._renderer?.resize(width, height);

    // 重新居中镜头到玩家，确保尺寸变化时玩家始终保持在屏幕中心
    if (this.gameManager.isMapLoaded()) {
      this.centerCameraOnPlayer();
    }

    this.events.emit(GameEvents.SCREEN_RESIZE, { width, height });
  }

  // ============= 输入处理 =============

  /**
   * 处理键盘按下
   */
  handleKeyDown(code: string, shiftKey: boolean = false): boolean {
    this.inputState.keys.add(code);
    this.inputState.isShiftDown = shiftKey;
    return this.gameManager.handleKeyDown(code, shiftKey);
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

    // Update clickedTile while mouse is held down
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
    // Ctrl/Alt clicks are special actions, not movement
    if (!ctrlKey && !altKey) {
      this.inputState.clickedTile = this.worldToTile(worldX, worldY);
    }
  }

  /**
   * 处理鼠标松开
   * Reference: 更新 _lastMouseState
   */
  handleMouseUp(isRightButton: boolean = false): void {
    if (isRightButton) {
      this.inputState.isRightMouseDown = false;
    } else {
      this.inputState.isMouseDown = false;
      // Clear clicked tile when mouse released
      this.inputState.clickedTile = null;
    }

    // 通知 InputHandler 更新按钮状态（用于交互防重复）
    this.gameManager.handleMouseUp(isRightButton);
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
   * 设置摇杆方向（移动端使用）
   * 使用方向移动而非鼠标点击，避免频繁寻路导致卡顿
   * @param direction 方向，null 表示停止移动
   */
  setJoystickDirection(direction: Direction | null): void {
    this.inputState.joystickDirection = direction;
  }

  /**
   * 检查玩家是否可以移动（用于移动端判断是否响应摇杆）
   * 在施法/攻击/跳跃等状态下不能移动
   */
  canPlayerMove(): boolean {
    const player = this.gameManager.getPlayer();
    return player.performActionOk();
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
    this.gameManager.handleClick(worldX, worldY, button, ctrlKey, altKey);
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
    if (this.state === "uninitialized" || !this.mapRendererInstance) {
      return { x: screenX, y: screenY };
    }
    return {
      x: screenX + this.mapRendererInstance.camera.x,
      y: screenY + this.mapRendererInstance.camera.y,
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
  getGameManager(): GameManager {
    return this.gameManager;
  }

  /**
   * 获取GUI状态
   */
  getGuiState(): GuiManagerState {
    return this.gameManager.getGuiManager().getState();
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
    return this._map;
  }

  /**
   * 运行脚本（等待完成）
   */
  async runScript(scriptPath: string, belongObject?: { type: string; id: string }): Promise<void> {
    const executor = this.gameManager.getScriptExecutor();
    await executor.runScript(
      scriptPath,
      belongObject as { type: "npc" | "obj"; id: string } | undefined
    );
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
    return this.gameManager.isDropEnabled();
  }

  /**
   * 获取脚本变量值
   * Reference: ScriptExecuter.GetVariablesValue("$" + VariableName)
   */
  getScriptVariable(name: string): number {
    return this.gameManager.getVariable(name);
  }

  /**
   * 通知玩家状态变更
   * 用于切换角色、读档后刷新 UI（状态面板、物品、武功等）
   *
   * = GuiManager.EquipInterface.Index = index
   */
  notifyPlayerStateChanged(): void {
    this.events.emit(GameEvents.UI_PLAYER_CHANGE, {});
    this.events.emit(GameEvents.UI_GOODS_CHANGE, {});
    this.events.emit(GameEvents.UI_MAGIC_CHANGE, {});
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
  getUIBridge(): IUIBridge {
    return this.uiBridge;
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
        head: 201,
        neck: 202,
        body: 203,
        back: 204,
        hand: 205,
        wrist: 206,
        foot: 207,
      };
      return mapping[slot] ?? 201;
    };

    const deps: UIBridgeDeps = {
      events: this.events,

      // ===== 状态获取器 =====
      state: {
        getPlayer: () => this.gameManager.getPlayer(),
        getPlayerIndex: () => this.gameManager.getPlayer().playerIndex,
        getGoodsListManager: () => this.gameManager.getGoodsListManager(),
        getMagicListManager: () => this.gameManager.getMagicListManager(),
        getBuyManager: () => this.gameManager.getBuyManager(),
        getMemoListManager: () => this.memoListManager,
        getTimerManager: () => this.timerManager,
        getPanels: () => {
          const state = this.gameManager.getGuiManager().getState();
          return state.panels;
        },
        getDialogState: () => {
          const state = this.gameManager.getGuiManager().getState();
          return state.dialog;
        },
        getSelectionState: () => {
          const state = this.gameManager.getGuiManager().getState();
          return state.selection;
        },
        getMultiSelectionState: () => {
          const state = this.gameManager.getGuiManager().getState();
          return state.multiSelection;
        },
        canSaveGame: () => this.gameManager.isSaveEnabled(),
      },

      // ===== 物品操作 =====
      goods: {
        useItem: (index: number) => {
          const goodsManager = this.gameManager.getGoodsListManager();
          const entry = goodsManager.getItemInfo(index);
          const player = this.gameManager.getPlayer();
          const npcManager = this.gameManager.getNpcManager();
          if (entry?.good) {
            if (entry.good.kind === GoodKind.Equipment) {
              const equipIndex = getEquipSlotIndex(entry.good.part);
              if (equipIndex > 0) {
                goodsManager.exchangeListItemAndEquiping(index, equipIndex);
              }
            } else if (entry.good.kind === GoodKind.Drug) {
              goodsManager.usingGood(index);
              player.useDrug(entry.good);
              if (entry.good.followPartnerHasDrugEffect > 0) {
                npcManager.forEachPartner((partner) => {
                  partner.useDrug(entry.good);
                });
              }
            } else if (entry.good.kind === GoodKind.Event) {
              goodsManager.usingGood(index);
            }
          }
        },
        equipItem: (fromIndex: number, toSlot: string) => {
          const slotIndex = slotNameToIndex(toSlot);
          this.gameManager.getGoodsListManager().exchangeListItemAndEquiping(fromIndex, slotIndex);
        },
        unequipItem: (slot: string) => {
          const slotIndex = slotNameToIndex(slot);
          this.gameManager.getGoodsListManager().unEquipGood(slotIndex);
        },
        swapItems: (fromIndex: number, toIndex: number) => {
          this.gameManager.getGoodsListManager().exchangeListItem(fromIndex, toIndex);
        },
        useBottomItem: (slotIndex: number) => {
          const actualIndex = 221 + slotIndex;
          const goodsManager = this.gameManager.getGoodsListManager();
          const entry = goodsManager.getItemInfo(actualIndex);
          const player = this.gameManager.getPlayer();
          const npcManager = this.gameManager.getNpcManager();
          goodsManager.usingGood(actualIndex, player.level);
          if (entry?.good && entry.good.kind === GoodKind.Drug) {
            player.useDrug(entry.good);
            if (entry.good.followPartnerHasDrugEffect > 0) {
              npcManager.forEachPartner((partner) => {
                partner.useDrug(entry.good);
              });
            }
          }
        },
        swapEquipSlots: (fromSlot: string, toSlot: string) => {
          const fromIndex = slotNameToIndex(fromSlot);
          const toIndex = slotNameToIndex(toSlot);
          this.gameManager.getGoodsListManager().exchangeListItem(fromIndex, toIndex);
        },
      },

      // ===== 武功操作 =====
      magic: {
        useMagic: async (magicIndex: number) => {
          this.gameManager.handleMagicRightClick(magicIndex);
        },
        useMagicByBottom: async (bottomSlot: number) => {
          await this.gameManager.useMagicByBottomSlot(bottomSlot);
        },
        setCurrentMagic: (magicIndex: number) => {
          this.gameManager.handleMagicRightClick(magicIndex);
        },
        setCurrentMagicByBottom: (bottomIndex: number) => {
          this.gameManager.getMagicListManager().setCurrentMagicByBottomIndex(bottomIndex);
        },
        swapMagic: (fromIndex: number, toIndex: number) => {
          this.gameManager.getMagicListManager().exchangeListItem(fromIndex, toIndex);
        },
        assignMagicToBottom: (magicIndex: number, bottomSlot: number) => {
          this.handleMagicDrop(magicIndex, bottomSlot);
        },
        setXiuLianMagic: (magicIndex: number) => {
          const xiuLianIndex = 49;
          this.gameManager.getMagicListManager().exchangeListItem(magicIndex, xiuLianIndex);
        },
      },

      // ===== 商店操作 =====
      shop: {
        buyItem: async (shopIndex: number) => {
          const buyManager = this.gameManager.getBuyManager();
          const player = this.gameManager.getPlayer();

          return buyManager.buyGood(
            shopIndex,
            player.money,
            (fileName) => {
              const goodsManager = this.gameManager.getGoodsListManager();
              const result = goodsManager.addGoodToList(fileName);
              return result.success;
            },
            (amount) => {
              player.money -= amount;
            }
          );
        },
        sellItem: (bagIndex: number) => {
          const goodsManager = this.gameManager.getGoodsListManager();
          const buyManager = this.gameManager.getBuyManager();
          const player = this.gameManager.getPlayer();

          const entry = goodsManager.getItemInfo(bagIndex);
          if (entry?.good && entry.good.sellPrice > 0 && buyManager.getCanSellSelfGoods()) {
            player.money += entry.good.sellPrice;
            goodsManager.deleteGood(entry.good.fileName);
            buyManager.addGood(entry.good);
          }
        },
        closeShop: () => {
          const buyManager = this.gameManager.getBuyManager();
          const guiManager = this.gameManager.getGuiManager();
          buyManager.endBuy();
          guiManager.closeBuyGui();
        },
      },

      // ===== 存档操作（已迁移到云存档，保留接口兼容） =====
      save: {
        saveGame: async (_slotIndex: number) => {
          logger.warn("[GameEngine] saveGameToSlot is deprecated, use cloud save instead");
          return false;
        },
        loadGame: async (_slotIndex: number) => {
          logger.warn("[GameEngine] loadGameFromSlot is deprecated, use cloud save instead");
          return false;
        },
        showSaveLoad: (visible: boolean) => {
          this.gameManager.getGuiManager().showSaveLoad(visible);
        },
      },

      // ===== 对话操作 =====
      dialog: {
        dialogClick: () => {
          this.gameManager.getGuiManager().handleDialogClick();
        },
        dialogSelect: (selection: number) => {
          this.gameManager.getGuiManager().onDialogSelectionMade(selection);
          this.onSelectionMade(selection);
        },
        selectionChoose: (index: number) => {
          this.gameManager.getGuiManager().selectByIndex(index);
        },
        multiSelectionToggle: (index: number) => {
          this.gameManager.getGuiManager().toggleMultiSelection(index);
        },
      },

      // ===== 系统操作 =====
      system: {
        togglePanel: (panel: UIPanelName) =>
          this.togglePanel(panel as keyof GuiManagerState["panels"]),
        showMessage: (text: string) => {
          this.gameManager.getGuiManager().showMessage(text);
        },
        showSystem: (visible: boolean) => {
          this.gameManager.getGuiManager().showSystem(visible);
        },
        minimapClick: (worldX: number, worldY: number) => {
          const player = this.gameManager.getPlayer();
          const tile = pixelToTile(worldX, worldY);
          player.walkTo(tile);
          this.togglePanel("littleMap");
        },
        onVideoEnd: () => {
          this.events.emit(GameEvents.UI_VIDEO_END, {});
        },
      },
    };

    return new UIBridge(deps);
  }

  /**
   * 获取引擎状态
   */
  getState(): GameEngineState {
    return this.state;
  }

  isInitialized(): boolean {
    return this.state !== "uninitialized";
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
    return this.gameManager.getGoodsVersion();
  }

  /**
   * 获取武功版本（用于触发UI更新）
   */
  getMagicVersion(): number {
    return this.gameManager.getMagicVersion();
  }

  /**
   * 获取物品管理器
   */
  getGoodsListManager(): GoodsListManager {
    return this.gameManager.getGoodsListManager();
  }

  /**
   * 获取商店武功列表
   */
  getStoreMagics(): (MagicItemInfo | null)[] {
    return this.gameManager.getStoreMagics();
  }

  /**
   * 获取底栏武功列表
   */
  getBottomMagics(): (MagicItemInfo | null)[] {
    return this.gameManager.getBottomMagics();
  }

  /**
   * 获取底栏物品列表
   */
  getBottomGoods(): (GoodsItemInfo | null)[] {
    return this.gameManager.getBottomGoods();
  }

  /**
   * 判断是否正在加载
   */
  isLoading(): boolean {
    return this.state === "loading";
  }

  // ============= API - 游戏操作 =============

  /**
   * 停止玩家移动
   * 用于移动端松开摇杆时立即停止
   */
  stopPlayerMovement(): void {
    this.gameManager.getPlayer().stopMovement();
  }

  /**
   * 使用底栏武功
   */
  async useMagicByBottomSlot(slotIndex: number): Promise<void> {
    await this.gameManager.useMagicByBottomSlot(slotIndex);
  }

  /**
   * 处理武功拖放
   */
  handleMagicDrop(sourceStoreIndex: number, targetBottomSlot: number): void {
    this.gameManager.handleMagicDrop(sourceStoreIndex, targetBottomSlot);
  }

  /**
   * 处理武功右键
   */
  handleMagicRightClick(storeIndex: number): void {
    this.gameManager.handleMagicRightClick(storeIndex);
  }

  /**
   * 处理选择
   */
  onSelectionMade(index: number): void {
    this.gameManager.onSelectionMade(index);
  }

  /**
   * 切换GUI面板
   */
  togglePanel(panel: keyof GuiManagerState["panels"]): void {
    const guiManager = this.gameManager.getGuiManager();

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
    return this.gameManager.isGodMode();
  }

  /**
   * 执行脚本
   */
  async executeScript(scriptContent: string): Promise<string | null> {
    return this.gameManager.executeScript(scriptContent);
  }

  /**
   * 获取玩家状态
   */
  getPlayerStats(): PlayerStatsInfo {
    const player = this.gameManager.getPlayer();
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
      state: player.state,
      isInFighting: player.isInFighting,
    };
  }

  /**
   * 获取玩家位置
   */
  getPlayerPosition(): Vector2 {
    const player = this.gameManager.getPlayer();
    return { x: player.tilePosition.x, y: player.tilePosition.y };
  }

  /**
   * 获取相机位置（像素坐标）
   */
  getCameraPosition(): Vector2 {
    return { x: this.mapRenderer.camera.x, y: this.mapRenderer.camera.y };
  }

  /**
   * 获取相机对象（包含坐标转换方法）
   */
  getCamera(): {
    x: number;
    y: number;
    worldToScreen: (worldX: number, worldY: number) => { x: number; y: number };
  } {
    const camera = this.mapRenderer.camera;
    return {
      x: camera.x,
      y: camera.y,
      worldToScreen: (worldX: number, worldY: number) => ({
        x: worldX - camera.x,
        y: worldY - camera.y,
      }),
    };
  }

  /**
   * 获取当前地图数据
   */
  getMapData(): MiuMapData {
    return this.gameManager.getMapData();
  }

  /**
   * 获取性能统计数据
   */
  getPerformanceStats(): PerformanceStatsData {
    const renderer = this._renderer;
    const rendererInfo = renderer
      ? {
          type: renderer.type,
          ...renderer.getStats(),
        }
      : undefined;
    return this.performanceStats.getStats(rendererInfo);
  }
}

export function createGameEngine(config: GameEngineConfig): GameEngine {
  return new GameEngine(config);
}
