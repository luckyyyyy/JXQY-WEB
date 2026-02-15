/**
 * 场景服务
 *
 * MMF 地图二进制数据存储在 scenes.mmfData (base64)
 * 解析后的 mapParsed (MiuMapDataDto) 在 API 响应中按需计算
 * 其他数据（脚本/陷阱/NPC/OBJ）解析为 JSON 存储在 scene.data 字段
 */

import type {
  ClearAllScenesInput,
  ClearAllScenesResult,
  CreateSceneInput,
  ImportSceneBatchInput,
  ImportSceneBatchResult,
  ListSceneInput,
  Scene,
  SceneData,
  SceneListItem,
  SceneNpcEntry,
  SceneObjEntry,
  UpdateSceneInput,
} from "@miu2d/types";
import { getSceneDataCounts } from "@miu2d/types";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { games, scenes } from "../../db/schema";
import type { Language } from "../../i18n";
import { getMessage } from "../../i18n";
import { verifyGameAccess } from "../../utils/gameAccess";
import { parseMmfToDto, serializeDtoToMmf } from "./mmf-helper";

export class SceneService {
  /**
   * 将数据库记录转换为 Scene 类型
   */
  private toScene(row: typeof scenes.$inferSelect): Scene {
    const mmfData = row.mmfData ?? null;
    // 按需解析 MMF 二进制为结构化 DTO
    const mapParsed = mmfData ? parseMmfToDto(mmfData) : null;
    return {
      id: row.id,
      gameId: row.gameId,
      key: row.key,
      name: row.name,
      mapFileName: row.mapFileName,
      mmfData: null, // 不再返回原始二进制，前端使用 mapParsed
      mapParsed,
      data: (row.data as Record<string, unknown>) ?? null,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  // ============= 场景 CRUD =============

  /**
   * 列出场景（从 scene.data 计算子项统计）
   */
  async list(input: ListSceneInput, userId: string, language: Language): Promise<SceneListItem[]> {
    await verifyGameAccess(input.gameId, userId, language);

    const rows = await db
      .select()
      .from(scenes)
      .where(eq(scenes.gameId, input.gameId))
      .orderBy(scenes.key);

    return rows.map((row) => {
      const data = (row.data ?? {}) as SceneData;
      const counts = getSceneDataCounts(data);
      return {
        id: row.id,
        key: row.key,
        name: row.name,
        mapFileName: row.mapFileName,
        ...counts,
        scriptKeys: data.scripts ? Object.keys(data.scripts) : [],
        trapKeys: data.traps ? Object.keys(data.traps) : [],
        npcKeys: data.npc ? Object.keys(data.npc) : [],
        objKeys: data.obj ? Object.keys(data.obj) : [],
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  }

  /**
   * 获取单个场景
   */
  async get(
    gameId: string,
    sceneId: string,
    userId: string,
    language: Language
  ): Promise<Scene | null> {
    await verifyGameAccess(gameId, userId, language);

    const [row] = await db
      .select()
      .from(scenes)
      .where(and(eq(scenes.id, sceneId), eq(scenes.gameId, gameId)))
      .limit(1);

    if (!row) return null;
    return this.toScene(row);
  }

  /**
   * 创建场景
   */
  async create(input: CreateSceneInput, userId: string, language: Language): Promise<Scene> {
    await verifyGameAccess(input.gameId, userId, language);

    const [row] = await db
      .insert(scenes)
      .values({
        gameId: input.gameId,
        key: input.key,
        name: input.name,
        mapFileName: input.mapFileName,
        data: input.data ?? null,
      })
      .returning();

    return this.toScene(row);
  }

  /**
   * 更新场景
   */
  async update(input: UpdateSceneInput, userId: string, language: Language): Promise<Scene> {
    await verifyGameAccess(input.gameId, userId, language);

    const existing = await this.get(input.gameId, input.id, userId, language);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.scene.notFound"),
      });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.data !== undefined) updates.data = input.data;

    // 如果前端发送了 mapParsed 更新，序列化回二进制存储
    if (input.mapParsed !== undefined && input.mapParsed !== null) {
      updates.mmfData = serializeDtoToMmf(input.mapParsed);
    }

    const [row] = await db
      .update(scenes)
      .set(updates)
      .where(and(eq(scenes.id, input.id), eq(scenes.gameId, input.gameId)))
      .returning();

    return this.toScene(row);
  }

  /**
   * 删除场景
   */
  async delete(
    gameId: string,
    sceneId: string,
    userId: string,
    language: Language
  ): Promise<{ id: string }> {
    await verifyGameAccess(gameId, userId, language);

    const [row] = await db
      .delete(scenes)
      .where(and(eq(scenes.id, sceneId), eq(scenes.gameId, gameId)))
      .returning({ id: scenes.id });

    if (!row) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.scene.notFound"),
      });
    }

