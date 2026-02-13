import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../../db/client";
import { users } from "../../db/schema";
import type { UserSettings } from "@miu2d/types";
import { getMessage, type Language } from "../../i18n";

export const toUserOutput = (user: typeof users.$inferSelect) => ({
	id: user.id,
	name: user.name,
	email: user.email,
	role: user.role as "admin" | "user",
	emailVerified: user.emailVerified,
	settings: (user.settings as UserSettings | null) ?? null
});

export class UserService {
	async getById(userId: string) {
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		return user ?? null;
	}

	async getByEmail(email: string) {
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1);
		return user ?? null;
	}

	async checkEmailExists(email: string, excludeUserId?: string) {
		const conditions = excludeUserId
			? and(eq(users.email, email), ne(users.id, excludeUserId))
			: eq(users.email, email);

		const [existing] = await db
			.select({ id: users.id })
			.from(users)
			.where(conditions)
			.limit(1);

		return !!existing;
	}

	async updateProfile(
		userId: string,
		updates: {
			name?: string;
			email?: string;
			settings?: Partial<UserSettings> | null;
		},
		language: Language
	) {
		if (updates.email) {
			const emailExists = await this.checkEmailExists(updates.email, userId);
			if (emailExists) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: getMessage(language, "errors.user.emailInUse")
				});
			}
		}

		const dbUpdates: Partial<typeof users.$inferInsert> = {};
		if (updates.name !== undefined) dbUpdates.name = updates.name.trim();
		if (updates.email !== undefined) dbUpdates.email = updates.email.trim();

		if (updates.settings !== undefined) {
			if (updates.settings === null) {
				dbUpdates.settings = null;
			} else {
				const [current] = await db
					.select({ settings: users.settings })
					.from(users)
					.where(eq(users.id, userId))
					.limit(1);
				const currentSettings = (current?.settings as UserSettings | null) ?? {};
				dbUpdates.settings = { ...currentSettings, ...updates.settings };
			}
		}

		if (Object.keys(dbUpdates).length === 0) {
			const user = await this.getById(userId);
			if (!user) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: getMessage(language, "errors.user.notFound")
				});
			}
			return user;
		}

		const [updated] = await db
			.update(users)
			.set(dbUpdates)
			.where(eq(users.id, userId))
			.returning();

		if (!updated) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(language, "errors.user.notFound")
			});
		}

		return updated;
	}

	async deleteAvatar(userId: string, language: Language) {
		const [current] = await db
			.select({ settings: users.settings })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		const currentSettings = (current?.settings as UserSettings | null) ?? {};
		const nextSettings = { ...currentSettings, avatarUrl: null };

		const [updated] = await db
			.update(users)
			.set({ settings: nextSettings })
			.where(eq(users.id, userId))
			.returning();

		if (!updated) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(language, "errors.user.notFound")
			});
		}

		return updated;
	}

	async changePassword(
		userId: string,
		currentPassword: string,
		newPassword: string,
		language: Language
	) {
		const user = await this.getById(userId);
		if (!user) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(language, "errors.user.notFound")
			});
		}

		if (user.passwordHash !== currentPassword) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: getMessage(language, "errors.user.wrongPassword")
			});
		}

		const [updated] = await db
			.update(users)
			.set({ passwordHash: newPassword })
			.where(eq(users.id, userId))
			.returning();

		if (!updated) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(language, "errors.user.notFound")
			});
		}

		return updated;
	}
}

export const userService = new UserService();
