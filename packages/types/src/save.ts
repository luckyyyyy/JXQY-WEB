/**
 * 存档类型定义
 *
 * 服务端存档管理的共享类型
 */
import { z } from "zod";

// ============= 存档元数据 Schema =============

/**
 * 存档摘要信息（不含完整数据）
 */
export const SaveSlotSchema = z.object({
  id: z.string(),
  /** 所属游戏 ID */
  gameId: z.string(),
  /** 所属用户 ID */
  userId: z.string(),
  /** 用户名 */
  userName: z.string().optional(),
  /** 存档名称（用户可自定义） */
  name: z.string(),
  /** 地图名称 */
  mapName: z.string().optional(),
  /** 玩家等级 */
  level: z.number().optional(),
  /** 玩家名称 */
  playerName: z.string().optional(),
  /** 截图 (base64 JPEG) */
  screenshot: z.string().optional(),
  /** 是否公开分享 */
  isShared: z.boolean(),
  /** 分享码（用于分享链接） */
  shareCode: z.string().optional(),
  /** 创建时间 */
  createdAt: z.string(),
  /** 更新时间 */
  updatedAt: z.string(),
});

export type SaveSlot = z.infer<typeof SaveSlotSchema>;

// ============= 存档输入 Schema =============

/** 创建/覆盖存档 */
export const UpsertSaveInputSchema = z.object({
  /** 游戏 slug */
  gameSlug: z.string(),
  /** 存档 ID（如果覆盖已有存档） */
  saveId: z.string().optional(),
  /** 存档名称 */
  name: z.string().max(100),
  /** 地图名称 */
  mapName: z.string().optional(),
  /** 玩家等级 */
  level: z.number().optional(),
  /** 玩家名称 */
  playerName: z.string().optional(),
  /** 截图 (base64 JPEG) */
  screenshot: z.string().optional(),
  /** 存档数据（完整 SaveData JSON） */
  data: z.record(z.string(), z.unknown()),
});

export type UpsertSaveInput = z.infer<typeof UpsertSaveInputSchema>;

/** 列出存档 */
export const ListSavesInputSchema = z.object({
  gameSlug: z.string(),
});

export type ListSavesInput = z.infer<typeof ListSavesInputSchema>;

/** 获取存档 */
export const GetSaveInputSchema = z.object({
  saveId: z.string(),
});

export type GetSaveInput = z.infer<typeof GetSaveInputSchema>;

/** 删除存档 */
export const DeleteSaveInputSchema = z.object({
  saveId: z.string(),
});

export type DeleteSaveInput = z.infer<typeof DeleteSaveInputSchema>;

/** 分享存档 */
export const ShareSaveInputSchema = z.object({
  saveId: z.string(),
  isShared: z.boolean(),
});

export type ShareSaveInput = z.infer<typeof ShareSaveInputSchema>;

/** 通过分享码获取存档 */
export const GetSharedSaveInputSchema = z.object({
  gameSlug: z.string(),
  shareCode: z.string(),
});

export type GetSharedSaveInput = z.infer<typeof GetSharedSaveInputSchema>;

/** 完整存档数据（含 data 字段） */
export const SaveDataResponseSchema = SaveSlotSchema.extend({
  data: z.record(z.string(), z.unknown()),
});

export type SaveDataResponse = z.infer<typeof SaveDataResponseSchema>;

// ============= 管理员接口 =============

/** 管理员列出所有存档 */
export const AdminListSavesInputSchema = z.object({
  gameSlug: z.string().optional(),
  userId: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
});

export type AdminListSavesInput = z.infer<typeof AdminListSavesInputSchema>;

export const AdminListSavesOutputSchema = z.object({
  items: z.array(SaveSlotSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type AdminListSavesOutput = z.infer<typeof AdminListSavesOutputSchema>;

/** 管理员创建存档（通过 JSON） */
export const AdminCreateSaveInputSchema = z.object({
  gameSlug: z.string(),
  name: z.string().max(100),
  mapName: z.string().optional(),
  level: z.number().optional(),
  playerName: z.string().optional(),
  screenshot: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});

export type AdminCreateSaveInput = z.infer<typeof AdminCreateSaveInputSchema>;

/** 管理员更新存档数据 */
export const AdminUpdateSaveInputSchema = z.object({
  saveId: z.string(),
  name: z.string().max(100).optional(),
  data: z.record(z.string(), z.unknown()),
});

export type AdminUpdateSaveInput = z.infer<typeof AdminUpdateSaveInputSchema>;

/** 管理员删除存档 */
export const AdminDeleteSaveInputSchema = z.object({
  saveId: z.string(),
});

export type AdminDeleteSaveInput = z.infer<typeof AdminDeleteSaveInputSchema>;
