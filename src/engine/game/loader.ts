/**
 * Loader - 游戏加载器
 *
 * ================== 职责边界 ==================
 *
 * Loader 负责「游戏初始化和存档」：
 * 1. newGame() - 开始新游戏，运行 NewGame.txt 脚本
 * 2. loadGame(index) - 读取存档（从文件或 JSON），加载地图/NPC/物品/武功/玩家等
 * 3. saveGame(index) - 保存存档到 localStorage (JSON格式)
 * 4. loadGameFromJSON(data) - 从 JSON 数据加载存档
 * 5. collectSaveData() - 收集当前游戏状态用于保存
 *
 * 参考 C# 实现：
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

import type { AudioManager } from "../audio";
import type { NpcManager } from "../character/npcManager";
import { logger } from "../core/logger";
import type { ScreenEffects } from "../effects";
import type { GuiManager } from "../gui/guiManager";
import type { MemoListManager } from "../listManager";
import type { ObjManager } from "../obj";
import type { GoodsListManager } from "../player/goods";
import type { MagicListManager } from "../player/magic/magicListManager";
import type { Player } from "../player/player";
import { resourceLoader } from "../resource/resourceLoader";
import type { ScriptExecutor } from "../script/executor";
import { MapBase } from "../map/mapBase";
import { DefaultPaths, ResourcePath } from "@/config/resourcePaths";
import {
  formatSaveTime,
  type GoodsItemData,
  type MagicItemData,
  type NpcSaveItem,
  type ObjSaveItem,
  type PlayerSaveData,
  SAVE_VERSION,
  type SaveData,
  StorageManager,
  type TrapData,
} from "./storage";

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
  getScriptExecutor: () => ScriptExecutor;
  loadMap: (mapPath: string) => Promise<void>;
  parseIni: (content: string) => Record<string, Record<string, string>>;
  clearScriptCache: () => void;
  clearVariables: () => void;
  resetEventId: () => void;
  resetGameTime: () => void;
  loadPlayerSprites?: (npcIni: string) => Promise<void>;
  // 用于存档
  getVariables?: () => Record<string, number>;
  setVariables?: (vars: Record<string, number>) => void;
  getCurrentMapName?: () => string;
  getCanvas?: () => HTMLCanvasElement | null;
  // 进度回调（可选，用于报告加载进度）
  onProgress?: LoadProgressCallback;
  // 立即将摄像机居中到玩家位置（用于加载存档后避免摄像机飞过去）
  centerCameraOnPlayer?: () => void;

  // === 游戏选项和计时器 (用于存档) ===
  // 地图时间
  getMapTime?: () => number;
  setMapTime?: (time: number) => void;
  // 存档/掉落开关
  isSaveEnabled?: () => boolean;
  setSaveEnabled?: (enabled: boolean) => void;
  isDropEnabled?: () => boolean;
  setDropEnabled?: (enabled: boolean) => void;
  // 天气
  getWeatherState?: () => { isSnowing: boolean; isRaining: boolean };
  setWeatherState?: (state: { snowShow: boolean; rainFile: string }) => void;
  // 计时器
  getTimerState?: () => {
    isOn: boolean;
    totalSecond: number;
    isHidden: boolean;
    isScriptSet: boolean;
    timerScript: string;
    triggerTime: number;
  };
  setTimerState?: (state: {
    isOn: boolean;
    totalSecond: number;
    isHidden: boolean;
    isScriptSet: boolean;
    timerScript: string;
    triggerTime: number;
  }) => void;

  // === 新增: 脚本显示地图坐标、水波效果、并行脚本 ===
  // 脚本显示地图坐标
  isScriptShowMapPos?: () => boolean;
  setScriptShowMapPos?: (show: boolean) => void;
  // 水波效果
  isWaterEffectEnabled?: () => boolean;
  setWaterEffectEnabled?: (enabled: boolean) => void;
  // 并行脚本 (通过 ScriptExecutor 获取/设置)
  getParallelScripts?: () => Array<{ filePath: string; waitMilliseconds: number }>;
  loadParallelScripts?: (scripts: Array<{ filePath: string; waitMilliseconds: number }>) => void;
}

/**
 * Game Loader - 游戏初始化和存档管理
 */
export class Loader {
  private deps: LoaderDependencies;

  constructor(deps: LoaderDependencies) {
    this.deps = deps;
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

    // 以黑屏开始（用于淡入淡出特效）
    screenEffects.setFadeTransparency(1);

    // 运行 NewGame 脚本
    const scriptExecutor = getScriptExecutor();
    await scriptExecutor.runScript(DefaultPaths.newGameScript);

    logger.log("[Loader] New game started");
  }

