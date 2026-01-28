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
 * 6. 全局资源初始化 - GlobalResourceManager
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
 *    - 加载全局资源
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

import type { InputState, Vector2 } from "../core/types";
import { CharacterState } from "../core/types";
import { pixelToTile } from "../core/utils";
import type { JxqyMapData } from "../core/mapTypes";
import { GameManager } from "./gameManager";
import { loadMap } from "../map";
import { loadMapMpcs, createMapRenderer, renderMapInterleaved, type MapRenderer } from "../map/renderer";
import { ObjRenderer } from "../obj/objRenderer";
import { EventEmitter } from "../core/eventEmitter";
import { GameEvents, type GameLoadProgressEvent } from "../core/gameEvents";
import type { GuiManagerState } from "../gui/types";
import type { Player } from "../character/player";
import type { Character } from "../character/characterBase";
import type { Npc } from "../character/npc";
import type { MagicItemInfo } from "../magic";
import { magicRenderer } from "../magic/magicRenderer";
import type { Good, GoodsListManager } from "../goods";

// 子系统
import { AudioManager } from "../audio";
import { ScreenEffects } from "../effects";
import { ObjManager } from "../obj";
import { MemoListManager } from "../listManager";
import { DebugManager } from "../debug";
import { MapTrapManager } from "./mapTrapManager";
import { GlobalResourceManager } from "../resource";

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
 */
export class GameEngine {
  private static instance: GameEngine | null = null;

  // ============= 全局资源管理器 =============
  readonly globalResources: GlobalResourceManager;

  // ============= 核心子系统（公开只读）=============
  readonly events: EventEmitter;
  readonly audioManager: AudioManager;
  readonly screenEffects: ScreenEffects;
  readonly objManager: ObjManager;
  readonly debugManager: DebugManager;
  readonly memoListManager: MemoListManager;
  readonly trapManager: MapTrapManager;

  // ============= 游戏相关（延迟初始化）=============
  private _gameManager: GameManager | null = null;
  private _mapRenderer: MapRenderer | null = null;
  private _objRenderer: ObjRenderer | null = null;

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

  // 引擎是否已完成一次性初始化（全局资源已加载）
  private isEngineInitialized: boolean = false;

  private constructor(config: GameEngineConfig) {
    this.config = config;

    // 创建全局资源管理器
    this.globalResources = new GlobalResourceManager();

    // 创建所有子系统
    this.events = new EventEmitter();
    this.audioManager = new AudioManager();
    this.screenEffects = new ScreenEffects();
    this.objManager = new ObjManager();
    this.debugManager = new DebugManager();
    this.memoListManager = new MemoListManager(this.globalResources.talkTextList);
    this.trapManager = new MapTrapManager();

    // 设置 ObjManager 的音频管理器（用于 3D 空间音频）
    this.objManager.setAudioManager(this.audioManager);

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
      console.warn("[GameEngine] Engine already initialized");
      return;
    }

    this.state = "loading";
    this.emitLoadProgress(0, "初始化引擎...");

