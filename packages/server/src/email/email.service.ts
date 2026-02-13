import { render } from "@react-email/components";
import { createTransport, type Transporter } from "nodemailer";
import { Logger } from "@nestjs/common";
import { createElement } from "react";
import { LoginNotification } from "./templates/LoginNotification";
import { WelcomeEmail } from "./templates/WelcomeEmail";
import { VerifyEmail } from "./templates/VerifyEmail";
import { ChangeEmailVerification } from "./templates/ChangeEmailVerification";

const logger = new Logger("EmailService");

function getTransporter(): Transporter {
  return createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function getFromAddress(): string {
  return process.env.SMTP_FROM || `Miu2D Engine <noreply@miu2d.com>`;
}

function getAppUrl(): string {
  return process.env.APP_URL || "http://localhost:5173";
}

function isEmailEnabled(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
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
export async function sendLoginNotification(
  to: string,
  userName: string,
  ipAddress: string
) {
  const loginTime = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const html = await render(
    createElement(LoginNotification, { userName, loginTime, ipAddress })
  );
  await sendMail(to, `登录通知 - ${loginTime}`, html);
}

/**
 * 注册欢迎邮件
 */
export async function sendWelcomeEmail(to: string, userName: string) {
  const loginUrl = getAppUrl();
  const html = await render(
    createElement(WelcomeEmail, { userName, loginUrl })
  );
  await sendMail(to, "欢迎加入 Miu2D Engine！", html);
}

/**
 * 邮箱验证邮件
 */
export async function sendVerifyEmail(
  to: string,
  userName: string,
  token: string
) {
  const verifyUrl = `${getAppUrl()}/verify-email?token=${token}`;
  const html = await render(
    createElement(VerifyEmail, { userName, verifyUrl })
  );
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
