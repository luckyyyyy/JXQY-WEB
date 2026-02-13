/**
 * Script Context Factory - Creates ScriptContext and GameAPI for script execution
 *
 * This module provides two APIs:
 * - createGameAPIAndScriptContext(): structured GameAPI + flat ScriptContext adapter
 * - createScriptContext(): flat ScriptContext (backwards-compatible, delegates to GameAPI)
 *
 * New script engines (JS, Lua) should use GameAPI directly.
 * The custom script engine uses ScriptContext (adapted from GameAPI).
 */

import type { AudioManager } from "../audio";
import type { GameAPI } from "./api/game-api";
import type { Vector2 } from "../core/types";
import type { ScreenEffects } from "../renderer/screen-effects";
import type { BuyManager } from "../gui/buy-manager";
import type { GuiManager } from "../gui/gui-manager";
import type { MemoListManager } from "../data/memo-list-manager";
import type { TalkTextListManager } from "../data/talk-text-list";
import type { PartnerListManager } from "../data/partner-list";
import type { NpcManager } from "../npc";
import type { ObjManager } from "../obj";
import type { Player } from "../player/player";
import type { ScriptContext } from "./commands/types";
import type { TimerManager } from "../data/timer-manager";
import type { WeatherManager } from "../weather";
import { BlockingResolver } from "./blocking-resolver";
import { createGameAPIImpl, gameAPIToScriptContext } from "./api";

/**
 * Dependencies needed to create a script context
 */
export interface ScriptContextDependencies {
  // Controllers
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

  // State accessors
  getVariables: () => Record<string, number>;
  setVariable: (name: string, value: number) => void;
  getCurrentMapName: () => string;

  // Actions
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

  // Save/Drop flags
  enableSave: () => void;
  disableSave: () => void;
  enableDrop: () => void;
  disableDrop: () => void;

  // Show map pos flag
  setScriptShowMapPos: (show: boolean) => void;

  // Map time
  setMapTime: (time: number) => void;

  // Trap save
  saveMapTrap: () => void;

  // Player change (多主角切换)
  changePlayer: (index: number) => Promise<void>;

  // Debug hooks (optional)
  onScriptStart?: (filePath: string, totalLines: number, allCodes: string[]) => void;
  onLineExecuted?: (filePath: string, lineNumber: number) => void;

  // Input control (optional)
  clearMouseInput?: () => void;

  // Map obstacle check (injected to avoid global MapBase.Instance)
  isMapObstacleForCharacter: (x: number, y: number) => boolean;

  // Map path accessor
  getCurrentMapPath: () => string;

  // Return to title
  returnToTitle: () => void;

  // Parallel script (optional - set after ScriptExecutor is created)
  runParallelScript?: (scriptFile: string, delayMs: number) => void;
}

/**
 * Create both GameAPI (structured) and ScriptContext (flat adapter).
 *
 * Use this when you need access to both APIs:
 * - GameAPI for new JS/Lua script engines
 * - ScriptContext for the existing custom script engine
 */
export function createGameAPIAndScriptContext(deps: ScriptContextDependencies): {
  gameAPI: GameAPI;
  scriptContext: ScriptContext;
  resolver: BlockingResolver;
  /** Set runParallelScript callback (must be called after ScriptExecutor is created) */
  setRunParallelScript: (fn: (scriptFile: string, delayMs: number) => void) => void;
} {
  const resolver = new BlockingResolver();
  const { api, ctx } = createGameAPIImpl(deps, resolver);

  const scriptContext = gameAPIToScriptContext(api, {
    scriptBasePath: ctx.getScriptBasePath(),
    onScriptStart: deps.onScriptStart,
    onLineExecuted: deps.onLineExecuted,
  });

  return {
    gameAPI: api,
    scriptContext,
    resolver,
    setRunParallelScript: (fn) => {
      ctx.runParallelScript = fn;
    },
  };
}

/**
 * Create ScriptContext for script execution (backwards-compatible entry point).
 *
 * @deprecated Prefer createGameAPIAndScriptContext() to get both APIs.
 */
export function createScriptContext(deps: ScriptContextDependencies): {
  scriptContext: ScriptContext;
  resolver: BlockingResolver;
} {
  const { scriptContext, resolver } = createGameAPIAndScriptContext(deps);
  return { scriptContext, resolver };
}
