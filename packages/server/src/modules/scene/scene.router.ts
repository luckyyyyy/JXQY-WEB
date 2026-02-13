/**
 * 场景 tRPC 路由
 */
import { Logger } from "@nestjs/common";
import { z } from "zod";
import {
	SceneSchema,
	SceneListItemSchema,
	ListSceneInputSchema,
	GetSceneInputSchema,
	CreateSceneInputSchema,
	UpdateSceneInputSchema,
	DeleteSceneInputSchema,
	ImportSceneBatchInputSchema,
	ImportSceneBatchResultSchema,
	ClearAllScenesInputSchema,
	ClearAllScenesResultSchema,
} from "@miu2d/types";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { sceneService } from "./scene.service";

@Router({ alias: "scene" })
export class SceneRouter {
	private readonly logger = new Logger(SceneRouter.name);

	constructor() {
		this.logger.log("SceneRouter registered");
	}

	// ============= 场景 CRUD =============

	@UseMiddlewares(requireUser)
	@Query({ input: ListSceneInputSchema, output: z.array(SceneListItemSchema) })
	async list(input: z.infer<typeof ListSceneInputSchema>, @Ctx() ctx: Context) {
		return sceneService.list(input, ctx.userId!, ctx.language);
	}

	@UseMiddlewares(requireUser)
	@Query({ input: GetSceneInputSchema, output: SceneSchema.nullable() })
	async get(input: z.infer<typeof GetSceneInputSchema>, @Ctx() ctx: Context) {
		return sceneService.get(input.gameId, input.id, ctx.userId!, ctx.language);
	}

	@UseMiddlewares(requireUser)
	@Mutation({ input: CreateSceneInputSchema, output: SceneSchema })
	async create(input: z.infer<typeof CreateSceneInputSchema>, @Ctx() ctx: Context) {
		return sceneService.create(input, ctx.userId!, ctx.language);
	}

	@UseMiddlewares(requireUser)
	@Mutation({ input: UpdateSceneInputSchema, output: SceneSchema })
	async update(input: z.infer<typeof UpdateSceneInputSchema>, @Ctx() ctx: Context) {
		return sceneService.update(input, ctx.userId!, ctx.language);
	}

	@UseMiddlewares(requireUser)
	@Mutation({ input: DeleteSceneInputSchema, output: z.object({ id: z.string() }) })
	async delete(input: z.infer<typeof DeleteSceneInputSchema>, @Ctx() ctx: Context) {
		return sceneService.delete(input.gameId, input.id, ctx.userId!, ctx.language);
	}

	// ============= 批量导入（逐条） =============

	@UseMiddlewares(requireUser)
	@Mutation({ input: ImportSceneBatchInputSchema, output: ImportSceneBatchResultSchema })
	async importScene(input: z.infer<typeof ImportSceneBatchInputSchema>, @Ctx() ctx: Context) {
		return sceneService.importScene(input, ctx.userId!, ctx.language);
	}

	// ============= 清空所有场景 =============

	@UseMiddlewares(requireUser)
	@Mutation({ input: ClearAllScenesInputSchema, output: ClearAllScenesResultSchema })
	async clearAll(input: z.infer<typeof ClearAllScenesInputSchema>, @Ctx() ctx: Context) {
		return sceneService.clearAll(input, ctx.userId!, ctx.language);
	}
}
