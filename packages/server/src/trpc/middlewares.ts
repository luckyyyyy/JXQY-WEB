import { TRPCError } from "@trpc/server";
import type { MiddlewareResult } from "@trpc/server/unstable-core-do-not-import";
import { and, eq, or } from "drizzle-orm";
import { db } from "../db/client";
import { gameMembers, games, users } from "../db/schema";
import { getMessage } from "../i18n";
import type { Context } from "./context";

export const requireUser = async ({
  ctx,
  next,
}: {
  ctx: Context;
  next: (opts?: { ctx?: Context }) => Promise<MiddlewareResult<Context>>;
}): Promise<MiddlewareResult<Context>> => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: getMessage(ctx.language, "errors.common.unauthorized"),
    });
  }
  return next();
};

export const requireGame = async ({
  ctx,
  next,
}: {
  ctx: Context;
  next: (opts?: { ctx?: Context }) => Promise<MiddlewareResult<Context>>;
}): Promise<MiddlewareResult<Context>> => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: getMessage(ctx.language, "errors.common.unauthorized"),
    });
  }

  if (!ctx.gameKey) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: getMessage(ctx.language, "errors.common.missingGame"),
    });
  }

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const gameWhere = isUuid(ctx.gameKey)
    ? or(eq(games.id, ctx.gameKey), eq(games.slug, ctx.gameKey))
    : eq(games.slug, ctx.gameKey);

  const [game] = await ctx.db.select().from(games).where(gameWhere).limit(1);

  if (!game) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: getMessage(ctx.language, "errors.game.notFound"),
    });
  }

  const [membership] = await ctx.db
    .select()
    .from(gameMembers)
    .where(and(eq(gameMembers.gameId, game.id), eq(gameMembers.userId, ctx.userId)))
    .limit(1);

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: getMessage(ctx.language, "errors.common.gameForbidden"),
    });
  }

  return next({ ctx: { ...ctx, game } });
};

export const requireAdmin = async ({
  ctx,
  next,
}: {
  ctx: Context;
  next: (opts?: { ctx?: Context }) => Promise<MiddlewareResult<Context>>;
}): Promise<MiddlewareResult<Context>> => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: getMessage(ctx.language, "errors.common.unauthorized"),
    });
  }

  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1);

  if (!user || user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "需要管理员权限",
    });
  }

  return next();
};
