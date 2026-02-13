/**
 * NPC 持久化工具函数
 * 从 NpcManager 提取的纯数据转换逻辑，无副作用
 */

import type { CharacterConfig, Vector2 } from "../core/types";
import type { CharacterKind, RelationType } from "../core/types";
import { extractFlatDataFromCharacter } from "../character/config-parser";
import type { NpcSaveItem } from "../storage/storage";
import type { Npc } from "./npc";

/**
 * NPC 的额外状态（不属于 FIELD_DEFS 的运行时字段）
 *
 * FIELD_DEFS 中定义的字段由 applyFlatDataToCharacter 统一处理，
 * 此接口只包含需要单独处理的非 FIELD_DEFS 字段。
 */
export interface NpcExtraState {
  // 死亡检查（也在 FIELD_DEFS 中，但需要在创建 NPC 前提前检查）
  isDeath: boolean;
  isDeathInvoked: boolean;

  // NPC 特有（不在 FIELD_DEFS 中）
  isHide: boolean;
  isAIDisabled: boolean;
  actionPathTilePositions?: Array<{ x: number; y: number }>;
}

/** parseNpcData 的返回类型 */
export interface ParsedNpcData {
  config: CharacterConfig;
  extraState: NpcExtraState;
  mapX: number;
  mapY: number;
  dir: number;
}

/**
 * 解析 NPC JSON 数据为配置和额外状态
 * 纯函数，数据来源：Scene API / NPC 分组缓存 / 存档（均为 camelCase JSON）
 */
export function parseNpcData(data: Record<string, unknown>): ParsedNpcData {
  // 辅助函数：解析数字，兼容 string 和 number
  const parseNum = (val: unknown, def: number): number => {
    if (val === undefined || val === null || val === "") return def;
    return typeof val === "number" ? val : parseInt(String(val), 10);
  };
  const parseStr = (val: unknown, def: string = ""): string => {
    return val !== undefined && val !== null ? String(val) : def;
  };
  const parseBool = (val: unknown, def: boolean = false): boolean => {
    if (val === undefined || val === null) return def;
    if (typeof val === "boolean") return val;
    return val === "1" || val === "true" || val === 1;
  };

  // 基础信息
  const name = parseStr(data.name);
  const npcIni = parseStr(data.npcIni);
  const mapX = parseNum(data.mapX, 0);
  const mapY = parseNum(data.mapY, 0);
  const dir = parseNum(data.dir, 4);
  const kind = parseNum(data.kind, 0);
  const relation = parseNum(data.relation, 0);
  const group = parseNum(data.group, 0);
  const pathFinder = parseNum(data.pathFinder, 0);
  const action = parseNum(data.action, 0);
  const noAutoAttackPlayer = parseNum(data.noAutoAttackPlayer, 0);
  const idle = parseNum(data.idle, 0);

  // 属性
  const walkSpeed = parseNum(data.walkSpeed, 1);
  const addMoveSpeedPercent = parseNum(data.addMoveSpeedPercent, 0);
  const dialogRadius = parseNum(data.dialogRadius, 1);
  const visionRadius = parseNum(data.visionRadius, 10);
  const attackRadius = parseNum(data.attackRadius, 1);

  // 战斗属性
  const life = parseNum(data.life, 100);
  const lifeMax = parseNum(data.lifeMax, 100);
  const mana = parseNum(data.mana, 100);
  const manaMax = parseNum(data.manaMax, 100);
  const thew = parseNum(data.thew, 100);
  const thewMax = parseNum(data.thewMax, 100);
  const attack = parseNum(data.attack, 10);
  const attack2 = parseNum(data.attack2, 0);
  const attackLevel = parseNum(data.attackLevel, 0);
  const defend = parseNum(data.defend ?? data.defence, 10);
  const defend2 = parseNum(data.defend2, 0);
  const evade = parseNum(data.evade, 0);
  const level = parseNum(data.level, 1);
  const exp = parseNum(data.exp, 0);
  const levelUpExp = parseNum(data.levelUpExp, 100);
  const expBonus = parseNum(data.expBonus, 0);
  const lum = parseNum(data.lum, 0);

  // 脚本和资源
  const scriptFile = parseStr(data.scriptFile);
  const scriptFileRight = parseStr(data.scriptFileRight);
  const deathScript = parseStr(data.deathScript);
  const bodyIni = parseStr(data.bodyIni);
  const flyIni = parseStr(data.flyIni);
  const flyIni2 = parseStr(data.flyIni2);
  const flyInis = parseStr(data.flyInis);
  const dropIni = parseStr(data.dropIni);
  const buyIniFile = parseStr(data.buyIniFile);

  // 状态
  const isHide = parseBool(data.isHide, false);
  const isAIDisabled = parseBool(data.isAIDisabled, false);
  const isDeath = parseBool(data.isDeath, false);
  const isDeathInvoked = parseBool(data.isDeathInvoked, false);
  const invincible = parseNum(data.invincible, 0);
  const reviveMilliseconds = parseNum(data.reviveMilliseconds, 0);

  // NPC 特有额外属性
  const actionPathTilePositions = (data.actionPathTilePositions ?? undefined) as
    | Vector2[]
    | undefined;

  // AI 相关字段
  const aiType = parseNum(data.aiType, 0);
  const keepRadiusWhenLifeLow = parseNum(data.keepRadiusWhenLifeLow, 0);
  const lifeLowPercent = parseNum(data.lifeLowPercent, 20);
  const stopFindingTarget = parseNum(data.stopFindingTarget, 0);
  const keepRadiusWhenFriendDeath = parseNum(data.keepRadiusWhenFriendDeath, 0);

  // Hurt Player (接触伤害)
  const hurtPlayerInterval = parseNum(data.hurtPlayerInterval, 0);
  const hurtPlayerLife = parseNum(data.hurtPlayerLife, 0);
  const hurtPlayerRadius = parseNum(data.hurtPlayerRadius, 0);

  // Magic Direction
  const magicDirectionWhenBeAttacked = parseNum(data.magicDirectionWhenBeAttacked, 0);
  const magicDirectionWhenDeath = parseNum(data.magicDirectionWhenDeath, 0);

  // Visibility Control
  const fixedPos = parseStr(data.fixedPos);
  const visibleVariableName = parseStr(data.visibleVariableName);
  const visibleVariableValue = parseNum(data.visibleVariableValue, 0);

  // Auto Magic
  const magicToUseWhenLifeLow = parseStr(data.magicToUseWhenLifeLow);
  const magicToUseWhenBeAttacked = parseStr(data.magicToUseWhenBeAttacked);
  const magicToUseWhenDeath = parseStr(data.magicToUseWhenDeath);

  // Drop Control
  const noDropWhenDie = parseNum(data.noDropWhenDie, 0);

  const config: CharacterConfig = {
    name,
    npcIni,
    kind: kind as CharacterKind,
    relation: relation as RelationType,
    group,
    noAutoAttackPlayer,
    scriptFile: scriptFile || undefined,
    scriptFileRight: scriptFileRight || undefined,
    deathScript: deathScript || undefined,
    bodyIni: bodyIni || undefined,
    flyIni: flyIni || undefined,
    flyIni2: flyIni2 || undefined,
    flyInis: flyInis || undefined,
    idle,
    expBonus,
    dropIni: dropIni || undefined,
    buyIniFile: buyIniFile || undefined,
    keepRadiusWhenLifeLow,
    lifeLowPercent,
    stopFindingTarget,
    keepRadiusWhenFriendDeath,
    aiType,
    invincible,
    reviveMilliseconds,
    hurtPlayerInterval,
    hurtPlayerLife,
    hurtPlayerRadius,
    magicDirectionWhenBeAttacked,
    magicDirectionWhenDeath,
    fixedPos: fixedPos || undefined,
    visibleVariableName: visibleVariableName || undefined,
    visibleVariableValue,
    magicToUseWhenLifeLow: magicToUseWhenLifeLow || undefined,
    magicToUseWhenBeAttacked: magicToUseWhenBeAttacked || undefined,
    magicToUseWhenDeath: magicToUseWhenDeath || undefined,
    noDropWhenDie,
    stats: {
      life,
      lifeMax,
      mana,
      manaMax,
      thew,
      thewMax,
      attack,
      attack2,
      attack3: 0,
      attackLevel,
      defend,
      defend2,
      defend3: 0,
      evade,
      exp,
      levelUpExp,
      level,
      canLevelUp: 0,
      walkSpeed,
      addMoveSpeedPercent,
      visionRadius,
      attackRadius,
      dialogRadius,
      lum,
      action,
    },
    pathFinder,
  };

  return {
    config,
    extraState: {
      isDeath,
      isDeathInvoked,
      isHide,
      isAIDisabled,
      actionPathTilePositions,
    },
    mapX,
    mapY,
    dir,
  };
}

