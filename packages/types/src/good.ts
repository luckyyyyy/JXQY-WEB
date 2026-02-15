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
export const GoodKindEnum = z.enum([
  "Drug", // 0 - 消耗品
  "Equipment", // 1 - 装备
  "Event", // 2 - 任务道具/秘籍
]);

export type GoodKind = z.infer<typeof GoodKindEnum>;

/** 物品种类值映射 */
export const GoodKindValues: Record<GoodKind, number> = {
  Drug: 0,
  Equipment: 1,
  Event: 2,
};

/** 数字到物品种类映射 */
export const GoodKindFromValue: Record<number, GoodKind> = {
  0: "Drug",
  1: "Equipment",
  2: "Event",
};

/** 物品种类中文名 */
export const GoodKindLabels: Record<GoodKind, string> = {
  Drug: "消耗品",
  Equipment: "装备",
  Event: "任务道具",
};

/**
 * 装备部位
 */
export const EquipPositionEnum = z.enum([
  "None", // 无部位
  "Head", // 头部
  "Neck", // 项链
  "Body", // 身体
  "Back", // 披风
  "Hand", // 武器
  "Wrist", // 手镯
  "Foot", // 鞋子
]);

export type EquipPosition = z.infer<typeof EquipPositionEnum>;

/** 装备部位中文名 */
export const EquipPositionValues: Record<EquipPosition, number> = {
  None: 0,
  Head: 1,
  Neck: 2,
  Body: 3,
  Back: 4,
  Hand: 5,
  Wrist: 6,
  Foot: 7,
};

export const EquipPositionFromValue: Record<number, EquipPosition> = Object.fromEntries(
  Object.entries(EquipPositionValues).map(([k, v]) => [v, k as EquipPosition])
) as Record<number, EquipPosition>;

export const EquipPositionLabels: Record<EquipPosition, string> = {
  None: "无",
  Head: "头部",
  Neck: "项链",
  Body: "身体",
  Back: "披风",
  Hand: "武器",
  Wrist: "手镯",
  Foot: "鞋子",
};

/**
 * 装备特效类型（最终计算结果）
 *
 * 注意：这是根据 Kind + Part + EffectType 组合计算出的最终效果
 * INI 中的 EffectType 是原始数值 (0/1/2/3)，需要通过 getActualEffectType() 转换
 */
export const GoodEffectTypeEnum = z.enum([
  "None", // 无特效
  "ThewNotLoseWhenRun", // 跑步不消耗体力 (Equipment + Foot + 1)
  "ManaRestore", // 内力恢复 (Equipment + Neck + 1)
  "EnemyFrozen", // 冰冻敌人 (Equipment + Hand + 1)
  "ClearFrozen", // 解除冰冻 (Drug + 1)
  "EnemyPoisoned", // 使敌人中毒 (Equipment + Hand + 2)
  "ClearPoison", // 解毒 (Drug + 2)
  "EnemyPetrified", // 石化敌人 (Equipment + Hand + 3)
  "ClearPetrifaction", // 解除石化 (Drug + 3)
]);

export type GoodEffectType = z.infer<typeof GoodEffectTypeEnum>;

