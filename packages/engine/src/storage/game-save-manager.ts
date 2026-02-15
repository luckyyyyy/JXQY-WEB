/**
 * Loader - 游戏加载器
 *
 * ================== 职责边界 ==================
 *
 * Loader 负责「游戏初始化和存档」：
 * 1. newGame() - 开始新游戏，运行 NewGame.txt 脚本
 * 2. loadGame(index) - 读取存档（从文件或 JSON），加载地图/NPC/物品/武功/玩家等
 * 3. loadGameFromJSON(data) - 从 JSON 数据加载存档
 * 4. collectSaveData() - 收集当前游戏状态用于云端保存
 *
 * 参考实现：
 * - JxqyHD/Engine/Storage/Loader.cs
 * - JxqyHD/Engine/Storage/Saver.cs
 * - JxqyHD/Engine/Storage/StorageBase.cs
 *
 * Loader 不负责：
 * - 游戏逻辑更新（由 GameManager 处理）
 * - 渲染和游戏循环（由 GameEngine 处理）
 *
 * ================================================
 */

import type { Player as PlayerType } from "@miu2d/types";
import type { AudioManager } from "../audio";
import { logger } from "../core/logger";
import { getGameConfig, getPlayersData } from "../data/game-data-api";
import type { GuiManager } from "../gui/gui-manager";
import type { MemoListManager } from "../gui/memo-list-manager";
import type { MapBase } from "../map/map-base";
import type { NpcManager } from "../npc";
import type { ObjManager } from "../obj";
import type { Player } from "../player/player";
import type { ScreenEffects } from "../renderer/screen-effects";
import type { ScriptExecutor } from "../script/executor";
import { CharacterMemoryStore } from "./character-memory-store";
import { CharacterMemoryManager } from "./loader-character-memory";
import {
  collectTrapGroups,
  collectTrapSnapshot,
  loadGoodsFromJSON,
  loadMagicsFromJSON,
  loadNpcsFromJSON,
  loadObjsFromJSON,
  loadPlayerFromJSON,
  loadTrapsFromSave,
  serializeGroups,
} from "./loader-data-helpers";
import { SaveDataCollector } from "./save-data-collector";
import {
  formatSaveTime,
  type GoodsItemData,
  type MagicItemData,
  SAVE_VERSION,
  type SaveData,
} from "./save-types";

/**
 * 加载进度回调
 */
export type LoadProgressCallback = (progress: number, text: string) => void;

/**
 * Dependencies for Loader
 */
export interface LoaderDependencies {
  player: Player;
  npcManager: NpcManager;
  objManager: ObjManager;
  audioManager: AudioManager;
  screenEffects: ScreenEffects;
  memoListManager: MemoListManager;
  guiManager: GuiManager;
  map: MapBase;
  getScriptExecutor: () => ScriptExecutor;
  loadMap: (mapPath: string) => Promise<void>;
  clearScriptCache: () => void;
  clearVariables: () => void;
  /** 清理精灵/ASF/武功等资源缓存（新游戏/读档时调用，释放 JS 堆和 GPU 纹理） */
  clearResourceCaches: () => void;
  resetEventId: () => void;
  resetGameTime: () => void;
  loadPlayerSprites: (npcIni: string) => Promise<void>;
  /** 设置地图 MPC/MSF 加载进度回调（由 Loader 控制范围映射） */
  setMapProgressCallback: (callback: ((progress: number, text: string) => void) | null) => void;
  // 用于存档
  getVariables: () => Record<string, number>;
  setVariables: (vars: Record<string, number>) => void;
  getCurrentMapName: () => string;
  // 进度回调（可选，用于报告加载进度）
  onProgress?: LoadProgressCallback;
  // 加载完成回调（可选，用于通知核心加载完成）
  onLoadComplete?: () => void;
  // 立即将摄像机居中到玩家位置（用于加载存档后避免摄像机飞过去）
  centerCameraOnPlayer: () => void;

