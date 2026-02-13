/**
 * 玩家角色类型定义
 * 用于前后端共享的 Zod Schema
 *
 * 玩家角色来自 save/game/PlayerX.ini，包括主角和队伍中的同伴
 * 字段对应 Player.ini 的 [Init] section
 */
import { z } from "zod";

// ========== 初始武功/物品 Schema ==========

/** 玩家初始武功条目（对应 MagicX.ini 的每项） */
export const PlayerInitialMagicSchema = z.object({
  /** 武功配置文件名（key） */
  iniFile: z.string(),
  /** 武功等级 */
  level: z.number().int().min(1).default(1),
  /** 武功经验 */
  exp: z.number().int().min(0).default(0),
});
export type PlayerInitialMagic = z.infer<typeof PlayerInitialMagicSchema>;

/** 玩家初始物品条目（对应 GoodsX.ini 的每项） */
export const PlayerInitialGoodsSchema = z.object({
  /** 物品配置文件名（key） */
  iniFile: z.string(),
  /** 物品数量 */
  number: z.number().int().min(1).default(1),
});
export type PlayerInitialGoods = z.infer<typeof PlayerInitialGoodsSchema>;

// ========== Player Schema ==========

/**
 * 玩家角色基础 Schema（不含 DB 字段）
 * 对应 PlayerX.ini 的 [Init] section 所有字段
 * 以及 MagicX.ini / GoodsX.ini 的初始武功/物品列表
 */
export const PlayerBaseSchema = z.object({
  /** 角色索引（Player0 = 0 即主角，Player1 = 1 即伙伴） */
  index: z.number().int().min(0).default(0),
  /** 角色名称 */
  name: z.string().default(""),
  /** 角色类型（Kind 字段，2=玩家角色） */
  kind: z.number().int().default(2),
  /** NPC 外观配置文件（npcres 文件名） */
  npcIni: z.string().default(""),
  /** 朝向 0-7 */
  dir: z.number().int().min(0).max(7).default(0),
  /** 地图 X 坐标 */
  mapX: z.number().int().default(0),
  /** 地图 Y 坐标 */
  mapY: z.number().int().default(0),
  /** 当前动作 */
  action: z.number().int().default(0),
  /** 行走速度 */
  walkSpeed: z.number().int().default(1),
  /** 是否启用寻路 */
  pathFinder: z.number().int().default(1),
  /** 对话范围 */
  dialogRadius: z.number().int().default(1),
  /** 脚本文件 */
  scriptFile: z.string().default(""),
  /** 视野范围 */
  visionRadius: z.number().int().default(10),
  /** 当前行为 */
  doing: z.number().int().default(0),
  /** 目标 X 坐标 */
  desX: z.number().int().default(0),
  /** 目标 Y 坐标 */
  desY: z.number().int().default(0),
  /** 状态 */
  state: z.number().int().default(0),
  /** 与玩家关系（0=友好） */
  relation: z.number().int().default(0),

  // ===== 属性值 =====
  /** 当前生命值 */
  life: z.number().int().default(100),
  /** 最大生命值 */
  lifeMax: z.number().int().default(100),
  /** 当前体力 */
  thew: z.number().int().default(100),
  /** 最大体力 */
  thewMax: z.number().int().default(100),
  /** 当前内力 */
  mana: z.number().int().default(50),
  /** 最大内力 */
  manaMax: z.number().int().default(50),
  /** 攻击力 */
  attack: z.number().int().default(10),
  /** 防御力 */
  defend: z.number().int().default(5),
  /** 闪避 */
  evade: z.number().int().default(5),
  /** 当前经验 */
  exp: z.number().int().default(0),
  /** 经验加成 */
  expBonus: z.number().int().default(0),
  /** 归属 */
  belong: z.number().int().default(0),
  /** 空闲时间 */
  idle: z.number().int().default(30),
  /** 升级所需经验 */
  levelUpExp: z.number().int().default(100),
  /** 等级 */
  level: z.number().int().default(1),
  /** 攻击等级 */
  attackLevel: z.number().int().default(1),
  /** 亮度 */
  lum: z.number().int().default(0),
  /** 攻击范围 */
  attackRadius: z.number().int().default(1),

  // ===== 关联文件 =====
  /** 尸体精灵配置文件 */
  bodyIni: z.string().default(""),
  /** 飞行武器配置文件（武功 ini） */
  flyIni: z.string().default(""),
  /** 死亡触发脚本 */
  deathScript: z.string().default(""),
  /** 飞行武器2 */
  flyIni2: z.string().default(""),
  /** 是否在战斗中 */
  fight: z.number().int().default(0),
  /** 时间限制 */
  timeLimit: z.number().int().default(0),
  /** 时间触发器 */
  timeTrigger: z.number().int().default(0),
  /** 时间计数 */
  timeCount: z.number().int().default(0),
  /** 金钱 */
  money: z.number().int().default(0),
  /** 武功数量 */
  magic: z.number().int().default(0),
  /** 内力上限 */
  manaLimit: z.number().int().default(0),
  /** 等级配置文件 */
  levelIni: z.string().default(""),
  /** 时间脚本 */
  timeScript: z.string().default(""),
  /** 第二攻击 */
  secondAttack: z.string().default(""),

  // ===== 初始武功/物品列表 =====
  /** 初始武功列表（对应 MagicX.ini） */
  initialMagics: z.array(PlayerInitialMagicSchema).default([]),
  /** 初始物品列表（对应 GoodsX.ini） */
  initialGoods: z.array(PlayerInitialGoodsSchema).default([]),
});

