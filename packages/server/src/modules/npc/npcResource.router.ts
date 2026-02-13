/**
 * NPC 资源 tRPC 路由
 */
import { Logger } from "../../utils/logger.js";
import { z } from "zod";
import {
	NpcResSchema,
	NpcResListItemSchema,
	CreateNpcResInputSchema,
	UpdateNpcResInputSchema,
	DeleteNpcResInputSchema,
	ListNpcResInputSchema,
	GetNpcResInputSchema,
} from "@miu2d/types";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { npcResourceService } from "./npcResource.service";

@Router({ alias: "npcResource" })
export class NpcResourceRouter {
	private readonly logger = new Logger(NpcResourceRouter.name);

	constructor() {
		this.logger.log("NpcResourceRouter registered");
	}

	/**
	 * 获取 NPC 资源列表
	 */
	@UseMiddlewares(requireUser)
	@Query({ input: ListNpcResInputSchema, output: z.array(NpcResListItemSchema) })
	async list(input: z.infer<typeof ListNpcResInputSchema>, @Ctx() ctx: Context) {
		return npcResourceService.list(input, ctx.userId!, ctx.language);
	}

	/**
	 * 获取单个 NPC 资源详情
	 */
	@UseMiddlewares(requireUser)
	@Query({ input: GetNpcResInputSchema, output: NpcResSchema.nullable() })
	async get(input: z.infer<typeof GetNpcResInputSchema>, @Ctx() ctx: Context) {
		return npcResourceService.get(input.gameId, input.id, ctx.userId!, ctx.language);
	}

	/**
	 * 创建 NPC 资源
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: CreateNpcResInputSchema, output: NpcResSchema })
	async create(input: z.infer<typeof CreateNpcResInputSchema>, @Ctx() ctx: Context) {
		return npcResourceService.create(input, ctx.userId!, ctx.language);
	}

	/**
	 * 更新 NPC 资源
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: UpdateNpcResInputSchema, output: NpcResSchema })
	async update(input: z.infer<typeof UpdateNpcResInputSchema>, @Ctx() ctx: Context) {
		return npcResourceService.update(input, ctx.userId!, ctx.language);
	}

	/**
	 * 删除 NPC 资源
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: DeleteNpcResInputSchema, output: z.object({ id: z.string() }) })
	async delete(input: z.infer<typeof DeleteNpcResInputSchema>, @Ctx() ctx: Context) {
		return npcResourceService.delete(input.gameId, input.id, ctx.userId!, ctx.language);
	}
}
