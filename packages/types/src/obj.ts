/**
 * Object 系统类型定义
 * 用于前后端共享的 Zod Schema
 *
 * Object 配置分为两个部分：
 * - obj/*.ini - Object 实例配置（属性、行为、脚本）
 * - objres/*.ini - Object 资源配置（各状态的 ASF 动画和音效）
 */
import { z } from "zod";

// ========== 枚举定义 ==========

/**
 * Object 类型
 * 决定 Object 的行为模式
 * 参考 C# Engine/Obj.cs ObjKind 枚举
 */
export const ObjKindEnum = z.enum([
  "Dynamic", // 0 - 动画物体，可阻挡（如篝火、喷泉）
  "Static", // 1 - 静态物体，可阻挡（如宝箱、门）
  "Body", // 2 - 尸体（NPC 死亡后生成）
  "LoopingSound", // 3 - 循环音效发射器（不可见）
  "RandSound", // 4 - 随机音效发射器（不可见）
  "Door", // 5 - 门
  "Trap", // 6 - 陷阱（触发伤害或脚本）
  "Drop", // 7 - 掉落物品（可拾取）
]);

export type ObjKind = z.infer<typeof ObjKindEnum>;

export const ObjKindValues: Record<ObjKind, number> = {
  Dynamic: 0,
  Static: 1,
  Body: 2,
  LoopingSound: 3,
  RandSound: 4,
  Door: 5,
  Trap: 6,
  Drop: 7,
};

export const ObjKindFromValue: Record<number, ObjKind> = Object.fromEntries(
  Object.entries(ObjKindValues).map(([k, v]) => [v, k as ObjKind])
) as Record<number, ObjKind>;

export const ObjKindLabels: Record<ObjKind, string> = {
  Dynamic: "动态物体",
  Static: "静态物体",
  Body: "尸体",
  LoopingSound: "循环音效",
  RandSound: "随机音效",
  Door: "门",
  Trap: "陷阱",
  Drop: "掉落物",
};

/**
 * Object 资源状态类型
 * 参考 C# Engine/ResFile.cs
 */
export const ObjStateEnum = z.enum([
  "Common", // 通用/默认状态
  "Open", // 打开状态（门、宝箱）
  "Opened", // 已打开状态
  "Closed", // 关闭状态
]);

export type ObjState = z.infer<typeof ObjStateEnum>;

export const ObjStateLabels: Record<ObjState, string> = {
  Common: "通用",
  Open: "打开中",
  Opened: "已打开",
  Closed: "已关闭",
};

// ========== 资源配置 Schema ==========

/**
 * 单个状态的资源配置
 */
export const ObjStateResourceSchema = z.object({
  /** ASF 动画文件路径 */
  image: z.string().nullable().optional(),
  /** 音效文件路径 */
  sound: z.string().nullable().optional(),
});

export type ObjStateResource = z.infer<typeof ObjStateResourceSchema>;

/**
 * Object 资源配置（原 objres/*.ini）
 * Object 支持多种状态（Common、Open、Opened、Closed）
 */
export const ObjResourceSchema = z.object({
  common: ObjStateResourceSchema.optional(),
  open: ObjStateResourceSchema.optional(),
  opened: ObjStateResourceSchema.optional(),
  closed: ObjStateResourceSchema.optional(),
});

export type ObjResource = z.infer<typeof ObjResourceSchema>;

// ========== Object 资源配置表 Schema ==========

/**
 * Object 资源配置（原 objres/*.ini）
 * 独立的表，可被多个 Object 引用
 */
export const ObjResSchema = z.object({
  /** 数据库 ID */
  id: z.string().uuid(),
  /** 所属游戏 ID */
  gameId: z.string().uuid(),
  /** 唯一标识符（文件名） */
  key: z.string(),
  /** 资源名称 */
  name: z.string(),
  /** 各状态的动画和音效资源 */
  resources: ObjResourceSchema,
  /** 创建时间 */
  createdAt: z.string().datetime(),
  /** 更新时间 */
  updatedAt: z.string().datetime(),
});

