/**
 * Scene REST Controller
 *
 * 提供公开 REST API 接口，用于游戏引擎加载场景数据
 *
 * GET /game/:gameSlug/api/scenes/:sceneKey/mmf              - 获取 MMF 地图二进制数据
 * GET /game/:gameSlug/api/scenes/npc/:sceneKey/:npcKey   - 获取 NPC JSON 数据
 * GET /game/:gameSlug/api/scenes/obj/:sceneKey/:objKey   - 获取 OBJ JSON 数据
 *
 * 替代原来从文件系统读取 .npc / .obj / .mmf 文件的方式
 */
import { Controller, Get, Param, Res, Logger, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { sceneService } from "./scene.service";

@Controller("game")
export class SceneController {
	private readonly logger = new Logger(SceneController.name);

	/**
	 * 获取场景的 MMF 地图二进制数据
	 *
	 * GET /game/:gameSlug/api/scenes/:sceneKey/mmf
	 *
	 * 直接返回 MMF 二进制流（从数据库 base64 解码），
	 * 替代原来从文件系统读取 .mmf 文件
	 */
	@Get(":gameSlug/api/scenes/:sceneKey/mmf")
	async getSceneMmf(
		@Param("gameSlug") gameSlug: string,
		@Param("sceneKey") sceneKey: string,
		@Res() res: Response
	) {
		try {
			this.logger.debug(`[getSceneMmf] gameSlug=${gameSlug}, sceneKey=${sceneKey}`);

			const mmfBuffer = await sceneService.getMmfBinaryBySlug(gameSlug, sceneKey);
			if (!mmfBuffer) {
				res.status(HttpStatus.NOT_FOUND).json({ error: "Scene or MMF data not found" });
				return;
			}

			res.setHeader("Content-Type", "application/octet-stream");
			res.setHeader("Cache-Control", "public, max-age=3600");
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.status(HttpStatus.OK).send(mmfBuffer);
		} catch (error) {
			this.logger.error(`[getSceneMmf] Error:`, error);
			res.status(HttpStatus.NOT_FOUND).json({ error: "Not found" });
		}
	}

	/**
	 * 获取 NPC 数据（JSON 格式）
	 *
	 * GET /game/:gameSlug/api/scenes/npc/:sceneKey/:npcKey
	 *
	 * 直接返回 SceneNpcEntry[] JSON 数组
	 */
	@Get(":gameSlug/api/scenes/npc/:sceneKey/:npcKey")
	async getSceneNpc(
		@Param("gameSlug") gameSlug: string,
		@Param("sceneKey") sceneKey: string,
		@Param("npcKey") npcKey: string,
		@Res() res: Response
	) {
		try {
			this.logger.debug(`[getSceneNpc] gameSlug=${gameSlug}, sceneKey=${sceneKey}, npcKey=${npcKey}`);

			const entries = await sceneService.getNpcEntriesBySlug(gameSlug, sceneKey, npcKey);
			if (entries === null) {
				res.status(HttpStatus.NOT_FOUND).json({ error: "NPC data not found" });
				return;
			}

			res.setHeader("Content-Type", "application/json");
			res.setHeader("Cache-Control", "public, max-age=3600");
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.status(HttpStatus.OK).json(entries);
		} catch (error) {
			this.logger.error(`[getSceneNpc] Error:`, error);
			res.status(HttpStatus.NOT_FOUND).json({ error: "Not found" });
		}
	}

	/**
	 * 获取 OBJ 数据（JSON 格式）
	 *
	 * GET /game/:gameSlug/api/scenes/obj/:sceneKey/:objKey
	 *
	 * 直接返回 SceneObjEntry[] JSON 数组
	 */
	@Get(":gameSlug/api/scenes/obj/:sceneKey/:objKey")
	async getSceneObj(
		@Param("gameSlug") gameSlug: string,
		@Param("sceneKey") sceneKey: string,
		@Param("objKey") objKey: string,
		@Res() res: Response
	) {
		try {
			this.logger.debug(`[getSceneObj] gameSlug=${gameSlug}, sceneKey=${sceneKey}, objKey=${objKey}`);

			const entries = await sceneService.getObjEntriesBySlug(gameSlug, sceneKey, objKey);
			if (entries === null) {
				res.status(HttpStatus.NOT_FOUND).json({ error: "OBJ data not found" });
				return;
			}

			res.setHeader("Content-Type", "application/json");
			res.setHeader("Cache-Control", "public, max-age=3600");
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.status(HttpStatus.OK).json(entries);
		} catch (error) {
			this.logger.error(`[getSceneObj] Error:`, error);
			res.status(HttpStatus.NOT_FOUND).json({ error: "Not found" });
		}
	}
}
