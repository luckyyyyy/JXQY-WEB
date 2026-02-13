/**
 * 统一的游戏访问权限校验
 *
 * 所有需要验证用户是否有权访问游戏的地方都应使用此模块，
 * 避免在每个 service 中重复实现相同的权限校验逻辑。
 */
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { gameMembers, users } from "../db/schema";
import type { Language } from "../i18n";
import { getMessage } from "../i18n";

/**
 * 验证用户是否有权访问游戏（需为游戏成员）
 */
export async function verifyGameAccess(
	gameId: string,
	userId: string,
	language: Language = "zh",
): Promise<void> {
	const [member] = await db
		.select({ id: gameMembers.id })
		.from(gameMembers)
		.where(
			and(
				eq(gameMembers.gameId, gameId),
				eq(gameMembers.userId, userId),
			),
		)
		.limit(1);

	if (!member) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: getMessage(language, "errors.file.noAccess"),
		});
	}
}

/**
 * 验证用户是否有权访问游戏（管理员可跳过成员检查）
 */
export async function verifyGameOrAdminAccess(
	gameId: string,
	userId: string,
	language: Language = "zh",
): Promise<void> {
	const [user] = await db
		.select({ role: users.role })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (user?.role === "admin") return;

	await verifyGameAccess(gameId, userId, language);
}
