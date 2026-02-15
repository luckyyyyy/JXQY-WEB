/**
 * Command Handler Types
 * Shared types for script command handlers
 */

import type { GameAPI } from "../api/game-api";
import type { ScriptState } from "../types";

/**
 * Command handler function signature
 * Returns true to continue execution, false to pause
 */
export type CommandHandler = (
  params: string[],
  result: string,
  helpers: CommandHelpers
) => Promise<boolean> | boolean;

/**
 * Helper functions available to command handlers.
 * Command handlers access game functionality through the structured GameAPI.
 */
export interface CommandHelpers {
  api: GameAPI;
  state: ScriptState;
  resolveString: (value: string) => string;
  resolveNumber: (value: string) => number;
  gotoLabel: (label: string) => void;
  endScript: () => void;
}

/**
 * Command registry type
 */
export type CommandRegistry = Map<string, CommandHandler>;
