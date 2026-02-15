/**
 * 等级配置 tRPC 路由
 */

import {
  CreateLevelConfigInputSchema,
  DeleteLevelConfigInputSchema,
  GetLevelConfigInputSchema,
  ImportLevelConfigInputSchema,
  LevelConfigListItemSchema,
  LevelConfigSchema,
  ListLevelConfigInputSchema,
  UpdateLevelConfigInputSchema,
} from "@miu2d/types";
import { z } from "zod";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { Logger } from "../../utils/logger.js";
import { levelConfigService } from "./level.service";

@Router({ alias: "level" })
export class LevelRouter {
  private readonly logger = new Logger(LevelRouter.name);

  constructor() {
    this.logger.log("LevelRouter registered");
  }

  /**
   * 获取等级配置列表
   */
  @UseMiddlewares(requireUser)
  @Query({ input: ListLevelConfigInputSchema, output: z.array(LevelConfigListItemSchema) })
  async list(input: z.infer<typeof ListLevelConfigInputSchema>, @Ctx() ctx: Context) {
    return levelConfigService.list(input, ctx.userId!, ctx.language);
  }

  /**
   * 获取单个等级配置详情
   */
  @UseMiddlewares(requireUser)
  @Query({ input: GetLevelConfigInputSchema, output: LevelConfigSchema.nullable() })
  async get(input: z.infer<typeof GetLevelConfigInputSchema>, @Ctx() ctx: Context) {
    return levelConfigService.get(input.gameId, input.id, ctx.userId!, ctx.language);
  }

  /**
   * 创建等级配置
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: CreateLevelConfigInputSchema, output: LevelConfigSchema })
  async create(input: z.infer<typeof CreateLevelConfigInputSchema>, @Ctx() ctx: Context) {
    return levelConfigService.create(input, ctx.userId!, ctx.language);
  }

  /**
   * 更新等级配置
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: UpdateLevelConfigInputSchema, output: LevelConfigSchema })
  async update(input: z.infer<typeof UpdateLevelConfigInputSchema>, @Ctx() ctx: Context) {
    return levelConfigService.update(input, ctx.userId!, ctx.language);
  }

  /**
   * 删除等级配置
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: DeleteLevelConfigInputSchema, output: z.object({ id: z.string() }) })
  async delete(input: z.infer<typeof DeleteLevelConfigInputSchema>, @Ctx() ctx: Context) {
    return levelConfigService.delete(input.gameId, input.id, ctx.userId!, ctx.language);
  }

  /**
   * 从 INI 导入等级配置
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: ImportLevelConfigInputSchema, output: LevelConfigSchema })
  async importFromIni(input: z.infer<typeof ImportLevelConfigInputSchema>, @Ctx() ctx: Context) {
    return levelConfigService.importFromIni(input, ctx.userId!, ctx.language);
  }
}
