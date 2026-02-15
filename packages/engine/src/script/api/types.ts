/**
 * Script Command Context - Shared context for sub-command files
 * Provides all dependencies needed by command creation functions
 */

import type { AudioManager } from "../../audio";
import type { LevelManager } from "../../character/level/level-manager";
import type { EngineContext } from "../../core/engine-context";
import type { Vector2 } from "../../core/types";
import type { GuiManager } from "../../gui/gui-manager";
import type { MemoListManager } from "../../gui/memo-list-manager";
import type { TalkTextListManager } from "../../gui/talk-text-list";
import type { Npc, NpcManager } from "../../npc";
import type { ObjManager } from "../../obj";
import type { GoodsListManager } from "../../player/goods";
import type { PartnerListManager } from "../../player/partner-list";
import type { Player } from "../../player/player";
import type { ScreenEffects } from "../../renderer/screen-effects";
import type { TimerManager } from "../../runtime/timer-manager";

/**
 * Shared context for script command creation functions.
 * All dependencies needed by script command creation functions (create*API).
 */
export interface ScriptCommandContext
  extends Pick<
    EngineContext,
    "player" | "npcManager" | "guiManager" | "objManager" | "weatherManager" | "buyManager"
  > {
  // === Core controllers (script-only additions) ===
  player: Player;
  npcManager: NpcManager;
  guiManager: GuiManager;
  objManager: ObjManager;
  audioManager: AudioManager;
  screenEffects: ScreenEffects;
  talkTextList: TalkTextListManager;
  memoListManager: MemoListManager;
  timerManager: TimerManager;
  partnerList: PartnerListManager;

  // === Derived from player ===
  levelManager: LevelManager;
  goodsListManager: GoodsListManager;

  // === Utility functions ===
  getCharacterByName: (name: string) => Npc | Player | null;
  getCharactersByName: (name: string) => (Npc | Player)[];
  getScriptBasePath: EngineContext["getScriptBasePath"];

  // === State accessors ===
  getVariables: () => Record<string, number>;
  setVariable: (name: string, value: number) => void;
  getCurrentMapName: EngineContext["getCurrentMapName"];
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
  runScript: EngineContext["runScript"];

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

  // === Debug hooks (optional) ===
  onScriptStart?: (filePath: string, totalLines: number, allCodes: string[]) => void;
  onLineExecuted?: (filePath: string, lineNumber: number) => void;
}
