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
 * - MapTrapManager: 陷阱配置和触发
 * - CollisionChecker: 瓦片可行走检查
 * - CameraController: 脚本控制相机移动
 * - MagicHandler: 武功使用和管理
 * - InputHandler: 键盘和鼠标输入处理
 * - SpecialActionHandler: 特殊动作状态更新
 *
 * ================================================
 */
import type {
  GameVariables,
  Vector2,
  PlayerData,
  InputState,
} from "../core/types";
import type { JxqyMapData } from "../core/mapTypes";
import { CharacterState } from "../core/types";
import type { EventEmitter } from "../core/eventEmitter";
import { parseIni } from "../core/utils";
import { GameEvents } from "../core/gameEvents";
import { Player } from "../character/player";
import { NpcManager } from "../character/npcManager";
import type { Npc } from "../character/npc";
import { ScriptExecutor, type ScriptContext } from "../script/executor";
import { GuiManager } from "../gui/guiManager";
import { AudioManager } from "../audio";
import { ScreenEffects } from "../effects";
import { ObjManager } from "../obj";
import { MemoListManager } from "../listManager";
import { DebugManager } from "../debug";
import { GoodsListManager, type Good } from "../goods";
import { MagicListManager, MagicManager } from "../magic";
import type { MagicItemInfo } from "../magic";
import type { GlobalResourceManager } from "../resource";

// Import refactored modules
import { createScriptContext } from "./scriptContextFactory";
import { MapTrapManager } from "./mapTrapManager";
import { Loader } from "./loader";
import { CollisionChecker } from "./collisionChecker";
import { CameraController } from "./cameraController";
import { MagicHandler } from "./magicHandler";
import { InputHandler } from "./inputHandler";
import { SpecialActionHandler } from "./specialActionHandler";
import { InteractionManager } from "./interactionManager";

export interface GameManagerConfig {
  onMapChange?: (mapPath: string) => Promise<JxqyMapData | null>;
  onLoadComplete?: () => void;
  getCanvas?: () => HTMLCanvasElement | null;
}

/**
 * 依赖注入 - GameManager 需要的所有外部依赖
 */
export interface GameManagerDeps {
  events: EventEmitter;
  audioManager: AudioManager;
  screenEffects: ScreenEffects;
  objManager: ObjManager;
  globalResources: GlobalResourceManager;
  debugManager: DebugManager;
  memoListManager: MemoListManager;
  trapManager: MapTrapManager;
  clearMouseInput?: () => void; // 清除鼠标按住状态（对话框弹出时调用）
}

export class GameManager {
  // Injected dependencies
  private events: EventEmitter;
  private globalResources: GlobalResourceManager;
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

  // Refactored modules
  private trapManager: MapTrapManager;
  private loader!: Loader;
  private collisionChecker: CollisionChecker;
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
    this.globalResources = deps.globalResources;
    this.debugManager = deps.debugManager;
    this.memoListManager = deps.memoListManager;
    this.trapManager = deps.trapManager;
    this.clearMouseInput = deps.clearMouseInput;

    // Initialize collision checker
    this.collisionChecker = new CollisionChecker();

    // Create walkability checker (matches C# IsObstacleForCharacter)
    const isWalkable = (tile: Vector2) => this.collisionChecker.isTileWalkable(tile);
    const isMapObstacle = (tile: Vector2) => this.collisionChecker.isMapOnlyObstacle(tile);
    const isMapObstacleForJump = (tile: Vector2) => this.collisionChecker.isMapObstacleForJump(tile);

    // Initialize systems
    this.player = new Player(isWalkable, isMapObstacle);
    // 注入等级管理器
    this.player.setLevelManager(this.globalResources.levelManager);
    // Set jump obstacle checker
    this.player.setIsMapObstacleForJump(isMapObstacleForJump);

    this.npcManager = new NpcManager(isWalkable, isMapObstacle);
    // Set player reference for AI system
    this.npcManager.setPlayer(this.player);
    // Set jump obstacle checker for NPCs
    this.npcManager.setIsMapObstacleForJump(isMapObstacleForJump);
    // Set audio manager for NPC sounds (death sound, etc.)
    // C# Reference: Character.SetState() plays sound via NpcIni[(int)state].Sound
    this.npcManager.setAudioManager(this.audioManager);
    this.guiManager = new GuiManager(this.events, this.memoListManager);

    // Set collision checker managers
    this.collisionChecker.setManagers(this.npcManager, this.objManager);

    // Initialize interaction manager
    this.interactionManager = new InteractionManager();

    // Initialize goods list manager
    this.goodsListManager = new GoodsListManager();

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

    // Initialize magic list manager
    this.magicListManager = new MagicListManager();

