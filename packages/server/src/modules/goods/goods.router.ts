/**
 * 物品 tRPC 路由
 */
import { Logger } from "@nestjs/common";
import { z } from "zod";
import {
	GoodsSchema,
	GoodsListItemSchema,
	CreateGoodsInputSchema,
	UpdateGoodsInputSchema,
	DeleteGoodsInputSchema,
	ListGoodsInputSchema,
	ImportGoodsInputSchema,
	BatchImportGoodsInputSchema,
	BatchImportGoodsResultSchema,
	GetGoodsInputSchema,
} from "@miu2d/types";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
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
	@Query({ input: ListGoodsInputSchema, output: z.array(GoodsListItemSchema) })
	async list(input: z.infer<typeof ListGoodsInputSchema>, @Ctx() ctx: Context) {
		return goodsService.list(input, ctx.userId!, ctx.language);
	}

	/**
	 * 获取单个物品详情
	 */
	@UseMiddlewares(requireUser)
	@Query({ input: GetGoodsInputSchema, output: GoodsSchema.nullable() })
	async get(input: z.infer<typeof GetGoodsInputSchema>, @Ctx() ctx: Context) {
		return goodsService.get(input.gameId, input.id, ctx.userId!, ctx.language);
	}

	/**
	 * 创建物品
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: CreateGoodsInputSchema, output: GoodsSchema })
	async create(input: z.infer<typeof CreateGoodsInputSchema>, @Ctx() ctx: Context) {
		return goodsService.create(input, ctx.userId!, ctx.language);
	}

	/**
	 * 更新物品
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: UpdateGoodsInputSchema, output: GoodsSchema })
	async update(input: z.infer<typeof UpdateGoodsInputSchema>, @Ctx() ctx: Context) {
		return goodsService.update(input, ctx.userId!, ctx.language);
	}

	/**
	 * 删除物品
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: DeleteGoodsInputSchema, output: z.object({ id: z.string() }) })
	async delete(input: z.infer<typeof DeleteGoodsInputSchema>, @Ctx() ctx: Context) {
		return goodsService.delete(input.gameId, input.id, ctx.userId!, ctx.language);
	}

	/**
	 * 从 INI 导入物品
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: ImportGoodsInputSchema, output: GoodsSchema })
	async importFromIni(input: z.infer<typeof ImportGoodsInputSchema>, @Ctx() ctx: Context) {
		return goodsService.importFromIni(input, ctx.userId!, ctx.language);
	}

	/**
	 * 批量导入物品
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: BatchImportGoodsInputSchema, output: BatchImportGoodsResultSchema })
	async batchImportFromIni(input: z.infer<typeof BatchImportGoodsInputSchema>, @Ctx() ctx: Context) {
		return goodsService.batchImportFromIni(input, ctx.userId!, ctx.language);
	}
}
