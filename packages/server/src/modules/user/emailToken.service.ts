import { randomUUID } from "node:crypto";
import { db } from "../../db/client";
import { sendChangeEmailVerification, sendResetPasswordEmail, sendVerifyEmail } from "../../email";
import { hashPassword } from "../../utils/password";

/** 验证令牌有效期：24 小时 */
const VERIFY_TOKEN_EXPIRES_MS = 1000 * 60 * 60 * 24;
/** 修改邮箱令牌有效期：1 小时 */
const CHANGE_EMAIL_TOKEN_EXPIRES_MS = 1000 * 60 * 60;
/** 重置密码令牌有效期：1 小时 */
const RESET_PASSWORD_TOKEN_EXPIRES_MS = 1000 * 60 * 60;

export class EmailTokenService {
  /**
   * 创建邮箱验证令牌并发送验证邮件
   */
  async createAndSendVerifyToken(userId: string, email: string, userName: string) {
    // 删除该用户之前的验证令牌
    await db.emailToken.deleteMany({ where: { userId, type: "verify" } });

    const token = randomUUID();
    await db.emailToken.create({
      data: {
        userId,
        token,
        type: "verify",
        expiresAt: new Date(Date.now() + VERIFY_TOKEN_EXPIRES_MS),
      },
    });

    await sendVerifyEmail(email, userName, token);
    return token;
  }

  /**
   * 验证邮箱令牌
   * 成功后将 user.emailVerified 设为 true
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const record = await db.emailToken.findFirst({
      where: {
        token,
        type: "verify",
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      return { success: false, message: "验证链接无效或已过期" };
    }

    await db.user.update({ where: { id: record.userId }, data: { emailVerified: true } });

    await db.emailToken.delete({ where: { id: record.id } });

    return { success: true, message: "邮箱验证成功" };
  }

  /**
   * 创建修改邮箱令牌并发送验证邮件到新邮箱
   */
  async createAndSendChangeEmailToken(userId: string, userName: string, newEmail: string) {
    // 删除该用户之前的修改邮箱令牌
    await db.emailToken.deleteMany({ where: { userId, type: "change" } });

    const token = randomUUID();
    await db.emailToken.create({
      data: {
        userId,
        token,
        type: "change",
        newEmail,
        expiresAt: new Date(Date.now() + CHANGE_EMAIL_TOKEN_EXPIRES_MS),
      },
    });

    await sendChangeEmailVerification(newEmail, userName, newEmail, token);
    return token;
  }

  /**
   * 确认修改邮箱
   * 成功后更新 user.email 并设 emailVerified = true
   */
  async confirmChangeEmail(token: string): Promise<{ success: boolean; message: string }> {
    const record = await db.emailToken.findFirst({
      where: {
        token,
        type: "change",
        expiresAt: { gt: new Date() },
      },
    });

    if (!record || !record.newEmail) {
      return { success: false, message: "修改邮箱链接无效或已过期" };
    }

    // 检查新邮箱是否已被其他用户使用
    const existing = await db.user.findFirst({
      where: { email: record.newEmail },
      select: { id: true },
    });

    if (existing) {
      return { success: false, message: "该邮箱已被其他账号使用" };
    }

    await db.user.update({
      where: { id: record.userId },
      data: { email: record.newEmail, emailVerified: true },
    });

    // 清除该用户所有邮箱相关令牌
    await db.emailToken.deleteMany({ where: { userId: record.userId } });

    return { success: true, message: "邮箱修改成功" };
  }

  /**
   * 创建重置密码令牌并发送重置邮件（忘记密码流程）
   */
  async createAndSendResetToken(userId: string, email: string, userName: string) {
    // 删除该用户之前的重置密码令牌
    await db.emailToken.deleteMany({ where: { userId, type: "reset" } });

    const token = randomUUID();
    await db.emailToken.create({
      data: {
        userId,
        token,
        type: "reset",
        expiresAt: new Date(Date.now() + RESET_PASSWORD_TOKEN_EXPIRES_MS),
      },
    });

    await sendResetPasswordEmail(email, userName, token);
    return token;
  }

  /**
   * 通过重置令牌设置新密码
   * 成功后使该用户所有登录会话失效
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const record = await db.emailToken.findFirst({
      where: {
        token,
        type: "reset",
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      return { success: false, message: "重置链接无效或已过期" };
    }

    await db.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    // 清除该用户所有重置令牌
    await db.emailToken.deleteMany({ where: { userId: record.userId, type: "reset" } });

    // 使该用户所有已有登录会话失效，强制用新密码重新登录
    await db.session.deleteMany({ where: { userId: record.userId } });

    return { success: true, message: "密码重置成功，请使用新密码登录" };
  }
}

export const emailTokenService = new EmailTokenService();
