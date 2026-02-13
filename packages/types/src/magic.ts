/**
 * 武功系统类型定义
 * 用于前后端共享的 Zod Schema
 */
import { z } from "zod";

// ========== 枚举定义 ==========

/**
 * 武功移动类型
 */
export const MagicMoveKindEnum = z.enum([
  "NoMove",           // 0 - 不移动
  "FixedPosition",    // 1 - 固定位置
  "SingleMove",       // 2 - 单个移动
  "LineMove",         // 3 - 直线移动
  "CircleMove",       // 4 - 圆形移动
  "HeartMove",        // 5 - 心形移动
  "SpiralMove",       // 6 - 螺旋移动
  "SectorMove",       // 7 - 扇形移动
  "RandomSector",     // 8 - 随机扇形
  "FixedWall",        // 9 - 固定墙
  "WallMove",         // 10 - 墙移动
  "RegionBased",      // 11 - 区域类型
  "FollowCharacter",  // 13 - 跟随自身
  "SuperMode",        // 15 - 超级模式
  "FollowEnemy",      // 16 - 跟随敌人
  "Throw",            // 17 - 投掷
  "Kind19",           // 19 - 持续留痕
  "Transport",        // 20 - 传送
  "PlayerControl",    // 21 - 玩家控制
  "Summon",           // 22 - 召唤 NPC
  "TimeStop",         // 23 - 时间停止
  "VMove",            // 24 - V字移动
]);

export type MagicMoveKind = z.infer<typeof MagicMoveKindEnum>;

/** 字符串枚举值到数字的映射 */
export const MagicMoveKindValues: Record<MagicMoveKind, number> = {
  NoMove: 0,
  FixedPosition: 1,
  SingleMove: 2,
  LineMove: 3,
  CircleMove: 4,
  HeartMove: 5,
  SpiralMove: 6,
  SectorMove: 7,
  RandomSector: 8,
  FixedWall: 9,
  WallMove: 10,
  RegionBased: 11,
  FollowCharacter: 13,
  SuperMode: 15,
  FollowEnemy: 16,
  Throw: 17,
  Kind19: 19,
  Transport: 20,
  PlayerControl: 21,
  Summon: 22,
  TimeStop: 23,
  VMove: 24,
};

/** 数字到字符串枚举值的映射 */
export const MagicMoveKindFromValue: Record<number, MagicMoveKind> = Object.fromEntries(
  Object.entries(MagicMoveKindValues).map(([k, v]) => [v, k as MagicMoveKind])
) as Record<number, MagicMoveKind>;

/**
 * 武功特殊效果类型
 */
export const MagicSpecialKindEnum = z.enum([
  "None",             // 0 - 无特殊效果
  "AddLifeOrFrozen",  // 1 - MoveKind=13时加生命 / 其他时冰冻
  "AddThewOrPoison",  // 2 - MoveKind=13时加体力 / 其他时中毒
  "BuffOrPetrify",    // 3 - MoveKind=13时持续BUFF / 其他时石化
  "InvisibleHide",    // 4 - 隐身(攻击时消失)
  "InvisibleShow",    // 5 - 隐身(攻击时可见)
  "Buff",             // 6 - 持续效果
  "ChangeCharacter",  // 7 - 变身
  "RemoveAbnormal",   // 8 - 解除异常状态
  "ChangeFlyIni",     // 9 - 改变飞行ini
]);

export type MagicSpecialKind = z.infer<typeof MagicSpecialKindEnum>;

export const MagicSpecialKindValues: Record<MagicSpecialKind, number> = {
  None: 0,
  AddLifeOrFrozen: 1,
  AddThewOrPoison: 2,
  BuffOrPetrify: 3,
  InvisibleHide: 4,
  InvisibleShow: 5,
  Buff: 6,
  ChangeCharacter: 7,
  RemoveAbnormal: 8,
  ChangeFlyIni: 9,
};

