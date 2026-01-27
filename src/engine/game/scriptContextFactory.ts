/**
 * Script Context Factory - Creates ScriptContext for script execution
 * Extracted from GameManager to reduce complexity
 *
 * Based on C#'s ScriptExecuter context bindings
 */
import type { Vector2, PlayerData } from "../core/types";
import type { ScriptContext } from "../script/executor";
import { CharacterState } from "../core/types";
import type { Player } from "../character/player";
import type { Npc } from "../character/npc";
import type { NpcManager } from "../character/npcManager";
import type { GuiManager } from "../gui/guiManager";
import type { AudioManager } from "../audio";
import type { ScreenEffects } from "../effects";
import type { ObjManager } from "../obj";
import type { GoodsListManager, Good } from "../goods";
import type { MemoListManager } from "../listManager";
import type { GlobalResourceManager } from "../resource";

/**
 * Dependencies needed to create a script context
 */
export interface ScriptContextDependencies {
  // Controllers
  player: Player;
  npcManager: NpcManager;
  guiManager: GuiManager;
  objManager: ObjManager;
  audioManager: AudioManager;
  screenEffects: ScreenEffects;
  globalResources: GlobalResourceManager;
  goodsListManager: GoodsListManager;
  memoListManager: MemoListManager;

  // State accessors
  getVariables: () => Record<string, number>;
  setVariable: (name: string, value: number) => void;
  getCurrentMapName: () => string;

  // Actions
  loadMap: (mapPath: string) => Promise<void>;
  loadNpcFile: (fileName: string) => Promise<void>;
  loadGameSave: (index: number) => Promise<void>;
  setMapTrap: (trapIndex: number, trapFileName: string, mapName?: string) => void;
  checkTrap: (tile: Vector2) => void;
  cameraMoveTo: (direction: number, distance: number, speed: number) => void;
  isCameraMoving: () => boolean;
  runScript: (scriptFile: string) => Promise<void>;

  // Debug hooks (optional)
  onScriptStart?: (filePath: string, totalLines: number, allCodes: string[]) => void;
}

/**
 * Create ScriptContext for script execution
 * This is the bridge between script commands and game systems
 */
