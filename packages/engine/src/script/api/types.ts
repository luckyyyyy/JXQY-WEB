/**
 * Script Command Context - Shared context for sub-command files
 * Provides all dependencies needed by command creation functions
 */

import type { AudioManager } from "../../audio";
import type { Vector2 } from "../../core/types";
import type { ScreenEffects } from "../../renderer/screen-effects";
import type { BuyManager } from "../../gui/buy-manager";
import type { GuiManager } from "../../gui/gui-manager";
import type { MemoListManager } from "../../data/memo-list-manager";
import type { TalkTextListManager } from "../../data/talk-text-list";
import type { PartnerListManager } from "../../data/partner-list";
import type { Npc, NpcManager } from "../../npc";
import type { ObjManager } from "../../obj";
import type { Player } from "../../player/player";
import type { TimerManager } from "../../data/timer-manager";
import type { WeatherManager } from "../../weather";
import type { GoodsListManager } from "../../player/goods";
import type { LevelManager } from "../../character/level/level-manager";

/**
 * Shared context for script command creation functions.
 * Contains all dependencies and utilities extracted from ScriptContextDependencies.
 */
export interface ScriptCommandContext {
  // === Core controllers ===
  player: Player;
  npcManager: NpcManager;
  guiManager: GuiManager;
  objManager: ObjManager;
  audioManager: AudioManager;
  screenEffects: ScreenEffects;
  talkTextList: TalkTextListManager;
  memoListManager: MemoListManager;
  weatherManager: WeatherManager;
  timerManager: TimerManager;
  buyManager: BuyManager;
  partnerList: PartnerListManager;

  // === Derived from player ===
  levelManager: LevelManager;
  goodsListManager: GoodsListManager;

  // === Utility functions ===
  getCharacterByName: (name: string) => Npc | Player | null;
  getCharactersByName: (name: string) => (Npc | Player)[];
  getScriptBasePath: () => string;

  // === State accessors ===
  getVariables: () => Record<string, number>;
  setVariable: (name: string, value: number) => void;
  getCurrentMapName: () => string;
  getCurrentMapPath: () => string;

  // === Action callbacks ===
  loadMap: (mapPath: string) => Promise<void>;
  loadNpcFile: (fileName: string) => Promise<void>;
  loadGameSave: (index: number) => Promise<void>;
  setMapTrap: (trapIndex: number, trapFileName: string, mapName?: string) => void;
  checkTrap: (tile: Vector2) => void;
  cameraMoveTo: (direction: number, distance: number, speed: number) => void;
  cameraMoveToPosition: (destX: number, destY: number, speed: number) => void;
  isCameraMoving: () => boolean;
  isCameraMoveToPositionEnd: () => boolean;
  setCameraPosition: (pixelX: number, pixelY: number) => void;
  centerCameraOnPlayer: () => void;
  runScript: (scriptFile: string) => Promise<void>;

  // === Flags ===
  enableSave: () => void;
  disableSave: () => void;
  enableDrop: () => void;
  disableDrop: () => void;
  isMapObstacleForCharacter: (x: number, y: number) => boolean;
  setScriptShowMapPos: (show: boolean) => void;
  setMapTime: (time: number) => void;
  saveMapTrap: () => void;
  changePlayer: (index: number) => Promise<void>;
  clearMouseInput?: () => void;
  returnToTitle: () => void;
  runParallelScript?: (scriptFile: string, delayMs: number) => void;
}