  /**
   * 读取存档
   *
   * 加载流程：
   * 1. 清理 managers（index != 0 时）
   * 2. 加载 Game.ini（地图、NPC、物体、BGM）
   * 3. 加载 Magic.ini、Goods.ini、memo.ini
   * 4. 加载 Player.ini
   * 5. 加载 Traps.ini
   *
   * @param index 存档索引 (0 = 初始存档, 1-7 = 用户存档)
   */
  async loadGame(index: number): Promise<void> {
    // index 0 时不清理 managers（由 NewGame.txt 调用）
    // index 1-7 时先清理 managers
    const isInitializeGame = index !== 0;

    const {
      player,
      npcManager,
      objManager,
      audioManager,
      memoListManager,
      loadMap,
      parseIni,
      clearScriptCache,
      clearVariables,
    } = this.deps;

    // 从 Player 获取 GoodsListManager 和 MagicListManager
    const goodsListManager = player.getGoodsListManager();
    const magicListManager = player.getMagicListManager();

    logger.log(`[Loader] Loading game save index: ${index}, isInitializeGame: ${isInitializeGame}`);

    try {
      // Step 1: 清理 managers
      if (isInitializeGame) {
        logger.debug(`[Loader] Clearing all managers...`);
        clearScriptCache();
        clearVariables();
        npcManager.clearAllNpcs();
        objManager.clearAll();
        audioManager.stopMusic();
      }

      // 确定存档路径
      // index 0 = resources/save/game/Game.ini (初始存档)
      // index 1-7 = resources/save/rpgN/Game.ini (用户存档)
      const basePath = ResourcePath.saveBase(index);

      // Step 2: 加载 Game.ini
      const gameIniPath = `${basePath}/Game.ini`;
      const content = await resourceLoader.loadText(gameIniPath);
      if (!content) {
        logger.error(`[Loader] Failed to load Game.ini: ${gameIniPath}`);
        return;
      }

      const sections = parseIni(content);
      const stateSection = sections.State;

      // 玩家角色索引 - 默认 0
      let chrIndex = 0;

      if (stateSection) {
        // 加载地图
        const mapName = stateSection.Map;
        if (mapName) {
          logger.debug(`[Loader] Loading map: ${mapName}`);
          await loadMap(mapName);
        }

        // 加载 NPC
        const npcFile = stateSection.Npc;
        if (npcFile) {
          logger.debug(`[Loader] Loading NPC file: ${npcFile}`);
          await npcManager.loadNpcFile(npcFile);
        }

        // 加载物体
        const objFile = stateSection.Obj;
        if (objFile) {
          logger.debug(`[Loader] Loading Obj file: ${objFile}`);
          await objManager.load(objFile);
        }

        // 加载背景音乐
        const bgm = stateSection.Bgm;
        if (bgm) {
          audioManager.playMusic(bgm);
        }

        // 玩家角色索引（支持多主角）
        chrIndex = parseInt(stateSection.Chr || "0", 10);
      }

      // Step 3: 加载 Magic、Goods、Memo
      // C# Reference: Loader.LoadMagicGoodList - 先停止替换并清理替换列表
      magicListManager.stopReplace();
      magicListManager.clearReplaceList();

      const magicPath = `${basePath}/Magic${chrIndex}.ini`;
      logger.debug(`[Loader] Loading magic from: ${magicPath}`);
      await magicListManager.loadPlayerList(magicPath);

      const goodsPath = `${basePath}/Goods${chrIndex}.ini`;
      logger.debug(`[Loader] Loading goods from: ${goodsPath}`);
      await goodsListManager.loadList(goodsPath);

      const memoPath = `${basePath}/memo.ini`;
      logger.debug(`[Loader] Loading memo from: ${memoPath}`);
      await this.loadMemoList(memoPath, memoListManager, parseIni);

      // Step 4: 加载玩家
      const playerPath = `${basePath}/Player${chrIndex}.ini`;
      logger.debug(`[Loader] Loading player from: ${playerPath}`);
      await player.loadFromFile(playerPath);

      // 加载玩家精灵
      if (this.deps.loadPlayerSprites) {
        const playerNpcIni = player.npcIni;
        logger.debug(`[Loader] Loading player sprites: ${playerNpcIni}`);
        await this.deps.loadPlayerSprites(playerNpcIni);
      }

      // 应用装备特效
      // C# Reference: Loader.LoadPlayer() -> GoodsListManager.ApplyEquipSpecialEffectFromList
      goodsListManager.applyEquipSpecialEffectFromList();

      // 应用武功效果（FlyIni 替换等）
      // C# Reference: Loader.LoadPlayer() -> Globals.ThePlayer.LoadMagicEffect()
      player.loadMagicEffect();

      // Step 5: 加载陷阱
      await MapBase.LoadTrap(`${basePath}/Traps.ini`);

      logger.debug(`[Loader] Game save loaded successfully`);

      // Debug: 打印障碍物体
      objManager.debugPrintObstacleObjs();
    } catch (error) {
      logger.error(`[Loader] Error loading game save:`, error);
    }
  }

  /**
   * 加载备忘录列表
   * Uses unified resourceLoader for text data fetching
   */
  private async loadMemoList(
    path: string,
    memoListManager: MemoListManager,
    parseIni: (content: string) => Record<string, Record<string, string>>
  ): Promise<void> {
    try {
      const content = await resourceLoader.loadText(path);
      if (!content) {
        logger.warn(`[Loader] No memo file found: ${path}`);
        memoListManager.renewList();
        return;
      }

      const sections = parseIni(content);
      const memoSection = sections.Memo;

      if (memoSection) {
        memoListManager.loadList(memoSection);
      } else {
        memoListManager.renewList();
      }
    } catch (error) {
      logger.warn(`[Loader] Error loading memo list:`, error);
      memoListManager.renewList();
    }
  }

  // ============= JSON 存档系统 =============

  /**
   * 保存存档到 localStorage
   *
   * 参考 C# Saver.SaveGame(int index, Texture2D snapShot)
   *
   * @param index 存档索引 (1-7)
   * @returns 是否保存成功
   */
  async saveGame(index: number): Promise<boolean> {
    logger.log(`[Loader] Saving game to slot ${index}...`);

    try {
      // 收集存档数据
      const saveData = this.collectSaveData();

      // 截图预览
      if (this.deps.getCanvas) {
        const canvas = this.deps.getCanvas();
        if (canvas) {
          saveData.screenshot = StorageManager.captureScreenshot(canvas);
        }
      }

      // 保存到 localStorage
      const success = StorageManager.saveGame(index, saveData);
      if (success) {
        logger.log(`[Loader] Game saved to slot ${index} successfully`);
      }
      return success;
    } catch (error) {
      logger.error(`[Loader] Error saving game:`, error);
      return false;
    }
  }

