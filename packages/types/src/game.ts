import { z } from "zod";

/**
 * 游戏 Schema（原 Workspace，重命名为 Game）
 */
export const GameSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  ownerId: z.string().nullable().optional(),
  createdAt: z.string().optional() // ISO 8601 string
});

export const CreateGameInputSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  slug: z
    .string()
    .min(1, "标识不能为空")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "标识只能包含小写字母、数字和连字符，且不能以连字符开头或结尾")
    .optional(),
  description: z.string().optional()
});

export const UpdateGameInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "标识只能包含小写字母、数字和连字符，且不能以连字符开头或结尾")
    .optional(),
  description: z.string().nullable().optional()
});

export const DeleteGameInputSchema = z.object({
  id: z.string()
});

export type Game = z.infer<typeof GameSchema>;
export type CreateGameInput = z.infer<typeof CreateGameInputSchema>;
export type UpdateGameInput = z.infer<typeof UpdateGameInputSchema>;
export type DeleteGameInput = z.infer<typeof DeleteGameInputSchema>;
