/**
 * Magic Loader - based on JxqyHD Engine/Magic.cs
 * 加载和解析武功配置文件
 */

import { logger } from "../core/logger";
import { resourceLoader } from "../resource/resourceLoader";
import { ResourcePath } from "@/config/resourcePaths";
import {
  createDefaultMagicData,
  type MagicData,
  MagicMoveKind,
  MagicSpecialKind,
  RestorePropertyType,
  SideEffectDamageType,
} from "./types";

/**
 * 解析武功配置文件内容
 * 对应 C# Magic.Load()
 */
export function parseMagicIni(content: string, fileName: string): MagicData {
  const magic = createDefaultMagicData();
  magic.fileName = fileName;

  const lines = content.split(/\r?\n/);
  let currentSection = "Init";
  const levels = new Map<number, Partial<MagicData>>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("#")) {
      continue;
    }

    // 检查节标题
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    // 解析键值对
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();

    if (currentSection === "Init") {
      assignMagicValue(magic, key, value);
    } else if (currentSection.startsWith("Level")) {
      const levelMatch = currentSection.match(/^Level(\d+)$/);
      if (levelMatch) {
        const levelNum = parseInt(levelMatch[1], 10);
        if (!levels.has(levelNum)) {
          levels.set(levelNum, {});
        }
        const levelData = levels.get(levelNum)!;
        assignLevelValue(levelData, key, value);
      }
    }
  }

  // 存储等级数据
  if (levels.size > 0) {
    magic.levels = levels;
  }

  return magic;
}

/**
 * 为武功数据赋值
 * 对应 C# Magic.AssignToValue()
 */
