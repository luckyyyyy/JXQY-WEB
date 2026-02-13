/**
 * 游戏全局配置类型定义
 *
 * 包含游戏基本信息、掉落系统配置等
 * 这些配置原本硬编码在引擎代码中，现在可通过 Dashboard 编辑
 */
import { z } from "zod";

// ========== 掉落系统配置 ==========

/**
 * 单个金钱等级配置
 */
export const MoneyDropTierSchema = z.object({
  /** 等级 (1-7) */
  tier: z.number().int().min(1).max(7),
  /** 最小金额 */
  minAmount: z.number().int().min(0),
  /** 最大金额 */
  maxAmount: z.number().int().min(0),
});

export type MoneyDropTier = z.infer<typeof MoneyDropTierSchema>;

/**
 * 药品等级配置
 */
export const DrugDropTierSchema = z.object({
  /** 等级名称（如 "低级药品"） */
  name: z.string(),
  /** NPC 最大等级（<=此值时掉落该等级药品，最后一个为兜底） */
  maxLevel: z.number().int().min(0),
  /** 关联的商店 key（用于 AddRandGoods） */
  shopKey: z.string(),
});

export type DrugDropTier = z.infer<typeof DrugDropTierSchema>;

/**
 * 掉落概率配置
 */
export const DropProbabilitySchema = z.object({
  /** 武器掉落概率分母（1/N，默认 10） */
  weaponChance: z.number().int().min(1).default(10),
  /** 防具掉落概率分母（1/N，默认 10） */
  armorChance: z.number().int().min(1).default(10),
  /** 金钱掉落概率分母（1/N，默认 2） */
  moneyChance: z.number().int().min(1).default(2),
  /** 药品掉落概率分母（1/N，默认 2） */
  drugChance: z.number().int().min(1).default(2),
});

export type DropProbability = z.infer<typeof DropProbabilitySchema>;

/**
 * Boss 等级加成配置
 */
export const BossLevelBonusSchema = z.object({
  /** 概率百分比 (0-100) */
  chance: z.number().int().min(0).max(100),
  /** 额外等级加成 */
  bonus: z.number().int().min(0),
});

export type BossLevelBonus = z.infer<typeof BossLevelBonusSchema>;

/**
 * 武器/防具等级映射配置
 */
export const EquipDropTierSchema = z.object({
  /** 等级除数（NPC等级 / divisor + 1 = 掉落等级） */
  divisor: z.number().int().min(1).default(12),
  /** 最大等级 */
  maxTier: z.number().int().min(1).default(7),
});

export type EquipDropTier = z.infer<typeof EquipDropTierSchema>;

/**
 * 掉落系统完整配置
 */
export const DropConfigSchema = z.object({
  /** 普通敌人掉落概率 */
  probability: DropProbabilitySchema,
  /** 武器/防具等级映射 */
  equipTier: EquipDropTierSchema,
  /** 金钱各等级配置 */
  moneyTiers: z.array(MoneyDropTierSchema),
  /** 药品等级配置 */
  drugTiers: z.array(DrugDropTierSchema),
  /** Boss 额外等级加成（按概率从低到高排列） */
  bossLevelBonuses: z.array(BossLevelBonusSchema),
});

export type DropConfig = z.infer<typeof DropConfigSchema>;

// ========== 主角配置 ==========

/**
 * 主角初始属性
 */
export const PlayerInitialStatsSchema = z.object({
  /** 初始生命值 */
  life: z.number().int().min(1).default(1000),
  /** 初始最大生命值 */
  lifeMax: z.number().int().min(1).default(1000),
  /** 初始内力值 */
  mana: z.number().int().min(0).default(1000),
  /** 初始最大内力值 */
  manaMax: z.number().int().min(0).default(1000),
  /** 初始体力值 */
  thew: z.number().int().min(0).default(1000),
  /** 初始最大体力值 */
  thewMax: z.number().int().min(0).default(1000),
  /** 初始攻击力 */
  attack: z.number().int().min(0).default(100),
  /** 初始防御力 */
  defend: z.number().int().min(0).default(10),
  /** 初始闪避 */
  evade: z.number().int().min(0).default(10),
  /** 初始等级 */
  level: z.number().int().min(1).default(1),
  /** 初始升级所需经验 */
  levelUpExp: z.number().int().min(0).default(100),
});

export type PlayerInitialStats = z.infer<typeof PlayerInitialStatsSchema>;

