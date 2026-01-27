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
