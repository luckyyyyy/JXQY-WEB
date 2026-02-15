import { randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../../db/client";
import { emailTokens, users } from "../../db/schema";
import { sendChangeEmailVerification, sendVerifyEmail } from "../../email";

/** 验证令牌有效期：24 小时 */
const VERIFY_TOKEN_EXPIRES_MS = 1000 * 60 * 60 * 24;
/** 修改邮箱令牌有效期：1 小时 */
const CHANGE_EMAIL_TOKEN_EXPIRES_MS = 1000 * 60 * 60;

export class EmailTokenService {
  /**
   * 创建邮箱验证令牌并发送验证邮件
   */
  async createAndSendVerifyToken(userId: string, email: string, userName: string) {
    // 删除该用户之前的验证令牌
    await db
      .delete(emailTokens)
      .where(and(eq(emailTokens.userId, userId), eq(emailTokens.type, "verify")));

    const token = randomUUID();
    await db.insert(emailTokens).values({
      userId,
      token,
      type: "verify",
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_EXPIRES_MS),
    });

    await sendVerifyEmail(email, userName, token);
    return token;
  }

  /**
   * 验证邮箱令牌
   * 成功后将 user.emailVerified 设为 true
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const [record] = await db
      .select()
      .from(emailTokens)
      .where(
        and(
          eq(emailTokens.token, token),
          eq(emailTokens.type, "verify"),
          gt(emailTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!record) {
      return { success: false, message: "验证链接无效或已过期" };
    }

    await db.update(users).set({ emailVerified: true }).where(eq(users.id, record.userId));

    await db.delete(emailTokens).where(eq(emailTokens.id, record.id));

    return { success: true, message: "邮箱验证成功" };
  }

  /**
   * 创建修改邮箱令牌并发送验证邮件到新邮箱
   */
  async createAndSendChangeEmailToken(userId: string, userName: string, newEmail: string) {
    // 删除该用户之前的修改邮箱令牌
    await db
      .delete(emailTokens)
      .where(and(eq(emailTokens.userId, userId), eq(emailTokens.type, "change")));

    const token = randomUUID();
    await db.insert(emailTokens).values({
      userId,
      token,
      type: "change",
      newEmail,
      expiresAt: new Date(Date.now() + CHANGE_EMAIL_TOKEN_EXPIRES_MS),
    });

    await sendChangeEmailVerification(newEmail, userName, newEmail, token);
    return token;
  }

  /**
   * 确认修改邮箱
   * 成功后更新 user.email 并设 emailVerified = true
   */
  async confirmChangeEmail(token: string): Promise<{ success: boolean; message: string }> {
    const [record] = await db
      .select()
      .from(emailTokens)
      .where(
        and(
          eq(emailTokens.token, token),
          eq(emailTokens.type, "change"),
          gt(emailTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!record || !record.newEmail) {
      return { success: false, message: "修改邮箱链接无效或已过期" };
    }

    // 检查新邮箱是否已被其他用户使用
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, record.newEmail))
      .limit(1);

    if (existing) {
      return { success: false, message: "该邮箱已被其他账号使用" };
    }

    await db
      .update(users)
      .set({ email: record.newEmail, emailVerified: true })
      .where(eq(users.id, record.userId));

    // 清除该用户所有邮箱相关令牌
    await db.delete(emailTokens).where(eq(emailTokens.userId, record.userId));

    return { success: true, message: "邮箱修改成功" };
  }
}

export const emailTokenService = new EmailTokenService();