/**
 * 主角体力消耗配置
 */
export const PlayerThewCostSchema = z.object({
  /** 跑步每帧消耗体力 */
  runCost: z.number().int().min(0).default(1),
  /** 攻击消耗体力 */
  attackCost: z.number().int().min(0).default(5),
  /** 跳跃消耗体力 */
  jumpCost: z.number().int().min(0).default(10),
  /** 非战斗跑步是否消耗体力 */
  useThewWhenNormalRun: z.boolean().default(false),
});

export type PlayerThewCost = z.infer<typeof PlayerThewCostSchema>;

/**
 * 主角自然恢复配置
 */
export const PlayerRestoreSchema = z.object({
  /** 站立时每秒生命恢复比例 (0-1) */
  lifeRestorePercent: z.number().min(0).max(1).default(0.01),
  /** 站立时每秒体力恢复比例 (0-1) */
  thewRestorePercent: z.number().min(0).max(1).default(0.03),
  /** 站立时每秒内力恢复比例 (0-1) */
  manaRestorePercent: z.number().min(0).max(1).default(0.02),
  /** 恢复间隔（毫秒） */
  restoreIntervalMs: z.number().int().min(100).default(1000),
  /** 打坐时内力转换间隔（毫秒） */
  sittingManaRestoreInterval: z.number().int().min(50).default(150),
});

export type PlayerRestore = z.infer<typeof PlayerRestoreSchema>;

/**
 * 主角移动速度配置
 */
export const PlayerSpeedSchema = z.object({
  /** 基础移动速度 */
  baseSpeed: z.number().int().min(1).default(100),
  /** 跑步速度倍数 */
  runSpeedFold: z.number().int().min(1).default(8),
  /** 最低减速百分比 (-100 ~ 0) */
  minChangeMoveSpeedPercent: z.number().int().min(-100).max(0).default(-90),
});

export type PlayerSpeed = z.infer<typeof PlayerSpeedSchema>;

/**
 * 主角战斗参数
 */
export const PlayerCombatSchema = z.object({
  /** 脱战时间（秒） */
  maxNonFightSeconds: z.number().int().min(1).default(7),
  /** 对话交互半径（格） */
  dialogRadius: z.number().int().min(1).default(3),
});

export type PlayerCombat = z.infer<typeof PlayerCombatSchema>;

/**
 * 主角完整配置
 */
export const PlayerConfigSchema = z.object({
  /** 体力消耗 */
  thewCost: PlayerThewCostSchema,
  /** 自然恢复 */
  restore: PlayerRestoreSchema,
  /** 移动速度 */
  speed: PlayerSpeedSchema,
  /** 战斗参数 */
  combat: PlayerCombatSchema,
});

export type PlayerConfig = z.infer<typeof PlayerConfigSchema>;

// ========== 武功经验配置 ==========

/**
 * 武功经验等级条目
 */
export const MagicExpLevelEntrySchema = z.object({
  /** 敌人等级 */
  level: z.number().int().min(0),
  /** 命中获得经验值 */
  exp: z.number().int().min(0),
});

export type MagicExpLevelEntry = z.infer<typeof MagicExpLevelEntrySchema>;

/**
 * 武功经验配置（原 MagicExp.ini）
 */
export const MagicExpConfigSchema = z.object({
  /** 根据敌人等级获得的武功经验值列表 */
  expByLevel: z.array(MagicExpLevelEntrySchema),
  /** 修炼武功经验倍率 (0-1)，默认 0.2222 */
  xiuLianMagicExpFraction: z.number().min(0).max(1).default(0.2222),
  /** 使用武功经验倍率 (0-1)，默认 0.0333 */
  useMagicExpFraction: z.number().min(0).max(1).default(0.0333),
});

export type MagicExpConfig = z.infer<typeof MagicExpConfigSchema>;

// ========== 游戏全局配置 ==========

/**
 * 游戏全局配置 Schema
 */
