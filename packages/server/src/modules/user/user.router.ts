import { TRPCError } from "@trpc/server";
import { Logger } from "../../utils/logger.js";
import { z } from "zod";
import { UserSchema, UserSettingsPatchSchema } from "@miu2d/types";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import type { Context } from "../../trpc/context";
import { requireUser } from "../../trpc/middlewares";
import { getMessage } from "../../i18n";
import { userService, toUserOutput } from "./user.service";
import { emailTokenService } from "./emailToken.service";

export const userProfileOutput = UserSchema;

export const userUpdateInput = z.object({
	name: z.string().min(1).optional(),
	email: z.string().email().optional(),
	settings: UserSettingsPatchSchema.nullable().optional()
});

@Router({ alias: "user" })
export class UserRouter {
	private readonly logger = new Logger(UserRouter.name);

	constructor() {
		this.logger.log("UserRouter registered");
	}
	@Query({ output: userProfileOutput })
	@UseMiddlewares(requireUser)
	async getProfile(@Ctx() ctx: Context) {
		const user = await userService.getById(ctx.userId!);
		if (!user) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(ctx.language, "errors.user.notFound")
			});
		}
		return toUserOutput(user);
	}

	@Mutation({ input: userUpdateInput, output: userProfileOutput })
	@UseMiddlewares(requireUser)
	async updateProfile(input: z.infer<typeof userUpdateInput>, @Ctx() ctx: Context) {
		// 邮箱已验证后不能直接修改邮箱，必须通过 requestChangeEmail 流程
		if (input.email) {
			const user = await userService.getById(ctx.userId!);
			if (user?.emailVerified) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "邮箱已验证，如需修改请使用「修改邮箱」功能"
				});
			}
		}

		const updated = await userService.updateProfile(ctx.userId!, {
			name: input.name,
			email: input.email,
			settings: input.settings
		}, ctx.language);

		// 如果未验证用户修改了邮箱，重新发送验证邮件
		if (input.email && !updated.emailVerified) {
			emailTokenService.createAndSendVerifyToken(updated.id, updated.email, updated.name).catch(() => {});
		}

		return toUserOutput(updated);
	}

	@Mutation({ output: userProfileOutput })
	@UseMiddlewares(requireUser)
	async deleteAvatar(@Ctx() ctx: Context) {
		const updated = await userService.deleteAvatar(ctx.userId!, ctx.language);
		return toUserOutput(updated);
	}

	@Mutation({
		input: z.object({
			currentPassword: z.string().min(1),
			newPassword: z.string().min(4)
		}),
		output: z.object({ success: z.boolean() })
	})
	@UseMiddlewares(requireUser)
	async changePassword(
		input: { currentPassword: string; newPassword: string },
		@Ctx() ctx: Context
	) {
		await userService.changePassword(
			ctx.userId!,
			input.currentPassword,
			input.newPassword,
			ctx.language
		);
		return { success: true };
	}

	/**
	 * 发送/重新发送邮箱验证邮件
	 * 邮箱未验证时可调用
	 */
	@Mutation({ output: z.object({ success: z.boolean(), message: z.string() }) })
	@UseMiddlewares(requireUser)
	async sendVerifyEmail(@Ctx() ctx: Context) {
		const user = await userService.getById(ctx.userId!);
		if (!user) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(ctx.language, "errors.user.notFound")
			});
		}
		if (user.emailVerified) {
			return { success: false, message: "邮箱已验证，无需重复验证" };
		}
		await emailTokenService.createAndSendVerifyToken(user.id, user.email, user.name);
		return { success: true, message: "验证邮件已发送，请检查你的邮箱" };
	}

	/**
	 * 验证邮箱令牌（来自验证链接）
	 */
	@Mutation({
		input: z.object({ token: z.string() }),
		output: z.object({ success: z.boolean(), message: z.string() })
	})
	async verifyEmail(input: { token: string }) {
		return emailTokenService.verifyEmail(input.token);
	}

	/**
	 * 请求修改邮箱（已验证的用户发送修改链接到新邮箱）
	 * 流程：输入新邮箱 → 发送验证邮件到新邮箱 → 用户点击链接确认
	 */
	@Mutation({
		input: z.object({ newEmail: z.string().email() }),
		output: z.object({ success: z.boolean(), message: z.string() })
	})
	@UseMiddlewares(requireUser)
	async requestChangeEmail(
		input: { newEmail: string },
		@Ctx() ctx: Context
	) {
		const user = await userService.getById(ctx.userId!);
		if (!user) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(ctx.language, "errors.user.notFound")
			});
		}
		if (user.email === input.newEmail) {
			return { success: false, message: "新邮箱与当前邮箱相同" };
		}
		const emailInUse = await userService.checkEmailExists(input.newEmail, user.id);
		if (emailInUse) {
			return { success: false, message: "该邮箱已被其他账号使用" };
		}
		await emailTokenService.createAndSendChangeEmailToken(user.id, user.name, input.newEmail);
		return { success: true, message: "验证邮件已发送到新邮箱，请查收确认" };
	}

	/**
	 * 确认修改邮箱（来自新邮箱中的确认链接）
	 */
	@Mutation({
		input: z.object({ token: z.string() }),
		output: z.object({ success: z.boolean(), message: z.string() })
	})
	async confirmChangeEmail(input: { token: string }) {
		return emailTokenService.confirmChangeEmail(input.token);
	}
}
