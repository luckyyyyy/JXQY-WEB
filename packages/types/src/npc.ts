/**
 * NPC 系统类型定义
 * 用于前后端共享的 Zod Schema
 *
 * NPC 配置合并了两个 INI 文件：
 * - npc/*.ini - NPC 实例配置（属性、行为、脚本）
 * - npcres/*.ini - NPC 资源配置（各状态的 ASF 动画和音效）
 */
import { z } from "zod";

// ========== 枚举定义 ==========

/**
 * NPC 类型
 * 决定 NPC 的行为模式和 AI
 */
export const NpcKindEnum = z.enum([
  "Normal", // C# Normal=0 - 普通 NPC（可对话）
  "Fighter", // C# Fighter=1 - 战斗型 NPC
  "Follower", // C# Follower=3 - 跟随者
  "GroundAnimal", // C# GroundAnimal=4 - 地面动物（如狼、蛙）
  "Eventer", // C# Eventer=5 - 事件/装饰性 NPC
  "AfraidPlayerAnimal", // C# AfraidPlayerAnimal=6 - 怕玩家的动物
  "Flyer", // C# Flyer=7 - 飞行类（如蝙蝠、蜜蜂）
]);

export type NpcKind = z.infer<typeof NpcKindEnum>;

export const NpcKindValues: Record<NpcKind, number> = {
  Normal: 0,
  Fighter: 1,
  Follower: 3,
  GroundAnimal: 4,
  Eventer: 5,
  AfraidPlayerAnimal: 6,
  Flyer: 7,
};

export const NpcKindFromValue: Record<number, NpcKind> = Object.fromEntries(
  Object.entries(NpcKindValues).map(([k, v]) => [v, k as NpcKind])
) as Record<number, NpcKind>;

export const NpcKindLabels: Record<NpcKind, string> = {
  Normal: "普通NPC",
  Fighter: "战斗型",
  Follower: "跟随者",
  GroundAnimal: "地面动物",
  Eventer: "事件/装饰",
  AfraidPlayerAnimal: "怕人动物",
  Flyer: "飞行类",
};

/**
 * NPC 关系类型
 * 决定 NPC 与玩家的交互方式
 */
export const NpcRelationEnum = z.enum([
  "Friend", // C# Friend=0 - 友好（可对话、不可攻击）
  "Enemy", // C# Enemy=1 - 敌对（主动攻击玩家）
  "Neutral", // C# Neutral=2 - 中立（不主动攻击）
  "None", // C# None=3 - 攻击所有非同阵营
]);

export type NpcRelation = z.infer<typeof NpcRelationEnum>;

export const NpcRelationValues: Record<NpcRelation, number> = {
  Friend: 0,
  Enemy: 1,
  Neutral: 2,
  None: 3,
};

export const NpcRelationFromValue: Record<number, NpcRelation> = Object.fromEntries(
  Object.entries(NpcRelationValues).map(([k, v]) => [v, k as NpcRelation])
) as Record<number, NpcRelation>;

export const NpcRelationLabels: Record<NpcRelation, string> = {
  Friend: "友好",
  Enemy: "敌对",
  Neutral: "中立",
  None: "无阵营",
};

/**
 * NPC 状态类型
 * 用于资源配置（npcres）
 */
export const NpcStateEnum = z.enum([
  "Stand", // 站立
  "Stand1", // 待机动画
  "Walk", // 行走
  "Run", // 奔跑
  "Jump", // 跳跃（轻功）
  "FightStand", // 战斗站立
  "FightWalk", // 战斗行走
  "FightRun", // 战斗奔跑
  "FightJump", // 战斗跳跃
  "Attack", // 攻击
  "Attack1", // 攻击2
  "Attack2", // 攻击3
  "Hurt", // 受伤
  "Death", // 死亡
  "Sit", // 坐下
  "Magic", // 特殊动作1（原 Magic）
  "Special", // 特殊动作2（原 Special）
]);

export type NpcState = z.infer<typeof NpcStateEnum>;

