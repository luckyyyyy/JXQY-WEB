/**
 * 等级配置 REST Controller
 *
 * 提供公开的 REST API 接口，用于游戏客户端获取等级配置数据
 * GET /game/:gameSlug/api/level - 获取游戏的所有等级配置
 * GET /game/:gameSlug/api/level/:key - 获取指定的等级配置
 */
import { Controller, Get, Param, Res, Logger, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { levelConfigService } from "./level.service";

@Controller("game")
export class LevelController {
  private readonly logger = new Logger(LevelController.name);

  /**
   * 获取游戏的所有等级配置
   *
   * GET /game/:gameSlug/api/level
   *
   * 返回该游戏下所有等级配置，按 userType 分组：
   * { player: LevelConfig[], npc: LevelConfig[] }
   */
  @Get(":gameSlug/api/level")
  async listLevelConfigs(
    @Param("gameSlug") gameSlug: string,
    @Res() res: Response
  ) {
    try {
      this.logger.debug(`[listLevelConfigs] gameSlug=${gameSlug}`);

      const configs = await levelConfigService.listPublicBySlug(gameSlug);

      // 按 userType 分组
      const result = {
        player: configs.filter(c => c.userType === "player"),
        npc: configs.filter(c => c.userType === "npc"),
      };

      // 设置缓存头（5 分钟）
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("Access-Control-Allow-Origin", "*");

      res.status(HttpStatus.OK).json(result);
    } catch (error) {
      this.logger.error(`[listLevelConfigs] Error:`, error);

      if (error instanceof Error && error.message === "Game not found") {
        res.status(HttpStatus.NOT_FOUND).json({ error: "Game not found" });
        return;
      }

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
    }
  }

  /**
   * 获取指定的等级配置
   *
   * GET /game/:gameSlug/api/level/:key
   *
   * 返回指定 key 的等级配置
   */
  @Get(":gameSlug/api/level/:key")
  async getLevelConfig(
    @Param("gameSlug") gameSlug: string,
    @Param("key") key: string,
    @Res() res: Response
  ) {
    try {
      this.logger.debug(`[getLevelConfig] gameSlug=${gameSlug}, key=${key}`);

      const config = await levelConfigService.getPublicBySlugAndKey(gameSlug, key);

      if (!config) {
        res.status(HttpStatus.NOT_FOUND).json({ error: "Level config not found" });
        return;
      }

      // 设置缓存头（5 分钟）
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("Access-Control-Allow-Origin", "*");

      res.status(HttpStatus.OK).json(config);
    } catch (error) {
      this.logger.error(`[getLevelConfig] Error:`, error);

      if (error instanceof Error && error.message === "Game not found") {
        res.status(HttpStatus.NOT_FOUND).json({ error: "Game not found" });
        return;
      }

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
    }
  }
}
