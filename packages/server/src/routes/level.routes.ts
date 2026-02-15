/**
 * 等级配置 REST 路由（Hono）
 *
 * GET /game/:gameSlug/api/level - 获取游戏的所有等级配置
 * GET /game/:gameSlug/api/level/:key - 获取指定的等级配置
 */
import { Hono } from "hono";
import { levelConfigService } from "../modules/level/level.service";
import { Logger } from "../utils/logger";

const logger = new Logger("LevelRoutes");

export const levelRoutes = new Hono();

/**
 * 获取游戏的所有等级配置
 */
levelRoutes.get(":gameSlug/api/level", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");
    logger.debug(`[listLevelConfigs] gameSlug=${gameSlug}`);

    const configs = await levelConfigService.listPublicBySlug(gameSlug);

    const result = {
      player: configs.filter((item) => item.userType === "player"),
      npc: configs.filter((item) => item.userType === "npc"),
    };

    c.header("Cache-Control", "public, max-age=300");
    c.header("Access-Control-Allow-Origin", "*");

    return c.json(result);
  } catch (error) {
    logger.error("[listLevelConfigs] Error:", error);

    if (error instanceof Error && error.message === "Game not found") {
      return c.json({ error: "Game not found" }, 404);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * 获取指定的等级配置
 */
levelRoutes.get(":gameSlug/api/level/:key", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");
    const key = c.req.param("key");
    logger.debug(`[getLevelConfig] gameSlug=${gameSlug}, key=${key}`);

    const config = await levelConfigService.getPublicBySlugAndKey(gameSlug, key);

    if (!config) {
      return c.json({ error: "Level config not found" }, 404);
    }

    c.header("Cache-Control", "public, max-age=300");
    c.header("Access-Control-Allow-Origin", "*");

    return c.json(config);
  } catch (error) {
    logger.error("[getLevelConfig] Error:", error);

    if (error instanceof Error && error.message === "Game not found") {
      return c.json({ error: "Game not found" }, 404);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
});
