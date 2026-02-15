/**
 * 文件公开访问路由（Hono）
 *
 * 提供 /game/:gameSlug/resources/* 路径的公开访问
 * 用于游戏客户端直接加载资源文件
 */

import { and, eq, isNull, type SQL, sql } from "drizzle-orm";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { db } from "../db/client";
import { files, games } from "../db/schema";
import * as s3 from "../storage/s3";
import { Logger } from "../utils/logger";

const logger = new Logger("FileRoutes");

export const fileRoutes = new Hono();

/**
 * 公开访问游戏资源文件
 *
 * GET /game/:gameSlug/resources/*resourcePath
 * 例如: /game/william-chan/resources/测试/1.txt
 */
fileRoutes.get(":gameSlug/resources/*", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");
    // 从 URL 中提取完整路径（去除 /:gameSlug/resources/ 前缀）
    const fullPath = new URL(c.req.url).pathname;
    const prefix = `/game/${gameSlug}/resources/`;
    const filePath = decodeURIComponent(fullPath.substring(prefix.length));

    if (!filePath) {
      return c.json({ error: "File path is required" }, 400);
    }

    logger.debug(`[getResource] gameSlug=${gameSlug}, filePath=${filePath}`);

    // 1. 根据 slug 获取游戏
    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.slug, gameSlug))
      .limit(1);

    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }

    // 2. 解析路径，找到目标文件
    const pathSegments = filePath.split("/").filter(Boolean);
    const file = await resolveFilePath(game.id, pathSegments);

    if (!file) {
      return c.json({ error: "File not found" }, 404);
    }

    if (file.type !== "file" || !file.storageKey) {
      return c.json({ error: "Path is not a file" }, 400);
    }

    // 3. 从 S3 获取文件流（流式传输，不加载到内存）
    const {
      stream: fileStream,
      contentType,
      contentLength,
    } = await s3.getFileStream(file.storageKey);

    // 4. 设置响应头
    c.header("Content-Type", file.mimeType || contentType || "application/octet-stream");
    if (contentLength !== undefined) {
      c.header("Content-Length", String(contentLength));
    }
    c.header("Cache-Control", "public, max-age=3600");
    c.header("Access-Control-Allow-Origin", "*");

    // 5. 流式传输文件内容
    return stream(c, async (s) => {
      for await (const chunk of fileStream) {
        await s.write(chunk as Uint8Array);
      }
    });
  } catch (error) {
    logger.error("[getResource] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * 根据路径段解析文件（大小写不敏感）
 */
async function resolveFilePath(
  gameId: string,
  pathSegments: string[]
): Promise<typeof files.$inferSelect | null> {
  let parentId: string | null = null;

  for (let i = 0; i < pathSegments.length; i++) {
    const name = pathSegments[i].toLowerCase();
    const isLast = i === pathSegments.length - 1;

    let condition: SQL<unknown>;
    if (parentId) {
      condition = and(
        eq(files.gameId, gameId),
        eq(files.parentId, parentId),
        sql`LOWER(${files.name}) = ${name}`,
        isNull(files.deletedAt)
      )!;
    } else {
      condition = and(
        eq(files.gameId, gameId),
        isNull(files.parentId),
        sql`LOWER(${files.name}) = ${name}`,
        isNull(files.deletedAt)
      )!;
    }

    const result = await db.select().from(files).where(condition).limit(1);

    const file = result[0];

    if (!file) {
      return null;
    }

    if (isLast) {
      return file;
    }

    if (file.type !== "folder") {
      return null;
    }

    parentId = file.id;
  }

  return null;
}