  // === 游戏选项和计时器 (用于存档) ===
  // 地图时间
  getMapTime: () => number;
  setMapTime: (time: number) => void;
  // 存档/掉落开关
  isSaveEnabled: () => boolean;
  setSaveEnabled: (enabled: boolean) => void;
  isDropEnabled: () => boolean;
  setDropEnabled: (enabled: boolean) => void;
  // 天气
  getWeatherState: () => { isSnowing: boolean; isRaining: boolean };
  setWeatherState: (state: { snowShow: boolean; rainFile: string }) => void;
  // 计时器
  getTimerState: () => {
    isOn: boolean;
    totalSecond: number;
    isHidden: boolean;
    isScriptSet: boolean;
    timerScript: string;
    triggerTime: number;
  };
  setTimerState: (state: {
    isOn: boolean;
    totalSecond: number;
    isHidden: boolean;
    isScriptSet: boolean;
    timerScript: string;
    triggerTime: number;
  }) => void;

  // === 新增: 脚本显示地图坐标、水波效果、并行脚本 ===
  // 脚本显示地图坐标
  isScriptShowMapPos: () => boolean;
  setScriptShowMapPos: (show: boolean) => void;
  // 水波效果
  isWaterEffectEnabled: () => boolean;
  setWaterEffectEnabled: (enabled: boolean) => void;
  // 并行脚本 (通过 ScriptExecutor 获取/设置)
  getParallelScripts: () => Array<{ filePath: string; waitMilliseconds: number }>;
  loadParallelScripts: (scripts: Array<{ filePath: string; waitMilliseconds: number }>) => void;
}

/**
 * Game Loader - 游戏初始化和存档管理
 */
export class Loader {
  private deps: LoaderDependencies;

  /**
   * 多角色内存存储
   * key: playerIndex (0-4)
   * 当加载存档或开始新游戏时清空
   */
  private readonly characterMemoryStore = new CharacterMemoryStore();
  private readonly characterMemoryManager: CharacterMemoryManager;

  constructor(deps: LoaderDependencies) {
    this.deps = deps;
    this.characterMemoryManager = new CharacterMemoryManager(
      { player: deps.player, memoListManager: deps.memoListManager },
      this.characterMemoryStore
    );
  }

  /**
   * 报告加载进度（如果有进度回调）
   */
  private reportProgress(progress: number, text: string): void {
    this.deps.onProgress?.(progress, text);
  }

  /**
   * 设置进度回调（用于运行时更新）
   */
  setProgressCallback(callback: LoadProgressCallback | undefined): void {
    this.deps.onProgress = callback;
  }

  /**
   * 设置加载完成回调（用于通知核心加载完成）
   */
  setLoadCompleteCallback(callback: (() => void) | undefined): void {
    this.deps.onLoadComplete = callback;
  }

  /**
   * 开始新游戏
   *
   * 运行 NewGame.txt 脚本，该脚本会：
   * 1. StopMusic() - 停止当前音乐
   * 2. LoadGame(0) - 加载初始存档
   * 3. PlayMovie("open.avi") - 播放开场动画
   * 4. RunScript("Begin.txt") - 运行开始脚本
   */
  async newGame(): Promise<void> {
    logger.log("[Loader] Starting new game...");

    const { screenEffects, getScriptExecutor, clearVariables, resetEventId, resetGameTime } =
      this.deps;

    // 重置基本状态
    clearVariables();
    resetEventId();
    resetGameTime();

    // 清空多角色内存存储（新游戏从资源文件加载初始数据）
    this.characterMemoryStore.clear();

    // 清空分组存储（新游戏无历史 SaveNpc/SaveObj 数据）
    this.deps.npcManager.clearNpcGroups();
    this.deps.objManager.clearObjGroups();

    // 以黑屏开始（用于淡入淡出特效）
    screenEffects.setFadeTransparency(1);

    // 运行 NewGame 脚本（从 /api/config 获取内联脚本内容）
    const scriptExecutor = getScriptExecutor();
    const config = getGameConfig();
    const newGameScriptContent = config?.newGameScript;
    if (newGameScriptContent) {
      logger.info(`[Loader] Running newGame script from API config`);
      await scriptExecutor.runScriptContent(newGameScriptContent, "NewGame.txt");
    } else {
      logger.error(`[Loader] No newGameScript found in API config`);
    }

    logger.log("[Loader] New game started");
  }

