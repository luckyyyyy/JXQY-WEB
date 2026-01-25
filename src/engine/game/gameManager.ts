/**
 * Game Manager - Central game controller
 * Ties together all game systems based on JxqyHD architecture
 */
import type {
  GameVariables,
  Vector2,
  NpcData,
  PlayerData,
  SelectionOption,
  InputState,
} from "../core/types";
import type { JxqyMapData } from "../types";
import { CharacterState, Direction, CharacterKind, RelationType, DEFAULT_PLAYER_STATS } from "../core/types";
import { pixelToTile, tileToPixel } from "../core/utils";
import { PlayerController } from "../character/playerController";
import { NpcManager } from "../character/npcManager";
import { ScriptExecutor, type ScriptContext } from "../script/executor";
import { GuiManager } from "../gui/guiManager";
import { BarrierType } from "../types";
import { AudioManager, getAudioManager } from "../audio";
import { ScreenEffects, getScreenEffects } from "../effects";
import { ObjManager, getObjManager } from "../obj";
import { getTalkTextList } from "../listManager";

export interface GameManagerConfig {
  onMapChange?: (mapPath: string) => Promise<JxqyMapData | null>;
  onLoadComplete?: () => void;
}

export class GameManager {
  // Core systems
  private playerController: PlayerController;
  private npcManager: NpcManager;
  private objManager: ObjManager;
  private scriptExecutor: ScriptExecutor;
  private guiManager: GuiManager;
  private audioManager: AudioManager;
  private screenEffects: ScreenEffects;

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

  // Event tracking
  private eventId: number = 0;

  // Pending actions
  private pendingSleep: number = 0;

  // Level/experience file
  private levelFile: string = "";

  // Trap management (like C#'s _ingnoredTrapsIndex and _traps)
  private ignoredTrapIndices: Set<number> = new Set();
  private mapTraps: Map<string, Map<number, string>> = new Map(); // mapName -> (trapIndex -> scriptFile)

  constructor(config: GameManagerConfig = {}) {
    this.config = config;

    // Create walkability checker
    const isWalkable = (tile: Vector2) => this.isTileWalkable(tile);

    // Initialize systems
    this.playerController = new PlayerController(isWalkable);
    this.npcManager = new NpcManager(isWalkable);
    this.objManager = getObjManager();
    this.guiManager = new GuiManager();
    this.audioManager = getAudioManager();
    this.screenEffects = getScreenEffects();

    // Create script context
    const scriptContext = this.createScriptContext();
    this.scriptExecutor = new ScriptExecutor(scriptContext, this.variables);

    // Set up GUI event handler
    this.guiManager.setEventHandler((event, data) => this.handleGuiEvent(event, data));
  }

  /**
   * Get character by name (player or NPC)
   * Based on C#'s GetPlayerOrNpc - first checks if name matches player, then checks NPCs
   */
  private getCharacterByName(name: string): NpcData | PlayerData | null {
    // First check if it's the player
    const player = this.playerController.getPlayer();
    if (player && player.config && player.config.name === name) {
      return player;
    }
    // Then check NPCs
    return this.npcManager.getNpc(name);
  }