function assignMagicValue(magic: MagicData, key: string, value: string): void {
  try {
    switch (key) {
      // 字符串属性
      case "Name":
        magic.name = value;
        break;
      case "Intro":
        magic.intro = value;
        break;
      case "Type":
        magic.type = value;
        break;
      case "ActionFile":
        magic.actionFile = value;
        break;
      case "NpcFile":
        magic.npcFile = value;
        break;
      case "FlyIni":
        magic.flyIni = value;
        break;
      case "FlyIni2":
        magic.flyIni2 = value;
        break;
      case "MagicToUseWhenBeAttacked":
        magic.magicToUseWhenBeAttacked = value;
        break;
      case "MagicWhenNewPos":
        magic.magicWhenNewPos = value;
        break;
      case "ReplaceMagic":
        magic.replaceMagic = value;
        break;
      case "SpecialKind9ReplaceFlyIni":
        magic.specialKind9ReplaceFlyIni = value;
        break;
      case "SpecialKind9ReplaceFlyIni2":
        magic.specialKind9ReplaceFlyIni2 = value;
        break;

      // 图像资源 - 存储相对路径（如果值为空则不设置）
      case "Image":
        if (value) magic.image = `asf/magic/${value}`;
        break;
      case "Icon":
        if (value) magic.icon = `asf/magic/${value}`;
        break;
      case "FlyingImage":
        if (value) magic.flyingImage = `asf/effect/${value}`;
        break;
      case "VanishImage":
        if (value) magic.vanishImage = `asf/effect/${value}`;
        break;
      case "SuperModeImage":
        if (value) magic.superModeImage = `asf/effect/${value}`;
        break;
      case "LeapImage":
        if (value) magic.leapImage = `asf/effect/${value}`;
        break;
      case "UseActionFile":
        if (value) magic.useActionFile = `asf/character/${value}`;
        break;
      case "HitCountFlyingImage":
        if (value) magic.hitCountFlyingImage = `asf/effect/${value}`;
        break;
      case "HitCountVanishImage":
        if (value) magic.hitCountVanishImage = `asf/effect/${value}`;
        break;

      // 声音资源
      case "FlyingSound":
        magic.flyingSound = value;
        break;
      case "VanishSound":
        magic.vanishSound = value;
        break;

      // 关联武功文件
      case "AttackFile":
        magic.attackFile = value;
        break;
      case "ExplodeMagicFile":
        magic.explodeMagicFile = value;
        break;
      case "RandMagicFile":
        magic.randMagicFile = value;
        break;
      case "FlyMagic":
        magic.flyMagic = value;
        break;
      case "ParasiticMagic":
        magic.parasiticMagic = value;
        break;
      case "SecondMagicFile":
        magic.secondMagicFile = value;
        break;
      case "JumpEndMagic":
        magic.jumpEndMagic = value;
        break;
      case "MagicToUseWhenKillEnemy":
        magic.magicToUseWhenKillEnemy = value;
        break;
      case "BounceFlyEndMagic":
        magic.bounceFlyEndMagic = value;
        break;
      case "ChangeMagic":
        magic.changeMagic = value;
        break;
      case "RegionFile":
        magic.regionFile = value;
        break;
      case "GoodsName":
        magic.goodsName = value;
        break;
      case "NpcIni":
        magic.npcIni = value;
        break;

      // 数值属性
      case "Speed":
        magic.speed = parseInt(value, 10) || 8;
        break;
      case "MoveKind":
        magic.moveKind = parseInt(value, 10) || MagicMoveKind.NoMove;
        break;
      case "Region":
        magic.region = parseInt(value, 10) || 0;
        break;
      case "SpecialKind":
        magic.specialKind = parseInt(value, 10) || MagicSpecialKind.None;
        break;
      case "SpecialKindValue":
        magic.specialKindValue = parseInt(value, 10) || 0;
        break;
      case "SpecialKindMilliSeconds":
        magic.specialKindMilliSeconds = parseInt(value, 10) || 0;
        break;
      case "NoSpecialKindEffect":
        magic.noSpecialKindEffect = parseInt(value, 10) || 0;
        break;
      case "AlphaBlend":
        magic.alphaBlend = parseInt(value, 10) || 0;
        break;
      case "FlyingLum":
        magic.flyingLum = parseInt(value, 10) || 0;
        break;
      case "VanishLum":
        magic.vanishLum = parseInt(value, 10) || 0;
        break;
      case "WaitFrame":
        magic.waitFrame = parseInt(value, 10) || 0;
        break;
      case "LifeFrame":
        magic.lifeFrame = value === "" ? 4 : parseInt(value, 10);
        break;
      case "Belong":
        magic.belong = parseInt(value, 10) || 0;
        break;
      case "Effect":
        magic.effect = parseInt(value, 10) || 0;
        break;
      case "Effect2":
        magic.effect2 = parseInt(value, 10) || 0;
        break;
      case "Effect3":
        magic.effect3 = parseInt(value, 10) || 0;
        break;
      case "EffectExt":
        magic.effectExt = parseInt(value, 10) || 0;
        break;
      case "EffectMana":
        magic.effectMana = parseInt(value, 10) || 0;
        break;
      case "ManaCost":
        magic.manaCost = parseInt(value, 10) || 0;
        break;
      case "ThewCost":
        magic.thewCost = parseInt(value, 10) || 0;
        break;
      case "LifeCost":
        magic.lifeCost = parseInt(value, 10) || 0;
        break;
      case "LevelupExp":
        magic.levelupExp = parseInt(value, 10) || 0;
        break;
      case "ColdMilliSeconds":
        magic.coldMilliSeconds = parseInt(value, 10) || 0;
        break;
      case "KeepMilliseconds":
        magic.keepMilliseconds = parseInt(value, 10) || 0;
        break;
      case "ChangeToFriendMilliseconds":
        magic.changeToFriendMilliseconds = parseInt(value, 10) || 0;
        break;
      case "Count":
        magic.count = parseInt(value, 10) || 1;
        break;
      case "MaxCount":
        magic.maxCount = parseInt(value, 10) || 0;
        break;
      case "MaxLevel":
        magic.maxLevel = parseInt(value, 10) || 10;
        break;
      case "PassThrough":
        magic.passThrough = parseInt(value, 10) || 0;
        break;
      case "PassThroughWithDestroyEffect":
        magic.passThroughWithDestroyEffect = parseInt(value, 10) || 0;
        break;
      case "PassThroughWall":
        magic.passThroughWall = parseInt(value, 10) || 0;
        break;
      case "AttackAll":
        magic.attackAll = parseInt(value, 10) || 0;
        break;
      case "NoInterruption":
        magic.noInterruption = parseInt(value, 10) || 0;
        break;
      case "VibratingScreen":
        magic.vibratingScreen = parseInt(value, 10) || 0;
        break;
      case "BodyRadius":
        magic.bodyRadius = parseInt(value, 10) || 0;
        break;
      case "Solid":
        magic.solid = parseInt(value, 10) || 0;
        break;
      case "NoExplodeWhenLifeFrameEnd":
        magic.noExplodeWhenLifeFrameEnd = parseInt(value, 10) || 0;
        break;
      case "ExplodeWhenLifeFrameEnd":
        magic.explodeWhenLifeFrameEnd = parseInt(value, 10) || 0;
        break;
      case "DiscardOppositeMagic":
        magic.discardOppositeMagic = parseInt(value, 10) || 0;
        break;
      case "ExchangeUser":
        magic.exchangeUser = parseInt(value, 10) || 0;
        break;
      case "BeginAtMouse":
        magic.beginAtMouse = parseInt(value, 10) || 0;
        break;
      case "BeginAtUser":
        magic.beginAtUser = parseInt(value, 10) || 0;
        break;
      case "BeginAtUserAddDirectionOffset":
        magic.beginAtUserAddDirectionOffset = parseInt(value, 10) || 0;
        break;
      case "BeginAtUserAddUserDirectionOffset":
        magic.beginAtUserAddUserDirectionOffset = parseInt(value, 10) || 0;
        break;
      case "RandomMoveDegree":
        magic.randomMoveDegree = parseInt(value, 10) || 0;
        break;
      case "FollowMouse":
        magic.followMouse = parseInt(value, 10) || 0;
        break;
      case "MeteorMove":
        magic.meteorMove = parseInt(value, 10) || 0;
        break;
      case "MeteorMoveDir":
        magic.meteorMoveDir = parseInt(value, 10) || 5;
        break;
      case "MoveBack":
        magic.moveBack = parseInt(value, 10) || 0;
        break;
      case "MoveImitateUser":
        magic.moveImitateUser = parseInt(value, 10) || 0;
        break;
      case "CircleMoveColockwise":
        magic.circleMoveClockwise = parseInt(value, 10) || 0;
        break;
      case "CircleMoveAnticlockwise":
        magic.circleMoveAnticlockwise = parseInt(value, 10) || 0;
        break;
      case "RoundMoveColockwise":
        magic.roundMoveClockwise = parseInt(value, 10) || 0;
        break;
      case "RoundMoveAnticlockwise":
        magic.roundMoveAnticlockwise = parseInt(value, 10) || 0;
        break;
      case "RoundMoveCount":
        magic.roundMoveCount = parseInt(value, 10) || 1;
        break;
      case "RoundMoveDegreeSpeed":
        magic.roundMoveDegreeSpeed = parseInt(value, 10) || 1;
        break;
      case "RoundRadius":
        magic.roundRadius = parseInt(value, 10) || 1;
        break;
      case "CarryUser":
        magic.carryUser = parseInt(value, 10) || 0;
        break;
      case "CarryUserSpriteIndex":
        magic.carryUserSpriteIndex = parseInt(value, 10) || 0;
        break;
      case "HideUserWhenCarry":
        magic.hideUserWhenCarry = parseInt(value, 10) || 0;
        break;
      case "Bounce":
        magic.bounce = parseInt(value, 10) || 0;
        break;
      case "BounceHurt":
        magic.bounceHurt = parseInt(value, 10) || 0;
        break;
      case "Ball":
        magic.ball = parseInt(value, 10) || 0;
        break;
      case "BounceFly":
        magic.bounceFly = parseInt(value, 10) || 0;
        break;
      case "BounceFlySpeed":
        magic.bounceFlySpeed = parseInt(value, 10) || 32;
        break;
      case "BounceFlyEndHurt":
        magic.bounceFlyEndHurt = parseInt(value, 10) || 0;
        break;
      case "BounceFlyTouchHurt":
        magic.bounceFlyTouchHurt = parseInt(value, 10) || 0;
        break;
      case "MagicDirectionWhenBounceFlyEnd":
        magic.magicDirectionWhenBounceFlyEnd = parseInt(value, 10) || 0;
        break;
      case "Sticky":
        magic.sticky = parseInt(value, 10) || 0;
        break;
      case "TraceEnemy":
        magic.traceEnemy = parseInt(value, 10) || 0;
        break;
      case "TraceSpeed":
        magic.traceSpeed = parseInt(value, 10) || 0;
        break;
      case "TraceEnemyDelayMilliseconds":
        magic.traceEnemyDelayMilliseconds = parseInt(value, 10) || 0;
        break;
      case "DisableUse":
        magic.disableUse = parseInt(value, 10) || 0;
        break;
      case "LifeFullToUse":
        magic.lifeFullToUse = parseInt(value, 10) || 0;
        break;
      case "DisableMoveMilliseconds":
        magic.disableMoveMilliseconds = parseInt(value, 10) || 0;
        break;
      case "DisableSkillMilliseconds":
        magic.disableSkillMilliseconds = parseInt(value, 10) || 0;
        break;
      case "RangeEffect":
        magic.rangeEffect = parseInt(value, 10) || 0;
        break;
      case "RangeAddLife":
        magic.rangeAddLife = parseInt(value, 10) || 0;
        break;
      case "RangeAddMana":
        magic.rangeAddMana = parseInt(value, 10) || 0;
        break;
      case "RangeAddThew":
        magic.rangeAddThew = parseInt(value, 10) || 0;
        break;
      case "RangeSpeedUp":
        magic.rangeSpeedUp = parseInt(value, 10) || 0;
        break;
      case "RangeFreeze":
        magic.rangeFreeze = parseInt(value, 10) || 0;
        break;
      case "RangePoison":
        magic.rangePoison = parseInt(value, 10) || 0;
        break;
      case "RangePetrify":
        magic.rangePetrify = parseInt(value, 10) || 0;
        break;
      case "RangeDamage":
        magic.rangeDamage = parseInt(value, 10) || 0;
        break;
      case "RangeRadius":
        magic.rangeRadius = parseInt(value, 10) || 0;
        break;
      case "RangeTimeInerval":
        magic.rangeTimeInterval = parseInt(value, 10) || 0;
        break;
      case "LeapTimes":
        magic.leapTimes = parseInt(value, 10) || 0;
        break;
      case "LeapFrame":
        magic.leapFrame = parseInt(value, 10) || 0;
        break;
      case "EffectReducePercentage":
        magic.effectReducePercentage = parseInt(value, 10) || 0;
        break;
      case "SideEffectProbability":
        magic.sideEffectProbability = Math.min(100, Math.max(0, parseInt(value, 10) || 0));
        break;
      case "SideEffectPercent":
        magic.sideEffectPercent = parseInt(value, 10) || 0;
        break;
      case "SideEffectType":
        magic.sideEffectType = parseInt(value, 10) || SideEffectDamageType.Life;
        break;
      case "RestoreProbability":
        magic.restoreProbability = Math.min(100, Math.max(0, parseInt(value, 10) || 0));
        break;
      case "RestorePercent":
        magic.restorePercent = parseInt(value, 10) || 0;
        break;
      case "RestoreType":
        magic.restoreType = parseInt(value, 10) || RestorePropertyType.Life;
        break;
      case "DieAfterUse":
        magic.dieAfterUse = parseInt(value, 10) || 0;
        break;
      case "Parasitic":
        magic.parasitic = parseInt(value, 10) || 0;
        break;
      case "ParasiticInterval":
        magic.parasiticInterval = parseInt(value, 10) || 1000;
        break;
      case "ParasiticMaxEffect":
        magic.parasiticMaxEffect = parseInt(value, 10) || 0;
        break;
      case "RandMagicProbability":
        magic.randMagicProbability = parseInt(value, 10) || 0;
        break;
      case "FlyInterval":
        magic.flyInterval = parseInt(value, 10) || 0;
        break;
      case "SecondMagicDelay":
        magic.secondMagicDelay = parseInt(value, 10) || 0;
        break;
      case "MagicDirectionWhenKillEnemy":
        magic.magicDirectionWhenKillEnemy = parseInt(value, 10) || 0;
        break;
      case "MagicDirectionWhenBeAttacked":
        magic.magicDirectionWhenBeAttacked = parseInt(value, 10) || 0;
        break;
      case "AttackAddPercent":
        magic.attackAddPercent = parseInt(value, 10) || 0;
        break;
      case "DefendAddPercent":
        magic.defendAddPercent = parseInt(value, 10) || 0;
        break;
      case "EvadeAddPercent":
        magic.evadeAddPercent = parseInt(value, 10) || 0;
        break;
      case "SpeedAddPercent":
        magic.speedAddPercent = parseInt(value, 10) || 0;
        break;
      case "MorphMilliseconds":
        magic.morphMilliseconds = parseInt(value, 10) || 0;
        break;
      case "WeakMilliseconds":
        magic.weakMilliseconds = parseInt(value, 10) || 0;
        break;
      case "WeakAttackPercent":
        magic.weakAttackPercent = Math.min(100, parseInt(value, 10) || 0);
        break;
      case "WeakDefendPercent":
        magic.weakDefendPercent = Math.min(100, parseInt(value, 10) || 0);
        break;
      case "BlindMilliseconds":
        magic.blindMilliseconds = parseInt(value, 10) || 0;
        break;
      case "ReviveBodyRadius":
        magic.reviveBodyRadius = parseInt(value, 10) || 0;
        break;
      case "ReviveBodyMaxCount":
        magic.reviveBodyMaxCount = parseInt(value, 10) || 0;
        break;
      case "ReviveBodyLifeMilliSeconds":
        magic.reviveBodyLifeMilliSeconds = parseInt(value, 10) || 0;
        break;
      case "JumpToTarget":
        magic.jumpToTarget = parseInt(value, 10) || 0;
        break;
      case "JumpMoveSpeed":
        magic.jumpMoveSpeed = parseInt(value, 10) || 32;
        break;
      case "AddThewRestorePercent":
        magic.addThewRestorePercent = parseInt(value, 10) || 0;
        break;
      case "AddManaRestorePercent":
        magic.addManaRestorePercent = parseInt(value, 10) || 0;
        break;
      case "AddLifeRestorePercent":
        magic.addLifeRestorePercent = parseInt(value, 10) || 0;
        break;
      case "HitCountToChangeMagic":
        magic.hitCountToChangeMagic = parseInt(value, 10) || 0;
        break;
      case "HitCountFlyRadius":
        magic.hitCountFlyRadius = parseInt(value, 10) || 0;
        break;
      case "HitCountFlyAngleSpeed":
        magic.hitCountFlyAngleSpeed = parseInt(value, 10) || 0;
        break;
      case "LifeMax":
        magic.lifeMax = parseInt(value, 10) || 0;
        break;
      case "ThewMax":
        magic.thewMax = parseInt(value, 10) || 0;
        break;
      case "ManaMax":
        magic.manaMax = parseInt(value, 10) || 0;
        break;
      case "Attack":
        magic.attack = parseInt(value, 10) || 0;
        break;
      case "Defend":
        magic.defend = parseInt(value, 10) || 0;
        break;
      case "Evade":
        magic.evade = parseInt(value, 10) || 0;
        break;
      case "Attack2":
        magic.attack2 = parseInt(value, 10) || 0;
        break;
      case "Defend2":
        magic.defend2 = parseInt(value, 10) || 0;
        break;
      case "Attack3":
        magic.attack3 = parseInt(value, 10) || 0;
        break;
      case "Defend3":
        magic.defend3 = parseInt(value, 10) || 0;
        break;
      default:
        // 忽略未知属性
        break;
    }
  } catch (error) {
    logger.warn(`[MagicLoader] Error parsing ${key}=${value}:`, error);
  }
}