export const MagicSpecialKindFromValue: Record<number, MagicSpecialKind> = Object.fromEntries(
  Object.entries(MagicSpecialKindValues).map(([k, v]) => [v, k as MagicSpecialKind])
) as Record<number, MagicSpecialKind>;

/**
 * 武功使用者类型
 */
export const MagicUserTypeEnum = z.enum([
  "player", // 玩家专用
  "npc",    // NPC专用
]);

export type MagicUserType = z.infer<typeof MagicUserTypeEnum>;

/**
 * 门派从属
 */
export const MagicBelongEnum = z.enum([
  "Neutral",      // 0 - 杂派/无门派限制
  "WuLin",        // 1 - 武林
  "LuoYeGu",      // 2 - 落叶谷
  "CangJianShan", // 3 - 藏剑山庄
  "ZhenXingLou",  // 4 - 真星楼
  "WuYouJiao",    // 5 - 无忧教
  "YueZhongTian", // 6 - 月重天
  "NvErTang",     // 7 - 女儿堂
  "FeiLongBao",   // 8 - 飞龙堡
]);

export type MagicBelong = z.infer<typeof MagicBelongEnum>;

export const MagicBelongValues: Record<MagicBelong, number> = {
  Neutral: 0,
  WuLin: 1,
  LuoYeGu: 2,
  CangJianShan: 3,
  ZhenXingLou: 4,
  WuYouJiao: 5,
  YueZhongTian: 6,
  NvErTang: 7,
  FeiLongBao: 8,
};

export const MagicBelongFromValue: Record<number, MagicBelong> = Object.fromEntries(
  Object.entries(MagicBelongValues).map(([k, v]) => [v, k as MagicBelong])
) as Record<number, MagicBelong>;

/** 门派中文名映射 */
export const MagicBelongLabels: Record<MagicBelong, string> = {
  Neutral: "杂派",
  WuLin: "武林",
  LuoYeGu: "落叶谷",
  CangJianShan: "藏剑山庄",
  ZhenXingLou: "真星楼",
  WuYouJiao: "无忧教",
  YueZhongTian: "月重天",
  NvErTang: "女儿堂",
  FeiLongBao: "飞龙堡",
};

/**
 * 区域类型（MoveKind=11 RegionBased 时使用）
 * 决定武功效果的形状
 */
export const MagicRegionTypeEnum = z.enum([
  "Square",             // 1 - 方形区域
  "Cross",              // 2 - 十字区域
  "Rectangle",          // 3 - 矩形区域
  "IsoscelesTriangle",  // 4 - 等腰三角形
  "VType",              // 5 - V形区域
  "RegionFile",         // 6 - 使用外部区域文件
]);

export type MagicRegionType = z.infer<typeof MagicRegionTypeEnum>;

/** 区域类型枚举值到数字的映射 */
export const MagicRegionTypeValues: Record<MagicRegionType, number> = {
  Square: 1,
  Cross: 2,
  Rectangle: 3,
  IsoscelesTriangle: 4,
  VType: 5,
  RegionFile: 6,
};

/** 数字到区域类型枚举值的映射 */
export const MagicRegionTypeFromValue: Record<number, MagicRegionType> = Object.fromEntries(
  Object.entries(MagicRegionTypeValues).map(([k, v]) => [v, k as MagicRegionType])
) as Record<number, MagicRegionType>;

/** 区域类型中文名映射 */
export const MagicRegionTypeLabels: Record<MagicRegionType, string> = {
  Square: "方形区域",
  Cross: "十字区域",
  Rectangle: "矩形区域",
  IsoscelesTriangle: "等腰三角形",
  VType: "V形区域",
  RegionFile: "外部区域文件",
};

// ========== 等级配置 Schema ==========

/**
 * 武功等级配置
 */
