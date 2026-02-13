/**
 * Command Registry - Central registry for all script commands
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */

import { registerDialogCommands } from "./dialog-commands";
import { registerGameStateCommands } from "./game-state-commands";
import { registerMiscCommands } from "./misc-commands";
import { registerNpcCommands } from "./npc-commands";
import { registerPlayerCommands } from "./player-commands";
import type { CommandRegistry } from "./types";

/**
 * Create and populate the command registry with all available commands
 */
export function createCommandRegistry(): CommandRegistry {
  const registry: CommandRegistry = new Map();

  // Register all command groups
  registerDialogCommands(registry);
  registerPlayerCommands(registry);
  registerNpcCommands(registry);
  registerGameStateCommands(registry);
  registerMiscCommands(registry);

  return registry;
}

// Re-export types
export type { CommandHandler, CommandHelpers, CommandRegistry, ScriptContext } from "./types";