export const NpcStateLabels: Record<NpcState, string> = {
  Stand: "站立",
  Stand1: "待机",
  Walk: "行走",
  Run: "奔跑",
  Jump: "跳跃",
  FightStand: "战斗站立",
  FightWalk: "战斗行走",
  FightRun: "战斗奔跑",
  FightJump: "战斗跳跃",
  Attack: "攻击",
  Attack1: "攻击2",
  Attack2: "攻击3",
  Hurt: "受伤",
  Death: "死亡",
  Sit: "坐下",
  Magic: "施法",
  Special: "特殊",
};

// ========== 资源配置 Schema ==========

/**
 * 单个状态的资源配置
 */
export const NpcStateResourceSchema = z.object({
  /** ASF 动画文件路径 */
  image: z.string().nullable().optional(),
  /** 音效文件路径 */
  sound: z.string().nullable().optional(),
});

export type NpcStateResource = z.infer<typeof NpcStateResourceSchema>;

/**
 * NPC 资源配置（原 npcres/*.ini）
 * 定义各状态对应的动画和音效
 */
export const NpcResourceSchema = z.object({
  stand: NpcStateResourceSchema.optional(),
  stand1: NpcStateResourceSchema.optional(),
  walk: NpcStateResourceSchema.optional(),
  run: NpcStateResourceSchema.optional(),
  jump: NpcStateResourceSchema.optional(),
  fightStand: NpcStateResourceSchema.optional(),
  fightWalk: NpcStateResourceSchema.optional(),
  fightRun: NpcStateResourceSchema.optional(),
  fightJump: NpcStateResourceSchema.optional(),
  attack: NpcStateResourceSchema.optional(),
  attack1: NpcStateResourceSchema.optional(),
  attack2: NpcStateResourceSchema.optional(),
  hurt: NpcStateResourceSchema.optional(),
  death: NpcStateResourceSchema.optional(),
  sit: NpcStateResourceSchema.optional(),
  special1: NpcStateResourceSchema.optional(),
  special2: NpcStateResourceSchema.optional(),
});

export type NpcResource = z.infer<typeof NpcResourceSchema>;

// ========== NPC 主配置 Schema ==========

/**
 * NPC 基础 Schema（不包含数据库字段）
 */
