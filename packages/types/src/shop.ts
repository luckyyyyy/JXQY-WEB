/**
 * 商店系统类型定义
 * 用于前后端共享的 Zod Schema
 *
 * 商店配置文件格式 (resources/ini/buy/*.ini):
 * [Header]
 * Count=N                    物品种类数量
 * NumberValid=0/1            是否限制购买数量
 * BuyPercent=100             购买价格百分比
 * RecyclePercent=100         回收价格百分比
 *
 * [1]
 * IniFile=Goods-xxx.ini      物品配置文件（对应 goods 表的 key）
 * Number=1                   可购买数量(当NumberValid=1时有效)
 */
import { z } from "zod";

// ========== 商品项定义 ==========

/**
 * 商店中的单个商品
 * IniFile 对应 goods 表的 key
 */
export const ShopItemSchema = z.object({
  /** 物品标识（对应 goods 表的 key，即 IniFile） */
  goodsKey: z.string().min(1),
  /** 可购买数量（-1 表示无限） */
  count: z.number().int().default(-1),
  /** 自定义价格（0 或不填则按物品属性自动计算） */
  price: z.number().int().min(0).default(0),
});

export type ShopItem = z.infer<typeof ShopItemSchema>;

// ========== 主 Schema ==========

/**
 * 商店完整配置
 */
export const ShopSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  /** 唯一标识符（文件名，如 "低级药品.ini"） */
  key: z.string().min(1),
  /** 商店显示名称 */
  name: z.string().min(1),
  /** 是否限制购买数量（对应 NumberValid） */
  numberValid: z.boolean().default(false),
  /** 购买价格百分比（对应 BuyPercent，默认 100） */
  buyPercent: z.number().int().min(0).max(1000).default(100),
  /** 回收价格百分比（对应 RecyclePercent，默认 100） */
  recyclePercent: z.number().int().min(0).max(1000).default(100),
  /** 商品列表 */
  items: z.array(ShopItemSchema).default([]),
  /** 创建时间 */
  createdAt: z.string().optional(),
  /** 更新时间 */
  updatedAt: z.string().optional(),
});

export type Shop = z.infer<typeof ShopSchema>;

// ========== 列表项 Schema ==========

/**
 * 商店列表项（轻量级，用于侧边栏列表）
 */
export const ShopListItemSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  itemCount: z.number().int(),
  updatedAt: z.string(),
});

export type ShopListItem = z.infer<typeof ShopListItemSchema>;

// ========== API 输入 Schema ==========

/**
 * 列出商店
 */
export const ListShopInputSchema = z.object({
  gameId: z.string().uuid(),
});

export type ListShopInput = z.infer<typeof ListShopInputSchema>;

/**
 * 获取单个商店
 */
export const GetShopInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type GetShopInput = z.infer<typeof GetShopInputSchema>;

/**
 * 创建商店
 */
export const CreateShopInputSchema = z.object({
  gameId: z.string().uuid(),
  key: z.string().min(1),
  name: z.string().min(1),
  numberValid: z.boolean().optional(),
  buyPercent: z.number().int().min(0).max(1000).optional(),
  recyclePercent: z.number().int().min(0).max(1000).optional(),
  items: z.array(ShopItemSchema).optional(),
});

export type CreateShopInput = z.infer<typeof CreateShopInputSchema>;

/**
 * 更新商店
 */
export const UpdateShopInputSchema = ShopSchema.partial().extend({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type UpdateShopInput = z.infer<typeof UpdateShopInputSchema>;

/**
 * 删除商店
 */
export const DeleteShopInputSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
});

export type DeleteShopInput = z.infer<typeof DeleteShopInputSchema>;

/**
 * 导入商店输入（单个 INI）
 */
export const ImportShopInputSchema = z.object({
  gameId: z.string().uuid(),
  fileName: z.string().min(1),
  iniContent: z.string(),
});

export type ImportShopInput = z.infer<typeof ImportShopInputSchema>;

/**
 * 批量导入商店单项
 */
export const BatchImportShopItemSchema = z.object({
  fileName: z.string(),
  iniContent: z.string(),
});

export type BatchImportShopItem = z.infer<typeof BatchImportShopItemSchema>;

/**
 * 批量导入商店输入
 */
export const BatchImportShopInputSchema = z.object({
  gameId: z.string().uuid(),
  items: z.array(BatchImportShopItemSchema).min(1).max(500),
});

export type BatchImportShopInput = z.infer<typeof BatchImportShopInputSchema>;

/**
 * 批量导入结果
 */
export const BatchImportShopResultSchema = z.object({
  success: z.array(z.object({
    fileName: z.string(),
    id: z.string().uuid(),
    name: z.string(),
    itemCount: z.number().int(),
  })),
  failed: z.array(z.object({
    fileName: z.string(),
    error: z.string(),
  })),
});

export type BatchImportShopResult = z.infer<typeof BatchImportShopResultSchema>;

// ========== 辅助函数 ==========

/**
 * 创建默认商店
 */
export function createDefaultShop(
  gameId: string,
  key?: string
): Omit<Shop, "id" | "createdAt" | "updatedAt"> {
  return {
    gameId,
    key: key ?? `shop_${Date.now()}.ini`,
    name: "新商店",
    numberValid: false,
    buyPercent: 100,
    recyclePercent: 100,
    items: [],
  };
}
