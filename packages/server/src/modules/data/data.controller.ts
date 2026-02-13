/**
 * Game Data REST Controller
 *
 * 提供统一的公开 REST API 接口，用于游戏客户端获取所有配置数据
 * GET /game/:gameSlug/api/data - 获取游戏的所有配置数据（武功、物品、NPC、物体）
 *
 * 注意：Dashboard 页面应使用 tRPC data.getAll 接口而非此 REST 端点
 */
import { Controller, Get, Param, Res, Logger, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { gameConfigService } from "../gameConfig/gameConfig.service";
import { buildGameData } from "./data.service";

@Controller("game")
export class DataController {
	private readonly logger = new Logger(DataController.name);

	/**
	 * 获取游戏的所有配置数据
	 *
	 * GET /game/:gameSlug/api/data
	 *
	 * 返回该游戏下所有配置数据，包括：
	 * - magics: 武功配置（按 userType 分组）
	 * - goods: 物品配置（扁平数组）
	 * - shops: 商店配置（扁平数组）
	 * - npcs: NPC 配置（包含 npcs 数组和 resources 数组）
	 * - objs: 物体配置（包含 objs 数组和 resources 数组）
	 *
	 * 这是公开接口，不需要认证，用于游戏客户端加载配置数据
	 */
	@Get(":gameSlug/api/data")
	async getData(
		@Param("gameSlug") gameSlug: string,
		@Res() res: Response
	) {
		try {
			this.logger.debug(`[getData] gameSlug=${gameSlug}`);

			// 检查游戏是否已开放（不存在/未公开/未启用均返回 404）
			const config = await gameConfigService.getPublicBySlug(gameSlug);
			if (!config.gameEnabled) {
				res.status(HttpStatus.NOT_FOUND).json({ error: "Not found" });
				return;
			}

			const result = await buildGameData(gameSlug);

			// 设置缓存头（5 分钟）
			res.setHeader("Cache-Control", "public, max-age=300");

			// 允许跨域访问
			res.setHeader("Access-Control-Allow-Origin", "*");

			res.status(HttpStatus.OK).json(result);
		} catch (error) {
			this.logger.error(`[getData] Error:`, error);
			res.status(HttpStatus.NOT_FOUND).json({ error: "Not found" });
		}
	}
}
