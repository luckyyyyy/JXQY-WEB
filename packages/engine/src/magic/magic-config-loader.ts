/**
 * Magic Config Loader - 从统一数据加载器获取武功配置
 *
 * 在 dataLoader 加载完成后自动构建武功缓存。
 *
 * 路径处理规则：
 * - 绝对路径（以 `/` 开头）：转换为 `/game/{gameSlug}/resources/xxx`
 * - 相对路径：保持不变（由 magicLoader 处理）
 */

import {
  getMagicsData,
  type ApiMagicData,
} from "../resource/resource-loader";
import { createConfigCache } from "../resource/cache-registry";
import { getResourceRoot } from "../resource/resource-paths";
import { createDefaultMagicData, type MagicData, MagicMoveKind, MagicSpecialKind } from "./types";

// ========== API 响应类型（从 dataLoader 复用） ==========

type ApiMagicLevel = ApiMagicData extends { levels: (infer L)[] | null } ? NonNullable<L> : never;
type ApiAttackFile = ApiMagicData extends { attackFile: infer A } ? NonNullable<A> : never;

// ========== 缓存 ==========

const MAGIC_KEY_PREFIXES = ["ini/magic/"] as const;

// ========== MoveKind 字符串到枚举映射 ==========

const MOVE_KIND_MAP: Record<string, MagicMoveKind> = {
  NoMove: MagicMoveKind.NoMove,
  FixedPosition: MagicMoveKind.FixedPosition,
  SingleMove: MagicMoveKind.SingleMove,
  LineMove: MagicMoveKind.LineMove,
  CircleMove: MagicMoveKind.CircleMove,
  HeartMove: MagicMoveKind.HeartMove,
  SpiralMove: MagicMoveKind.SpiralMove,
  SectorMove: MagicMoveKind.SectorMove,
  RandomSector: MagicMoveKind.RandomSector,
  FixedWall: MagicMoveKind.FixedWall,
  WallMove: MagicMoveKind.WallMove,
  RegionBased: MagicMoveKind.RegionBased,
  FollowCharacter: MagicMoveKind.FollowCharacter,
  SuperMode: MagicMoveKind.SuperMode,
  FollowEnemy: MagicMoveKind.FollowEnemy,
  Throw: MagicMoveKind.Throw,
  Kind19: MagicMoveKind.Kind19,
  Transport: MagicMoveKind.Transport,
  PlayerControl: MagicMoveKind.PlayerControl,
  Summon: MagicMoveKind.Summon,
  TimeStop: MagicMoveKind.TimeStop,
  VMove: MagicMoveKind.VMove,
};

const SPECIAL_KIND_MAP: Record<string, MagicSpecialKind> = {
  None: MagicSpecialKind.None,
  AddLifeOrFrozen: MagicSpecialKind.AddLifeOrFrozen,
  AddThewOrPoison: MagicSpecialKind.AddThewOrPoison,
  BuffOrPetrify: MagicSpecialKind.BuffOrPetrify,
  InvisibleHide: MagicSpecialKind.InvisibleHide,
  InvisibleShow: MagicSpecialKind.InvisibleShow,
  Buff: MagicSpecialKind.Buff,
  ChangeCharacter: MagicSpecialKind.ChangeCharacter,
  RemoveAbnormal: MagicSpecialKind.RemoveAbnormal,
  ChangeFlyIni: MagicSpecialKind.ChangeFlyIni,
};

// ========== 路径处理 ==========

/**
 * 规范化资源路径
 * - 绝对路径（以 `/` 开头）：转换为资源根目录下的路径
 * - 相对路径：保持不变
 *
 * @param path 原始路径
 * @param resourceType 资源类型（用于构建相对路径前缀）
 */
function normalizeResourcePath(
  path: string | null | undefined,
  resourceType: "effect" | "magic" | "sound" | "character"
): string | undefined {
  if (!path) return undefined;

  // 绝对路径处理
  if (path.startsWith("/")) {
    const root = getResourceRoot();
    // 已经包含资源根目录前缀，直接返回
    if (path.startsWith(`${root}/`)) {
      return path;
    }
    // 否则拼接到资源根目录（移除开头的 /）
    return `${root}/${path.slice(1)}`;
  }

  // 相对路径：添加资源类型前缀
  const prefixMap: Record<string, string> = {
    effect: "asf/effect/",
    magic: "asf/magic/",
    sound: "content/sound/",
    character: "asf/character/",
  };

  const prefix = prefixMap[resourceType] || "";
  return `${prefix}${path}`;
}