export const NpcBaseSchema = z.object({
  // === 基本信息 ===
  /** NPC 显示名称 */
  name: z.string(),
  /** NPC 描述/介绍 */
  intro: z.string().optional(),

  // === 类型和关系 ===
  /** NPC 类型 */
  kind: NpcKindEnum.optional().default("Normal"),
  /** 与玩家的关系 */
  relation: NpcRelationEnum.optional().default("Friend"),
  /** 分组编号（同组NPC不会互相攻击） */
  group: z.number().int().nullable().optional(),

  // === 属性 ===
  /** 等级（负数表示相对玩家等级） */
  level: z.number().int().optional().default(1),
  /** 当前生命值 */
  life: z.number().int().optional().default(100),
  /** 最大生命值 */
  lifeMax: z.number().int().optional().default(100),
  /** 当前体力 */
  thew: z.number().int().optional().default(100),
  /** 最大体力 */
  thewMax: z.number().int().optional().default(100),
  /** 当前内力 */
  mana: z.number().int().optional().default(100),
  /** 最大内力 */
  manaMax: z.number().int().optional().default(100),
  /** 攻击力 */
  attack: z.number().int().optional().default(10),
  /** 攻击力2 */
  attack2: z.number().int().nullable().optional(),
  /** 攻击力3 */
  attack3: z.number().int().nullable().optional(),
  /** 防御力 */
  defend: z.number().int().optional().default(5),
  /** 防御力2 */
  defend2: z.number().int().nullable().optional(),
  /** 防御力3 */
  defend3: z.number().int().nullable().optional(),
  /** 闪避值 */
  evade: z.number().int().optional().default(10),
  /** 击杀经验值 */
  exp: z.number().int().optional().default(0),
  /** 经验值加成 */
  expBonus: z.number().int().optional().default(0),
  /** 升级所需经验 */
  levelUpExp: z.number().int().nullable().optional(),
  /** 是否可升级（0/1） */
  canLevelUp: z.number().int().nullable().optional(),

  // === 行为配置 ===
  /** 移动速度 */
  walkSpeed: z.number().int().optional().default(1),
  /** 移动速度百分比加成 */
  addMoveSpeedPercent: z.number().int().nullable().optional(),
  /** 初始方向（0-7） */
  dir: z.number().int().min(0).max(7).optional().default(0),
  /** 亮度/透明度 */
  lum: z.number().int().optional().default(0),
  /** 攻击范围（格子数） */
  attackRadius: z.number().int().optional().default(1),
  /** 攻击等级 */
  attackLevel: z.number().int().optional().default(1),
  /** 寻路类型（0=简单，1=完整A*） */
  pathFinder: z.number().int().min(0).max(1).optional().default(1),
  /** 攻击间隔（帧） */
  idle: z.number().int().optional().default(0),
  /** 视野半径（格子数，默认9） */
  visionRadius: z.number().int().nullable().optional(),
  /** 对话触发半径（格子数，默认1） */
  dialogRadius: z.number().int().nullable().optional(),
  /** 行为模式（0=站立, 1=随机走, 2=循环巡逻） */
  action: z.number().int().nullable().optional(),
  /** 固定巡逻路径点（如 "x1,y1;x2,y2"） */
  fixedPos: z.string().nullable().optional(),

  // === AI 配置 ===
  /** AI类型（0=正常, 1=随机移动+攻击, 2=随机移动不战斗） */
  aiType: z.number().int().nullable().optional(),
  /** 禁止自动攻击玩家（0/1） */
  noAutoAttackPlayer: z.number().int().nullable().optional(),
  /** 无敌状态（0/1） */
  invincible: z.number().int().nullable().optional(),
  /** 停止寻找目标（0/1） */
  stopFindingTarget: z.number().int().nullable().optional(),
  /** 低血量时保持距离 */
  keepRadiusWhenLifeLow: z.number().int().nullable().optional(),
  /** 触发低血量行为的百分比（默认20） */
  lifeLowPercent: z.number().int().nullable().optional(),
  /** 友方死亡时保持距离 */
  keepRadiusWhenFriendDeath: z.number().int().nullable().optional(),
  /** 保持攻击X坐标 */
  keepAttackX: z.number().int().nullable().optional(),
  /** 保持攻击Y坐标 */
  keepAttackY: z.number().int().nullable().optional(),

  // === 关联配置 ===
  /** 飞行攻击配置（关联 magic 表的 key） */
  flyIni: z.string().nullable().optional(),
  /** 第二飞行武功配置 */
  flyIni2: z.string().nullable().optional(),
  /** 多武功距离配置（如 "magic:dist;magic2:dist2"） */
  flyInis: z.string().nullable().optional(),
  /** 死亡后生成的物体 */
  bodyIni: z.string().nullable().optional(),
  /** 死亡时执行的脚本 */
  deathScript: z.string().nullable().optional(),
  /** 交互/对话脚本 */
  scriptFile: z.string().nullable().optional(),
  /** 右键交互脚本 */
  scriptFileRight: z.string().nullable().optional(),
  /** 定时脚本文件 */
  timerScriptFile: z.string().nullable().optional(),
  /** 定时脚本间隔（毫秒） */
  timerScriptInterval: z.number().int().nullable().optional(),
  /** 可否直接交互（不需走近，0/1） */
  canInteractDirectly: z.number().int().nullable().optional(),

  // === 掉落与商店 ===
  /** 掉落配置文件 */
  dropIni: z.string().nullable().optional(),
  /** 死亡时不掉落物品（0/1） */
  noDropWhenDie: z.number().int().nullable().optional(),
  /** 商店配置文件 */
  buyIniFile: z.string().nullable().optional(),
  /** 商店配置内容（Base64编码） */
  buyIniString: z.string().nullable().optional(),

  // === 低血量/被攻击/死亡武功 ===
  /** 生命低时自动使用的武功 */
  magicToUseWhenLifeLow: z.string().nullable().optional(),
  /** 被攻击时自动使用的武功 */
  magicToUseWhenBeAttacked: z.string().nullable().optional(),
  /** 被攻击时武功方向 */
  magicDirectionWhenBeAttacked: z.number().int().nullable().optional(),
  /** 死亡时自动使用的武功 */
  magicToUseWhenDeath: z.string().nullable().optional(),
  /** 死亡时武功方向 */
  magicDirectionWhenDeath: z.number().int().nullable().optional(),

  // === 可见性控制 ===
  /** 控制NPC可见性的脚本变量名 */
  visibleVariableName: z.string().nullable().optional(),
  /** 控制NPC可见性的变量值 */
  visibleVariableValue: z.number().int().nullable().optional(),

  // === 复活与接触伤害 ===
  /** 复活时间（毫秒） */
  reviveMilliseconds: z.number().int().nullable().optional(),
  /** 接触伤害间隔（毫秒） */
  hurtPlayerInterval: z.number().int().nullable().optional(),
  /** 接触伤害值 */
  hurtPlayerLife: z.number().int().nullable().optional(),
  /** 接触伤害半径（默认1） */
  hurtPlayerRadius: z.number().int().nullable().optional(),

  // === 等级配置 ===
  /** 等级配置文件路径 */
  levelIniFile: z.string().nullable().optional(),

  // === 装备 ===
  /** NPC是否可装备物品（0/1） */
  canEquip: z.number().int().nullable().optional(),
  /** 头部装备 */
  headEquip: z.string().nullable().optional(),
  /** 颈部装备 */
  neckEquip: z.string().nullable().optional(),
  /** 身体装备 */
  bodyEquip: z.string().nullable().optional(),
  /** 背部装备 */
  backEquip: z.string().nullable().optional(),
  /** 手部装备 */
  handEquip: z.string().nullable().optional(),
  /** 腕部装备 */
  wristEquip: z.string().nullable().optional(),
  /** 脚部装备 */
  footEquip: z.string().nullable().optional(),
  /** 背景纹理装备 */
  backgroundTextureEquip: z.string().nullable().optional(),

  // === 状态 ===
  /** 中毒来源角色名 */
  poisonByCharacterName: z.string().nullable().optional(),

  // === 资源配置（关联 npc_resources 表，向后兼容也可以内嵌） ===
  /** 关联的资源配置 ID */
  resourceId: z.string().uuid().nullable().optional(),
  /** NPC 各状态的动画和音效资源（内嵌资源，优先使用 resourceId 关联） */
  resources: NpcResourceSchema.optional(),
});

