/**
 * 对话头像映射类型定义
 * 用于前后端共享的 Zod Schema
 *
 * 对应 HeadFile.ini 中的 [PORTRAIT] section
 * 索引 -> ASF 文件名映射
 */
import { z } from "zod";

// ========== Portrait Schema ==========

/**
 * 单条头像映射
 */
export const PortraitEntrySchema = z.object({
  /** 头像索引号 */
  idx: z.number().int().min(0),
  /** ASF 文件名（如 fac001a.asf） */
  file: z.string(),
});

export type PortraitEntry = z.infer<typeof PortraitEntrySchema>;

/**
 * 头像映射表 Schema
 */
export const PortraitMapSchema = z.array(PortraitEntrySchema);
export type PortraitMap = z.infer<typeof PortraitMapSchema>;

// ========== API 输入 Schema ==========

export const GetPortraitMapInputSchema = z.object({
  gameId: z.string().uuid(),
});
export type GetPortraitMapInput = z.infer<typeof GetPortraitMapInputSchema>;

export const UpdatePortraitMapInputSchema = z.object({
  gameId: z.string().uuid(),
  entries: PortraitMapSchema,
});
export type UpdatePortraitMapInput = z.infer<typeof UpdatePortraitMapInputSchema>;

export const ImportPortraitMapInputSchema = z.object({
  gameId: z.string().uuid(),
  iniContent: z.string(),
});
export type ImportPortraitMapInput = z.infer<typeof ImportPortraitMapInputSchema>;

/**
 * 头像映射结果 Schema（API 返回值）
 */
export const PortraitMapResultSchema = z.object({
  gameId: z.string().uuid(),
  entries: PortraitMapSchema,
});
export type PortraitMapResult = z.infer<typeof PortraitMapResultSchema>;

// ========== 默认值工厂 ==========

/**
 * 解析 HeadFile.ini 内容为 PortraitEntry 数组
 */
export function parsePortraitIni(content: string): PortraitEntry[] {
  const entries: PortraitEntry[] = [];
  const lines = content.split(/\r?\n/);
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("//")) continue;

    if (trimmed.startsWith("[")) {
      inSection =
        trimmed.toUpperCase().includes("PORTRAIT") || trimmed.toUpperCase().includes("INIT");
      continue;
    }

    if (!inSection) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    const idx = parseInt(key, 10);

    if (!Number.isNaN(idx) && value) {
      entries.push({ idx, file: value });
    }
  }

  return entries.sort((a, b) => a.idx - b.idx);
}

/**
 * 将 PortraitEntry 数组导出为 INI 格式
 */
export function exportPortraitIni(entries: PortraitEntry[]): string {
  const lines = ["[PORTRAIT]"];
  const sorted = [...entries].sort((a, b) => a.idx - b.idx);
  for (const entry of sorted) {
    lines.push(`${entry.idx}=${entry.file}`);
  }
  return lines.join("\n");
}
