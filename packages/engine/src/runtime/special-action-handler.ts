/**
 * Special Action Handler - Manages special action state updates
 * Extracted from GameManager to reduce complexity
 *
 * checks IsPlayCurrentDirOnceEnd()
 * Note: Magic state is now handled via Character.updateMagic() switch case,
 * this handler only manages script-triggered special actions (e.g., kneel/stand)
 */

import { EngineAccess } from "../core/engine-access";
import { logger } from "../core/logger";
import { CharacterState } from "../core/types";
import type { NpcManager } from "../npc";
import type { Player } from "../player/player";

/**
 * SpecialActionHandler - Manages special action completion checks
 * 通过 IEngineContext 获取 Player 和 NpcManager
 */
export class SpecialActionHandler extends EngineAccess {
  private get player(): Player {
    return this.engine.player as Player;
  }

  private get npcManager(): NpcManager {
    return this.engine.npcManager as NpcManager;
  }

  /**
   * Update special action states
   * checks IsPlayCurrentDirOnceEnd()
   */
  update(): void {
    this.updatePlayerSpecialAction();
    this.updateNpcSpecialActions();
  }

  /**
   * Update player special action (script-triggered actions like kneel/stand)
   * Note: Magic state is handled via Character.updateMagic() switch case
   */
  private updatePlayerSpecialAction(): void {
    const player = this.player;

    if (player.isInSpecialAction) {
      if (player.isSpecialActionEnd()) {
        player.endSpecialAction();
      }
    }
  }

  /**
   * Update NPC special actions
   */
  private updateNpcSpecialActions(): void {
    const npcManager = this.npcManager;

    // Use getAllNpcs to get Npc class instances
    for (const [, npc] of npcManager.getAllNpcs()) {
      if (npc.isInSpecialAction) {
        if (npc.isSpecialActionEnd()) {
          logger.log(`[SpecialAction] NPC "${npc.config.name}" special action ended`);
          npc.endSpecialAction();

          // Return NPC to Stand state
          if (
            npc.state === CharacterState.Magic ||
            npc.state === CharacterState.Attack ||
            npc.state === CharacterState.Attack1 ||
            npc.state === CharacterState.Attack2
          ) {
            npc.state = CharacterState.Stand;
          }
        }
      }
    }
  }
}