  /**
   * Create script context for script executor
   */
  private createScriptContext(): ScriptContext {
    return {
      // Variables
      getVariable: (name) => this.variables[name] || 0,
      setVariable: (name, value) => {
        this.variables[name] = value;
      },

      // Dialog
      showDialog: (text, portraitIndex) => {
        this.guiManager.showDialog(text, portraitIndex);
      },
      showMessage: (text) => {
        this.guiManager.showMessage(text);
      },
      showSelection: (options) => {
        this.guiManager.showSelection(
          options.map((o) => ({ ...o, enabled: true }))
        );
      },

      // Map
      loadMap: async (mapName) => {
        await this.loadMap(mapName);
      },
      loadNpc: async (fileName) => {
        await this.loadNpcFile(fileName);
      },
      loadGame: async (index) => {
        await this.loadGameSave(index);
      },
      setPlayerPosition: (x, y) => {
        this.playerController.setPosition(x, y);
        // After setting position, check and trigger trap at current position
        // This matches C#'s ScriptExecuter.SetPlayerPos which calls CheckMapTrap()
        this.checkTrap({ x, y });
      },
      setPlayerDirection: (direction) => {
        this.playerController.setDirection(direction);
      },
      setPlayerState: (state) => {
        this.playerController.setState(state);
      },
      playerGoto: (x, y) => {
        this.playerController.walkToTile(x, y);
      },

      // NPC
      addNpc: (npcFile, x, y) => {
        this.npcManager.addNpc(`/resources/ini/npc/${npcFile}`, x, y);
      },
      deleteNpc: (name) => {
        this.npcManager.deleteNpc(name);
      },
      getNpcPosition: (name) => {
        const character = this.getCharacterByName(name);
        return character ? character.tilePosition : null;
      },
      setNpcPosition: (name, x, y) => {
        // First check if it's the player
        const player = this.playerController.getPlayer();
        if (player && player.config && player.config.name === name) {
          this.playerController.setPosition(x, y);
          return;
        }
        this.npcManager.setNpcPosition(name, x, y);
      },
      npcGoto: (name, x, y) => {
        // First check if it's the player
        const player = this.playerController.getPlayer();
        if (player && player.config && player.config.name === name) {
          this.playerController.walkToTile(x, y);
          return;
        }
        this.npcManager.npcGoto(name, x, y);
      },
      setNpcActionFile: (name, stateType, asfFile) => {
        // Set the action file for a specific state
        // Based on C#'s GetPlayerOrNpc - first checks player, then NPCs
        const player = this.playerController.getPlayer();
        if (player && player.config && player.config.name === name) {
          // For player, store in customActionFiles
          if (!player.sprite) {
            player.sprite = {
              basePath: "/resources/asf/character",
              baseFileName: "",
              isLoaded: false,
              currentFrame: 0,
              animationTime: 0,
            };
          }
          // TODO: player needs customActionFiles support
          console.log(`SetNpcActionFile for player: state=${stateType}, file=${asfFile}`);
          return;
        }
        this.npcManager.setNpcActionFile(name, stateType, asfFile);
      },
      npcSpecialAction: (name, asfFile) => {
        const character = this.getCharacterByName(name);
        if (character && 'specialActionAsf' in character) {
          (character as NpcData).specialActionAsf = asfFile;
        }
      },
      setNpcLevel: (name, level) => {
        // Set NPC level for combat calculations
        this.npcManager.setNpcLevel(name, level);
      },
      setNpcDirection: (name, direction) => {
        this.npcManager.setNpcDirection(name, direction);
      },
      setNpcState: (name, state) => {
        this.npcManager.setNpcState(name, state);
      },

      // Player
      addGoods: (goodsName, count) => {
        console.log(`AddGoods: ${goodsName} x${count}`);
        // TODO: Implement inventory
      },
      removeGoods: (goodsName, count) => {
        console.log(`RemoveGoods: ${goodsName} x${count}`);
        // TODO: Implement inventory
      },
      equipGoods: (equipType, goodsId) => {
        console.log(`EquipGoods: type=${equipType}, id=${goodsId}`);
        // TODO: Implement equipment
      },
      addMoney: (amount) => {
        this.playerController.addMoney(amount);
      },
      addExp: (amount) => {
        this.playerController.addExp(amount);
      },
      addToMemo: (memoId) => {
        console.log(`AddToMemo: ${memoId}`);
        // TODO: Implement memo/quest log
      },

      // Obj (interactive objects)
      loadObj: async (fileName) => {
        console.log(`[GameManager] LoadObj command: ${fileName}`);
        const result = await this.objManager.load(fileName);
        console.log(`[GameManager] LoadObj result: ${result}`);
      },
      addObj: async (fileName, x, y, direction) => {
        console.log(`[GameManager] AddObj command: ${fileName} at (${x}, ${y}) dir=${direction}`);
        await this.objManager.addObjByFile(fileName, x, y, direction);
      },

      // Trap management
      setMapTrap: (trapIndex, trapFileName, mapName) => {
        this.setMapTrap(trapIndex, trapFileName, mapName);
      },

      // Game flow
      sleep: (ms) => {
        this.pendingSleep = ms;
      },
      playMusic: (file) => {
        // Play background music using AudioManager
        this.audioManager.playMusic(file);
      },
      stopMusic: () => {
        // Stop background music
        this.audioManager.stopMusic();
      },
      playSound: (file) => {
        // Play sound effect
        this.audioManager.playSound(file);
      },
      fadeIn: () => {
        // Start fade in effect (screen goes from black to normal)
        this.screenEffects.fadeIn();
      },
      fadeOut: () => {
        // Start fade out effect (screen goes to black)
        this.screenEffects.fadeOut();
      },
      changeMapColor: (r, g, b) => {
        // Change map tint color
        this.screenEffects.setMapColor(r, g, b);
      },
      changeAsfColor: (r, g, b) => {
        // Change sprite tint color
        this.screenEffects.setSpriteColor(r, g, b);
      },
      setLevelFile: (file) => {
        // Set the experience/level configuration file
        this.levelFile = file;
      },

      // Wait for input
      waitForDialogClose: () => {
        // Handled by script executor
      },
      waitForSelection: () => {
        // Handled by script executor
      },
      getSelectionResult: () => {
        return this.guiManager.getState().selection.selectedIndex;
      },

      // Script management
      runScript: async (scriptFile) => {
        const basePath = this.getScriptBasePath();
        await this.scriptExecutor.runScript(`${basePath}/${scriptFile}`);
      },
      getCurrentMapPath: () => this.currentMapPath,
    };
  }