  /**
   * 从 JSON 数据加载存档
   *
   * @param data 存档数据
   */
  async loadGameFromJSON(data: SaveData): Promise<void> {
    logger.log(`[Loader] Loading game from JSON...`);

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

    // 从 Player 获取 GoodsListManager 和 MagicListManager
    const goodsListManager = player.getGoodsListManager();
    const magicListManager = player.getMagicListManager();

    try {
      // Step 0: 立即设置屏幕全黑，防止在加载过程中看到摄像机移动
      // C# Reference: 存档加载时画面保持黑色直到 FadeIn
      screenEffects.setFadeTransparency(1);

      // Step 1: 停止所有正在运行的脚本 (0-5%)
      // C# Reference: ScriptManager.Clear()
      this.reportProgress(0, "停止脚本...");
      logger.debug(`[Loader] Stopping all scripts...`);
      const scriptExecutor = getScriptExecutor();
      scriptExecutor.stopAllScripts();

      // Step 2: 重置 UI 状态（关闭对话框、选择框等）(5-10%)
      // C# Reference: GuiManager.EndDialog(), GuiManager.CloseTimeLimit()
      this.reportProgress(5, "重置界面...");
      logger.debug(`[Loader] Resetting UI state...`);
      guiManager.resetAllUI();

      // Step 3: 清理 (10-15%)
      this.reportProgress(10, "清理数据...");
      logger.debug(`[Loader] Clearing all managers...`);
      clearScriptCache();
      this.deps.clearVariables();
      npcManager.clearAllNpcs();
      objManager.clearAll();
      audioManager.stopMusic();

      // Step 4: 加载游戏状态
      const state = data.state;

      // 加载地图 (15-70% - 地图加载是最耗时的部分)
      if (state.map) {
        this.reportProgress(15, "加载地图...");
        logger.debug(`[Loader] Loading map: ${state.map}`);
        await loadMap(state.map);
      }

      // 注意：不从 .npc 文件加载，而是从 JSON 存档数据恢复
      // C# 在存档时会把 NPC 状态写到 save/game/xxx.npc 文件
      // Web 版直接从 JSON 恢复，所以跳过 npcManager.loadNpcFile()
      // 只设置 fileName 用于后续可能的引用
      if (state.npc) {
        npcManager.setFileName(state.npc);
      }

      // 注意：不从 .obj 文件加载，而是从 JSON 存档数据恢复
      // C# 在存档时会把 Obj 状态写到 save/game/xxx.obj 文件
      // Web 版直接从 JSON 恢复，所以跳过 objManager.load()
      // 只设置 fileName 用于后续可能的引用
      if (state.obj) {
        objManager.setFileName(state.obj);
      }

      // 播放背景音乐
      if (state.bgm) {
        audioManager.playMusic(state.bgm);
      }

      // Step 5: 恢复变量 (70-72%)
      this.reportProgress(70, "恢复变量...");
      if (data.variables && setVariables) {
        logger.debug(
          `[Loader] Restoring variables: ${Object.keys(data.variables).length} keys`
        );
        setVariables(data.variables);
      }

      // Step 6: 加载武功列表 (72-75%)
      this.reportProgress(72, "加载武功...");
      // C# Reference: Loader.LoadMagicGoodList - 先停止替换并清理替换列表
      magicListManager.stopReplace();
      magicListManager.clearReplaceList();
      logger.debug(`[Loader] Loading magics...`);
      await this.loadMagicsFromJSON(data.magics, data.xiuLianIndex, magicListManager);

      // 加载替换武功列表（如果有）
      // C# Reference: ReplaceListTo 会在角色变身时创建替换列表，保存时通过 SaveReplaceList 持久化
      if (data.replaceMagicLists) {
        logger.debug(`[Loader] Loading replace magic lists...`);
        await magicListManager.deserializeReplaceLists(data.replaceMagicLists);
      }

      // Step 7: 加载物品列表 (75-78%)
      this.reportProgress(75, "加载物品...");
      logger.debug(`[Loader] Loading goods...`);
      await this.loadGoodsFromJSON(data.goods, data.equips, goodsListManager);

      // Step 8: 加载备忘录 (78-80%)
      this.reportProgress(78, "加载备忘...");
      if (data.memo) {
        logger.debug(`[Loader] Loading memo...`);
        memoListManager.renewList();
        for (const item of data.memo.items) {
          memoListManager.addItem(item);
        }
      }

      // Step 9: 加载玩家 (80-85%)
      this.reportProgress(80, "加载玩家...");
      logger.debug(`[Loader] Loading player...`);
      await this.loadPlayerFromJSON(data.player, player);

      // 清除自定义动作文件（如脚本设置的跪地动作）
      // C# Reference: In C# loading creates a new Player object, effectively resetting custom actions
      player.clearCustomActionFiles();

      // 设置加载中状态（-1），确保后面设置真正 state 时会触发纹理更新
      player.setLoadingState();

      // 加载玩家精灵 (85-88%)
      this.reportProgress(85, "加载玩家精灵...");
      // C# Reference: Loader.LoadPlayer() -> new Player(path) -> Load() -> Initlize()
      if (this.deps.loadPlayerSprites) {
        const playerNpcIni = player.npcIni;
        logger.debug(`[Loader] Loading player sprites: ${playerNpcIni}`);
        await this.deps.loadPlayerSprites(playerNpcIni);
      }

      // 精灵加载后恢复 state（因为 _state=-1，值不同会触发纹理更新）
      player.state = data.player.state ?? 0;

      // 应用装备特效
      // C# Reference: Loader.LoadPlayer() -> GoodsListManager.ApplyEquipSpecialEffectFromList
      goodsListManager.applyEquipSpecialEffectFromList();

      // 应用武功效果（FlyIni 替换等）
      // C# Reference: Loader.LoadPlayer() -> Globals.ThePlayer.LoadMagicEffect()
      player.loadMagicEffect();

      // Step 10: 加载陷阱 (88-90%)
      // C# Reference: MapBase.LoadTrap() + LoadTrapIndexIgnoreList()
      //
      // C# 流程：
      // 1. CopyGameToSave - 把存档槽的完整 Traps.ini 复制到 save/game/
      // 2. LoadTrap - 从 save/game/Traps.ini 加载完整配置（替换 _traps）
      // 3. LoadTrapIgnoreList - 加载忽略列表
      //
      // Web 版本：
      // - 新存档有 mapTraps 字段，包含完整配置，直接使用
      // - 旧存档没有 mapTraps，需要从初始 Traps.ini 加载基础配置
      this.reportProgress(88, "加载陷阱...");
      if (data.traps?.mapTraps) {
        // 新存档格式：存档包含完整的 mapTraps 配置
        logger.debug(`[Loader] Loading traps from JSON save data...`);
        this.loadTrapsFromJSON(data.traps);
      } else {
        // 旧存档格式：从初始存档的 Traps.ini 加载基础配置
        logger.debug(`[Loader] Loading traps from initial Traps.ini (old save format)...`);
        const trapBasePath = ResourcePath.saveBase(0);
        await MapBase.LoadTrap(`${trapBasePath}/Traps.ini`);
        // 恢复 ignoreList
        if (data.traps) {
          this.loadTrapsFromJSON(data.traps);
        }
      }

      // Step 11: 从 JSON 恢复 NPC (90-95%)
      // 清空并从 JSON 存档数据重新创建所有 NPC（而不是从 .npc 文件加载）
      // C# Reference: NpcManager.Load() - clears and creates from save file
      this.reportProgress(90, "加载 NPC...");
      logger.debug(`[Loader] Loading NPCs...`);
      npcManager.clearAllNpcs();
      if (data.npcData?.npcs && data.npcData.npcs.length > 0) {
        await this.loadNpcsFromJSON(data.npcData.npcs, npcManager);
      }

      // Step 12: 从 JSON 恢复 Obj (95-98%)
      // 清空并从 JSON 存档数据重新创建所有 Obj（而不是从 .obj 文件加载）
      this.reportProgress(95, "加载物体...");
      logger.debug(`[Loader] Loading Objs...`);
      objManager.clearAll();
      if (data.objData?.objs && data.objData.objs.length > 0) {
        await this.loadObjsFromJSON(data.objData.objs, objManager);
      }

      // Step 13: 加载选项设置
      // 参考 C# Loader.cs LoadGame() 中的 option 恢复
      if (data.option) {
        logger.debug(`[Loader] Restoring game options...`);
        // mapTime
        if (this.deps.setMapTime && data.option.mapTime !== undefined) {
          this.deps.setMapTime(data.option.mapTime);
        }
        // save/drop flags
        if (this.deps.setSaveEnabled) {
          this.deps.setSaveEnabled(!data.option.saveDisabled);
        }
        if (this.deps.setDropEnabled) {
          this.deps.setDropEnabled(!data.option.isDropGoodWhenDefeatEnemyDisabled);
        }
        // weather
        if (this.deps.setWeatherState) {
          this.deps.setWeatherState({
            snowShow: data.option.snowShow,
            rainFile: data.option.rainFile,
          });
        }
        // draw colors (mpcStyle = map, asfStyle = sprite)
        // 格式: RRGGBB 十六进制字符串
        const hexToRgb = (hex: string) => {
          const r = parseInt(hex.substring(0, 2), 16) || 255;
          const g = parseInt(hex.substring(2, 4), 16) || 255;
          const b = parseInt(hex.substring(4, 6), 16) || 255;
          return { r, g, b };
        };
        if (data.option.mpcStyle && data.option.mpcStyle !== "FFFFFF") {
          const c = hexToRgb(data.option.mpcStyle);
          screenEffects.setMapColor(c.r, c.g, c.b);
          logger.debug(`[Loader] Restored map color: #${data.option.mpcStyle}`);
        }
        if (data.option.asfStyle && data.option.asfStyle !== "FFFFFF") {
          const c = hexToRgb(data.option.asfStyle);
          screenEffects.setSpriteColor(c.r, c.g, c.b);
          logger.debug(`[Loader] Restored sprite color: #${data.option.asfStyle}`);
        }
      }

      // Step 14: 加载计时器状态
      // 参考 C# Loader.cs LoadGame() 中的 timer 恢复
      if (data.timer && data.timer.isOn && this.deps.setTimerState) {
        logger.debug(`[Loader] Restoring timer state...`);
        this.deps.setTimerState({
          isOn: data.timer.isOn,
          totalSecond: data.timer.totalSecond,
          isHidden: !data.timer.isTimerWindowShow,
          isScriptSet: data.timer.isScriptSet,
          timerScript: data.timer.timerScript,
          triggerTime: data.timer.triggerTime,
        });
      }

      // Step 14.1: 恢复脚本显示地图坐标开关
      // C# Reference: Globals.ScriptShowMapPos
      if (data.state?.scriptShowMapPos !== undefined && this.deps.setScriptShowMapPos) {
        this.deps.setScriptShowMapPos(data.state.scriptShowMapPos);
        logger.debug(`[Loader] Restored scriptShowMapPos: ${data.state.scriptShowMapPos}`);
      }

      // Step 14.2: 恢复水波效果开关
      // C# Reference: Globals.IsWaterEffectEnabled
      if (data.option?.water !== undefined && this.deps.setWaterEffectEnabled) {
        this.deps.setWaterEffectEnabled(data.option.water);
        logger.debug(`[Loader] Restored water effect: ${data.option.water}`);
      }

      // Step 14.3: 加载并行脚本
      // C# Reference: ScriptManager.LoadParallelScript
      if (data.parallelScripts && data.parallelScripts.length > 0 && this.deps.loadParallelScripts) {
        logger.debug(`[Loader] Restoring ${data.parallelScripts.length} parallel scripts...`);
        this.deps.loadParallelScripts(data.parallelScripts);
      }

      // Step 15: 立即居中摄像机到玩家位置 (98%)
      // 必须在 fadeIn 之前完成，否则会看到摄像机移动
      this.reportProgress(98, "完成加载...");
      logger.debug(`[Loader] Centering camera on player...`);
      this.deps.centerCameraOnPlayer?.();

      // Step 14: 执行淡入效果 (98-100%)
      // 加载存档后屏幕应该从黑屏淡入到正常
      logger.debug(`[Loader] Starting fade in effect...`);
      screenEffects.fadeIn();

      this.reportProgress(100, "加载完成");
      logger.log(`[Loader] Game loaded from JSON successfully`);
    } catch (error) {
      logger.error(`[Loader] Error loading game from JSON:`, error);
      throw error;
    }
  }

