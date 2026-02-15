/**
 * 游戏配置 REST 路由（Hono）
 *
 * GET /game/:gameSlug/api/config - 获取游戏全局配置
 * GET /game/:gameSlug/api/logo - 获取游戏 Logo 图片
 * POST /game/:gameSlug/api/logo - 上传游戏 Logo 图片（需认证）
 * DELETE /game/:gameSlug/api/logo - 删除游戏 Logo（需认证）
 */

import { createDefaultGameConfig, GameConfigDataSchema } from "@miu2d/types";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { db } from "../db/client";
import { gameConfigs, gameMembers, games } from "../db/schema";
import { gameConfigService } from "../modules/gameConfig/gameConfig.service";
import * as s3 from "../storage/s3";
import { Logger } from "../utils/logger";
import { resolveUserId } from "../utils/session";

const logger = new Logger("GameConfigRoutes");

/** Logo 在 S3 中的存储 key */
function logoStorageKey(gameId: string): string {
  return `games/${gameId}/_logo`;
}

export const gameConfigRoutes = new Hono();

/**
 * 获取游戏全局配置
 */
gameConfigRoutes.get(":gameSlug/api/config", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");
    logger.debug(`[getConfig] gameSlug=${gameSlug}`);

    const config = await gameConfigService.getPublicBySlug(gameSlug);

    c.header("Cache-Control", "public, max-age=300");
    c.header("Access-Control-Allow-Origin", "*");

    return c.json(config);
  } catch (error) {
    logger.error("[getConfig] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * 获取游戏 Logo 图片
 */
gameConfigRoutes.get(":gameSlug/api/logo", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");

    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.slug, gameSlug))
      .limit(1);

    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }

    const key = logoStorageKey(game.id);
    const { stream: fileStream, contentType, contentLength } = await s3.getFileStream(key);

    c.header("Content-Type", contentType || "image/png");
    if (contentLength) c.header("Content-Length", String(contentLength));
    c.header("Cache-Control", "public, max-age=3600");
    c.header("Access-Control-Allow-Origin", "*");

    return stream(c, async (s) => {
      for await (const chunk of fileStream) {
        await s.write(chunk as Uint8Array);
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") {
      return c.json({ error: "Logo not found" }, 404);
    }
    logger.error("[getLogo] Error:", error);
    return c.json({ error: "Logo not found" }, 404);
  }
});

/**
 * 上传游戏 Logo
 */
gameConfigRoutes.post(":gameSlug/api/logo", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");

    // 认证
    const userId = await resolveUserId(c.req.header("cookie") ?? null);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // 查找游戏
    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.slug, gameSlug))
      .limit(1);

    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }

    // 检查权限
    const [member] = await db
      .select()
      .from(gameMembers)
      .where(and(eq(gameMembers.gameId, game.id), eq(gameMembers.userId, userId)))
      .limit(1);

    if (!member) {
      return c.json({ error: "No access" }, 403);
    }

    // 读取 body
    const body = Buffer.from(await c.req.arrayBuffer());

    if (body.length === 0) {
      return c.json({ error: "Empty body" }, 400);
    }

    if (body.length > 5 * 1024 * 1024) {
      return c.json({ error: "File too large (max 5MB)" }, 400);
    }

    const contentType = c.req.header("content-type") || "image/png";
    const key = logoStorageKey(game.id);

    await s3.uploadFile(key, body, contentType);

    // 更新 gameConfig 的 logoUrl
    const logoUrl = `/game/${gameSlug}/api/logo`;
    const [existing] = await db
      .select()
      .from(gameConfigs)
      .where(eq(gameConfigs.gameId, game.id))
      .limit(1);

    if (existing) {
      const defaults = createDefaultGameConfig();
      const raw = existing.data as Record<string, unknown>;
      const merged = { ...defaults, ...raw, logoUrl };
      const data = GameConfigDataSchema.parse(merged);
      await db
        .update(gameConfigs)
        .set({ data, updatedAt: new Date() })
        .where(eq(gameConfigs.gameId, game.id));
    } else {
      const data = GameConfigDataSchema.parse({
        ...createDefaultGameConfig(),
        logoUrl,
      });
      await db.insert(gameConfigs).values({ gameId: game.id, data });
    }

    logger.log(`[uploadLogo] Logo uploaded for game ${gameSlug}`);
    return c.json({ logoUrl });
  } catch (error) {
    logger.error("[uploadLogo] Error:", error);
    return c.json({ error: "Upload failed" }, 500);
  }
});

/**
 * 删除游戏 Logo
 */
gameConfigRoutes.delete(":gameSlug/api/logo", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");

    const userId = await resolveUserId(c.req.header("cookie") ?? null);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.slug, gameSlug))
      .limit(1);

    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }

    const [member] = await db
      .select()
      .from(gameMembers)
      .where(and(eq(gameMembers.gameId, game.id), eq(gameMembers.userId, userId)))
      .limit(1);

    if (!member) {
      return c.json({ error: "No access" }, 403);
    }

    // 删除 S3 中的 logo
    try {
      await s3.deleteFile(logoStorageKey(game.id));
    } catch {
      // 文件可能不存在，忽略
    }

    // 清除 gameConfig 中的 logoUrl
    const [existing] = await db
      .select()
      .from(gameConfigs)
      .where(eq(gameConfigs.gameId, game.id))
      .limit(1);

    if (existing) {
      const defaults = createDefaultGameConfig();
      const raw = existing.data as Record<string, unknown>;
      const merged = { ...defaults, ...raw, logoUrl: "" };
      const data = GameConfigDataSchema.parse(merged);
      await db
        .update(gameConfigs)
        .set({ data, updatedAt: new Date() })
        .where(eq(gameConfigs.gameId, game.id));
    }

    logger.log(`[deleteLogo] Logo deleted for game ${gameSlug}`);
    return c.json({ ok: true });
  } catch (error) {
    logger.error("[deleteLogo] Error:", error);
    return c.json({ error: "Delete failed" }, 500);
  }
});