  /**
   * Get base path for scripts
   */
  private getScriptBasePath(): string {
    const basePath = this.currentMapName
      ? `/resources/script/map/${this.currentMapName}`
      : "/resources/script/common";
    console.log(`[GameManager] Script base path: ${basePath}`);
    return basePath;
  }

  /**
   * Handle GUI events
   */
  private handleGuiEvent(event: string, data?: any): void {
    switch (event) {
      case "dialog:closed":
        this.scriptExecutor.onDialogClosed();
        break;
      case "selection:confirmed":
        this.scriptExecutor.onSelectionMade(data?.index || 0);
        break;
    }
  }

  /**
   * Check if a tile is walkable
   * Matches C# JxqyMap.IsObstacleForCharacter logic
   */
  private isTileWalkable(tile: Vector2): boolean {
    if (!this.mapData) return false; // No map data = obstacle

    // Check map bounds - C# returns true (obstacle) when out of bounds
    if (
      tile.x < 0 ||
      tile.x >= this.mapData.mapColumnCounts ||
      tile.y < 0 ||
      tile.y >= this.mapData.mapRowCounts
    ) {
      return false; // Out of bounds = obstacle
    }

    // Check tile barrier using C# logic:
    // IsObstacleForCharacter checks: (type & (Obstacle + Trans)) == 0
    // If result is 0, it's walkable (return false from IsObstacleForCharacter)
    // If result is non-zero, it's obstacle (return true from IsObstacleForCharacter)
    const tileIndex = tile.x + tile.y * this.mapData.mapColumnCounts;
    const tileInfo = this.mapData.tileInfos[tileIndex];
    if (tileInfo) {
      const barrier = tileInfo.barrierType;
      const Obstacle = 0x80;
      const Trans = 0x40;
      // C#: if ((type & (Obstacle + Trans)) == 0) return false; else return true;
      // So for walkability (opposite of obstacle): if ((type & (Obstacle + Trans)) != 0) return false;
      if ((barrier & (Obstacle + Trans)) !== 0) {
        return false; // Has Obstacle or Trans flag = not walkable
      }
    }

    // Check NPC collision
    if (this.npcManager.isObstacle(tile.x, tile.y)) {
      return false;
    }

    // Check Obj collision
    if (this.objManager.isObstacle(tile.x, tile.y)) {
      return false;
    }

    return true;
  }

  /**
   * Load a map
   * Based on C#'s ScriptExecuter.LoadMap
   */
  async loadMap(mapPath: string): Promise<void> {
    console.log(`[GameManager] Loading map: ${mapPath}`);
    this.currentMapPath = mapPath;

    // Extract map name from path
    const match = mapPath.match(/map_\d+_([^/]+)/);
    if (match) {
      this.currentMapName = match[0];
    } else {
      this.currentMapName = mapPath.split("/").pop()?.replace(".map", "") || "";
    }
    console.log(`[GameManager] Map name: ${this.currentMapName}`);

    // Clear NPCs and Objs (matches C# LoadMap behavior)
    // C#: NpcManager.ClearAllNpcAndKeepPartner(); ObjManager.ClearAllObjAndFileName();
    console.log(`[GameManager] Clearing NPCs and Objs...`);
    this.npcManager.clearAllNpcs();
    this.objManager.clearAll();
    this.scriptExecutor.clearCache();

    // Clear ignored trap indices when loading new map
    // (trap indices are per-instance, not persistent across map loads for different maps)
    this.ignoredTrapIndices.clear();

    // Load map data via callback
    if (this.config.onMapChange) {
      this.mapData = await this.config.onMapChange(mapPath);
    }
    console.log(`[GameManager] Map loaded successfully`);
  }

