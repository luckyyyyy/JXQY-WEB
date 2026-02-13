/**
 * Scene REST 路由（Hono）
 *
 * GET /game/:gameSlug/api/scenes/:sceneKey/mmf              - 获取 MMF 地图二进制数据
 * GET /game/:gameSlug/api/scenes/npc/:sceneKey/:npcKey   - 获取 NPC JSON 数据
 * GET /game/:gameSlug/api/scenes/obj/:sceneKey/:objKey   - 获取 OBJ JSON 数据
 */
import { Hono } from "hono";
import { sceneService } from "../modules/scene/scene.service";
import { Logger } from "../utils/logger";

const logger = new Logger("SceneRoutes");

export const sceneRoutes = new Hono();

/**
 * 获取场景的 MMF 地图二进制数据
 */
sceneRoutes.get(":gameSlug/api/scenes/:sceneKey/mmf", async (c) => {
	try {
		const gameSlug = c.req.param("gameSlug");
		const sceneKey = c.req.param("sceneKey");
		logger.debug(`[getSceneMmf] gameSlug=${gameSlug}, sceneKey=${sceneKey}`);

		const mmfBuffer = await sceneService.getMmfBinaryBySlug(gameSlug, sceneKey);
		if (!mmfBuffer) {
			return c.json({ error: "Scene or MMF data not found" }, 404);
		}

		c.header("Content-Type", "application/octet-stream");
		c.header("Cache-Control", "public, max-age=3600");
		c.header("Access-Control-Allow-Origin", "*");

		return c.body(new Uint8Array(mmfBuffer));
	} catch (error) {
		logger.error("[getSceneMmf] Error:", error);
		return c.json({ error: "Not found" }, 404);
	}
});

/**
 * 获取 NPC 数据（JSON 格式）
 */
sceneRoutes.get(":gameSlug/api/scenes/npc/:sceneKey/:npcKey", async (c) => {
	try {
		const gameSlug = c.req.param("gameSlug");
		const sceneKey = c.req.param("sceneKey");
		const npcKey = c.req.param("npcKey");
		logger.debug(`[getSceneNpc] gameSlug=${gameSlug}, sceneKey=${sceneKey}, npcKey=${npcKey}`);

		const entries = await sceneService.getNpcEntriesBySlug(gameSlug, sceneKey, npcKey);
		if (entries === null) {
			return c.json({ error: "NPC data not found" }, 404);
		}

		c.header("Content-Type", "application/json");
		c.header("Cache-Control", "public, max-age=3600");
		c.header("Access-Control-Allow-Origin", "*");

		return c.json(entries);
	} catch (error) {
		logger.error("[getSceneNpc] Error:", error);
		return c.json({ error: "Not found" }, 404);
	}
});

/**
 * 获取 OBJ 数据（JSON 格式）
 */
sceneRoutes.get(":gameSlug/api/scenes/obj/:sceneKey/:objKey", async (c) => {
	try {
		const gameSlug = c.req.param("gameSlug");
		const sceneKey = c.req.param("sceneKey");
		const objKey = c.req.param("objKey");
		logger.debug(`[getSceneObj] gameSlug=${gameSlug}, sceneKey=${sceneKey}, objKey=${objKey}`);

		const entries = await sceneService.getObjEntriesBySlug(gameSlug, sceneKey, objKey);
		if (entries === null) {
			return c.json({ error: "OBJ data not found" }, 404);
		}

		c.header("Content-Type", "application/json");
		c.header("Cache-Control", "public, max-age=3600");
		c.header("Access-Control-Allow-Origin", "*");

		return c.json(entries);
	} catch (error) {
		logger.error("[getSceneObj] Error:", error);
		return c.json({ error: "Not found" }, 404);
	}
});
