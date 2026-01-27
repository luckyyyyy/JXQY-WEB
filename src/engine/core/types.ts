/**
 * Core game types - based on JxqyHD C# implementation
 */

// ============= Vector and Position =============
export interface Vector2 {
  x: number;
  y: number;
}

// ============= Character Types =============
export enum CharacterKind {
  Player = 0,
  Fighter = 1,
  Eventer = 2, // Non-combat NPC
  Follower = 3, // Party member
  Fighter2 = 4,
  Flyer = 5, // Flying enemy
}

/**
 * C# RelationType enum - Character relation type
 * IMPORTANT: Order must match C# enum for correct save/load compatibility
 * C# order: Friend=0, Enemy=1, Neutral=2, None=3
 */
export enum RelationType {
  Friend = 0,
  Enemy = 1,
  Neutral = 2,
  None = 3,  // Attack all other types
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

export enum Direction {
  North = 0,
  NorthEast = 1,
  East = 2,
  SouthEast = 3,
  South = 4,
  SouthWest = 5,
  West = 6,
  NorthWest = 7,
}

// ============= Character Stats =============
// Based on C# Character.cs fields
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
  attack2: number; // C#: Attack2
  attack3: number; // C#: Attack3
  attackLevel: number; // C#: AttackLevel
  defend: number; // C#: Defend (防御)
  defend2: number; // C#: Defend2
  defend3: number; // C#: Defend3
  evade: number; // C#: Evade (闪避)

  // Experience & Level
  exp: number;
  levelUpExp: number;
  level: number;
  canLevelUp: number; // C#: CanLevelUp (是否可以升级)

  // Movement & Interaction
  walkSpeed: number;
  addMoveSpeedPercent: number; // C#: AddMoveSpeedPercent
  visionRadius: number;
  attackRadius: number;
  dialogRadius: number;

  // Other
  lum: number; // C#: Lum (亮度)
  action: number; // C#: Action
}

// Based on C# Character.cs
export interface CharacterConfig {
  name: string; // C#: Name
  npcIni: string;
  flyIni?: string;
  flyIni2?: string; // C#: FlyIni2
  bodyIni?: string;
  kind: CharacterKind; // C#: Kind
  relation: RelationType; // C#: Relation
  group: number; // C#: Group (分组)
  noAutoAttackPlayer: number; // C#: NoAutoAttackPlayer
  stats: CharacterStats;
  scriptFile?: string;
  scriptFileRight?: string; // C#: ScriptFileRight (右键脚本)
  deathScript?: string;
  timerScript?: string;
  timerInterval?: number;
  pathFinder: number; // C#: PathFinder (寻路类型)
  canInteractDirectly?: number; // C#: CanInteractDirectly
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
// Based on C# Player.cs (inherits Character)
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
  customActionFiles?: Map<number, string>;

  // Player-specific fields (C# Player.cs)
  money: number; // C#: _money
  doing: number; // C#: _doing
  desX: number; // C#: _desX (目标X)
  desY: number; // C#: _desY (目标Y)
  belong: number; // C#: _belong (归属)
  fight: number; // C#: _fight (战斗状态)

  // Special action state (C#: IsInSpecialAction, _specialActionLastDirection)
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
  waitTime: number;
  waitingForInput: boolean;
  callStack: { script: ScriptData; line: number }[];
  selectionResultVar?: string; // Variable name to store selection result
  isInTalk: boolean; // Whether currently in a Talk sequence
  talkQueue: { text: string; portraitIndex: number }[]; // Queue of talk dialogs

  // C#: ScriptRunner.BelongObject - the NPC or Obj that triggered this script
  // Used by commands like DelCurObj, SetObjScript, etc.
  belongObject: { type: "npc" | "obj"; id: string } | null;

  // Blocking wait states (C# ScriptRunner checks these each frame)
  // PlayerGoto (C#: _playerGotoDesitination)
  waitingForPlayerGoto: boolean;
  playerGotoDestination: Vector2 | null;
  // PlayerGotoDir (C#: WalkToDirection)
  waitingForPlayerGotoDir: boolean;
  // PlayerRunTo (C#: _playerRunToDestination)
  waitingForPlayerRunTo: boolean;
  playerRunToDestination: Vector2 | null;
  // NpcGoto (C#: _npcGotoCharacter, _npcGotoDestionation)
  waitingForNpcGoto: boolean;
  npcGotoName: string | null;
  npcGotoDestination: Vector2 | null;
  // NpcGotoDir
  waitingForNpcGotoDir: boolean;
  npcGotoDirName: string | null;
  // FadeIn/FadeOut
  waitingForFadeIn: boolean;
  waitingForFadeOut: boolean;
  // NpcSpecialActionEx (C#: blocks until IsInSpecialAction = false)
  waitingForNpcSpecialAction: boolean;
  npcSpecialActionName: string | null;
  // MoveScreen (C#: Camera.IsInMove)
  waitingForMoveScreen: boolean;
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
// Based on C# Player.cs input handling
export interface InputState {
  keys: Set<string>;
  mouseX: number;
  mouseY: number;
  mouseWorldX: number;
  mouseWorldY: number;
  isMouseDown: boolean; // C#: MouseLeftButton == Pressed
  isRightMouseDown: boolean;
  clickedTile: Vector2 | null;
  // New fields for continuous mouse movement (C# style)
  isShiftDown: boolean; // C#: Keys.LeftShift || Keys.RightShift
  isAltDown: boolean; // C#: Keys.LeftAlt || Keys.RightAlt
  isCtrlDown: boolean; // C#: Keys.LeftControl || Keys.RightControl
}

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

// C# Globals.cs: BaseSpeed = 100, RunSpeedFold = 8
// Movement uses: Velocity * elapsedSeconds * speedFold
// Walk: speedFold = WalkSpeed (default 1)
// Run: speedFold = RunSpeedFold (default 8)
export const BASE_SPEED = 100; // C#: Globals.BaseSpeed
export const RUN_SPEED_FOLD = 8; // C#: Globals.RunSpeedFold (跑步速度是走路的8倍!)
export const DEFAULT_RUN_SPEED = BASE_SPEED * RUN_SPEED_FOLD;
export const MIN_CHANGE_MOVE_SPEED_PERCENT = -90; // C#: Globals.MinChangeMoveSpeedPercent

export const DIALOG_RADIUS = 3; // tiles

// Default character stats (based on C# Character.cs defaults)
export const DEFAULT_PLAYER_STATS: CharacterStats = {
  // Basic stats
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
  visionRadius: 20,
  attackRadius: 10,
  dialogRadius: 3,

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
