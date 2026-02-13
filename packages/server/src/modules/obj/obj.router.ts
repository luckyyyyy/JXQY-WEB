/**
 * Object tRPC 路由
 */
import { Logger } from "../../utils/logger.js";
import { z } from "zod";
import {
	ObjSchema,
	ObjListItemSchema,
	CreateObjInputSchema,
	UpdateObjInputSchema,
	DeleteObjInputSchema,
	ListObjInputSchema,
	ImportObjInputSchema,
	BatchImportObjInputSchema,
	BatchImportObjResultSchema,
	GetObjInputSchema,
} from "@miu2d/types";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { objService } from "./obj.service";

@Router({ alias: "obj" })
export class ObjRouter {
	private readonly logger = new Logger(ObjRouter.name);

	constructor() {
		this.logger.log("ObjRouter registered");
	}

	/**
	 * 获取 Object 列表
	 */
	@UseMiddlewares(requireUser)
	@Query({ input: ListObjInputSchema, output: z.array(ObjListItemSchema) })
	async list(input: z.infer<typeof ListObjInputSchema>, @Ctx() ctx: Context) {
		return objService.list(input, ctx.userId!, ctx.language);
	}

	/**
	 * 获取单个 Object 详情
	 */
	@UseMiddlewares(requireUser)
	@Query({ input: GetObjInputSchema, output: ObjSchema.nullable() })
	async get(input: z.infer<typeof GetObjInputSchema>, @Ctx() ctx: Context) {
		return objService.get(input.gameId, input.id, ctx.userId!, ctx.language);
	}

	/**
	 * 创建 Object
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: CreateObjInputSchema, output: ObjSchema })
	async create(input: z.infer<typeof CreateObjInputSchema>, @Ctx() ctx: Context) {
		return objService.create(input, ctx.userId!, ctx.language);
	}

	/**
	 * 更新 Object
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: UpdateObjInputSchema, output: ObjSchema })
	async update(input: z.infer<typeof UpdateObjInputSchema>, @Ctx() ctx: Context) {
		return objService.update(input, ctx.userId!, ctx.language);
	}

	/**
	 * 删除 Object
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: DeleteObjInputSchema, output: z.object({ id: z.string() }) })
	async delete(input: z.infer<typeof DeleteObjInputSchema>, @Ctx() ctx: Context) {
		return objService.delete(input.gameId, input.id, ctx.userId!, ctx.language);
	}

	/**
	 * 从 INI 导入 Object
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: ImportObjInputSchema, output: ObjSchema })
	async importFromIni(input: z.infer<typeof ImportObjInputSchema>, @Ctx() ctx: Context) {
		return objService.importFromIni(input, ctx.userId!, ctx.language);
	}

	/**
	 * 批量导入 Object（支持自动关联 objres）
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: BatchImportObjInputSchema, output: BatchImportObjResultSchema })
	async batchImportFromIni(input: z.infer<typeof BatchImportObjInputSchema>, @Ctx() ctx: Context) {
		return objService.batchImportFromIni(input, ctx.userId!, ctx.language);
	}
}
