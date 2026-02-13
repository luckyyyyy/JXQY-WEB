/**
 * 物品系统类型定义
 * 用于前后端共享的 Zod Schema
 */
import { z } from "zod";

// ========== 枚举定义 ==========

/**
 * 物品种类
 * Kind=0: 消耗品（药材、食物等，有 Life/Thew/Mana 恢复值）
 * Kind=1: 装备（有 Part 部位、属性加成）
 * Kind=2: 任务道具/秘籍（有 Script 脚本）
 */
export const GoodsKindEnum = z.enum([
  "Consumable",  // 0 - 消耗品
  "Equipment",   // 1 - 装备
  "Quest",       // 2 - 任务道具/秘籍
]);

export type GoodsKind = z.infer<typeof GoodsKindEnum>;

/** 物品种类值映射 */
export const GoodsKindValues: Record<GoodsKind, number> = {
  Consumable: 0,
  Equipment: 1,
  Quest: 2,
};

/** 数字到物品种类映射 */
export const GoodsKindFromValue: Record<number, GoodsKind> = {
  0: "Consumable",
  1: "Equipment",
  2: "Quest",
};

/** 物品种类中文名 */
export const GoodsKindLabels: Record<GoodsKind, string> = {
  Consumable: "消耗品",
  Equipment: "装备",
  Quest: "任务道具",
};

/**
 * 装备部位
 */
export const GoodsPartEnum = z.enum([
  "Hand",   // 武器
  "Head",   // 头部
  "Body",   // 身体
  "Foot",   // 鞋子
  "Neck",   // 项链
  "Back",   // 披风
  "Wrist",  // 手镯
]);

export type GoodsPart = z.infer<typeof GoodsPartEnum>;

/** 装备部位中文名 */
export const GoodsPartLabels: Record<GoodsPart, string> = {
  Hand: "武器",
  Head: "头部",
  Body: "身体",
  Foot: "鞋子",
  Neck: "项链",
  Back: "披风",
  Wrist: "手镯",
};

/**
 * 装备特效类型（最终计算结果）
 *
 * 注意：这是根据 Kind + Part + EffectType 组合计算出的最终效果
 * INI 中的 EffectType 是原始数值 (0/1/2/3)，需要通过 getActualEffectType() 转换
 */
export const GoodsEffectTypeEnum = z.enum([
  "None",               // 无特效
  "ThewNotLoseWhenRun", // 跑步不消耗体力 (Equipment + Foot + 1)
  "ManaRestore",        // 内力恢复 (Equipment + Neck + 1)
  "EnemyFrozen",        // 冰冻敌人 (Equipment + Hand + 1)
  "EnemyPoisoned",      // 使敌人中毒 (Equipment + Hand + 2)
  "EnemyPetrified",     // 石化敌人 (Equipment + Hand + 3)
  "ClearFrozen",        // 解除冰冻 (Consumable + 1)
  "ClearPoison",        // 解毒 (Consumable + 2)
  "ClearPetrifaction",  // 解除石化 (Consumable + 3)
]);

export type GoodsEffectType = z.infer<typeof GoodsEffectTypeEnum>;

export const GoodsEffectTypeLabels: Record<GoodsEffectType, string> = {
  None: "无",
  ThewNotLoseWhenRun: "跑步不消耗体力",
  ManaRestore: "内力恢复",
  EnemyFrozen: "冰冻敌人",
  ClearFrozen: "解除冰冻",
  EnemyPoisoned: "使敌人中毒",
  ClearPoison: "解毒",
  EnemyPetrified: "石化敌人",
  ClearPetrifaction: "解除石化",
};

/**
 * 根据 Kind + Part + EffectType 计算实际效果类型
 * 这个逻辑来自 C# 的 Good.cs TheEffectType 属性
 */
export function getActualEffectType(
  kind: GoodsKind,
  part: GoodsPart | null | undefined,
  effectType: number | null | undefined,
): GoodsEffectType {
  if (effectType == null || effectType === 0) return "None";

  if (kind === "Consumable") {
    // 消耗品的解毒/解冻效果
    switch (effectType) {
      case 1: return "ClearFrozen";
      case 2: return "ClearPoison";
      case 3: return "ClearPetrifaction";
    }
  } else if (kind === "Equipment") {
    // 装备效果根据部位决定
    if (effectType === 1) {
      switch (part) {
        case "Foot": return "ThewNotLoseWhenRun";
        case "Neck": return "ManaRestore";
        case "Hand": return "EnemyFrozen";
      }
    } else if (effectType === 2) {
      if (part === "Hand") return "EnemyPoisoned";
    } else if (effectType === 3) {
      if (part === "Hand") return "EnemyPetrified";
    }
  }

  return "None";
}

