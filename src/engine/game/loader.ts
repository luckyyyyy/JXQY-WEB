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
import type { Player } from "../character/player";
import { LOADING_STATE } from "../character/character";
import type { NpcManager } from "../character/npcManager";
import type { ObjManager } from "../obj";
import type { AudioManager } from "../audio";
import type { ScreenEffects } from "../effects";
import type { GoodsListManager } from "../goods";
import type { MagicListManager } from "../magic";
import type { MemoListManager } from "../listManager";
import type { ScriptExecutor } from "../script/executor";
import type { MapTrapManager } from "./mapTrapManager";
import type { GuiManager } from "../gui/guiManager";
import {
  type SaveData,
  type PlayerSaveData,
  type GoodsItemData,
  type MagicItemData,
  type NpcSaveItem,
  type ObjSaveItem,
  StorageManager,
  SAVE_VERSION,
  formatSaveTime,
} from "./storage";
import { resourceLoader } from "../resource/resourceLoader";

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
  goodsListManager: GoodsListManager;
  magicListManager: MagicListManager;
  memoListManager: MemoListManager;
  trapManager: MapTrapManager;
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
    console.log("[Loader] Starting new game...");

    const {
      screenEffects,
      getScriptExecutor,
      clearVariables,
      resetEventId,
      resetGameTime,
    } = this.deps;

    // 重置基本状态
    clearVariables();
    resetEventId();
    resetGameTime();

    // 以黑屏开始（用于淡入淡出特效）
    screenEffects.setFadeTransparency(1);

    // 运行 NewGame 脚本
    const scriptExecutor = getScriptExecutor();
    await scriptExecutor.runScript("/resources/script/common/NewGame.txt");

    console.log("[Loader] New game started");
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
      goodsListManager,
      magicListManager,
      memoListManager,
      trapManager,
      loadMap,
      parseIni,
      clearScriptCache,
      clearVariables,
    } = this.deps;

    console.log(`[Loader] Loading game save index: ${index}, isInitializeGame: ${isInitializeGame}`);

    try {
      // Step 1: 清理 managers
      if (isInitializeGame) {
        console.log(`[Loader] Clearing all managers...`);
        clearScriptCache();
        clearVariables();
        npcManager.clearAllNpcs();
        objManager.clearAll();
        audioManager.stopMusic();
      }

      // 确定存档路径
      // index 0 = resources/save/game/Game.ini (初始存档)
      // index 1-7 = resources/save/rpgN/Game.ini (用户存档)
      const basePath = index === 0 ? "/resources/save/game" : `/resources/save/rpg${index}`;

      // Step 2: 加载 Game.ini
      const gameIniPath = `${basePath}/Game.ini`;
      const content = await resourceLoader.loadText(gameIniPath);
      if (!content) {
        console.error(`[Loader] Failed to load Game.ini: ${gameIniPath}`);
        return;
      }

      const sections = parseIni(content);
      const stateSection = sections["State"];

      // 玩家角色索引 - 默认 0
      let chrIndex = 0;

      if (stateSection) {
        // 加载地图
        const mapName = stateSection["Map"];
        if (mapName) {
          console.log(`[Loader] Loading map: ${mapName}`);
          await loadMap(mapName);
        }

        // 加载 NPC
        const npcFile = stateSection["Npc"];
        if (npcFile) {
          console.log(`[Loader] Loading NPC file: ${npcFile}`);
          await npcManager.loadNpcFile(npcFile);
        }

        // 加载物体
        const objFile = stateSection["Obj"];
        if (objFile) {
          console.log(`[Loader] Loading Obj file: ${objFile}`);
          await objManager.load(objFile);
        }

        // 加载背景音乐
        const bgm = stateSection["Bgm"];
        if (bgm) {
          audioManager.playMusic(bgm);
        }

        // 玩家角色索引（支持多主角）
        chrIndex = parseInt(stateSection["Chr"] || "0", 10);
      }

      // Step 3: 加载 Magic、Goods、Memo
      const magicPath = `${basePath}/Magic${chrIndex}.ini`;
      console.log(`[Loader] Loading magic from: ${magicPath}`);
      await magicListManager.loadPlayerList(magicPath);

      const goodsPath = `${basePath}/Goods${chrIndex}.ini`;
      console.log(`[Loader] Loading goods from: ${goodsPath}`);
      await goodsListManager.loadList(goodsPath);

      const memoPath = `${basePath}/memo.ini`;
      console.log(`[Loader] Loading memo from: ${memoPath}`);
      await this.loadMemoList(memoPath, memoListManager, parseIni);

      // Step 4: 加载玩家
      const playerPath = `${basePath}/Player${chrIndex}.ini`;
      console.log(`[Loader] Loading player from: ${playerPath}`);
      await player.loadFromFile(playerPath);

      // 加载玩家精灵
      if (this.deps.loadPlayerSprites) {
        const playerNpcIni = player.npcIni;
        console.log(`[Loader] Loading player sprites: ${playerNpcIni}`);
        await this.deps.loadPlayerSprites(playerNpcIni);
      }

      // 应用装备特效
      goodsListManager.applyEquipSpecialEffectFromList();

      // Step 5: 加载陷阱
      await trapManager.loadTraps(basePath, parseIni);

      console.log(`[Loader] Game save loaded successfully`);

      // Debug: 打印障碍物体
      objManager.debugPrintObstacleObjs();
    } catch (error) {
      console.error(`[Loader] Error loading game save:`, error);
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
        console.warn(`[Loader] No memo file found: ${path}`);
        memoListManager.renewList();
        return;
      }

      const sections = parseIni(content);
      const memoSection = sections["Memo"];

      if (memoSection) {
        memoListManager.loadList(memoSection);
      } else {
        memoListManager.renewList();
      }
    } catch (error) {
      console.warn(`[Loader] Error loading memo list:`, error);
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
    console.log(`[Loader] Saving game to slot ${index}...`);

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
        console.log(`[Loader] Game saved to slot ${index} successfully`);
      }
      return success;
    } catch (error) {
      console.error(`[Loader] Error saving game:`, error);
      return false;
    }
  }

  /**
   * 从 JSON 数据加载存档
   *
   * @param data 存档数据
   */
  async loadGameFromJSON(data: SaveData): Promise<void> {
    console.log(`[Loader] Loading game from JSON...`);

    const {
      player,
      npcManager,
      objManager,
      audioManager,
      screenEffects,
      goodsListManager,
      magicListManager,
      memoListManager,
      trapManager,
      guiManager,
      loadMap,
      clearScriptCache,
      setVariables,
      getScriptExecutor,
    } = this.deps;

    try {
      // Step 1: 停止所有正在运行的脚本 (0-5%)
      // C# Reference: ScriptManager.Clear()
      this.reportProgress(0, "停止脚本...");
      console.log(`[Loader] Stopping all scripts...`);
      const scriptExecutor = getScriptExecutor();
      scriptExecutor.stopAllScripts();

      // Step 2: 重置 UI 状态（关闭对话框、选择框等）(5-10%)
      // C# Reference: GuiManager.EndDialog(), GuiManager.CloseTimeLimit()
      this.reportProgress(5, "重置界面...");
      console.log(`[Loader] Resetting UI state...`);
      guiManager.resetAllUI();

      // Step 3: 清理 (10-15%)
      this.reportProgress(10, "清理数据...");
      console.log(`[Loader] Clearing all managers...`);
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
        console.log(`[Loader] Loading map: ${state.map}`);
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
        console.log(`[Loader] Restoring variables from save:`, Object.keys(data.variables).length, 'keys');
        // 打印一些关键变量用于调试
        const debugVars = ['WuDangShanMenTalk', 'Event'];
        for (const v of debugVars) {
          if (v in data.variables) {
            console.log(`[Loader]   ${v} = ${data.variables[v]}`);
          }
        }
        setVariables(data.variables);
      }

      // Step 6: 加载武功列表 (72-75%)
      this.reportProgress(72, "加载武功...");
      console.log(`[Loader] Loading magics from JSON...`);
      await this.loadMagicsFromJSON(data.magics, data.xiuLianIndex, magicListManager);

      // Step 7: 加载物品列表 (75-78%)
      this.reportProgress(75, "加载物品...");
      console.log(`[Loader] Loading goods from JSON...`);
      await this.loadGoodsFromJSON(data.goods, data.equips, goodsListManager);

      // Step 8: 加载备忘录 (78-80%)
      this.reportProgress(78, "加载备忘...");
      if (data.memo) {
        console.log(`[Loader] Loading memo from JSON...`);
        memoListManager.renewList();
        for (const item of data.memo.items) {
          memoListManager.addItem(item);
        }
      }

      // Step 9: 加载玩家 (80-85%)
      this.reportProgress(80, "加载玩家...");
      console.log(`[Loader] Loading player from JSON...`);
      this.loadPlayerFromJSON(data.player, player);

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
        console.log(`[Loader] Loading player sprites: ${playerNpcIni}`);
        await this.deps.loadPlayerSprites(playerNpcIni);
      }

      // 精灵加载后恢复 state（因为 _state=-1，值不同会触发纹理更新）
      player.state = data.player.state ?? 0;

      // 应用装备特效
      goodsListManager.applyEquipSpecialEffectFromList();

      // Step 10: 加载陷阱 (88-90%)
      this.reportProgress(88, "加载陷阱...");
      if (data.traps) {
        console.log(`[Loader] Loading traps from JSON...`);
        this.loadTrapsFromJSON(data.traps, trapManager);
      }

      // Step 11: 从 JSON 恢复 NPC (90-95%)
      // 清空并从 JSON 存档数据重新创建所有 NPC（而不是从 .npc 文件加载）
      // C# Reference: NpcManager.Load() - clears and creates from save file
      this.reportProgress(90, "加载 NPC...");
      console.log(`[Loader] Loading NPCs from JSON...`);
      npcManager.clearAllNpcs();
      if (data.npcData?.npcs && data.npcData.npcs.length > 0) {
        await this.loadNpcsFromJSON(data.npcData.npcs, npcManager);
      }

      // Step 12: 从 JSON 恢复 Obj (95-98%)
      // 清空并从 JSON 存档数据重新创建所有 Obj（而不是从 .obj 文件加载）
      this.reportProgress(95, "加载物体...");
      console.log(`[Loader] Loading Objs from JSON...`);
      objManager.clearAll();
      if (data.objData?.objs && data.objData.objs.length > 0) {
        await this.loadObjsFromJSON(data.objData.objs, objManager);
      }

      // TODO: 加载计时器状态
      // TODO: 加载并行脚本
      // TODO: 加载选项设置

      // Step 13: 重置屏幕特效并执行淡入 (98-100%)
      this.reportProgress(98, "完成加载...");
      // 加载存档后屏幕应该从黑屏淡入到正常
      console.log(`[Loader] Starting fade in effect...`);
      screenEffects.fadeIn();

      this.reportProgress(100, "加载完成");
      console.log(`[Loader] Game loaded from JSON successfully`);
    } catch (error) {
      console.error(`[Loader] Error loading game from JSON:`, error);
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
    console.log(`[Loader] Loading game from slot ${index}...`);

    const data = StorageManager.loadGame(index);
    if (!data) {
      console.error(`[Loader] No save data found at slot ${index}`);
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
      goodsListManager,
      magicListManager,
      memoListManager,
      trapManager,
      getVariables,
      getCurrentMapName,
    } = this.deps;

    const mapName = getCurrentMapName?.() || "";
    const variables = getVariables?.() || {};

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
        scriptShowMapPos: false, // TODO
      },

      // 选项 (TODO: 实现完整选项)
      option: {
        mapTime: 0, // TODO
        snowShow: false,
        rainFile: "",
        water: false,
        mpcStyle: "FFFFFF",
        asfStyle: "FFFFFF",
        saveDisabled: false,
        isDropGoodWhenDefeatEnemyDisabled: false,
      },

      // 计时器 (TODO)
      timer: {
        isOn: false,
        totalSecond: 0,
        isTimerWindowShow: false,
        isScriptSet: false,
        timerScript: "",
        triggerTime: 0,
      },

      // 脚本变量
      variables: { ...variables },

      // 并行脚本 (TODO)
      parallelScripts: [],

      // 玩家数据
      player: this.collectPlayerData(player),

      // 物品
      goods: this.collectGoodsData(goodsListManager),
      equips: this.collectEquipsData(goodsListManager),

      // 武功
      magics: this.collectMagicsData(magicListManager),
      xiuLianIndex: magicListManager.getXiuLianIndex(),

      // 备忘录
      memo: {
        items: memoListManager.getItems(),
      },

      // 陷阱
      traps: this.collectTrapsData(trapManager),

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
   */
  private collectPlayerData(player: Player): PlayerSaveData {
    return {
      // 基本信息
      name: player.name,
      npcIni: player.npcIni,
      kind: player.kind,
      relation: player.relation,
      pathFinder: player.pathFinder,
      state: player.state,

      // 位置
      mapX: player.mapX,
      mapY: player.mapY,
      dir: player.currentDirection,

      // 范围
      visionRadius: player.visionRadius,
      dialogRadius: player.dialogRadius,
      attackRadius: player.attackRadius,

      // 属性
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
      walkSpeed: player.walkSpeed,
      addMoveSpeedPercent: player.addMoveSpeedPercent,

      // Player 特有
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
      if (info && info.good) {
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
      if (info && info.good) {
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
      if (info && info.magic) {
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
   * 使用 MapTrapManager 的方法
   *
   * 注意：只收集 ignoreList（已触发的陷阱索引）
   * 陷阱配置从 Traps.ini 资源文件读取，不需要存档
   */
  private collectTrapsData(trapManager: MapTrapManager): {
    ignoreList: number[];
  } {
    return trapManager.collectTrapData();
  }

  /**
   * 收集 NPC 数据
   * 参考 C# NpcManager.Save() 和 Character.Save()
   */
  private collectNpcData(npcManager: NpcManager): NpcSaveItem[] {
    const items: NpcSaveItem[] = [];
    const allNpcs = npcManager.getAllNpcs();

    for (const [, npc] of allNpcs) {
      // 跳过被召唤的 NPC（由魔法召唤的）
      // TODO: 如果有 summonedByMagicSprite 属性，跳过

      const item: NpcSaveItem = {
        // 基本信息
        name: npc.name,
        kind: npc.kind,
        relation: npc.relation,
        pathFinder: npc.pathFinder,
        state: npc.state,
        action: npc.actionType, // C#: _action - ActionType (Stand=0, RandWalk=1, LoopWalk=2)
        group: npc.group,
        npcIni: npc.npcIni,

        // 位置
        mapX: npc.mapX,
        mapY: npc.mapY,
        dir: npc.currentDirection,

        // 范围
        visionRadius: npc.visionRadius,
        dialogRadius: npc.dialogRadius,
        attackRadius: npc.attackRadius,

        // 属性
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
        attack2: npc.attack2 ?? 0,
        attackLevel: npc.attackLevel ?? 0,
        defend: npc.defend,
        defend2: npc.defend2 ?? 0,
        evade: npc.evade,
        lum: npc.lum ?? 0,
        walkSpeed: npc.walkSpeed,
        addMoveSpeedPercent: npc.addMoveSpeedPercent ?? 0,

        // 脚本
        scriptFile: npc.scriptFile || undefined,
        scriptFileRight: npc.scriptFileRight || undefined,
        deathScript: npc.deathScript || undefined,
        timerScriptFile: npc.timerScript || undefined,
        timerScriptInterval: npc.timerInterval || undefined,

        // 其他配置
        flyIni: npc.flyIni || undefined,
        flyIni2: npc.flyIni2 || undefined,
        flyInis: npc.flyInis || undefined,  // C#: FlyInis - 多法术距离配置
        bodyIni: npc.bodyIni || undefined,
        dropIni: npc.dropIni || undefined,
        buyIniFile: npc.buyIniFile || undefined,
        noAutoAttackPlayer: npc.noAutoAttackPlayer ?? 0,
        idle: npc.idle,  // C#: Idle - 攻击间隔帧数
        invincible: npc.invincible ?? 0,

        // 状态
        isVisible: npc.isVisible,
        isDeath: npc.isDeath,
        isDeathInvoked: npc.isDeathInvoked,
        isAIDisabled: npc.isAIDisabled,

        // 复活
        reviveMilliseconds: npc.reviveMilliseconds ?? 0,
        leftMillisecondsToRevive: npc.leftMillisecondsToRevive ?? 0,

        // 巡逻路径
        actionPathTilePositions: npc.actionPathTilePositions?.length > 0
          ? npc.actionPathTilePositions.map(p => ({ x: p.x, y: p.y }))
          : undefined,
      };

      items.push(item);
    }

    console.log(`[Loader] Collected ${items.length} NPCs`);
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

    console.log(`[Loader] Collected ${items.length} Objs`);
    return items;
  }

  // ============= 数据加载方法 =============

  /**
   * 从 JSON 加载玩家数据
   * 委托给 Player.loadFromSaveData()
   */
  private loadPlayerFromJSON(data: PlayerSaveData, player: Player): void {
    player.loadFromSaveData(data);
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
          console.warn(`[Loader] Failed to load magic ${item.fileName} at index ${targetIndex}`);
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
   * 使用 MapTrapManager 的方法
   *
   * 注意：只恢复 ignoreList（已触发的陷阱索引）
   * 陷阱配置应该在此之前通过 loadTraps() 从 Traps.ini 加载
   */
  private loadTrapsFromJSON(
    trapsData: { ignoreList?: number[]; traps?: unknown },
    trapManager: MapTrapManager
  ): void {
    // 打印原始数据用于调试
    console.log(`[Loader] loadTrapsFromJSON: raw data =`, JSON.stringify(trapsData));

    // 兼容旧存档格式：如果没有 ignoreList，使用空数组
    const ignoreList = trapsData.ignoreList ?? [];
    console.log(`[Loader] loadTrapsFromJSON: ignoreList = [${ignoreList.join(", ")}]`);

    trapManager.loadFromSaveData({ ignoreList });
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
        console.log(`[Loader] Skipping dead NPC: ${npcData.name}`);
        continue;
      }

      try {
        // 使用 NpcManager 的统一方法从存档数据创建 NPC
        await npcManager.createNpcFromData(npcData);
        loadedCount++;
      } catch (error) {
        console.error(`[Loader] Failed to create NPC ${npcData.name}:`, error);
      }
    }

    console.log(`[Loader] Created ${loadedCount} NPCs from JSON save data`);
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
        console.log(`[Loader] Skipping removed Obj: ${objData.objName}`);
        continue;
      }

      try {
        // 使用 ObjManager 的方法从 objres 文件创建 Obj
        await objManager.createObjFromSaveData(objData);
        loadedCount++;
      } catch (error) {
        console.error(`[Loader] Failed to create Obj ${objData.objName}:`, error);
      }
    }

    console.log(`[Loader] Created ${loadedCount} Objs from JSON save data`);
  }
}