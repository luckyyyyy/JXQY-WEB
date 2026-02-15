/**
 * Character Resource Loader - NPC 资源文件加载
 * Based on JxqyHD Engine/ResFile.cs
 *
 * 加载 NPC 资源映射（state -> ASF/Sound）
 */

import { logger } from "../core/logger";
import { getNpcResFromCache } from "../npc/npc-config-cache";
import { type AsfData, loadAsf } from "../resource/format/asf";
import { loadMpcWithShadow } from "../resource/format/mpc";
import { ResourcePath } from "../resource/resource-paths";

/**
 * NpcRes state info（state -> ASF/Sound 映射）
 */
export interface NpcResStateInfo {
  imagePath: string; // ASF or MPC file name
  shadePath: string; // SHD file name (for MPC only)
  soundPath: string; // WAV file name
}

/**
 * Load ASF file from character or interlude directory
 * ()
 */
export async function loadCharacterAsf(asfFileName: string): Promise<AsfData | null> {
  // C# 参考: Utils.GetAsf() - if (string.IsNullOrEmpty(fileName)) return null;
  if (!asfFileName) return null;

  // Encode Chinese characters in filename for URL
  const encodedFileName = encodeURIComponent(asfFileName);

  const paths = [
    ResourcePath.asfCharacter(encodedFileName),
    ResourcePath.asfInterlude(encodedFileName),
  ];

  for (const path of paths) {
    const asf = await loadAsf(path);
    if (asf) {
      return asf;
    }
  }

  logger.warn(`[ResFile] ASF not found: ${asfFileName}`);
  return null;
}

/**
 * Load character sprite image (ASF or MPC format)
 * () which checks file extension
 *
 * @param imagePath - Image filename (can be .asf or .mpc)
 * @param shadePath - Optional SHD shadow filename (for MPC only)
 * @returns AsfData if successful, null otherwise
 */
export async function loadCharacterImage(
  imagePath: string,
  shadePath?: string
): Promise<AsfData | null> {
  const ext = imagePath.toLowerCase().slice(-4);
  const encodedImageName = encodeURIComponent(imagePath);

  if (ext === ".mpc") {
    // MPC format - load from mpc/character/ directory with optional SHD
    const mpcPath = ResourcePath.mpcCharacter(encodedImageName);
    let shdPath: string | undefined;
    if (shadePath) {
      shdPath = ResourcePath.mpcCharacter(encodeURIComponent(shadePath));
    }

    const mpc = await loadMpcWithShadow(mpcPath, shdPath);
    if (mpc) {
      // Convert MPC to AsfData format for unified handling
      return mpcToAsfData(mpc);
    }
    logger.warn(`[ResFile] MPC not found: ${imagePath}`);
    return null;
  }

  // Default: ASF format
  return loadCharacterAsf(imagePath);
}

/**
 * Convert MPC data to AsfData format
 * This allows unified sprite handling regardless of source format
 */
function mpcToAsfData(mpc: import("../map/types").Mpc): AsfData {
  const directions = mpc.head.direction || 1;
  const frameCount = mpc.head.frameCounts;
  const framesPerDirection = directions > 0 ? Math.floor(frameCount / directions) : frameCount;

  return {
    width: mpc.head.globalWidth,
    height: mpc.head.globalHeight,
    frameCount: frameCount,
    directions: directions,
    colorCount: mpc.head.colourCounts,
    interval: mpc.head.interval,
    left: mpc.head.left,
    bottom: mpc.head.bottom,
    framesPerDirection: framesPerDirection,
    frames: mpc.frames.map((frame) => ({
      width: frame.width,
      height: frame.height,
      imageData: frame.imageData,
      canvas: null, // Will be created on first render if needed
    })),
    isLoaded: true,
  };
}

/**
 * 获取 NpcRes 状态映射（state -> ASF/Sound）
 * 从 API 缓存获取，替代原有的 INI 文件加载
 */
export async function loadNpcRes(npcIni: string): Promise<Map<number, NpcResStateInfo> | null> {
  return getNpcResFromCache(npcIni);
}