    // Set up magic manager callbacks for UI updates
    this.magicListManager.setCallbacks({
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
    });

    // Add sprite destroyed listener for logging
    this.magicManager.onSpriteDestroyed((sprite) => {
      console.log(`[Magic] Sprite destroyed: ${sprite.magic.name}`);
    });

    // Set up system references for notifications
    this.player.setGuiManager(this.guiManager);
    this.player.setOnMoneyChange(() => {
      this.goodsVersion++;
      this.events.emit(GameEvents.UI_GOODS_CHANGE, { version: this.goodsVersion });
    });
    this.debugManager.setSystems(this.player, this.npcManager, this.guiManager, this.objManager);

    // Initialize camera controller
    this.cameraController = new CameraController();

    // Create script context
    const scriptContext = this.createScriptContext();
    this.scriptExecutor = new ScriptExecutor(scriptContext);

    // Set up NPC death script callback
    // C#: NpcManager calls ScriptManager.RunScript(DeathScript, npc) when NPC dies
    this.npcManager.setDeathScriptCallback(async (scriptPath: string, npc) => {
      // Build full path like trap scripts do
      const fullPath = scriptPath.startsWith("/")
        ? scriptPath
        : `${this.getScriptBasePath()}/${scriptPath}`;
      console.log(`[GameManager] Running death script for ${npc.name}: ${fullPath}`);
      // Run the death script with the NPC as the belong object context
      await this.scriptExecutor.runScript(fullPath);
    });

    // Set up extended systems for debug manager (after scriptExecutor is created)
    this.debugManager.setExtendedSystems(
      this.goodsListManager,
      this.magicListManager,
      this.scriptExecutor,
      () => this.variables,
      () => ({ mapName: this.currentMapName, mapPath: this.currentMapPath }),
      () => this.trapManager.getIgnoredIndices()
    );

