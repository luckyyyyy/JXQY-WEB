/**
 * Portrait utility - 从 API 数据获取头像 ASF 路径
 */
import { getPortraitsData } from "@miu2d/engine/resource/resource-loader";

/** 缓存：API 数据 → Map<index, asfFile> */
let cachedMap: Map<number, string> | null = null;

function getPortraitMap(): Map<number, string> {
  if (cachedMap) return cachedMap;

  const data = getPortraitsData();
  if (!data || data.length === 0) {
    // 数据尚未加载，不缓存空结果
    return new Map<number, string>();
  }
  cachedMap = new Map<number, string>();
  for (const entry of data) {
    cachedMap.set(entry.index, entry.asfFile);
  }
  return cachedMap;
}

/**
 * 根据头像索引获取 ASF 资源路径
 * 数据来源：API /api/data -> portraits (即 HeadFile.ini)
 */
export function getPortraitPathByIndex(portraitIndex: number): string | null {
  if (portraitIndex <= 0) return null;
  const map = getPortraitMap();
  const filename = map.get(portraitIndex);
  return filename ? `asf/portrait/${filename}` : null;
}