    try {
      // ========== 阶段1：加载全局资源（只加载一次）==========
      // 通过 GlobalResourceManager 统一加载：
      // - TalkTextList (对话文本)
      // - LevelManager (等级配置)
      // - MagicExp (武功经验配置)
      // - PartnerList (伙伴名单)
      this.emitLoadProgress(10, "加载全局资源...");
      await this.globalResources.initialize();

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
          globalResources: this.globalResources,
          debugManager: this.debugManager,
          memoListManager: this.memoListManager,
          trapManager: this.trapManager,
        },
        {
          onMapChange: async (mapPath) => {
            return this.handleMapChange(mapPath);
          },
          getCanvas: () => this.getCanvas(),
        }
      );

      this.isEngineInitialized = true;
      this.emitLoadProgress(40, "引擎初始化完成");
      console.log("[GameEngine] Engine initialization completed (global resources loaded)");

    } catch (error) {
      console.error("[GameEngine] Engine initialization failed:", error);
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
      console.error("[GameEngine] Cannot start new game: engine not initialized");
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

      console.log("[GameEngine] New game started");
    } catch (error) {
      console.error("[GameEngine] Failed to start new game:", error);
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
      console.error("[GameEngine] Cannot load game: engine not initialized");
      throw new Error("Engine not initialized. Call initialize() first.");
    }

    this.state = "loading";
    this.emitLoadProgress(50, `读取存档 ${index}...`);

    try {
      // 存档加载会恢复武功数据，不需要额外初始化 initializePlayerMagics
      await this.gameManager.loadGameSave(index);

      this.emitLoadProgress(100, "存档加载完成");
      this.state = "running";

      console.log(`[GameEngine] Game loaded from save ${index}`);
    } catch (error) {
      console.error(`[GameEngine] Failed to load game ${index}:`, error);
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
      console.error("[GameEngine] Cannot load game: engine not initialized");
      throw new Error("Engine not initialized. Call initialize() first.");
    }

    this.state = "loading";
    this.emitLoadProgress(50, `读取存档 ${index}...`);

    try {
      // JSON 存档加载会恢复武功数据，不需要额外初始化 initializePlayerMagics
      await this.gameManager.loadGameFromSlot(index);

      this.emitLoadProgress(100, "存档加载完成");
      this.state = "running";

      // 发送初始化完成事件（让 UI 层知道加载完成）
      this.events.emit(GameEvents.GAME_INITIALIZED, { success: true });

      console.log(`[GameEngine] Game loaded from slot ${index}`);
    } catch (error) {
      console.error(`[GameEngine] Failed to load game from slot ${index}:`, error);
      this.events.emit(GameEvents.GAME_INITIALIZED, { success: false });
      throw error;
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
      console.error("[GameEngine] Cannot save game: not initialized");
      return false;
    }

    try {
      return await this.gameManager.saveGame(index);
    } catch (error) {
      console.error(`[GameEngine] Failed to save game to slot ${index}:`, error);
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

      console.log("[GameEngine] Audio settings loaded from localStorage");
    } catch (error) {
      console.warn("[GameEngine] Failed to load audio settings:", error);
    }
  }

  /**
   * 处理地图切换
   */
  private async handleMapChange(mapPath: string): Promise<JxqyMapData | null> {
    this.emitLoadProgress(0, "加载地图...");

    // 构建完整地图路径
    let fullMapPath = mapPath;
    if (!mapPath.startsWith("/")) {
      const mapName = mapPath.replace(".map", "");
      fullMapPath = `/resources/map/${mapName}.map`;
    }

    console.log(`[GameEngine] Loading map: ${fullMapPath}`);

    const mapData = await loadMap(fullMapPath);
    if (mapData) {
      const mapName = fullMapPath.split("/").pop()?.replace(".map", "") || "";

      // C#: 加载新地图时清空已触发的陷阱列表
      // 参考 JxqyMap.LoadMapFromBuffer() 中的 _ingnoredTrapsIndex.Clear()
      this.trapManager.clearIgnoredTraps();

      // 更新地图渲染器
      this.mapRenderer.mapData = mapData;

      // 加载地图MPC资源
      await loadMapMpcs(this.mapRenderer, mapData, mapName, (progress) => {
        this.emitLoadProgress(progress, "加载地图资源...");
      });

      // 更新游戏管理器的地图名称
      this.gameManager.setCurrentMapName(mapName);

      // 发送地图加载事件
      this.events.emit(GameEvents.GAME_MAP_LOAD, {
        mapPath: fullMapPath,
        mapName,
      });

      console.log(`[GameEngine] Map loaded: ${mapName}`);
    }

    return mapData;
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
      console.warn("[GameEngine] Game loop already running");
      return;
    }

    if (this.state !== "running" && this.state !== "paused") {
      console.error("[GameEngine] Cannot start: not initialized");
      return;
    }

    this.isRunning = true;
    this.lastTime = performance.now();
    this.state = "running";

    this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
    console.log("[GameEngine] Game loop started");
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
    console.log("[GameEngine] Game loop stopped");
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
   */
  private gameLoop(timestamp: number): void {
    if (!this.isRunning) return;

    // 计算 deltaTime
    const deltaTime = this.lastTime ? (timestamp - this.lastTime) / 1000 : 0;
    this.lastTime = timestamp;

    // 限制 deltaTime 防止大跳跃
    const cappedDeltaTime = Math.min(deltaTime, 0.1);

    // 更新游戏逻辑
    this.update(cappedDeltaTime);

    // 渲染
    this.render();

    // 继续循环
    this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
  }

  /**
   * 更新游戏逻辑
   */
  private update(deltaTime: number): void {
    if (!this.gameManager || !this.mapRenderer) return;

    const { width, height } = this.config;

    // Update mouse hover state for interaction highlights
    // C# Reference: Player.cs HandleMouseInput - updates OutEdgeNpc/OutEdgeObj
    const viewRect = {
      x: this.mapRenderer.camera.x,
      y: this.mapRenderer.camera.y,
      width,
      height,
    };
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
    }

    // 更新游戏
    this.gameManager.update(deltaTime, this.inputState);

    // 注意：clickedTile不再在这里清除，而是在mouseUp时清除
    // 这样可以支持长按鼠标连续移动

    // 更新相机
    this.updateCamera(deltaTime);
  }

  /**
   * 更新相机
   */
  private updateCamera(deltaTime: number): void {
    if (!this.gameManager || !this.mapRenderer) return;

    const player = this.gameManager.getPlayer();
    const { width, height } = this.config;

    // 检查是否由脚本控制相机
    if (this.gameManager.isCameraMovingByScript()) {
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
      const targetCameraX = player.pixelPosition.x - width / 2;
      const targetCameraY = player.pixelPosition.y - height / 2;

      // 平滑跟随
      this.mapRenderer.camera.x += (targetCameraX - this.mapRenderer.camera.x) * 0.1;
      this.mapRenderer.camera.y += (targetCameraY - this.mapRenderer.camera.y) * 0.1;
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
   * 渲染游戏画面
   */
  private render(): void {
    if (!this.canvasInfo || !this.gameManager || !this.mapRenderer) return;

    const { ctx, width, height } = this.canvasInfo;

    // 清空画布
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // 渲染地图和角色（使用交错渲染）
    this.renderMapInterleaved(ctx);

    // 渲染屏幕特效
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

    // 获取所有NPC
    const allNpcInstances = this.gameManager.getNpcManager().getAllNpcs();

    // 更新NPC动画
    for (const [, npc] of allNpcInstances) {
      // NPC动画更新已在 gameManager.update 中处理
    }

    // 获取视野内的物体
    const allObjs = this.gameManager.getObjManager().getObjsInView({
      x: renderer.camera.x,
      y: renderer.camera.y,
      width,
      height,
    });

    // 按行分组NPC
    const npcsByRow = new Map<number, Npc[]>();
    for (const [, npc] of allNpcInstances) {
      if (!npc.isVisible) continue;
      const row = npc.tilePosition.y;
      if (!npcsByRow.has(row)) npcsByRow.set(row, []);
      npcsByRow.get(row)!.push(npc);
    }

    // 获取武功精灵并按行分组
    const magicMgr = this.gameManager.getMagicManager();
    const magicSpritesByRow = new Map<number, any[]>();
    const effectSpritesByRow = new Map<number, any[]>();

    if (magicMgr) {
      for (const sprite of magicMgr.getMagicSprites().values()) {
        const row = sprite.tilePosition.y;
        if (!magicSpritesByRow.has(row)) magicSpritesByRow.set(row, []);
        magicSpritesByRow.get(row)!.push(sprite);
      }
      for (const sprite of magicMgr.getEffectSprites().values()) {
        const row = sprite.tilePosition.y;
        if (!effectSpritesByRow.has(row)) effectSpritesByRow.set(row, []);
        effectSpritesByRow.get(row)!.push(sprite);
      }
    }

    const playerRow = player.tilePosition.y;

    // 交错渲染（不在这里绘制高亮边缘）
    renderMapInterleaved(ctx, renderer, (row: number) => {
      // 渲染该行的NPC（不绘制高亮，高亮在后面单独绘制）
      const npcsAtRow = npcsByRow.get(row);
      if (npcsAtRow) {
        for (const npc of npcsAtRow) {
          if (npc.isSpritesLoaded()) {
            npc.draw(ctx, renderer.camera.x, renderer.camera.y, false, edgeColor);
          } else {
            this.drawCharacterPlaceholder(ctx, npc, renderer.camera, width, height);
          }
        }
      }

      // 渲染该行的物体（不绘制高亮，高亮在后面单独绘制）
      for (const obj of allObjs) {
        if (obj.tilePosition.y === row) {
          this.objRenderer!.drawObj(ctx, obj, renderer.camera.x, renderer.camera.y, false, edgeColor);
        }
      }

      // 渲染玩家
      if (row === playerRow) {
        if (player.isSpritesLoaded()) {
          player.draw(ctx, renderer.camera.x, renderer.camera.y);
        } else {
          this.drawCharacterPlaceholder(ctx, player, renderer.camera, width, height);
        }
      }

      // 渲染武功精灵
      const magicsAtRow = magicSpritesByRow.get(row);
      if (magicsAtRow) {
        for (const sprite of magicsAtRow) {
          magicRenderer.render(ctx, sprite, renderer.camera.x, renderer.camera.y);
        }
      }

      // 渲染特效精灵
      const effectsAtRow = effectSpritesByRow.get(row);
      if (effectsAtRow) {
        for (const sprite of effectsAtRow) {
          magicRenderer.render(ctx, sprite, renderer.camera.x, renderer.camera.y);
        }
      }
    });

    // === 高亮边缘在所有内容渲染完成后单独绘制（最高层） ===
    // C# Reference: Player.Draw 末尾: if (Globals.OutEdgeSprite != null) { ... }
    if (hoverTarget.type === "npc" && hoverTarget.npc) {
      const npc = hoverTarget.npc;
      if (npc.isSpritesLoaded() && npc.isVisible) {
        npc.drawHighlight(ctx, renderer.camera.x, renderer.camera.y, edgeColor);
      }
    } else if (hoverTarget.type === "obj" && hoverTarget.obj) {
      const obj = hoverTarget.obj;
      this.objRenderer!.drawObjHighlight(ctx, obj, renderer.camera.x, renderer.camera.y, edgeColor);
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
      console.error("[GameEngine] Failed to get 2D context");
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
   */
  handleMouseDown(worldX: number, worldY: number, isRightButton: boolean = false): void {
    if (isRightButton) {
      this.inputState.isRightMouseDown = true;
    } else {
      this.inputState.isMouseDown = true;
    }
    this.inputState.mouseWorldX = worldX;
    this.inputState.mouseWorldY = worldY;

    // 设置点击瓦片
    this.inputState.clickedTile = this.worldToTile(worldX, worldY);
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
   * 处理鼠标点击
   */
  handleClick(worldX: number, worldY: number, button: "left" | "right"): void {
    if (this.gameManager) {
      this.gameManager.handleClick(worldX, worldY, button);
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
   * 获取玩家
   */
  getPlayer(): Player | null {
    return this._gameManager?.getPlayer() ?? null;
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
}

// 便捷函数 - 获取游戏引擎实例
let engineInstance: GameEngine | null = null;

export function getGameEngine(config?: GameEngineConfig): GameEngine {
  if (!engineInstance) {
    engineInstance = GameEngine.getInstance(config);
  }
  return engineInstance;
}
