import { Logger } from "../../utils/logger.js";
import type { z } from "zod";
import {
	TalkDataResultSchema,
	GetTalkDataInputSchema,
	UpdateTalkDataInputSchema,
	ImportTalkDataInputSchema,
	CreateTalkEntryInputSchema,
	UpdateTalkEntryInputSchema,
	DeleteTalkEntryInputSchema,
	SearchTalkInputSchema,
	SearchTalkResultSchema,
} from "@miu2d/types";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { talkService } from "./talk.service";

@Router({ alias: "talk" })
export class TalkRouter {
	private readonly logger = new Logger(TalkRouter.name);

	constructor() {
		this.logger.log("TalkRouter registered");
	}

	@UseMiddlewares(requireUser)
	@Query({ input: GetTalkDataInputSchema, output: TalkDataResultSchema })
	async get(input: z.infer<typeof GetTalkDataInputSchema>, @Ctx() ctx: Context) {
		return talkService.get(input.gameId, ctx.userId!, ctx.language);
	}

	@UseMiddlewares(requireUser)
	@Query({ input: SearchTalkInputSchema, output: SearchTalkResultSchema })
	async search(input: z.infer<typeof SearchTalkInputSchema>, @Ctx() ctx: Context) {
		return talkService.search(input, ctx.userId!, ctx.language);
	}

	@UseMiddlewares(requireUser)
	@Mutation({ input: UpdateTalkDataInputSchema, output: TalkDataResultSchema })
	async update(input: z.infer<typeof UpdateTalkDataInputSchema>, @Ctx() ctx: Context) {
		return talkService.update(input, ctx.userId!, ctx.language);
	}

	@UseMiddlewares(requireUser)
	@Mutation({ input: CreateTalkEntryInputSchema, output: TalkDataResultSchema })
	async addEntry(input: z.infer<typeof CreateTalkEntryInputSchema>, @Ctx() ctx: Context) {
		return talkService.addEntry(input.gameId, input.entry, ctx.userId!, ctx.language);
	}

	@UseMiddlewares(requireUser)
	@Mutation({ input: UpdateTalkEntryInputSchema, output: TalkDataResultSchema })
	async updateEntry(input: z.infer<typeof UpdateTalkEntryInputSchema>, @Ctx() ctx: Context) {
		return talkService.updateEntry(input.gameId, input.entry, ctx.userId!, ctx.language);
	}

	@UseMiddlewares(requireUser)
	@Mutation({ input: DeleteTalkEntryInputSchema, output: TalkDataResultSchema })
	async deleteEntry(input: z.infer<typeof DeleteTalkEntryInputSchema>, @Ctx() ctx: Context) {
		return talkService.deleteEntry(input.gameId, input.id, ctx.userId!, ctx.language);
	}

	@UseMiddlewares(requireUser)
	@Mutation({ input: ImportTalkDataInputSchema, output: TalkDataResultSchema })
	async importFromTxt(input: z.infer<typeof ImportTalkDataInputSchema>, @Ctx() ctx: Context) {
		return talkService.importFromTxt(input, ctx.userId!, ctx.language);
	}
}
