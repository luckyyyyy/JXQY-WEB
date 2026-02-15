import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { gameMembers, games } from "../../db/schema";
import { getMessage, type Language } from "../../i18n";

export const toGameOutput = (dbGame: typeof games.$inferSelect) => ({
  id: dbGame.id,
  slug: dbGame.slug,
  name: dbGame.name,
  description: dbGame.description,
  ownerId: dbGame.ownerId,
  createdAt: dbGame.createdAt?.toISOString(),
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export class GameService {
  async listByUser(userId: string) {
    const rows = await db
      .select()
      .from(gameMembers)
      .innerJoin(games, eq(gameMembers.gameId, games.id))
      .where(eq(gameMembers.userId, userId));

    return rows.map((row) => row.games);
  }

  async getBySlug(slug: string, userId: string) {
    const [row] = await db
      .select()
      .from(gameMembers)
      .innerJoin(games, eq(gameMembers.gameId, games.id))
      .where(and(eq(gameMembers.userId, userId), eq(games.slug, slug)))
      .limit(1);

    return row?.games ?? null;
  }

  async getById(id: string) {
    const [game] = await db.select().from(games).where(eq(games.id, id)).limit(1);

    return game ?? null;
  }

  /**
   * 公开查询：通过 slug 查找游戏（不需要登录）
   */
  async getPublicBySlug(slug: string) {
    const [game] = await db.select().from(games).where(eq(games.slug, slug)).limit(1);

    return game ?? null;
  }

  async ensureUniqueSlug(baseSlug: string) {
    let slug = baseSlug;
    let suffix = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const [existing] = await db
        .select({ id: games.id })
        .from(games)
        .where(eq(games.slug, slug))
        .limit(1);
      if (!existing) break;
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    return slug;
  }

  async create(
    input: { name: string; slug?: string; description?: string | null },
    userId: string
  ) {
    const baseSlug = input.slug?.trim() || slugify(input.name) || "game";
    const slug = await this.ensureUniqueSlug(baseSlug);

    const result = await db.transaction(async (tx) => {
      const [game] = await tx
        .insert(games)
        .values({
          name: input.name,
          slug,
          description: input.description ?? null,
          ownerId: userId,
        })
        .returning();

      await tx.insert(gameMembers).values({
        gameId: game.id,
        userId,
        role: "owner",
      });

      return game;
    });

    return result;
  }

  async update(
    id: string,
    input: { name?: string; slug?: string; description?: string | null },
    userId: string,
    language: Language
  ) {
    const game = await this.getById(id);
    if (!game) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.game.notFound"),
      });
    }

    if (game.ownerId !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: getMessage(language, "errors.game.onlyOwnerCanUpdate"),
      });
    }

    let newSlug = game.slug;
    if (input.slug && input.slug !== game.slug) {
      const [existing] = await db
        .select({ id: games.id })
        .from(games)
        .where(eq(games.slug, input.slug))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: getMessage(language, "errors.game.slugExists"),
        });
      }

      newSlug = input.slug;
    }

    const [updated] = await db
      .update(games)
      .set({
        name: input.name ?? game.name,
        slug: newSlug,
        description: input.description !== undefined ? input.description : game.description,
      })
      .where(eq(games.id, id))
      .returning();

    return updated;
  }

  async delete(id: string, userId: string, language: Language) {
    const game = await this.getById(id);
    if (!game) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.game.notFound"),
      });
    }

    if (game.ownerId !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: getMessage(language, "errors.game.onlyOwnerCanDelete"),
      });
    }

    await db.transaction(async (tx) => {
      await tx.delete(gameMembers).where(eq(gameMembers.gameId, id));
      await tx.delete(games).where(eq(games.id, id));
    });

    return { id };
  }
}

export const gameService = new GameService();
