/**
 * 存档服务
 *
 * 处理存档的 CRUD、分享、管理员操作
 */

import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { games, saves, users } from "../../db/schema";
import { verifyGameOrAdminAccess } from "../../utils/gameAccess";

function generateShareCode(): string {
  return randomBytes(6).toString("base64url"); // 8 chars
}

export class SaveService {
  /**
   * 列出当前用户在某个游戏下的所有存档
   */
  async listByUser(gameSlug: string, userId: string) {
    const game = await this.resolveGame(gameSlug);

    const rows = await db
      .select({
        id: saves.id,
        gameId: saves.gameId,
        userId: saves.userId,
        name: saves.name,
        mapName: saves.mapName,
        level: saves.level,
        playerName: saves.playerName,
        screenshot: saves.screenshot,
        isShared: saves.isShared,
        shareCode: saves.shareCode,
        createdAt: saves.createdAt,
        updatedAt: saves.updatedAt,
      })
      .from(saves)
      .where(and(eq(saves.gameId, game.id), eq(saves.userId, userId)))
      .orderBy(desc(saves.updatedAt));

    return rows.map((r) => this.toOutput(r));
  }

  /**
   * 获取完整存档数据
   */
  async get(saveId: string, userId: string) {
    const [row] = await db
      .select()
      .from(saves)
      .where(and(eq(saves.id, saveId), eq(saves.userId, userId)))
      .limit(1);

    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
    }