  /**
   * Load NPC file
   * Based on C#'s NpcManager.Load
   */
  async loadNpcFile(fileName: string): Promise<void> {
    console.log(`[GameManager] Loading NPC file: ${fileName}`);
    await this.npcManager.loadNpcFile(fileName);
  }

  /**
   * Load game save from a save slot
   * Based on C#'s Loader.LoadGame
   */
  async loadGameSave(index: number): Promise<void> {
    console.log(`[GameManager] Loading game save index: ${index}`);

    try {
      // Load Game.ini from save directory
      // Index 0 = resources/save/game/Game.ini (initial save)
      // Index 1-7 = resources/save/rpgN/Game.ini
      const basePath = index === 0 ? "/resources/save/game" : `/resources/save/rpg${index}`;
      const gameIniPath = `${basePath}/Game.ini`;

      const response = await fetch(gameIniPath);
      if (!response.ok) {
        console.error(`[GameManager] Failed to load Game.ini: ${gameIniPath}`);
        return;
      }

      // Read as binary and decode with GBK
      const buffer = await response.arrayBuffer();
      let decoder: TextDecoder;
      try {
        decoder = new TextDecoder("gbk");
      } catch {
        decoder = new TextDecoder("utf-8");
      }
      const content = decoder.decode(new Uint8Array(buffer));

      // Parse Game.ini
      const sections = this.parseIni(content);
      const stateSection = sections["State"];

      if (stateSection) {
        // Load Map
        const mapName = stateSection["Map"];
        if (mapName) {
          console.log(`[GameManager] Loading map from save: ${mapName}`);
          await this.loadMap(mapName);
        }

        // Load NPCs
        const npcFile = stateSection["Npc"];
        if (npcFile) {
          console.log(`[GameManager] Loading NPC file from save: ${npcFile}`);
          await this.npcManager.loadNpcFile(npcFile);
        }

        // Load Objects
        const objFile = stateSection["Obj"];
        if (objFile) {
          console.log(`[GameManager] Loading Obj file from save: ${objFile}`);
          await this.objManager.load(objFile);
        }

        // Load Background Music
        const bgm = stateSection["Bgm"];
        if (bgm) {
          this.audioManager.playMusic(bgm);
        }

        // Player character index
        const chrIndex = parseInt(stateSection["Chr"] || "0", 10);
        // TODO: Use chrIndex for player character selection
      }

      console.log(`[GameManager] Game save loaded successfully`);
    } catch (error) {
      console.error(`[GameManager] Error loading game save:`, error);
    }
  }

