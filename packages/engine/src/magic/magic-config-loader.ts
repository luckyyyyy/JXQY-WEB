/**
 * Magic Config Loader - 从统一数据加载器获取武功配置
 *
 * 在 dataLoader 加载完成后自动构建武功缓存。
 *
 * 路径处理规则：
 * - 绝对路径（以 `/` 开头）：转换为 `/game/{gameSlug}/resources/xxx`
 * - 相对路径：保持不变（由 magicLoader 处理）
 */

import type { AttackFile, Magic } from "@miu2d/types";
import { logger } from "../core/logger";
import { getMagicsData } from "../data/game-data-api";
import { createConfigCache } from "../resource/cache-registry";
import { getResourceRoot, ResourceDirs } from "../resource/resource-paths";
import type { MagicRenderer } from "./magic-renderer";
import { createDefaultMagicData, type MagicData, MagicMoveKind, MagicSpecialKind } from "./types";

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

  // 相对路径：添加资源类型前缀（使用 ResourceDirs 常量 + 尾斜杠）
  const prefixMap: Record<string, string> = {
    effect: `${ResourceDirs.asf.effect}/`,
    magic: `${ResourceDirs.asf.magic}/`,
    sound: `${ResourceDirs.content.sound}/`,
    character: `${ResourceDirs.asf.character}/`,
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
 * Apply common magic fields shared between main magic and attack file.
 * AttackFile 和 Magic 共享 MagicBaseSchema 中的所有字段。
 */
function applyCommonMagicFields(magic: MagicData, src: Partial<Record<string, unknown>>): void {
  const s = src as Record<string, number | string | null | undefined>;

  // 基础信息
  magic.name = String(s.name || "");
  magic.intro = String(s.intro || "");
  magic.speed = Number(s.speed) || 8;
  magic.moveKind = parseMoveKind(s.moveKind as string | undefined);
  magic.region = Number(s.region) || 0;
  magic.specialKind = parseSpecialKind(s.specialKind as string | undefined);
  magic.specialKindValue = Number(s.specialKindValue) || 0;
  magic.specialKindMilliSeconds = Number(s.specialKindMilliSeconds) || 0;
  magic.noSpecialKindEffect = Number(s.noSpecialKindEffect) || 0;
  magic.alphaBlend = Number(s.alphaBlend) || 0;
  magic.flyingLum = Number(s.flyingLum) || 0;
  magic.vanishLum = Number(s.vanishLum) || 0;

  // 图像/声音资源
  magic.flyingImage = normalizeResourcePath(s.flyingImage as string | null, "effect");
  magic.vanishImage = normalizeResourcePath(s.vanishImage as string | null, "effect");
  magic.flyingSound = normalizeSoundPath(s.flyingSound as string | null);
  magic.vanishSound = normalizeSoundPath(s.vanishSound as string | null);

  // 帧
  magic.waitFrame = Number(s.waitFrame) || 0;
  magic.lifeFrame = s.lifeFrame != null ? Number(s.lifeFrame) : 4;

  // 穿透
  magic.passThrough = Number(s.passThrough) || 0;
  magic.passThroughWall = Number(s.passThroughWall) || 0;
  magic.passThroughWithDestroyEffect = Number(s.passThroughWithDestroyEffect) || 0;
  magic.solid = Number(s.solid) || 0;
  magic.bodyRadius = Number(s.bodyRadius) || 0;

  // 追踪
  magic.traceEnemy = Number(s.traceEnemy) || 0;
  magic.traceSpeed = Number(s.traceSpeed) || 0;
  magic.traceEnemyDelayMilliseconds = Number(s.traceEnemyDelayMilliseconds) || 0;

  // 范围
  magic.rangeRadius = Number(s.rangeRadius) || 0;
  magic.attackAll = Number(s.attackAll) || 0;
  magic.rangeEffect = Number(s.rangeEffect) || 0;
  magic.rangeAddLife = Number(s.rangeAddLife) || 0;
  magic.rangeAddMana = Number(s.rangeAddMana) || 0;
  magic.rangeAddThew = Number(s.rangeAddThew) || 0;
  magic.rangeSpeedUp = Number(s.rangeSpeedUp) || 0;
  magic.rangeFreeze = Number(s.rangeFreeze) || 0;
  magic.rangePoison = Number(s.rangePoison) || 0;
  magic.rangePetrify = Number(s.rangePetrify) || 0;
  magic.rangeDamage = Number(s.rangeDamage) || 0;
  magic.rangeTimeInterval = Number(s.rangeTimeInterval) || 0;

  // 弹跳
  magic.bounce = Number(s.bounce) || 0;
  magic.bounceHurt = Number(s.bounceHurt) || 0;
  magic.ball = Number(s.ball) || 0;
  magic.bounceFly = Number(s.bounceFly) || 0;
  magic.bounceFlySpeed = Number(s.bounceFlySpeed) || 0;
  magic.bounceFlyEndHurt = Number(s.bounceFlyEndHurt) || 0;
  magic.bounceFlyTouchHurt = Number(s.bounceFlyTouchHurt) || 0;
  magic.bounceFlyEndMagic = s.bounceFlyEndMagic as string | undefined;
  magic.magicDirectionWhenBounceFlyEnd = Number(s.magicDirectionWhenBounceFlyEnd) || 0;
  magic.sticky = Number(s.sticky) || 0;

  // 震屏
  magic.vibratingScreen = Number(s.vibratingScreen) || 0;

  // 爆炸/打断
  magic.noExplodeWhenLifeFrameEnd = Number(s.noExplodeWhenLifeFrameEnd) || 0;
  magic.explodeWhenLifeFrameEnd = Number(s.explodeWhenLifeFrameEnd) || 0;
  magic.noInterruption = Number(s.noInterruption) || 0;
  magic.discardOppositeMagic = Number(s.discardOppositeMagic) || 0;
  magic.exchangeUser = Number(s.exchangeUser) || 0;

  // 移动
  magic.randomMoveDegree = Number(s.randomMoveDegree) || 0;
  magic.followMouse = Number(s.followMouse) || 0;
  magic.meteorMove = Number(s.meteorMove) || 0;
  magic.meteorMoveDir = Number(s.meteorMoveDir) || 0;
  magic.moveBack = Number(s.moveBack) || 0;
  magic.moveImitateUser = Number(s.moveImitateUser) || 0;

  // 圆周运动
  magic.circleMoveClockwise = Number(s.circleMoveClockwise) || 0;
  magic.circleMoveAnticlockwise = Number(s.circleMoveAnticlockwise) || 0;
  magic.roundMoveClockwise = Number(s.roundMoveClockwise) || 0;
  magic.roundMoveAnticlockwise = Number(s.roundMoveAnticlockwise) || 0;
  magic.roundMoveCount = Number(s.roundMoveCount) || 0;
  magic.roundMoveDegreeSpeed = Number(s.roundMoveDegreeSpeed) || 0;
  magic.roundRadius = Number(s.roundRadius) || 0;

  // 携带使用者
  magic.carryUser = Number(s.carryUser) || 0;
  magic.carryUserSpriteIndex = Number(s.carryUserSpriteIndex) || 0;
  magic.hideUserWhenCarry = Number(s.hideUserWhenCarry) || 0;

  // Buff/Debuff
  magic.attackAddPercent = Number(s.attackAddPercent) || 0;
  magic.defendAddPercent = Number(s.defendAddPercent) || 0;
  magic.evadeAddPercent = Number(s.evadeAddPercent) || 0;
  magic.speedAddPercent = Number(s.speedAddPercent) || 0;
  magic.morphMilliseconds = Number(s.morphMilliseconds) || 0;
  magic.weakMilliseconds = Number(s.weakMilliseconds) || 0;
  magic.weakAttackPercent = Number(s.weakAttackPercent) || 0;
  magic.weakDefendPercent = Number(s.weakDefendPercent) || 0;
  magic.blindMilliseconds = Number(s.blindMilliseconds) || 0;

  // 禁用/限制
  magic.disableUse = Number(s.disableUse) || 0;
  magic.lifeFullToUse = Number(s.lifeFullToUse) || 0;
  magic.disableMoveMilliseconds = Number(s.disableMoveMilliseconds) || 0;
  magic.disableSkillMilliseconds = Number(s.disableSkillMilliseconds) || 0;

  // 副作用/恢复
  magic.sideEffectProbability = Number(s.sideEffectProbability) || 0;
  magic.sideEffectPercent = Number(s.sideEffectPercent) || 0;
  magic.sideEffectType = Number(s.sideEffectType) || 0;
  magic.restoreProbability = Number(s.restoreProbability) || 0;
  magic.restorePercent = Number(s.restorePercent) || 0;
  magic.restoreType = Number(s.restoreType) || 0;
  magic.dieAfterUse = Number(s.dieAfterUse) || 0;

  // 基础属性加成
  magic.lifeMax = Number(s.lifeMax) || 0;
  magic.thewMax = Number(s.thewMax) || 0;
  magic.manaMax = Number(s.manaMax) || 0;
  magic.attack = Number(s.attack) || 0;
  magic.attack2 = Number(s.attack2) || 0;
  magic.attack3 = Number(s.attack3) || 0;
  magic.defend = Number(s.defend) || 0;
  magic.defend2 = Number(s.defend2) || 0;
  magic.defend3 = Number(s.defend3) || 0;
  magic.evade = Number(s.evade) || 0;

  // 恢复加成
  magic.addLifeRestorePercent = Number(s.addLifeRestorePercent) || 0;
  magic.addManaRestorePercent = Number(s.addManaRestorePercent) || 0;
  magic.addThewRestorePercent = Number(s.addThewRestorePercent) || 0;

  // 跳跃
  magic.leapTimes = Number(s.leapTimes) || 0;
  magic.leapFrame = Number(s.leapFrame) || 0;
  magic.effectReducePercentage = Number(s.effectReducePercentage) || 0;
  magic.leapImage = normalizeResourcePath(s.leapImage as string | null, "effect");
  magic.jumpToTarget = Number(s.jumpToTarget) || 0;
  magic.jumpMoveSpeed = Number(s.jumpMoveSpeed) || 0;

  // 复活尸体
  magic.reviveBodyRadius = Number(s.reviveBodyRadius) || 0;
  magic.reviveBodyMaxCount = Number(s.reviveBodyMaxCount) || 0;
  magic.reviveBodyLifeMilliSeconds = Number(s.reviveBodyLifeMilliSeconds) || 0;

  // 连击
  magic.hitCountToChangeMagic = Number(s.hitCountToChangeMagic) || 0;
  magic.hitCountFlyRadius = Number(s.hitCountFlyRadius) || 0;
  magic.hitCountFlyAngleSpeed = Number(s.hitCountFlyAngleSpeed) || 0;
  magic.hitCountFlyingImage = normalizeResourcePath(
    s.hitCountFlyingImage as string | null,
    "effect"
  );
  magic.hitCountVanishImage = normalizeResourcePath(
    s.hitCountVanishImage as string | null,
    "effect"
  );
}

/**
 * 将 API 武功数据转换为引擎 MagicData
 */
function convertApiMagicToMagicData(
  api: Magic,
  cache: Map<string, MagicData>,
  normalizeKey: (key: string) => string
): MagicData {
  const magic = createDefaultMagicData();

  // 基础信息
  magic.fileName = extractFileName(api.key);
  applyCommonMagicFields(magic, api);

  // 图像资源（主武功特有）
  magic.image = normalizeResourcePath(api.image, "magic");
  magic.icon = normalizeResourcePath(api.icon, "magic");
  magic.superModeImage = normalizeResourcePath(api.superModeImage, "effect");
  magic.useActionFile = api.useActionFile || undefined;

  // 动作和攻击文件
  magic.actionFile = api.actionFile || undefined;

  // AttackFile 是嵌套的武功数据
  if (api.attackFile) {
    const attackFileName = `${api.key.replace(".ini", "")}-attack.ini`;
    magic.attackFile = attackFileName;
    const attackMagic = convertAttackFileToMagicData(api.attackFile, attackFileName);
    cache.set(normalizeKey(attackFileName), attackMagic);
  }

  // 效果值/消耗（主武功特有）
  magic.effect = api.effect || 0;
  magic.effect2 = api.effect2 || 0;
  magic.effect3 = api.effect3 || 0;
  magic.effectExt = api.effectExt || 0;
  magic.effectMana = api.effectMana || 0;
  magic.manaCost = api.manaCost || 0;
  magic.thewCost = api.thewCost || 0;
  magic.lifeCost = api.lifeCost || 0;

  // 升级/等级
  magic.levelupExp = api.levelupExp || 0;
  magic.effectLevel = api.effectLevel || 0;
  magic.maxLevel = api.maxLevel || 0;
  magic.count = api.count || 0;
  magic.maxCount = api.maxCount || 0;

  // 冷却/时间
  magic.coldMilliSeconds = api.coldMilliSeconds || 0;
  magic.keepMilliseconds = api.keepMilliseconds || 0;
  magic.changeToFriendMilliseconds = api.changeToFriendMilliseconds || 0;

  // 起始位置（主武功特有）
  magic.beginAtUser = api.beginAtUser || 0;
  magic.beginAtMouse = api.beginAtMouse || 0;
  magic.beginAtUserAddDirectionOffset = api.beginAtUserAddDirectionOffset || 0;
  magic.beginAtUserAddUserDirectionOffset = api.beginAtUserAddUserDirectionOffset || 0;

  // 寄生
  magic.parasitic = api.parasitic || 0;
  magic.parasiticMagic = api.parasiticMagic || undefined;
  magic.parasiticInterval = api.parasiticInterval || 1000;
  magic.parasiticMaxEffect = api.parasiticMaxEffect || 0;

  // 关联武功
  magic.flyMagic = api.flyMagic || undefined;
  magic.flyInterval = api.flyInterval || 0;
  magic.flyIni = api.flyIni || undefined;
  magic.flyIni2 = api.flyIni2 || undefined;
  magic.explodeMagicFile = api.explodeMagicFile || undefined;
  magic.randMagicFile = api.randMagicFile || undefined;
  magic.randMagicProbability = api.randMagicProbability || 0;
  magic.secondMagicFile = api.secondMagicFile || undefined;
  magic.secondMagicDelay = api.secondMagicDelay || 0;
  magic.magicToUseWhenKillEnemy = api.magicToUseWhenKillEnemy || undefined;
  magic.magicDirectionWhenKillEnemy = api.magicDirectionWhenKillEnemy || 0;
  magic.changeMagic = api.changeMagic || undefined;
  magic.jumpEndMagic = api.jumpEndMagic || undefined;
  magic.magicToUseWhenBeAttacked = api.magicToUseWhenBeAttacked || undefined;
  magic.magicDirectionWhenBeAttacked = api.magicDirectionWhenBeAttacked || 0;
  magic.magicWhenNewPos = api.magicWhenNewPos || undefined;
  magic.replaceMagic = api.replaceMagic || undefined;
  magic.specialKind9ReplaceFlyIni = api.specialKind9ReplaceFlyIni || undefined;
  magic.specialKind9ReplaceFlyIni2 = api.specialKind9ReplaceFlyIni2 || undefined;
  magic.regionFile = api.regionFile || undefined;
  magic.goodsName = api.goodsName || undefined;
  magic.type = api.type || undefined;

  // NPC
  magic.npcFile = api.npcFile || undefined;
  magic.npcIni = api.npcIni || undefined;

  // 从属
  magic.belong = api.belong != null ? Number(api.belong) || 0 : 0;

  // 等级数据
  if (api.levels && api.levels.length > 0) {
    const levels = new Map<number, Partial<MagicData>>();
    for (const lvl of api.levels) {
      const levelData: Partial<MagicData> = {
        effect: lvl.effect || 0,
        manaCost: lvl.manaCost || 0,
        levelupExp: lvl.levelupExp ?? 0,
      };
      if (lvl.speed !== undefined && lvl.speed !== null) {
        levelData.speed = lvl.speed;
      }
      if (lvl.moveKind !== undefined && lvl.moveKind !== null) {
        levelData.moveKind = parseMoveKind(lvl.moveKind);
      }
      if (lvl.lifeFrame !== undefined && lvl.lifeFrame !== null) {
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
function convertAttackFileToMagicData(attack: AttackFile, fileName: string): MagicData {
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

// ============= Magic Loader API (merged from magic-loader.ts) =============

// 模块级渲染器引用，由 MagicManager 构造时设置
let _magicRenderer: MagicRenderer | null = null;

/**
 * 初始化 magicLoader 模块（由 MagicManager 构造时调用）
 */
export function initMagicLoader(renderer: MagicRenderer): void {
  _magicRenderer = renderer;
}

function getRenderer(): MagicRenderer {
  if (!_magicRenderer) {
    throw new Error("[MagicLoader] MagicRenderer not initialized. Call initMagicLoader() first.");
  }
  return _magicRenderer;
}

/**
 * 获取指定等级的武功数据
 *
 * C# 参考：Magic.EffectLevel = _effectLevel > 0 ? _effectLevel : CurrentLevel
 * CurrentLevel 是武功自身的等级（1-10），不是角色的等级。
 * 当请求的等级超过武功最大等级时，回退到最高可用等级。
 */
export function getMagicAtLevel(baseMagic: MagicData, level: number): MagicData {
  if (!baseMagic.levels || baseMagic.levels.size === 0) {
    const copy = { ...baseMagic };
    copy.currentLevel = level;
    copy.effectLevel = level;
    return copy;
  }

  let effectiveLevel = level;
  if (!baseMagic.levels.has(level)) {
    let maxLevel = 0;
    for (const key of baseMagic.levels.keys()) {
      if (key > maxLevel) maxLevel = key;
    }
    effectiveLevel = maxLevel > 0 ? maxLevel : 1;
  }

  const levelData = baseMagic.levels.get(effectiveLevel);
  if (!levelData) {
    const copy = { ...baseMagic };
    copy.currentLevel = effectiveLevel;
    copy.effectLevel = effectiveLevel;
    return copy;
  }

  const merged: MagicData = {
    ...baseMagic,
    ...levelData,
    currentLevel: effectiveLevel,
    effectLevel: effectiveLevel,
    levels: baseMagic.levels,
  };

  return merged;
}

/**
 * 同步获取武功（直接从 API 缓存读取）
 * 战斗中调用，返回完整数据（包含所有等级）
 */
export function getMagic(fileName: string): MagicData | null {
  if (!isMagicApiLoaded()) {
    logger.error(`[MagicLoader] Game data not loaded! Call loadGameData() first.`);
    return null;
  }
  return getMagicFromApiCache(fileName);
}

/**
 * 按文件名解析武功配置，可选应用等级覆盖
 * 合并了 getMagic() + getMagicAtLevel() 的常用模式，消除重复的查找+警告样板代码
 *
 * @param fileName 武功配置文件名
 * @param level 可选等级，传入则应用 getMagicAtLevel
 * @returns 解析后的 MagicData，找不到返回 null（已打印警告）
 */
export function resolveMagic(fileName: string, level?: number): MagicData | null {
  const base = getMagic(fileName);
  if (!base) {
    logger.warn(`[Magic] Config not found: ${fileName}`);
    return null;
  }
  return level != null ? getMagicAtLevel(base, level) : base;
}

/**
 * 预加载武功的 ASF 资源（飞行动画、消失动画等）
 */
export async function preloadMagicAsf(magic: MagicData): Promise<void> {
  const promises: Promise<unknown>[] = [];
  if (magic.flyingImage) {
    promises.push(getRenderer().getAsf(magic.flyingImage));
  }
  if (magic.vanishImage) {
    promises.push(getRenderer().getAsf(magic.vanishImage));
  }
  if (magic.superModeImage) {
    promises.push(getRenderer().getAsf(magic.superModeImage));
  }
  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

/**
 * 批量预加载武功 ASF 资源
 */
export async function preloadMagics(
  fileNames: string[],
  preloadAsf = false
): Promise<Map<string, MagicData>> {
  const results = new Map<string, MagicData>();
  const promises: Promise<void>[] = [];

  for (const fileName of fileNames) {
    const magic = getMagic(fileName);
    if (magic) {
      results.set(fileName, magic);
      if (preloadAsf) {
        promises.push(preloadMagicAsf(magic));
      }
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }

  return results;
}
