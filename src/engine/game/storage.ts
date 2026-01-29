/**
 * Storage - 存档数据结构和 localStorage 操作
 *
 * 参考 C# 实现：
 * - JxqyHD/Engine/Storage/StorageBase.cs
 * - JxqyHD/Engine/Storage/Saver.cs
 * - JxqyHD/Engine/Storage/Loader.cs
 *
 * Web 版使用 JSON 格式存储在 localStorage 中
 */

// ============= 存档数据结构 =============

/**
 * 游戏状态数据 (对应 Game.ini [State] section)
 */
export interface GameStateData {
  /** 地图名称 */
  map: string;
  /** NPC 文件名 */
  npc: string;
  /** 物体文件名 */
  obj: string;
  /** 背景音乐 */
  bgm: string;
  /** 玩家角色索引 (支持多主角) */
  chr: number;
  /** 存档时间 */
  time: string;
  /** 是否显示地图坐标 */
  scriptShowMapPos: boolean;
}

/**
 * 游戏选项数据 (对应 Game.ini [Option] section)
 */
export interface GameOptionData {
  /** 地图时间 */
  mapTime: number;
  /** 是否下雪 */
  snowShow: boolean;
  /** 下雨文件 */
  rainFile: string;
  /** 水波效果 */
  water: boolean;
  /** 地图绘制颜色 (hex) */
  mpcStyle: string;
  /** 精灵绘制颜色 (hex) */
  asfStyle: string;
  /** 是否禁用存档 */
  saveDisabled: boolean;
  /** 是否禁用击败敌人掉落物品 */
  isDropGoodWhenDefeatEnemyDisabled: boolean;
}

/**
 * 计时器数据 (对应 Game.ini [Timer] section)
 */
export interface TimerData {
  isOn: boolean;
  totalSecond: number;
  isTimerWindowShow: boolean;
  isScriptSet: boolean;
  timerScript: string;
  triggerTime: number;
}

/**
 * 玩家数据 (对应 Player.ini)
 * 参考 C# Character.Save() 和 Player.Save()
 */
export interface PlayerSaveData {
  // 基本信息
  name: string;
  npcIni: string;
  kind: number;
  relation: number;
  pathFinder: number;
  state: number;

  // 位置
  mapX: number;
  mapY: number;
  dir: number;

  // 视野/交互范围
  visionRadius: number;
  dialogRadius: number;
  attackRadius: number;

  // 属性
  level: number;
  exp: number;
  levelUpExp: number;
  life: number;
  lifeMax: number;
  thew: number;
  thewMax: number;
  mana: number;
  manaMax: number;
  attack: number;
  attack2: number;
  attack3: number;
  attackLevel: number;
  defend: number;
  defend2: number;
  defend3: number;
  evade: number;
  lum: number;
  walkSpeed: number;
  addMoveSpeedPercent: number;

  // Player 特有
  money: number;
  currentUseMagicIndex: number;
  manaLimit: boolean;
  isRunDisabled: boolean;
  isJumpDisabled: boolean;
  isFightDisabled: boolean;
  walkIsRun: number;
  addLifeRestorePercent: number;
  addManaRestorePercent: number;
  addThewRestorePercent: number;

  // TODO: 其他属性
  // expBonus, fixedPos, idle, bodyIni, flyIni, flyIni2
  // scriptFile, scriptFileRight, deathScript, timerScriptFile
}

/**
 * 物品数据 (对应 Goods.ini)
 */
export interface GoodsItemData {
  /** 物品文件名 */
  fileName: string;
  /** 数量 */
  count: number;
}

/**
 * 武功数据 (对应 Magic.ini)
 */
export interface MagicItemData {
  /** 武功文件名 */
  fileName: string;
  /** 等级 */
  level: number;
  /** 经验值 */
  exp: number;
  /** 列表索引 (1-36 存储区, 40-44 快捷栏, 49 修炼) */
  index: number;
}

/**
 * 备忘录数据 (对应 memo.ini)
 */
export interface MemoData {
  items: string[];
}

/**
 * 陷阱数据 (对应 C# TrapIndexIgnore.ini)
 * 注意：陷阱配置（地图+index -> 脚本）从 Traps.ini 资源文件读取，不需要存档
 * 只需要存储已触发的陷阱索引列表
 */
export interface TrapData {
  /** 已触发（被忽略）的陷阱索引列表 */
  ignoreList: number[];
}

/**
 * NPC 保存数据 (对应 C# Character.Save)
 * 参考 JxqyHD/Engine/Character.cs 的 Save 方法
 */