/**
 * 收集 NPC 快照为 NpcSaveItem[]
 * 纯查询函数，不修改任何状态
 *
 * 使用 extractFlatDataFromCharacter 提取 FIELD_DEFS 定义的所有字段，
 * 然后补充非 FIELD_DEFS 的 NPC 特有运行时字段。
 *
 * @param npcs NPC 集合
 * @param partnersOnly 是否只收集伙伴
 */
export function collectNpcSnapshot(
  npcs: Map<string, Npc>,
  partnersOnly: boolean
): NpcSaveItem[] {
  const items: NpcSaveItem[] = [];

  for (const [, npc] of npcs) {
    // 根据 partnersOnly 参数过滤
    if (partnersOnly !== npc.isPartner) continue;
    // 跳过被魔法召唤的 NPC
    if (npc.summonedByMagicSprite !== null) continue;

    // 提取所有 FIELD_DEFS 字段（字段名已统一，无需 rename mapping）
    const base = extractFlatDataFromCharacter(npc, false);

    // 运行时方向（currentDirection 而非初始配置 dir）
    base.dir = npc.currentDirection;

    // NPC 特有字段（不在 FIELD_DEFS 中）
    base.isHide = npc.isHide;
    base.isAIDisabled = npc.isAIDisabled;
    base.actionPathTilePositions =
      npc.actionPathTilePositions?.length > 0
        ? npc.actionPathTilePositions.map((p) => ({ x: p.x, y: p.y }))
        : undefined;

    items.push(base as unknown as NpcSaveItem);
  }

  return items;
}