  /**
   * 加载初始存档（由 NewGame.txt 脚本调用 LoadGame(0)）
   *
   * 加载流程：
   * 1. 从 /api/config 获取初始地图和 BGM
   * 2. 加载地图和物体
   * 3. 从 /api/data 加载武功、物品、玩家数据
   *
   * 进度范围 0-100%（由 game-engine 映射到全局进度）
   */
  async loadGame(index: number): Promise<void> {
    // index 0 = 初始存档（由 NewGame.txt 脚本调用 LoadGame(0)）
    // 用户存档通过 loadGameFromJSON（云存档）加载，不再走此路径

    const { player, npcManager, objManager, audioManager, memoListManager, loadMap } = this.deps;

    // 从 Player 获取 GoodsListManager 和 PlayerMagicInventory
    const goodsListManager = player.getGoodsListManager();
    const magicInventory = player.getPlayerMagicInventory();

    const loadStart = performance.now();
    const timings: Array<[string, number]> = [];
    const time = (label: string, start: number) => {
      timings.push([label, performance.now() - start]);
    };

    logger.log(`[Loader] ────── loadGame(${index}) ──────`);

    try {
      // ── Phase 1: 读取配置 ──
      this.reportProgress(0, "读取游戏配置...");
      const tConfig = performance.now();
      const config = getGameConfig();
      const initialMap = config?.initialMap || "map002";
      const initialNpc = config?.initialNpc || "";
      const initialObj = config?.initialObj || "";
      const initialBgm = config?.initialBgm || "";

      // 玩家角色索引 - 默认 0
      let chrIndex = 0;
      let playerKey = `Player${chrIndex}.ini`;
      const configPlayerKey = config?.playerKey;
      if (configPlayerKey) {
        playerKey = configPlayerKey;
        const match = configPlayerKey.match(/Player(\d+)\.ini/i);
        if (match) {
          chrIndex = parseInt(match[1], 10);
          player.setPlayerIndex(chrIndex);
        }
      }
      time("Config", tConfig);

      // ── Phase 2: 加载地图 (2% → 65%) ──
      // 地图有真实 MPC 子进度，给最大范围
      if (initialMap) {
        this.reportProgress(2, "加载地图...");
        this.deps.setMapProgressCallback((mapProgress, _text) => {
          this.reportProgress(Math.round(2 + mapProgress * 63), "加载地图资源...");
        });
        const tMap = performance.now();
        await loadMap(initialMap);
        this.deps.setMapProgressCallback(null);
        time("Map", tMap);
      }

      // 背景音乐（非阻塞）
      if (initialBgm) {
        audioManager.playMusic(initialBgm);
      }

      // ── Phase 3: 预设 NpcIniIndex（必须在武功加载前完成） ──
      this.reportProgress(66, "初始化角色...");
      const apiPlayerData = this.findApiPlayer(playerKey);
      if (apiPlayerData?.npcIni) {
        await player.setNpcIni(apiPlayerData.npcIni);
      }

      // ── Phase 4: 并行加载所有资源模块 ──
      this.reportProgress(68, "加载游戏数据...");

      const parallelTasks: Array<Promise<void>> = [];

      // Task A: 武功 + 物品 + 备忘
      parallelTasks.push(
        (async () => {
          const t = performance.now();
          magicInventory.stopReplace();
          magicInventory.clearReplaceList();
          magicInventory.initializeMagicExp();
          if (apiPlayerData?.initialMagics && apiPlayerData.initialMagics.length > 0) {
            const magicItems: MagicItemData[] = apiPlayerData.initialMagics.map((m, i) => ({
              fileName: m.iniFile,
              level: m.level,
              exp: m.exp,
              index: i + 1,
            }));
            await loadMagicsFromJSON(magicItems, 0, magicInventory);
          }
          if (apiPlayerData?.initialGoods && apiPlayerData.initialGoods.length > 0) {
            const goodsItems: GoodsItemData[] = apiPlayerData.initialGoods.map((g) => ({
              fileName: g.iniFile,
              count: g.number,
            }));
            loadGoodsFromJSON(goodsItems, [], goodsListManager);
          }
          memoListManager.renewList();
          time("Magics+Good", t);
        })()
      );

      // Task B: 玩家数据 + 精灵
      parallelTasks.push(
        (async () => {
          const t = performance.now();
          if (apiPlayerData) {
            await player.loadFromApiData(apiPlayerData);
          }
          const playerNpcIni = player.npcIni;
          await this.deps.loadPlayerSprites(playerNpcIni);
          time("Player+Sprites", t);
        })()
      );

      // Task C: NPC 文件
      if (initialNpc) {
        parallelTasks.push(
          (async () => {
            const t = performance.now();
            await npcManager.loadNpcFile(initialNpc);
            time("NPCs", t);
          })()
        );
      }

      // Task D: Obj 文件
      if (initialObj) {
        parallelTasks.push(
          (async () => {
            const t = performance.now();
            await objManager.load(initialObj);
            time("OBJs", t);
          })()
        );
      }

      await Promise.all(parallelTasks);

      // ── Phase 5: 收尾 ──
      this.reportProgress(90, "应用装备效果...");
      const tEffects = performance.now();
      goodsListManager.applyEquipSpecialEffectFromList();
      player.loadMagicEffect();
      time("Effects", tEffects);

      this.reportProgress(95, "初始化视角...");
      this.deps.centerCameraOnPlayer();

      this.deps.onLoadComplete?.();
      this.reportProgress(100, "加载完成");

      // ── 打印耗时汇总 ──
      const total = performance.now() - loadStart;
      const maxLabelLen = Math.max(...timings.map(([l]) => l.length));
      for (const [label, ms] of timings) {
        logger.info(`[Loader] ⏱ ${label.padEnd(maxLabelLen)}  ${ms.toFixed(0).padStart(6)}ms`);
      }
      logger.info(`[Loader] ────── Total: ${total.toFixed(0)}ms ──────`);

      // Debug: 打印障碍物体
      objManager.debugPrintObstacleObjs();
    } catch (error) {
      logger.error(`[Loader] Error loading game save:`, error);
    }
  }