  /**
   * Simple INI parser
   */
  private parseIni(content: string): Record<string, Record<string, string>> {
    const sections: Record<string, Record<string, string>> = {};
    let currentSection = "";

    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("//")) {
        continue;
      }

      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        sections[currentSection] = {};
        continue;
      }

      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0 && currentSection) {
        const key = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim();
        sections[currentSection][key] = value;
      }
    }

    return sections;
  }

  /**
   * Initialize global resources (call once before creating GameManager)
   * This loads TalkIndex.txt and other shared resources
   */
  static async initializeGlobalResources(): Promise<void> {
    console.log("[GameManager] Initializing global resources...");

    // Initialize TalkTextList
    const talkTextList = getTalkTextList();
    await talkTextList.initialize();

    console.log("[GameManager] Global resources initialized");
  }

  /**
   * Initialize new game
   */
  async newGame(): Promise<void> {
    // Reset state
    this.variables = { Event: 0 };
    this.eventId = 0;
    this.gameTime = 0;

    // Run NewGame script
    await this.scriptExecutor.runScript("/resources/script/common/NewGame.txt");
  }

  /**
   * Load initial game state from game.ini (objects, NPCs, etc.)
   * This is called at game start to set up the initial world state
   */
  async loadInitialGameState(): Promise<void> {
    console.log(`[GameManager] Loading initial game state from game.ini...`);
    try {
      const response = await fetch('/resources/ini/save/game.ini');
      if (!response.ok) {
        console.warn(`[GameManager] No game.ini found, skipping initial state load`);
        return;
      }

      const buffer = await response.arrayBuffer();
      const decoder = new TextDecoder('gbk');
      const content = decoder.decode(new Uint8Array(buffer));
      const sections = this.parseIni(content);

      const state = sections['State'];
      if (state) {
        // Load Obj file
        if (state['Obj']) {
          console.log(`[GameManager] Loading initial Obj file: ${state['Obj']}`);
          await this.objManager.load(state['Obj']);
        }

        // Load Npc file (if not already loaded by script)
        if (state['Npc']) {
          console.log(`[GameManager] Loading initial Npc file: ${state['Npc']}`);
          await this.npcManager.loadNpcFile(state['Npc']);
        }
      }

      console.log(`[GameManager] Initial game state loaded`);
    } catch (error) {
      console.warn(`[GameManager] Error loading initial game state:`, error);
    }
  }

  /**
   * Run map initialization script
   */
  async initMap(): Promise<void> {
    // First, load initial game state (objects, NPCs from game.ini)
    await this.loadInitialGameState();

    const basePath = this.getScriptBasePath();
    const scriptPath = `${basePath}/Begin.txt`;
    console.log(`[GameManager] Initializing map, running script: ${scriptPath}`);
    try {
      await this.scriptExecutor.runScript(scriptPath);
      console.log(`[GameManager] Map initialization completed`);
    } catch (error) {
      console.warn(`[GameManager] No Begin.txt found for map, skipping initialization:`, error);
    }
  }

  /**
   * Set map data
   */
  setMapData(mapData: JxqyMapData): void {
    this.mapData = mapData;
  }

  /**
   * Set current map name (for script path resolution)
   */
  setCurrentMapName(mapName: string): void {
    this.currentMapName = mapName;
  }

  /**
   * Handle keyboard input
   */
  handleKeyDown(code: string): boolean {
    // GUI takes priority
    if (this.guiManager.handleHotkey(code)) {
      return true;
    }

    return false;
  }

  /**
   * Handle mouse click
   */
  handleClick(worldX: number, worldY: number, button: "left" | "right"): void {
    // Check GUI first
    if (this.guiManager.isBlockingInput()) {
      if (button === "left") {
        this.guiManager.handleDialogClick();
      }
      return;
    }

    if (button === "left") {
      // Convert to tile position
      const tile = pixelToTile(worldX, worldY);

      // Check for NPC interaction
      const npc = this.npcManager.getNpcAtTile(tile.x, tile.y);
      if (npc && npc.config.kind === CharacterKind.Eventer) {
        // Walk to NPC and interact
        this.interactWithNpc(npc);
        return;
      }

      // Otherwise, walk to clicked position
      this.playerController.walkToTile(tile.x, tile.y);
    }
  }

  /**
   * Interact with an NPC
   */
  async interactWithNpc(npc: NpcData): Promise<void> {
    if (!npc.config.scriptFile) {
      this.guiManager.showMessage("...");
      return;
    }

    // Run NPC's script
    const basePath = this.getScriptBasePath();
    await this.scriptExecutor.runScript(`${basePath}/${npc.config.scriptFile}`);
  }

  /**
   * Get trap script file name for a given index
   * Checks custom trap mapping first (from SetTrap/SetMapTrap), then defaults
   */
  private getTrapScriptFileName(trapIndex: number): string | null {
    // Check if trap is in ignored list
    if (this.ignoredTrapIndices.has(trapIndex)) {
      return null;
    }

    // Check if there's a custom trap mapping for current map
    const mapTraps = this.mapTraps.get(this.currentMapName);
    if (mapTraps && mapTraps.has(trapIndex)) {
      const customScript = mapTraps.get(trapIndex)!;
      // Empty string means trap is removed
      if (customScript === "") return null;
      return customScript;
    }

    // Default trap file naming
    return `Trap${trapIndex.toString().padStart(2, "0")}.txt`;
  }

  /**
   * Set trap script for a map (called by SetTrap/SetMapTrap script commands)
   * Based on C#'s MapBase.SetMapTrap
   */
  setMapTrap(trapIndex: number, trapFileName: string, mapName?: string): void {
    const targetMap = mapName || this.currentMapName;
    if (!targetMap) return;

    // If setting for current map, remove from ignored list (re-activate)
    if (!mapName || mapName === this.currentMapName) {
      this.ignoredTrapIndices.delete(trapIndex);
    }

    // Get or create trap mapping for this map
    if (!this.mapTraps.has(targetMap)) {
      this.mapTraps.set(targetMap, new Map());
    }
    const traps = this.mapTraps.get(targetMap)!;

    if (!trapFileName) {
      // Remove trap
      traps.delete(trapIndex);
    } else {
      // Set/update trap
      traps.set(trapIndex, trapFileName);
    }
  }

  /**
   * Check and trigger trap at tile
   * Based on C#'s MapBase.RunTileTrapScript
   */
  private checkTrap(tile: Vector2): void {
    if (!this.mapData) return;

    // Don't run traps if a script is already running or waiting for input
    if (this.scriptExecutor.isRunning() || this.scriptExecutor.isWaitingForInput()) return;

    const tileIndex = tile.x + tile.y * this.mapData.mapColumnCounts;
    const tileInfo = this.mapData.tileInfos[tileIndex];

    if (tileInfo && tileInfo.trapIndex > 0) {
      const trapIndex = tileInfo.trapIndex;

      // Get trap script file name (handles ignored traps and custom mappings)
      const trapScriptName = this.getTrapScriptFileName(trapIndex);
      if (!trapScriptName) return;

      // Add to ignored list so it won't trigger again (until re-activated by SetTrap)
      this.ignoredTrapIndices.add(trapIndex);

      const basePath = this.getScriptBasePath();
      this.scriptExecutor.runScript(`${basePath}/${trapScriptName}`);
    }
  }

  /**
   * Update game state
   */
  update(deltaTime: number, input: InputState): void {
    if (this.isPaused) return;

    this.gameTime += deltaTime;

    // Update script executor
    this.scriptExecutor.update(deltaTime * 1000);

    // Update screen effects (fade in/out, etc.)
    this.screenEffects.update(deltaTime);

    // Update GUI
    this.guiManager.update(deltaTime);

    // Don't process game input if GUI is blocking
    if (this.guiManager.isBlockingInput()) {
      return;
    }

    // Handle player input
    if (input.clickedTile) {
      this.handleClick(
        input.mouseWorldX,
        input.mouseWorldY,
        input.isMouseDown ? "left" : "right"
      );
    }

    // Handle keyboard movement
    this.playerController.handleInput(input, 0, 0);

    // Update player
    this.playerController.update(deltaTime);

    // Check for trap at player's position
    const playerTile = this.playerController.getTilePosition();
    this.checkTrap(playerTile);

    // Update NPCs
    this.npcManager.update(deltaTime);

    // Update HUD
    const player = this.playerController.getPlayer();
    this.guiManager.updateHud(
      player.config.stats.life,
      player.config.stats.lifeMax,
      player.config.stats.mana,
      player.config.stats.manaMax,
      player.config.stats.thew,
      player.config.stats.thewMax
    );
  }

  // ============= Getters =============

  getPlayerController(): PlayerController {
    return this.playerController;
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

  /**
   * Set event ID (for script conditions)
   */
  setEventId(id: number): void {
    this.eventId = id;
    this.variables.Event = id;
  }

  /**
   * Get event ID
   */
  getEventId(): number {
    return this.eventId;
  }

  /**
   * Add demo NPCs for testing
   */
  async addDemoNpcs(): Promise<void> {
    // Add some NPCs for testing
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

  /**
   * Draw screen effects (call after rendering scene)
   */
  drawScreenEffects(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.screenEffects.drawFade(ctx, width, height);
    this.screenEffects.drawFlash(ctx, width, height);
  }

  /**
   * Check if currently fading (for blocking input during transitions)
   */
  isFading(): boolean {
    return this.screenEffects.isFading();
  }

  /**
   * Get level file
   */
  getLevelFile(): string {
    return this.levelFile;
  }
}
