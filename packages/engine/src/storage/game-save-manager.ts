/**
 * Loader - 游戏加载器
 *
 * ================== 职责边界 ==================
 *
 * Loader 负责「游戏初始化和存档」：
 * 1. newGame() - 开始新游戏，运行 NewGame.txt 脚本
 * 2. loadInitialGame(index) - 加载初始存档（由 NewGame.txt 脚本的 LoadGame(0) 触发）
 * 3. loadGameFromJSON(data) - 从 JSON 数据加载存档
 * 4. collectSaveData() - 收集当前游戏状态用于云端保存
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
import { CharacterProfileStore } from "./character-profile-store";
import { CharacterProfileLoader } from "./loader-character-profile";
import {
  collectTrapGroups,
  collectTrapSnapshot,
  loadGoodsContainer,
  loadGoodsFromJSON,
  loadMagicContainer,
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

  // === 全局难度（玩家与伙伴共享的等级表） ===
  getDifficulty: () => import("../character/level/difficulty").Difficulty;
  setDifficulty: (
    d: import("../character/level/difficulty").Difficulty,
    opts?: { recalc?: boolean }
  ) => Promise<void>;
}

/**
 * Game Loader - 游戏初始化和存档管理
 */
export class Loader {
  private deps: LoaderDependencies;

  /**
   * 统一角色档案存储（主角 + 伙伴）
   * key: "idx:N" (API 注册角色) | "name:xxx" (临时伙伴)
   * 当加载存档或开始新游戏时清空
   */
  private readonly characterProfileStore = new CharacterProfileStore();
  private readonly characterProfileLoader: CharacterProfileLoader;