export type NpcBase = z.infer<typeof NpcBaseSchema>;

/**
 * 完整 NPC Schema（包含数据库字段）
 */
export const NpcSchema = NpcBaseSchema.extend({
  /** 数据库 ID */
  id: z.string().uuid(),
  /** 所属游戏 ID */
  gameId: z.string().uuid(),
  /** 唯一标识符（文件名） */
  key: z.string(),
  /** 创建时间 */
  createdAt: z.string().datetime(),
  /** 更新时间 */
  updatedAt: z.string().datetime(),
});

export type Npc = z.infer<typeof NpcSchema>;

// ========== NPC 资源配置表 Schema ==========

/**
 * NPC 资源配置（原 npcres/*.ini）
 * 独立的表，可被多个 NPC 引用
 */
export const NpcResSchema = z.object({
  /** 数据库 ID */
  id: z.string().uuid(),
  /** 所属游戏 ID */
  gameId: z.string().uuid(),
  /** 唯一标识符（文件名） */
  key: z.string(),
  /** 资源名称 */
  name: z.string(),
  /** 各状态的动画和音效资源 */
  resources: NpcResourceSchema,
  /** 创建时间 */
  createdAt: z.string().datetime(),
  /** 更新时间 */
  updatedAt: z.string().datetime(),
});

export type NpcRes = z.infer<typeof NpcResSchema>;

// 兼容旧名称

/**
 * NPC 资源列表项（简化版，用于列表展示）
 */
export const NpcResListItemSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  /** 站立动画图标（用于列表展示） */
  icon: z.string().nullable().optional(),
  updatedAt: z.string().datetime(),
});