export const GoodEffectTypeLabels: Record<GoodEffectType, string> = {
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
  kind: GoodKind,
  part: EquipPosition | null | undefined,
  effectType: number | null | undefined
): GoodEffectType {
  if (effectType == null || effectType === 0) return "None";

  if (kind === "Drug") {
    // 消耗品的解毒/解冻效果
    switch (effectType) {
      case 1:
        return "ClearFrozen";
      case 2:
        return "ClearPoison";
      case 3:
        return "ClearPetrifaction";
    }
  } else if (kind === "Equipment") {
    // 装备效果根据部位决定
    if (effectType === 1) {
      switch (part) {
        case "Foot":
          return "ThewNotLoseWhenRun";
        case "Neck":
          return "ManaRestore";
        case "Hand":
          return "EnemyFrozen";
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
  kind: GoodKind,
  part: EquipPosition | null | undefined
): { value: number; label: string }[] {
  const options: { value: number; label: string }[] = [{ value: 0, label: "无" }];

  if (kind === "Drug") {
    options.push(
      { value: 1, label: "解除冰冻" },
      { value: 2, label: "解毒" },
      { value: 3, label: "解除石化" }
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
        { value: 3, label: "石化敌人" }
      );
    }
  }

  return options;
}

// ========== 物品数据 Schema ==========

/**
 * 消耗品数据
 */
export const DrugDataSchema = z.object({
  life: z.number().int().nullable().optional(), // 恢复生命值
  thew: z.number().int().nullable().optional(), // 恢复体力值
  mana: z.number().int().nullable().optional(), // 恢复内力值
  effectType: z.number().int().min(0).max(3).nullable().optional(), // 特效类型原始值 (0-3)
});

export type DrugData = z.infer<typeof DrugDataSchema>;

/**
 * 装备数据
 */
export const EquipmentDataSchema = z.object({
  part: EquipPositionEnum, // 装备部位
  lifeMax: z.number().int().nullable().optional(), // 生命上限加成
  thewMax: z.number().int().nullable().optional(), // 体力上限加成
  manaMax: z.number().int().nullable().optional(), // 内力上限加成
  attack: z.number().int().nullable().optional(), // 攻击力加成
  defend: z.number().int().nullable().optional(), // 防御力加成
  evade: z.number().int().nullable().optional(), // 闪避加成
  effectType: z.number().int().min(0).max(3).nullable().optional(), // 特效类型原始值 (0-3)
});

export type EquipmentData = z.infer<typeof EquipmentDataSchema>;

/**
 * 任务道具数据
 */
export const EventDataSchema = z.object({
  script: z.string().nullable().optional(), // 使用脚本
});

export type EventData = z.infer<typeof EventDataSchema>;

// ========== 物品主 Schema ==========

/**
 * 物品基础信息 Schema
 */
export const GoodSchema = z.object({
  // 数据库标识
  id: z.string().uuid(),
  gameId: z.string().uuid(),

  // 唯一标识符（gameId + key 唯一）
  key: z.string().min(1),

  // 物品种类
  kind: GoodKindEnum,

  // 基础属性
  name: z.string().min(1), // 物品名称
  intro: z.string().default(""), // 物品介绍
  cost: z.number().int().nullable().optional(), // 价格

  // 资源文件
  image: z.string().nullable().optional(), // 物品图像
  icon: z.string().nullable().optional(), // 物品图标
  effect: z.string().nullable().optional(), // 特效资源

  // 类型特定数据（根据 kind 使用不同字段）
  // 消耗品字段
  life: z.number().int().nullable().optional(),
  thew: z.number().int().nullable().optional(),
  mana: z.number().int().nullable().optional(),

  // 装备字段
  part: EquipPositionEnum.nullable().optional(),
  lifeMax: z.number().int().nullable().optional(),
  thewMax: z.number().int().nullable().optional(),
  manaMax: z.number().int().nullable().optional(),
  attack: z.number().int().nullable().optional(),
  attack2: z.number().int().nullable().optional(), // 攻击力2
  attack3: z.number().int().nullable().optional(), // 攻击力3
  defend: z.number().int().nullable().optional(),
  defend2: z.number().int().nullable().optional(), // 防御力2
  defend3: z.number().int().nullable().optional(), // 防御力3
  evade: z.number().int().nullable().optional(),
  effectType: z.number().int().min(0).max(3).nullable().optional(), // 原始特效值 (0-3)
  specialEffect: z.number().int().nullable().optional(), // 特殊效果
  specialEffectValue: z.number().int().nullable().optional(), // 特殊效果值（默认1）

  // 任务道具字段
  script: z.string().nullable().optional(),

  // 经济
  sellPrice: z.number().int().nullable().optional(), // 自定义卖价（0=自动 cost/2）

  // 武功/技能关联
  flyIni: z.string().nullable().optional(), // 飞行武功 INI
  flyIni2: z.string().nullable().optional(), // 飞行武功2 INI
  magicIniWhenUse: z.string().nullable().optional(), // 使用时施放武功 INI
  replaceMagic: z.string().nullable().optional(), // 替换武功 INI
  useReplaceMagic: z.string().nullable().optional(), // 使用时替换武功 INI
  magicToUseWhenBeAttacked: z.string().nullable().optional(), // 被攻击反击武功 INI
  magicDirectionWhenBeAttacked: z.number().int().nullable().optional(), // 被攻击反击武功方向

  // 武功效果修改
  addMagicEffectPercent: z.number().int().nullable().optional(), // 武功效果百分比加成
  addMagicEffectAmount: z.number().int().nullable().optional(), // 武功效果固定值加成
  addMagicEffectName: z.string().nullable().optional(), // 加成的武功名称
  addMagicEffectType: z.string().nullable().optional(), // 加成的武功类型

  // 使用限制
  user: z.array(z.string()).nullable().optional(), // 可使用角色列表
  minUserLevel: z.number().int().nullable().optional(), // 最低使用等级
  noNeedToEquip: z.number().int().nullable().optional(), // 无需装备即生效（>0为true）

  // 其他修改器
  changeMoveSpeedPercent: z.number().int().nullable().optional(), // 移动速度百分比加成
  coldMilliSeconds: z.number().int().nullable().optional(), // 冷却时间（毫秒）

  // 伙伴效果
  followPartnerHasDrugEffect: z.number().int().nullable().optional(), // 跟随伙伴享有药效
  fighterFriendHasDrugEffect: z.number().int().nullable().optional(), // 战斗伙伴享有药效

  // 时间戳
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Good = z.infer<typeof GoodSchema>;

// ========== API Schema ==========

/**
 * 物品列表项 - 用于列表展示的精简版本
 */
export const GoodListItemSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  kind: GoodKindEnum,
  part: EquipPositionEnum.nullable().optional(),
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

export type GoodListItem = z.infer<typeof GoodListItemSchema>;

/**
 * 列出物品输入
 */
export const ListGoodInputSchema = z.object({
  gameId: z.string().uuid(),
  kind: GoodKindEnum.optional(),
});

export type ListGoodInput = z.infer<typeof ListGoodInputSchema>;

/**
 * 获取物品输入
 */
export const GetGoodInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type GetGoodInput = z.infer<typeof GetGoodInputSchema>;

/**
 * 创建物品输入
 */
export const CreateGoodInputSchema = z.object({
  gameId: z.string().uuid(),
  key: z.string().min(1),
  kind: GoodKindEnum,
  name: z.string().min(1),
  intro: z.string().optional(),
});

export type CreateGoodInput = z.infer<typeof CreateGoodInputSchema>;

/**
 * 更新物品输入
 */
export const UpdateGoodInputSchema = GoodSchema.partial().extend({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type UpdateGoodInput = z.infer<typeof UpdateGoodInputSchema>;

/**
 * 删除物品输入
 */
export const DeleteGoodInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type DeleteGoodInput = z.infer<typeof DeleteGoodInputSchema>;

/**
 * 导入物品输入（单个）
 */
export const ImportGoodInputSchema = z.object({
  gameId: z.string().uuid(),
  fileName: z.string().min(1),
  iniContent: z.string(),
});

export type ImportGoodInput = z.infer<typeof ImportGoodInputSchema>;

/**
 * 批量导入物品单项
 */
export const BatchImportGoodItemSchema = z.object({
  fileName: z.string(),
  iniContent: z.string(),
});

export type BatchImportGoodItem = z.infer<typeof BatchImportGoodItemSchema>;

/**
 * 批量导入物品输入
 */
export const BatchImportGoodInputSchema = z.object({
  gameId: z.string().uuid(),
  items: z.array(BatchImportGoodItemSchema).min(1).max(500),
});

export type BatchImportGoodInput = z.infer<typeof BatchImportGoodInputSchema>;

/**
 * 批量导入结果
 */
export const BatchImportGoodResultSchema = z.object({
  success: z.array(
    z.object({
      fileName: z.string(),
      id: z.string().uuid(),
      name: z.string(),
      kind: GoodKindEnum,
    })
  ),
  failed: z.array(
    z.object({
      fileName: z.string(),
      error: z.string(),
    })
  ),
});

export type BatchImportGoodResult = z.infer<typeof BatchImportGoodResultSchema>;

// ========== 辅助函数 ==========

/**
 * 根据物品种类获取可见字段
 */
export function getVisibleFieldsByKind(kind: GoodKind): string[] {
  const baseFields = ["name", "key", "kind", "intro", "cost", "image", "icon", "effect"];

  const additionalFields: Record<GoodKind, string[]> = {
    Drug: [
      "life",
      "thew",
      "mana",
      "effectType",
      "coldMilliSeconds",
      "user",
      "minUserLevel",
      "followPartnerHasDrugEffect",
      "fighterFriendHasDrugEffect",
    ],
    Equipment: [
      "part",
      "lifeMax",
      "thewMax",
      "manaMax",
      "attack",
      "attack2",
      "attack3",
      "defend",
      "defend2",
      "defend3",
      "evade",
      "effectType",
      "specialEffect",
      "specialEffectValue",
      "noNeedToEquip",
      "changeMoveSpeedPercent",
      "addMagicEffectPercent",
      "addMagicEffectAmount",
      "addMagicEffectName",
      "addMagicEffectType",
      "flyIni",
      "flyIni2",
      "magicIniWhenUse",
      "replaceMagic",
      "useReplaceMagic",
      "magicToUseWhenBeAttacked",
      "magicDirectionWhenBeAttacked",
    ],
    Event: ["script"],
  };

  return [...baseFields, ...additionalFields[kind]];
}

/**
 * 创建默认物品
 */
export function createDefaultGood(
  gameId: string,
  kind: GoodKind = "Drug",
  key?: string
): Omit<Good, "id" | "createdAt" | "updatedAt"> {
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
    attack2: null,
    attack3: null,
    defend: null,
    defend2: null,
    defend3: null,
    evade: null,
    effectType: null,
    specialEffect: null,
    specialEffectValue: null,
    // 任务道具字段
    script: null,
    // 经济
    sellPrice: null,
    // 武功/技能关联
    flyIni: null,
    flyIni2: null,
    magicIniWhenUse: null,
    replaceMagic: null,
    useReplaceMagic: null,
    magicToUseWhenBeAttacked: null,
    magicDirectionWhenBeAttacked: null,
    // 武功效果修改
    addMagicEffectPercent: null,
    addMagicEffectAmount: null,
    addMagicEffectName: null,
    addMagicEffectType: null,
    // 使用限制
    user: null,
    minUserLevel: null,
    noNeedToEquip: null,
    // 其他修改器
    changeMoveSpeedPercent: null,
    coldMilliSeconds: null,
    // 伙伴效果
    followPartnerHasDrugEffect: null,
    fighterFriendHasDrugEffect: null,
  };
}
