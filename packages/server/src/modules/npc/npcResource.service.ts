/**
 * NPC 资源服务
 * 使用 PostgreSQL 数据库存储，数据以 JSON 形式存储在 data 字段中
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */

import type {
  CreateNpcResInput,
  ListNpcResInput,
  NpcRes,
  NpcResListItem,
  NpcResource,
  UpdateNpcResInput,
} from "@miu2d/types";
import { createDefaultNpcResource } from "@miu2d/types";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { games, npcResources } from "../../db/schema";
import type { Language } from "../../i18n";
import { getMessage } from "../../i18n";
import { verifyGameAccess } from "../../utils/gameAccess";

export class NpcResourceService {
  /**
   * 将数据库记录转换为 NpcRes 类型
   */
  private toNpcRes(row: typeof npcResources.$inferSelect): NpcRes {
    const data = row.data as { resources?: NpcResource };
    return {
      id: row.id,
      gameId: row.gameId,
      key: row.key,
      name: row.name,
      resources: data.resources ?? createDefaultNpcResource(),
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * 公开接口：通过 slug 列出游戏的所有 NPC 资源配置（无需认证）
   * 用于游戏客户端加载 NPC 资源数据
   */
  async listPublicBySlug(gameSlug: string): Promise<NpcRes[]> {
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
      .from(npcResources)
      .where(eq(npcResources.gameId, game.id))
      .orderBy(desc(npcResources.updatedAt));

    return rows.map((row) => this.toNpcRes(row));
  }

  /**
   * 获取单个 NPC 资源配置
   */
  async get(
    gameId: string,
    id: string,
    userId: string,
    language: Language
  ): Promise<NpcRes | null> {
    await verifyGameAccess(gameId, userId, language);

    const [row] = await db
      .select()
      .from(npcResources)
      .where(and(eq(npcResources.id, id), eq(npcResources.gameId, gameId)))
      .limit(1);

    if (!row) return null;
    return this.toNpcRes(row);
  }

  /**
   * 通过 key 获取 NPC 资源配置
   */
  async getByKey(gameId: string, key: string): Promise<NpcRes | null> {
    const [row] = await db
      .select()
      .from(npcResources)
      .where(and(eq(npcResources.key, key.toLowerCase()), eq(npcResources.gameId, gameId)))
      .limit(1);

    if (!row) return null;
    return this.toNpcRes(row);
  }

  /**
   * 列出 NPC 资源配置
   */
  async list(
    input: ListNpcResInput,
    userId: string,
    language: Language
  ): Promise<NpcResListItem[]> {
    await verifyGameAccess(input.gameId, userId, language);

    const rows = await db
      .select()
      .from(npcResources)
      .where(eq(npcResources.gameId, input.gameId))
      .orderBy(desc(npcResources.updatedAt));

    return rows.map((row) => {
      const data = row.data as { resources?: NpcResource };
      const resources = data.resources;
      return {
        id: row.id,
        key: row.key,
        name: row.name,
        icon: resources?.stand?.image ?? null,
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  }

  /**
   * 创建 NPC 资源配置
   */
  async create(input: CreateNpcResInput, userId: string, language: Language): Promise<NpcRes> {
    await verifyGameAccess(input.gameId, userId, language);

    const resources = input.resources ?? createDefaultNpcResource();

    const [row] = await db
      .insert(npcResources)
      .values({
        gameId: input.gameId,
        key: input.key.toLowerCase(),
        name: input.name,
        data: { resources },
      })
      .returning();

    return this.toNpcRes(row);
  }

  /**
   * 创建或更新 NPC 资源配置（用于导入时）
   */
  async upsert(
    gameId: string,
    key: string,
    name: string,
    resources: NpcResource,
    userId: string,
    language: Language
  ): Promise<NpcRes> {
    await verifyGameAccess(gameId, userId, language);

    const keyLower = key.toLowerCase();

    // 先查找是否存在
    const existing = await this.getByKey(gameId, keyLower);
    if (existing) {
      // 更新
      const [row] = await db
        .update(npcResources)
        .set({
          name,
          data: { resources },
          updatedAt: new Date(),
        })
        .where(and(eq(npcResources.id, existing.id), eq(npcResources.gameId, gameId)))
        .returning();

      return this.toNpcRes(row);
    }

    // 创建
    const [row] = await db
      .insert(npcResources)
      .values({
        gameId,
        key: keyLower,
        name,
        data: { resources },
      })
      .returning();

    return this.toNpcRes(row);
  }

  /**
   * 更新 NPC 资源配置
   */
  async update(input: UpdateNpcResInput, userId: string, language: Language): Promise<NpcRes> {
    await verifyGameAccess(input.gameId, userId, language);

    // 检查是否存在
    const existing = await this.get(input.gameId, input.id, userId, language);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.npc.notFound"),
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
      .update(npcResources)
      .set(updateData)
      .where(and(eq(npcResources.id, input.id), eq(npcResources.gameId, input.gameId)))
      .returning();

    return this.toNpcRes(row);
  }

  /**
   * 删除 NPC 资源配置
   */
  async delete(
    gameId: string,
    id: string,
    userId: string,
    language: Language
  ): Promise<{ id: string }> {
    await verifyGameAccess(gameId, userId, language);

    await db
      .delete(npcResources)
      .where(and(eq(npcResources.id, id), eq(npcResources.gameId, gameId)));

    return { id };
  }
}

export const npcResourceService = new NpcResourceService();