  /**
   * 从 localStorage 加载存档
   *
   * @param index 存档索引 (1-7)
   */
  async loadGameFromSlot(index: number): Promise<boolean> {
    this.reportProgress(0, `读取存档 ${index}...`);
    logger.log(`[Loader] Loading game from slot ${index}...`);

    const data = StorageManager.loadGame(index);
    if (!data) {
      logger.error(`[Loader] No save data found at slot ${index}`);
      return false;
    }

    await this.loadGameFromJSON(data);
    return true;
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

    // 从 Player 获取 GoodsListManager 和 MagicListManager
    const goodsListManager = player.getGoodsListManager();
    const magicListManager = player.getMagicListManager();

    const mapName = getCurrentMapName?.() || "";
    const variables = getVariables?.() || {};
    const weatherState = getWeatherState?.() || { isSnowing: false, isRaining: false };
    const timerState = getTimerState?.() || {
      isOn: false,
      totalSecond: 0,
      isHidden: false,
      isScriptSet: false,
      timerScript: "",
      triggerTime: 0,
    };

    // 获取绘制颜色 (mpcStyle = map draw color, asfStyle = sprite draw color)
    const mapColor = screenEffects.getMapTintColor();
    const spriteColor = screenEffects.getSpriteTintColor();
    // 转换为十六进制字符串（C# 保存格式：RRGGBB）
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
        chr: 0, // TODO: 支持多主角
        time: formatSaveTime(),
        scriptShowMapPos: this.deps.isScriptShowMapPos?.() ?? false,
      },