export interface NpcSaveItem {
  // 基本信息
  name: string;
  kind: number;
  relation: number;
  pathFinder: number;
  state: number;  // C#: _state - 角色状态 (Stand, Walk, etc.)
  action: number; // C#: _action - 行为类型 (Stand=0, RandWalk=1, LoopWalk=2)
  group: number;
  npcIni: string;

  // 位置
  mapX: number;
  mapY: number;
  dir: number;

  // 范围
  visionRadius: number;
  dialogRadius: number;
  attackRadius: number;

  // 属性
  level: number;
  exp: number;
  levelUpExp: number;
  life: number;
  lifeMax: number;
  thew: number;
  thewMax: number;
  mana: number;
  manaMax: number;
  attack: number;
  attack2: number;
  attackLevel: number;
  defend: number;
  defend2: number;
  evade: number;
  lum: number;
  walkSpeed: number;
  addMoveSpeedPercent: number;

  // 脚本
  scriptFile?: string;
  scriptFileRight?: string;
  deathScript?: string;
  timerScriptFile?: string;
  timerScriptInterval?: number;

  // 其他配置
  flyIni?: string;
  flyIni2?: string;
  flyInis?: string;  // C#: FlyInis - 多法术距离配置
  bodyIni?: string;
  dropIni?: string;
  buyIniFile?: string;
  noAutoAttackPlayer: number;
  idle?: number;  // C#: Idle - 攻击间隔帧数
  invincible: number;

  // 状态
  isVisible: boolean;
  isDeath: boolean;
  isDeathInvoked: boolean;
  isAIDisabled: boolean;

  // 复活
  reviveMilliseconds: number;
  leftMillisecondsToRevive: number;

  // 巡逻路径
  actionPathTilePositions?: Array<{ x: number; y: number }>;
}

/**
 * NPC 数据
 */
export interface NpcSaveData {
  npcs: NpcSaveItem[];
}

/**
 * 物体保存数据 (对应 C# Obj.Save)
 * 参考 JxqyHD/Engine/Obj.cs 的 Save 方法
 */
export interface ObjSaveItem {
  // 基本信息
  objName: string;
  kind: number;
  dir: number;

  // 位置
  mapX: number;
  mapY: number;

  // 属性
  damage: number;
  frame: number;
  height: number;
  lum: number;
  objFile: string;
  offX: number;
  offY: number;

  // 脚本
  scriptFile?: string;
  scriptFileRight?: string;
  timerScriptFile?: string;
  timerScriptInterval?: number;
  scriptFileJustTouch: number;

  // 其他
  wavFile?: string;
  millisecondsToRemove: number;
  isRemoved: boolean;
}

/**
 * 物体数据
 */
export interface ObjSaveData {
  objs: ObjSaveItem[];
}

/**
 * 完整存档数据
 */
export interface SaveData {
  /** 存档版本号 */
  version: number;
  /** 存档时间戳 */
  timestamp: number;
  /** 游戏状态 */
  state: GameStateData;
  /** 游戏选项 */
  option: GameOptionData;
  /** 计时器 */
  timer: TimerData;
  /** 脚本变量 */
  variables: Record<string, number>;
  /** 并行脚本 */
  parallelScripts: string[];
  /** 玩家数据 */
  player: PlayerSaveData;
  /** 物品列表 */
  goods: GoodsItemData[];
  /** 装备列表 (索引对应装备槽位) */
  equips: (GoodsItemData | null)[];
  /** 武功列表 */
  magics: MagicItemData[];
  /** 修炼武功索引 */
  xiuLianIndex: number;
  /** 备忘录 */
  memo: MemoData;
  /** 陷阱 */
  traps: TrapData;
  /** NPC 数据 */
  npcData: NpcSaveData;
  /** 物体数据 */
  objData: ObjSaveData;
  /** 截图预览 (base64) */
  screenshot?: string;
}

/**
 * 存档槽位信息 (用于显示存档列表)
 */
export interface SaveSlotInfo {
  /** 槽位索引 (1-7) */
  index: number;
  /** 是否有存档 */
  exists: boolean;
  /** 存档时间 */
  time?: string;
  /** 地图名称 */
  mapName?: string;
  /** 玩家等级 */
  level?: number;
  /** 截图预览 (base64) */
  screenshot?: string;
}

// ============= 常量 =============

/** 存档版本号 */
export const SAVE_VERSION = 1;

/** 存档索引范围 */
export const SAVE_INDEX_BEGIN = 1;
export const SAVE_INDEX_END = 7;

/** localStorage key 前缀 */
export const STORAGE_KEY_PREFIX = "jxqy_save_";

/** 截图宽高 */
export const SCREENSHOT_WIDTH = 320;
export const SCREENSHOT_HEIGHT = 240;

// ============= 工具函数 =============

