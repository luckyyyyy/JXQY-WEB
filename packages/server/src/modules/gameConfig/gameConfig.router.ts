/**
 * 游戏全局配置 tRPC 路由
 */

import {
  GameConfigSchema,
  GetGameConfigInputSchema,
  UpdateGameConfigInputSchema,
} from "@miu2d/types";
import type { z } from "zod";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { Logger } from "../../utils/logger.js";
import { gameConfigService } from "./gameConfig.service";

@Router({ alias: "gameConfig" })
export class GameConfigRouter {
  private readonly logger = new Logger(GameConfigRouter.name);

  constructor() {
    this.logger.log("GameConfigRouter registered");
  }

  /**
   * 获取游戏配置（不存在则自动创建默认配置）
   */
  @UseMiddlewares(requireUser)
  @Query({ input: GetGameConfigInputSchema, output: GameConfigSchema })
  async get(input: z.infer<typeof GetGameConfigInputSchema>, @Ctx() ctx: Context) {
    return gameConfigService.get(input.gameId, ctx.userId!, ctx.language);
  }

  /**
   * 更新游戏配置
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: UpdateGameConfigInputSchema, output: GameConfigSchema })
  async update(input: z.infer<typeof UpdateGameConfigInputSchema>, @Ctx() ctx: Context) {
    return gameConfigService.update(input, ctx.userId!, ctx.language);
  }
}
