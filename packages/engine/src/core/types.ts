/**
 * Core game types - based on JxqyHD implementation
 */

// ============= Vector and Position =============
export interface Vector2 {
  x: number;
  y: number;
}

// ============= Character Types =============
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

export enum CharacterState {
  Stand = 0,
  Stand1 = 1,
  Walk = 2,
  Run = 3,
  Jump = 4,
  FightStand = 5,
  FightWalk = 6,
  FightRun = 7,
  FightJump = 8,
  Attack = 9,
  Attack1 = 10,
  Attack2 = 11,
  Magic = 12,
  Hurt = 13,
  Death = 14,
  Sit = 15,
  Special = 16,
}

/**
 * 8方向枚举，从 South 开始顺时针
 * 与原版 C# 一致：direction 0 = (0,1) = South
 */
export enum Direction {
  South = 0,
  SouthWest = 1,
  West = 2,
  NorthWest = 3,
  North = 4,
  NorthEast = 5,
  East = 6,
  SouthEast = 7,
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
//  fields
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

//
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
  _apiResources?: {
    stand?: { image: string | null; sound: string | null };
    stand1?: { image: string | null; sound: string | null };
    walk?: { image: string | null; sound: string | null };
    run?: { image: string | null; sound: string | null };
    jump?: { image: string | null; sound: string | null };
    fightStand?: { image: string | null; sound: string | null };
    fightWalk?: { image: string | null; sound: string | null };
    fightRun?: { image: string | null; sound: string | null };
    fightJump?: { image: string | null; sound: string | null };
    attack?: { image: string | null; sound: string | null };
    attack1?: { image: string | null; sound: string | null };
    attack2?: { image: string | null; sound: string | null };
    special1?: { image: string | null; sound: string | null };
    special2?: { image: string | null; sound: string | null };
    hurt?: { image: string | null; sound: string | null };
    death?: { image: string | null; sound: string | null };
    sit?: { image: string | null; sound: string | null };
  };
}

// ============= Sprite Types (forward declaration) =============
export interface CharacterSpriteData {
  basePath: string;
  baseFileName: string;
  isLoaded: boolean;
  currentFrame: number;
  animationTime: number;
}

// ============= Player Types =============
//  (inherits Character)
export interface PlayerData {
  config: CharacterConfig;
  tilePosition: Vector2;
  pixelPosition: Vector2;
  direction: Direction;
  state: CharacterState;
  currentFrame: number;
  path: Vector2[];
  isMoving: boolean;
  targetPosition: Vector2 | null;
  sprite?: CharacterSpriteData;

  // Player-specific fields
  money: number;
  doing: number;
  desX: number; // _desX (目标X)
  desY: number; // _desY (目标Y)
  belong: number; // _belong (归属)
  fight: number; // _fight (战斗状态)

  // Special action state
  isInSpecialAction?: boolean;
  specialActionAsf?: string;
  specialActionLastDirection?: Direction;
  specialActionFrame?: number;
}

// ============= Script Types =============
export interface ScriptCode {
  name: string;
  parameters: string[];
  result: string; // Return label for conditionals
  literal: string; // Original line text
  lineNumber: number;
  isGoto: boolean; // If it's a label
  isLabel: boolean;
}

export interface ScriptData {
  fileName: string;
  codes: ScriptCode[];
  labels: Map<string, number>; // label name -> line index
}

export interface ScriptState {
  currentScript: ScriptData | null;
  currentLine: number;
  isRunning: boolean;
  isPaused: boolean;
  callStack: { script: ScriptData; line: number }[];

  // the NPC, Obj, or Good that triggered this script
  // Used by commands like DelCurObj, SetObjScript, DelGoods, etc.
  belongObject: { type: "npc" | "obj" | "good"; id: string } | null;
}

// ============= Game Variables =============
export interface GameVariables {
  [key: string]: number;
}

// ============= Dialog Types =============
export interface DialogData {
  text: string;
  portraitIndex: number;
  isVisible: boolean;
}

export interface SelectionOption {
  text: string;
  label: string;
}

export interface SelectionData {
  options: SelectionOption[];
  isVisible: boolean;
  selectedIndex: number;
}

// ============= Game State =============
export interface GameState {
  // Map
  currentMapName: string;
  currentMapPath: string;

  // Player
  player: PlayerData;