export type NpcResListItem = z.infer<typeof NpcResListItemSchema>;

// 兼容旧名称

/**
 * NPC 列表项（简化版，用于列表展示）
 */
export const NpcListItemSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  kind: NpcKindEnum,
  relation: NpcRelationEnum,
  level: z.number().int().optional(),
  /** 资源文件名（npcRes key），与 SceneNpcEntry.npcIni 一致 */
  npcIni: z.string(),
  /** 站立动画图标（用于列表展示） */
  icon: z.string().nullable().optional(),
  updatedAt: z.string().datetime(),
});

export type NpcListItem = z.infer<typeof NpcListItemSchema>;

// ========== API 输入 Schema ==========

export const ListNpcInputSchema = z.object({
  gameId: z.string().uuid(),
  /** 按类型过滤 */
  kind: NpcKindEnum.optional(),
  /** 按关系过滤 */
  relation: NpcRelationEnum.optional(),
});

export type ListNpcInput = z.infer<typeof ListNpcInputSchema>;

export const GetNpcInputSchema = z.object({
  gameId: z.string().uuid(),
  id: z.string().uuid(),
});

export type GetNpcInput = z.infer<typeof GetNpcInputSchema>;

export const CreateNpcInputSchema = z
  .object({
    gameId: z.string().uuid(),
    key: z.string(),
    name: z.string(),
    kind: NpcKindEnum.optional(),
    relation: NpcRelationEnum.optional(),
    resourceId: z.string().uuid().nullable().optional(),
  })
  .merge(NpcBaseSchema.partial());

export type CreateNpcInput = z.infer<typeof CreateNpcInputSchema>;

export const UpdateNpcInputSchema = z
  .object({
    id: z.string().uuid(),
    gameId: z.string().uuid(),
  })
  .merge(NpcBaseSchema.partial());

export type UpdateNpcInput = z.infer<typeof UpdateNpcInputSchema>;

export const DeleteNpcInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type DeleteNpcInput = z.infer<typeof DeleteNpcInputSchema>;

// ========== NPC 资源 API 输入 Schema ==========

export const ListNpcResInputSchema = z.object({
  gameId: z.string().uuid(),
});

export type ListNpcResInput = z.infer<typeof ListNpcResInputSchema>;

// 兼容旧名称

export const GetNpcResInputSchema = z.object({
  gameId: z.string().uuid(),
  id: z.string().uuid(),
});

export type GetNpcResInput = z.infer<typeof GetNpcResInputSchema>;

// 兼容旧名称

export const CreateNpcResInputSchema = z.object({
  gameId: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  resources: NpcResourceSchema.optional(),
});

export type CreateNpcResInput = z.infer<typeof CreateNpcResInputSchema>;

// 兼容旧名称

export const UpdateNpcResInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  key: z.string().optional(),
  name: z.string().optional(),
  resources: NpcResourceSchema.optional(),
});

export type UpdateNpcResInput = z.infer<typeof UpdateNpcResInputSchema>;

// 兼容旧名称

export const DeleteNpcResInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type DeleteNpcResInput = z.infer<typeof DeleteNpcResInputSchema>;

// 兼容旧名称

/**
 * 单个 NPC 导入项（包含 npc 和 npcres 内容）
 */
export const ImportNpcItemSchema = z.object({
  /** NPC 配置文件名 */
  fileName: z.string(),
  /** 导入类型：npc = NPC配置, resource = 独立资源配置 */
  type: z.enum(["npc", "resource"]).default("npc"),
  /** NPC 配置内容（npc/*.ini），type=npc 时必填 */
  iniContent: z.string().optional(),
  /** NPC 资源配置内容（npcres/*.ini，type=npc 时可选会自动关联，type=resource 时必填） */
  npcResContent: z.string().optional(),
});

export type ImportNpcItem = z.infer<typeof ImportNpcItemSchema>;

export const ImportNpcInputSchema = z.object({
  gameId: z.string().uuid(),
  fileName: z.string(),
  type: z.enum(["npc", "resource"]).default("npc"),
  iniContent: z.string().optional(),
  npcResContent: z.string().optional(),
});