  /**
   * 从 API 数据中查找指定 key 的玩家数据
   */
  private findApiPlayer(playerKey: string): PlayerType | null {
    const players = getPlayersData();
    if (!players) return null;
    return players.find((p) => p.key === playerKey) ?? null;
  }

  // ============= JSON 存档系统 =============

  // ============= 多主角切换 =============

  /**
   * 保存当前玩家数据到内存
   * 在切换角色前调用
   */
  saveCurrentPlayerToMemory(): void {
    this.characterMemoryManager.saveCurrentPlayer();
  }

  /**
   * 从内存加载玩家数据
   * 在切换角色后调用
   */
  async loadPlayerDataFromMemory(): Promise<void> {
    await this.characterMemoryManager.loadPlayerData();
  }

  /**
   * 从 JSON 数据加载存档
   *
   * 进度范围 0-100%（由 game-engine 映射到全局进度）
   *
   * @param data 存档数据
   */
  async loadGameFromJSON(data: SaveData): Promise<void> {
    const loadStart = performance.now();
    const timings: Array<[string, number]> = [];
    const time = (label: string, start: number) => {
      timings.push([label, performance.now() - start]);
    };

    logger.log(`[Loader] ────── loadGameFromJSON ──────`);

    const {
      player,
      npcManager,
      objManager,
      audioManager,
      screenEffects,
      memoListManager,
      guiManager,
      loadMap,
      clearScriptCache,
      setVariables,
      getScriptExecutor,
    } = this.deps;

    // 从 Player 获取 GoodsListManager 和 PlayerMagicInventory
    const goodsListManager = player.getGoodsListManager();
    const magicInventory = player.getPlayerMagicInventory();

    try {
      // ── Phase 1: 重置状态（同步，极快）──
      this.reportProgress(0, "重置游戏状态...");
      const tReset = performance.now();
      screenEffects.setFadeTransparency(1);
      screenEffects.resetColors();
      const scriptExecutor = getScriptExecutor();
      scriptExecutor.stopAllScripts();
      guiManager.resetAllUI();
      clearScriptCache();
      this.deps.clearVariables();
      this.deps.clearResourceCaches();
      npcManager.clearAllNpc();
      objManager.clearAll();
      audioManager.stopMusic();
      this.characterMemoryStore.clear();
      npcManager.clearNpcGroups();
      objManager.clearObjGroups();
      time("Reset", tReset);

      // ── Phase 2: 加载地图 (2% → 65%) ──
      // 地图有真实 MPC 子进度，给最大范围
      const state = data.state;
      if (state.map) {
        this.reportProgress(2, "加载地图...");
        this.deps.setMapProgressCallback((mapProgress, _text) => {
          this.reportProgress(Math.round(2 + mapProgress * 63), "加载地图资源...");
        });
        const tMap = performance.now();
        await loadMap(state.map);
        this.deps.setMapProgressCallback(null);
        time("Map", tMap);
      }

      // 设置 NPC / Obj 的 fileName
      if (state.npc) npcManager.setFileName(state.npc);
      if (state.obj) objManager.setFileName(state.obj);

      // 背景音乐（非阻塞）
      if (state.bgm) audioManager.playMusic(state.bgm);

      // 设置角色索引 + 恢复变量
      const chrIndex = state.chr ?? 0;
      player.setPlayerIndex(chrIndex);
      if (data.variables && setVariables) {
        setVariables(data.variables);
      }

      // ── Phase 3: 预设 NpcIniIndex ──
      this.reportProgress(66, "初始化角色...");
      if (data.player?.npcIni) {
        await player.setNpcIni(data.player.npcIni);
      }

      // ── Phase 4: 并行加载所有独立模块 ──
      this.reportProgress(68, "加载游戏数据...");

      const parallelTasks: Array<Promise<void>> = [];

      // Task A: 武功 + 替换武功 + 物品 + 备忘录
      parallelTasks.push(
        (async () => {
          const t = performance.now();
          magicInventory.stopReplace();
          magicInventory.clearReplaceList();
          await loadMagicsFromJSON(data.magics, data.xiuLianIndex, magicInventory);
          if (data.replaceMagicLists) {
            await magicInventory.deserializeReplaceLists(data.replaceMagicLists);
          }
          loadGoodsFromJSON(data.goods, data.equips, goodsListManager);
          if (data.memo) {
            memoListManager.renewList();
            memoListManager.bulkLoadItems(data.memo.items);
          }
          time("Magics+Good", t);
        })()
      );

      // Task B: 玩家数据 + 精灵
      parallelTasks.push(
        (async () => {
          const t = performance.now();
          await loadPlayerFromJSON(data.player, player);
          player.setLoadingState();
          const playerNpcIni = player.npcIni;
          await this.deps.loadPlayerSprites(playerNpcIni);
          player.state = data.player.state ?? 0;
          time("Player+Sprites", t);
        })()
      );

      // Task C: NPC + 伙伴
      const allNpcs = [...(data.snapshot.npc ?? []), ...(data.snapshot.partner ?? [])];
      if (allNpcs.length > 0) {
        parallelTasks.push(
          (async () => {
            const t = performance.now();
            npcManager.clearAllNpc();
            if (state.npc) npcManager.setFileName(state.npc);
            await loadNpcsFromJSON(allNpcs, npcManager);
            time(`NPCs(${allNpcs.length})`, t);
          })()
        );
      }

      // Task D: Obj
      if (data.snapshot.obj?.length > 0) {
        parallelTasks.push(
          (async () => {
            const t = performance.now();
            objManager.clearAll();
            if (state.obj) objManager.setFileName(state.obj);
            await loadObjsFromJSON(data.snapshot.obj, objManager);
            time(`OBJs(${data.snapshot.obj.length})`, t);
          })()
        );
      }

      // Task E: 陷阱恢复
      parallelTasks.push(
        (async () => {
          if (data.groups?.trap) {
            loadTrapsFromSave(data.snapshot.trap, data.groups.trap, this.deps.map);
          } else if (data.snapshot?.trap) {
            loadTrapsFromSave(data.snapshot.trap, undefined, this.deps.map);
          }
        })()
      );

      await Promise.all(parallelTasks);

      // ── Phase 5: 收尾 ──
      this.reportProgress(90, "应用装备效果...");
      const tEffects = performance.now();

      // 恢复分组存储
      if (data.groups?.npc) npcManager.setNpcGroups(data.groups.npc);
      if (data.groups?.obj) objManager.setObjGroups(data.groups.obj);

      // 应用装备特效 + 武功效果
      goodsListManager.applyEquipSpecialEffectFromList();
      player.loadMagicEffect();

      // 恢复选项设置
      if (data.option) {
        if (this.deps.setMapTime && data.option.mapTime !== undefined) {
          this.deps.setMapTime(data.option.mapTime);
        }
        if (this.deps.setSaveEnabled) {
          this.deps.setSaveEnabled(!data.option.saveDisabled);
        }
        if (this.deps.setDropEnabled) {
          this.deps.setDropEnabled(!data.option.isDropGoodWhenDefeatEnemyDisabled);
        }
        if (this.deps.setWeatherState) {
          this.deps.setWeatherState({
            snowShow: data.option.snowShow,
            rainFile: data.option.rainFile,
          });
        }
        const hexToRgb = (hex: string) => {
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          return {
            r: Number.isNaN(r) ? 255 : r,
            g: Number.isNaN(g) ? 255 : g,
            b: Number.isNaN(b) ? 255 : b,
          };
        };
        if (data.option.mpcStyle && data.option.mpcStyle !== "FFFFFF") {
          const c = hexToRgb(data.option.mpcStyle);
          screenEffects.setMapColor(c.r, c.g, c.b);
        } else {
          screenEffects.setMapColor(255, 255, 255);
        }
        if (data.option.asfStyle && data.option.asfStyle !== "FFFFFF") {
          const c = hexToRgb(data.option.asfStyle);
          screenEffects.setSpriteColor(c.r, c.g, c.b);
        } else {
          screenEffects.setSpriteColor(255, 255, 255);
        }
      }

      // 恢复计时器状态
      if (data.timer?.isOn && this.deps.setTimerState) {
        this.deps.setTimerState({
          isOn: data.timer.isOn,
          totalSecond: data.timer.totalSecond,
          isHidden: !data.timer.isTimerWindowShow,
          isScriptSet: data.timer.isScriptSet,
          timerScript: data.timer.timerScript,
          triggerTime: data.timer.triggerTime,
        });
      }

      // 恢复脚本显示地图坐标开关
      if (data.state?.scriptShowMapPos !== undefined && this.deps.setScriptShowMapPos) {
        this.deps.setScriptShowMapPos(data.state.scriptShowMapPos);
      }

      // 恢复水波效果开关
      if (data.option?.water !== undefined && this.deps.setWaterEffectEnabled) {
        this.deps.setWaterEffectEnabled(data.option.water);
      }

      // 恢复并行脚本
      if (
        data.parallelScripts &&
        data.parallelScripts.length > 0 &&
        this.deps.loadParallelScripts
      ) {
        this.deps.loadParallelScripts(data.parallelScripts);
      }

      time("Effects+Options", tEffects);

      // ── Phase 6: 完成 ──
      this.reportProgress(95, "初始化视角...");
      this.deps.centerCameraOnPlayer();
      this.deps.onLoadComplete?.();

      // 恢复其他角色数据到内存
      if (data.otherCharacters) {
        this.characterMemoryStore.restoreFromSave(data.otherCharacters);
      }

      // 执行淡入效果
      screenEffects.fadeIn();

      this.reportProgress(100, "加载完成");

      // ── 打印耗时汇总 ──
      const total = performance.now() - loadStart;
      const maxLabelLen = Math.max(...timings.map(([l]) => l.length));
      for (const [label, ms] of timings) {
        logger.info(`[Loader] ⏱ ${label.padEnd(maxLabelLen)}  ${ms.toFixed(0).padStart(6)}ms`);
      }
      logger.info(`[Loader] ────── Total: ${total.toFixed(0)}ms ──────`);
    } catch (error) {
      logger.error(`[Loader] Error loading game from JSON:`, error);
      throw error;
    }
  }