export type ObjRes = z.infer<typeof ObjResSchema>;

/**
 * Object 资源列表项（简化版，用于列表展示）
 */
export const ObjResListItemSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  /** 通用状态动画图标（用于列表展示） */
  icon: z.string().nullable().optional(),
  updatedAt: z.string().datetime(),
});

export type ObjResListItem = z.infer<typeof ObjResListItemSchema>;

// ========== Object 主配置 Schema ==========

/**
 * Object 基础 Schema（不包含数据库字段）
 */
export const ObjBaseSchema = z.object({
  // === 基本信息 ===
  /** Object 显示名称 */
  name: z.string(),

  // === 类型 ===
  /** Object 类型 */
  kind: ObjKindEnum.optional().default("Static"),

  // === 关联资源 ===
  /** 关联的资源配置 ID */
  resourceId: z.string().uuid().nullable().optional(),

  // === 属性 ===
  /** 初始方向（0-7） */
  dir: z.number().int().min(0).max(7).optional().default(0),
  /** 亮度/透明度 */
  lum: z.number().int().optional().default(0),
  /** 伤害值（陷阱用） */
  damage: z.number().int().optional().default(0),
  /** 当前帧 */
  frame: z.number().int().optional().default(0),
  /** 高度 */
  height: z.number().int().optional().default(0),
  /** X 偏移 */
  offX: z.number().int().optional().default(0),
  /** Y 偏移 */
  offY: z.number().int().optional().default(0),

  // === 脚本配置 ===
  /** 交互脚本文件 */
  scriptFile: z.string().nullable().optional(),
  /** 右键交互脚本 */
  scriptFileRight: z.string().nullable().optional(),
  /** 是否可直接交互（无需靠近） */
  canInteractDirectly: z.number().int().min(0).max(1).optional().default(0),
  /** 是否仅触碰触发脚本 */
  scriptFileJustTouch: z.number().int().min(0).max(1).optional().default(0),
  /** 定时脚本文件 */
  timerScriptFile: z.string().nullable().optional(),
  /** 定时脚本间隔（毫秒） */
  timerScriptInterval: z.number().int().optional().default(3000),

  // === 关联配置 ===
  /** 关联 NPC 配置（尸体可复活为 NPC） */
  reviveNpcIni: z.string().nullable().optional(),
  /** 音效文件 */
  wavFile: z.string().nullable().optional(),
  /** 移除延迟（毫秒） */
  millisecondsToRemove: z.number().int().optional().default(0),

  // === 扩展属性 ===
  /** 切换音效文件 */
  switchSound: z.string().nullable().optional(),
  /** 触发半径 */
  triggerRadius: z.number().int().optional().default(0),
  /** 间隔（毫秒） */
  interval: z.number().int().optional().default(0),
  /** 等级 */
  level: z.number().int().optional().default(0),

  // === 资源配置（合并自 objres）===
  /** Object 各状态的动画和音效资源 */
  resources: ObjResourceSchema.optional(),
});

export type ObjBase = z.infer<typeof ObjBaseSchema>;

/**
 * 完整 Object Schema（包含数据库字段）
 */
export const ObjSchema = ObjBaseSchema.extend({
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

export type Obj = z.infer<typeof ObjSchema>;

/**
 * Object 列表项（简化版，用于列表展示）
 */
export const ObjListItemSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  kind: ObjKindEnum,
  /** 资源文件名（objRes key），与 SceneObjEntry.objFile 一致 */
  objFile: z.string(),
  /** 通用状态动画图标（用于列表展示） */
  icon: z.string().nullable().optional(),
  updatedAt: z.string().datetime(),
});

export type ObjListItem = z.infer<typeof ObjListItemSchema>;

// ========== API 输入 Schema ==========

export const ListObjInputSchema = z.object({
  gameId: z.string().uuid(),
  /** 按类型过滤 */
  kind: ObjKindEnum.optional(),
});

export type ListObjInput = z.infer<typeof ListObjInputSchema>;

export const GetObjInputSchema = z.object({
  gameId: z.string().uuid(),
  id: z.string().uuid(),
});

