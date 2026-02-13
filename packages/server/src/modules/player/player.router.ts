/**
 * Player tRPC 路由
 */
import { Logger } from "@nestjs/common";
import { z } from "zod";
import {
	PlayerSchema,
	PlayerListItemSchema,
	CreatePlayerInputSchema,
	UpdatePlayerInputSchema,
	DeletePlayerInputSchema,
	ListPlayerInputSchema,
	ImportPlayerInputSchema,
	BatchImportPlayerInputSchema,
	BatchImportPlayerResultSchema,
	GetPlayerInputSchema,
} from "@miu2d/types";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { playerService } from "./player.service";

@Router({ alias: "player" })
export class PlayerRouter {
	private readonly logger = new Logger(PlayerRouter.name);

	constructor() {
		this.logger.log("PlayerRouter registered");
	}

	/**
	 * 获取玩家角色列表
	 */
	@UseMiddlewares(requireUser)
	@Query({ input: ListPlayerInputSchema, output: z.array(PlayerListItemSchema) })
	async list(input: z.infer<typeof ListPlayerInputSchema>, @Ctx() ctx: Context) {
		return playerService.list(input, ctx.userId!, ctx.language);
	}

	/**
	 * 获取单个玩家角色详情
	 */
	@UseMiddlewares(requireUser)
	@Query({ input: GetPlayerInputSchema, output: PlayerSchema.nullable() })
	async get(input: z.infer<typeof GetPlayerInputSchema>, @Ctx() ctx: Context) {
		return playerService.get(input.gameId, input.id, ctx.userId!, ctx.language);
	}

	/**
	 * 创建玩家角色
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: CreatePlayerInputSchema, output: PlayerSchema })
	async create(input: z.infer<typeof CreatePlayerInputSchema>, @Ctx() ctx: Context) {
		return playerService.create(input, ctx.userId!, ctx.language);
	}

	/**
	 * 更新玩家角色
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: UpdatePlayerInputSchema, output: PlayerSchema })
	async update(input: z.infer<typeof UpdatePlayerInputSchema>, @Ctx() ctx: Context) {
		return playerService.update(input, ctx.userId!, ctx.language);
	}

	/**
	 * 删除玩家角色
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: DeletePlayerInputSchema, output: z.object({ id: z.string() }) })
	async delete(input: z.infer<typeof DeletePlayerInputSchema>, @Ctx() ctx: Context) {
		return playerService.delete(input.gameId, input.id, ctx.userId!, ctx.language);
	}

	/**
	 * 从 INI 导入玩家角色
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: ImportPlayerInputSchema, output: PlayerSchema })
	async importFromIni(input: z.infer<typeof ImportPlayerInputSchema>, @Ctx() ctx: Context) {
		return playerService.importFromIni(input, ctx.userId!, ctx.language);
	}

	/**
	 * 批量导入玩家角色
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: BatchImportPlayerInputSchema, output: BatchImportPlayerResultSchema })
	async batchImportFromIni(input: z.infer<typeof BatchImportPlayerInputSchema>, @Ctx() ctx: Context) {
		return playerService.batchImportFromIni(input, ctx.userId!, ctx.language);
	}
}
