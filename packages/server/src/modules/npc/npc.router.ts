/**
 * NPC tRPC 路由
 */

import {
  BatchImportNpcInputSchema,
  BatchImportNpcResultSchema,
  CreateNpcInputSchema,
  DeleteNpcInputSchema,
  GetNpcInputSchema,
  ImportNpcInputSchema,
  ListNpcInputSchema,
  NpcListItemSchema,
  NpcSchema,
  UpdateNpcInputSchema,
} from "@miu2d/types";
import { z } from "zod";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { Logger } from "../../utils/logger.js";
import { npcService } from "./npc.service";

@Router({ alias: "npc" })
export class NpcRouter {
  private readonly logger = new Logger(NpcRouter.name);

  constructor() {
    this.logger.log("NpcRouter registered");
  }

  /**
   * 获取 NPC 列表
   */
  @UseMiddlewares(requireUser)
  @Query({ input: ListNpcInputSchema, output: z.array(NpcListItemSchema) })
  async list(input: z.infer<typeof ListNpcInputSchema>, @Ctx() ctx: Context) {
    return npcService.list(input, ctx.userId!, ctx.language);
  }

  /**
   * 获取单个 NPC 详情
   */
  @UseMiddlewares(requireUser)
  @Query({ input: GetNpcInputSchema, output: NpcSchema.nullable() })
  async get(input: z.infer<typeof GetNpcInputSchema>, @Ctx() ctx: Context) {
    return npcService.get(input.gameId, input.id, ctx.userId!, ctx.language);
  }

  /**
   * 创建 NPC
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: CreateNpcInputSchema, output: NpcSchema })
  async create(input: z.infer<typeof CreateNpcInputSchema>, @Ctx() ctx: Context) {
    return npcService.create(input, ctx.userId!, ctx.language);
  }

  /**
   * 更新 NPC
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: UpdateNpcInputSchema, output: NpcSchema })
  async update(input: z.infer<typeof UpdateNpcInputSchema>, @Ctx() ctx: Context) {
    return npcService.update(input, ctx.userId!, ctx.language);
  }

  /**
   * 删除 NPC
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: DeleteNpcInputSchema, output: z.object({ id: z.string() }) })
  async delete(input: z.infer<typeof DeleteNpcInputSchema>, @Ctx() ctx: Context) {
    return npcService.delete(input.gameId, input.id, ctx.userId!, ctx.language);
  }

  /**
   * 从 INI 导入 NPC
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: ImportNpcInputSchema, output: NpcSchema })
  async importFromIni(input: z.infer<typeof ImportNpcInputSchema>, @Ctx() ctx: Context) {
    return npcService.importFromIni(input, ctx.userId!, ctx.language);
  }

  /**
   * 批量导入 NPC（支持自动关联 npcres）
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: BatchImportNpcInputSchema, output: BatchImportNpcResultSchema })
  async batchImportFromIni(input: z.infer<typeof BatchImportNpcInputSchema>, @Ctx() ctx: Context) {
    return npcService.batchImportFromIni(input, ctx.userId!, ctx.language);
  }
}
