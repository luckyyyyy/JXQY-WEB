/**
 * 物品 tRPC 路由
 */

import {
  BatchImportGoodInputSchema,
  BatchImportGoodResultSchema,
  CreateGoodInputSchema,
  DeleteGoodInputSchema,
  GetGoodInputSchema,
  GoodListItemSchema,
  GoodSchema,
  ImportGoodInputSchema,
  ListGoodInputSchema,
  UpdateGoodInputSchema,
} from "@miu2d/types";
import { z } from "zod";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { Logger } from "../../utils/logger.js";
import { goodsService } from "./goods.service";

@Router({ alias: "goods" })
export class GoodsRouter {
  private readonly logger = new Logger(GoodsRouter.name);

  constructor() {
    this.logger.log("GoodsRouter registered");
  }

  /**
   * 获取物品列表
   */
  @UseMiddlewares(requireUser)
  @Query({ input: ListGoodInputSchema, output: z.array(GoodListItemSchema) })
  async list(input: z.infer<typeof ListGoodInputSchema>, @Ctx() ctx: Context) {
    return goodsService.list(input, ctx.userId!, ctx.language);
  }

  /**
   * 获取单个物品详情
   */
  @UseMiddlewares(requireUser)
  @Query({ input: GetGoodInputSchema, output: GoodSchema.nullable() })
  async get(input: z.infer<typeof GetGoodInputSchema>, @Ctx() ctx: Context) {
    return goodsService.get(input.gameId, input.id, ctx.userId!, ctx.language);
  }

  /**
   * 创建物品
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: CreateGoodInputSchema, output: GoodSchema })
  async create(input: z.infer<typeof CreateGoodInputSchema>, @Ctx() ctx: Context) {
    return goodsService.create(input, ctx.userId!, ctx.language);
  }

  /**
   * 更新物品
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: UpdateGoodInputSchema, output: GoodSchema })
  async update(input: z.infer<typeof UpdateGoodInputSchema>, @Ctx() ctx: Context) {
    return goodsService.update(input, ctx.userId!, ctx.language);
  }

  /**
   * 删除物品
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: DeleteGoodInputSchema, output: z.object({ id: z.string() }) })
  async delete(input: z.infer<typeof DeleteGoodInputSchema>, @Ctx() ctx: Context) {
    return goodsService.delete(input.gameId, input.id, ctx.userId!, ctx.language);
  }

  /**
   * 从 INI 导入物品
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: ImportGoodInputSchema, output: GoodSchema })
  async importFromIni(input: z.infer<typeof ImportGoodInputSchema>, @Ctx() ctx: Context) {
    return goodsService.importFromIni(input, ctx.userId!, ctx.language);
  }

  /**
   * 批量导入物品
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: BatchImportGoodInputSchema, output: BatchImportGoodResultSchema })
  async batchImportFromIni(input: z.infer<typeof BatchImportGoodInputSchema>, @Ctx() ctx: Context) {
    return goodsService.batchImportFromIni(input, ctx.userId!, ctx.language);
  }
}
