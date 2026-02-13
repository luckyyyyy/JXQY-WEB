/**
 * Object 资源服务
 * 使用 PostgreSQL 数据库存储，数据以 JSON 形式存储在 data 字段中
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
import { TRPCError } from "@trpc/server";
import type {
	ObjRes,
	ObjResListItem,
	CreateObjResInput,
	UpdateObjResInput,
	ListObjResInput,
	ObjResource,
} from "@miu2d/types";
import {
	createDefaultObjResource,
} from "@miu2d/types";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../../db/client";
import { games, objResources } from "../../db/schema";
import type { Language } from "../../i18n";
import { verifyGameAccess } from "../../utils/gameAccess";
import { getMessage } from "../../i18n";

export class ObjResourceService {

	/**
	 * 将数据库记录转换为 ObjRes 类型
	 */
	private toObjRes(row: typeof objResources.$inferSelect): ObjRes {
		const data = row.data as { resources?: ObjResource };
		return {
			id: row.id,
			gameId: row.gameId,
			key: row.key,
			name: row.name,
			resources: data.resources ?? createDefaultObjResource(),
			createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
			updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
		};
	}

	/**
	 * 公开接口：通过 slug 列出游戏的所有 Object 资源配置（无需认证）
	 * 用于游戏客户端加载 Object 资源数据
	 */
	async listPublicBySlug(gameSlug: string): Promise<ObjRes[]> {
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
			.from(objResources)
			.where(eq(objResources.gameId, game.id))
			.orderBy(desc(objResources.updatedAt));

		return rows.map(row => this.toObjRes(row));
	}

	/**
	 * 获取单个 Object 资源配置
	 */
	async get(
		gameId: string,
		id: string,
		userId: string,
		language: Language
	): Promise<ObjRes | null> {
		await verifyGameAccess(gameId, userId, language);

		const [row] = await db
			.select()
			.from(objResources)
			.where(and(eq(objResources.id, id), eq(objResources.gameId, gameId)))
			.limit(1);

		if (!row) return null;
		return this.toObjRes(row);
	}

	/**
	 * 通过 key 获取 Object 资源配置
	 */
	async getByKey(
		gameId: string,
		key: string,
	): Promise<ObjRes | null> {
		const [row] = await db
			.select()
			.from(objResources)
			.where(and(eq(objResources.key, key.toLowerCase()), eq(objResources.gameId, gameId)))
			.limit(1);

		if (!row) return null;
		return this.toObjRes(row);
	}

	/**
	 * 列出 Object 资源配置
	 */
	async list(
		input: ListObjResInput,
		userId: string,
		language: Language
	): Promise<ObjResListItem[]> {
		await verifyGameAccess(input.gameId, userId, language);

		const rows = await db
			.select()
			.from(objResources)
			.where(eq(objResources.gameId, input.gameId))
			.orderBy(desc(objResources.updatedAt));

		return rows.map(row => {
			const data = row.data as { resources?: ObjResource };
			const resources = data.resources;
			return {
				id: row.id,
				key: row.key,
				name: row.name,
				icon: resources?.common?.image ?? null,
				updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
			};
		});
	}

	/**
	 * 创建 Object 资源配置
	 */
	async create(
		input: CreateObjResInput,
		userId: string,
		language: Language
	): Promise<ObjRes> {
		await verifyGameAccess(input.gameId, userId, language);

		const resources = input.resources ?? createDefaultObjResource();

		const [row] = await db
			.insert(objResources)
			.values({
				gameId: input.gameId,
				key: input.key.toLowerCase(),
				name: input.name,
				data: { resources },
			})
			.returning();

		return this.toObjRes(row);
	}

	/**
	 * 创建或更新 Object 资源配置（用于导入时）
	 */
	async upsert(
		gameId: string,
		key: string,
		name: string,
		resources: ObjResource,
		userId: string,
		language: Language
	): Promise<ObjRes> {
		await verifyGameAccess(gameId, userId, language);

		const keyLower = key.toLowerCase();

		// 先查找是否存在
		const existing = await this.getByKey(gameId, keyLower);
		if (existing) {
			// 更新
			const [row] = await db
				.update(objResources)
				.set({
					name,
					data: { resources },
					updatedAt: new Date(),
				})
				.where(and(eq(objResources.id, existing.id), eq(objResources.gameId, gameId)))
				.returning();

			return this.toObjRes(row);
		}

		// 创建
		const [row] = await db
			.insert(objResources)
			.values({
				gameId,
				key: keyLower,
				name,
				data: { resources },
			})
			.returning();

		return this.toObjRes(row);
	}

	/**
	 * 更新 Object 资源配置
	 */
	async update(
		input: UpdateObjResInput,
		userId: string,
		language: Language
	): Promise<ObjRes> {
		await verifyGameAccess(input.gameId, userId, language);

		// 检查是否存在
		const existing = await this.get(input.gameId, input.id, userId, language);
		if (!existing) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(language, "errors.obj.notFound")
			});
		}

		// 合并更新
		const updateData: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		if (input.key !== undefined) {
			updateData.key = input.key.toLowerCase();
		}
		if (input.name !== undefined) {
			updateData.name = input.name;
		}
		if (input.resources !== undefined) {
			updateData.data = { resources: input.resources };
		}

		const [row] = await db
			.update(objResources)
			.set(updateData)
			.where(and(eq(objResources.id, input.id), eq(objResources.gameId, input.gameId)))
			.returning();

		return this.toObjRes(row);
	}

	/**
	 * 删除 Object 资源配置
	 */
	async delete(
		gameId: string,
		id: string,
		userId: string,
		language: Language
	): Promise<{ id: string }> {
		await verifyGameAccess(gameId, userId, language);

		await db
			.delete(objResources)
			.where(and(eq(objResources.id, id), eq(objResources.gameId, gameId)));

		return { id };
	}
}

export const objResourceService = new ObjResourceService();
