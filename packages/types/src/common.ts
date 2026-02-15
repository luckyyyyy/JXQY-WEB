import { z } from "zod";

// ── 通用 API 响应 Schema ──

/** 通用 ID 响应（delete 等操作返回） */
export const IdResponseSchema = z.object({
  id: z.string(),
});

export type IdResponse = z.infer<typeof IdResponseSchema>;

/** 通用成功响应 */
export const SuccessResponseSchema = z.object({
  success: z.boolean(),
});

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

/** 通用消息响应（邮箱验证、操作确认等） */
export const MessageResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type MessageResponse = z.infer<typeof MessageResponseSchema>;

// ── 语言类型 ──

export const LanguageSchema = z.enum(["zh", "en"]);

export type Language = z.infer<typeof LanguageSchema>;

/** 将任意字符串标准化为 Language */
export const normalizeLanguage = (value?: string): Language => {
  if (!value) return "zh";
  const lower = value.toLowerCase();
  if (lower.startsWith("en")) return "en";
  if (lower.startsWith("zh")) return "zh";
  return "zh";
};