  /**
   * 收集当前游戏状态用于保存
   */
  collectSaveData(): SaveData {
    const {
      player,
      npcManager,
      objManager,
      audioManager,
      screenEffects,
      memoListManager,
      getVariables,
      getCurrentMapName,
      getMapTime,
      isSaveEnabled,
      isDropEnabled,
      getWeatherState,
      getTimerState,
    } = this.deps;

    // 从 Player 获取 GoodsListManager 和 PlayerMagicInventory
    const goodsListManager = player.getGoodsListManager();
    const magicInventory = player.getPlayerMagicInventory();

    const mapName = getCurrentMapName();
    const variables = getVariables();
    const weatherState = getWeatherState();
    const timerState = getTimerState();

    // 获取绘制颜色 (mpcStyle = map draw color, asfStyle = sprite draw color)
    const mapColor = screenEffects.getMapTintColor();
    const spriteColor = screenEffects.getSpriteTintColor();
    // 转换为十六进制字符串（格式：RRGGBB）
    const colorToHex = (c: { r: number; g: number; b: number }) => {
      const r = c.r.toString(16).padStart(2, "0");
      const g = c.g.toString(16).padStart(2, "0");
      const b = c.b.toString(16).padStart(2, "0");
      return `${r}${g}${b}`.toUpperCase();
    };

    const saveData: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),

