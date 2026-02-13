/**
 * 游戏配置 REST Controller
 *
 * 提供公开的 REST API 接口，用于游戏客户端获取游戏全局配置
 * GET /game/:gameSlug/api/config - 获取游戏全局配置
 * GET /game/:gameSlug/api/logo - 获取游戏 Logo 图片
 * POST /game/:gameSlug/api/logo - 上传游戏 Logo 图片（需认证）
 * DELETE /game/:gameSlug/api/logo - 删除游戏 Logo（需认证）
 */
import { Controller, Get, Post, Delete, Param, Req, Res, Logger, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../../db/client";
import { games, gameMembers, gameConfigs, sessions } from "../../db/schema";
import { gameConfigService } from "./gameConfig.service";
import { createDefaultGameConfig, GameConfigDataSchema } from "@miu2d/types";
import * as s3 from "../../storage/s3";

const SESSION_COOKIE_NAME = "SESSION_ID";

/** Logo 在 S3 中的存储 key */
function logoStorageKey(gameId: string): string {
	return `games/${gameId}/_logo`;
}

/** 从请求 cookie 解析 userId */
async function getUserIdFromRequest(req: Request): Promise<string | undefined> {
	const cookieHeader = req.headers.cookie;
	if (!cookieHeader) return undefined;
	const match = cookieHeader
		.split(";")
		.map((item) => item.trim())
		.find((item) => item.startsWith(`${SESSION_COOKIE_NAME}=`));
	if (!match) return undefined;
	const sessionId = decodeURIComponent(match.split("=")[1]);
	const [session] = await db
		.select({ userId: sessions.userId })
		.from(sessions)
		.where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
		.limit(1);
	return session?.userId;
}

@Controller("game")
export class GameConfigController {
	private readonly logger = new Logger(GameConfigController.name);

	/**
	 * 获取游戏全局配置
	 *
	 * GET /game/:gameSlug/api/config
	 *
	 * 返回该游戏的全局配置，包括：
	 * - gameName: 游戏名称
	 * - gameVersion: 游戏版本
	 * - gameDescription: 游戏描述
	 * - playerKey: 主角配置 key
	 * - newGameScript: 新游戏脚本
	 * - player: 主角配置（移动速度、体力消耗、自然恢复、战斗参数）
	 * - drop: 掉落系统配置（掉落概率、装备等级映射、金钱掉落、药品掉落、Boss 加成）
	 *
	 * 这是公开接口，不需要认证，用于游戏客户端加载配置
	 */
	@Get(":gameSlug/api/config")
	async getConfig(
		@Param("gameSlug") gameSlug: string,
		@Res() res: Response
	) {
		try {
			this.logger.debug(`[getConfig] gameSlug=${gameSlug}`);

			const config = await gameConfigService.getPublicBySlug(gameSlug);

			// 设置缓存头（5 分钟）
			res.setHeader("Cache-Control", "public, max-age=300");
			res.setHeader("Access-Control-Allow-Origin", "*");

			res.status(HttpStatus.OK).json(config);
		} catch (error) {
			this.logger.error(`[getConfig] Error:`, error);
			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
		}
	}

	/**
	 * 获取游戏 Logo 图片
	 *
	 * GET /game/:gameSlug/api/logo
	 * 公开接口，返回 logo 图片二进制数据
	 */
	@Get(":gameSlug/api/logo")
	async getLogo(
		@Param("gameSlug") gameSlug: string,
		@Res() res: Response
	) {
		try {
			const [game] = await db
				.select({ id: games.id })
				.from(games)
				.where(eq(games.slug, gameSlug))
				.limit(1);

			if (!game) {
				res.status(HttpStatus.NOT_FOUND).json({ error: "Game not found" });
				return;
			}

			const key = logoStorageKey(game.id);
			const { stream, contentType, contentLength } = await s3.getFileStream(key);

			res.setHeader("Content-Type", contentType || "image/png");
			if (contentLength) res.setHeader("Content-Length", contentLength);
			res.setHeader("Cache-Control", "public, max-age=3600");
			res.setHeader("Access-Control-Allow-Origin", "*");

			for await (const chunk of stream) {
				res.write(chunk);
			}
			res.end();
		} catch (error) {
			if (error instanceof Error && error.name === "NoSuchKey") {
				res.status(HttpStatus.NOT_FOUND).json({ error: "Logo not found" });
				return;
			}
			this.logger.error(`[getLogo] Error:`, error);
			res.status(HttpStatus.NOT_FOUND).json({ error: "Logo not found" });
		}
	}

	/**
	 * 上传游戏 Logo
	 *
	 * POST /game/:gameSlug/api/logo
	 * 需要认证，raw body（图片二进制），Content-Type 为图片 MIME
	 */
	@Post(":gameSlug/api/logo")
	async uploadLogo(
		@Param("gameSlug") gameSlug: string,
		@Req() req: Request,
		@Res() res: Response
	) {
		try {
			// 认证
			const userId = await getUserIdFromRequest(req);
			if (!userId) {
				res.status(HttpStatus.UNAUTHORIZED).json({ error: "Unauthorized" });
				return;
			}

			// 查找游戏
			const [game] = await db
				.select({ id: games.id })
				.from(games)
				.where(eq(games.slug, gameSlug))
				.limit(1);

			if (!game) {
				res.status(HttpStatus.NOT_FOUND).json({ error: "Game not found" });
				return;
			}

			// 检查权限
			const [member] = await db
				.select()
				.from(gameMembers)
				.where(and(eq(gameMembers.gameId, game.id), eq(gameMembers.userId, userId)))
				.limit(1);

			if (!member) {
				res.status(HttpStatus.FORBIDDEN).json({ error: "No access" });
				return;
			}

			// 读取 body
			const chunks: Buffer[] = [];
			for await (const chunk of req) {
				chunks.push(Buffer.from(chunk));
			}
			const body = Buffer.concat(chunks);

			if (body.length === 0) {
				res.status(HttpStatus.BAD_REQUEST).json({ error: "Empty body" });
				return;
			}

			if (body.length > 5 * 1024 * 1024) {
				res.status(HttpStatus.BAD_REQUEST).json({ error: "File too large (max 5MB)" });
				return;
			}

			const contentType = req.headers["content-type"] || "image/png";
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

			this.logger.log(`[uploadLogo] Logo uploaded for game ${gameSlug}`);
			res.status(HttpStatus.OK).json({ logoUrl });
		} catch (error) {
			this.logger.error(`[uploadLogo] Error:`, error);
			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Upload failed" });
		}
	}

	/**
	 * 删除游戏 Logo
	 *
	 * DELETE /game/:gameSlug/api/logo
	 * 需要认证
	 */
	@Delete(":gameSlug/api/logo")
	async deleteLogo(
		@Param("gameSlug") gameSlug: string,
		@Req() req: Request,
		@Res() res: Response
	) {
		try {
			const userId = await getUserIdFromRequest(req);
			if (!userId) {
				res.status(HttpStatus.UNAUTHORIZED).json({ error: "Unauthorized" });
				return;
			}

			const [game] = await db
				.select({ id: games.id })
				.from(games)
				.where(eq(games.slug, gameSlug))
				.limit(1);

			if (!game) {
				res.status(HttpStatus.NOT_FOUND).json({ error: "Game not found" });
				return;
			}

			const [member] = await db
				.select()
				.from(gameMembers)
				.where(and(eq(gameMembers.gameId, game.id), eq(gameMembers.userId, userId)))
				.limit(1);

			if (!member) {
				res.status(HttpStatus.FORBIDDEN).json({ error: "No access" });
				return;
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

			this.logger.log(`[deleteLogo] Logo deleted for game ${gameSlug}`);
			res.status(HttpStatus.OK).json({ ok: true });
		} catch (error) {
			this.logger.error(`[deleteLogo] Error:`, error);
			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Delete failed" });
		}
	}
}
