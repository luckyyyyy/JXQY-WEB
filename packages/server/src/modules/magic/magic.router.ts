/**
 * 武功 tRPC 路由
 */

import {
  BatchImportMagicInputSchema,
  BatchImportMagicResultSchema,
  CreateMagicInputSchema,
  DeleteMagicInputSchema,
  GetMagicInputSchema,
  ImportMagicInputSchema,
  ListMagicInputSchema,
  MagicListItemSchema,
  MagicSchema,
  UpdateMagicInputSchema,
} from "@miu2d/types";
import { z } from "zod";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { Logger } from "../../utils/logger.js";
import { magicService } from "./magic.service";

@Router({ alias: "magic" })
export class MagicRouter {
  private readonly logger = new Logger(MagicRouter.name);

  constructor() {
    this.logger.log("MagicRouter registered");
  }

  /**
   * 获取武功列表
   */
  @UseMiddlewares(requireUser)
  @Query({ input: ListMagicInputSchema, output: z.array(MagicListItemSchema) })
  async list(input: z.infer<typeof ListMagicInputSchema>, @Ctx() ctx: Context) {
    return magicService.list(input, ctx.userId!, ctx.language);
  }

  /**
   * 获取单个武功详情
   */
  @UseMiddlewares(requireUser)
  @Query({ input: GetMagicInputSchema, output: MagicSchema.nullable() })
  async get(input: z.infer<typeof GetMagicInputSchema>, @Ctx() ctx: Context) {
    return magicService.get(input.gameId, input.id, ctx.userId!, ctx.language);
  }

  /**
   * 创建武功
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: CreateMagicInputSchema, output: MagicSchema })
  async create(input: z.infer<typeof CreateMagicInputSchema>, @Ctx() ctx: Context) {
    return magicService.create(input, ctx.userId!, ctx.language);
  }

  /**
   * 更新武功
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: UpdateMagicInputSchema, output: MagicSchema })
  async update(input: z.infer<typeof UpdateMagicInputSchema>, @Ctx() ctx: Context) {
    return magicService.update(input, ctx.userId!, ctx.language);
  }

  /**
   * 删除武功
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: DeleteMagicInputSchema, output: z.object({ id: z.string() }) })
  async delete(input: z.infer<typeof DeleteMagicInputSchema>, @Ctx() ctx: Context) {
    return magicService.delete(input.gameId, input.id, ctx.userId!, ctx.language);
  }

  /**
   * 从 INI 导入武功
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: ImportMagicInputSchema, output: MagicSchema })
  async importFromIni(input: z.infer<typeof ImportMagicInputSchema>, @Ctx() ctx: Context) {
    return magicService.importFromIni(input, ctx.userId!, ctx.language);
  }

  /**
   * 批量导入武功（支持自动识别飞行武功）
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: BatchImportMagicInputSchema, output: BatchImportMagicResultSchema })
  async batchImportFromIni(
    input: z.infer<typeof BatchImportMagicInputSchema>,
    @Ctx() ctx: Context
  ) {
    return magicService.batchImportFromIni(input, ctx.userId!, ctx.language);
  }
}
