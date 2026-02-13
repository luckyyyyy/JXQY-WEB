/**
 * Storage - 存档数据结构和 localStorage 操作
 *
 * 参考实现：
 * - JxqyHD/Engine/Storage/StorageBase.cs
 * - JxqyHD/Engine/Storage/Saver.cs
 * - JxqyHD/Engine/Storage/Loader.cs
 *
 * Web 版使用 JSON 格式存储在 localStorage 中
 */

import { logger } from "../core/logger";

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
 * 参考Character.Save() 和 Player.Save()
 * 完整对应所有存档字段
 */
/**
 * 角色存档基础数据 - Player 和 NPC 共享的字段
 * 单一类型定义，消除 PlayerSaveData 与 NpcSaveItem 的字段重复
 */
export interface CharacterSaveBase {
  // === 基本信息 ===
  name: string;
  npcIni: string;
  kind: number;
  relation: number;
  pathFinder: number;
  state: number;

  // === 位置 ===
  mapX: number;
  mapY: number;
  dir: number;

  // === 视野/交互范围 ===
  visionRadius: number;
  dialogRadius: number;
  attackRadius: number;

  // === 属性 ===
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
  action: number;
  walkSpeed: number;
  addMoveSpeedPercent: number;
  expBonus: number;
  canLevelUp: number;

  // === 位置相关 ===
  fixedPos: string;
  currentFixedPosIndex: number;
  destinationMapPosX: number;
  destinationMapPosY: number;

  // === AI/行为 ===
  idle: number;
  group: number;
  noAutoAttackPlayer: number;
  invincible: number;

  // === 状态效果 ===
  poisonSeconds: number;
  poisonByCharacterName: string;
  petrifiedSeconds: number;
  frozenSeconds: number;
  isPoisonVisualEffect: boolean;
  isPetrifiedVisualEffect: boolean;
  isFrozenVisualEffect: boolean;

  // === 死亡/复活 ===
  isDeath: boolean;
  isDeathInvoked: boolean;
  reviveMilliseconds: number;
  leftMillisecondsToRevive: number;

  // === INI 文件 ===
  bodyIni?: string;
  flyIni?: string;
  flyIni2?: string;
  flyInis?: string;
  isBodyIniAdded: number;

  // === 脚本相关 ===
  scriptFile?: string;
  scriptFileRight?: string;
  deathScript?: string;
  timerScriptFile?: string;
  timerScriptInterval: number;

  // === 技能相关 ===
  magicToUseWhenLifeLow?: string;
  lifeLowPercent: number;
  keepRadiusWhenLifeLow: number;
  keepRadiusWhenFriendDeath: number;
  magicToUseWhenBeAttacked?: string;
  magicDirectionWhenBeAttacked: number;
  magicToUseWhenDeath?: string;
  magicDirectionWhenDeath: number;

  // === 商店/可见性 ===
  buyIniFile?: string;
  buyIniString?: string;
  visibleVariableName?: string;
  visibleVariableValue: number;

  // === 掉落 ===
  dropIni?: string;

  // === 装备 ===
  canEquip: number;
  headEquip?: string;
  neckEquip?: string;
  bodyEquip?: string;
  backEquip?: string;
  handEquip?: string;
  wristEquip?: string;
  footEquip?: string;
  backgroundTextureEquip?: string;

  // === 保持攻击位置 ===
  keepAttackX: number;
  keepAttackY: number;

  // === 伤害玩家 ===
  hurtPlayerInterval: number;
  hurtPlayerLife: number;
  hurtPlayerRadius: number;

  // === 等级配置文件 ===
  levelIniFile?: string;
}

/** Player 存档数据 = 共享基础 + Player 特有字段 */
export interface PlayerSaveData extends CharacterSaveBase {
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
}

/**
 * 物品数据 (对应 Goods.ini)
 */
export interface GoodsItemData {
  /** 物品文件名 */
  fileName: string;
  /** 数量 */
  count: number;
  /** 物品索引 (可选，用于快捷栏物品 221-223) */
  index?: number;
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
  /**
   * 隐藏计数（装备关联武功的引用计数）
   * 参考 C# MagicListManager.MagicItemInfo.HideCount
   * 默认为 1（可见），脱装备 -1，穿装备 +1，= 0 时移入隐藏列表
   */
  hideCount?: number;
  /**
   * 隐藏前的列表原始索引
   * 参考 C# MagicListManager.MagicItemInfo.LastIndexWhenHide
   * 用于显示时恢复到原来的位置
   */
  lastIndexWhenHide?: number;
  /**
   * 是否在隐藏列表中
   * 对应 C# HideStartIndex(1000+) 的武功
   */
  isHidden?: boolean;
}

