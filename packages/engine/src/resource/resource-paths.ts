/**
 * 资源路径配置
 *
 * 统一管理所有资源路径，方便后期修改资源根目录。
 * 所有资源加载都应该通过这个配置来获取完整路径。
 *
 * 资源路径由 gameSlug 动态确定：
 * - 格式: /game/[gameSlug]/resources
 * - 由 GameScreen 组件调用 setResourcePaths({ root: '/game/${gameSlug}/resources' }) 设置
 *
 * 环境变量：
 * - VITE_DEMO_RESOURCES_DOMAIN: 外部资源域名（如 R2 CDN）
 *   - 配置后: https://cdn.example.com/game/xxx/resources/...
 *   - 未配置: /game/[gameSlug]/resources/... (当前域名)
 */

// =============================================================================
// 资源域名配置
// =============================================================================

/**
 * 获取资源域名（从环境变量读取）
 * 环境变量: VITE_DEMO_RESOURCES_DOMAIN
 * 例如: https://yych.example.com
 *
 * @returns 资源域名（不带尾部斜杠），如果未配置返回空字符串
 */
export function getResourceDomain(): string {
  const domain = import.meta.env.VITE_DEMO_RESOURCES_DOMAIN as string | undefined;
  if (domain) {
    // 移除尾部斜杠
    return domain.replace(/\/+$/, "");
  }
  return "";
}

/**
 * 获取完整的资源 URL
 * @param path 资源路径（如 /resources/xxx 或 resources/xxx）
 * @returns 完整的资源 URL
 */
export function getResourceUrl(path: string): string {
  const domain = getResourceDomain();
  // 确保 path 以 / 开头
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (domain) {
    return `${domain}${normalizedPath}`;
  }
  return normalizedPath;
}

// =============================================================================
// 资源根目录配置
// =============================================================================

/**
 * 获取默认资源根目录
 * 默认值: "/resources"（向后兼容，实际由前端动态设置）
 *
 * @returns 资源根目录（带前导斜杠），如 "/game/xxx/resources"
 */
function getDefaultResourceRoot(): string {
  // 默认返回 /resources，实际由 GameScreen 通过 setResourcePaths 设置为
  // /game/[gameSlug]/resources
  return "/resources";
}

// =============================================================================
// 资源路径配置
// =============================================================================

/**
 * 资源路径配置接口
 */
export interface ResourcePathsConfig {
  /** 资源根目录，如 "/game/xxx/resources" */
  root: string;
}

/**
 * 获取默认配置（基于环境变量）
 */
function getDefaultConfig(): ResourcePathsConfig {
  return {
    root: getDefaultResourceRoot(),
  };
}

/**
 * 当前配置（可运行时修改）
 */
let currentConfig: ResourcePathsConfig = getDefaultConfig();

/**
 * 设置资源路径配置
 * @param config 部分或完整配置
 */
export function setResourcePaths(config: Partial<ResourcePathsConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * 获取当前资源路径配置
 */
export function getResourcePaths(): ResourcePathsConfig {
  return { ...currentConfig };
}

/**
 * 获取资源根目录
 */
export function getResourceRoot(): string {
  return currentConfig.root;
}

/**
 * 重置为默认配置
 */
export function resetResourcePaths(): void {
  currentConfig = getDefaultConfig();
}

// =============================================================================
// 资源目录路径（相对于资源根目录）
// =============================================================================

/** 资源目录结构 */
export const ResourceDirs = {
  /** 地图文件目录 */
  map: "map",
  /** ASF 精灵文件目录 */
  asf: {
    root: "asf",
    character: "asf/character",
    interlude: "asf/interlude",
    object: "asf/object",
    effect: "asf/effect",
    magic: "asf/magic",
  },
  /** MPC 资源包目录 */
  mpc: {
    root: "mpc",
    map: "mpc/map",
    character: "mpc/character",
    object: "mpc/object",
  },
  /** INI 配置文件目录 */
  ini: {
    root: "ini",
    npc: "ini/npc",
    obj: "ini/obj",
    goods: "ini/goods",
    magic: "ini/magic",
    level: "ini/level",
    buy: "ini/buy",
  },
  /** 脚本文件目录 */
  script: {
    root: "script",
    common: "script/common",
    map: "script/map",
  },
  /** content 资源目录（音频、UI等） */
  content: {
    root: "content",
    music: "content/music",
    sound: "content/sound",
    ui: "content/ui",
    video: "content/video",
  },
} as const;

// =============================================================================
// 路径构建辅助函数
// =============================================================================

/**
 * 构建完整的资源路径
 * @param relativePath 相对于资源根目录的路径
 * @returns 完整资源路径
 */
export function buildPath(relativePath: string): string {
  const root = currentConfig.root;
  // 规范化路径
  let normalized = relativePath.replace(/\\/g, "/");

  // 移除开头的斜杠
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }

  return `${root}/${normalized}`;
}

