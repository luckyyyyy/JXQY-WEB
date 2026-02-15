/**
 * Character domain types — enums, stats, config, and defaults.
 *
 * These types live in core/ because they are fundamental to the engine
 * and used across many modules (npc, player, script, storage, etc.).
 *
 * Originally based on JxqyHD Character.cs implementation.
 */
import { CharacterState } from "./enums";

// ============= Character Enums =============

/**
 * Character.CharacterKind enum
 * IMPORTANT: Order and values must match enum for save/load compatibility
 */
export enum CharacterKind {
  Normal = 0, // regular NPC
  Fighter = 1, // combat NPC
  Player = 2, // player character
  Follower = 3, // party member
  GroundAnimal = 4, // ground-based animal
  Eventer = 5, // event/dialogue NPC
  AfraidPlayerAnimal = 6, // animal that runs from player
  Flyer = 7, // flying enemy
}

/**
 * RelationType enum - Character relation type
 * IMPORTANT: Order must match enum for correct save/load compatibility
 * order: Friend=0, Enemy=1, Neutral=2, None=3
 */
export enum RelationType {
  Friend = 0,
  Enemy = 1,
  Neutral = 2,
  None = 3, // Attack all other types
}

/**
 * Character.ActionType enum
 * Defines NPC behavior patterns
 */
export enum ActionType {
  Stand = 0, // NPC stands still
  RandWalk = 1, // NPC randomly walks within a radius
  LoopWalk = 2, // NPC walks in a loop along FixedPos path
}

// ============= Character Stats =============

export interface CharacterStats {
  // Basic stats
  life: number;
  lifeMax: number;
  mana: number;
  manaMax: number;
  thew: number; // Stamina (体力)
  thewMax: number;

  // Combat stats
  attack: number;
  attack2: number;
  attack3: number;
  attackLevel: number;
  defend: number; // Defend (防御)
  defend2: number;
  defend3: number;
  evade: number; // Evade (闪避)

  // Experience & Level
  exp: number;
  levelUpExp: number;
  level: number;
  canLevelUp: number; // CanLevelUp (是否可以升级)

  // Movement & Interaction
  walkSpeed: number;
  addMoveSpeedPercent: number;
  visionRadius: number;
  attackRadius: number;
  dialogRadius: number;

  // Other
  lum: number; // Lum (亮度)
  action: number;

  // Position (for save/load, optional)
  mapX?: number;
  mapY?: number;
  dir?: number;
}

// ============= API Resource Entry =============

/** A single state resource entry (image + sound paths). */
export interface ApiResourceEntry {
  image: string | null;
  sound: string | null;
}

// ============= Character Config =============

export interface CharacterConfig {
  name: string;
  npcIni: string;
  flyIni?: string;
  flyIni2?: string;
  flyInis?: string; // 多法术距离配置 "magic:distance;magic2:distance2"
  bodyIni?: string;
  kind: CharacterKind;
  relation: RelationType;
  group: number; // Group (分组)
  noAutoAttackPlayer: number;
  idle?: number; // 攻击间隔帧数
  stats: CharacterStats;
  scriptFile?: string;
  scriptFileRight?: string; // ScriptFileRight (右键脚本)
  deathScript?: string;
  timerScriptFile?: string;
  timerScriptInterval?: number;
  pathFinder: number; // PathFinder (寻路类型)
  canInteractDirectly?: number;
  expBonus?: number; // Boss判断（>0为Boss，名字显示黄色）

  // === AI/Combat Fields ===
  dropIni?: string; // 掉落配置文件
  buyIniFile?: string; // 商店配置文件
  keepRadiusWhenLifeLow?: number;
  lifeLowPercent?: number;
  stopFindingTarget?: number;
  keepRadiusWhenFriendDeath?: number;
  aiType?: number; // 0=normal, 1=rand move+attack, 2=rand move no fight
  invincible?: number; // 无敌状态
  reviveMilliseconds?: number; // 复活时间

  // === Hurt Player (接触伤害) ===
  hurtPlayerInterval?: number; // 伤害间隔（毫秒）
  hurtPlayerLife?: number; // 接触伤害值
  hurtPlayerRadius?: number; // 接触伤害半径

  // === Magic Direction ===
  magicDirectionWhenBeAttacked?: number;
  magicDirectionWhenDeath?: number;

  // === Visibility Control ===
  fixedPos?: string; // 固定路径点
  visibleVariableName?: string;
  visibleVariableValue?: number;

  // === Auto Magic ===
  magicToUseWhenLifeLow?: string;
  magicToUseWhenBeAttacked?: string;
  magicToUseWhenDeath?: string;

  // === Drop Control ===
  noDropWhenDie?: number; // 死亡时不掉落物品

  // === API Resources (从统一数据加载器获取的资源配置) ===
  _apiResources?: Partial<Record<string, ApiResourceEntry>>;
}

// ============= Default Config =============

export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  name: "",
  npcIni: "",
  kind: CharacterKind.Player,
  relation: RelationType.Friend,
  group: 0,
  noAutoAttackPlayer: 0,
  stats: {
    life: 1000,
    lifeMax: 1000,
    mana: 1000,
    manaMax: 1000,
    thew: 1000,
    thewMax: 1000,
    attack: 100,
    attack2: 0,
    attack3: 0,
    attackLevel: 0,
    defend: 10,
    defend2: 0,
    defend3: 0,
    evade: 10,
    exp: 0,
    levelUpExp: 100,
    level: 1,
    canLevelUp: 1,
    walkSpeed: 1,
    addMoveSpeedPercent: 0,
    visionRadius: 0,
    attackRadius: 0,
    dialogRadius: 0,
    lum: 0,
    action: 0,
  },
  pathFinder: 0,
};

// Re-export CharacterState for convenience since it's tightly coupled
export { CharacterState };
