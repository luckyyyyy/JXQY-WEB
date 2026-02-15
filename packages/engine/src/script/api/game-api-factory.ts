/**
 * GameAPI Factory - Creates a complete GameAPI from ScriptCommandContext
 */

import type { BlockingResolver } from "../blocking-resolver";
import type { GameAPI } from "./game-api";
import { createGoodsAPI, createMagicAPI, createMemoAPI } from "./item-api";
import { createNpcAPI } from "./npc-api";
import { createPlayerAPI } from "./player-api";
import {
  createDialogAPI,
  createInputAPI,
  createSaveAPI,
  createScriptRunnerAPI,
  createVariableAPI,
} from "./system-api";
import type { ScriptCommandContext } from "./types";
import {
  createAudioAPI,
  createCameraAPI,
  createEffectsAPI,
  createMapAPI,
  createObjAPI,
  createTimerAPI,
} from "./world-api";

/**
 * Create a complete GameAPI instance from ScriptCommandContext.
 */
export function createGameAPIImpl(
  ctx: ScriptCommandContext,
  resolver: BlockingResolver
): {
  api: GameAPI;
  ctx: ScriptCommandContext;
} {
  const api: GameAPI = {
    player: createPlayerAPI(ctx, resolver),
    npc: createNpcAPI(ctx, resolver),
    goods: createGoodsAPI(ctx, resolver),
    magic: createMagicAPI(ctx),
    memo: createMemoAPI(ctx),
    map: createMapAPI(ctx),
    obj: createObjAPI(ctx),
    camera: createCameraAPI(ctx, resolver),
    audio: createAudioAPI(ctx, resolver),
    effects: createEffectsAPI(ctx, resolver),
    dialog: createDialogAPI(ctx, resolver),
    timer: createTimerAPI(ctx),
    variables: createVariableAPI(ctx),
    input: createInputAPI(ctx),
    save: createSaveAPI(ctx),
    script: createScriptRunnerAPI(ctx, resolver),
  };

  return { api, ctx };
}
