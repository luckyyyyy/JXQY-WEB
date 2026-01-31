/**
 * Special Action Handler - Manages special action state updates
 * Extracted from GameManager to reduce complexity
 *
 * C# Reference: Character.Update checks IsPlayCurrentDirOnceEnd()
 * Note: Magic state is now handled via Character.updateMagic() switch case,
 * this handler only manages script-triggered special actions (e.g., kneel/stand)
 */

import type { NpcManager } from "../character/npcManager";
import { getEngineContext } from "../core/engineContext";
import { logger } from "../core/logger";
import { CharacterState } from "../core/types";
import type { Player } from "../player/player";

/**
 * SpecialActionHandler - Manages special action completion checks
 * 通过 IEngineContext 获取 Player 和 NpcManager
 */
export class SpecialActionHandler {
  /**
   * 获取 Player（通过 IEngineContext）
   */
  private get player(): Player {
    const ctx = getEngineContext();
    return ctx.getPlayer() as Player;
  }

  /**
   * 获取 NpcManager（通过 IEngineContext）
   */
  private get npcManager(): NpcManager {
    const ctx = getEngineContext();
    return ctx.getNpcManager() as NpcManager;
  }

  /**
   * Update special action states
   * C# Reference: Character.Update checks IsPlayCurrentDirOnceEnd()
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
        // State is already set to Stand by endSpecialAction()
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
