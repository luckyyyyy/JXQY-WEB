/**
 * Player 服务
 * 使用 PostgreSQL 数据库存储，数据以 JSON 形式存储在 data 字段中
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
import { TRPCError } from "@trpc/server";
import type {
	Player,
	PlayerListItem,
	CreatePlayerInput,
	UpdatePlayerInput,
	ListPlayerInput,
	ImportPlayerInput,
	BatchImportPlayerInput,
	BatchImportPlayerResult,
} from "@miu2d/types";
import { createDefaultPlayer } from "@miu2d/types";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { games, players } from "../../db/schema";
import type { Language } from "../../i18n";
import { verifyGameAccess } from "../../utils/gameAccess";
import { getMessage } from "../../i18n";

export class PlayerService {

	/**
	 * 将数据库记录转换为 Player 类型
	 */
	private toPlayer(row: typeof players.$inferSelect): Player {
		const data = row.data as Omit<Player, "id" | "gameId" | "key" | "name" | "index" | "createdAt" | "updatedAt">;
		return {
			...data,
			id: row.id,
			gameId: row.gameId,
			key: row.key,
			name: row.name,
			index: row.index,
			createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
			updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
		};
	}

	/**
	 * 公开接口：通过 slug 列出游戏的所有玩家角色（无需认证）
	 * 用于游戏客户端加载角色数据
	 */
	async listPublicBySlug(gameSlug: string): Promise<Player[]> {
		const [game] = await db
			.select({ id: games.id })
			.from(games)
			.where(eq(games.slug, gameSlug))
			.limit(1);

		if (!game) {
			throw new Error("Game not found");
		}

		const rows = await db
			.select()
			.from(players)
			.where(eq(players.gameId, game.id))
			.orderBy(players.index);

		return rows.map(row => this.toPlayer(row));
	}

	/**
	 * 获取单个玩家角色
	 */
	async get(
		gameId: string,
		playerId: string,
		userId: string,
		language: Language
	): Promise<Player | null> {
		await verifyGameAccess(gameId, userId, language);

		const [row] = await db
			.select()
			.from(players)
			.where(and(eq(players.id, playerId), eq(players.gameId, gameId)))
			.limit(1);

		if (!row) return null;
		return this.toPlayer(row);
	}

	/**
	 * 列出玩家角色
	 */
	async list(
		input: ListPlayerInput,
		userId: string,
		language: Language
	): Promise<PlayerListItem[]> {
		await verifyGameAccess(input.gameId, userId, language);

		const rows = await db
			.select()
			.from(players)
			.where(eq(players.gameId, input.gameId))
			.orderBy(players.index);

		return rows.map(row => {
			const data = row.data as Record<string, unknown>;
			return {
				id: row.id,
				key: row.key,
				name: row.name,
				index: row.index,
				level: (data.level as number) ?? 1,
				npcIni: (data.npcIni as string) ?? "",
				updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
			};
		});
	}

	/**
	 * 创建玩家角色
	 * index 未提供时自动递增（当前最大 index + 1）
	 */
	async create(
		input: CreatePlayerInput,
		userId: string,
		language: Language
	): Promise<Player> {
		await verifyGameAccess(input.gameId, userId, language);

		const defaultPlayer = createDefaultPlayer(input.gameId, input.key);
		const fullPlayer = {
			...defaultPlayer,
			...input,
		};

		// 分离索引字段和 data 字段
		const { gameId, key, name, index: inputIndex, id: _id, createdAt: _c, updatedAt: _u, ...data } = fullPlayer;

		// index 未指定时自动递增
		let index = inputIndex;
		if (index === undefined || index === null) {
			const [result] = await db
				.select({ maxIndex: sql<number>`coalesce(max(${players.index}), -1)` })
				.from(players)
				.where(eq(players.gameId, gameId));
			index = (result?.maxIndex ?? -1) + 1;
		}

		const [row] = await db
			.insert(players)
			.values({
				gameId,
				key,
				name: name ?? "",
				index,
				data,
			})
			.returning();

		return this.toPlayer(row);
	}

	/**
	 * 更新玩家角色
	 */
	async update(
		input: UpdatePlayerInput,
		userId: string,
		language: Language
	): Promise<Player> {
		await verifyGameAccess(input.gameId, userId, language);

		const existing = await this.get(input.gameId, input.id, userId, language);
		if (!existing) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(language, "errors.npc.notFound")
			});
		}

		const { id, gameId, ...inputData } = input;
		const merged = { ...existing, ...inputData };

		const {
			id: _id,
			gameId: _gameId,
			key,
			name,
			index,
			createdAt: _createdAt,
			updatedAt: _updatedAt,
			...data
		} = merged;

		const [row] = await db
			.update(players)
			.set({
				key,
				name,
				index: index ?? 0,
				data,
				updatedAt: new Date(),
			})
			.where(and(eq(players.id, id), eq(players.gameId, gameId)))
			.returning();

		return this.toPlayer(row);
	}

	/**
	 * 删除玩家角色
	 */
	async delete(
		gameId: string,
		playerId: string,
		userId: string,
		language: Language
	): Promise<{ id: string }> {
		await verifyGameAccess(gameId, userId, language);

		await db
			.delete(players)
			.where(and(eq(players.id, playerId), eq(players.gameId, gameId)));

		return { id: playerId };
	}

	/**
	 * 从 INI 导入玩家角色
	 */
	async importFromIni(
		input: ImportPlayerInput,
		userId: string,
		language: Language
	): Promise<Player> {
		await verifyGameAccess(input.gameId, userId, language);

		if (!input.iniContent) {
			throw new Error("角色配置内容为空");
		}

		const parsed = this.parsePlayerIni(input.iniContent);
		const key = input.fileName;

		// 从文件名提取 index（如 Player0.ini -> 0）
		const indexMatch = key.match(/Player(\d+)/i);
		const index = indexMatch ? parseInt(indexMatch[1], 10) : 0;

		return this.create({
			gameId: input.gameId,
			key,
			name: parsed.name ?? key.replace(/\.ini$/i, ""),
			index,
			...parsed,
		}, userId, language);
	}

	/**
	 * 批量导入玩家角色
	 */
	async batchImportFromIni(
		input: BatchImportPlayerInput,
		userId: string,
		language: Language
	): Promise<BatchImportPlayerResult> {
		await verifyGameAccess(input.gameId, userId, language);

		const success: BatchImportPlayerResult["success"] = [];
		const failed: BatchImportPlayerResult["failed"] = [];

		for (const item of input.items) {
			try {
				if (!item.iniContent) {
					throw new Error("角色配置内容为空");
				}

				const parsed = this.parsePlayerIni(item.iniContent);
				const key = item.fileName;

				const indexMatch = key.match(/Player(\d+)/i);
				const index = indexMatch ? parseInt(indexMatch[1], 10) : 0;

				const player = await this.create({
					gameId: input.gameId,
					key,
					name: parsed.name ?? item.fileName.replace(/\.ini$/i, ""),
					index,
					...parsed,
				}, userId, language);

				success.push({
					fileName: item.fileName,
					id: player.id,
					name: player.name,
					index: player.index,
				});
			} catch (error) {
				failed.push({
					fileName: item.fileName,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return { success, failed };
	}

	/**
	 * 解析 Player INI 内容（save/game/PlayerX.ini）
	 */
	parsePlayerIni(content: string): Partial<Player> {
		const result: Partial<Player> = {};
		const lines = content.split(/\r?\n/);
		let currentSection = "";

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith(";")) {
				continue;
			}

			const sectionMatch = trimmed.match(/^\[(.+)\]$/);
			if (sectionMatch) {
				currentSection = sectionMatch[1].toUpperCase();
				continue;
			}

			const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
			if (!kvMatch || currentSection !== "INIT") continue;

			const key = kvMatch[1].trim();
			const value = kvMatch[2].trim();

			switch (key) {
				case "Name": result.name = value; break;
				case "Kind": result.kind = parseInt(value, 10) || 2; break;
				case "NpcIni": result.npcIni = value; break;
				case "Dir": result.dir = parseInt(value, 10) || 0; break;
				case "MapX": result.mapX = parseInt(value, 10) || 0; break;
				case "MapY": result.mapY = parseInt(value, 10) || 0; break;
				case "Action": result.action = parseInt(value, 10) || 0; break;
				case "WalkSpeed": result.walkSpeed = parseInt(value, 10) || 1; break;
				case "PathFinder": result.pathFinder = parseInt(value, 10) || 0; break;
				case "DialogRadius": result.dialogRadius = parseInt(value, 10) || 1; break;
				case "ScriptFile": result.scriptFile = value; break;
				case "VisionRadius": result.visionRadius = parseInt(value, 10) || 10; break;
				case "Doing": result.doing = parseInt(value, 10) || 0; break;
				case "DesX": result.desX = parseInt(value, 10) || 0; break;
				case "DesY": result.desY = parseInt(value, 10) || 0; break;
				case "State": result.state = parseInt(value, 10) || 0; break;
				case "Relation": result.relation = parseInt(value, 10) || 0; break;
				case "Life": result.life = parseInt(value, 10) || 0; break;
				case "LifeMax": result.lifeMax = parseInt(value, 10) || 0; break;
				case "Thew": result.thew = parseInt(value, 10) || 0; break;
				case "ThewMax": result.thewMax = parseInt(value, 10) || 0; break;
				case "Mana": result.mana = parseInt(value, 10) || 0; break;
				case "ManaMax": result.manaMax = parseInt(value, 10) || 0; break;
				case "Attack": result.attack = parseInt(value, 10) || 0; break;
				case "Defend": result.defend = parseInt(value, 10) || 0; break;
				case "Evade": result.evade = parseInt(value, 10) || 0; break;
				case "Exp": result.exp = parseInt(value, 10) || 0; break;
				case "ExpBonus": result.expBonus = parseInt(value, 10) || 0; break;
				case "Belong": result.belong = parseInt(value, 10) || 0; break;
				case "Idle": result.idle = parseInt(value, 10) || 30; break;
				case "LevelUpExp": result.levelUpExp = parseInt(value, 10) || 0; break;
				case "Level": result.level = parseInt(value, 10) || 1; break;
				case "AttackLevel": result.attackLevel = parseInt(value, 10) || 1; break;
				case "Lum": result.lum = parseInt(value, 10) || 0; break;
				case "AttackRadius": result.attackRadius = parseInt(value, 10) || 1; break;
				case "BodyIni": result.bodyIni = value; break;
				case "FlyIni": result.flyIni = value; break;
				case "DeathScript": result.deathScript = value; break;
				case "FlyIni2": result.flyIni2 = value; break;
				case "Fight": result.fight = parseInt(value, 10) || 0; break;
				case "TimeLimit": result.timeLimit = parseInt(value, 10) || 0; break;
				case "TimeTrigger": result.timeTrigger = parseInt(value, 10) || 0; break;
				case "TimeCount": result.timeCount = parseInt(value, 10) || 0; break;
				case "Money": result.money = parseInt(value, 10) || 0; break;
				case "Magic": result.magic = parseInt(value, 10) || 0; break;
				case "ManaLimit": result.manaLimit = parseInt(value, 10) || 0; break;
				case "LevelIni": result.levelIni = value; break;
				case "TimeScript": result.timeScript = value; break;
				case "SecondAttack": result.secondAttack = value; break;
			}
		}

		return result;
	}
}

export const playerService = new PlayerService();
