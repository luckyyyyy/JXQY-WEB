/**
 * 武功服务
 * 使用 PostgreSQL 数据库存储，数据以 JSON 形式存储在 data 字段中
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
import { TRPCError } from "@trpc/server";
import type {
	Magic,
	CreateMagicInput,
	UpdateMagicInput,
	ListMagicInput,
	ImportMagicInput,
	BatchImportMagicInput,
	BatchImportMagicResult,
	MagicLevel,
	MagicListItem,
	AttackFile,
	MagicMoveKind,
} from "@miu2d/types";
import {
	MagicMoveKindFromValue,
	MagicSpecialKindFromValue,
	MagicBelongFromValue,
	createDefaultMagic,
	createDefaultAttackFile,
} from "@miu2d/types";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../../db/client";
import { games, magics } from "../../db/schema";
import type { Language } from "../../i18n";
import { verifyGameAccess } from "../../utils/gameAccess";
import { getMessage } from "../../i18n";

export class MagicService {

	/**
	 * 将数据库记录转换为 Magic 类型
	 */
	private toMagic(row: typeof magics.$inferSelect): Magic {
		const data = row.data as Omit<Magic, "id" | "gameId" | "key" | "userType" | "name" | "createdAt" | "updatedAt">;
		return {
			...data,
			id: row.id,
			gameId: row.gameId,
			key: row.key,
			userType: row.userType as Magic["userType"],
			name: row.name,
			createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
			updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
		};
	}

	/**
	 * 公开接口：通过 slug 列出游戏的所有武功（无需认证）
	 * 用于游戏客户端加载武功数据
	 */
	async listPublicBySlug(gameSlug: string): Promise<Magic[]> {
		// 通过 slug 查找游戏
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
			.from(magics)
			.where(eq(magics.gameId, game.id))
			.orderBy(desc(magics.updatedAt));

		return rows.map(row => this.toMagic(row));
	}

	/**
	 * 获取单个武功
	 */
	async get(
		gameId: string,
		magicId: string,
		userId: string,
		language: Language
	): Promise<Magic | null> {
		await verifyGameAccess(gameId, userId, language);

		const [row] = await db
			.select()
			.from(magics)
			.where(and(eq(magics.id, magicId), eq(magics.gameId, gameId)))
			.limit(1);

		if (!row) return null;
		return this.toMagic(row);
	}

	/**
	 * 列出武功
	 */
	async list(
		input: ListMagicInput,
		userId: string,
		language: Language
	): Promise<MagicListItem[]> {
		await verifyGameAccess(input.gameId, userId, language);

		const conditions = [eq(magics.gameId, input.gameId)];
		if (input.userType) {
			conditions.push(eq(magics.userType, input.userType));
		}

		const rows = await db
			.select()
			.from(magics)
			.where(and(...conditions))
			.orderBy(desc(magics.updatedAt));

		return rows.map(row => {
			const data = row.data as Record<string, unknown>;
			return {
				id: row.id,
				key: row.key,
				name: row.name,
				userType: row.userType as MagicListItem["userType"],
				moveKind: (data.moveKind as MagicMoveKind) ?? "SingleMove",
				belong: data.belong as MagicListItem["belong"] ?? null,
				icon: (data.icon as string) ?? null,
				updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
			};
		});
	}

	/**
	 * 创建武功
	 */
	async create(
		input: CreateMagicInput,
		userId: string,
		language: Language
	): Promise<Magic> {
		await verifyGameAccess(input.gameId, userId, language);

		const defaultMagic = createDefaultMagic(input.gameId, input.userType, input.key);
		const fullMagic = {
			...defaultMagic,
			...input,
		};

		// 分离索引字段和 data 字段
		const { gameId, key, userType, name, ...data } = fullMagic;

		const [row] = await db
			.insert(magics)
			.values({
				gameId,
				key,
				userType,
				name,
				data,
			})
			.returning();

		return this.toMagic(row);
	}

	/**
	 * 更新武功
	 */
	async update(
		input: UpdateMagicInput,
		userId: string,
		language: Language
	): Promise<Magic> {
		await verifyGameAccess(input.gameId, userId, language);

		// 检查是否存在
		const existing = await this.get(input.gameId, input.id, userId, language);
		if (!existing) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(language, "errors.magic.notFound")
			});
		}

		// 合并更新
		const { id, gameId, createdAt, updatedAt, ...inputData } = input;
		const merged = { ...existing, ...inputData };

		// 分离索引字段和 data 字段
		const {
			id: _id,
			gameId: _gameId,
			key,
			userType,
			name,
			createdAt: _createdAt,
			updatedAt: _updatedAt,
			...data
		} = merged;

		const [row] = await db
			.update(magics)
			.set({
				key,
				userType,
				name,
				data,
				updatedAt: new Date(),
			})
			.where(and(eq(magics.id, id), eq(magics.gameId, gameId)))
			.returning();

		return this.toMagic(row);
	}

	/**
	 * 删除武功
	 */
	async delete(
		gameId: string,
		magicId: string,
		userId: string,
		language: Language
	): Promise<{ id: string }> {
		await verifyGameAccess(gameId, userId, language);

		await db
			.delete(magics)
			.where(and(eq(magics.id, magicId), eq(magics.gameId, gameId)));

		return { id: magicId };
	}

	/**
	 * 从 INI 导入武功
	 */
	async importFromIni(
		input: ImportMagicInput,
		userId: string,
		language: Language
	): Promise<Magic> {
		await verifyGameAccess(input.gameId, userId, language);

		const parsed = this.parseIni(input.iniContent, input.userType);

		// 如果有 AttackFile INI，解析并设置 attackFile 字段
		if (input.attackFileContent) {
			parsed.attackFile = this.parseAttackFileIni(input.attackFileContent);
		}

		// 使用文件名作为 key
		const key = input.fileName;

		return this.create({
			gameId: input.gameId,
			userType: input.userType,
			key,
			name: parsed.name ?? "未命名武功",
			intro: parsed.intro,
			moveKind: parsed.moveKind,
			specialKind: parsed.specialKind,
			belong: parsed.belong,
			...parsed,
		}, userId, language);
	}

	/**
	 * 批量导入武功
	 * 支持自动识别飞行武功（有 AttackFile 的武功）
	 * 支持每个文件单独指定 userType（用于自动识别玩家/NPC武功）
	 */
	async batchImportFromIni(
		input: BatchImportMagicInput,
		userId: string,
		language: Language
	): Promise<BatchImportMagicResult> {
		await verifyGameAccess(input.gameId, userId, language);

		const success: BatchImportMagicResult["success"] = [];
		const failed: BatchImportMagicResult["failed"] = [];

		for (const item of input.items) {
			try {
				// 优先使用每个文件的 userType，否则使用全局 userType，最后默认为 npc
				const userType = item.userType ?? input.userType ?? "npc";
				const parsed = this.parseIni(item.iniContent, userType);
				const isFlyingMagic = !!item.attackFileContent;

				// 如果有 AttackFile INI，解析并设置 attackFile 字段
				if (item.attackFileContent) {
					parsed.attackFile = this.parseAttackFileIni(item.attackFileContent);
				}

				// 使用文件名作为 key
				const key = item.fileName;

				const magic = await this.create({
					gameId: input.gameId,
					userType,
					key,
					name: parsed.name ?? item.fileName.replace(/\.ini$/i, "") ?? "未命名武功",
					intro: parsed.intro,
					moveKind: parsed.moveKind,
					specialKind: parsed.specialKind,
					belong: parsed.belong,
					...parsed,
				}, userId, language);

				success.push({
					fileName: item.fileName,
					id: magic.id,
					name: magic.name,
					isFlyingMagic,
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
	 * 解析 AttackFile INI 内容
	 */
	private parseAttackFileIni(content: string): AttackFile {
		const result = createDefaultAttackFile();
		const lines = content.split(/\r?\n/);
		let currentSection = "";

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith(";")) {
				continue;
			}

			const sectionMatch = trimmed.match(/^\[(.+)\]$/);
			if (sectionMatch) {
				currentSection = sectionMatch[1];
				continue;
			}

			const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
			if (!kvMatch || currentSection !== "Init") continue;

			const key = kvMatch[1].trim();
			const value = kvMatch[2].trim();

			switch (key) {
				case "Name":
					result.name = value;
					break;
				case "Intro":
					result.intro = value;
					break;
				case "MoveKind":
					result.moveKind = MagicMoveKindFromValue[parseInt(value, 10)] ?? "SingleMove";
					break;
				case "Speed":
					result.speed = parseInt(value, 10) || 8;
					break;
				case "Region":
					result.region = parseInt(value, 10) || 0;
					break;
				case "SpecialKind":
					result.specialKind = MagicSpecialKindFromValue[parseInt(value, 10)] ?? "None";
					break;
				case "SpecialKindValue":
					result.specialKindValue = parseInt(value, 10) || 0;
					break;
				case "SpecialKindMilliSeconds":
					result.specialKindMilliSeconds = parseInt(value, 10) || 0;
					break;
				case "AlphaBlend":
					result.alphaBlend = value === "1";
					break;
				case "FlyingLum":
					result.flyingLum = parseInt(value, 10) || 0;
					break;
				case "VanishLum":
					result.vanishLum = parseInt(value, 10) || 0;
					break;
				case "WaitFrame":
					result.waitFrame = parseInt(value, 10) || 0;
					break;
				case "LifeFrame":
					result.lifeFrame = parseInt(value, 10) || 4;
					break;
				case "FlyingImage":
					result.flyingImage = value || null;
					break;
				case "FlyingSound":
					result.flyingSound = value || null;
					break;
				case "VanishImage":
					result.vanishImage = value || null;
					break;
				case "VanishSound":
					result.vanishSound = value || null;
					break;
				case "PassThrough":
					result.passThrough = value === "1";
					break;
				case "PassThroughWall":
					result.passThroughWall = value === "1";
					break;
				case "TraceEnemy":
					result.traceEnemy = value === "1";
					break;
				case "TraceSpeed":
					result.traceSpeed = parseInt(value, 10) || 0;
					break;
				case "RangeRadius":
					result.rangeRadius = parseInt(value, 10) || 0;
					break;
				case "AttackAll":
					result.attackAll = value === "1";
					break;
				case "Bounce":
					result.bounce = value === "1";
					break;
				case "BounceHurt":
					result.bounceHurt = parseInt(value, 10) || 0;
					break;
				case "VibratingScreen":
					result.vibratingScreen = value === "1";
					break;
			}
		}

		return result;
	}

	/**
	 * 解析 INI 文件
	 */
	private parseIni(content: string, userType: "player" | "npc"): Partial<Magic> {
		const lines = content.split(/\r?\n/);
		const result: Partial<Magic> = {};
		const levels: MagicLevel[] = [];
		let currentSection = "";

		for (const line of lines) {
			const trimmed = line.trim();

			if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith(";")) {
				continue;
			}

			const sectionMatch = trimmed.match(/^\[(.+)\]$/);
			if (sectionMatch) {
				currentSection = sectionMatch[1];
				continue;
			}

			const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
			if (!kvMatch) continue;

			const key = kvMatch[1].trim();
			const value = kvMatch[2].trim();

			if (currentSection === "Init") {
				this.parseInitSection(key, value, result);
			} else if (currentSection.startsWith("Level")) {
				const levelNum = parseInt(currentSection.replace("Level", ""), 10);
				if (!Number.isNaN(levelNum)) {
					let level = levels.find(l => l.level === levelNum);
					if (!level) {
						level = { level: levelNum, effect: 0, manaCost: 0 };
						levels.push(level);
					}
					this.parseLevelSection(key, value, level);
				}
			}
		}

		result.userType = userType;

		if (userType === "player") {
			// 如果 INI 有 [Level] 段，使用解析的等级数据
			// 如果没有，显式设置 levels=null 以覆盖 createDefaultMagic 的默认值
			// （默认值的 effect=100,200... 会导致引擎不使用 realAttack）
			result.levels = levels.length > 0 ? levels.sort((a, b) => a.level - b.level) : null;
		}

		return result;
	}

	/**
	 * 解析 [Init] 段
	 */
	private parseInitSection(key: string, value: string, result: Partial<Magic>): void {
		switch (key) {
			case "Name":
				result.name = value;
				break;
			case "Intro":
				result.intro = value.trim();
				break;
			case "MoveKind":
				result.moveKind = MagicMoveKindFromValue[parseInt(value, 10)] ?? "SingleMove";
				break;
			case "SpecialKind":
				result.specialKind = MagicSpecialKindFromValue[parseInt(value, 10)] ?? "None";
				break;
			case "Speed":
				result.speed = parseInt(value, 10) || 8;
				break;
			case "Region":
				result.region = parseInt(value, 10) || 0;
				break;
			case "AlphaBlend":
				result.alphaBlend = value === "1";
				break;
			case "FlyingLum":
				result.flyingLum = parseInt(value, 10) || 0;
				break;
			case "VanishLum":
				result.vanishLum = parseInt(value, 10) || 0;
				break;
			case "WaitFrame":
				result.waitFrame = parseInt(value, 10) || 0;
				break;
			case "LifeFrame":
				result.lifeFrame = parseInt(value, 10) || 0;
				break;
			case "Image":
				result.image = value || null;
				break;
			case "Icon":
				result.icon = value || null;
				break;
			case "FlyingImage":
				result.flyingImage = value || null;
				break;
			case "FlyingSound":
				result.flyingSound = value || null;
				break;
			case "VanishImage":
				result.vanishImage = value || null;
				break;
			case "VanishSound":
				result.vanishSound = value || null;
				break;
			case "SuperModeImage":
				result.superModeImage = value || null;
				break;
			case "Belong":
				if (value) {
					result.belong = MagicBelongFromValue[parseInt(value, 10)] ?? "Neutral";
				}
				break;
			case "ActionFile":
				result.actionFile = value || null;
				break;
			case "PassThrough":
				result.passThrough = value === "1";
				break;
			case "PassThroughWall":
				result.passThroughWall = value === "1";
				break;
			case "TraceEnemy":
				result.traceEnemy = value === "1";
				break;
			case "TraceSpeed":
				result.traceSpeed = parseInt(value, 10) || 0;
				break;
			case "ColdMilliSeconds":
				result.coldMilliSeconds = parseInt(value, 10) || 0;
				break;
			case "RangeRadius":
				result.rangeRadius = parseInt(value, 10) || 0;
				break;
			case "AttackAll":
				result.attackAll = value === "1";
				break;
			case "Bounce":
				result.bounce = value === "1";
				break;
			case "BounceHurt":
				result.bounceHurt = parseInt(value, 10) || 0;
				break;
			case "VibratingScreen":
				result.vibratingScreen = value === "1";
				break;
			case "SpecialKindValue":
				result.specialKindValue = parseInt(value, 10) || 0;
				break;
			case "SpecialKindMilliSeconds":
				result.specialKindMilliSeconds = parseInt(value, 10) || 0;
				break;
		}
	}

	/**
	 * 解析 [LevelN] 段
	 */
	private parseLevelSection(key: string, value: string, level: MagicLevel): void {
		switch (key) {
			case "Effect":
				level.effect = parseInt(value, 10) || 0;
				break;
			case "ManaCost":
				level.manaCost = parseInt(value, 10) || 0;
				break;
			case "LevelupExp":
				level.levelupExp = value ? parseInt(value, 10) || null : null;
				break;
			case "Speed":
				if (value) {
					level.speed = parseInt(value, 10);
				}
				break;
			case "MoveKind":
				if (value) {
					level.moveKind = MagicMoveKindFromValue[parseInt(value, 10)];
				}
				break;
			case "LifeFrame":
				if (value) {
					level.lifeFrame = parseInt(value, 10);
				}
				break;
		}
	}
}

export const magicService = new MagicService();