/**
 * 获取特定 Kind + Part 组合可选的 EffectType 选项
 */
export function getEffectTypeOptions(
  kind: GoodsKind,
  part: GoodsPart | null | undefined,
): { value: number; label: string }[] {
  const options: { value: number; label: string }[] = [{ value: 0, label: "无" }];

  if (kind === "Consumable") {
    options.push(
      { value: 1, label: "解除冰冻" },
      { value: 2, label: "解毒" },
      { value: 3, label: "解除石化" },
    );
  } else if (kind === "Equipment") {
    if (part === "Foot") {
      options.push({ value: 1, label: "跑步不消耗体力" });
    } else if (part === "Neck") {
      options.push({ value: 1, label: "内力恢复" });
    } else if (part === "Hand") {
      options.push(
        { value: 1, label: "冰冻敌人" },
        { value: 2, label: "使敌人中毒" },
        { value: 3, label: "石化敌人" },
      );
    }
  }

  return options;
}

// ========== 物品数据 Schema ==========

/**
 * 消耗品数据
 */
export const ConsumableDataSchema = z.object({
  life: z.number().int().nullable().optional(),   // 恢复生命值
  thew: z.number().int().nullable().optional(),   // 恢复体力值
  mana: z.number().int().nullable().optional(),   // 恢复内力值
  effectType: z.number().int().min(0).max(3).nullable().optional(),  // 特效类型原始值 (0-3)
});

export type ConsumableData = z.infer<typeof ConsumableDataSchema>;

/**
 * 装备数据
 */
export const EquipmentDataSchema = z.object({
  part: GoodsPartEnum,                                      // 装备部位
  lifeMax: z.number().int().nullable().optional(),          // 生命上限加成
  thewMax: z.number().int().nullable().optional(),          // 体力上限加成
  manaMax: z.number().int().nullable().optional(),          // 内力上限加成
  attack: z.number().int().nullable().optional(),           // 攻击力加成
  defend: z.number().int().nullable().optional(),           // 防御力加成
  evade: z.number().int().nullable().optional(),            // 闪避加成
  effectType: z.number().int().min(0).max(3).nullable().optional(),  // 特效类型原始值 (0-3)
});

export type EquipmentData = z.infer<typeof EquipmentDataSchema>;

/**
 * 任务道具数据
 */
export const QuestDataSchema = z.object({
  script: z.string().nullable().optional(),  // 使用脚本
});

export type QuestData = z.infer<typeof QuestDataSchema>;

// ========== 物品主 Schema ==========

/**
 * 物品基础信息 Schema
 */
export const GoodsSchema = z.object({
  // 数据库标识
  id: z.string().uuid(),
  gameId: z.string().uuid(),

  // 唯一标识符（gameId + key 唯一）
  key: z.string().min(1),

  // 物品种类
  kind: GoodsKindEnum,

  // 基础属性
  name: z.string().min(1),                          // 物品名称
  intro: z.string().default(""),                    // 物品介绍
  cost: z.number().int().nullable().optional(),     // 价格

  // 资源文件
  image: z.string().nullable().optional(),          // 物品图像
  icon: z.string().nullable().optional(),           // 物品图标
  effect: z.string().nullable().optional(),         // 特效资源

  // 类型特定数据（根据 kind 使用不同字段）
  // 消耗品字段
  life: z.number().int().nullable().optional(),
  thew: z.number().int().nullable().optional(),
  mana: z.number().int().nullable().optional(),

  // 装备字段
  part: GoodsPartEnum.nullable().optional(),
  lifeMax: z.number().int().nullable().optional(),
  thewMax: z.number().int().nullable().optional(),
  manaMax: z.number().int().nullable().optional(),
  attack: z.number().int().nullable().optional(),
  defend: z.number().int().nullable().optional(),
  evade: z.number().int().nullable().optional(),
  effectType: z.number().int().min(0).max(3).nullable().optional(),  // 原始特效值 (0-3)

  // 任务道具字段
  script: z.string().nullable().optional(),

  // 时间戳
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Goods = z.infer<typeof GoodsSchema>;

// ========== API Schema ==========

/**
 * 物品列表项 - 用于列表展示的精简版本
 */
export const GoodsListItemSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  kind: GoodsKindEnum,
  part: GoodsPartEnum.nullable().optional(),
  icon: z.string().nullable().optional(),
  // 价格相关字段（用于商店编辑器显示价格）
  cost: z.number().int().nullable().optional(),
  life: z.number().int().nullable().optional(),
  thew: z.number().int().nullable().optional(),
  mana: z.number().int().nullable().optional(),
  lifeMax: z.number().int().nullable().optional(),
  thewMax: z.number().int().nullable().optional(),
  manaMax: z.number().int().nullable().optional(),
  attack: z.number().int().nullable().optional(),
  defend: z.number().int().nullable().optional(),
  evade: z.number().int().nullable().optional(),
  effectType: z.number().int().nullable().optional(),
  updatedAt: z.string(),
});