export function createScriptContext(deps: ScriptContextDependencies): ScriptContext {
  const {
    player,
    npcManager,
    guiManager,
    objManager,
    audioManager,
    screenEffects,
    globalResources,
    goodsListManager,
    getVariables,
    setVariable,
    getCurrentMapName,
    loadMap,
    loadNpcFile,
    loadGameSave,
    setMapTrap,
    checkTrap,
    cameraMoveTo,
    isCameraMoving,
    runScript,
  } = deps;

  // 从 globalResources 获取需要的子系统
  const { talkTextList, levelManager } = globalResources;

  /**
   * Get character by name (player or NPC)
   * Based on C#'s GetPlayerOrNpc
   */
  const getCharacterByName = (name: string): Npc | Player | null => {
    if (player && player.name === name) {
      return player;
    }
    return npcManager.getNpc(name);
  };

  /**
   * Get base path for scripts
   */
  const getScriptBasePath = (): string => {
    const mapName = getCurrentMapName();
    const basePath = mapName
      ? `/resources/script/map/${mapName}`
      : "/resources/script/common";
    return basePath;
  };

  return {
    // System access
    talkTextList,

    // Variables
    getVariable: (name) => getVariables()[name] || 0,
    setVariable: (name, value) => {
      setVariable(name, value);
    },

    // Dialog
    showDialog: (text, portraitIndex) => {
      guiManager.showDialog(text, portraitIndex);
    },
    showMessage: (text) => {
      guiManager.showMessage(text);
    },
    showDialogSelection: (message, selectA, selectB) => {
      guiManager.showDialogSelection(message, selectA, selectB);
    },
    showSelection: (options, message) => {
      guiManager.showSelection(
        options.map((o) => ({ ...o, enabled: true })),
        message || ""
      );
    },

    // Map
    loadMap: async (mapName) => {
      await loadMap(mapName);
    },
    loadNpc: async (fileName) => {
      await loadNpcFile(fileName);
    },
    loadGame: async (index) => {
      await loadGameSave(index);
    },
    setPlayerPosition: (x, y) => {
      player.setPosition(x, y);
      // After setting position, check and trigger trap at current position
      checkTrap({ x, y });
    },
    setPlayerDirection: (direction) => {
      player.setDirection(direction);
    },
    setPlayerState: (state) => {
      player.setState(state);
    },
    playerGoto: (x, y) => {
      player.walkToTile(x, y);
    },
    isPlayerGotoEnd: (destination) => {
      if (!player) return true;

      const pos = player.getTilePosition();
      const atDestination =
        pos.x === destination.x &&
        pos.y === destination.y;

      const isStanding =
        player.state === CharacterState.Stand ||
        player.state === CharacterState.Stand1;

      if (atDestination && isStanding) {
        return true;
      }

      if (!atDestination && isStanding) {
        if (!player.path || player.path.length === 0) {
          const success = player.walkToTile(destination.x, destination.y);
          if (!success || !player.path || player.path.length === 0) {
            return true;
          }
        }
      }

      return false;
    },
    playerRunTo: (x, y) => {
      player.runToTile(x, y);
    },
    isPlayerRunToEnd: (destination) => {
      if (!player) return true;

      const pos = player.getTilePosition();
      const atDestination =
        pos.x === destination.x &&
        pos.y === destination.y;

      const isStanding =
        player.state === CharacterState.Stand ||
        player.state === CharacterState.Stand1;

      if (atDestination && isStanding) {
        return true;
      }

      if (!atDestination && isStanding) {
        if (!player.path || player.path.length === 0) {
          const success = player.runToTile(destination.x, destination.y);
          if (!success || !player.path || player.path.length === 0) {
            return true;
          }
        }
      }

      return false;
    },
    playerGotoDir: (direction, steps) => {
      player.walkToDirection(direction, steps);
    },
    isPlayerGotoDirEnd: () => {
      if (!player) return true;
      return (
        player.state === CharacterState.Stand ||
        player.state === CharacterState.Stand1
      );
    },

    // NPC
    addNpc: (npcFile, x, y) => {
      npcManager.addNpc(`/resources/ini/npc/${npcFile}`, x, y);
    },
    deleteNpc: (name) => {
      npcManager.deleteNpc(name);
    },
    getNpcPosition: (name) => {
      const character = getCharacterByName(name);
      return character ? character.tilePosition : null;
    },
    setNpcPosition: (name, x, y) => {
      if (player && player.name === name) {
        player.setPosition(x, y);
        return;
      }
      npcManager.setNpcPosition(name, x, y);
    },
    npcGoto: (name, x, y) => {
      if (player && player.name === name) {
        player.walkToTile(x, y);
        return;
      }
      npcManager.npcGoto(name, x, y);
    },
    isNpcGotoEnd: (name, destination) => {
      if (player && player.name === name) {
        const pos = player.getTilePosition();
        const atDestination =
          pos.x === destination.x &&
          pos.y === destination.y;

        const isStanding =
          player.state === CharacterState.Stand ||
          player.state === CharacterState.Stand1;

        if (atDestination && isStanding) {
          return true;
        }

        if (!atDestination && isStanding) {
          player.walkToTile(destination.x, destination.y);
        }

        return false;
      }

      const npc = npcManager.getNpc(name);
      if (!npc) return true;

      const atDestination =
        npc.tilePosition.x === destination.x &&
        npc.tilePosition.y === destination.y;

      const isStanding =
        npc.state === CharacterState.Stand ||
        npc.state === CharacterState.Stand1;

      if (atDestination && isStanding) {
        return true;
      }

      if (!atDestination && isStanding) {
        npcManager.npcGoto(name, destination.x, destination.y);
      }

      return false;
    },
    npcGotoDir: (name, direction, steps) => {
      if (player && player.name === name) {
        player.walkToDirection(direction, steps);
        return;
      }
      npcManager.npcGotoDir(name, direction, steps);
    },
    isNpcGotoDirEnd: (name) => {
      if (player && player.name === name) {
        return (
          player.state === CharacterState.Stand ||
          player.state === CharacterState.Stand1
        );
      }

      const npc = npcManager.getNpc(name);
      if (!npc) return true;
      return (
        npc.state === CharacterState.Stand ||
        npc.state === CharacterState.Stand1
      );
    },
    setNpcActionFile: (name, stateType, asfFile) => {
      console.log(`[ScriptContext] SetNpcActionFile: name="${name}", state=${stateType}, file="${asfFile}"`);
      if (player && player.name === name) {
        // Check if this is the first time setting custom ASF for this state
        const isFirstTimeSet = !player.customActionFiles.has(stateType) ||
                               !(player as any)._customAsfCache?.has(stateType);

        // Use Player's setNpcActionFile method
        player.setNpcActionFile(stateType, asfFile);

        // Preload the ASF file
        player.preloadCustomActionFile(stateType, asfFile)
          .then(() => {
            // Only update texture immediately if:
            // 1. This is the first time setting custom ASF for this state
            // 2. Current state matches the one we just loaded
            // This ensures initial setup works, but later changes don't interrupt animations
            if (isFirstTimeSet && player.state === stateType) {
              (player as any)._updateTextureForState(stateType);
            }
          })
          .catch((err: any) => console.error(`Failed to preload player custom action file:`, err));
        return;
      }
      npcManager.setNpcActionFile(name, stateType, asfFile);
    },
    npcSpecialAction: (name, asfFile) => {
      const isPlayer = player.name === name;

      if (isPlayer) {
        console.log(`[ScriptContext] NpcSpecialAction for player: ${asfFile}`);
        // Use Player's setSpecialAction method
        player.setSpecialAction(asfFile)
          .then((success: boolean) => {
            if (!success) {
              console.warn(`[ScriptContext] Failed to start player special action, clearing state`);
            }
          })
          .catch((err: any) => {
            console.error(`Failed to start player special action:`, err);
            player.isInSpecialAction = false;
          });
      } else {
        // Use getNpc to get Npc class instance
        const npc = npcManager.getNpc(name);
        if (npc) {
          console.log(`[ScriptContext] NpcSpecialAction for NPC "${name}": ${asfFile}`);
          // Use Npc's setSpecialAction method
          npc.setSpecialAction(asfFile)
            .then((success: boolean) => {
              if (!success) {
                console.warn(`[ScriptContext] Failed to start NPC special action, clearing state`);
              }
            })
            .catch((err: any) => {
              console.error(`Failed to start NPC special action:`, err);
              npc.isInSpecialAction = false;
            });
        } else {
          console.warn(`[ScriptContext] NpcSpecialAction: NPC not found: ${name}`);
        }
      }
    },
    isNpcSpecialActionEnd: (name) => {
      if (player && player.name === name) {
        return !player.isInSpecialAction;
      }

      const npc = npcManager.getNpc(name);
      if (!npc) return true;
      return !npc.isInSpecialAction;
    },
    setNpcLevel: (name, level) => {
      if (player.name === name) {
        console.log(`[ScriptContext] SetNpcLevel: setting player level to ${level}`);
        player.setLevelTo(level);
      } else {
        npcManager.setNpcLevel(name, level);
      }
    },
    setNpcDirection: (name, direction) => {
      npcManager.setNpcDirection(name, direction);
    },
    setNpcState: (name, state) => {
      npcManager.setNpcState(name, state);
    },

    // Player
    addGoods: async (goodsName, count) => {
      console.log(`AddGoods: ${goodsName} x${count}`);
      let addedGood: Good | null = null;
      for (let i = 0; i < count; i++) {
        const result = await goodsListManager.addGoodToList(goodsName);
        if (result.success && result.good) {
          addedGood = result.good;
        }
      }
      // C# Reference: ScriptExecuter.AddGoods - shows message when item added
      if (addedGood) {
        guiManager.showMessage(`你获得了${addedGood.name}`);
      }
      // Note: GoodsListManager.addGoodToList already calls onUpdateView callback
    },
    removeGoods: (goodsName, count) => {
      console.log(`RemoveGoods: ${goodsName} x${count}`);
      goodsListManager.deleteGoodByName(goodsName, count);
    },
    equipGoods: async (goodsIndex, equipSlot) => {
      const equipIndex = equipSlot + 200;
      console.log(`EquipGoods: from index ${goodsIndex} to slot ${equipIndex}`);
      goodsListManager.exchangeListItemAndEquiping(goodsIndex, equipIndex);
    },
    addMoney: (amount) => {
      player.addMoney(amount);
    },
    addExp: (amount) => {
      player.addExp(amount);
    },

    // Memo functions
    addMemo: (text) => {
      guiManager.addMemo(text);
    },
    delMemo: (text) => {
      guiManager.delMemo(text);
    },
    addToMemo: async (memoId) => {
      await guiManager.addToMemo(memoId);
    },
    delMemoById: async (memoId) => {
      await deps.memoListManager.delMemoById(memoId);
      guiManager.updateMemoView();
    },

    // Obj
    loadObj: async (fileName) => {
      console.log(`[ScriptContext] LoadObj command: ${fileName}`);
      const result = await objManager.load(fileName);
      console.log(`[ScriptContext] LoadObj result: ${result}`);
    },
    addObj: async (fileName, x, y, direction) => {
      console.log(`[ScriptContext] AddObj command: ${fileName} at (${x}, ${y}) dir=${direction}`);
      await objManager.addObjByFile(fileName, x, y, direction);
    },
    delCurObj: () => {
      // C# Reference: ScriptExecuter.DelCurObj - removes the object that triggered the script
      // The belongObject is stored in ScriptState, accessed via command handler
      // This is a no-op as the actual deletion is handled by delObj with __id__ prefix
      console.log(`[ScriptContext] DelCurObj command (no-op, handled by delObj)`);
    },
    delObj: (objNameOrId) => {
      // Support both name-based and id-based deletion
      // ID-based: "__id__:xxx" format (used by DelCurObj)
      if (objNameOrId.startsWith("__id__:")) {
        const id = objNameOrId.substring(7);
        console.log(`[ScriptContext] DelObj by id: ${id}`);
        objManager.deleteObjById(id);
      } else {
        console.log(`[ScriptContext] DelObj by name: ${objNameOrId}`);
        objManager.deleteObj(objNameOrId);
      }
    },
    openBox: (objNameOrId) => {
      // C# Reference: ScriptExecuter.OpenBox - plays box opening animation
      // If no name provided, uses belongObject (handled by command)
      if (objNameOrId) {
        console.log(`[ScriptContext] OpenBox: ${objNameOrId}`);
        objManager.openBox(objNameOrId);
      }
    },
    closeBox: (objNameOrId) => {
      // C# Reference: ScriptExecuter.CloseBox - plays box closing animation
      if (objNameOrId) {
        console.log(`[ScriptContext] CloseBox: ${objNameOrId}`);
        objManager.closeBox(objNameOrId);
      }
    },
    setObjScript: (objNameOrId, scriptFile) => {
      // C# Reference: ScriptExecuter.SetObjScript - sets object's script file
      // When scriptFile is empty, the object becomes non-interactive
      console.log(`[ScriptContext] SetObjScript: ${objNameOrId} -> "${scriptFile}"`);
      objManager.setObjScript(objNameOrId, scriptFile);
    },
    addRandGoods: async (buyFileName) => {
      // C# Reference: ScriptExecuter.AddRandGoods
      // Reads ini/buy/{buyFileName}, picks random item, calls AddGoods
      console.log(`[ScriptContext] AddRandGoods: ${buyFileName}`);
      try {
        const filePath = `/resources/ini/buy/${buyFileName}`;
        const response = await fetch(filePath);
        if (!response.ok) {
          console.warn(`[ScriptContext] Failed to load buy file: ${filePath}`);
          return;
        }
        const content = await response.text();

        // Parse INI file
        const lines = content.split(/\r?\n/);
        const items: string[] = [];
        let currentSection = "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(";")) continue;

          const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
          if (sectionMatch) {
            currentSection = sectionMatch[1];
            continue;
          }

          // Parse IniFile entries from numbered sections
          if (currentSection && currentSection !== "Header") {
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx > 0) {
              const key = trimmed.substring(0, eqIdx).trim();
              const value = trimmed.substring(eqIdx + 1).trim();
              if (key === "IniFile") {
                items.push(value);
              }
            }
          }
        }

        if (items.length === 0) {
          console.warn(`[ScriptContext] No items found in buy file: ${buyFileName}`);
          return;
        }

        // Pick random item
        const randomIndex = Math.floor(Math.random() * items.length);
        const randomItem = items[randomIndex];
        console.log(`[ScriptContext] AddRandGoods picked: ${randomItem}`);

        // Add the item using existing addGoods logic
        const result = await goodsListManager.addGoodToList(randomItem);
        if (result.success && result.good) {
          guiManager.showMessage(`你获得了${result.good.name}`);
        }
        // Note: GoodsListManager.addGoodToList already calls onUpdateView callback
      } catch (error) {
        console.error(`[ScriptContext] AddRandGoods error:`, error);
      }
    },

    // Trap management
    setMapTrap: (trapIndex, trapFileName, mapName) => {
      setMapTrap(trapIndex, trapFileName, mapName);
    },

    // Game flow
    sleep: (ms) => {
      // Note: This is handled by the caller, not stored here
    },
    playMusic: (file) => {
      audioManager.playMusic(file);
    },
    stopMusic: () => {
      audioManager.stopMusic();
    },
    playSound: (file) => {
      audioManager.playSound(file);
    },
    fadeIn: () => {
      screenEffects.fadeIn();
    },
    fadeOut: () => {
      screenEffects.fadeOut();
    },
    isFadeInEnd: () => {
      return screenEffects.isFadeInEnd();
    },
    isFadeOutEnd: () => {
      return screenEffects.isFadeOutEnd();
    },
    moveScreen: (direction, distance, speed) => {
      cameraMoveTo(direction, distance, speed);
    },
    isMoveScreenEnd: () => {
      return !isCameraMoving();
    },
    changeMapColor: (r, g, b) => {
      screenEffects.setMapColor(r, g, b);
    },
    changeAsfColor: (r, g, b) => {
      screenEffects.setSpriteColor(r, g, b);
    },
    setLevelFile: async (file) => {
      const basePath = `/resources/ini/level/`;
      const paths = [
        `${basePath}${file}`,
        `${basePath}${file.toLowerCase()}`,
      ];

      for (const path of paths) {
        try {
          const response = await fetch(path, { method: 'HEAD' });
          if (response.ok) {
            await levelManager.setPlayerLevelFile(path);
            console.log(`[ScriptContext] Level file set to: ${path}`);
            return;
          }
        } catch {
          // Try next path
        }
      }
      console.warn(`[ScriptContext] Could not load level file: ${file}`);
    },

    // Wait for input
    waitForDialogClose: () => {
      // Handled by script executor
    },
    waitForSelection: () => {
      // Handled by script executor
    },
    getSelectionResult: () => {
      return guiManager.getState().selection.selectedIndex;
    },

    // Script management
    runScript: async (scriptFile) => {
      const basePath = getScriptBasePath();
      await runScript(`${basePath}/${scriptFile}`);
    },
    getCurrentMapPath: () => "", // Will be overridden by caller

    // Debug hooks
    onScriptStart: deps.onScriptStart,
  };
}
