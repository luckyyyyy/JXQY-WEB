/**
 * 存档 tRPC 路由
 */

import {
  AdminCreateSaveInputSchema,
  AdminDeleteSaveInputSchema,
  AdminListSavesInputSchema,
  AdminListSavesOutputSchema,
  AdminUpdateSaveInputSchema,
  DeleteSaveInputSchema,
  GetSaveInputSchema,
  GetSharedSaveInputSchema,
  ListSavesInputSchema,
  SaveDataResponseSchema,
  SaveSlotSchema,
  ShareSaveInputSchema,
  UpsertSaveInputSchema,
} from "@miu2d/types";
import { z } from "zod";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { Logger } from "../../utils/logger.js";
import { saveService } from "./save.service";

@Router({ alias: "save" })
export class SaveRouter {
  private readonly logger = new Logger(SaveRouter.name);

  constructor() {
    this.logger.log("SaveRouter registered");
  }

  /**
   * 列出当前用户在某游戏下的所有存档
   */
  @UseMiddlewares(requireUser)
  @Query({ input: ListSavesInputSchema, output: z.array(SaveSlotSchema) })
  async list(input: z.infer<typeof ListSavesInputSchema>, @Ctx() ctx: Context) {
    return saveService.listByUser(input.gameSlug, ctx.userId!);
  }

  /**
   * 获取完整存档数据
   */
  @UseMiddlewares(requireUser)
  @Query({ input: GetSaveInputSchema, output: SaveDataResponseSchema })
  async get(input: z.infer<typeof GetSaveInputSchema>, @Ctx() ctx: Context) {
    return saveService.get(input.saveId, ctx.userId!);
  }

  /**
   * 创建或覆盖存档
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: UpsertSaveInputSchema, output: SaveSlotSchema })
  async upsert(input: z.infer<typeof UpsertSaveInputSchema>, @Ctx() ctx: Context) {
    return saveService.upsert(input, ctx.userId!);
  }

  /**
   * 删除存档
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: DeleteSaveInputSchema, output: z.object({ id: z.string() }) })
  async delete(input: z.infer<typeof DeleteSaveInputSchema>, @Ctx() ctx: Context) {
    return saveService.delete(input.saveId, ctx.userId!);
  }

  /**
   * 设置存档分享状态
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: ShareSaveInputSchema, output: SaveSlotSchema })
  async share(input: z.infer<typeof ShareSaveInputSchema>, @Ctx() ctx: Context) {
    return saveService.setShared(input.saveId, input.isShared, ctx.userId!);
  }

  /**
   * 通过分享码获取存档（无需登录）
   */
  @Query({
    input: GetSharedSaveInputSchema,
    output: SaveDataResponseSchema.extend({ userName: z.string().optional() }),
  })
  async getShared(input: z.infer<typeof GetSharedSaveInputSchema>) {
    return saveService.getShared(input.gameSlug, input.shareCode);
  }

  // ============= 管理员接口 =============

  /**
   * 管理员列出所有存档
   */
  @UseMiddlewares(requireUser)
  @Query({ input: AdminListSavesInputSchema, output: AdminListSavesOutputSchema })
  async adminList(input: z.infer<typeof AdminListSavesInputSchema>, @Ctx() ctx: Context) {
    return saveService.adminList(input, ctx.userId!);
  }

  /**
   * 管理员获取完整存档数据
   */
  @UseMiddlewares(requireUser)
  @Query({
    input: GetSaveInputSchema,
    output: SaveDataResponseSchema.extend({ userName: z.string().optional() }),
  })
  async adminGet(input: z.infer<typeof GetSaveInputSchema>, @Ctx() ctx: Context) {
    return saveService.adminGet(input.saveId, ctx.userId!);
  }

  /**
   * 管理员设置存档分享状态
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: ShareSaveInputSchema, output: SaveSlotSchema })
  async adminShare(input: z.infer<typeof ShareSaveInputSchema>, @Ctx() ctx: Context) {
    return saveService.adminSetShared(input.saveId, input.isShared, ctx.userId!);
  }

  /**
   * 管理员创建存档
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: AdminCreateSaveInputSchema, output: SaveSlotSchema })
  async adminCreate(input: z.infer<typeof AdminCreateSaveInputSchema>, @Ctx() ctx: Context) {
    return saveService.adminCreate(input, ctx.userId!);
  }

  /**
   * 管理员更新存档数据
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: AdminUpdateSaveInputSchema, output: SaveSlotSchema })
  async adminUpdate(input: z.infer<typeof AdminUpdateSaveInputSchema>, @Ctx() ctx: Context) {
    return saveService.adminUpdate(input, ctx.userId!);
  }

  /**
   * 管理员删除存档
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: AdminDeleteSaveInputSchema, output: z.object({ id: z.string() }) })
  async adminDelete(input: z.infer<typeof AdminDeleteSaveInputSchema>, @Ctx() ctx: Context) {
    return saveService.adminDelete(input.saveId, ctx.userId!);
  }
}