      // 选项 - 参考 C# Saver.cs [Option] section
      option: {
        mapTime: getMapTime?.() ?? 0,
        snowShow: weatherState.isSnowing,
        rainFile: weatherState.isRaining ? "rain" : "", // C# 保存雨声文件名
        water: this.deps.isWaterEffectEnabled?.() ?? false,
        mpcStyle: colorToHex(mapColor),
        asfStyle: colorToHex(spriteColor),
        saveDisabled: !(isSaveEnabled?.() ?? true),
        isDropGoodWhenDefeatEnemyDisabled: !(isDropEnabled?.() ?? true),
      },

      // 计时器 - 参考 C# Saver.cs [Timer] section
      timer: {
        isOn: timerState.isOn,
        totalSecond: timerState.totalSecond,
        isTimerWindowShow: !timerState.isHidden, // C# 保存的是 "是否显示"，TypeScript 内部存的是 "是否隐藏"
        isScriptSet: timerState.isScriptSet,
        timerScript: timerState.timerScript,
        triggerTime: timerState.triggerTime,
      },

      // 脚本变量
      variables: { ...variables },

      // 并行脚本 (C# Reference: ScriptManager.SaveParallelScript)
      parallelScripts: this.deps.getParallelScripts?.() ?? [],

      // 玩家数据
      player: this.collectPlayerData(player),

      // 物品
      goods: this.collectGoodsData(goodsListManager),
      equips: this.collectEquipsData(goodsListManager),

      // 武功
      magics: this.collectMagicsData(magicListManager),
      xiuLianIndex: magicListManager.getXiuLianIndex(),
      // 替换武功列表 (角色变身时的临时武功)
      // C# Reference: GuiManager.Save -> MagicListManager.SaveReplaceList
      replaceMagicLists: magicListManager.serializeReplaceLists(),

      // 备忘录
      memo: {
        items: memoListManager.getItems(),
      },

      // 陷阱
      traps: this.collectTrapsData(),

      // NPC 数据
      npcData: {
        npcs: this.collectNpcData(npcManager),
      },

