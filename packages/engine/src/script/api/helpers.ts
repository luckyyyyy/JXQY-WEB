/**
 * Script Command Helpers - Shared utilities for script command implementations
 * Eliminates duplication across playerCommands/npcCommands
 */

import type { Character } from "../../character/character";
import { logger } from "../../core/logger";
import type { Vector2 } from "../../core/types";

/**
 * Check if a character has finished moving to destination and is standing.
 * Shared implementation of C# IsCharacterMoveEndAndStanding.
 *
 * @param character The character to check
 * @param destination Target tile position
 * @param reissueMove Called to re-issue movement if character stopped early
 * @param isMapObstacle Map obstacle checker
 * @param tag Log tag for warnings
 */
export function isCharacterMoveEnd(
  character: Character | null,
  destination: Vector2,
  reissueMove: (character: Character, dest: Vector2) => void,
  isMapObstacle: (x: number, y: number) => boolean,
  tag: string,
): boolean {
  if (!character) return true;

  const pos = character.tilePosition;
  const atDestination = pos.x === destination.x && pos.y === destination.y;

  if (!atDestination) {
    if (character.isStanding()) {
      reissueMove(character, destination);
    }

    const path = character.path;
    if (!path || path.length === 0) {
      character.standingImmediately();
    } else if (
      path.length === 1 &&
      (pos.x !== path[0].x || pos.y !== path[0].y) &&
      character.hasObstacle(path[0])
    ) {
      character.standingImmediately();
    } else if (isMapObstacle(pos.x, pos.y)) {
      logger.warn(
        `[${tag}] stuck on map obstacle at (${pos.x}, ${pos.y}), giving up move to (${destination.x}, ${destination.y})`
      );
      character.standingImmediately();
    } else {
      return false;
    }
    return true;
  }

  // At destination but still moving → not done yet
  return character.isStanding();
}
