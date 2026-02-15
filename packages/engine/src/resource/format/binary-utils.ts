/**
 * Binary data parsing utilities
 * 二进制数据解析工具
 *
 * Matches Utils class binary reading functions
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
 * Calculate map pixel dimensions from tile grid counts
 * 从瓦片网格数量计算地图像素尺寸
 *
 * 等距地图的像素尺寸公式：
 * - width  = (columns - 1) * 64
 * - height = (floor((rows - 3) / 2) + 1) * 32
 */
export function calcMapPixelSize(columns: number, rows: number): { width: number; height: number } {
  return {
    width: (columns - 1) * 64,
    height: (Math.floor((rows - 3) / 2) + 1) * 32,
  };
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
