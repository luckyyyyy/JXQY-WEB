/**
 * 等级配置系统类型定义
 * 用于前后端共享的 Zod Schema
 */
import { z } from "zod";

// ========== 等级配置类型枚举 ==========

/**
 * 等级配置类型：玩家/NPC
 */
export const LevelUserTypeEnum = z.enum(["player", "npc"]);
export type LevelUserType = z.infer<typeof LevelUserTypeEnum>;

// ========== 单个等级数据 Schema ==========

/**
 * 单个等级的属性配置
 * 基于 Level-easy.ini 和 level-npc.ini 的格式
 */
export const LevelDetailSchema = z.object({
  /** 等级（1-80） */
  level: z.number().int().min(1),
  /** 升级所需经验 */
  levelUpExp: z.number().int().default(100),
  /** 最大生命值 */
  lifeMax: z.number().int().default(100),
  /** 最大体力值 */
  thewMax: z.number().int().default(100),
  /** 最大法力值 */
  manaMax: z.number().int().default(100),
  /** 攻击力 */
  attack: z.number().int().default(10),
  /** 攻击力2（可选） */
  attack2: z.number().int().optional(),
  /** 攻击力3（可选） */
  attack3: z.number().int().optional(),
  /** 防御力 */
  defend: z.number().int().default(10),
  /** 防御力2（可选） */
  defend2: z.number().int().optional(),
  /** 防御力3（可选） */
  defend3: z.number().int().optional(),
  /** 闪避值 */
  evade: z.number().int().default(0),
  /** 升级时获得的新武功（玩家专用） */
  newMagic: z.string().optional(),
  /** 升级时获得的新物品（玩家专用） */
  newGood: z.string().optional(),
  // NPC 专用字段
  /** 初始经验值（NPC专用） */
  exp: z.number().int().optional(),
  /** 初始生命值（NPC专用） */
  life: z.number().int().optional(),
});

export type LevelDetail = z.infer<typeof LevelDetailSchema>;

// ========== 等级配置表 Schema ==========

/**
 * 完整的等级配置表
 */
export const LevelConfigSchema = z.object({
  /** 唯一ID */
  id: z.string().uuid(),
  /** 所属游戏ID */
  gameId: z.string().uuid(),
  /** 配置唯一标识（如 level-easy, level-hard, level-npc） */
  key: z.string().min(1).max(100),
  /** 配置名称（如 "简单模式", "困难模式", "NPC等级"） */
  name: z.string().min(1).max(100),
  /** 配置类型：玩家/NPC */
  userType: LevelUserTypeEnum,
  /** 最大等级数 */
  maxLevel: z.number().int().min(1).max(100).default(80),
  /** 等级数据（数组形式存储） */
  levels: z.array(LevelDetailSchema),
  /** 创建时间 */
  createdAt: z.string().optional(),
  /** 更新时间 */
  updatedAt: z.string().optional(),
});

export type LevelConfig = z.infer<typeof LevelConfigSchema>;

// ========== 列表项 Schema ==========

export const LevelConfigListItemSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  userType: LevelUserTypeEnum,
  maxLevel: z.number().int(),
  updatedAt: z.string(),
});

export type LevelConfigListItem = z.infer<typeof LevelConfigListItemSchema>;

// ========== 输入 Schema ==========

/**
 * 列出等级配置输入
 */
export const ListLevelConfigInputSchema = z.object({
  gameId: z.string().uuid(),
  userType: LevelUserTypeEnum.optional(),
});

export type ListLevelConfigInput = z.infer<typeof ListLevelConfigInputSchema>;

/**
 * 获取单个等级配置输入
 */
export const GetLevelConfigInputSchema = z.object({
  gameId: z.string().uuid(),
  id: z.string().uuid(),
});

export type GetLevelConfigInput = z.infer<typeof GetLevelConfigInputSchema>;

/**
 * 创建等级配置输入
 */
export const CreateLevelConfigInputSchema = z.object({
  gameId: z.string().uuid(),
  key: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  userType: LevelUserTypeEnum,
  maxLevel: z.number().int().min(1).max(100).default(80),
  levels: z.array(LevelDetailSchema).optional(),
});

export type CreateLevelConfigInput = z.infer<typeof CreateLevelConfigInputSchema>;

/**
 * 更新等级配置输入
 */
export const UpdateLevelConfigInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  key: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(100).optional(),
  userType: LevelUserTypeEnum.optional(),
  maxLevel: z.number().int().min(1).max(100).optional(),
  levels: z.array(LevelDetailSchema).optional(),
});

export type UpdateLevelConfigInput = z.infer<typeof UpdateLevelConfigInputSchema>;

/**
 * 删除等级配置输入
 */
export const DeleteLevelConfigInputSchema = z.object({
  gameId: z.string().uuid(),
  id: z.string().uuid(),
});

export type DeleteLevelConfigInput = z.infer<typeof DeleteLevelConfigInputSchema>;

/**
 * 从 INI 导入等级配置输入
 */
export const ImportLevelConfigInputSchema = z.object({
  gameId: z.string().uuid(),
  fileName: z.string(),
  userType: LevelUserTypeEnum,
  iniContent: z.string(),
});

export type ImportLevelConfigInput = z.infer<typeof ImportLevelConfigInputSchema>;

// ========== 工具函数 ==========

/**
 * 创建默认等级数据（1-80级）
 */
export function createDefaultLevelDetail(level: number, userType: LevelUserType): LevelDetail {
  // 基础成长公式
  const base = {
    lifeMax: 90 + Math.floor(level * level * 0.8 + level * 10),
    thewMax: 80 + Math.floor(level * 8),
    manaMax: 50 + Math.floor(level * 8),
    attack: 100 + Math.floor(level * level * 0.3 + level * 20),
    defend: 50 + Math.floor(level * level * 0.25 + level * 15),
    evade: Math.floor(level * 4),
    levelUpExp: 100 + Math.floor(level * level * 40 + level * 10),
  };

  if (userType === "npc") {
    return {
      level,
      exp: 0,
      life: base.lifeMax + 100, // NPC 有初始 life
      lifeMax: base.lifeMax + 100,
      thewMax: base.thewMax,
      manaMax: base.manaMax,
      attack: base.attack,
      defend: base.defend,
      evade: base.evade,
      levelUpExp: 0, // NPC 不需要升级经验
    };
  }

  return {
    level,
    levelUpExp: base.levelUpExp,
    lifeMax: base.lifeMax,
    thewMax: base.thewMax,
    manaMax: base.manaMax,
    attack: base.attack,
    defend: base.defend,
    evade: base.evade,
    newMagic: "",
    newGood: "",
  };
}

/**
 * 创建默认等级配置（1-80级）
 */
export function createDefaultLevels(maxLevel: number, userType: LevelUserType): LevelDetail[] {
  return Array.from({ length: maxLevel }, (_, i) =>
    createDefaultLevelDetail(i + 1, userType)
  );
}

/**
 * 创建默认等级配置
 */
export function createDefaultLevelConfig(
  gameId: string,
  userType: LevelUserType,
  key?: string
): Omit<LevelConfig, "id" | "createdAt" | "updatedAt"> {
  const maxLevel = 80;
  return {
    gameId,
    key: key || `level-${userType}-${Date.now()}`,
    name: userType === "player" ? "新玩家等级配置" : "新NPC等级配置",
    userType,
    maxLevel,
    levels: createDefaultLevels(maxLevel, userType),
  };
}
