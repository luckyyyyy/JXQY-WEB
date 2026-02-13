/**
 * 文件公开访问 Controller
 *
 * 提供 /game/:gameSlug/resources/* 路径的公开访问
 * 用于游戏客户端直接加载资源文件
 */
import { Controller, Get, Param, Req, Res, Logger, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import { eq, and, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { files, games } from "../../db/schema";
import * as s3 from "../../storage/s3";

@Controller("game")
export class FileController {
	private readonly logger = new Logger(FileController.name);

	/**
	 * 公开访问游戏资源文件
	 *
	 * GET /game/:gameSlug/resources/*resourcePath
	 * 例如: /game/william-chan/resources/测试/1.txt
	 */
	@Get(":gameSlug/resources/*resourcePath")
	async getResource(
		@Param("gameSlug") gameSlug: string,
		@Req() req: Request,
		@Res() res: Response
	) {
		try {
			// 从 URL 中提取完整路径（去除 /game/:gameSlug/resources/ 前缀）
			const fullPath = req.path;
			const prefix = `/game/${gameSlug}/resources/`;
			const filePath = decodeURIComponent(fullPath.substring(prefix.length));

			if (!filePath) {
				res.status(HttpStatus.BAD_REQUEST).json({ error: "File path is required" });
				return;
			}

			this.logger.debug(`[getResource] gameSlug=${gameSlug}, filePath=${filePath}`);

			// 1. 根据 slug 获取游戏
			const [game] = await db
				.select({ id: games.id })
				.from(games)
				.where(eq(games.slug, gameSlug))
				.limit(1);

			if (!game) {
				res.status(HttpStatus.NOT_FOUND).json({ error: "Game not found" });
				return;
			}

			// 2. 解析路径，找到目标文件
			const pathSegments = filePath.split("/").filter(Boolean);
			const file = await this.resolveFilePath(game.id, pathSegments);

			if (!file) {
				res.status(HttpStatus.NOT_FOUND).json({ error: "File not found" });
				return;
			}

			if (file.type !== "file" || !file.storageKey) {
				res.status(HttpStatus.BAD_REQUEST).json({ error: "Path is not a file" });
				return;
			}

			// 3. 从 S3 获取文件流（流式传输，不加载到内存）
			const { stream, contentType, contentLength } = await s3.getFileStream(file.storageKey);

			// 4. 设置响应头
			res.setHeader("Content-Type", file.mimeType || contentType || "application/octet-stream");
			if (contentLength !== undefined) {
				res.setHeader("Content-Length", contentLength);
			}

			// 设置缓存头（1 小时）
			res.setHeader("Cache-Control", "public, max-age=3600");

			// 允许跨域访问（游戏客户端可能在不同端口）
			res.setHeader("Access-Control-Allow-Origin", "*");

			// 5. 流式传输文件内容（不占用内存）
			for await (const chunk of stream) {
				res.write(chunk);
			}
			res.end();
		} catch (error) {
			this.logger.error(`[getResource] Error:`, error);
			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
		}
	}

	/**
	 * 根据路径段解析文件（大小写不敏感）
	 * @param gameId 游戏 ID
	 * @param pathSegments 路径段数组，如 ["测试", "1.txt"]
	 */
	private async resolveFilePath(
		gameId: string,
		pathSegments: string[]
	): Promise<typeof files.$inferSelect | null> {
		let parentId: string | null = null;

		for (let i = 0; i < pathSegments.length; i++) {
			const name = pathSegments[i].toLowerCase(); // 转换为小写
			const isLast = i === pathSegments.length - 1;

			// 查找当前层级的文件/目录（大小写不敏感匹配，排除已删除文件）
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

			const result = await db
				.select()
				.from(files)
				.where(condition)
				.limit(1);

			const file = result[0];

			if (!file) {
				return null;
			}

			if (isLast) {
				// 最后一段，返回找到的文件
				return file;
			}

			// 不是最后一段，必须是目录
			if (file.type !== "folder") {
				return null;
			}

			parentId = file.id;
		}

		return null;
	}
}