export type GetObjInput = z.infer<typeof GetObjInputSchema>;

export const CreateObjInputSchema = z
  .object({
    gameId: z.string().uuid(),
    key: z.string(),
    name: z.string(),
    kind: ObjKindEnum.optional(),
  })
  .merge(ObjBaseSchema.partial());

export type CreateObjInput = z.infer<typeof CreateObjInputSchema>;

export const UpdateObjInputSchema = z
  .object({
    id: z.string().uuid(),
    gameId: z.string().uuid(),
  })
  .merge(ObjBaseSchema.partial());

export type UpdateObjInput = z.infer<typeof UpdateObjInputSchema>;

export const DeleteObjInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type DeleteObjInput = z.infer<typeof DeleteObjInputSchema>;

// ========== Object 资源 API 输入 Schema ==========

export const ListObjResInputSchema = z.object({
  gameId: z.string().uuid(),
});

export type ListObjResInput = z.infer<typeof ListObjResInputSchema>;

export const GetObjResInputSchema = z.object({
  gameId: z.string().uuid(),
  id: z.string().uuid(),
});

export type GetObjResInput = z.infer<typeof GetObjResInputSchema>;

export const CreateObjResInputSchema = z.object({
  gameId: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  resources: ObjResourceSchema.optional(),
});

export type CreateObjResInput = z.infer<typeof CreateObjResInputSchema>;

export const UpdateObjResInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  key: z.string().optional(),
  name: z.string().optional(),
  resources: ObjResourceSchema.optional(),
});

export type UpdateObjResInput = z.infer<typeof UpdateObjResInputSchema>;

export const DeleteObjResInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type DeleteObjResInput = z.infer<typeof DeleteObjResInputSchema>;

// ========== 导入 Schema ==========

/**
 * 单个 Object 导入项（包含 obj 和 objres 内容）
 */
export const ImportObjItemSchema = z.object({
  /** Object 配置文件名 */
  fileName: z.string(),
  /** 导入类型：obj = Object配置, resource = 独立资源配置 */
  type: z.enum(["obj", "resource"]).default("obj"),
  /** Object 配置内容（obj/*.ini），type=obj 时必填 */
  iniContent: z.string().optional(),
  /** Object 资源配置内容（objres/*.ini，type=obj 时可选会自动关联，type=resource 时必填） */
  objResContent: z.string().optional(),
});

export type ImportObjItem = z.infer<typeof ImportObjItemSchema>;

export const ImportObjInputSchema = z.object({
  gameId: z.string().uuid(),
  fileName: z.string(),
  type: z.enum(["obj", "resource"]).default("obj"),
  iniContent: z.string().optional(),
  objResContent: z.string().optional(),
});

export type ImportObjInput = z.infer<typeof ImportObjInputSchema>;

export const BatchImportObjInputSchema = z.object({
  gameId: z.string().uuid(),
  items: z.array(ImportObjItemSchema),
});

export type BatchImportObjInput = z.infer<typeof BatchImportObjInputSchema>;

