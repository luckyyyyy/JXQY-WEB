import { z } from "zod";
import { UserSchema } from "./user.js";

// ── 登录 ──

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

// ── 注册 ──

export const RegisterInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(4),
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;

// ── 认证响应 ──

export const AuthOutputSchema = z.object({
  user: UserSchema,
  defaultGameSlug: z.string(),
});

export type AuthOutput = z.infer<typeof AuthOutputSchema>;

// ── 登出响应 ──

export const LogoutOutputSchema = z.object({
  success: z.boolean(),
});

export type LogoutOutput = z.infer<typeof LogoutOutputSchema>;

// ── 修改密码 ──

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(4),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

// ── 邮箱验证 / 修改 ──

export const TokenInputSchema = z.object({
  token: z.string(),
});

export type TokenInput = z.infer<typeof TokenInputSchema>;

export const ChangeEmailInputSchema = z.object({
  newEmail: z.string().email(),
});

export type ChangeEmailInput = z.infer<typeof ChangeEmailInputSchema>;