/**
 * 从完整路径中提取相对路径
 * @param fullPath 完整资源路径
 * @returns 相对于资源根目录的路径
 */
export function extractRelativePath(fullPath: string): string {
  const root = currentConfig.root;
  let normalized = fullPath.replace(/\\/g, "/");

  // 如果以资源根目录开头，移除它
  if (normalized.startsWith(`${root}/`)) {
    return normalized.slice(root.length + 1);
  }
  if (normalized.startsWith(root)) {
    return normalized.slice(root.length);
  }

  // 如果以 / 开头但不是资源根目录，移除开头的 /
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }

  return normalized;
}

// =============================================================================
// 常用资源路径构建器
// =============================================================================

/** 资源路径构建器 */
export const ResourcePath = {
  // --- 地图 ---
  /** 地图文件路径 */
  map(fileName: string): string {
    return buildPath(`${ResourceDirs.map}/${fileName}`);
  },

  // --- ASF 精灵 ---
  /** 角色 ASF 文件路径 */
  asfCharacter(fileName: string): string {
    return buildPath(`${ResourceDirs.asf.character}/${fileName}`);
  },
  /** 过场 ASF 文件路径 */
  asfInterlude(fileName: string): string {
    return buildPath(`${ResourceDirs.asf.interlude}/${fileName}`);
  },
  /** 物体 ASF 文件路径 */
  asfObject(fileName: string): string {
    return buildPath(`${ResourceDirs.asf.object}/${fileName}`);
  },
  /** 特效 ASF 文件路径 */
  asfEffect(fileName: string): string {
    return buildPath(`${ResourceDirs.asf.effect}/${fileName}`);
  },
  /** 武功 ASF 文件路径 */
  asfMagic(fileName: string): string {
    return buildPath(`${ResourceDirs.asf.magic}/${fileName}`);
  },
  /** ASF 根目录路径 */
  asfRoot(fileName: string): string {
    return buildPath(`${ResourceDirs.asf.root}/${fileName}`);
  },

  // --- INI 配置 ---
  /** NPC 配置文件路径 */
  npc(fileName: string): string {
    return buildPath(`${ResourceDirs.ini.npc}/${fileName}`);
  },
  /** 物体配置文件路径 */
  obj(fileName: string): string {
    return buildPath(`${ResourceDirs.ini.obj}/${fileName}`);
  },
  /** 物品配置文件路径 */
  goods(fileName: string): string {
    return buildPath(`${ResourceDirs.ini.goods}/${fileName}`);
  },
  /** 武功配置文件路径 */
  magic(fileName: string): string {
    return buildPath(`${ResourceDirs.ini.magic}/${fileName}`);
  },
  /** 等级配置文件路径 */
  level(fileName: string): string {
    return buildPath(`${ResourceDirs.ini.level}/${fileName}`);
  },
  /** 购买列表配置路径 */
  buy(fileName: string): string {
    return buildPath(`${ResourceDirs.ini.buy}/${fileName}`);
  },
  /** INI 根目录路径 */
  ini(fileName: string): string {
    return buildPath(`${ResourceDirs.ini.root}/${fileName}`);
  },

  // --- 脚本 ---
  /** 通用脚本路径 */
  scriptCommon(fileName: string): string {
    return buildPath(`${ResourceDirs.script.common}/${fileName}`);
  },
  /** 地图脚本目录路径 */
  scriptMap(mapName: string): string {
    return buildPath(`${ResourceDirs.script.map}/${mapName}`);
  },
  /** 脚本根目录路径 */
  script(relativePath: string): string {
    return buildPath(`${ResourceDirs.script.root}/${relativePath}`);
  },

  // --- Content 资源 ---
  /** 音乐文件路径 */
  music(fileName: string): string {
    return buildPath(`${ResourceDirs.content.music}/${fileName}`);
  },
  /** 音效文件路径 */
  sound(fileName: string): string {
    return buildPath(`${ResourceDirs.content.sound}/${fileName}`);
  },
  /** 视频文件路径 */
  video(fileName: string): string {
    return buildPath(`${ResourceDirs.content.video}/${fileName}`);
  },
  /** UI 配置文件路径 */
  ui(fileName: string): string {
    return buildPath(`${ResourceDirs.content.ui}/${fileName}`);
  },
  /** Content 根目录路径 */
  content(relativePath: string): string {
    return buildPath(`${ResourceDirs.content.root}/${relativePath}`);
  },

  // --- MPC ---
  /** MPC 资源包路径（地图用） */
  mpc(fileName: string): string {
    return buildPath(`${ResourceDirs.mpc.root}/${fileName}`);
  },
  /** MPC 地图资源路径 */
  mpcMap(fileName: string): string {
    return buildPath(`${ResourceDirs.mpc.map}/${fileName}`);
  },
  /** MPC 角色精灵路径 */
  mpcCharacter(fileName: string): string {
    return buildPath(`${ResourceDirs.mpc.character}/${fileName}`);
  },
  /** MPC 物体精灵路径 */
  mpcObject(fileName: string): string {
    return buildPath(`${ResourceDirs.mpc.object}/${fileName}`);
  },

  // --- 通用 ---
  /** 从资源根目录构建任意路径 */
  from(relativePath: string): string {
    return buildPath(relativePath);
  },
} as const;