/**
 * 为等级数据赋值
 */
function assignLevelValue(levelData: Partial<MagicData>, key: string, value: string): void {
  const numValue = parseInt(value, 10);
  switch (key) {
    case "Effect":
      levelData.effect = numValue || 0;
      break;
    case "Effect2":
      levelData.effect2 = numValue || 0;
      break;
    case "Effect3":
      levelData.effect3 = numValue || 0;
      break;
    case "ManaCost":
      levelData.manaCost = numValue || 0;
      break;
    case "ThewCost":
      levelData.thewCost = numValue || 0;
      break;
    case "LifeCost":
      levelData.lifeCost = numValue || 0;
      break;
    case "LevelupExp":
      levelData.levelupExp = numValue || 0;
      break;
    case "Speed":
      levelData.speed = numValue || 8;
      break;
    case "MoveKind":
      levelData.moveKind = numValue || MagicMoveKind.NoMove;
      break;
    case "ColdMilliSeconds":
      levelData.coldMilliSeconds = numValue || 0;
      break;
    default:
      // 其他属性也可以被等级覆盖
      break;
  }
}

/**
 * 获取指定等级的武功数据
 * 对应 C# Magic.GetLevel()
 */
export function getMagicAtLevel(baseMagic: MagicData, level: number): MagicData {
  if (!baseMagic.levels || !baseMagic.levels.has(level)) {
    // 没有等级数据，返回基础数据的副本
    const copy = { ...baseMagic };
    copy.currentLevel = level;
    copy.effectLevel = level;
    return copy;
  }

  // 合并等级数据
  const levelData = baseMagic.levels.get(level)!;
  const merged: MagicData = {
    ...baseMagic,
    ...levelData,
    currentLevel: level,
    effectLevel: level,
    levels: baseMagic.levels, // 保留等级引用
  };

  return merged;
}

