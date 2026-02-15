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
import { type EngineContext, setEngineContext } from "../core/engine-context";
import { TypedEventEmitter } from "../core/event-emitter";
import { type GameEventMap, GameEvents } from "../core/game-events";
import { logger } from "../core/logger";
import type { Direction, Vector2 } from "../core/types";
import type { BuyManager } from "../gui/buy-manager";
import type { GuiManager } from "../gui/gui-manager";
import { MemoListManager } from "../gui/memo-list-manager";
import { TalkTextListManager } from "../gui/talk-text-list";
import type { GuiManagerState, UIBridge } from "../gui/ui-types";
import type { MagicItemInfo, MagicSpriteManager } from "../magic";
import type { MagicCaster } from "../magic/magic-caster";
import { MagicRenderer } from "../magic/magic-renderer";
import { MapBase } from "../map";
import {
  clearMpcAtlasCache,
  createMapRenderer,
  type MapRenderer,
  renderMapInterleaved,
} from "../map/map-renderer";
import type { MiuMapData } from "../map/types";
import { ObjManager } from "../obj";
import { ObjRenderer } from "../obj/obj-renderer";
import type { GoodsListManager } from "../player/goods";
import type { GoodsItemInfo } from "../player/goods/goods-list-manager";
import { PartnerListManager } from "../player/partner-list";
import type { Player, PlayerStatsInfo } from "../player/player";
import { createRenderer, type RendererBackend } from "../renderer";
import type { Renderer } from "../renderer/renderer";
import { ScreenEffects } from "../renderer/screen-effects";
import { clearAsfCache } from "../resource/format/asf";
import { resourceLoader } from "../resource/resource-loader";
import { resolveScriptPath } from "../resource/resource-paths";
import type { ScriptExecutor } from "../script/executor";
import { Sprite } from "../sprite/sprite";
import type { SaveData } from "../storage/save-types";
import { disposeWasmPathfinder } from "../wasm/wasm-path-finder";
import { WeatherManager } from "../weather";
import { DebugManager } from "./debug-manager";
import { EngineCamera } from "./engine-camera";
import { EngineGameLoader } from "./engine-game-loader";
import { EngineInput } from "./engine-input";
import { EngineLoop } from "./engine-loop";
import { type EngineMapLoaderDeps, handleMapChange } from "./engine-map-loader";
import { renderFrame } from "./engine-renderer";
import { createEngineUIBridge } from "./engine-ui-bridge-factory";
import { updateFrame } from "./engine-update";
import { GameManager } from "./game-manager";
import type { InteractionManager } from "./interaction-manager";
import { PerformanceStats, type PerformanceStatsData } from "./performance-stats";
import { TimerManager } from "./timer-manager";

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
 * 实现 EngineContext 接口，为 Sprite 及其子类提供引擎服务访问
 */
export class GameEngine implements EngineContext {
  // ============= 全局资源 =============
  readonly talkTextList: TalkTextListManager;
  readonly partnerList: PartnerListManager;
  readonly magicRenderer: MagicRenderer;

  // ============= 核心子系统（公开只读）=============
  readonly events: TypedEventEmitter<GameEventMap>;
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