export type GoodsListItem = z.infer<typeof GoodsListItemSchema>;

/**
 * 列出物品输入
 */
export const ListGoodsInputSchema = z.object({
  gameId: z.string().uuid(),
  kind: GoodsKindEnum.optional(),
});

export type ListGoodsInput = z.infer<typeof ListGoodsInputSchema>;

/**
 * 获取物品输入
 */
export const GetGoodsInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type GetGoodsInput = z.infer<typeof GetGoodsInputSchema>;

/**
 * 创建物品输入
 */
export const CreateGoodsInputSchema = z.object({
  gameId: z.string().uuid(),
  key: z.string().min(1),
  kind: GoodsKindEnum,
  name: z.string().min(1),
  intro: z.string().optional(),
});

export type CreateGoodsInput = z.infer<typeof CreateGoodsInputSchema>;

/**
 * 更新物品输入
 */
export const UpdateGoodsInputSchema = GoodsSchema.partial().extend({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type UpdateGoodsInput = z.infer<typeof UpdateGoodsInputSchema>;

/**
 * 删除物品输入
 */
export const DeleteGoodsInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type DeleteGoodsInput = z.infer<typeof DeleteGoodsInputSchema>;

/**
 * 导入物品输入（单个）
 */
export const ImportGoodsInputSchema = z.object({
  gameId: z.string().uuid(),
  fileName: z.string().min(1),
  iniContent: z.string(),
});

export type ImportGoodsInput = z.infer<typeof ImportGoodsInputSchema>;

/**
 * 批量导入物品单项
 */
export const BatchImportGoodsItemSchema = z.object({
  fileName: z.string(),
  iniContent: z.string(),
});

export type BatchImportGoodsItem = z.infer<typeof BatchImportGoodsItemSchema>;

/**
 * 批量导入物品输入
 */
export const BatchImportGoodsInputSchema = z.object({
  gameId: z.string().uuid(),
  items: z.array(BatchImportGoodsItemSchema).min(1).max(500),
});

export type BatchImportGoodsInput = z.infer<typeof BatchImportGoodsInputSchema>;

/**
 * 批量导入结果
 */
export const BatchImportGoodsResultSchema = z.object({
  success: z.array(z.object({
    fileName: z.string(),
    id: z.string().uuid(),
    name: z.string(),
    kind: GoodsKindEnum,
  })),
  failed: z.array(z.object({
    fileName: z.string(),
    error: z.string(),
  })),
});

export type BatchImportGoodsResult = z.infer<typeof BatchImportGoodsResultSchema>;

// ========== 辅助函数 ==========

/**
 * 根据物品种类获取可见字段
 */
export function getVisibleFieldsByKind(kind: GoodsKind): string[] {
  const baseFields = ["name", "key", "kind", "intro", "cost", "image", "icon", "effect"];

  const additionalFields: Record<GoodsKind, string[]> = {
    Consumable: ["life", "thew", "mana"],
    Equipment: ["part", "lifeMax", "thewMax", "manaMax", "attack", "defend", "evade", "effectType"],
    Quest: ["script"],
  };

  return [...baseFields, ...additionalFields[kind]];
}

/**
 * 创建默认物品
 */
export function createDefaultGoods(
  gameId: string,
  kind: GoodsKind = "Consumable",
  key?: string
): Omit<Goods, "id" | "createdAt" | "updatedAt"> {
  return {
    gameId,
    key: key ?? `goods_${Date.now()}`,
    kind,
    name: "新物品",
    intro: "",
    cost: null,
    image: null,
    icon: null,
    effect: null,
    // 消耗品字段
    life: null,
    thew: null,
    mana: null,
    // 装备字段（装备默认部位为 Hand）
    part: kind === "Equipment" ? "Hand" : null,
    lifeMax: null,
    thewMax: null,
    manaMax: null,
    attack: null,
    defend: null,
    evade: null,
    effectType: null,
    // 任务道具字段
    script: null,
  };
}