      // 物体数据
      objData: {
        objs: this.collectObjData(objManager),
      },
    };

    return saveData;
  }

  // ============= 数据收集方法 =============

  /**
   * 收集玩家数据
   * C# Reference: Character.Save() + Player.Save()
   */
  private collectPlayerData(player: Player): PlayerSaveData {
    return {
      // === 基本信息 ===
      name: player.name,
      npcIni: player.npcIni,
      kind: player.kind,
      relation: player.relation,
      pathFinder: player.pathFinder,
      state: player.state,

      // === 位置 ===
      mapX: player.mapX,
      mapY: player.mapY,
      dir: player.currentDirection,

      // === 范围 ===
      visionRadius: player.visionRadius,
      dialogRadius: player.dialogRadius,
      attackRadius: player.attackRadius,

      // === 属性 ===
      level: player.level,
      exp: player.exp,
      levelUpExp: player.levelUpExp,
      life: player.life,
      lifeMax: player.lifeMax,
      thew: player.thew,
      thewMax: player.thewMax,
      mana: player.mana,
      manaMax: player.manaMax,
      attack: player.attack,
      attack2: player.attack2,
      attack3: player.attack3,
      attackLevel: player.attackLevel,
      defend: player.defend,
      defend2: player.defend2,
      defend3: player.defend3,
      evade: player.evade,
      lum: player.lum,
      action: player.action,
      walkSpeed: player.walkSpeed,
      addMoveSpeedPercent: player.addMoveSpeedPercent,
      expBonus: player.expBonus,
      canLevelUp: player.canLevelUp,

      // === 位置相关 ===
      fixedPos: player.fixedPos,
      currentFixedPosIndex: player.currentFixedPosIndex,
      destinationMapPosX: player.destinationMoveTilePosition.x,
      destinationMapPosY: player.destinationMoveTilePosition.y,

      // === AI/行为 ===
      idle: player.idle,
      group: player.group,
      noAutoAttackPlayer: player.noAutoAttackPlayer,
      invincible: player.invincible,

      // === 状态效果 ===
      poisonSeconds: player.poisonSeconds,
      poisonByCharacterName: player.poisonByCharacterName,
      petrifiedSeconds: player.petrifiedSeconds,
      frozenSeconds: player.frozenSeconds,
      isPoisonVisualEffect: player.isPoisonVisualEffect,
      isPetrifiedVisualEffect: player.isPetrifiedVisualEffect,
      isFrozenVisualEffect: player.isFrozenVisualEffect,

      // === 死亡/复活 ===
      isDeath: player.isDeath,
      isDeathInvoked: player.isDeathInvoked,
      reviveMilliseconds: player.reviveMilliseconds,
      leftMillisecondsToRevive: player.leftMillisecondsToRevive,

      // === INI 文件 ===
      bodyIni: player.bodyIni || undefined,
      flyIni: player.flyIni || undefined,
      flyIni2: player.flyIni2 || undefined,
      flyInis: player.flyInis || undefined,
      isBodyIniAdded: player.isBodyIniAdded,

      // === 脚本相关 ===
      scriptFile: player.scriptFile || undefined,
      scriptFileRight: player.scriptFileRight || undefined,
      deathScript: player.deathScript || undefined,
      timerScriptFile: player.timerScript || undefined,
      timerScriptInterval: player.timerInterval,

      // === 技能相关 ===
      magicToUseWhenLifeLow: player.magicToUseWhenLifeLow || undefined,
      lifeLowPercent: player.lifeLowPercent,
      keepRadiusWhenLifeLow: player.keepRadiusWhenLifeLow,
      keepRadiusWhenFriendDeath: player.keepRadiusWhenFriendDeath,
      magicToUseWhenBeAttacked: player.magicToUseWhenBeAttacked || undefined,
      magicDirectionWhenBeAttacked: player.magicDirectionWhenBeAttacked,
      magicToUseWhenDeath: player.magicToUseWhenDeath || undefined,
      magicDirectionWhenDeath: player.magicDirectionWhenDeath,

      // === 商店/可见性 ===
      buyIniFile: player.buyIniFile || undefined,
      buyIniString: player.buyIniString || undefined,
      visibleVariableName: player.visibleVariableName || undefined,
      visibleVariableValue: player.visibleVariableValue,

      // === 掉落 ===
      dropIni: player.dropIni || undefined,

      // === 装备 ===
      canEquip: player.canEquip,
      headEquip: player.headEquip || undefined,
      neckEquip: player.neckEquip || undefined,
      bodyEquip: player.bodyEquip || undefined,
      backEquip: player.backEquip || undefined,
      handEquip: player.handEquip || undefined,
      wristEquip: player.wristEquip || undefined,
      footEquip: player.footEquip || undefined,
      backgroundTextureEquip: player.backgroundTextureEquip || undefined,

      // === 保持攻击位置 ===
      keepAttackX: player.keepAttackX,
      keepAttackY: player.keepAttackY,

      // === 伤害玩家 ===
      hurtPlayerInterval: player.hurtPlayerInterval,
      hurtPlayerLife: player.hurtPlayerLife,
      hurtPlayerRadius: player.hurtPlayerRadius,

      // === Player 特有 ===
      money: player.money,
      currentUseMagicIndex: player.currentUseMagicIndex,
      manaLimit: player.manaLimit,
      isRunDisabled: player.isRunDisabled,
      isJumpDisabled: player.isJumpDisabled,
      isFightDisabled: player.isFightDisabled,
      walkIsRun: player.walkIsRun,
      addLifeRestorePercent: player.getAddLifeRestorePercent(),
      addManaRestorePercent: player.getAddManaRestorePercent(),
      addThewRestorePercent: player.getAddThewRestorePercent(),

      // === 等级配置文件 ===
      levelIniFile: player.levelIniFile || undefined,
    };
  }

  /**
   * 收集物品数据
   */
  private collectGoodsData(goodsListManager: GoodsListManager): GoodsItemData[] {
    const items: GoodsItemData[] = [];

    // 遍历背包物品 (1-198)
    for (let i = 1; i <= 198; i++) {
      const info = goodsListManager.getItemInfo(i);
      if (info?.good) {
        items.push({
          fileName: info.good.fileName,
          count: info.count,
        });
      }
    }

    return items;
  }

  /**
   * 收集装备数据
   */
  private collectEquipsData(goodsListManager: GoodsListManager): (GoodsItemData | null)[] {
    const equips: (GoodsItemData | null)[] = [];

    // 装备槽位 (201-207)
    for (let i = 201; i <= 207; i++) {
      const info = goodsListManager.getItemInfo(i);
      if (info?.good) {
        equips.push({
          fileName: info.good.fileName,
          count: 1,
        });
      } else {
        equips.push(null);
      }
    }

    return equips;
  }

  /**
   * 收集武功数据
   * 参考 C# MagicListManager.SaveList
   */
  private collectMagicsData(magicListManager: MagicListManager): MagicItemData[] {
    const items: MagicItemData[] = [];

    // 遍历完整武功列表 (1 到 maxMagic，包括存储区 1-36、快捷栏 40-44、修炼 49)
    const maxMagic = 49;
    for (let i = 1; i <= maxMagic; i++) {
      const info = magicListManager.getItemInfo(i);
      if (info?.magic) {
        items.push({
          fileName: info.magic.fileName,
          level: info.level,
          exp: info.exp,
          index: i,
        });
      }
    }

    return items;
  }

  /**
   * 收集陷阱数据
   * 使用 MapBase 的方法
   */
  private collectTrapsData(): {
    ignoreList: number[];
    mapTraps: Record<string, Record<number, string>>;
  } {
    return MapBase.CollectTrapDataForSave();
  }

  /**
   * 收集 NPC 数据
   * C# Reference: NpcManager.Save() + Character.Save()
   * 完整对应 C# 所有存档字段
   */
  private collectNpcData(npcManager: NpcManager): NpcSaveItem[] {
    const items: NpcSaveItem[] = [];
    const allNpcs = npcManager.getAllNpcs();

    for (const [, npc] of allNpcs) {
      // 跳过被召唤的 NPC（由魔法召唤的）
      // TODO: 如果有 summonedByMagicSprite 属性，跳过

      const item: NpcSaveItem = {
        // === 基本信息 ===
        name: npc.name,
        npcIni: npc.npcIni,
        kind: npc.kind,
        relation: npc.relation,
        pathFinder: npc.pathFinder,
        state: npc.state,

        // === 位置 ===
        mapX: npc.mapX,
        mapY: npc.mapY,
        dir: npc.currentDirection,

        // === 范围 ===
        visionRadius: npc.visionRadius,
        dialogRadius: npc.dialogRadius,
        attackRadius: npc.attackRadius,

        // === 属性 ===
        level: npc.level,
        exp: npc.exp,
        levelUpExp: npc.levelUpExp,
        life: npc.life,
        lifeMax: npc.lifeMax,
        thew: npc.thew,
        thewMax: npc.thewMax,
        mana: npc.mana,
        manaMax: npc.manaMax,
        attack: npc.attack,
        attack2: npc.attack2,
        attack3: npc.attack3,
        attackLevel: npc.attackLevel,
        defend: npc.defend,
        defend2: npc.defend2,
        defend3: npc.defend3,
        evade: npc.evade,
        lum: npc.lum,
        action: npc.actionType,
        walkSpeed: npc.walkSpeed,
        addMoveSpeedPercent: npc.addMoveSpeedPercent,
        expBonus: npc.expBonus,
        canLevelUp: npc.canLevelUp,

        // === 位置相关 ===
        fixedPos: npc.fixedPos,
        currentFixedPosIndex: npc.currentFixedPosIndex,
        destinationMapPosX: npc.destinationMoveTilePosition.x,
        destinationMapPosY: npc.destinationMoveTilePosition.y,

        // === AI/行为 ===
        idle: npc.idle,
        group: npc.group,
        noAutoAttackPlayer: npc.noAutoAttackPlayer,
        invincible: npc.invincible,

        // === 状态效果 ===
        poisonSeconds: npc.poisonSeconds,
        poisonByCharacterName: npc.poisonByCharacterName,
        petrifiedSeconds: npc.petrifiedSeconds,
        frozenSeconds: npc.frozenSeconds,
        isPoisonVisualEffect: npc.isPoisonVisualEffect,
        isPetrifiedVisualEffect: npc.isPetrifiedVisualEffect,
        isFrozenVisualEffect: npc.isFrozenVisualEffect,

        // === 死亡/复活 ===
        isDeath: npc.isDeath,
        isDeathInvoked: npc.isDeathInvoked,
        reviveMilliseconds: npc.reviveMilliseconds,
        leftMillisecondsToRevive: npc.leftMillisecondsToRevive,

        // === INI 文件 ===
        bodyIni: npc.bodyIni || undefined,
        flyIni: npc.flyIni || undefined,
        flyIni2: npc.flyIni2 || undefined,
        flyInis: npc.flyInis || undefined,
        isBodyIniAdded: npc.isBodyIniAdded,

        // === 脚本相关 ===
        scriptFile: npc.scriptFile || undefined,
        scriptFileRight: npc.scriptFileRight || undefined,
        deathScript: npc.deathScript || undefined,
        timerScriptFile: npc.timerScript || undefined,
        timerScriptInterval: npc.timerInterval,

        // === 技能相关 ===
        magicToUseWhenLifeLow: npc.magicToUseWhenLifeLow || undefined,
        lifeLowPercent: npc.lifeLowPercent,
        keepRadiusWhenLifeLow: npc.keepRadiusWhenLifeLow,
        keepRadiusWhenFriendDeath: npc.keepRadiusWhenFriendDeath,
        magicToUseWhenBeAttacked: npc.magicToUseWhenBeAttacked || undefined,
        magicDirectionWhenBeAttacked: npc.magicDirectionWhenBeAttacked,
        magicToUseWhenDeath: npc.magicToUseWhenDeath || undefined,
        magicDirectionWhenDeath: npc.magicDirectionWhenDeath,

        // === 商店/可见性 ===
        buyIniFile: npc.buyIniFile || undefined,
        buyIniString: npc.buyIniString || undefined,
        visibleVariableName: npc.visibleVariableName || undefined,
        visibleVariableValue: npc.visibleVariableValue,

        // === 掉落 ===
        dropIni: npc.dropIni || undefined,

        // === 装备 ===
        canEquip: npc.canEquip,
        headEquip: npc.headEquip || undefined,
        neckEquip: npc.neckEquip || undefined,
        bodyEquip: npc.bodyEquip || undefined,
        backEquip: npc.backEquip || undefined,
        handEquip: npc.handEquip || undefined,
        wristEquip: npc.wristEquip || undefined,
        footEquip: npc.footEquip || undefined,
        backgroundTextureEquip: npc.backgroundTextureEquip || undefined,

        // === 保持攻击位置 ===
        keepAttackX: npc.keepAttackX,
        keepAttackY: npc.keepAttackY,

        // === 伤害玩家 ===
        hurtPlayerInterval: npc.hurtPlayerInterval,
        hurtPlayerLife: npc.hurtPlayerLife,
        hurtPlayerRadius: npc.hurtPlayerRadius,

        // === NPC 特有 ===
        isVisible: npc.isVisible,
        isAIDisabled: npc.isAIDisabled,

        // === 巡逻路径 ===
        actionPathTilePositions:
          npc.actionPathTilePositions?.length > 0
            ? npc.actionPathTilePositions.map((p) => ({ x: p.x, y: p.y }))
            : undefined,

        // === 等级配置文件 ===
        levelIniFile: npc.levelIniFile || undefined,
      };

      items.push(item);
    }

    logger.log(`[Loader] Collected ${items.length} NPCs`);
    return items;
  }

  /**
   * 收集物体数据
   * 参考 C# ObjManager.Save() 和 Obj.Save()
   */
  private collectObjData(objManager: ObjManager): ObjSaveItem[] {
    const items: ObjSaveItem[] = [];
    const allObjs = objManager.getAllObjs();

    for (const obj of allObjs) {
      // 跳过已被移除的物体
      if (obj.isRemoved) continue;

      const item: ObjSaveItem = {
        // 基本信息
        objName: obj.objName,
        kind: obj.kind,
        dir: obj.dir,

        // 位置
        mapX: obj.mapX,
        mapY: obj.mapY,

        // 属性
        damage: obj.damage,
        frame: obj.currentFrameIndex,
        height: obj.height,
        lum: obj.lum,
        objFile: obj.objFileName,
        offX: obj.offX,
        offY: obj.offY,

        // 脚本
        scriptFile: obj.scriptFile || undefined,
        scriptFileRight: obj.scriptFileRight || undefined,
        timerScriptFile: obj.timerScriptFile || undefined,
        timerScriptInterval: obj.timerScriptInterval,
        scriptFileJustTouch: obj.scriptFileJustTouch,

        // 其他
        wavFile: obj.wavFile || undefined,
        millisecondsToRemove: obj.millisecondsToRemove,
        isRemoved: obj.isRemoved,
      };

      items.push(item);
    }

    logger.log(`[Loader] Collected ${items.length} Objs`);
    return items;
  }

  // ============= 数据加载方法 =============

  /**
   * 从 JSON 加载玩家数据
   * 委托给 Player.loadFromSaveData()
   *
   * C# Reference: Character.Load() 会加载 LevelIni 配置
   * 这里需要异步加载等级配置文件（难度设置）
   */
  private async loadPlayerFromJSON(data: PlayerSaveData, player: Player): Promise<void> {
    player.loadFromSaveData(data);

    // 加载等级配置文件（如果存档中有保存）
    // C# Reference: case "LevelIni": -> Utils.GetLevelLists(@"ini\level\" + keyData.Value)
    if (data.levelIniFile) {
      logger.debug(`[Loader] Loading player level config: ${data.levelIniFile}`);
      await player.levelManager.setLevelFile(data.levelIniFile);
    }
  }

  /**
   * 从 JSON 加载武功列表
   * 参考 C# MagicListManager.LoadList
   */
  private async loadMagicsFromJSON(
    magics: MagicItemData[],
    xiuLianIndex: number,
    magicListManager: MagicListManager
  ): Promise<void> {
    // 清空列表
    magicListManager.renewList();

    // 串行加载武功到指定位置
    for (const item of magics) {
      // 使用保存的索引位置，如果没有则自动分配
      const targetIndex = item.index ?? -1;

      if (targetIndex > 0) {
        // 直接加载到指定位置
        const [success] = await magicListManager.addMagicToListAtIndex(
          item.fileName,
          targetIndex,
          item.level,
          item.exp
        );
        if (!success) {
          logger.warn(`[Loader] Failed to load magic ${item.fileName} at index ${targetIndex}`);
        }
      } else {
        // 旧存档兼容：自动分配位置
        const [success, index] = await magicListManager.addMagicByFileName(item.fileName);
        if (success && index !== -1) {
          const info = magicListManager.getItemInfo(index);
          if (info) {
            info.level = item.level;
            info.exp = item.exp;
          }
        }
      }
    }

    // 设置修炼武功
    magicListManager.setXiuLianIndex(xiuLianIndex);
  }

  /**
   * 从 JSON 加载物品列表
   */
  private async loadGoodsFromJSON(
    goods: GoodsItemData[],
    equips: (GoodsItemData | null)[],
    goodsListManager: GoodsListManager
  ): Promise<void> {
    // 清空列表
    goodsListManager.renewList();

    // 加载背包物品
    for (const item of goods) {
      await goodsListManager.addGoodToListWithCount(item.fileName, item.count);
    }

    // 加载装备
    for (let i = 0; i < equips.length; i++) {
      const equipItem = equips[i];
      if (equipItem) {
        const slotIndex = 201 + i;
        await goodsListManager.setItemAtIndex(slotIndex, equipItem.fileName, 1);
      }
    }
  }

  /**
   * 从 JSON 加载陷阱数据
   * 使用 MapBase 的方法
   *
   * 注意：恢复两部分数据：
   * 1. mapTraps - 动态陷阱配置（通过 SetMapTrap 添加的）
   * 2. ignoreList - 已触发（被忽略）的陷阱索引列表
   * 陷阱基础配置应该在此之前通过 LoadTrap() 从 Traps.ini 加载
   */
  private loadTrapsFromJSON(trapsData: TrapData): void {
    // 传递完整的 TrapData（包含 ignoreList 和 mapTraps）
    MapBase.LoadTrapsFromSave(trapsData.mapTraps, trapsData.ignoreList);
  }

  /**
   * 从 JSON 存档数据创建所有 NPC
   *
   * 工作流程（参考 C# NpcManager.Load）：
   * 1. 调用前已清空 npcManager
   * 2. 遍历存档数据，为每个 NPC 创建实例
   * 3. 加载对应的资源（npcres -> asf）
   *
   * 注意：C# 版本存档时会把完整 NPC 数据写到 save/game/xxx.npc 文件
   * Web 版本则直接从 JSON 恢复
   */
  private async loadNpcsFromJSON(npcs: NpcSaveItem[], npcManager: NpcManager): Promise<void> {
    let loadedCount = 0;

    for (const npcData of npcs) {
      // 跳过已死亡的 NPC（如果 isDeathInvoked 为 true）
      if (npcData.isDeath && npcData.isDeathInvoked) {
        logger.log(`[Loader] Skipping dead NPC: ${npcData.name}`);
        continue;
      }

      try {
        // 使用 NpcManager 的统一方法从存档数据创建 NPC
        await npcManager.createNpcFromData(npcData);
        loadedCount++;
      } catch (error) {
        logger.error(`[Loader] Failed to create NPC ${npcData.name}:`, error);
      }
    }

    logger.debug(`[Loader] Created ${loadedCount} NPCs from JSON save data`);
  }

  /**
   * 从 JSON 存档数据创建所有 Obj
   *
   * 工作流程（参考 C# ObjManager.Load）：
   * 1. 调用前已清空 objManager
   * 2. 遍历存档数据，为每个 Obj 创建实例
   * 3. 加载对应的资源（objres -> asf）
   *
   * 注意：C# 版本存档时会把完整 Obj 数据写到 save/game/xxx.obj 文件
   * Web 版本则直接从 JSON 恢复
   */
  private async loadObjsFromJSON(objs: ObjSaveItem[], objManager: ObjManager): Promise<void> {
    let loadedCount = 0;

    for (const objData of objs) {
      // 跳过已移除的物体
      if (objData.isRemoved) {
        logger.log(`[Loader] Skipping removed Obj: ${objData.objName}`);
        continue;
      }

      try {
        // 使用 ObjManager 的方法从 objres 文件创建 Obj
        await objManager.createObjFromSaveData(objData);
        loadedCount++;
      } catch (error) {
        logger.error(`[Loader] Failed to create Obj ${objData.objName}:`, error);
      }
    }

    logger.debug(`[Loader] Created ${loadedCount} Objs from JSON save data`);
  }
}
