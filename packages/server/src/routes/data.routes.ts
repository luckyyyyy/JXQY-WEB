/**
 * Game Data REST 路由（Hono）
 *
 * GET /game/:gameSlug/api/data - 获取游戏的所有配置数据
 */
import { Hono } from "hono";
import { gameConfigService } from "../modules/gameConfig/gameConfig.service";
import { buildGameData } from "../modules/data/data.service";
import { Logger } from "../utils/logger";

const logger = new Logger("DataRoutes");

export const dataRoutes = new Hono();

/**
 * 获取游戏的所有配置数据
 */
dataRoutes.get(":gameSlug/api/data", async (c) => {
	try {
		const gameSlug = c.req.param("gameSlug");
		logger.debug(`[getData] gameSlug=${gameSlug}`);

		// 检查游戏是否已开放
		const config = await gameConfigService.getPublicBySlug(gameSlug);
		if (!config.gameEnabled) {
			return c.json({ error: "Not found" }, 404);
		}

		const result = await buildGameData(gameSlug);

		c.header("Cache-Control", "public, max-age=300");
		c.header("Access-Control-Allow-Origin", "*");

		return c.json(result);
	} catch (error) {
		logger.error("[getData] Error:", error);
		return c.json({ error: "Not found" }, 404);
	}
});
