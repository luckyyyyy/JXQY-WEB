/**
 * Script API Factory - Creates GameAPI for script execution
 *
 * GameAPI is the structured interface used by all script engines:
 * - Custom DSL script engine (commands/)
 * - Future JS/Lua script engines
 */

import { createGameAPIImpl } from "./api";
import type { GameAPI } from "./api/game-api";
import type { ScriptCommandContext } from "./api/types";
import { BlockingResolver } from "./blocking-resolver";
import type { ScriptDebugHooks } from "./executor";

/**
 * Create GameAPI and BlockingResolver from a ScriptCommandContext.
 *
 * Returns the structured GameAPI used by command handlers and future JS/Lua engines.
 */
export function createScriptAPI(ctx: ScriptCommandContext): {
  api: GameAPI;
  resolver: BlockingResolver;
  debugHooks: ScriptDebugHooks;
  /** Set runParallelScript callback (must be called after ScriptExecutor is created) */
  setRunParallelScript: (fn: (scriptFile: string, delayMs: number) => void) => void;
} {
  const resolver = new BlockingResolver();
  const { api, ctx: finalCtx } = createGameAPIImpl(ctx, resolver);

  return {
    api,
    resolver,
    debugHooks: {
      onScriptStart: ctx.onScriptStart,
      onLineExecuted: ctx.onLineExecuted,
    },
    setRunParallelScript: (fn) => {
      finalCtx.runParallelScript = fn;
    },
  };
}