    return row;
  }

  // ============= 批量导入（逐条） =============

  /**
   * 导入单个场景（前端已解析好全部数据）
   * 包含 MMF base64 + scripts/traps/npc/obj
   */
  async importScene(
    input: ImportSceneBatchInput,
    userId: string,
    language: Language
  ): Promise<ImportSceneBatchResult> {
    await verifyGameAccess(input.gameId, userId, language);

    const { scene } = input;

    try {
      // 检查是否已存在
      const [existing] = await db
        .select({ id: scenes.id })
        .from(scenes)
        .where(and(eq(scenes.gameId, input.gameId), eq(scenes.key, scene.key)))
        .limit(1);

      if (existing) {
        // 更新现有场景
        await db
          .update(scenes)
          .set({
            name: scene.name,
            mapFileName: scene.mapFileName,
            mmfData: scene.mmfData,
            data: scene.data as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(and(eq(scenes.id, existing.id), eq(scenes.gameId, input.gameId)));

        return { ok: true, action: "updated", sceneName: scene.name };
      }

      // 创建新场景
      await db.insert(scenes).values({
        gameId: input.gameId,
        key: scene.key,
        name: scene.name,
        mapFileName: scene.mapFileName,
        mmfData: scene.mmfData,
        data: scene.data as Record<string, unknown>,
      });

      return { ok: true, action: "created", sceneName: scene.name };
    } catch (e) {
      return {
        ok: false,
        action: "error",
        sceneName: scene.name,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // ============= 清空所有场景 =============

  /**
   * 清空指定游戏的所有场景数据
   */
  async clearAll(
    input: ClearAllScenesInput,
    userId: string,
    language: Language
  ): Promise<ClearAllScenesResult> {
    await verifyGameAccess(input.gameId, userId, language);

    const deleted = await db
      .delete(scenes)
      .where(eq(scenes.gameId, input.gameId))
      .returning({ id: scenes.id });

    return { deletedCount: deleted.length };
  }

  // ============= 公开 REST API（无需认证） =============

  /**
   * 通过 gameSlug 获取 gameId
   */
  private async getGameIdBySlug(gameSlug: string): Promise<string | null> {
    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.slug, gameSlug))
      .limit(1);
    return game?.id ?? null;
  }

  /**
   * 获取 MMF 地图二进制数据（公开接口）
   *
   * 从 scenes.mmfData (base64) 解码为 Buffer 直接返回
   */
  async getMmfBinaryBySlug(gameSlug: string, sceneKey: string): Promise<Buffer | null> {
    const gameId = await this.getGameIdBySlug(gameSlug);
    if (!gameId) return null;

    const [row] = await db
      .select({ mmfData: scenes.mmfData })
      .from(scenes)
      .where(and(eq(scenes.gameId, gameId), eq(scenes.key, sceneKey)))
      .limit(1);

    if (!row?.mmfData) return null;
    return Buffer.from(row.mmfData, "base64");
  }

  /**
   * 获取 NPC 条目数据（公开接口）
   *
   * 从指定场景的 data.npc 中查找 npcKey，
   * 直接返回 SceneNpcEntry[] JSON 数组
   */
  async getNpcEntriesBySlug(
    gameSlug: string,
    sceneKey: string,
    npcKey: string
  ): Promise<SceneNpcEntry[] | null> {
    const gameId = await this.getGameIdBySlug(gameSlug);
    if (!gameId) return null;

    const [row] = await db
      .select({ data: scenes.data })
      .from(scenes)
      .where(and(eq(scenes.gameId, gameId), eq(scenes.key, sceneKey)))
      .limit(1);

    if (!row) return null;
    const data = row.data as SceneData | null;
    const npcData = data?.npc?.[npcKey];
    if (npcData?.entries) {
      return npcData.entries;
    }
    return null;
  }

  /**
   * 获取 OBJ 条目数据（公开接口）
   *
   * 从指定场景的 data.obj 中查找 objKey，
   * 直接返回 SceneObjEntry[] JSON 数组
   */
  async getObjEntriesBySlug(
    gameSlug: string,
    sceneKey: string,
    objKey: string
  ): Promise<SceneObjEntry[] | null> {
    const gameId = await this.getGameIdBySlug(gameSlug);
    if (!gameId) return null;

    const [row] = await db
      .select({ data: scenes.data })
      .from(scenes)
      .where(and(eq(scenes.gameId, gameId), eq(scenes.key, sceneKey)))
      .limit(1);

    if (!row) return null;
    const data = row.data as SceneData | null;
    const objData = data?.obj?.[objKey];
    if (objData?.entries) {
      return objData.entries;
    }
    return null;
  }
}

export const sceneService = new SceneService();