      // 游戏状态
      state: {
        map: mapName,
        npc: npcManager.getFileName() || "",
        obj: objManager.getFileName() || "",
        bgm: audioManager.getCurrentMusicFile() || "",
        chr: player.playerIndex, // Player 维护的 playerIndex
        time: formatSaveTime(),
        scriptShowMapPos: this.deps.isScriptShowMapPos(),
      },

      // 选项 - 参考Saver.cs [Option] section
      option: {
        mapTime: getMapTime(),
        snowShow: weatherState.isSnowing,
        rainFile: weatherState.isRaining ? "rain" : "", // 保存雨声文件名
        water: this.deps.isWaterEffectEnabled(),
        mpcStyle: colorToHex(mapColor),
        asfStyle: colorToHex(spriteColor),
        saveDisabled: !isSaveEnabled(),
        isDropGoodWhenDefeatEnemyDisabled: !isDropEnabled(),
      },

      // 计时器 - 参考Saver.cs [Timer] section
      timer: {
        isOn: timerState.isOn,
        totalSecond: timerState.totalSecond,
        isTimerWindowShow: !timerState.isHidden, // 保存的是 "是否显示"，TypeScript 内部存的是 "是否隐藏"
        isScriptSet: timerState.isScriptSet,
        timerScript: timerState.timerScript,
        triggerTime: timerState.triggerTime,
      },

