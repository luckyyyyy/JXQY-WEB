/**
 * Object 资源 tRPC 路由
 */
import { Logger } from "../../utils/logger.js";
import { z } from "zod";
import {
	ObjResSchema,
	ObjResListItemSchema,
	CreateObjResInputSchema,
	UpdateObjResInputSchema,
	DeleteObjResInputSchema,
	ListObjResInputSchema,
	GetObjResInputSchema,
} from "@miu2d/types";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { objResourceService } from "./objResource.service";

@Router({ alias: "objResource" })
export class ObjResourceRouter {
	private readonly logger = new Logger(ObjResourceRouter.name);

	constructor() {
		this.logger.log("ObjResourceRouter registered");
	}

	/**
	 * 获取 Object 资源列表
	 */
	@UseMiddlewares(requireUser)
	@Query({ input: ListObjResInputSchema, output: z.array(ObjResListItemSchema) })
	async list(input: z.infer<typeof ListObjResInputSchema>, @Ctx() ctx: Context) {
		return objResourceService.list(input, ctx.userId!, ctx.language);
	}

	/**
	 * 获取单个 Object 资源详情
	 */
	@UseMiddlewares(requireUser)
	@Query({ input: GetObjResInputSchema, output: ObjResSchema.nullable() })
	async get(input: z.infer<typeof GetObjResInputSchema>, @Ctx() ctx: Context) {
		return objResourceService.get(input.gameId, input.id, ctx.userId!, ctx.language);
	}

	/**
	 * 创建 Object 资源
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: CreateObjResInputSchema, output: ObjResSchema })
	async create(input: z.infer<typeof CreateObjResInputSchema>, @Ctx() ctx: Context) {
		return objResourceService.create(input, ctx.userId!, ctx.language);
	}

	/**
	 * 更新 Object 资源
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: UpdateObjResInputSchema, output: ObjResSchema })
	async update(input: z.infer<typeof UpdateObjResInputSchema>, @Ctx() ctx: Context) {
		return objResourceService.update(input, ctx.userId!, ctx.language);
	}

	/**
	 * 删除 Object 资源
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: DeleteObjResInputSchema, output: z.object({ id: z.string() }) })
	async delete(input: z.infer<typeof DeleteObjResInputSchema>, @Ctx() ctx: Context) {
		return objResourceService.delete(input.gameId, input.id, ctx.userId!, ctx.language);
	}
}