    // Initialize loader (after scriptExecutor is created)
    this.loader = new Loader({
      player: this.player,
      npcManager: this.npcManager,
      objManager: this.objManager,
      audioManager: this.audioManager,
      screenEffects: this.screenEffects,
      goodsListManager: this.goodsListManager,
      magicListManager: this.magicListManager,
      memoListManager: this.memoListManager,
      trapManager: this.trapManager,
      guiManager: this.guiManager,
      getScriptExecutor: () => this.scriptExecutor,
      loadMap: (mapPath) => this.loadMap(mapPath),
      parseIni: parseIni,
      clearScriptCache: () => this.scriptExecutor?.clearCache(),
      clearVariables: () => {
        this.variables = { Event: 0 };
        console.log(`[GameManager] Variables cleared`);
      },
      resetEventId: () => { this.eventId = 0; },
      resetGameTime: () => { this.gameTime = 0; },
      loadPlayerSprites: (npcIni) => this.loadPlayerSprites(npcIni),
      // 存档相关依赖
      getVariables: () => this.variables,
      setVariables: (vars) => {
        this.variables = { ...vars };
        console.log(`[GameManager] Variables restored:`, Object.keys(this.variables).length, 'keys');
      },
      getCurrentMapName: () => this.currentMapName,
      getCanvas: () => this.config.getCanvas?.() ?? null,
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
    this.magicHandler = new MagicHandler({
      player: this.player,
      guiManager: this.guiManager,
      magicListManager: this.magicListManager,
      magicManager: this.magicManager,
      audioManager: this.audioManager,
      getLastInput: () => this.inputHandler?.getLastInput() ?? null,
    });

    // Initialize input handler
    this.inputHandler = new InputHandler({
      player: this.player,
      npcManager: this.npcManager,
      objManager: this.objManager,
      guiManager: this.guiManager,
      debugManager: this.debugManager,
      interactionManager: this.interactionManager,
      audioManager: this.audioManager,
      goodsListManager: this.goodsListManager,
      getScriptExecutor: () => this.scriptExecutor,
      getMagicHandler: () => this.magicHandler,
      getScriptBasePath: () => this.getScriptBasePath(),
    });

    // Initialize special action handler (for script-triggered special actions)
    this.specialActionHandler = new SpecialActionHandler({
      player: this.player,
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
      console.warn(`[GameManager] Failed to load player sprites from ${npcIni}`);
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
      globalResources: this.globalResources,
      goodsListManager: this.goodsListManager,
      memoListManager: this.memoListManager,
      getVariables: () => this.variables,
      setVariable: (name, value) => { this.variables[name] = value; },
      getCurrentMapName: () => this.currentMapName,
      loadMap: (mapPath) => this.loadMap(mapPath),
      loadNpcFile: (fileName) => this.loadNpcFile(fileName),
      loadGameSave: (index) => this.loadGameSave(index),
      setMapTrap: (trapIndex, trapFileName, mapName) => {
        this.trapManager.setMapTrap(trapIndex, trapFileName, this.currentMapName, mapName);
      },
      checkTrap: (tile) => this.checkTrap(tile),
      cameraMoveTo: (direction, distance, speed) => {
        this.cameraController.moveTo(direction, distance, speed);
      },
      isCameraMoving: () => this.cameraController.isMovingByScript(),
      runScript: (scriptFile) => this.scriptExecutor.runScript(scriptFile),
      // Debug hooks
      onScriptStart: this.debugManager.onScriptStart,
      onLineExecuted: this.debugManager.onLineExecuted,
      // Input control
      clearMouseInput: this.clearMouseInput,
    });

    // Override getCurrentMapPath to return the actual value
    context.getCurrentMapPath = () => this.currentMapPath;

    return context;
  }

  /**
   * Get base path for scripts
   */
  private getScriptBasePath(): string {
    const basePath = this.currentMapName
      ? `/resources/script/map/${this.currentMapName}`
      : "/resources/script/common";
    return basePath;
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
    this.trapManager.checkTrap(
      tile,
      this.mapData,
      this.currentMapName,
      this.scriptExecutor,
      () => this.getScriptBasePath(),
      // C#: Globals.ThePlayer.StandingImmediately()
      // Player should stop immediately when trap is triggered
      () => this.player.standingImmediately()
    );
  }

  /**
   * Load a map
   */
  async loadMap(mapPath: string): Promise<void> {
    console.log(`[GameManager] Loading map: ${mapPath}`);
    this.currentMapPath = mapPath;

    // Extract map name from path
    let mapFileName = mapPath.split("/").pop() || mapPath;
    this.currentMapName = mapFileName.replace(/\.map$/i, "");
    console.log(`[GameManager] Map name: ${this.currentMapName}`);

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
        console.log(`[GameManager] Map loaded: ${this.mapData.mapColumnCounts}x${this.mapData.mapRowCounts} tiles`);

        // Update collision checker with new map data
        this.collisionChecker.setMapData(this.mapData);

        // Update magic manager with map obstacle checker
        this.magicManager.setMapObstacleChecker((tileX, tileY) =>
          this.collisionChecker.isMapOnlyObstacle({ x: tileX, y: tileY })
        );

        // Debug trap info
        this.trapManager.debugLogTraps(this.mapData, this.currentMapName);
      }
    }
    console.log(`[GameManager] Map loaded successfully`);
  }

  /**
   * Load NPC file
   */
  async loadNpcFile(fileName: string): Promise<void> {
    console.log(`[GameManager] Loading NPC file: ${fileName}`);
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
   */
  setMapData(mapData: JxqyMapData): void {
    this.mapData = mapData;
    this.collisionChecker.setMapData(mapData);
    // Update magic manager with map obstacle checker
    this.magicManager.setMapObstacleChecker((tileX, tileY) =>
      this.collisionChecker.isMapOnlyObstacle({ x: tileX, y: tileY })
    );
  }

  /**
   * Set current map name
   */
  setCurrentMapName(mapName: string): void {
    this.currentMapName = mapName;
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
  handleClick(worldX: number, worldY: number, button: "left" | "right", ctrlKey: boolean = false, altKey: boolean = false): void {
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
    if (this.trapManager.isInTrapExecution() &&
        !this.scriptExecutor.isRunning() &&
        !this.scriptExecutor.isWaitingForInput()) {
      this.trapManager.setInTrapExecution(false);
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
    if (!this.trapManager.isInTrapExecution()) {
      const playerTile = this.player.tilePosition;
      this.checkTrap(playerTile);
    }

    // Update NPCs
    this.npcManager.update(deltaTime);

    // Update Objects (animation, PlayFrames, etc.)
    // C# Reference: ObjManager.Update - updates all Obj sprites
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
      await this.npcManager.addNpc(`/resources/ini/npc/${npc.file}`, npc.x, npc.y);
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
    return this.globalResources.levelManager;
  }

  getGlobalResources(): GlobalResourceManager {
    return this.globalResources;
  }

  getDebugManager(): DebugManager {
    return this.debugManager;
  }

  getInteractionManager(): InteractionManager {
    return this.interactionManager;
  }

  isGodMode(): boolean {
    return this.debugManager.isGodMode();
  }

  // ============= Camera =============

  cameraMoveTo(direction: number, distance: number, speed: number): void {
    this.cameraController.moveTo(direction, distance, speed);
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
      console.log(`[GameManager] Executing script content directly`);
      await this.scriptExecutor.runScriptContent(trimmed, "DebugPanel");
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[GameManager] Script execution error:`, error);
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
