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

export enum RelationType {
  Enemy = 0,
  Friend = 1,
  None = 2,
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
export interface CharacterStats {
  name: string;
  life: number;
  lifeMax: number;
  mana: number;
  manaMax: number;
  thew: number; // Stamina
  thewMax: number;
  attack: number;
  defence: number;
  evade: number;
  exp: number;
  level: number;
  walkSpeed: number;
  visionRadius: number;
  attackRadius: number;
  dialogRadius: number;
}

export interface CharacterConfig {
  name: string;
  npcIni: string;
  flyIni?: string;
  bodyIni?: string;
  kind: CharacterKind;
  relation: RelationType;
  stats: CharacterStats;
  scriptFile?: string;
  deathScript?: string;
  timerScript?: string;
  timerInterval?: number;
  pathFinder?: boolean;
}

// ============= Sprite Types (forward declaration) =============
export interface CharacterSpriteData {
  basePath: string;
  baseFileName: string;
  isLoaded: boolean;
  currentFrame: number;
  animationTime: number;
}

// ============= NPC Types =============
export interface NpcData {
  id: string;
  config: CharacterConfig;
  tilePosition: Vector2;
  pixelPosition: Vector2;
  direction: Direction;
  state: CharacterState;
  currentFrame: number;
  path: Vector2[];
  isVisible: boolean;
  isAIDisabled: boolean;
  actionPathTilePositions?: Vector2[]; // Patrol path
  sprite?: CharacterSpriteData; // Optional sprite data
  specialActionAsf?: string; // For special animations
  customActionFiles?: Map<number, string>; // State -> ASF file mapping
  actionType?: number; // Action type for behavior
}

// ============= Player Types =============
export interface PlayerData {
  config: CharacterConfig;
  tilePosition: Vector2;
  pixelPosition: Vector2;
  direction: Direction;
  state: CharacterState;
  currentFrame: number;
  money: number;
  path: Vector2[];
  isMoving: boolean;
  targetPosition: Vector2 | null;
  sprite?: CharacterSpriteData; // Optional sprite data
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

// ============= Map Event Types =============
export interface TrapData {
  tileX: number;
  tileY: number;
  scriptFile: string;
  triggered: boolean;
}

// ============= Game State =============
export interface GameState {
  // Map
  currentMapName: string;
  currentMapPath: string;

  // Player
  player: PlayerData;

  // NPCs
  npcs: Map<string, NpcData>;

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
export interface InputState {
  keys: Set<string>;
  mouseX: number;
  mouseY: number;
  mouseWorldX: number;
  mouseWorldY: number;
  isMouseDown: boolean;
  isRightMouseDown: boolean;
  clickedTile: Vector2 | null;
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

export const DEFAULT_WALK_SPEED = 160; // pixels per second
export const DEFAULT_RUN_SPEED = 280;

export const DIALOG_RADIUS = 3; // tiles

// Default player stats
export const DEFAULT_PLAYER_STATS: CharacterStats = {
  name: "杨影枫",
  life: 1000,
  lifeMax: 1000,
  mana: 1000,
  manaMax: 1000,
  thew: 1000,
  thewMax: 1000,
  attack: 100,
  defence: 10,
  evade: 10,
  exp: 0,
  level: 1,
  walkSpeed: 1,
  visionRadius: 20,
  attackRadius: 10,
  dialogRadius: 3,
};
