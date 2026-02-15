import type { LoginInput, RegisterInput } from "@miu2d/types";
import {
  AuthOutputSchema,
  LoginInputSchema,
  LogoutOutputSchema,
  RegisterInputSchema,
} from "@miu2d/types";
import { TRPCError } from "@trpc/server";
import { sendLoginNotification, sendWelcomeEmail } from "../../email";
import { getMessage } from "../../i18n";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Router } from "../../trpc/decorators";
import { Logger } from "../../utils/logger.js";
import { emailTokenService } from "../user/emailToken.service";
import { authService, toUserOutput } from "./auth.service";

@Router({ alias: "auth" })
export class AuthRouter {
  private readonly logger = new Logger(AuthRouter.name);

  constructor() {
    this.logger.log("AuthRouter registered");
  }
  @Mutation({ input: LoginInputSchema, output: AuthOutputSchema })
  async login(input: LoginInput, @Ctx() ctx: Context) {
    const user = await authService.getUserByEmail(input.email);

    if (!user || user.passwordHash !== input.password) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: getMessage(ctx.language, "errors.auth.invalidCredentials"),
      });
    }

    const defaultGameSlug = await authService.getDefaultGameSlug(user.id);

    if (!defaultGameSlug) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(ctx.language, "errors.auth.defaultGameNotFound"),
      });
    }

    const sessionId = await authService.createSession(user.id);
    authService.setSessionCookie(ctx.res, sessionId);

    // 异步发送登录通知邮件（不阻塞登录响应）
    sendLoginNotification(user.email, user.name, ctx.ip).catch((err) =>
      this.logger.error("Failed to send login notification", err)
    );

    return {
      user: toUserOutput(user),
      defaultGameSlug,
    };
  }

  @Mutation({ input: RegisterInputSchema, output: AuthOutputSchema })
  async register(input: RegisterInput, @Ctx() ctx: Context) {
    const existing = await authService.getUserByEmail(input.email);
    if (existing) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: getMessage(ctx.language, "errors.auth.emailAlreadyRegistered"),
      });
    }

    const result = await authService.registerUser(input);

    const sessionId = await authService.createSession(result.user.id);
    authService.setSessionCookie(ctx.res, sessionId);

    // 异步发送欢迎邮件和验证邮件（不阻塞注册响应）
    sendWelcomeEmail(result.user.email, result.user.name).catch((err) =>
      this.logger.error("Failed to send welcome email", err)
    );
    emailTokenService
      .createAndSendVerifyToken(result.user.id, result.user.email, result.user.name)
      .catch((err) => this.logger.error("Failed to send verify email", err));

    return {
      user: toUserOutput(result.user),
      defaultGameSlug: result.game.slug,
    };
  }

  @Mutation({ output: LogoutOutputSchema })
  async logout(@Ctx() ctx: Context) {
    if (ctx.sessionId) {
      await authService.deleteSession(ctx.sessionId);
    }
    authService.clearSessionCookie(ctx.res);
    return { success: true };
  }
}