export const MagicLevelSchema = z.object({
  level: z.number().int().min(1).max(10),
  effect: z.number().int().default(0),              // 效果值（伤害/治疗）
  manaCost: z.number().int().default(0),            // 内力消耗
  levelupExp: z.number().int().nullable().optional(), // 升级经验，10级为空
  speed: z.number().int().optional(),               // 覆盖速度
  moveKind: MagicMoveKindEnum.optional(),           // 覆盖移动类型
  lifeFrame: z.number().int().optional(),           // 覆盖生命帧数
});

export type MagicLevel = z.infer<typeof MagicLevelSchema>;

// ========== AttackFile Schema ==========

/**
 * 攻击配置（嵌套的武功配置）
 * AttackFile 是武功的一个嵌套属性，存储攻击阶段的配置
 */
export const AttackFileSchema = z.object({
  // 基础属性
  name: z.string().default(""),
  intro: z.string().default(""),

  // 运动属性
  moveKind: MagicMoveKindEnum.default("SingleMove"),
  speed: z.number().int().min(0).max(32).default(8),
  region: z.number().int().min(0).max(4).default(0),

  // 特效属性
  specialKind: MagicSpecialKindEnum.default("None"),
  specialKindValue: z.number().int().default(0),
  specialKindMilliSeconds: z.number().int().default(0),
  alphaBlend: z.boolean().default(false),
  flyingLum: z.number().int().min(0).max(31).default(0),
  vanishLum: z.number().int().min(0).max(31).default(0),

  // 帧相关
  waitFrame: z.number().int().min(0).default(0),
  lifeFrame: z.number().int().min(0).default(4),

  // 资源文件
  flyingImage: z.string().nullable().optional(),
  flyingSound: z.string().nullable().optional(),
  vanishImage: z.string().nullable().optional(),
  vanishSound: z.string().nullable().optional(),

  // 穿透属性
  passThrough: z.boolean().default(false),
  passThroughWall: z.boolean().default(false),

  // 追踪属性
  traceEnemy: z.boolean().default(false),
  traceSpeed: z.number().int().default(0),

  // 范围效果
  rangeRadius: z.number().int().default(0),
  attackAll: z.boolean().default(false),

  // 弹跳
  bounce: z.boolean().default(false),
  bounceHurt: z.number().int().default(0),

  // 其他
  vibratingScreen: z.boolean().default(false),
});

export type AttackFile = z.infer<typeof AttackFileSchema>;

// ========== 武功主 Schema ==========

/**
 * 武功基础信息 Schema
 */