export type ImportNpcInput = z.infer<typeof ImportNpcInputSchema>;

export const BatchImportNpcInputSchema = z.object({
  gameId: z.string().uuid(),
  items: z.array(ImportNpcItemSchema),
});

export type BatchImportNpcInput = z.infer<typeof BatchImportNpcInputSchema>;

export const BatchImportNpcResultSchema = z.object({
  success: z.array(
    z.object({
      fileName: z.string(),
      id: z.string().uuid(),
      name: z.string(),
      /** npc 或 resource */
      type: z.enum(["npc", "resource"]),
      hasResources: z.boolean(),
    })
  ),
  failed: z.array(
    z.object({
      fileName: z.string(),
      error: z.string(),
    })
  ),
});

export type BatchImportNpcResult = z.infer<typeof BatchImportNpcResultSchema>;

// ========== 工具函数 ==========

/**
 * 创建默认 NPC 配置
 */
export function createDefaultNpc(gameId?: string, key?: string): Partial<Npc> {
  return {
    id: undefined,
    gameId,
    key: key || `npc_${Date.now()}`,
    name: "新NPC",
    kind: "Normal",
    relation: "Friend",
    level: 1,
    life: 100,
    lifeMax: 100,
    thew: 100,
    thewMax: 100,
    mana: 100,
    manaMax: 100,
    attack: 10,
    defend: 5,
    evade: 10,
    exp: 0,
    walkSpeed: 1,
    dir: 0,
    attackRadius: 1,
    pathFinder: 1,
    resources: {
      stand: { image: null, sound: null },
      walk: { image: null, sound: null },
      attack: { image: null, sound: null },
      hurt: { image: null, sound: null },
      death: { image: null, sound: null },
    },
  };
}

/**
 * 创建默认 NPC 资源配置
 */
export function createDefaultNpcResource(): NpcResource {
  return {
    stand: { image: null, sound: null },
    stand1: { image: null, sound: null },
    walk: { image: null, sound: null },
    run: { image: null, sound: null },
    jump: { image: null, sound: null },
    fightStand: { image: null, sound: null },
    fightWalk: { image: null, sound: null },
    fightRun: { image: null, sound: null },
    fightJump: { image: null, sound: null },
    attack: { image: null, sound: null },
    attack1: { image: null, sound: null },
    attack2: { image: null, sound: null },
    hurt: { image: null, sound: null },
    death: { image: null, sound: null },
    sit: { image: null, sound: null },
    special1: { image: null, sound: null },
    special2: { image: null, sound: null },
  };
}

// ========== 资源路径规范化 ==========

/**
 * NPC 资源路径默认前缀
 * 参考 C# 引擎 ResFile.cs
 */
export const NpcResourcePaths = {
  /** ASF 图像默认路径 */
  image: "asf/character/",
  /** 备用 ASF 路径（如 character 中找不到） */
  imageFallback: "asf/interlude/",
  /** 音效默认路径（XNB 格式） */
  sound: "content/sound/",
} as const;

/**
 * 获取 NPC 图像的候选路径列表（含回退路径，与引擎 loadCharacterAsf 一致）
 * - 已经是完整路径（asf/ 或 mpc/ 开头）：返回单个路径
 * - 相对路径：返回 [asf/character/xxx, asf/interlude/xxx]
 */
export function getNpcImageCandidates(imagePath: string | null | undefined): string[] {
  if (!imagePath) return [];

  let path = imagePath.trim();
  if (!path) return [];

  // 规范化路径分隔符
  path = path.replace(/\\/g, "/");

  // 移除开头的斜杠
  if (path.startsWith("/")) {
    path = path.slice(1);
  }

  const lowerPath = path.toLowerCase();

  // 已经是完整路径，直接返回
  if (lowerPath.startsWith("asf/") || lowerPath.startsWith("mpc/")) {
    return [lowerPath];
  }

  // 相对路径：尝试 character 和 interlude 两个目录
  return [`${NpcResourcePaths.image}${lowerPath}`, `${NpcResourcePaths.imageFallback}${lowerPath}`];
}