    return {
      ...this.toOutput(row),
      data: row.data as Record<string, unknown>,
    };
  }

  /**
   * 创建或覆盖存档
   */
  async upsert(
    input: {
      gameSlug: string;
      saveId?: string;
      name: string;
      mapName?: string;
      level?: number;
      playerName?: string;
      screenshot?: string;
      data: Record<string, unknown>;
    },
    userId: string
  ) {
    const game = await this.resolveGame(input.gameSlug);

    const values = {
      gameId: game.id,
      userId,
      name: input.name,
      mapName: input.mapName ?? null,
      level: input.level ?? null,
      playerName: input.playerName ?? null,
      screenshot: input.screenshot ?? null,
      data: input.data,
      updatedAt: new Date(),
    };

    // 覆盖已有存档
    if (input.saveId) {
      const [existing] = await db
        .select({ id: saves.id, userId: saves.userId })
        .from(saves)
        .where(eq(saves.id, input.saveId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
      }

      if (existing.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权覆盖此存档" });
      }

      const [updated] = await db
        .update(saves)
        .set(values)
        .where(eq(saves.id, input.saveId))
        .returning();

      return {
        ...this.toOutput(updated),
      };
    }

    // 创建新存档
    const [created] = await db.insert(saves).values(values).returning();

    return this.toOutput(created);
  }

  /**
   * 删除存档
   */
  async delete(saveId: string, userId: string) {
    const [existing] = await db
      .select({ id: saves.id, userId: saves.userId })
      .from(saves)
      .where(eq(saves.id, saveId))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
    }

    if (existing.userId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "无权删除此存档" });
    }

    await db.delete(saves).where(eq(saves.id, saveId));
    return { id: saveId };
  }

  /**
   * 设置存档分享状态
   */
  async setShared(saveId: string, isShared: boolean, userId: string) {
    const [existing] = await db
      .select({ id: saves.id, userId: saves.userId, shareCode: saves.shareCode })
      .from(saves)
      .where(eq(saves.id, saveId))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
    }

    if (existing.userId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "无权操作此存档" });
    }

    const shareCode = isShared ? (existing.shareCode ?? generateShareCode()) : existing.shareCode;

    const [updated] = await db
      .update(saves)
      .set({ isShared, shareCode, updatedAt: new Date() })
      .where(eq(saves.id, saveId))
      .returning();

    return this.toOutput(updated);
  }

  /**
   * 通过分享码获取存档（无需登录）
   */
  async getShared(gameSlug: string, shareCode: string) {
    const game = await this.resolveGame(gameSlug);

    const [row] = await db
      .select({
        save: saves,
        userName: users.name,
      })
      .from(saves)
      .innerJoin(users, eq(saves.userId, users.id))
      .where(
        and(eq(saves.gameId, game.id), eq(saves.shareCode, shareCode), eq(saves.isShared, true))
      )
      .limit(1);

    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "分享存档不存在或已取消分享" });
    }

    return {
      ...this.toOutput(row.save),
      userName: row.userName,
      data: row.save.data as Record<string, unknown>,
    };
  }

  // ============= 管理员接口 =============

  /**
   * 管理员列出所有存档
   */
  async adminList(
    input: {
      gameSlug?: string;
      userId?: string;
      page: number;
      pageSize: number;
    },
    operatorId: string
  ) {
    const conditions = [];

    if (input.gameSlug) {
      const game = await this.resolveGame(input.gameSlug);
      await verifyGameOrAdminAccess(game.id, operatorId);
      conditions.push(eq(saves.gameId, game.id));
    }

    if (input.userId) {
      conditions.push(eq(saves.userId, input.userId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db.select({ count: count() }).from(saves).where(where);

    const rows = await db
      .select({
        save: saves,
        userName: users.name,
      })
      .from(saves)
      .innerJoin(users, eq(saves.userId, users.id))
      .where(where)
      .orderBy(desc(saves.createdAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);

    return {
      items: rows.map((r) => ({
        ...this.toOutput(r.save),
        userName: r.userName,
      })),
      total: totalResult.count,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  /**
   * 管理员获取完整存档数据（可读取任何用户的存档）
   */
  async adminGet(saveId: string, operatorId: string) {
    const [row] = await db
      .select({
        save: saves,
        userName: users.name,
      })
      .from(saves)
      .innerJoin(users, eq(saves.userId, users.id))
      .where(eq(saves.id, saveId))
      .limit(1);

    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
    }

    await verifyGameOrAdminAccess(row.save.gameId, operatorId);

    return {
      ...this.toOutput(row.save),
      userName: row.userName,
      data: row.save.data as Record<string, unknown>,
    };
  }

  /**
   * 管理员创建存档（以管理员身份创建，通过 JSON 输入）
   */
  async adminCreate(
    input: {
      gameSlug: string;
      name: string;
      mapName?: string;
      level?: number;
      playerName?: string;
      screenshot?: string;
      data: Record<string, unknown>;
    },
    operatorId: string
  ) {
    const game = await this.resolveGame(input.gameSlug);
    await verifyGameOrAdminAccess(game.id, operatorId);

    const values = {
      gameId: game.id,
      userId: operatorId,
      name: input.name,
      mapName: input.mapName ?? null,
      level: input.level ?? null,
      playerName: input.playerName ?? null,
      screenshot: input.screenshot ?? null,
      data: input.data,
      updatedAt: new Date(),
    };

    const [created] = await db.insert(saves).values(values).returning();

    return this.toOutput(created);
  }

  /**
   * 管理员更新存档数据
   */
  async adminUpdate(
    input: {
      saveId: string;
      name?: string;
      data: Record<string, unknown>;
    },
    operatorId: string
  ) {
    const [existing] = await db
      .select({ id: saves.id, gameId: saves.gameId })
      .from(saves)
      .where(eq(saves.id, input.saveId))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
    }

    await verifyGameOrAdminAccess(existing.gameId, operatorId);

    // 从 data 中提取元信息
    const playerData = input.data.player as Record<string, unknown> | undefined;
    const mapName = typeof input.data.mapFileName === "string" ? input.data.mapFileName : undefined;
    const playerName = typeof playerData?.name === "string" ? playerData.name : undefined;
    const level = typeof playerData?.level === "number" ? playerData.level : undefined;

    const setValues: Record<string, unknown> = {
      data: input.data,
      updatedAt: new Date(),
    };
    if (input.name) setValues.name = input.name;
    if (mapName !== undefined) setValues.mapName = mapName;
    if (playerName !== undefined) setValues.playerName = playerName;
    if (level !== undefined) setValues.level = level;

    const [updated] = await db
      .update(saves)
      .set(setValues)
      .where(eq(saves.id, input.saveId))
      .returning();

    return this.toOutput(updated);
  }

  /**
   * 管理员设置存档分享状态（可操作任何用户的存档）
   */
  async adminSetShared(saveId: string, isShared: boolean, operatorId: string) {
    const [existing] = await db
      .select({ id: saves.id, gameId: saves.gameId, shareCode: saves.shareCode })
      .from(saves)
      .where(eq(saves.id, saveId))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
    }

    await verifyGameOrAdminAccess(existing.gameId, operatorId);

    const shareCode = isShared ? (existing.shareCode ?? generateShareCode()) : existing.shareCode;

    const [updated] = await db
      .update(saves)
      .set({ isShared, shareCode, updatedAt: new Date() })
      .where(eq(saves.id, saveId))
      .returning();

    return this.toOutput(updated);
  }

  /**
   * 管理员删除存档（可删除任何用户的存档）
   */
  async adminDelete(saveId: string, operatorId: string) {
    const [existing] = await db
      .select({ id: saves.id, gameId: saves.gameId })
      .from(saves)
      .where(eq(saves.id, saveId))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
    }

    await verifyGameOrAdminAccess(existing.gameId, operatorId);

    await db.delete(saves).where(eq(saves.id, saveId));
    return { id: saveId };
  }

  // ============= 内部工具 =============

  private async resolveGame(gameSlug: string) {
    const [game] = await db.select().from(games).where(eq(games.slug, gameSlug)).limit(1);

    if (!game) {
      throw new TRPCError({ code: "NOT_FOUND", message: "游戏不存在" });
    }

    return game;
  }

  private toOutput(row: Omit<typeof saves.$inferSelect, "data">) {
    return {
      id: row.id,
      gameId: row.gameId,
      userId: row.userId,
      name: row.name,
      mapName: row.mapName ?? undefined,
      level: row.level ?? undefined,
      playerName: row.playerName ?? undefined,
      screenshot: row.screenshot ?? undefined,
      isShared: row.isShared,
      shareCode: row.shareCode ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? "",
      updatedAt: row.updatedAt?.toISOString() ?? "",
    };
  }
}

export const saveService = new SaveService();