  // NPCs - count only (actual NPC management is in NpcManager)
  npcCount: number;

  // Script
  scriptState: ScriptState;
  variables: GameVariables;

  // UI State
  dialog: DialogData;
  selection: SelectionData;
  messageText: string;
  isMessageVisible: boolean;

  // Game flags
  isLoading: boolean;
  isPaused: boolean;
  gameTime: number;

  // Event tracking
  eventId: number;
}

// ============= Input Types =============
//  input handling
export interface InputState {
  keys: Set<string>;
  mouseX: number;
  mouseY: number;
  mouseWorldX: number;
  mouseWorldY: number;
  isMouseDown: boolean; // MouseLeftButton == Pressed
  isRightMouseDown: boolean;
  clickedTile: Vector2 | null;
  // New fields for continuous mouse movement
  isShiftDown: boolean; // Keys.LeftShift || Keys.RightShift
  isAltDown: boolean; // Keys.LeftAlt || Keys.RightAlt
  isCtrlDown: boolean; // Keys.LeftControl || Keys.RightControl
  // Mobile joystick direction input (方向移动，类似小键盘)
  // 使用方向移动而非鼠标点击，避免频繁寻路导致卡顿
  joystickDirection: Direction | null;
}

export const createDefaultInputState = (): InputState => ({
  keys: new Set<string>(),
  mouseX: 0,
  mouseY: 0,
  mouseWorldX: 0,
  mouseWorldY: 0,
  isMouseDown: false,
  isRightMouseDown: false,
  clickedTile: null,
  isShiftDown: false,
  isAltDown: false,
  isCtrlDown: false,
  joystickDirection: null,
});

// ============= Animation Types =============
export interface AnimationFrame {
  frameIndex: number;
  duration: number;
}

export interface Animation {
  name: string;
  frames: AnimationFrame[];
  isLooping: boolean;
}

// ============= Sprite Types =============
export interface SpriteData {
  asf: AsfData | null;
  currentFrame: number;
  animationTime: number;
  direction: Direction;
  state: CharacterState;
}

export interface AsfData {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  directions: number;
  interval: number;
  frames: ImageData[];
  palette: Uint8ClampedArray[];
}

// ============= Constants =============
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

// Globals.cs: BaseSpeed = 100, RunSpeedFold = 8
// Movement uses: Velocity * elapsedSeconds * speedFold
// Walk: speedFold = WalkSpeed (default 1)
// Run: speedFold = RunSpeedFold (default 8)
export const BASE_SPEED = 100;
export const RUN_SPEED_FOLD = 8; // Globals.RunSpeedFold (跑步速度是走路的8倍!)
export const DEFAULT_RUN_SPEED = BASE_SPEED * RUN_SPEED_FOLD;
export const MIN_CHANGE_MOVE_SPEED_PERCENT = -90;

export const DIALOG_RADIUS = 3; // tiles

// Default character stats ( defaults)
// Character 字段默认值都是 0（int 默认）
// 这里定义的是 Player 的实际初始值，不是 Character 基类的默认值
export const DEFAULT_PLAYER_STATS: CharacterStats = {
  // Basic stats - Player 从存档或 INI 加载
  life: 1000,
  lifeMax: 1000,
  mana: 1000,
  manaMax: 1000,
  thew: 1000,
  thewMax: 1000,

  // Combat stats
  attack: 100,
  attack2: 0,
  attack3: 0,
  attackLevel: 0,
  defend: 10,
  defend2: 0,
  defend3: 0,
  evade: 10,

  // Experience & Level
  exp: 0,
  levelUpExp: 100,
  level: 1,
  canLevelUp: 1,

  // Movement & Interaction
  walkSpeed: 1,
  addMoveSpeedPercent: 0,
  visionRadius: 0, // 默认 0，getter 返回 9 if 0
  attackRadius: 0, // 默认 0，getter 返回 1 if 0 (melee range)
  dialogRadius: 0, // 默认 0，getter 返回 1 if 0

  // Other
  lum: 0,
  action: 0,
};

// Default character config
export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  name: "",
  npcIni: "",
  kind: CharacterKind.Player,
  relation: RelationType.Friend,
  group: 0,
  noAutoAttackPlayer: 0,
  stats: { ...DEFAULT_PLAYER_STATS },
  pathFinder: 0,
};