export const GameConfigDataSchema = z.object({
  /** 游戏是否开放（关闭后 /api/data 不可访问，游戏无法启动） */
  gameEnabled: z.boolean().default(false),
  /** 游戏名称 */
  gameName: z.string().default("月影传说"),
  /** 游戏版本 */
  gameVersion: z.string().default("1.0.0"),
  /** 游戏描述 */
  gameDescription: z.string().default(""),
  /** 游戏 Logo 路径（上传后由服务端填充） */
  logoUrl: z.string().default(""),
  /** 游戏主角（players 表中的 key，如 Player0.ini） */
  playerKey: z.string().default(""),
  /** 初始地图（新游戏加载的地图文件名，如 map_002_凌绝峰峰顶.map） */
  initialMap: z.string().default(""),
  /** 初始 NPC 文件（新游戏加载的 NPC 文件名，如 map002.npc） */
  initialNpc: z.string().default(""),
  /** 初始物体文件（新游戏加载的 OBJ 文件名，如 map002_obj.obj） */
  initialObj: z.string().default(""),
  /** 初始背景音乐（新游戏加载的 BGM 文件名，留空则无背景音乐） */
  initialBgm: z.string().default(""),
  /** 标题界面背景音乐（Title 画面播放的音乐文件名，留空则无音乐） */
  titleMusic: z.string().default(""),
  /** 新游戏触发脚本内容 */
  newGameScript: z.string().default(""),
  /** 对话头像 ASF 路径 */
  portraitAsf: z.string().default(""),
  /** 游戏设置（设置 playerKey 后生效） */
  player: PlayerConfigSchema.optional(),
  /** 掉落系统配置（设置 playerKey 后生效） */
  drop: DropConfigSchema.optional(),
  /** 武功经验配置（原 MagicExp.ini） */
  magicExp: MagicExpConfigSchema.optional(),
});

export type GameConfigData = z.infer<typeof GameConfigDataSchema>;

/**
 * Dashboard 前端用的完整配置类型（player/drop 始终存在）
 * 用于编辑界面，保证字段总是有值
 */
export type GameConfigDataFull = Omit<GameConfigData, "player" | "drop" | "magicExp"> & {
  player: PlayerConfig;
  drop: DropConfig;
  magicExp: MagicExpConfig;
};

/**
 * 将 API 返回的可选配置合并为完整配置（补全默认值）
 */
export function mergeGameConfig(data?: Partial<GameConfigData>): GameConfigDataFull {
  const defaults = createDefaultGameConfig();
  return {
    ...defaults,
    ...data,
    player: {
      ...createDefaultPlayerConfig(),
      ...(data?.player ?? {}),
    },
    drop: {
      ...createDefaultDropConfig(),
      ...(data?.drop ?? {}),
    },
    magicExp: {
      ...createDefaultMagicExpConfig(),
      ...(data?.magicExp ?? {}),
    },
  };
}

/**
 * 完整的游戏配置（含 DB 元字段）
 */
export const GameConfigSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  data: GameConfigDataSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GameConfig = z.infer<typeof GameConfigSchema>;

// ========== API 输入 Schema ==========

export const GetGameConfigInputSchema = z.object({
  gameId: z.string().uuid(),
});

export type GetGameConfigInput = z.infer<typeof GetGameConfigInputSchema>;

export const UpdateGameConfigInputSchema = z.object({
  gameId: z.string().uuid(),
  data: GameConfigDataSchema,
});

export type UpdateGameConfigInput = z.infer<typeof UpdateGameConfigInputSchema>;

// ========== 默认值工厂 ==========

/**
 * 创建默认的掉落配置（与原始硬编码值一致）
 */
export function createDefaultDropConfig(): DropConfig {
  return {
    probability: {
      weaponChance: 10,
      armorChance: 10,
      moneyChance: 2,
      drugChance: 2,
    },
    equipTier: {
      divisor: 12,
      maxTier: 7,
    },
    moneyTiers: [
      { tier: 1, minAmount: 10, maxAmount: 40 },
      { tier: 2, minAmount: 50, maxAmount: 80 },
      { tier: 3, minAmount: 90, maxAmount: 120 },
      { tier: 4, minAmount: 130, maxAmount: 160 },
      { tier: 5, minAmount: 170, maxAmount: 200 },
      { tier: 6, minAmount: 210, maxAmount: 240 },
      { tier: 7, minAmount: 250, maxAmount: 280 },
    ],
    drugTiers: [
      { name: "低级药品", maxLevel: 10, shopKey: "低级药品" },
      { name: "中级药品", maxLevel: 30, shopKey: "中级药品" },
      { name: "高级药品", maxLevel: 60, shopKey: "高级药品" },
      { name: "特级药品", maxLevel: 999, shopKey: "特级药品" },
    ],
    bossLevelBonuses: [
      { chance: 10, bonus: 0 },
      { chance: 50, bonus: 12 },
      { chance: 40, bonus: 24 },
    ],
  };
}