export const MagicBaseSchema = z.object({
  // 基础标识
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  userType: MagicUserTypeEnum,                      // 使用者类型
  key: z.string().min(1),                           // 唯一标识符（gameId + key 唯一）

  // 基础属性
  name: z.string().min(1),                          // 武功名称
  intro: z.string().default(""),                    // 武功介绍

  // 运动属性
  moveKind: MagicMoveKindEnum.default("SingleMove"),
  speed: z.number().int().min(0).max(32).default(8),
  region: z.number().int().min(0).max(4).default(0),

  // 特效属性
  specialKind: MagicSpecialKindEnum.default("None"),
  alphaBlend: z.boolean().default(false),           // 是否透明混合
  flyingLum: z.number().int().min(0).max(31).default(0),
  vanishLum: z.number().int().min(0).max(31).default(0),

  // 帧相关
  waitFrame: z.number().int().min(0).default(0),
  lifeFrame: z.number().int().min(0).default(4),

  // 资源文件
  image: z.string().nullable().optional(),          // 武功施放图像
  icon: z.string().nullable().optional(),           // 图标
  flyingImage: z.string().nullable().optional(),    // 飞行图像
  flyingSound: z.string().nullable().optional(),    // 飞行音效
  vanishImage: z.string().nullable().optional(),    // 消失图像
  vanishSound: z.string().nullable().optional(),    // 消失音效
  superModeImage: z.string().nullable().optional(), // 超级模式图像

  // 从属关系（仅玩家武功）
  belong: MagicBelongEnum.nullable().optional(),    // 门派从属
  actionFile: z.string().nullable().optional(),     // 动作文件
  attackFile: AttackFileSchema.nullable().optional(), // 攻击配置（嵌套武功对象）

  // 等级配置（仅玩家武功）
  levels: z.array(MagicLevelSchema).nullable().optional(),

  // 时间戳
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type MagicBase = z.infer<typeof MagicBaseSchema>;

/**
 * 武功完整 Schema（包含高级属性）
 */
export const MagicSchema = MagicBaseSchema.extend({
  // ===== 高级属性（根据 MoveKind/SpecialKind 显示）=====

  // 特殊效果相关
  specialKindValue: z.number().int().default(0),
  specialKindMilliSeconds: z.number().int().default(0),

  // 穿透属性
  passThrough: z.boolean().default(false),
  passThroughWall: z.boolean().default(false),

  // 追踪属性
  traceEnemy: z.boolean().default(false),
  traceSpeed: z.number().int().default(0),

  // 冷却时间
  coldMilliSeconds: z.number().int().default(0),

  // 范围效果
  rangeRadius: z.number().int().default(0),
  attackAll: z.boolean().default(false),

  // 弹跳属性
  bounce: z.boolean().default(false),
  bounceHurt: z.number().int().default(0),

  // 起始位置
  beginAtMouse: z.boolean().default(false),
  beginAtUser: z.boolean().default(false),

  // 震屏
  vibratingScreen: z.boolean().default(false),

  // 关联武功
  explodeMagicFile: z.string().nullable().optional(),
  flyMagic: z.string().nullable().optional(),
  flyInterval: z.number().int().default(0),

  // NPC 相关
  npcFile: z.string().nullable().optional(),

  // 寄生相关
  parasitic: z.boolean().default(false),
  parasiticMagic: z.string().nullable().optional(),
  parasiticInterval: z.number().int().default(1000),
});

export type Magic = z.infer<typeof MagicSchema>;

// ========== API Schema ==========

/**
 * 创建武功输入
 */
export const CreateMagicInputSchema = z.object({
  gameId: z.string().uuid(),
  userType: MagicUserTypeEnum,
  key: z.string().min(1),                   // 唯一标识符
  name: z.string().min(1),
  intro: z.string().optional(),
  moveKind: MagicMoveKindEnum.optional(),
  specialKind: MagicSpecialKindEnum.optional(),
  belong: MagicBelongEnum.nullable().optional(),
});

export type CreateMagicInput = z.infer<typeof CreateMagicInputSchema>;

/**
 * 更新武功输入
 */
export const UpdateMagicInputSchema = MagicSchema.partial().extend({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type UpdateMagicInput = z.infer<typeof UpdateMagicInputSchema>;

/**
 * 删除武功输入
 */
export const DeleteMagicInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type DeleteMagicInput = z.infer<typeof DeleteMagicInputSchema>;

/**
 * 列出武功输入
 */
export const ListMagicInputSchema = z.object({
  gameId: z.string().uuid(),
  userType: MagicUserTypeEnum.optional(),
});

export type ListMagicInput = z.infer<typeof ListMagicInputSchema>;

/**
 * 导入武功输入（单个）
 */
export const ImportMagicInputSchema = z.object({
  gameId: z.string().uuid(),
  userType: MagicUserTypeEnum,
  fileName: z.string().min(1),         // 文件名+扩展名，作为 key
  iniContent: z.string(),              // 主武功 INI 文件内容
  attackFileContent: z.string().optional(), // AttackFile INI 内容（可选）
});

export type ImportMagicInput = z.infer<typeof ImportMagicInputSchema>;

/**
 * 批量导入武功单项
 */
export const BatchImportMagicItemSchema = z.object({
  fileName: z.string(),                // 文件名（用于日志和识别）
  iniContent: z.string(),              // 主武功 INI 文件内容
  attackFileContent: z.string().optional(), // AttackFile INI 内容（可选，自动识别为飞行武功）
  userType: MagicUserTypeEnum.optional(),   // 每个文件可单独指定类型（用于自动识别）
});

export type BatchImportMagicItem = z.infer<typeof BatchImportMagicItemSchema>;

/**
 * 批量导入武功输入
 */
export const BatchImportMagicInputSchema = z.object({
  gameId: z.string().uuid(),
  userType: MagicUserTypeEnum.optional(), // 全局类型（可选，作为默认值）
  items: z.array(BatchImportMagicItemSchema).min(1).max(100), // 限制最多 100 个
});

export type BatchImportMagicInput = z.infer<typeof BatchImportMagicInputSchema>;

/**
 * 批量导入结果
 */
export const BatchImportMagicResultSchema = z.object({
  success: z.array(z.object({
    fileName: z.string(),
    id: z.string().uuid(),
    name: z.string(),
    isFlyingMagic: z.boolean(), // 是否识别为飞行武功
  })),
  failed: z.array(z.object({
    fileName: z.string(),
    error: z.string(),
  })),
});

export type BatchImportMagicResult = z.infer<typeof BatchImportMagicResultSchema>;

/**
 * 获取武功输入
 */
export const GetMagicInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type GetMagicInput = z.infer<typeof GetMagicInputSchema>;

/**
 * 武功列表项 - 用于列表展示的精简版本
 */
export const MagicListItemSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),                           // 唯一标识符
  name: z.string(),
  userType: MagicUserTypeEnum,
  moveKind: MagicMoveKindEnum,
  belong: MagicBelongEnum.nullable(),
  icon: z.string().nullable().optional(),  // 图标路径（用于侧边栏显示）
  updatedAt: z.string(),
});

export type MagicListItem = z.infer<typeof MagicListItemSchema>;

// ========== 辅助函数 ==========

/**
 * 根据 MoveKind 判断应该显示哪些字段
 */
export function getVisibleFieldsByMoveKind(moveKind: MagicMoveKind): string[] {
  // 基础字段 - 始终显示
  const baseFields = [
    "name", "intro", "moveKind",
    "specialKind", "alphaBlend", "flyingLum", "vanishLum",
    "image", "icon", "flyingImage", "flyingSound", "vanishImage", "vanishSound",
  ];

  // 移动相关字段 - 根据 moveKind 决定
  const motionFields = ["speed", "waitFrame", "lifeFrame"];

  // 区域类型专用字段
  const regionFields = moveKind === "RegionBased" ? ["region", "rangeRadius"] : [];

  const additionalFields: Record<MagicMoveKind, string[]> = {
    NoMove: [],
    FixedPosition: [],
    SingleMove: ["passThrough", "passThroughWall", "traceEnemy", "traceSpeed"],
    LineMove: ["passThrough"],
    CircleMove: ["rangeRadius", "attackAll"],
    HeartMove: [],
    SpiralMove: [],
    SectorMove: ["rangeRadius"],
    RandomSector: ["rangeRadius"],
    FixedWall: [],
    WallMove: ["passThrough"],
    RegionBased: [], // 已在 regionFields 中处理
    FollowCharacter: ["specialKindValue", "specialKindMilliSeconds"],
    SuperMode: ["superModeImage"],
    FollowEnemy: ["traceEnemy", "traceSpeed"],
    Throw: ["bounce", "bounceHurt"],
    Kind19: [],
    Transport: [],
    PlayerControl: [],
    Summon: ["npcFile"],
    TimeStop: [],
    VMove: [],
  };

  return [...baseFields, ...motionFields, ...regionFields, ...(additionalFields[moveKind] || [])];
}

/**
 * 创建默认等级配置
 */
export function createDefaultLevels(): MagicLevel[] {
  return Array.from({ length: 10 }, (_, i) => ({
    level: i + 1,
    effect: 100 * (i + 1),
    manaCost: 10 + i * 5,
    levelupExp: i < 9 ? 1000 * (i + 1) : null,
    speed: undefined,
    moveKind: undefined,
    lifeFrame: undefined,
  }));
}

/**
 * 创建默认攻击配置
 */
export function createDefaultAttackFile(): AttackFile {
  return {
    name: "",
    intro: "",
    moveKind: "SingleMove",
    speed: 8,
    region: 0,
    specialKind: "None",
    specialKindValue: 0,
    specialKindMilliSeconds: 0,
    alphaBlend: false,
    flyingLum: 0,
    vanishLum: 0,
    waitFrame: 0,
    lifeFrame: 4,
    flyingImage: null,
    flyingSound: null,
    vanishImage: null,
    vanishSound: null,
    passThrough: false,
    passThroughWall: false,
    traceEnemy: false,
    traceSpeed: 0,
    rangeRadius: 0,
    attackAll: false,
    bounce: false,
    bounceHurt: 0,
    vibratingScreen: false,
  };
}

/**
 * 创建默认武功
 */
export function createDefaultMagic(
  gameId: string,
  userType: MagicUserType = "player",
  key?: string
): Omit<Magic, "id" | "createdAt" | "updatedAt"> {
  return {
    gameId,
    userType,
    key: key ?? `magic_${Date.now()}`,
    name: "新武功",
    intro: "",
    moveKind: "SingleMove",
    speed: 8,
    region: 0,
    specialKind: "None",
    alphaBlend: false,
    flyingLum: 0,
    vanishLum: 0,
    waitFrame: 0,
    lifeFrame: 4,
    image: null,
    icon: null,
    flyingImage: null,
    flyingSound: null,
    vanishImage: null,
    vanishSound: null,
    superModeImage: null,
    belong: userType === "player" ? "Neutral" : null,
    actionFile: null,
    attackFile: null,
    levels: userType === "player" ? createDefaultLevels() : null,
    specialKindValue: 0,
    specialKindMilliSeconds: 0,
    passThrough: false,
    passThroughWall: false,
    traceEnemy: false,
    traceSpeed: 0,
    coldMilliSeconds: 0,
    rangeRadius: 0,
    attackAll: false,
    bounce: false,
    bounceHurt: 0,
    beginAtMouse: false,
    beginAtUser: false,
    vibratingScreen: false,
    explodeMagicFile: null,
    flyMagic: null,
    flyInterval: 0,
    npcFile: null,
    parasitic: false,
    parasiticMagic: null,
    parasiticInterval: 1000,
  };
}

// ========== MoveKind 标签 ==========

export const MagicMoveKindLabels: Record<MagicMoveKind, string> = {
  NoMove: "不移动",
  FixedPosition: "固定位置",
  SingleMove: "单体飞行",
  LineMove: "直线多发",
  CircleMove: "圆形扩散",
  HeartMove: "心形移动",
  SpiralMove: "螺旋移动",
  SectorMove: "扇形发射",
  RandomSector: "随机扇形",
  FixedWall: "固定墙",
  WallMove: "墙体移动",
  RegionBased: "区域类型",
  FollowCharacter: "跟随自身",
  SuperMode: "超级模式",
  FollowEnemy: "跟随敌人",
  Throw: "投掷",
  Kind19: "持续留痕",
  Transport: "传送",
  PlayerControl: "玩家控制",
  Summon: "召唤NPC",
  TimeStop: "时间停止",
  VMove: "V字移动",
};

export const MagicSpecialKindLabels: Record<MagicSpecialKind, string> = {
  None: "无",
  AddLifeOrFrozen: "加生命/冰冻",
  AddThewOrPoison: "加体力/中毒",
  BuffOrPetrify: "持续效果/石化",
  InvisibleHide: "隐身(攻击消失)",
  InvisibleShow: "隐身(攻击可见)",
  Buff: "持续效果",
  ChangeCharacter: "变身",
  RemoveAbnormal: "解除异常",
  ChangeFlyIni: "改变飞行",
};
