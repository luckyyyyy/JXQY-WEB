/**
 * NPC 持久化工具函数
 * 从 NpcManager 提取的纯数据转换逻辑，无副作用
 */

import {
  buildCharacterConfigFromFlatData,
  extractFlatDataFromCharacter,
} from "../character/character-config";
import type { CharacterConfig, CharacterKind, RelationType, Vector2 } from "../core/types";
import {
  CharacterKind as CharacterKindEnum,
  DEFAULT_CHARACTER_CONFIG,
  RelationType as RelationTypeEnum,
} from "../core/types";
import type { NpcSaveItem } from "../storage/save-types";
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

const NPC_SAVE_BASE_CONFIG: CharacterConfig = {
  ...DEFAULT_CHARACTER_CONFIG,
  kind: CharacterKindEnum.Normal,
  relation: RelationTypeEnum.Friend,
  group: 0,
  noAutoAttackPlayer: 0,
  pathFinder: 0,
  npcIni: "",
  name: "",
  stats: {
    ...DEFAULT_CHARACTER_CONFIG.stats,
    life: 100,
    lifeMax: 100,
    mana: 100,
    manaMax: 100,
    thew: 100,
    thewMax: 100,
    attack: 10,
    attack2: 0,
    attack3: 0,
    attackLevel: 0,
    defend: 10,
    defend2: 0,
    defend3: 0,
    evade: 0,
    exp: 0,
    levelUpExp: 100,
    level: 1,
    canLevelUp: 0,
    walkSpeed: 1,
    addMoveSpeedPercent: 0,
    visionRadius: 10,
    attackRadius: 1,
    dialogRadius: 1,
    lum: 0,
    action: 0,
  },
};

const OPTIONAL_STRING_CONFIG_PROPS = [
  "scriptFile",
  "scriptFileRight",
  "deathScript",
  "bodyIni",
  "flyIni",
  "flyIni2",
  "flyInis",
  "dropIni",
  "buyIniFile",
  "fixedPos",
  "visibleVariableName",
  "magicToUseWhenLifeLow",
  "magicToUseWhenBeAttacked",
  "magicToUseWhenDeath",
] as const;

/**
 * 解析 NPC JSON 数据为配置和额外状态
 * 纯函数，数据来源：Scene API / NPC 分组缓存 / 存档（均为 camelCase JSON）
 */
export function parseNpcData(data: Record<string, unknown>): ParsedNpcData {
  const parseNum = (val: unknown, def: number): number => {
    if (val === undefined || val === null || val === "") return def;
    const parsed = typeof val === "number" ? val : parseInt(String(val), 10);
    return Number.isNaN(parsed) ? def : parsed;
  };
  const parseBool = (val: unknown, def: boolean = false): boolean => {
    if (val === undefined || val === null) return def;
    if (typeof val === "boolean") return val;
    return val === "1" || val === "true" || val === 1;
  };

  const mapX = parseNum(data.mapX, 0);
  const mapY = parseNum(data.mapY, 0);
  const dir = parseNum(data.dir, 4);

  // 状态
  const isHide = parseBool(data.isHide, false);
  const isAIDisabled = parseBool(data.isAIDisabled, false);
  const isDeath = parseBool(data.isDeath, false);
  const isDeathInvoked = parseBool(data.isDeathInvoked, false);

  // NPC 特有额外属性
  const actionPathTilePositions = (data.actionPathTilePositions ?? undefined) as
    | Vector2[]
    | undefined;
  const flatData: Record<string, unknown> = {
    ...data,
    defend: data.defend ?? data.defence,
    mapX,
    mapY,
    dir,
  };
  const config = buildCharacterConfigFromFlatData(flatData, {
    baseConfig: NPC_SAVE_BASE_CONFIG,
  });

  // 与旧行为保持一致：可选字符串字段空串转为 undefined
  for (const prop of OPTIONAL_STRING_CONFIG_PROPS) {
    if (config[prop] === "") {
      (config as unknown as Record<string, unknown>)[prop] = undefined;
    }
  }

  config.kind = (config.kind ?? CharacterKindEnum.Normal) as CharacterKind;
  config.relation = (config.relation ?? RelationTypeEnum.Friend) as RelationType;

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
export function collectNpcSnapshot(npcs: Map<string, Npc>, partnersOnly: boolean): NpcSaveItem[] {
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