/**
 * 备忘录数据 (对应 memo.ini)
 */
export interface MemoData {
  items: string[];
}

/**
 * 并行脚本项
 * 参考ScriptManager.ParallelScriptItem
 */
export interface ParallelScriptItem {
  /** 脚本文件路径 */
  filePath: string;
  /** 等待毫秒数 */
  waitMilliseconds: number;
}

/**
 * 陷阱分组数据的值类型
 * 地图名 -> { trapIndex -> scriptFile }
 * 通过 SetMapTrap 命令添加/修改的陷阱会覆盖 Traps.ini 中的配置
 */
export type TrapGroupValue = Record<number, string>;

/**
 * NPC 保存数据 ()
 * 参考 JxqyHD/Engine/Character.cs 的 Save 方法
 * 完整对应所有存档字段
 */
/** NPC 存档数据 = 共享基础 + NPC 特有字段 */
export interface NpcSaveItem extends CharacterSaveBase {
  /** script-controlled hiding (IsVisible is computed, not saved) */
  isHide: boolean;
  isAIDisabled: boolean;
  actionPathTilePositions?: Array<{ x: number; y: number }>;
}

/**
 * 物体保存数据 ()
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
 * 多角色存档数据
 * 保存非当前角色的数据（在 PlayerChange 切换过的角色）
 */
export interface CharacterSaveSlot {
  /** 玩家数据 */
  player: PlayerSaveData | null;
  /** 武功列表 */
  magics: MagicItemData[] | null;
  /** 修炼武功索引 */
  xiuLianIndex: number;
  /** 替换武功列表 */
  replaceMagicLists?: unknown;
  /** 物品列表 */
  goods: GoodsItemData[] | null;
  /** 装备列表 */
  equips: (GoodsItemData | null)[] | null;
  /** 备忘录 */
  memo: string[] | null;
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
  /** 并行脚本列表 */
  parallelScripts: ParallelScriptItem[];
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
  /** 替换武功列表 (角色变身时的临时武功) */
  replaceMagicLists?: object;
  /** 备忘录 */
  memo: MemoData;
  /** 快照 - 存档瞬间各实体的当前状态 */
  snapshot: SaveSnapshot;
  /** 分组 - 脚本 SaveNpc/SaveObj/SetMapTrap 按 key 缓存的数据 */
  groups: SaveGroups;
  /** 截图预览 (base64) */
  screenshot?: string;
  /**
   * 多角色存档数据 (可选，兼容旧存档)
   * key: playerIndex (0-4)
   * 保存在 PlayerChange 切换过程中保存到内存的角色数据
   */
  otherCharacters?: Record<number, CharacterSaveSlot>;
}

/** 快照 - 存档瞬间各实体的当前状态 */
export interface SaveSnapshot {
  /** 当前地图上活跃的 NPC（不含伙伴） */
  npc: NpcSaveItem[];
  /** 当前跟随的伙伴 */
  partner: NpcSaveItem[];
  /** 当前地图上的物体 */
  obj: ObjSaveItem[];
  /** 已触发（被忽略）的陷阱索引列表 */
  trap: number[];
}

/** 分组 - 脚本按 key 缓存的中间数据 */
export interface SaveGroups {
  /** SaveNpc() 按文件名存储 (如 "map033.npc" → NPC[]) */
  npc?: Record<string, NpcSaveItem[]>;
  /** SaveObj() 按文件名存储 (如 "map033_obj.obj" → Obj[]) */
  obj?: Record<string, ObjSaveItem[]>;
  /** SetMapTrap() 按地图名存储 (如 "m01" → { index → script }) */
  trap?: Record<string, TrapGroupValue>;
}

// ============= 常量 =============

/** 存档版本号 */
export const SAVE_VERSION = 2;

/** 截图宽高 */
const SCREENSHOT_WIDTH = 320;
const SCREENSHOT_HEIGHT = 240;

// ============= 工具函数 =============

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

/** 从 canvas 生成截图 */
export function captureScreenshot(canvas: HTMLCanvasElement): string | undefined {
  try {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = SCREENSHOT_WIDTH;
    tempCanvas.height = SCREENSHOT_HEIGHT;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return undefined;

    ctx.drawImage(canvas, 0, 0, SCREENSHOT_WIDTH, SCREENSHOT_HEIGHT);
    return tempCanvas.toDataURL("image/jpeg", 0.7);
  } catch (error) {
    logger.error("[Storage] Error capturing screenshot:", error);
    return undefined;
  }
}