export const BatchImportObjResultSchema = z.object({
  success: z.array(
    z.object({
      fileName: z.string(),
      id: z.string().uuid(),
      name: z.string(),
      /** obj 或 resource */
      type: z.enum(["obj", "resource"]),
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

export type BatchImportObjResult = z.infer<typeof BatchImportObjResultSchema>;

// ========== 工具函数 ==========

/**
 * 创建默认 Object 配置
 */
export function createDefaultObj(gameId?: string, key?: string): Partial<Obj> {
  return {
    id: undefined,
    gameId,
    key: key || `obj_${Date.now()}`,
    name: "新物体",
    kind: "Static",
    resourceId: null,
    dir: 0,
    lum: 0,
    damage: 0,
    frame: 0,
    height: 0,
    offX: 0,
    offY: 0,
    canInteractDirectly: 0,
    scriptFileJustTouch: 0,
    timerScriptInterval: 3000,
    millisecondsToRemove: 0,
  };
}

/**
 * 创建默认 ObjRes 配置
 */
export function createDefaultObjRes(gameId?: string, key?: string): Partial<ObjRes> {
  return {
    id: undefined,
    gameId,
    key: key || `objres_${Date.now()}`,
    name: "新资源配置",
    resources: createDefaultObjResource(),
  };
}

/**
 * 创建默认 Object 资源配置
 */
export function createDefaultObjResource(): ObjResource {
  return {
    common: { image: null, sound: null },
    open: { image: null, sound: null },
    opened: { image: null, sound: null },
    closed: { image: null, sound: null },
  };
}

// ========== 资源路径规范化 ==========

/**
 * Object 资源路径默认前缀
 */
export const ObjResourcePaths = {
  /** ASF 图像默认路径 */
  image: "asf/object/",
  /** 备用 ASF 路径 */
  imageFallback: "asf/effect/",
  /** 音效默认路径 */
  sound: "content/sound/",
} as const;

/**
 * 规范化 Object 图像路径
 * - 绝对路径（以 asf/ 或 mpc/ 开头）：保持不变
 * - 相对路径：添加 asf/object/ 前缀
 * - 统一转为小写
 */
export function normalizeObjImagePath(imagePath: string | null | undefined): string | null {
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
  return `${ObjResourcePaths.image}${path}`.toLowerCase();
}

/**
 * 规范化 Object 音效路径
 * - 绝对路径（以 content/ 或 sound/ 开头）：保持不变
 * - 相对路径：添加 content/sound/ 前缀
 * - 扩展名：wav -> xnb
 */
export function normalizeObjSoundPath(soundPath: string | null | undefined): string | null {
  if (!soundPath) return null;

  let path = soundPath.trim();
  if (!path) return null;

  // % 是游戏中的特殊占位符，表示无音效
  if (path === "%") return null;

  // 规范化路径分隔符
  path = path.replace(/\\/g, "/");

  // 移除开头的斜杠
  if (path.startsWith("/")) {
    path = path.slice(1);
  }

  // 判断是否是绝对路径
  const lowerPath = path.toLowerCase();
  if (lowerPath.startsWith("content/") || lowerPath.startsWith("sound/")) {
    return path.toLowerCase().replace(/\.wav$/i, ".xnb");
  }

  // 相对路径：去掉扩展名，添加默认前缀和 .xnb 扩展名
  const baseName = path.replace(/\.[^/.]+$/, "");
  return `${ObjResourcePaths.sound}${baseName}.xnb`.toLowerCase();
}

/**
 * 规范化整个 ObjResource 对象中的路径
 */
export function normalizeObjResourcePaths(resource: ObjResource): ObjResource {
  const result: ObjResource = {};

  for (const [state, stateResource] of Object.entries(resource)) {
    if (stateResource) {
      result[state as keyof ObjResource] = {
        image: normalizeObjImagePath(stateResource.image),
        sound: normalizeObjSoundPath(stateResource.sound),
      };
    }
  }

  return result;
}

/**
 * 根据 Object 类型获取可见字段列表
 */
export function getVisibleFieldsByObjKind(kind: ObjKind): string[] {
  const baseFields = ["name", "kind", "dir", "lum", "scriptFile"];

  switch (kind) {
    case "Dynamic":
      return [...baseFields, "frame", "height", "offX", "offY", "wavFile"];

    case "Static":
      return [
        ...baseFields,
        "frame",
        "height",
        "offX",
        "offY",
        "scriptFileRight",
        "canInteractDirectly",
      ];

    case "Body":
      return [...baseFields, "frame", "offX", "offY", "reviveNpcIni", "millisecondsToRemove"];

    case "LoopingSound":
    case "RandSound":
      return ["name", "kind", "wavFile"];

    case "Door":
      return [...baseFields, "frame", "height", "offX", "offY", "scriptFileRight"];

    case "Trap":
      return [
        ...baseFields,
        "damage",
        "frame",
        "offX",
        "offY",
        "scriptFileJustTouch",
        "timerScriptFile",
        "timerScriptInterval",
      ];

    case "Drop":
      return [...baseFields, "frame", "offX", "offY"];

    default:
      return baseFields;
  }
}
