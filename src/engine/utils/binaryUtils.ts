/**
 * Binary data parsing utilities
 * 二进制数据解析工具
 *
 * Matches C# Utils class binary reading functions
 */

import { getTextDecoder } from "./encoding";

/**
 * Read a little-endian 32-bit signed integer from a byte array
 * Matches: Utils.GetLittleEndianIntegerFromByteArray
 */
export function getLittleEndianInt(data: Uint8Array, offset: number): number {
  return (
    data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)
  );
}

/**
 * Read a null-terminated string from a byte array (GBK encoded)
 * 从字节数组读取以 null 结尾的字符串
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

  return getTextDecoder().decode(data.slice(offset, end));
}

/**
 * Read a fixed-length string (trimming trailing nulls)
 * 读取固定长度字符串（去除尾部 null）
 */
export function readFixedString(data: Uint8Array, offset: number, length: number): string {
  return readNullTerminatedString(data, offset, length);
}