/**
 * 规范化 NPC 图像路径
 * - 绝对路径（以 asf/ 或 mpc/ 开头）：保持不变
 * - 相对路径：添加 asf/character/ 前缀
 * - 统一转为小写
 */
export function normalizeNpcImagePath(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;

  let path = imagePath.trim();
  if (!path) return null;

  // 规范化路径分隔符
  path = path.replace(/\\/g, "/");

  // 移除开头的斜杠
  if (path.startsWith("/")) {
    path = path.slice(1);
  }

  // 判断是否是绝对路径
  const lowerPath = path.toLowerCase();
  if (lowerPath.startsWith("asf/") || lowerPath.startsWith("mpc/")) {
    return path.toLowerCase();
  }

  // 相对路径：添加默认前缀
  return `${NpcResourcePaths.image}${path}`.toLowerCase();
}

/**
 * 规范化 NPC 音效路径
 * - 绝对路径（以 content/ 或 sound/ 开头）：保持不变
 * - 相对路径：添加 content/sound/ 前缀
 * - 扩展名：wav -> xnb
 */
export function normalizeNpcSoundPath(soundPath: string | null | undefined): string | null {
  if (!soundPath) return null;

  let path = soundPath.trim();
  if (!path) return null;

  // 规范化路径分隔符
  path = path.replace(/\\/g, "/");

  // 移除开头的斜杠
  if (path.startsWith("/")) {
    path = path.slice(1);
  }

  // 判断是否是绝对路径
  const lowerPath = path.toLowerCase();
  if (lowerPath.startsWith("content/") || lowerPath.startsWith("sound/")) {
    // 替换 .wav 为 .xnb
    return path.toLowerCase().replace(/\.wav$/i, ".xnb");
  }

  // 相对路径：去掉扩展名，添加默认前缀和 .xnb 扩展名
  // C# 引擎: Path.GetFileNameWithoutExtension(wavFileName)
  const baseName = path.replace(/\.[^/.]+$/, "");
  return `${NpcResourcePaths.sound}${baseName}.xnb`.toLowerCase();
}

/**
 * 规范化整个 NpcResource 对象中的路径
 */
export function normalizeNpcResourcePaths(resource: NpcResource): NpcResource {
  const result: NpcResource = {};

  for (const [state, stateResource] of Object.entries(resource)) {
    if (stateResource) {
      result[state as keyof NpcResource] = {
        image: normalizeNpcImagePath(stateResource.image),
        sound: normalizeNpcSoundPath(stateResource.sound),
      };
    }
  }

  return result;
}

/**
 * 根据 NPC 类型获取可见字段列表
 */
export function getVisibleFieldsByNpcKind(kind: NpcKind): string[] {
  const baseFields = [
    "name",
    "intro",
    "kind",
    "relation",
    "level",
    "life",
    "lifeMax",
    "walkSpeed",
    "dir",
    "scriptFile",
  ];

  switch (kind) {
    case "Fighter":
      return [
        ...baseFields,
        "thew",
        "thewMax",
        "mana",
        "manaMax",
        "attack",
        "defend",
        "evade",
        "exp",
        "expBonus",
        "attackRadius",
        "attackLevel",
        "pathFinder",
        "idle",
        "flyIni",
        "bodyIni",
        "deathScript",
      ];

    case "Flyer":
    case "GroundAnimal":
      return [
        ...baseFields,
        "attack",
        "defend",
        "evade",
        "exp",
        "attackRadius",
        "pathFinder",
        "flyIni",
        "bodyIni",
        "deathScript",
      ];

    case "Eventer":
    case "AfraidPlayerAnimal":
      return baseFields;
    case "Follower":
      return [...baseFields, "thew", "thewMax", "mana", "manaMax"];
    default:
      return [...baseFields, "thew", "thewMax", "mana", "manaMax"];
  }
}

/**
 * NpcState（PascalCase）→ NpcResource key（camelCase）转换
 * 例: "FightStand" → "fightStand", "Stand" → "stand"
 */
export function npcStateToResourceKey(state: NpcState): keyof NpcResource {
  return (state[0].toLowerCase() + state.slice(1)) as keyof NpcResource;
}
