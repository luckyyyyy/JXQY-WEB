/**
 * Utility functions for parsing binary data, matching C# implementation
 */

// Text decoder for GB2312/GBK encoding (Chinese)
let textDecoder: TextDecoder | null = null;

export function getTextDecoder(): TextDecoder {
  if (!textDecoder) {
    try {
      textDecoder = new TextDecoder("gb2312");
    } catch {
      // Fallback to gbk if gb2312 not available
      try {
        textDecoder = new TextDecoder("gbk");
      } catch {
        // Last resort: use utf-8
        textDecoder = new TextDecoder("utf-8");
      }
    }
  }
  return textDecoder;
}

/**
 * Read a little-endian 32-bit integer from a byte array
 * Matches: Utils.GetLittleEndianIntegerFromByteArray
 */
export function getLittleEndianInt(data: Uint8Array, offset: number): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  );
}

/**
 * Read a null-terminated string from a byte array
 */
export function readNullTerminatedString(
  data: Uint8Array,
  offset: number,
  maxLength: number
): string {
  let end = offset;
  while (end < offset + maxLength && data[end] !== 0) {
    end++;
  }
  if (end === offset) return "";

  const bytes = data.slice(offset, end);
  return getTextDecoder().decode(bytes);
}

/**
 * Read a fixed-length string (trimming trailing nulls)
 */
export function readFixedString(
  data: Uint8Array,
  offset: number,
  length: number
): string {
  return readNullTerminatedString(data, offset, length);
}

/**
 * Parse INI file content into a nested object
 */
export function parseIni(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = "";

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    // Remove comments
    const commentIndex = rawLine.indexOf("//");
    const line = (commentIndex >= 0 ? rawLine.substring(0, commentIndex) : rawLine).trim();

    if (!line) continue;

    // Section header
    if (line.startsWith("[") && line.endsWith("]")) {
      currentSection = line.slice(1, -1).trim();
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }

    // Key=Value
    const eqIndex = line.indexOf("=");
    if (eqIndex > 0 && currentSection) {
      const key = line.substring(0, eqIndex).trim();
      const value = line.substring(eqIndex + 1).trim();
      result[currentSection][key] = value;
    }
  }

  return result;
}
