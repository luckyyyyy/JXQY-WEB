/**
 * INI file parser utility
 * INI 文件解析工具
 */

/**
 * Parse INI file content to object
 * Handles both `;` and `//` style comments
 *
 * @param content INI file content
 * @returns Parsed sections with key-value pairs
 */
export function parseIni(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = "";

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    // Remove comments (both ; and // styles)
    let line = rawLine;
    const semicolonIdx = line.indexOf(";");
    if (semicolonIdx >= 0) {
      line = line.substring(0, semicolonIdx);
    }
    const commentIdx = line.indexOf("//");
    if (commentIdx >= 0) {
      line = line.substring(0, commentIdx);
    }
    const trimmed = line.trim();

    if (!trimmed) continue;

    // Section header [SectionName]
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      currentSection = trimmed.slice(1, -1).trim();
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }

    // Key=Value
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0 && currentSection) {
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      result[currentSection][key] = value;
    }
  }

  return result;
}
