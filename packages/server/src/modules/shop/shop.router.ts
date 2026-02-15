/**
 * 商店 tRPC 路由
 */

import {
  BatchImportShopInputSchema,
  BatchImportShopResultSchema,
  CreateShopInputSchema,
  DeleteShopInputSchema,
  GetShopInputSchema,
  ImportShopInputSchema,
  ListShopInputSchema,
  ShopListItemSchema,
  ShopSchema,
  UpdateShopInputSchema,
} from "@miu2d/types";
import { z } from "zod";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { Logger } from "../../utils/logger.js";
import { shopService } from "./shop.service";

@Router({ alias: "shop" })
export class ShopRouter {
  private readonly logger = new Logger(ShopRouter.name);

  constructor() {
    this.logger.log("ShopRouter registered");
  }

  /**
   * 获取商店列表
   */
  @UseMiddlewares(requireUser)
  @Query({ input: ListShopInputSchema, output: z.array(ShopListItemSchema) })
  async list(input: z.infer<typeof ListShopInputSchema>, @Ctx() ctx: Context) {
    return shopService.list(input, ctx.userId!, ctx.language);
  }

  /**
   * 获取单个商店详情
   */
  @UseMiddlewares(requireUser)
  @Query({ input: GetShopInputSchema, output: ShopSchema.nullable() })
  async get(input: z.infer<typeof GetShopInputSchema>, @Ctx() ctx: Context) {
    return shopService.get(input.gameId, input.id, ctx.userId!, ctx.language);
  }

  /**
   * 创建商店
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: CreateShopInputSchema, output: ShopSchema })
  async create(input: z.infer<typeof CreateShopInputSchema>, @Ctx() ctx: Context) {
    return shopService.create(input, ctx.userId!, ctx.language);
  }

  /**
   * 更新商店
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: UpdateShopInputSchema, output: ShopSchema })
  async update(input: z.infer<typeof UpdateShopInputSchema>, @Ctx() ctx: Context) {
    return shopService.update(input, ctx.userId!, ctx.language);
  }

  /**
   * 删除商店
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: DeleteShopInputSchema, output: z.object({ id: z.string() }) })
  async delete(input: z.infer<typeof DeleteShopInputSchema>, @Ctx() ctx: Context) {
    return shopService.delete(input.gameId, input.id, ctx.userId!, ctx.language);
  }

  /**
   * 从 INI 导入商店
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: ImportShopInputSchema, output: ShopSchema })
  async importFromIni(input: z.infer<typeof ImportShopInputSchema>, @Ctx() ctx: Context) {
    return shopService.importFromIni(input, ctx.userId!, ctx.language);
  }

  /**
   * 批量导入商店
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: BatchImportShopInputSchema, output: BatchImportShopResultSchema })
  async batchImportFromIni(input: z.infer<typeof BatchImportShopInputSchema>, @Ctx() ctx: Context) {
    return shopService.batchImportFromIni(input, ctx.userId!, ctx.language);
  }
}
