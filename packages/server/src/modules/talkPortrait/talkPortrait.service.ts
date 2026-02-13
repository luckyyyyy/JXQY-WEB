
import type {
	PortraitEntry,
	UpdatePortraitMapInput,
	ImportPortraitMapInput,
} from "@miu2d/types";
import { parsePortraitIni } from "@miu2d/types";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { games, talkPortraits } from "../../db/schema";
import type { Language } from "../../i18n";
import { verifyGameAccess } from "../../utils/gameAccess";

export class TalkPortraitService {

	/**
	 * 获取头像映射（不存在则返回空数组）
	 */
	async get(
		gameId: string,
		userId: string,
		language: Language
	): Promise<{ gameId: string; entries: PortraitEntry[] }> {
		await verifyGameAccess(gameId, userId, language);

		const [row] = await db
			.select()
			.from(talkPortraits)
			.where(eq(talkPortraits.gameId, gameId))
			.limit(1);

		return {
			gameId,
			entries: row ? (row.data as PortraitEntry[]) : [],
		};
	}

	/**
	 * 公开接口：通过 slug 获取头像映射（无需认证）
	 */
	async getPublicBySlug(gameSlug: string): Promise<PortraitEntry[]> {
		const [game] = await db
			.select({ id: games.id })
			.from(games)
			.where(eq(games.slug, gameSlug))
			.limit(1);

		if (!game) {
			throw new Error("Game not found");
		}

		const [row] = await db
			.select()
			.from(talkPortraits)
			.where(eq(talkPortraits.gameId, game.id))
			.limit(1);

		return row ? (row.data as PortraitEntry[]) : [];
	}

	/**
	 * 更新头像映射（upsert）
	 */
	async update(
		input: UpdatePortraitMapInput,
		userId: string,
		language: Language
	): Promise<{ gameId: string; entries: PortraitEntry[] }> {
		await verifyGameAccess(input.gameId, userId, language);

		const sorted = [...input.entries].sort((a, b) => a.idx - b.idx);

		const [existing] = await db
			.select()
			.from(talkPortraits)
			.where(eq(talkPortraits.gameId, input.gameId))
			.limit(1);

		if (existing) {
			await db
				.update(talkPortraits)
				.set({
					data: sorted,
					updatedAt: new Date(),
				})
				.where(eq(talkPortraits.gameId, input.gameId));
		} else {
			await db
				.insert(talkPortraits)
				.values({
					gameId: input.gameId,
					data: sorted,
				});
		}

		return { gameId: input.gameId, entries: sorted };
	}

	/**
	 * 从 INI 导入头像映射
	 */
	async importFromIni(
		input: ImportPortraitMapInput,
		userId: string,
		language: Language
	): Promise<{ gameId: string; entries: PortraitEntry[] }> {
		await verifyGameAccess(input.gameId, userId, language);

		const entries = parsePortraitIni(input.iniContent);

		return this.update({
			gameId: input.gameId,
			entries,
		}, userId, language);
	}
}

export const talkPortraitService = new TalkPortraitService();
