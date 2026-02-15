/**
 * Talk（对话数据）服务
 * 使用 PostgreSQL 数据库存储
 * 每个游戏一条记录，data 字段存 TalkEntry[] 数组
 */

import type {
  ImportTalkDataInput,
  SearchTalkInput,
  TalkEntry,
  UpdateTalkDataInput,
} from "@miu2d/types";
import { parseTalkIndexTxt } from "@miu2d/types";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { games, talks } from "../../db/schema";
import type { Language } from "../../i18n";
import { verifyGameAccess } from "../../utils/gameAccess";

export class TalkService {
  /**
   * 获取对话数据（全量）
   */
  async get(
    gameId: string,
    userId: string,
    language: Language
  ): Promise<{ gameId: string; entries: TalkEntry[] }> {
    await verifyGameAccess(gameId, userId, language);

    const [row] = await db.select().from(talks).where(eq(talks.gameId, gameId)).limit(1);

    return {
      gameId,
      entries: row ? (row.data as TalkEntry[]) : [],
    };
  }

  /**
   * 搜索对话数据（分页 + 过滤）
   */
  async search(
    input: SearchTalkInput,
    userId: string,
    language: Language
  ): Promise<{ entries: TalkEntry[]; total: number }> {
    await verifyGameAccess(input.gameId, userId, language);

    const [row] = await db.select().from(talks).where(eq(talks.gameId, input.gameId)).limit(1);

    if (!row) {
      return { entries: [], total: 0 };
    }

    let entries = row.data as TalkEntry[];

    // 按头像索引过滤
    if (input.portraitIndex !== undefined) {
      entries = entries.filter((e) => e.portraitIndex === input.portraitIndex);
    }

    // 按文本搜索
    if (input.query) {
      const q = input.query.toLowerCase();
      entries = entries.filter((e) => e.text.toLowerCase().includes(q));
    }

    const total = entries.length;
    const sliced = entries.slice(input.offset, input.offset + input.limit);

    return { entries: sliced, total };
  }

  /**
   * 公开接口：通过 slug 获取对话数据（无需认证）
   */
  async getPublicBySlug(gameSlug: string): Promise<TalkEntry[]> {
    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.slug, gameSlug))
      .limit(1);

    if (!game) {
      throw new Error("Game not found");
    }

    const [row] = await db.select().from(talks).where(eq(talks.gameId, game.id)).limit(1);

    return row ? (row.data as TalkEntry[]) : [];
  }

  /**
   * 更新对话数据（全量替换，upsert）
   */
  async update(
    input: UpdateTalkDataInput,
    userId: string,
    language: Language
  ): Promise<{ gameId: string; entries: TalkEntry[] }> {
    await verifyGameAccess(input.gameId, userId, language);

    const sorted = [...input.entries].sort((a, b) => a.id - b.id);

    const [existing] = await db.select().from(talks).where(eq(talks.gameId, input.gameId)).limit(1);

    if (existing) {
      await db
        .update(talks)
        .set({
          data: sorted,
          updatedAt: new Date(),
        })
        .where(eq(talks.gameId, input.gameId));
    } else {
      await db.insert(talks).values({
        gameId: input.gameId,
        data: sorted,
      });
    }

    return { gameId: input.gameId, entries: sorted };
  }

  /**
   * 添加单条对话
   */
  async addEntry(
    gameId: string,
    entry: TalkEntry,
    userId: string,
    language: Language
  ): Promise<{ gameId: string; entries: TalkEntry[] }> {
    await verifyGameAccess(gameId, userId, language);

    const [row] = await db.select().from(talks).where(eq(talks.gameId, gameId)).limit(1);

    const entries = row ? (row.data as TalkEntry[]) : [];

    // 检查 ID 是否已存在
    const existingIdx = entries.findIndex((e) => e.id === entry.id);
    if (existingIdx >= 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `对话 ID ${entry.id} 已存在`,
      });
    }

    entries.push(entry);
    entries.sort((a, b) => a.id - b.id);

    return this.update({ gameId, entries }, userId, language);
  }

  /**
   * 更新单条对话
   */
  async updateEntry(
    gameId: string,
    entry: TalkEntry,
    userId: string,
    language: Language
  ): Promise<{ gameId: string; entries: TalkEntry[] }> {
    await verifyGameAccess(gameId, userId, language);

    const [row] = await db.select().from(talks).where(eq(talks.gameId, gameId)).limit(1);

    if (!row) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `对话数据不存在`,
      });
    }

    const entries = row.data as TalkEntry[];
    const idx = entries.findIndex((e) => e.id === entry.id);
    if (idx < 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `对话 ID ${entry.id} 不存在`,
      });
    }

    entries[idx] = entry;
    return this.update({ gameId, entries }, userId, language);
  }

  /**
   * 删除单条对话
   */
  async deleteEntry(
    gameId: string,
    id: number,
    userId: string,
    language: Language
  ): Promise<{ gameId: string; entries: TalkEntry[] }> {
    await verifyGameAccess(gameId, userId, language);

    const [row] = await db.select().from(talks).where(eq(talks.gameId, gameId)).limit(1);

    if (!row) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `对话数据不存在`,
      });
    }

    const entries = (row.data as TalkEntry[]).filter((e) => e.id !== id);
    return this.update({ gameId, entries }, userId, language);
  }

  /**
   * 从 TalkIndex.txt 内容导入
   */
  async importFromTxt(
    input: ImportTalkDataInput,
    userId: string,
    language: Language
  ): Promise<{ gameId: string; entries: TalkEntry[] }> {
    await verifyGameAccess(input.gameId, userId, language);

    const parsed = parseTalkIndexTxt(input.content);
    return this.update({ gameId: input.gameId, entries: parsed }, userId, language);
  }
}

export const talkService = new TalkService();