      // 脚本变量
      variables: { ...variables },

      // 并行脚本
      parallelScripts: this.deps.getParallelScripts(),

      // 玩家数据
      player: SaveDataCollector.collectPlayerData(player),

      // 物品
      goods: SaveDataCollector.collectGoodsData(goodsListManager),
      equips: SaveDataCollector.collectEquipsData(goodsListManager),

      // 武功
      magics: SaveDataCollector.collectMagicsData(magicInventory),
      xiuLianIndex: magicInventory.getXiuLianIndex(),
      // 替换武功列表 (角色变身时的临时武功)
      // > PlayerMagicInventory.SaveReplaceList
      replaceMagicLists: magicInventory.serializeReplaceLists(),

      // 备忘录
      memo: {
        items: memoListManager.getItems(),
      },

      // 快照 - 存档瞬间各实体的当前状态
      snapshot: {
        npc: npcManager.collectSnapshot(false),
        partner: npcManager.collectSnapshot(true),
        obj: objManager.collectSnapshot(),
        trap: collectTrapSnapshot(this.deps.map),
      },

      // 分组 - 脚本按 key 缓存的中间数据
      groups: {
        npc: serializeGroups(npcManager.getNpcGroups()),
        obj: serializeGroups(objManager.getObjGroups()),
        trap: collectTrapGroups(this.deps.map),
      },

      // 多角色数据 (PlayerChange 切换过的角色)
      otherCharacters: this.characterMemoryStore.collectForSave(),
    };

    return saveData;
  }
}
