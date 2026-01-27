/**
 * Special Action Handler - Manages special action state updates
 * Extracted from GameManager to reduce complexity
 *
 * C# Reference: Character.Update checks IsPlayCurrentDirOnceEnd()
 * Note: Magic state is now handled via Character.updateMagic() switch case,
 * this handler only manages script-triggered special actions (e.g., kneel/stand)
 */
import { CharacterState } from "../core/types";
import type { Player } from "../character/player";
import type { NpcManager } from "../character/npcManager";

/**
 * Dependencies for SpecialActionHandler
 */
export interface SpecialActionHandlerDependencies {
  player: Player;
  npcManager: NpcManager;
}

/**
 * SpecialActionHandler - Manages special action completion checks
 */
export class SpecialActionHandler {
  private deps: SpecialActionHandlerDependencies;

  constructor(deps: SpecialActionHandlerDependencies) {
    this.deps = deps;
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
    const { player } = this.deps;

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
    const { npcManager } = this.deps;

    // Use getAllNpcs to get Npc class instances
    for (const [, npc] of npcManager.getAllNpcs()) {
      if (npc.isInSpecialAction) {
        if (npc.isSpecialActionEnd()) {
          console.log(`[SpecialAction] NPC "${npc.config.name}" special action ended`);
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