  get manager(): GameManager {
    return this.gameManager;
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

  // ===== EngineContext high-frequency managers =====
  get guiManager(): GuiManager {
    return this.gameManager.guiManager;
  }

  get magicSpriteManager(): MagicSpriteManager {
    return this.gameManager.magicSpriteManager;
  }

  get buyManager(): BuyManager {
    return this.gameManager.buyManager;
  }

  get interactionManager(): InteractionManager {
    return this.gameManager.interactionManager;
  }

  get magicCaster(): MagicCaster {
    return this.gameManager.magicCaster;
  }

  get scriptExecutor(): ScriptExecutor {
    return this.gameManager.scriptExecutor;
  }

  // 游戏循环
  private readonly engineLoop: EngineLoop;

  /** 游戏循环是否正在运行 */
  getIsRunning(): boolean {
    return this.engineLoop.isRunning;
  }

  // 性能统计
  private readonly performanceStats = new PerformanceStats();

  // 配置
  private config: GameEngineConfig;

  // 输入状态
  private engineInput!: EngineInput;

  // 渲染器抽象层（WebGL / Canvas2D）
  private _renderer: Renderer | null = null;
  private rendererBackend: RendererBackend = "auto";

  // 状态
  private state: GameEngineState = "uninitialized";

  // 游戏加载生命周期管理器
  private readonly gameLoader: EngineGameLoader;

  // 摄像机跟随模块
  private readonly engineCamera: EngineCamera;

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
    this.events = new TypedEventEmitter<GameEventMap>();
    this.audio = new AudioManager();
    this.screenEffects = new ScreenEffects();
    this.objManager = new ObjManager();
    this.debugManager = new DebugManager();
    this.memoListManager = new MemoListManager(this.talkTextList);
    this.weatherManager = new WeatherManager(this.audio);
    this.timerManager = new TimerManager();

    // 设置天气系统窗口尺寸
    this.weatherManager.setWindowSize(config.width, config.height);

    // ObjManager 的音频管理器现在通过 EngineContext 获取

    // 摄像机跟随模块
    this.engineCamera = new EngineCamera({
      config: this.config,
      getMapRenderer: () => this.mapRendererInstance,
      getGameManager: () => this.gameManagerInstance,
      screenEffects: this.screenEffects,
    });

    // 输入处理模块
    this.engineInput = new EngineInput({
      getInputHandler: () => this.gameManager.getInputHandler(),
      getPlayer: () => this.gameManager.player,
      getMapCamera: () => this.mapRendererInstance?.camera ?? null,
      getState: () => this.state,
    });

    // 游戏循环模块
    this.engineLoop = new EngineLoop({
      performanceStats: this.performanceStats,
      getState: () => this.state,
      setState: (s) => {
        this.state = s;
      },
      update: (dt) => this.update(dt),
      render: () => this.render(),
    });

    // 游戏加载生命周期管理器
    this.gameLoader = new EngineGameLoader({
      getState: () => this.state,
      setState: (s) => {
        this.state = s;
      },
      getGameManager: () => this.gameManagerInstance,
      events: this.events,
      audio: this.audio,
    });

    // 从 localStorage 加载音频设置
    this.gameLoader.loadAudioSettingsFromStorage();
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
    disposeWasmPathfinder();

    // 7. 事件系统
    this.events.clear();

    // 8. 重置状态
    this.state = "uninitialized";
    this.gameLoader.reset();
    setEngineContext(null);

    logger.info("[GameEngine] Engine disposed - all resources released");
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
    this.gameLoader.reset();
    this.gameLoader.emitLoadProgress(0, "初始化引擎...");

    try {
      // ========== 阶段1：加载全局资源（只加载一次）==========
      this.gameLoader.emitLoadProgress(2, "加载全局资源...");
      await this.talkTextList.initialize();
      this.partnerList.initialize();

      // ========== 阶段2：创建渲染器 ==========
      this.gameLoader.emitLoadProgress(5, "创建渲染器...");
      this.objRendererInstance = new ObjRenderer();
      this.mapRendererInstance = createMapRenderer();
      this.mapRendererInstance.camera = {
        x: 0,
        y: 0,
        width: this.config.width,
        height: this.config.height,
      };

      // ========== 阶段3：创建游戏管理器 ==========
      this.gameLoader.emitLoadProgress(7, "创建游戏管理器...");
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
          clearMouseInput: () => this.engineInput.clearMouseInput(),
        },
        {
          onMapChange: async (mapPath) => {
            return handleMapChange(this.getMapLoaderDeps(), mapPath);
          },
          centerCameraOnPlayer: () => this.engineCamera.centerCameraOnPlayer(),
          notifyPlayerStateChanged: () => this.notifyPlayerStateChanged(),
          setMapProgressCallback: (cb) => {
            this.gameLoader.mapLoadProgressCallback = cb;
          },
        }
      );
      this.gameManagerInstance.setLoadCompleteCallback(() => this.gameLoader.handleLoadComplete());

      // 设置计时器脚本执行回调
      this.timerManager.setScriptRunner((scriptFileName) => {
        const basePath = this.getScriptBasePath();
        const fullPath = resolveScriptPath(basePath, scriptFileName);
        logger.log(`[GameEngine] Timer script triggered: ${scriptFileName} -> ${fullPath}`);
        this.gameManager.runScript(fullPath).catch((err: unknown) => {
          logger.error(`[GameEngine] Timer script failed: ${fullPath}`, err);
        });
      });

      // ========== 阶段4：创建 UI 桥接器 ==========
      this.uiBridgeInstance = this.createUIBridge();
      this.gameLoader.emitLoadProgress(10, "引擎初始化完成");
      logger.log("[GameEngine] Engine initialization completed (global resources loaded)");

