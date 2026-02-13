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
    } catch { // gbk not supported
      try {
        cachedDecoder = new TextDecoder("gb2312");
      } catch { // gb2312 not supported
        cachedDecoder = new TextDecoder("utf-8");
      }
    }
  }
  return cachedDecoder;
}