/**
 * 规范化声音路径
 */
function normalizeSoundPath(path: string | null | undefined): string | undefined {
  if (!path) return undefined;

  // 绝对路径处理
  if (path.startsWith("/")) {
    const root = getResourceRoot();
    // 已经包含资源根目录前缀，直接返回
    if (path.startsWith(`${root}/`)) {
      return path;
    }
    // 否则拼接到资源根目录（移除开头的 /）
    return `${root}/${path.slice(1)}`;
  }

  // 声音文件不需要前缀（由 audioManager 处理）
  return path;
}

// ========== 解析函数 ==========

/**
 * 解析 MoveKind 字符串为枚举
 */
function parseMoveKind(moveKind: string | undefined): MagicMoveKind {
  if (!moveKind) return MagicMoveKind.NoMove;
  return MOVE_KIND_MAP[moveKind] ?? MagicMoveKind.NoMove;
}

/**
 * 解析 SpecialKind 字符串为枚举
 */
function parseSpecialKind(specialKind: string | undefined): MagicSpecialKind {
  if (!specialKind) return MagicSpecialKind.None;
  return SPECIAL_KIND_MAP[specialKind] ?? MagicSpecialKind.None;
}

/**
 * 从 key 提取文件名（统一转小写）
 * e.g., "player-magic-银钩铁划.ini" -> "player-magic-银钩铁划.ini"
 */
function extractFileName(key: string): string {
  return key.toLowerCase();
}

/**
 * Apply common magic fields shared between main magic and attack file
 */
function applyCommonMagicFields(
  magic: MagicData,
  src: {
    name?: string | null; intro?: string | null;
    speed?: number | null; moveKind?: string | null; region?: number | null;
    specialKind?: string | null; specialKindValue?: number | null; specialKindMilliSeconds?: number | null;
    alphaBlend?: boolean | null; flyingLum?: number | null; vanishLum?: number | null;
    flyingImage?: string | null; vanishImage?: string | null;
    flyingSound?: string | null; vanishSound?: string | null;
    waitFrame?: number | null; lifeFrame?: number | null;
    passThrough?: boolean | null; passThroughWall?: boolean | null;
    attackAll?: boolean | null; vibratingScreen?: boolean | null;
    bounce?: boolean | null; bounceHurt?: number | null;
    traceEnemy?: boolean | null; traceSpeed?: number | null;
    rangeRadius?: number | null;
  },
): void {
  magic.name = src.name || "";
  magic.intro = src.intro || "";
  magic.speed = src.speed || 8;
  magic.moveKind = parseMoveKind(src.moveKind ?? undefined);
  magic.region = src.region || 0;
  magic.specialKind = parseSpecialKind(src.specialKind ?? undefined);
  magic.specialKindValue = src.specialKindValue || 0;
  magic.specialKindMilliSeconds = src.specialKindMilliSeconds || 0;
  magic.alphaBlend = src.alphaBlend ? 1 : 0;
  magic.flyingLum = src.flyingLum || 0;
  magic.vanishLum = src.vanishLum || 0;
  magic.flyingImage = normalizeResourcePath(src.flyingImage, "effect");
  magic.vanishImage = normalizeResourcePath(src.vanishImage, "effect");
  magic.flyingSound = normalizeSoundPath(src.flyingSound);
  magic.vanishSound = normalizeSoundPath(src.vanishSound);
  magic.waitFrame = src.waitFrame ?? 0;
  magic.lifeFrame = src.lifeFrame ?? 4;
  magic.passThrough = src.passThrough ? 1 : 0;
  magic.passThroughWall = src.passThroughWall ? 1 : 0;
  magic.attackAll = src.attackAll ? 1 : 0;
  magic.vibratingScreen = src.vibratingScreen ? 1 : 0;
  magic.bounce = src.bounce ? 1 : 0;
  magic.bounceHurt = src.bounceHurt || 0;
  magic.traceEnemy = src.traceEnemy ? 1 : 0;
  magic.traceSpeed = src.traceSpeed || 0;
  magic.rangeRadius = src.rangeRadius || 0;
}

/**
 * 将 API 武功数据转换为引擎 MagicData
 */