export type PlayerBase = z.infer<typeof PlayerBaseSchema>;

/**
 * 完整的玩家角色 Schema（含 DB 字段）
 */
export const PlayerSchema = PlayerBaseSchema.extend({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  key: z.string(), // PlayerX.ini 文件名
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Player = z.infer<typeof PlayerSchema>;

/**
 * 列表项 Schema（简化版，用于侧边栏）
 */
export const PlayerListItemSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  index: z.number().int(),
  level: z.number().int(),
  npcIni: z.string(),
  updatedAt: z.string(),
});

export type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

// ========== API 输入 Schema ==========

export const ListPlayerInputSchema = z.object({
  gameId: z.string().uuid(),
});
export type ListPlayerInput = z.infer<typeof ListPlayerInputSchema>;

export const GetPlayerInputSchema = z.object({
  gameId: z.string().uuid(),
  id: z.string().uuid(),
});
export type GetPlayerInput = z.infer<typeof GetPlayerInputSchema>;

export const CreatePlayerInputSchema = PlayerBaseSchema.extend({
  gameId: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  // 覆盖 index：去掉 default(0)，让未提供时为 undefined 触发服务端自增
  index: z.number().int().min(0).optional(),
}).partial().required({ gameId: true, key: true, name: true });
export type CreatePlayerInput = z.infer<typeof CreatePlayerInputSchema>;

export const UpdatePlayerInputSchema = PlayerBaseSchema.partial().extend({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  key: z.string().optional(),
});
export type UpdatePlayerInput = z.infer<typeof UpdatePlayerInputSchema>;

export const DeletePlayerInputSchema = z.object({
  gameId: z.string().uuid(),
  id: z.string().uuid(),
});
export type DeletePlayerInput = z.infer<typeof DeletePlayerInputSchema>;

export const ImportPlayerInputSchema = z.object({
  gameId: z.string().uuid(),
  fileName: z.string(),
  iniContent: z.string(),
});
export type ImportPlayerInput = z.infer<typeof ImportPlayerInputSchema>;

export const BatchImportPlayerItemSchema = z.object({
  fileName: z.string(),
  iniContent: z.string(),
});

export const BatchImportPlayerInputSchema = z.object({
  gameId: z.string().uuid(),
  items: z.array(BatchImportPlayerItemSchema),
});
export type BatchImportPlayerInput = z.infer<typeof BatchImportPlayerInputSchema>;

export const BatchImportPlayerResultSchema = z.object({
  success: z.array(z.object({
    fileName: z.string(),
    id: z.string(),
    name: z.string(),
    index: z.number().int(),
  })),
  failed: z.array(z.object({
    fileName: z.string(),
    error: z.string(),
  })),
});
export type BatchImportPlayerResult = z.infer<typeof BatchImportPlayerResultSchema>;

// ========== 默认值工厂 ==========

/**
 * 创建默认的玩家角色
 */
export function createDefaultPlayer(gameId: string, key: string): Player {
  return {
    id: "",
    gameId,
    key,
    index: 0,
    name: "",
    kind: 2,
    npcIni: "",
    dir: 0,
    mapX: 0,
    mapY: 0,
    action: 0,
    walkSpeed: 1,
    pathFinder: 1,
    dialogRadius: 1,
    scriptFile: "",
    visionRadius: 10,
    doing: 0,
    desX: 0,
    desY: 0,
    state: 0,
    relation: 0,
    life: 100,
    lifeMax: 100,
    thew: 100,
    thewMax: 100,
    mana: 50,
    manaMax: 50,
    attack: 10,
    defend: 5,
    evade: 5,
    exp: 0,
    expBonus: 0,
    belong: 0,
    idle: 30,
    levelUpExp: 100,
    level: 1,
    attackLevel: 1,
    lum: 0,
    attackRadius: 1,
    bodyIni: "",
    flyIni: "",
    deathScript: "",
    flyIni2: "",
    fight: 0,
    timeLimit: 0,
    timeTrigger: 0,
    timeCount: 0,
    money: 0,
    magic: 0,
    manaLimit: 0,
    levelIni: "",
    timeScript: "",
    secondAttack: "",
    initialMagics: [],
    initialGoods: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
