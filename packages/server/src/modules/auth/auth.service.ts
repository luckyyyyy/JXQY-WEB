import type { Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { sessions, users, gameMembers, games } from "../../db/schema";
import type { UserSettings } from "@miu2d/types";

const SESSION_COOKIE_NAME = "SESSION_ID";
const SESSION_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 7;

export const toUserOutput = (user: typeof users.$inferSelect) => ({
	id: user.id,
	name: user.name,
	email: user.email,
	role: user.role as "admin" | "user",
	emailVerified: user.emailVerified,
	settings: (user.settings as UserSettings | null) ?? null
});

const slugify = (value: string) =>
	value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)+/g, "");

export class AuthService {
	async getUserByEmail(email: string) {
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.email, email));
		return user ?? null;
	}

	async getDefaultGameSlug(userId: string) {
		const [game] = await db
			.select({ slug: games.slug })
			.from(gameMembers)
			.innerJoin(games, eq(gameMembers.gameId, games.id))
			.where(eq(gameMembers.userId, userId))
			.orderBy(games.createdAt)
			.limit(1);
		return game?.slug ?? null;
	}

	async ensureUniqueGameSlug(base: string) {
		const baseSlug = slugify(base) || "game";
		let slug = baseSlug;
		let suffix = 1;

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const [existing] = await db
				.select({ id: games.id })
				.from(games)
				.where(eq(games.slug, slug))
				.limit(1);
			if (!existing) return slug;
			slug = `${baseSlug}-${suffix}`;
			suffix += 1;
		}
	}

	async createSession(userId: string) {
		const expiresAt = new Date(Date.now() + SESSION_COOKIE_MAX_AGE);
		const [session] = await db
			.insert(sessions)
			.values({ userId, expiresAt })
			.returning({ id: sessions.id });
		return session.id;
	}

	async deleteSession(sessionId: string) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
	}

	async registerUser(input: { name: string; email: string; password: string }) {
		const gameName = `${input.name}的游戏`;
		const gameSlug = await this.ensureUniqueGameSlug(gameName);

		const result = await db.transaction(async (tx) => {
			const [createdUser] = await tx
				.insert(users)
				.values({
					name: input.name,
					email: input.email,
					passwordHash: input.password,
					role: "user"
				})
				.returning();

			const [createdGame] = await tx
				.insert(games)
				.values({
					slug: gameSlug,
					name: gameName,
					description: "默认游戏",
					ownerId: createdUser.id
				})
				.returning();

			await tx.insert(gameMembers).values({
				gameId: createdGame.id,
				userId: createdUser.id,
				role: "owner"
			});

			return { user: createdUser, game: createdGame };
		});

		return result;
	}

	setSessionCookie(res: Response, sessionId: string) {
		const cookieSecure = process.env.SESSION_COOKIE_SECURE
			? process.env.SESSION_COOKIE_SECURE === "true"
			: process.env.NODE_ENV === "production";
		res.cookie(SESSION_COOKIE_NAME, sessionId, {
			httpOnly: true,
			sameSite: "lax",
			secure: cookieSecure,
			maxAge: SESSION_COOKIE_MAX_AGE,
			path: "/"
		});
	}

	clearSessionCookie(res: Response) {
		const cookieSecure = process.env.SESSION_COOKIE_SECURE
			? process.env.SESSION_COOKIE_SECURE === "true"
			: process.env.NODE_ENV === "production";
		res.clearCookie(SESSION_COOKIE_NAME, {
			httpOnly: true,
			sameSite: "lax",
			secure: cookieSecure,
			path: "/"
		});
	}
}

export const authService = new AuthService();
