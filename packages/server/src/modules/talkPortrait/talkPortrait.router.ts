/**
 * Portrait（对话头像映射）tRPC 路由
 */

import {
  GetPortraitMapInputSchema,
  ImportPortraitMapInputSchema,
  PortraitMapResultSchema,
  UpdatePortraitMapInputSchema,
} from "@miu2d/types";
import type { z } from "zod";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { Logger } from "../../utils/logger.js";
import { talkPortraitService } from "./talkPortrait.service";

@Router({ alias: "talkPortrait" })
export class TalkPortraitRouter {
  private readonly logger = new Logger(TalkPortraitRouter.name);

  constructor() {
    this.logger.log("TalkPortraitRouter registered");
  }

  /**
   * 获取头像映射
   */
  @UseMiddlewares(requireUser)
  @Query({ input: GetPortraitMapInputSchema, output: PortraitMapResultSchema })
  async get(input: z.infer<typeof GetPortraitMapInputSchema>, @Ctx() ctx: Context) {
    return talkPortraitService.get(input.gameId, ctx.userId!, ctx.language);
  }

  /**
   * 更新头像映射
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: UpdatePortraitMapInputSchema, output: PortraitMapResultSchema })
  async update(input: z.infer<typeof UpdatePortraitMapInputSchema>, @Ctx() ctx: Context) {
    return talkPortraitService.update(input, ctx.userId!, ctx.language);
  }

  /**
   * 从 INI 导入头像映射
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: ImportPortraitMapInputSchema, output: PortraitMapResultSchema })
  async importFromIni(input: z.infer<typeof ImportPortraitMapInputSchema>, @Ctx() ctx: Context) {
    return talkPortraitService.importFromIni(input, ctx.userId!, ctx.language);
  }
}
