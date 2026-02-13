/**
 * 对话系统类型定义
 * 用于前后端共享的 Zod Schema
 *
 * 对应 TalkIndex.txt 中的对话数据
 * 格式: [talkId,portraitIndex]对话文本
 */
import { z } from "zod";

// ========== Talk Entry Schema ==========

export const TalkEntrySchema = z.object({
  /** 对话 ID（唯一标识） */
  id: z.number().int().min(0),
  /** 对话头像索引（映射到 portrait 表中的 ASF 文件） */
  portraitIndex: z.number().int().min(0),
  /** 对话文本内容（支持 <color=Red>...<color=Black> 等标签） */
  text: z.string(),
});
export type TalkEntry = z.infer<typeof TalkEntrySchema>;

export const TalkDataSchema = z.array(TalkEntrySchema);
export type TalkData = z.infer<typeof TalkDataSchema>;

// ========== API 输入 Schema ==========

export const GetTalkDataInputSchema = z.object({ gameId: z.string().uuid() });
export type GetTalkDataInput = z.infer<typeof GetTalkDataInputSchema>;

export const UpdateTalkDataInputSchema = z.object({
  gameId: z.string().uuid(),
  entries: TalkDataSchema,
});
export type UpdateTalkDataInput = z.infer<typeof UpdateTalkDataInputSchema>;

export const ImportTalkDataInputSchema = z.object({
  gameId: z.string().uuid(),
  content: z.string(),
});
export type ImportTalkDataInput = z.infer<typeof ImportTalkDataInputSchema>;

export const TalkDataResultSchema = z.object({
  gameId: z.string().uuid(),
  entries: TalkDataSchema,
});
export type TalkDataResult = z.infer<typeof TalkDataResultSchema>;

// ========== 单条对话 CRUD Schema ==========

export const CreateTalkEntryInputSchema = z.object({
  gameId: z.string().uuid(),
  entry: TalkEntrySchema,
});
export type CreateTalkEntryInput = z.infer<typeof CreateTalkEntryInputSchema>;

export const UpdateTalkEntryInputSchema = z.object({
  gameId: z.string().uuid(),
  entry: TalkEntrySchema,
});
export type UpdateTalkEntryInput = z.infer<typeof UpdateTalkEntryInputSchema>;

export const DeleteTalkEntryInputSchema = z.object({
  gameId: z.string().uuid(),
  id: z.number().int().min(0),
});
export type DeleteTalkEntryInput = z.infer<typeof DeleteTalkEntryInputSchema>;

// ========== 搜索 Schema ==========

export const SearchTalkInputSchema = z.object({
  gameId: z.string().uuid(),
  query: z.string().optional(),
  portraitIndex: z.number().int().min(0).optional(),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(200).default(50),
});
export type SearchTalkInput = z.infer<typeof SearchTalkInputSchema>;

export const SearchTalkResultSchema = z.object({
  entries: TalkDataSchema,
  total: z.number().int(),
});
export type SearchTalkResult = z.infer<typeof SearchTalkResultSchema>;

// ========== 解析 / 导出工具 ==========

/**
 * 解析 TalkIndex.txt 内容
 * 格式: [index,portraitIndex]text
 */
export function parseTalkIndexTxt(content: string): TalkEntry[] {
  const entries: TalkEntry[] = [];
  const lines = content.split(/\r?\n/);
  const regex = /^\[(\d+),(\d+)\](.*)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(regex);
    if (match) {
      entries.push({
        id: parseInt(match[1], 10),
        portraitIndex: parseInt(match[2], 10),
        text: match[3],
      });
    }
  }

  return entries.sort((a, b) => a.id - b.id);
}

/**
 * 导出为 TalkIndex.txt 格式
 */
export function exportTalkIndexTxt(entries: TalkEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.id - b.id);
  return sorted.map((e) => `[${e.id},${e.portraitIndex}]${e.text}`).join("\n");
}

/**
 * 从对话文本中提取角色名（如果文本以 "角色名：" 开头）
 */
export function extractSpeakerName(text: string): string | null {
  // 去掉颜色标签后匹配
  const cleaned = text.replace(/<color=[^>]+>/g, "");
  const match = cleaned.match(/^(.+?)：/);
  return match ? match[1] : null;
}
