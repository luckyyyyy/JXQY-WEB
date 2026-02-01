/**
 * Text encoding utilities
 * 文本编码工具
 */

// Cached text decoder for GB2312/GBK encoding
let cachedDecoder: TextDecoder | null = null;

/**
 * Get a cached TextDecoder for GB2312/GBK encoding
 * 获取缓存的 GB2312/GBK 解码器
 */
export function getTextDecoder(): TextDecoder {
  if (!cachedDecoder) {
    try {
      cachedDecoder = new TextDecoder("gbk");
    } catch {
      try {
        cachedDecoder = new TextDecoder("gb2312");
      } catch {
        cachedDecoder = new TextDecoder("utf-8");
      }
    }
  }
  return cachedDecoder;
}

/**
 * Decode GB2312/GBK encoded buffer to string
 * Used ONLY for reading Chinese text from BINARY game resource files (map, MPC)
 * NOTE: Text files (.ini, .txt) in resources/ are now UTF-8, use response.text() instead
 *
 * @param buffer ArrayBuffer containing GBK encoded data
 * @returns Decoded string
 */
export function decodeGb2312(buffer: ArrayBuffer): string {
  return getTextDecoder().decode(new Uint8Array(buffer));
}