/**
 * 创建默认的游戏全局配置
 */
export function createDefaultPlayerConfig(): PlayerConfig {
  return {
    thewCost: {
      runCost: 1,
      attackCost: 5,
      jumpCost: 10,
      useThewWhenNormalRun: false,
    },
    restore: {
      lifeRestorePercent: 0.01,
      thewRestorePercent: 0.03,
      manaRestorePercent: 0.02,
      restoreIntervalMs: 1000,
      sittingManaRestoreInterval: 150,
    },
    speed: {
      baseSpeed: 100,
      runSpeedFold: 8,
      minChangeMoveSpeedPercent: -90,
    },
    combat: {
      maxNonFightSeconds: 7,
      dialogRadius: 3,
    },
  };
}

export function createDefaultGameConfig(): GameConfigData {
  return {
    gameEnabled: false,
    gameName: "月影传说",
    gameVersion: "1.0.0",
    gameDescription: "",
    logoUrl: "",
    playerKey: "",
    initialMap: "",
    initialNpc: "",
    initialObj: "",
    initialBgm: "",
    titleMusic: "",
    newGameScript: "",
    portraitAsf: "",
  };
}

/**
 * 创建默认的武功经验配置（与原 MagicExp.ini 一致）
 */
export function createDefaultMagicExpConfig(): MagicExpConfig {
  const expByLevel: MagicExpLevelEntry[] = [
    { level: 0, exp: 3 }, { level: 1, exp: 3 }, { level: 2, exp: 3 }, { level: 3, exp: 3 },
    { level: 4, exp: 3 }, { level: 5, exp: 3 }, { level: 6, exp: 4 }, { level: 7, exp: 4 },
    { level: 8, exp: 4 }, { level: 9, exp: 4 }, { level: 10, exp: 5 }, { level: 11, exp: 5 },
    { level: 12, exp: 5 }, { level: 13, exp: 6 }, { level: 14, exp: 6 }, { level: 15, exp: 6 },
    { level: 16, exp: 7 }, { level: 17, exp: 7 }, { level: 18, exp: 8 }, { level: 19, exp: 8 },
    { level: 20, exp: 9 }, { level: 21, exp: 9 }, { level: 22, exp: 10 }, { level: 23, exp: 11 },
    { level: 24, exp: 11 }, { level: 25, exp: 12 }, { level: 26, exp: 13 }, { level: 27, exp: 13 },
    { level: 28, exp: 14 }, { level: 29, exp: 15 }, { level: 30, exp: 16 }, { level: 31, exp: 17 },
    { level: 32, exp: 18 }, { level: 33, exp: 19 }, { level: 34, exp: 21 }, { level: 35, exp: 22 },
    { level: 36, exp: 23 }, { level: 37, exp: 25 }, { level: 38, exp: 26 }, { level: 39, exp: 28 },
    { level: 40, exp: 30 }, { level: 41, exp: 32 }, { level: 42, exp: 33 }, { level: 43, exp: 36 },
    { level: 44, exp: 38 }, { level: 45, exp: 40 }, { level: 46, exp: 43 }, { level: 47, exp: 45 },
    { level: 48, exp: 48 }, { level: 49, exp: 51 }, { level: 50, exp: 54 }, { level: 51, exp: 57 },
    { level: 52, exp: 61 }, { level: 53, exp: 65 }, { level: 54, exp: 69 }, { level: 55, exp: 73 },
    { level: 56, exp: 77 }, { level: 57, exp: 82 }, { level: 58, exp: 87 }, { level: 59, exp: 93 },
    { level: 60, exp: 98 }, { level: 61, exp: 104 }, { level: 62, exp: 111 }, { level: 63, exp: 117 },
    { level: 64, exp: 125 }, { level: 65, exp: 132 }, { level: 66, exp: 140 }, { level: 67, exp: 149 },
    { level: 68, exp: 158 }, { level: 69, exp: 169 }, { level: 70, exp: 178 }, { level: 71, exp: 189 },
    { level: 72, exp: 200 }, { level: 73, exp: 213 },
  ];
  return {
    expByLevel,
    xiuLianMagicExpFraction: 0.2222,
    useMagicExpFraction: 0.0333,
  };
}
