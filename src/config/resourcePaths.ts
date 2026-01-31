/**
 * 资源路径配置
 *
 * 统一管理所有资源路径，方便后期修改资源根目录。
 * 所有资源加载都应该通过这个配置来获取完整路径。
 */

// =============================================================================
// 游戏定义
// =============================================================================

/** 游戏 ID 类型 */
export type GameId = "yueying" | "canghai";

/** 游戏信息 */
export interface GameInfo {
  id: GameId;
  name: string;
  resourceRoot: string;
  icon: string;
}

/** 可用游戏列表 */
export const AVAILABLE_GAMES: GameInfo[] = [
  {
    id: "yueying",
    name: "月影传说",
    resourceRoot: "/resources",
    icon: "/icons/yueying.png",
  },
  // {
  //   id: "canghai",
  //   name: "沧海",
  //   resourceRoot: "/canghai",
  //   icon: "/icons/canghai.png",
  // },
];

/** localStorage key for game selection */
const GAME_SELECTION_KEY = "jxqy_selected_game";

/**
 * 获取当前选择的游戏 ID
 */
export function getSelectedGameId(): GameId {
  const saved = localStorage.getItem(GAME_SELECTION_KEY);
  if (saved === "yueying" || saved === "canghai") {
    return saved;
  }
  return "yueying"; // 默认月影传说
}

/**
 * 设置当前选择的游戏
 */
export function setSelectedGameId(gameId: GameId): void {
  localStorage.setItem(GAME_SELECTION_KEY, gameId);
}

/**
 * 获取当前选择的游戏信息
 */
export function getSelectedGame(): GameInfo {
  const gameId = getSelectedGameId();
  return AVAILABLE_GAMES.find((g) => g.id === gameId) || AVAILABLE_GAMES[0];
}

// =============================================================================
// 资源路径配置
// =============================================================================

/**
 * 资源路径配置接口
 */
export interface ResourcePathsConfig {
  /** 资源根目录，默认 "/resources" */
  root: string;
}

/**
 * 获取默认配置（基于当前选择的游戏）
 */
function getDefaultConfig(): ResourcePathsConfig {
  return {
    root: getSelectedGame().resourceRoot,
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
 * 重置为默认配置（基于当前选择的游戏）
 */
export function resetResourcePaths(): void {
  currentConfig = getDefaultConfig();
}

/**
 * 切换游戏并重置资源路径
 * @param gameId 游戏 ID
 * @returns 是否需要刷新页面
 */
export function switchGame(gameId: GameId): boolean {
  const currentGameId = getSelectedGameId();
  if (currentGameId === gameId) {
    return false; // 没有变化
  }
  setSelectedGameId(gameId);
  resetResourcePaths();
  return true;
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
  mpc: "mpc",
  /** INI 配置文件目录 */
  ini: {
    root: "ini",
    npc: "ini/npc",
    npcres: "ini/npcres",
    obj: "ini/obj",
    objres: "ini/objres",
    goods: "ini/goods",
    magic: "ini/magic",
    level: "ini/level",
    buy: "ini/buy",
    save: "ini/save",
  },
  /** 脚本文件目录 */
  script: {
    root: "script",
    common: "script/common",
    map: "script/map",
  },
  /** Content 资源目录（音频、UI等） */
  content: {
    root: "Content",
    music: "Content/music",
    sound: "Content/sound",
    ui: "Content/ui",
    video: "Content/video",
  },
  /** 存档目录 */
  save: {
    root: "save",
    game: "save/game",
    rpg: "save/rpg",
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
  if (normalized.startsWith(root + "/")) {
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
  /** NPC 资源配置路径 */
  npcRes(fileName: string): string {
    return buildPath(`${ResourceDirs.ini.npcres}/${fileName}`);
  },
  /** 物体配置文件路径 */
  obj(fileName: string): string {
    return buildPath(`${ResourceDirs.ini.obj}/${fileName}`);
  },
  /** 物体资源配置路径 */
  objRes(fileName: string): string {
    return buildPath(`${ResourceDirs.ini.objres}/${fileName}`);
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
  /** INI 存档路径 */
  iniSave(fileName: string): string {
    return buildPath(`${ResourceDirs.ini.save}/${fileName}`);
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

  // --- 存档 ---
  /** 游戏存档路径 */
  saveGame(fileName: string): string {
    return buildPath(`${ResourceDirs.save.game}/${fileName}`);
  },
  /** RPG 存档路径（带存档槽） */
  saveRpg(slotIndex: number, fileName: string): string {
    return buildPath(`${ResourceDirs.save.rpg}${slotIndex}/${fileName}`);
  },
  /** 存档基础路径（根据存档槽） */
  saveBase(slotIndex: number): string {
    if (slotIndex === 0) {
      return buildPath(ResourceDirs.save.game);
    }
    return buildPath(`${ResourceDirs.save.rpg}${slotIndex}`);
  },

  // --- MPC ---
  /** MPC 资源包路径 */
  mpc(fileName: string): string {
    return buildPath(`${ResourceDirs.mpc}/${fileName}`);
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
  /** 武功经验配置 */
  get magicExp(): string {
    return ResourcePath.level("MagicExp.ini");
  },
  /** 新游戏脚本 */
  get newGameScript(): string {
    return ResourcePath.scriptCommon("NewGame.txt");
  },
  /** 对话索引文件 */
  get talkIndex(): string {
    return ResourcePath.content("TalkIndex.txt");
  },
  /** UI 设置文件 (Content) */
  get uiSettingsContent(): string {
    return ResourcePath.ui("UI_Settings.ini");
  },
  /** UI 设置文件 (INI) */
  get uiSettingsIni(): string {
    return ResourcePath.ini("UI_Settings.ini");
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
  return path.startsWith(root + "/") || path.startsWith(root);
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