/**
 * 获取存档的 localStorage key
 */
export function getSaveKey(index: number): string {
  return `${STORAGE_KEY_PREFIX}${index}`;
}

/**
 * 检查索引是否有效
 */
export function isIndexInRange(index: number): boolean {
  return index >= SAVE_INDEX_BEGIN && index <= SAVE_INDEX_END;
}

/**
 * 格式化当前时间为存档时间字符串
 */
export function formatSaveTime(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}年${month}月${day}日 ${hour}时${minute}分${second}秒`;
}

// ============= Storage Manager =============

/**
 * Storage Manager - 存档管理器
 * 处理 localStorage 读写操作
 */
export class StorageManager {
  /**
   * 检查是否可以加载存档
   */
  static canLoad(index: number): boolean {
    if (!isIndexInRange(index)) return false;
    const key = getSaveKey(index);
    return localStorage.getItem(key) !== null;
  }

  /**
   * 获取所有存档槽位信息
   */
  static getSaveSlots(): SaveSlotInfo[] {
    const slots: SaveSlotInfo[] = [];

    for (let i = SAVE_INDEX_BEGIN; i <= SAVE_INDEX_END; i++) {
      const slot: SaveSlotInfo = {
        index: i,
        exists: false,
      };

      try {
        const key = getSaveKey(i);
        const data = localStorage.getItem(key);
        if (data) {
          const saveData = JSON.parse(data) as SaveData;
          slot.exists = true;
          slot.time = saveData.state.time;
          slot.mapName = saveData.state.map;
          slot.level = saveData.player.level;
          slot.screenshot = saveData.screenshot;
        }
      } catch (error) {
        console.warn(`[Storage] Error reading save slot ${i}:`, error);
      }

      slots.push(slot);
    }

    return slots;
  }

  /**
   * 保存游戏到指定槽位
   */
  static saveGame(index: number, data: SaveData): boolean {
    if (!isIndexInRange(index)) {
      console.error(`[Storage] Invalid save index: ${index}`);
      return false;
    }

    try {
      const key = getSaveKey(index);
      const json = JSON.stringify(data);
      localStorage.setItem(key, json);
      console.log(`[Storage] Game saved to slot ${index}`);
      return true;
    } catch (error) {
      console.error(`[Storage] Error saving game to slot ${index}:`, error);
      return false;
    }
  }

  /**
   * 加载指定槽位的存档
   */
  static loadGame(index: number): SaveData | null {
    if (!isIndexInRange(index)) {
      console.error(`[Storage] Invalid load index: ${index}`);
      return null;
    }

    try {
      const key = getSaveKey(index);
      const data = localStorage.getItem(key);
      if (!data) {
        console.warn(`[Storage] No save data found at slot ${index}`);
        return null;
      }

      const saveData = JSON.parse(data) as SaveData;
      console.log(`[Storage] Game loaded from slot ${index}`);
      return saveData;
    } catch (error) {
      console.error(`[Storage] Error loading game from slot ${index}:`, error);
      return null;
    }
  }

  /**
   * 删除指定槽位的存档
   */
  static deleteGame(index: number): boolean {
    if (!isIndexInRange(index)) {
      console.error(`[Storage] Invalid delete index: ${index}`);
      return false;
    }

    try {
      const key = getSaveKey(index);
      localStorage.removeItem(key);
      console.log(`[Storage] Save slot ${index} deleted`);
      return true;
    } catch (error) {
      console.error(`[Storage] Error deleting save slot ${index}:`, error);
      return false;
    }
  }

  /**
   * 删除所有存档
   */
  static deleteAllSaves(): void {
    for (let i = SAVE_INDEX_BEGIN; i <= SAVE_INDEX_END; i++) {
      const key = getSaveKey(i);
      localStorage.removeItem(key);
    }
    console.log(`[Storage] All saves deleted`);
  }

  /**
   * 从 canvas 生成截图
   */
  static captureScreenshot(canvas: HTMLCanvasElement): string | undefined {
    try {
      // 创建临时 canvas 用于缩放
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = SCREENSHOT_WIDTH;
      tempCanvas.height = SCREENSHOT_HEIGHT;
      const ctx = tempCanvas.getContext("2d");
      if (!ctx) return undefined;

      // 绘制缩放后的图像
      ctx.drawImage(canvas, 0, 0, SCREENSHOT_WIDTH, SCREENSHOT_HEIGHT);

      // 转为 base64 (使用 JPEG 减小体积)
      return tempCanvas.toDataURL("image/jpeg", 0.7);
    } catch (error) {
      console.error("[Storage] Error capturing screenshot:", error);
      return undefined;
    }
  }
}