/**
 * 异步加载武功配置文件
 * Uses unified resourceLoader for caching parsed results
 */
export async function loadMagic(
  fileName: string,
  useCache: boolean = true
): Promise<MagicData | null> {
  // 规范化文件名
  const normalizedName = fileName.replace(/\\/g, "/");

  // 构建文件路径
  let filePath = normalizedName;
  if (!filePath.startsWith("ini/magic/") && !filePath.startsWith("/")) {
    filePath = `ini/magic/${normalizedName}`;
  }
  if (!filePath.startsWith("/")) {
    filePath = ResourcePath.from(filePath);
  }

  // 使用 loadIni 缓存解析结果
  const parser = (content: string) => parseMagicIni(content, normalizedName);

  if (!useCache) {
    // 不使用缓存时，直接加载文本并解析
    const content = await resourceLoader.loadText(filePath);
    if (!content) {
      logger.warn(`[MagicLoader] Failed to load: ${filePath}`);
      return null;
    }
    return parser(content);
  }

  const magic = await resourceLoader.loadIni<MagicData>(filePath, parser, "magic");
  if (magic) {
    logger.log(`[MagicLoader] Loaded magic: ${magic.name} (${magic.fileName})`);
  }
  return magic;
}

/**
 * 同步获取已缓存的武功（不再支持，返回 null）
 * 建议使用 loadMagic 的 async 版本
 */
export function getCachedMagic(_fileName: string): MagicData | null {
  // 缓存现在由 resourceLoader 管理，无法同步获取
  logger.warn("[MagicLoader] getCachedMagic is deprecated, use loadMagic instead");
  return null;
}

/**
 * 清除武功缓存（委托给 resourceLoader）
 */
export function clearMagicCache(): void {
  resourceLoader.clearCache("magic");
}

/**
 * 预加载多个武功
 */
export async function preloadMagics(fileNames: string[]): Promise<Map<string, MagicData>> {
  const results = new Map<string, MagicData>();
  await Promise.all(
    fileNames.map(async (fileName) => {
      const magic = await loadMagic(fileName);
      if (magic) {
        results.set(fileName, magic);
      }
    })
  );
  return results;
}
