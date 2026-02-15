/**
 * Data tRPC Router
 *
 * 提供 data.getAll 查询，复用 services 返回游戏所有配置数据
 * Dashboard 页面（如场景编辑器）应使用此 tRPC 接口而非直接调用 REST /api/data
 */

import { z } from "zod";
import type { Context } from "../../trpc/context";
import { Ctx, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { Logger } from "../../utils/logger.js";
import { buildGameData } from "./data.service";

@Router({ alias: "data" })
export class DataRouter {
  private readonly logger = new Logger(DataRouter.name);

  constructor() {
    this.logger.log("DataRouter registered");
  }

  /**
   * 获取游戏所有配置数据（武功、物品、商店、NPC、物体、玩家、头像、对话）
   *
   * 与 REST GET /game/:gameSlug/api/data 返回相同结构，
   * 但通过 tRPC 调用，需要用户登录
   */
  @UseMiddlewares(requireUser)
  @Query({ input: z.object({ gameSlug: z.string().min(1) }) })
  async getAll(input: { gameSlug: string }, @Ctx() _ctx: Context) {
    this.logger.debug(`[getAll] gameSlug=${input.gameSlug}`);
    return buildGameData(input.gameSlug);
  }
}