  constructor(deps: LoaderDependencies) {
    this.deps = deps;
    this.characterProfileLoader = new CharacterProfileLoader(
      { player: deps.player, memoListManager: deps.memoListManager },
      this.characterProfileStore
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

    // 清空多角色档案存储（新游戏从资源文件加载初始数据）
    this.characterProfileStore.clear();

    // 清空分组存储（新游戏无历史 SaveNpc/SaveObj 数据）
    this.deps.npcManager.clearNpcGroups();
    this.deps.objManager.clearObjGroups();

    // 以黑屏开始（用于淡入淡出特效）
    screenEffects.setFadeTransparency(1);

    // 新游戏默认简单难度（玩家+伙伴共享等级表）
    // 不重算属性：此时还未加载玩家配置
    await this.deps.setDifficulty("easy", { recalc: false });

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

  // ============= 私有共享工具 =============

  /**
   * 从 API 数据中查找指定 key 的玩家数据
   */
  private findApiPlayer(playerKey: string): PlayerType | null {
    const players = getPlayersData();
    if (!players) return null;
    return players.find((p) => p.key === playerKey) ?? null;
  }

  /**
   * 地图加载阶段（Phase 2）：加载地图并映射进度 2% → 65%
   * 两个加载路径共享相同的进度逻辑
   */
  private async loadMapPhase(mapPath: string, timings: Array<[string, number]>): Promise<void> {
    this.reportProgress(2, "加载地图...");
    this.deps.setMapProgressCallback((mapProgress, _text) => {
      this.reportProgress(Math.round(2 + mapProgress * 63), "加载地图资源...");
    });
    const tMap = performance.now();
    await this.deps.loadMap(mapPath);
    this.deps.setMapProgressCallback(null);
    timings.push(["Map", performance.now() - tMap]);
  }

  /**
   * 收尾阶段（Phase 5 通用部分）：应用装备效果、武功效果、重算基础属性
   * 两个加载路径共享，不含存档专用的 options/timer/parallelScripts 恢复
   */
  private finalizeLoad(
    timings: Array<[string, number]>,
    effectsStart: number,
    afterEffects?: () => void
  ): void {
    const player = this.deps.player;
    const goodsListManager = player.getGoodsListManager();

    goodsListManager.applyEquipSpecialEffectFromList();
    player.loadMagicEffect();
    // 从等级配置重新计算基础属性，修正存档中因历史 bug 累积的错误值
    player.recalculateBaseStats();
    // 伙伴 NPC 与主角共用一套属性计算：等级难度表 + 武功 + 装备
    this.deps.npcManager.forEachPartner((partner) => {
      partner.recalculateBaseStats();
    });

    const timingLabel = afterEffects !== undefined ? "Effects+Options" : "Effects";
    afterEffects?.();
    timings.push([timingLabel, performance.now() - effectsStart]);
  }

  // ============= 公开加载方法 =============

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
  async loadInitialGame(index: number): Promise<void> {
    // index 0 = 初始存档（由 NewGame.txt 脚本调用 LoadGame(0)）
    // 用户存档通过 loadGameFromJSON（云存档）加载，不再走此路径

    const { player, npcManager, objManager, audioManager, memoListManager } = this.deps;
    const goodsListManager = player.getGoodsListManager();
    const magicInventory = player.getPlayerMagicInventory();

    const loadStart = performance.now();
    const timings: Array<[string, number]> = [];
    const time = (label: string, start: number) => timings.push([label, performance.now() - start]);

    logger.log(`[Loader] ────── loadInitialGame(${index}) ──────`);

    try {
      this.deps.map.resetTrapState();
      // 重置地图时间和亮度，防止前一场景的夜间/暗化设置残留
      this.deps.screenEffects.resetColors();
      this.deps.setMapTime(0);
      this.deps.screenEffects.setMainLum(32);

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
      if (initialMap) {
        await this.loadMapPhase(initialMap, timings);
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
          if (apiPlayerData?.initialMagics && apiPlayerData.initialMagics.length > 0) {
            const magicItems: MagicItemData[] = apiPlayerData.initialMagics.map((m, i) => ({
              fileName: m.iniFile,
              level: m.level,
              exp: m.exp,
              index: m.index ?? i + 1,
            }));
            await loadMagicsFromJSON(magicItems, 0, magicInventory);
          }
          if (apiPlayerData?.initialGoods && apiPlayerData.initialGoods.length > 0) {
            const goodsItems: GoodsItemData[] = apiPlayerData.initialGoods.map((g) => ({
              fileName: g.iniFile,
              count: g.number,
              index: g.index,
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
      this.finalizeLoad(timings, tEffects);

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

  // ============= JSON 存档系统 =============

  // ============= 多主角切换 =============

  /**
   * 将当前主角数据写入档案存储
   * 在切换角色前调用
   */
  flushCurrentPlayerToProfile(): void {
    this.characterProfileLoader.flushPlayerToProfile();
  }

  /**
   * 从档案存储恢复主角数据
   * 在切换角色后调用
   */
  async loadProfileToPlayer(): Promise<void> {
    await this.characterProfileLoader.loadProfileToPlayer();
  }

  /** 将伙伴写入档案存储（暴露给 ScriptCommandContext 注入） */
  flushNpcToProfile(npc: import("../npc/npc").Npc): void {
    this.characterProfileLoader.flushNpcToProfile(npc);
  }

  /** 从档案存储恢复伙伴（暴露给 ScriptCommandContext 注入） */
  async loadProfileToNpc(npc: import("../npc/npc").Npc): Promise<void> {
    await this.characterProfileLoader.loadProfileToNpc(npc);
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
    const time = (label: string, start: number) => timings.push([label, performance.now() - start]);

    logger.log(`[Loader] ────── loadGameFromJSON ──────`);

    const {
      player,
      npcManager,
      objManager,
      audioManager,
      screenEffects,
      memoListManager,
      guiManager,
      clearScriptCache,
      setVariables,
      getScriptExecutor,
    } = this.deps;

    const goodsListManager = player.getGoodsListManager();
    const magicInventory = player.getPlayerMagicInventory();

    try {
      // ── Phase 1: 重置状态（同步，极快）──
      this.reportProgress(0, "重置游戏状态...");
      const tReset = performance.now();
      screenEffects.setFadeTransparency(1);
      screenEffects.resetColors();
      // 显式重置地图时间和亮度（resetColors 只重置 screenEffects 内部状态，
      // 还需通过 deps 同步重置 GameManager 侧的 mapTime 字段）
      this.deps.setMapTime(0);
      screenEffects.setMainLum(32);
      const scriptExecutor = getScriptExecutor();
      scriptExecutor.stopAllScripts();
      guiManager.resetAllUI();
      clearScriptCache();
      this.deps.clearVariables();
      this.deps.clearResourceCaches();
      npcManager.clearAllNpc();
      objManager.clearAll();
      audioManager.stopMusic();
      this.characterProfileStore.clear();
      npcManager.clearNpcGroups();
      objManager.clearObjGroups();
      this.deps.map.resetTrapState();
      time("Reset", tReset);

      // ── Phase 2: 加载地图 (2% → 65%) ──
      const state = data.state;
      if (state.map) {
        await this.loadMapPhase(state.map, timings);
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

      // ── Phase 3.5: 应用全局难度（玩家+伙伴共享等级表） ──
      // 必须在 player/NPC 数据 load 之前，确保 levelManager.config 与
      // 后续 recalculateBaseStats 看到的是相同的等级表。
      const difficulty = data.difficulty ?? "easy";
      await this.deps.setDifficulty(difficulty, { recalc: false });

      // ── Phase 4: 并行加载所有独立模块 ──
      this.reportProgress(68, "加载游戏数据...");

      const parallelTasks: Array<Promise<void>> = [];

      // Task A: 武功 + 替换武功 + 物品 + 备忘录
      parallelTasks.push(
        (async () => {
          const t = performance.now();
          magicInventory.stopReplace();
          magicInventory.clearReplaceList();
          await loadMagicContainer(data.magicContainer, magicInventory);
          if (data.replaceMagicLists) {
            await magicInventory.deserializeReplaceLists(data.replaceMagicLists);
          }
          loadGoodsContainer(data.goodsContainer, goodsListManager, true);
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
      // 近距离（≤20格）立即并行加载并上报进度；
      // 远距离 NPC 的后台加载函数在 await Promise.all(parallelTasks) 之后再启动，
      // 避免与玩家精灵加载争抢网络/解码资源。
      const allNpcs = [...(data.snapshot.npc ?? []), ...(data.snapshot.partner ?? [])];
      let startFarNpcLoad: (() => void) | null = null;
      if (allNpcs.length > 0) {
        parallelTasks.push(
          (async () => {
            const t = performance.now();
            npcManager.clearAllNpc();
            if (state.npc) npcManager.setFileName(state.npc);
            let nearCount = allNpcs.length; // 初值：未分流时视为全部近距离
            const bgLoader = await loadNpcsFromJSON(allNpcs, npcManager, {
              playerTile: { x: data.player.mapX, y: data.player.mapY },
              nearThreshold: 20,
              onProgress: (done, nearTotal) => {
                nearCount = nearTotal;
                // 将近距离 NPC 进度映射到内部 68 → 85%
                this.reportProgress(
                  Math.round(68 + (done / Math.max(nearTotal, 1)) * 17),
                  "加载游戏数据..."
                );
              },
            });
            startFarNpcLoad = bgLoader;
            const farCount = allNpcs.length - nearCount;
            time(
              farCount > 0 ? `NPCs(${nearCount}near+${farCount}bg)` : `NPCs(${allNpcs.length})`,
              t
            );
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

      // Task E: 陷阱恢复（重建 _groupTrap 与 _snapshotTrap，覆盖 Phase 2 init 的初值）
      parallelTasks.push(
        (async () => {
          loadTrapsFromSave(data.snapshot?.trap, data.groups?.trap, this.deps.map);
        })()
      );

      await Promise.all(parallelTasks);

      // 所有阻塞任务完成后，再启动远距离 NPC 后台加载（不再与玩家精灵争资源）
      if (startFarNpcLoad !== null) {
        (startFarNpcLoad as () => void)();
      }

      // ── Phase 5: 收尾 ──
      this.reportProgress(90, "应用装备效果...");
      const tEffects = performance.now();

      // 恢复分组存储
      if (data.groups?.npc) npcManager.setNpcGroups(data.groups.npc);
      if (data.groups?.obj) objManager.setObjGroups(data.groups.obj);

      // 恢复统一角色档案（characterProfiles 优先；否则从旧字段迁移）
      if (data.characterProfiles) {
        this.characterProfileStore.deserialize(data.characterProfiles);
        for (const [key, profile] of Object.entries(data.characterProfiles)) {
          const magicCount = profile.magicContainer?.panelMagics?.filter(Boolean).length ?? 0;
          logger.log(`[Load] Profile ${key}: ${magicCount} magics`);
        }
      } else {
        // 兼容旧存档：合并 otherCharacters + partnerRegistry → characterProfiles
        const migrated: Record<string, import("./save-types").CharacterProfile> = {};
        if (data.otherCharacters) {
          for (const [idx, slot] of Object.entries(data.otherCharacters)) {
            migrated[`idx:${idx}`] = {
              player: slot.player ?? null,
              magicContainer: slot.magicContainer ?? {
                panelMagics: [],
                xiuLianMagic: null,
                bottomMagics: [],
                hiddenMagics: [],
              },
              goodsContainer: slot.goodsContainer ?? {
                bagItems: [],
                equipItems: [],
                bottomItems: [],
              },
              memo: slot.memo ?? undefined,
            };
          }
        }
        if (data.partnerRegistry) {
          const players = getPlayersData();
          for (const [name, entry] of Object.entries(data.partnerRegistry)) {
            const apiPlayer = players?.find((p) => p.name === name);
            const key = apiPlayer ? `idx:${apiPlayer.index}` : `name:${name}`;
            if (migrated[key]) {
              logger.log(
                `[Load] Migration conflict on ${key} (partner ${name}); keeping existing player profile`
              );
              migrated[key].magicContainer = entry.magicContainer ?? migrated[key].magicContainer;
              migrated[key].goodsContainer = entry.goodsContainer ?? migrated[key].goodsContainer;
            } else {
              migrated[key] = {
                player: entry.character as unknown as import("./save-types").PlayerSaveData,
                magicContainer: entry.magicContainer,
                goodsContainer: entry.goodsContainer,
              };
            }
            const magicCount = entry.magicContainer?.panelMagics?.filter(Boolean).length ?? 0;
            logger.log(`[Load] Migrated partner ${name} → ${key} (${magicCount} magics)`);
          }
        }
        if (Object.keys(migrated).length > 0) {
          this.characterProfileStore.deserialize(migrated);
        }
      }

      this.finalizeLoad(timings, tEffects, () => {
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

          // 恢复亮度设置
          if (data.option.mainLum !== undefined) {
            screenEffects.setMainLum(data.option.mainLum);
          }
          if (data.option.fadeLum !== undefined) {
            screenEffects.setFadeLum(data.option.fadeLum);
          }
          if (data.option.playerLum !== undefined) {
            screenEffects.setPlayerLum(data.option.playerLum);
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
      });

      // ── Phase 6: 完成 ──
      this.reportProgress(95, "初始化视角...");
      this.deps.centerCameraOnPlayer();
      this.deps.onLoadComplete?.();

      // 注：旧版 otherCharacters 已在前面与 partnerRegistry 一起迁移到 characterProfiles

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
      difficulty: this.deps.getDifficulty(),

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

      // 选项
      option: {
        mapTime: getMapTime(),
        snowShow: weatherState.isSnowing,
        rainFile: weatherState.isRaining ? "rain" : "", // 保存雨声文件名
        water: this.deps.isWaterEffectEnabled(),
        mpcStyle: colorToHex(mapColor),
        asfStyle: colorToHex(spriteColor),
        saveDisabled: !isSaveEnabled(),
        isDropGoodWhenDefeatEnemyDisabled: !isDropEnabled(),
        mainLum: screenEffects.getMainLum(),
        fadeLum: screenEffects.getFadeLum(),
        playerLum: screenEffects.getPlayerLum(),
      },

      // 计时器
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

      // 武功容器（新格式）
      magicContainer: SaveDataCollector.collectMagicContainer(magicInventory),
      // 物品容器（新格式）
      goodsContainer: SaveDataCollector.collectGoodsContainer(goodsListManager),

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

      // 统一角色档案（主角 + 所有伙伴）
      characterProfiles: (() => {
        // 先把当前所有活跃伙伴写入档案
        for (const partner of npcManager.getAllPartner()) {
          this.characterProfileLoader.flushNpcToProfile(partner);
        }
        // 再写入当前主角
        this.characterProfileLoader.flushPlayerToProfile();
        const profiles = this.characterProfileStore.serialize();
        if (profiles) {
          for (const [key, profile] of Object.entries(profiles)) {
            const magicCount = profile.magicContainer?.panelMagics?.filter(Boolean).length ?? 0;
            logger.log(`[Save] Profile ${key}: ${magicCount} magics`);
          }
        }
        return profiles;
      })(),
    };

    return saveData;
  }
}
