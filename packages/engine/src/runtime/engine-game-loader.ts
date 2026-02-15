/**
 * EngineGameLoader — 游戏加载生命周期管理
 *
 * 从 GameEngine 提取的加载/存档/进度逻辑。
 * 管理 newGame / loadGame / loadGameFromJSON 等工作流，
 * 以及 loadProgress / loadingText 等加载状态。
 */

import type { AudioManager } from "../audio";
import type { TypedEventEmitter } from "../core/event-emitter";
import { type GameEventMap, GameEvents } from "../core/game-events";
import { logger } from "../core/logger";
import type { SaveData } from "../storage/save-types";
import type { GameEngineState } from "./game-engine";
import type { GameManager } from "./game-manager";

/** EngineGameLoader 所需的外部依赖 */
export interface EngineGameLoaderDeps {
  getState: () => GameEngineState;
  setState: (s: GameEngineState) => void;
  getGameManager: () => GameManager;
  events: TypedEventEmitter<GameEventMap>;
  audio: AudioManager;
}

/**
 * 游戏加载生命周期管理器
 */
export class EngineGameLoader {
  private hasEmittedReady = false;
  loadProgress = 0;
  loadingText = "";
  /** 地图加载进度回调（Loader 控制 MPC/MSF 进度映射） */
  mapLoadProgressCallback: ((progress: number, text: string) => void) | null = null;

  constructor(private deps: EngineGameLoaderDeps) {}

  /** 重置状态（dispose 时调用） */
  reset(): void {
    this.hasEmittedReady = false;
    this.loadProgress = 0;
    this.loadingText = "";
    this.mapLoadProgressCallback = null;
  }

  emitLoadProgress(progress: number, text: string): void {
    this.loadProgress = progress;
    this.loadingText = text;
    this.deps.events.emit(GameEvents.GAME_LOAD_PROGRESS, { progress, text });
  }

  emitInitialized(success: boolean): void {
    if (success) {
      if (this.hasEmittedReady) return;
      this.hasEmittedReady = true;
    }
    this.deps.events.emit(GameEvents.GAME_INITIALIZED, { success });
  }

  handleLoadComplete(): void {
    if (this.deps.getState() !== "loading") return;
    this.deps.setState("running");
    this.emitInitialized(true);
  }

  /** Loader 进度 0-100% → 全局 10-98% 的映射 */
  private setupProgressMapping(): void {
    this.deps.getGameManager().setLoadProgressCallback((progress, text) => {
      const mapped = Math.round(10 + progress * 0.88);
      this.emitLoadProgress(mapped, text);
    });
  }

  private clearProgressMapping(): void {
    this.deps.getGameManager().setLoadProgressCallback(undefined);
  }

  private ensureInitialized(): void {
    if (this.deps.getState() === "uninitialized") {
      throw new Error("Engine not initialized. Call initialize() first.");
    }
  }

  /**
   * 开始新游戏
   * 运行 NewGame.txt 脚本，该脚本会调用 LoadGame(0) 加载初始存档。
   */
  async newGame(): Promise<void> {
    this.ensureInitialized();
    this.deps.setState("loading");
    this.emitLoadProgress(10, "开始新游戏...");
    this.setupProgressMapping();

    try {
      await this.deps.getGameManager().newGame();
      this.deps.setState("running");
      this.emitLoadProgress(100, "游戏开始");
      this.emitInitialized(true);
      logger.log("[GameEngine] New game started");
    } catch (error) {
      logger.error("[GameEngine] Failed to start new game:", error);
      this.emitInitialized(false);
      throw error;
    } finally {
      this.clearProgressMapping();
    }
  }

  /** 读取存档 @param index 存档索引 (1-7)，0 表示初始存档 */
  async loadGame(index: number): Promise<void> {
    this.ensureInitialized();
    this.deps.setState("loading");
    this.emitLoadProgress(10, `读取存档 ${index}...`);
    this.setupProgressMapping();

    try {
      await this.deps.getGameManager().loadGameSave(index);
      this.deps.setState("running");
      this.emitLoadProgress(100, "存档加载完成");
      logger.log(`[GameEngine] Game loaded from save ${index}`);
    } catch (error) {
      logger.error(`[GameEngine] Failed to load game ${index}:`, error);
      throw error;
    } finally {
      this.clearProgressMapping();
    }
  }

  /** 从 JSON 数据加载存档 */
  async loadGameFromJSON(data: SaveData): Promise<void> {
    this.ensureInitialized();
    this.deps.setState("loading");
    this.emitLoadProgress(10, "加载存档...");
    this.setupProgressMapping();

    try {
      await this.deps.getGameManager().loadGameFromJSON(data);
      this.deps.setState("running");
      this.emitLoadProgress(100, "加载完成");
      this.emitInitialized(true);
      logger.log("[GameEngine] Game loaded from JSON save");
    } catch (error) {
      logger.error("[GameEngine] Failed to load game from JSON:", error);
      this.emitInitialized(false);
      throw error;
    } finally {
      this.clearProgressMapping();
    }
  }

  /** 收集当前游戏状态用于保存 */
  collectSaveData(): SaveData {
    return this.deps.getGameManager().collectSaveData();
  }

  /** 从 localStorage 加载音频设置并应用到 AudioManager */
  loadAudioSettingsFromStorage(): void {
    try {
      const musicVolume = localStorage.getItem("jxqy_music_volume");
      const soundVolume = localStorage.getItem("jxqy_sound_volume");
      const ambientVolume = localStorage.getItem("jxqy_ambient_volume");

      if (musicVolume !== null) this.deps.audio.setMusicVolume(parseFloat(musicVolume));
      if (soundVolume !== null) this.deps.audio.setSoundVolume(parseFloat(soundVolume));
      if (ambientVolume !== null) this.deps.audio.setAmbientVolume(parseFloat(ambientVolume));

      logger.log("[GameEngine] Audio settings loaded from localStorage");
    } catch (error) {
      logger.warn("[GameEngine] Failed to load audio settings:", error);
    }
  }
}