function convertApiMagicToMagicData(
  api: ApiMagicData,
  cache: Map<string, MagicData>,
  normalizeKey: (key: string) => string,
): MagicData {
  const magic = createDefaultMagicData();

  // 基础信息
  magic.fileName = extractFileName(api.key);
  applyCommonMagicFields(magic, api);

  // 图像资源（主武功特有）
  magic.image = normalizeResourcePath(api.image, "magic");
  magic.icon = normalizeResourcePath(api.icon, "magic");
  magic.superModeImage = normalizeResourcePath(api.superModeImage, "effect");

  // 动作和攻击文件
  magic.actionFile = api.actionFile || undefined;

  // AttackFile 是嵌套的武功数据
  if (api.attackFile) {
    const attackFileName = `${api.key.replace(".ini", "")}-attack.ini`;
    magic.attackFile = attackFileName;
    const attackMagic = convertAttackFileToMagicData(api.attackFile, attackFileName);
    cache.set(normalizeKey(attackFileName), attackMagic);
  }

  // 关联武功
  magic.flyMagic = api.flyMagic || undefined;
  magic.flyInterval = api.flyInterval || 0;
  magic.parasiticMagic = api.parasiticMagic || undefined;
  magic.explodeMagicFile = api.explodeMagicFile || undefined;

  // 杂项标志（主武功特有）
  magic.beginAtUser = api.beginAtUser ? 1 : 0;
  magic.beginAtMouse = api.beginAtMouse ? 1 : 0;

  // 寄生
  magic.parasitic = api.parasitic ? 1 : 0;
  magic.parasiticInterval = api.parasiticInterval || 1000;

  // 冷却
  magic.coldMilliSeconds = api.coldMilliSeconds || 0;

  // 等级数据
  if (api.levels && api.levels.length > 0) {
    const levels = new Map<number, Partial<MagicData>>();
    for (const lvl of api.levels) {
      const levelData: Partial<MagicData> = {
        effect: lvl.effect || 0,
        manaCost: lvl.manaCost || 0,
        levelupExp: lvl.levelupExp ?? 0,
      };
      if (lvl.speed !== undefined) {
        levelData.speed = lvl.speed;
      }
      if (lvl.moveKind !== undefined) {
        levelData.moveKind = parseMoveKind(lvl.moveKind);
      }
      if (lvl.lifeFrame !== undefined) {
        levelData.lifeFrame = lvl.lifeFrame;
      }
      levels.set(lvl.level, levelData);
    }
    magic.levels = levels;

    // 从第一级获取默认值
    const level1 = api.levels.find((l) => l.level === 1);
    if (level1) {
      magic.effect = level1.effect || 0;
      magic.manaCost = level1.manaCost || 0;
      magic.levelupExp = level1.levelupExp ?? 0;
    }
  }

  return magic;
}

/**
 * 将嵌套的 AttackFile 转换为 MagicData
 */
function convertAttackFileToMagicData(attack: ApiAttackFile, fileName: string): MagicData {
  const magic = createDefaultMagicData();
  magic.fileName = fileName;
  applyCommonMagicFields(magic, attack);
  return magic;
}



// ========== 缓存（使用通用 CacheRegistry） ==========

type MagicApiData = NonNullable<ReturnType<typeof getMagicsData>>;

const magicCacheStore = createConfigCache<MagicApiData, MagicData>({
  name: "MagicConfig",
  keyPrefixes: MAGIC_KEY_PREFIXES,
  getData: getMagicsData,
  build(data, cache, normalizeKey) {
    // 处理玩家武功
    for (const api of data.player) {
      const magic = convertApiMagicToMagicData(api, cache, normalizeKey);
      cache.set(normalizeKey(api.key), magic);
    }
    // 处理 NPC 武功
    for (const api of data.npc) {
      const magic = convertApiMagicToMagicData(api, cache, normalizeKey);
      cache.set(normalizeKey(api.key), magic);
    }
  },
});

// ========== 公共 API ==========

/** 从缓存获取武功配置 */
export function getMagicFromApiCache(fileName: string): MagicData | null {
  const cached = magicCacheStore.get(fileName);
  // 返回副本，避免外部修改影响缓存
  return cached ? { ...cached } : null;
}

export function isMagicApiLoaded(): boolean {
  return magicCacheStore.isLoaded();
}

export function getAllCachedMagicFileNames(): string[] {
  return magicCacheStore.allKeys();
}
