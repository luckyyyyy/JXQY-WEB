/**
 * Command Registry - Central registry for all script commands
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */

import { registerDialogCommands } from "./dialogCommands";
import { registerGameStateCommands } from "./gameStateCommands";
import { registerMiscCommands } from "./miscCommands";
import { registerNpcCommands } from "./npcCommands";
import { registerPlayerCommands } from "./playerCommands";
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