      // 提前启动主循环
      if (!this.engineLoop.isRunning) {
        this.start();
      }
    } catch (error) {
      logger.error("[GameEngine] Engine initialization failed:", error);
      this.state = "uninitialized";
      this.gameLoader.emitInitialized(false);
      throw error;
    }
  }

  // ============= 游戏加载（委托 EngineGameLoader）=============

  /** 开始新游戏 */
  async newGame(): Promise<void> {
    return this.gameLoader.newGame();
  }
  /** 读取存档 @param index 存档索引 (1-7)，0 表示初始存档 */
  async loadGame(index: number): Promise<void> {
    return this.gameLoader.loadGame(index);
  }
  /** 从 JSON 数据加载存档 */
  async loadGameFromJSON(data: SaveData): Promise<void> {
    return this.gameLoader.loadGameFromJSON(data);
  }
  /** 收集当前游戏状态用于保存 */
  collectSaveData(): SaveData {
    return this.gameLoader.collectSaveData();
  }

  /** 初始化并开始新游戏（便捷方法）*/
  async initializeAndStartNewGame(): Promise<void> {
    await this.initialize();
    await this.newGame();
  }

  /** 初始化并从 JSON 数据加载存档（便捷方法）*/
  async initializeAndLoadFromJSON(data: SaveData): Promise<void> {
    await this.initialize();
    await this.loadGameFromJSON(data);
  }

  /** 获取当前画布（用于截图）*/
  getCanvas(): HTMLCanvasElement | null {
    return this._renderer?.getCanvas() ?? null;
  }
  /** 获取音频管理器 */
  getAudioManager(): AudioManager {
    return this.audio;
  }

  /** 构建 EngineMapLoaderDeps（供 handleMapChange 使用）*/
  private getMapLoaderDeps(): EngineMapLoaderDeps {
    return {
      getState: () => this.state,
      setState: (s) => {
        this.state = s;
      },
      getMapRenderer: () => this.mapRendererInstance,
      getGameManager: () => this.gameManagerInstance,
      getRenderer: () => this._renderer,
      map: this._map,
      screenEffects: this.screenEffects,
      events: this.events,
      engineCamera: this.engineCamera,
      emitLoadProgress: (p, t) => this.gameLoader.emitLoadProgress(p, t),
      getMapLoadProgressCallback: () => this.gameLoader.mapLoadProgressCallback,
    };
  }

  // ============= 游戏循环（委托 EngineLoop） =============

  start(): void {
    this.engineLoop.start();
  }
  stop(): void {
    this.engineLoop.stop();
  }

  pause(): void {
    if (this.state === "running") {
      this.state = "paused";
      this.gameManager.pause();
      this.events.emit(GameEvents.GAME_PAUSE, {});
    }
  }

  resume(): void {
    if (this.state === "paused") {
      this.state = "running";
      this.gameManager.resume();
      this.events.emit(GameEvents.GAME_RESUME, {});
    }
  }

  /** 更新游戏逻辑（委托 engine-update）*/
  private update(deltaTime: number): void {
    updateFrame(
      {
        state: this.state,
        config: this.config,
        gameManager: this.gameManager,
        mapRenderer: this.mapRenderer,
        performanceStats: this.performanceStats,
        engineInput: this.engineInput,
        audio: this.audio,
        engineCamera: this.engineCamera,
        weatherManager: this.weatherManager,
        timerManager: this.timerManager,
        screenEffects: this.screenEffects,
      },
      deltaTime
    );
  }

  /** 渲染游戏画面（委托 engine-renderer）*/
  private render(): void {
    if (!this._renderer) return;
    renderFrame(this._renderer, {
      config: this.config,
      gameManager: this.gameManager,
      mapRenderer: this.mapRenderer,
      objRenderer: this.objRenderer,
      magicRenderer: this.magicRenderer,
      weatherManager: this.weatherManager,
      renderMapInterleavedFn: renderMapInterleaved,
    });
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
  getRenderer(): Renderer | null {
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
    const oldWidth = this.config.width;
    const oldHeight = this.config.height;
    this.config.width = width;
    this.config.height = height;

    // 同步天气系统尺寸（初始化前也可调用）
    this.weatherManager.setWindowSize(width, height);

    if (this.state === "uninitialized" || !this.mapRendererInstance) {
      this.events.emit(GameEvents.SCREEN_RESIZE, { width, height });
      return;
    }

    const camera = this.mapRendererInstance.camera;
    camera.width = width;
    camera.height = height;

    // 同步 MapBase 视口尺寸（MoveScreenEx 等命令依赖此值计算半屏偏移）
    this._map.viewWidth = width;
    this._map.viewHeight = height;

    // 同步渲染器尺寸
    this._renderer?.resize(width, height);

    // 保持相机中心点不变：根据视口尺寸差调整偏移
    // 不能无条件居中到玩家，因为相机可能在跟随 PlayerKindCharacter（NPC）、
    // 在脚本 MoveScreen/MoveScreenEx 移动中、或在 SetMapPos 设定的位置
    if (this.gameManager.isMapLoaded()) {
      const dw = width - oldWidth;
      const dh = height - oldHeight;
      camera.x -= dw / 2;
      camera.y -= dh / 2;

      // 同步调整 MoveScreenEx 的目标位置（目标是 camera top-left = center - halfView）
      this.gameManager.adjustCameraForViewportResize(dw, dh);

      // 限制相机在地图范围内
      const mapData = this.gameManager.getMapData();
      camera.x = Math.max(0, Math.min(camera.x, mapData.mapPixelWidth - width));
      camera.y = Math.max(0, Math.min(camera.y, mapData.mapPixelHeight - height));
    }

    this.events.emit(GameEvents.SCREEN_RESIZE, { width, height });
  }

  // ============= 输入处理（委托 EngineInput）=============

  handleKeyDown(code: string, shiftKey: boolean = false): boolean {
    return this.engineInput.handleKeyDown(code, shiftKey);
  }

  handleKeyUp(code: string): void {
    this.engineInput.handleKeyUp(code);
  }

  updateModifierKeys(shiftKey: boolean, altKey: boolean, ctrlKey: boolean): void {
    this.engineInput.updateModifierKeys(shiftKey, altKey, ctrlKey);
  }

  handleMouseMove(screenX: number, screenY: number, worldX: number, worldY: number): void {
    this.engineInput.handleMouseMove(screenX, screenY, worldX, worldY);
  }

  handleMouseDown(
    worldX: number,
    worldY: number,
    isRightButton: boolean = false,
    ctrlKey: boolean = false,
    altKey: boolean = false
  ): void {
    this.engineInput.handleMouseDown(worldX, worldY, isRightButton, ctrlKey, altKey);
  }

  handleMouseUp(isRightButton: boolean = false): void {
    this.engineInput.handleMouseUp(isRightButton);
  }

  setJoystickDirection(direction: Direction | null): void {
    this.engineInput.setJoystickDirection(direction);
  }

  canPlayerMove(): boolean {
    return this.engineInput.canPlayerMove();
  }

  handleClick(
    worldX: number,
    worldY: number,
    button: "left" | "right",
    ctrlKey: boolean = false,
    altKey: boolean = false
  ): void {
    this.engineInput.handleClick(worldX, worldY, button, ctrlKey, altKey);
  }

  screenToWorld(screenX: number, screenY: number): Vector2 {
    return this.engineInput.screenToWorld(screenX, screenY);
  }

  // ============= API - 获取游戏状态 =============

  /** 获取事件发射器 */
  getEvents(): TypedEventEmitter<GameEventMap> {
    return this.events;
  }
  /** 获取游戏管理器 */
  getGameManager(): GameManager {
    return this.manager;
  }
  /** 获取GUI状态 */
  getGuiState(): GuiManagerState {
    return this.gameManager.guiManager.getState();
  }
  /** 获取玩家 */
  getPlayer(): Player {
    return this.gameManager.player;
  }

  // ============= EngineContext 接口实现 =============

  get player() {
    return this.gameManager.player;
  }
  get npcManager() {
    return this.gameManager.npcManager;
  }
  get map(): MapBase {
    return this._map;
  }

  async runScript(scriptPath: string, belongObject?: { type: string; id: string }): Promise<void> {
    await this.gameManager.scriptExecutor.runScript(
      scriptPath,
      belongObject as { type: "npc" | "obj"; id: string } | undefined
    );
  }

  queueScript(scriptPath: string): void {
    this.gameManager.scriptExecutor?.queueScript(scriptPath);
  }

  getCurrentMapName(): string {
    return this.gameManager.getCurrentMapName();
  }
  getScriptBasePath(): string {
    return this.gameManager.getScriptBasePath();
  }
  isDropEnabled(): boolean {
    return this.gameManager.isDropEnabled();
  }
  getScriptVariable(name: string): number {
    return this.gameManager.getVariable(name);
  }

  /** 通知玩家状态变更（切换角色/读档后刷新 UI） */
  notifyPlayerStateChanged(): void {
    this.events.emit(GameEvents.UI_PLAYER_CHANGE, {});
    this.events.emit(GameEvents.UI_GOODS_CHANGE, {});
    this.events.emit(GameEvents.UI_MAGIC_CHANGE, {});
  }

  getTimerManager(): TimerManager {
    return this.timerManager;
  }
  getUIBridge(): UIBridge {
    return this.uiBridge;
  }

  private createUIBridge(): UIBridge {
    return createEngineUIBridge(
      this.events,
      this.gameManager,
      this.memoListManager,
      this.timerManager,
      {
        togglePanel: (panel) => this.togglePanel(panel),
        onSelectionMade: (index) => this.onSelectionMade(index),
        handleMagicDrop: (src, slot) => this.handleMagicDrop(src, slot),
      }
    );
  }

  getState(): GameEngineState {
    return this.state;
  }
  isInitialized(): boolean {
    return this.state !== "uninitialized";
  }
  isLoading(): boolean {
    return this.state === "loading";
  }

  getLoadProgress(): { progress: number; text: string } {
    return { progress: this.gameLoader.loadProgress, text: this.gameLoader.loadingText };
  }

  getGoodsVersion(): number {
    return this.gameManager.getGoodsVersion();
  }
  getMagicVersion(): number {
    return this.gameManager.getMagicVersion();
  }
  getGoodsListManager(): GoodsListManager {
    return this.gameManager.goodsListManager;
  }
  getStoreMagics(): (MagicItemInfo | null)[] {
    return this.gameManager.getStoreMagics();
  }
  getBottomMagics(): (MagicItemInfo | null)[] {
    return this.gameManager.getBottomMagics();
  }
  getBottomGoods(): (GoodsItemInfo | null)[] {
    return this.gameManager.getBottomGoods();
  }

  // ============= API - 游戏操作 =============

  stopPlayerMovement(): void {
    this.gameManager.player.stopMovement();
  }
  async useMagicByBottomSlot(slotIndex: number): Promise<void> {
    await this.gameManager.useMagicByBottomSlot(slotIndex);
  }
  handleMagicDrop(sourceStoreIndex: number, targetBottomSlot: number): void {
    this.gameManager.handleMagicDrop(sourceStoreIndex, targetBottomSlot);
  }
  handleMagicRightClick(storeIndex: number): void {
    this.gameManager.handleMagicRightClick(storeIndex);
  }
  onSelectionMade(index: number): void {
    this.gameManager.onSelectionMade(index);
  }

  /** 切换GUI面板 */
  togglePanel(panel: keyof GuiManagerState["panels"]): void {
    const g = this.gameManager.guiManager;
    const togglers: Record<string, () => void> = {
      state: () => g.toggleStateGui(),
      equip: () => g.toggleEquipGui(),
      xiulian: () => g.toggleXiuLianGui(),
      goods: () => g.toggleGoodsGui(),
      magic: () => g.toggleMagicGui(),
      memo: () => g.toggleMemoGui(),
      system: () => g.toggleSystemGui(),
      littleMap: () => g.toggleMinimap(),
    };
    togglers[panel]?.();
  }

  // ============= 调试功能 =============

  isGodMode(): boolean {
    return this.gameManager.isGodMode();
  }
  async executeScript(scriptContent: string): Promise<string | null> {
    return this.gameManager.executeScript(scriptContent);
  }
  getPlayerStats(): PlayerStatsInfo {
    return this.gameManager.player.getStatsInfo();
  }
  getPlayerPosition(): Vector2 {
    const p = this.gameManager.player;
    return { x: p.tilePosition.x, y: p.tilePosition.y };
  }
  getCameraPosition(): Vector2 {
    return { x: this.mapRenderer.camera.x, y: this.mapRenderer.camera.y };
  }
  getMapData(): MiuMapData {
    return this.gameManager.getMapData();
  }

  getCamera(): {
    x: number;
    y: number;
    worldToScreen: (worldX: number, worldY: number) => { x: number; y: number };
  } {
    const c = this.mapRenderer.camera;
    return { x: c.x, y: c.y, worldToScreen: (wx, wy) => ({ x: wx - c.x, y: wy - c.y }) };
  }

  getPerformanceStats(): PerformanceStatsData {
    const r = this._renderer;
    const info = r ? { type: r.type, ...r.getStats() } : undefined;
    return this.performanceStats.getStats(info);
  }
}

export function createGameEngine(config: GameEngineConfig): GameEngine {
  return new GameEngine(config);
}
