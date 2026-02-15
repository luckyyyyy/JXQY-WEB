/**
 * Audio Commands - PlayMusic, StopMusic, PlaySound, PlayMovie, StopSound
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
import { logger } from "../../core/logger";
import type { CommandHandler, CommandRegistry } from "./types";

/**
 * PlayMusic - Play background music
 */
const playMusicCommand: CommandHandler = (params, _result, helpers) => {
  const file = helpers.resolveString(params[0] || "");
  helpers.api.audio.playMusic(file);
  return true;
};

/**
 * StopMusic - Stop background music
 */
const stopMusicCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.audio.stopMusic();
  return true;
};

/**
 * PlaySound - Play sound effect with optional 3D positioning
 * PlaySound uses belongObject (Sprite) position for 3D spatial audio
 * SoundManager.Play3DSoundOnece(sound, soundPosition - Globals.ListenerPosition)
 */
const playSoundCommand: CommandHandler = (params, _result, helpers) => {
  const file = helpers.resolveString(params[0] || "");
  logger.log(`[ScriptExecutor] PlaySound: "${file}"`);

  // var soundPosition = Globals.ListenerPosition;
  // var sprit = belongObject as Sprite;
  // if (sprit != null) soundPosition = sprit.PositionInWorld;
  const belongObject = helpers.state.belongObject;
  if (belongObject) {
    let position: { x: number; y: number } | null = null;

    if (belongObject.type === "npc") {
      // Get NPC position
      position = helpers.api.npc.getPosition?.(belongObject.id) ?? null;
    } else if (belongObject.type === "obj") {
      // Get OBJ position
      position = helpers.api.obj.getPosition?.(belongObject.id) ?? null;
    }

    if (position) {
      helpers.api.audio.playSound(file, position);
      return true;
    }
  }

  // Fallback to non-positional sound (when no belongObject or position not found)
  helpers.api.audio.playSound(file);
  return true;
};

/**
 * PlayMovie - Play video file (BLOCKING)
 * PlayMovie(fileName) plays video using XNA VideoPlayer
 * Blocks script execution until video ends or is skipped
 */
const playMovieCommand: CommandHandler = async (params, _result, helpers) => {
  const file = helpers.resolveString(params[0] || "");
  logger.log(`[ScriptExecutor] PlayMovie: "${file}"`);
  await helpers.api.audio.playMovie(file);
  return true;
};

/**
 * StopSound - Stop all sounds
 */
const stopSoundCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.audio.stopSound();
  return true;
};

export function registerAudioCommands(registry: CommandRegistry): void {
  registry.set("playmusic", playMusicCommand);
  registry.set("stopmusic", stopMusicCommand);
  registry.set("playsound", playSoundCommand);
  registry.set("playmovie", playMovieCommand);
  registry.set("stopsound", stopSoundCommand);
}