// =============================================================================
// 预定义的常用资源路径
// =============================================================================

/**
 * 预定义的常用资源路径
 * 用于替换硬编码的路径常量
 */
export const DefaultPaths = {
  /** 玩家等级配置 (简单模式) */
  get levelEasy(): string {
    return ResourcePath.level("Level-easy.ini");
  },
  /** NPC 等级配置 */
  get levelNpc(): string {
    return ResourcePath.level("level-npc.ini");
  },
  /** UI 设置文件 (Content) */
  get uiSettingsContent(): string {
    return ResourcePath.ui("ui_settings.ini");
  },
  /** UI 设置文件 (INI) */
  get uiSettingsIni(): string {
    return ResourcePath.ini("ui_settings.ini");
  },
  /** 音乐基础路径 */
  get musicBasePath(): string {
    return buildPath(ResourceDirs.content.music);
  },
  /** 音效基础路径 */
  get soundBasePath(): string {
    return buildPath(ResourceDirs.content.sound);
  },
  /** 地图名称映射配置 */
  get MAP_NAME_INI(): string {
    return ResourcePath.ini("map/mapname.ini");
  },
} as const;

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 检查路径是否以资源根目录开头
 */
export function isResourcePath(path: string): boolean {
  const root = currentConfig.root;
  return path.startsWith(`${root}/`) || path.startsWith(root);
}

/**
 * 确保路径以资源根目录开头
 * 如果已经是资源路径则直接返回，否则添加资源根目录前缀
 */
export function ensureResourcePath(path: string): string {
  if (isResourcePath(path)) {
    return path;
  }
  return buildPath(path);
}

/**
 * 解析脚本路径：如果 scriptFile 是绝对路径（以 "/" 开头）则直接使用，
 * 否则拼接 basePath + "/" + scriptFile
 *
 * 统一了引擎中 7+ 处重复的脚本路径拼接逻辑，
 * 修复了部分调用点缺少 startsWith("/") 检查的问题
 */
export function resolveScriptPath(basePath: string, scriptFile: string): string {
  if (scriptFile.startsWith("/")) {
    return scriptFile;
  }
  return `${basePath}/${scriptFile}`;
}

// =============================================================================
// 缓存键规范化（统一所有 ConfigLoader 的 normalizeKey 模式）
// =============================================================================

/**
 * 规范化缓存键 - 统一的配置文件路径规范化
 *
 * 所有 ConfigLoader（npc, obj, magic, goods, level）共用此函数，
 * 替代各 Loader 内部的 normalizeKey / normalizeKeyForCache。
 *
 * 处理步骤：
 * 1. 反斜杠 → 正斜杠
 * 2. 移除资源根目录前缀（如 /game/xxx/resources/）
 * 3. 移除开头的 /
 * 4. 移除匹配的 ini 子目录前缀（如 ini/npc/、ini/magic/）
 * 5. 转小写
 *
 * @param fileName 原始文件名或路径
 * @param prefixes 需要剥离的 ini 子目录前缀列表（如 ["ini/npc/", "ini/partner/"]）
 */
export function normalizeCacheKey(fileName: string, prefixes: readonly string[]): string {
  let key = fileName.replace(/\\/g, "/");

  const root = getResourceRoot();
  if (key.startsWith(root)) {
    key = key.slice(root.length);
  }
  if (key.startsWith("/")) {
    key = key.slice(1);
  }
  for (const prefix of prefixes) {
    if (key.startsWith(prefix)) {
      key = key.slice(prefix.length);
      break;
    }
  }
  return key.toLowerCase();
}
