import { render } from "@react-email/components";
import { createTransport, type Transporter } from "nodemailer";
import { createElement } from "react";
import { env } from "../env";
import { Logger } from "../utils/logger.js";
import { ChangeEmailVerification } from "./templates/ChangeEmailVerification";
import { LoginNotification } from "./templates/LoginNotification";
import { ResetPasswordEmail } from "./templates/ResetPasswordEmail";
import { VerifyEmail } from "./templates/VerifyEmail";
import { WelcomeEmail } from "./templates/WelcomeEmail";

const logger = new Logger("EmailService");

function getTransporter(): Transporter {
  return createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
}

function getFromAddress(): string {
  return env.smtpFrom;
}

function getAppUrl(): string {
  return env.appUrl;
}

function isEmailEnabled(): boolean {
  return env.isEmailEnabled;
}

async function sendMail(to: string, subject: string, html: string) {
  if (!isEmailEnabled()) {
    logger.warn(`Email disabled (no SMTP config), skipping: "${subject}" → ${to}`);
    return;
  }

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject,
      html,
    });
    logger.log(`Email sent: "${subject}" → ${to}`);
  } catch (error) {
    logger.error(`Failed to send email: "${subject}" → ${to}`, error);
  }
}

// ==================== 邮件发送方法 ====================

/**
 * 登录通知邮件
 */
export async function sendLoginNotification(to: string, userName: string, ipAddress: string) {
  const loginTime = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const html = await render(createElement(LoginNotification, { userName, loginTime, ipAddress }));
  await sendMail(to, `登录通知 - ${loginTime}`, html);
}

/**
 * 注册欢迎邮件
 */
export async function sendWelcomeEmail(to: string, userName: string) {
  const loginUrl = getAppUrl();
  const html = await render(createElement(WelcomeEmail, { userName, loginUrl }));
  await sendMail(to, "欢迎加入 Miu2D Engine！", html);
}

/**
 * 邮箱验证邮件
 */
export async function sendVerifyEmail(to: string, userName: string, token: string) {
  const verifyUrl = `${getAppUrl()}/verify-email?token=${token}`;
  const html = await render(createElement(VerifyEmail, { userName, verifyUrl }));
  await sendMail(to, "验证你的邮箱 - Miu2D Engine", html);
}

/**
 * 修改邮箱验证邮件（发到新邮箱）
 */
export async function sendChangeEmailVerification(
  to: string,
  userName: string,
  newEmail: string,
  token: string
) {
  const verifyUrl = `${getAppUrl()}/verify-change-email?token=${token}`;
  const html = await render(
    createElement(ChangeEmailVerification, { userName, newEmail, verifyUrl })
  );
  await sendMail(to, "确认修改邮箱 - Miu2D Engine", html);
}

/**
 * 重置密码邮件（忘记密码流程）
 */
export async function sendResetPasswordEmail(to: string, userName: string, token: string) {
  const resetUrl = `${getAppUrl()}/reset-password?token=${token}`;
  const html = await render(createElement(ResetPasswordEmail, { userName, resetUrl }));
  await sendMail(to, "重置你的密码 - Miu2D Engine", html);
}
