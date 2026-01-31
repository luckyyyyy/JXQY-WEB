/**
 * Script Context Factory - Creates ScriptContext for script execution
 * Extracted from GameManager to reduce complexity
 *
 * Based on C#'s ScriptExecuter context bindings
 */

import type { AudioManager } from "../audio";
import type { Character } from "../character/character";
import type { Npc } from "../character/npc";
import type { NpcManager } from "../character/npcManager";
import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import { CharacterState } from "../core/types";
import { getNeighbors, tileToPixel } from "../core/utils";
import type { ScreenEffects } from "../effects";
import type { BuyManager } from "../gui/buyManager";
import type { GuiManager } from "../gui/guiManager";
import { partnerList } from "../listManager/partnerList";
import type { MemoListManager, TalkTextListManager } from "../listManager";
import type { ObjManager } from "../obj";
import type { Good } from "../player/goods";
import type { Player } from "../player/player";
import { resourceLoader } from "../resource/resourceLoader";
import type { ScriptContext } from "../script/executor";
import type { TimerManager } from "../timer";
import type { WeatherManager } from "../weather";
import { ResourcePath } from "../../config/resourcePaths";

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
  talkTextList: TalkTextListManager;
  memoListManager: MemoListManager;
  weatherManager: WeatherManager;
  timerManager: TimerManager;
  buyManager: BuyManager;

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
  cameraMoveToPosition: (destX: number, destY: number, speed: number) => void;
  isCameraMoving: () => boolean;
  isCameraMoveToPositionEnd: () => boolean;
  setCameraPosition: (pixelX: number, pixelY: number) => void;
  centerCameraOnPlayer: () => void;
  runScript: (scriptFile: string) => Promise<void>;

  // Save/Drop flags
  enableSave: () => void;
  disableSave: () => void;
  enableDrop: () => void;
  disableDrop: () => void;

  // Show map pos flag
  setScriptShowMapPos: (show: boolean) => void;

  // Map time
  setMapTime: (time: number) => void;

  // Trap save
  saveMapTrap: () => void;

  // Debug hooks (optional)
  onScriptStart?: (filePath: string, totalLines: number, allCodes: string[]) => void;
  onLineExecuted?: (filePath: string, lineNumber: number) => void;

  // Input control (optional)
  clearMouseInput?: () => void;

  // Return to title
  returnToTitle: () => void;

  // Parallel script (optional - set after ScriptExecutor is created)
  runParallelScript?: (scriptFile: string, delayMs: number) => void;
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
    talkTextList,
    weatherManager,
    timerManager,
    buyManager,
    getVariables,
    setVariable,
    getCurrentMapName,
    loadMap,
    loadNpcFile,
    loadGameSave,
    setMapTrap,
    checkTrap,
    cameraMoveTo,
    cameraMoveToPosition,
    isCameraMoving,
    isCameraMoveToPositionEnd,
    setCameraPosition,
    centerCameraOnPlayer,
    runScript,
    enableSave,
    disableSave,
    enableDrop,
    disableDrop,
  } = deps;

  // 从 player 获取 levelManager 和 goodsListManager
  const levelManager = player.levelManager;
  const goodsListManager = player.getGoodsListManager();

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
   * Get all characters by name (player and/or NPCs)
   * Returns array for commands that need to apply to all matching characters
   */
  const getCharactersByName = (name: string): (Npc | Player)[] => {
    const result: (Npc | Player)[] = [];
    if (player && player.name === name) {
      result.push(player);
    }
    const npcs = npcManager.getAllNpcsByName(name);
    result.push(...npcs);
    return result;
  };

  /**
   * Get base path for scripts
   */
  const getScriptBasePath = (): string => {
    const mapName = getCurrentMapName();
    const basePath = mapName
      ? ResourcePath.scriptMap(mapName)
      : ResourcePath.scriptCommon("").replace(/\/$/, "");
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
      deps.clearMouseInput?.(); // 清除鼠标按住状态，打断用户输入
      guiManager.showDialog(text, portraitIndex);
    },
    showMessage: (text) => {
      guiManager.showMessage(text);
    },
    showDialogSelection: (message, selectA, selectB) => {
      deps.clearMouseInput?.(); // 清除鼠标按住状态，打断用户输入
      guiManager.showDialogSelection(message, selectA, selectB);
    },
    showSelection: (options, message) => {
      deps.clearMouseInput?.(); // 清除鼠标按住状态，打断用户输入
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
    setPlayerPosition: (x, y, characterName?) => {
      // C#: SetPlayerPos supports both 2-param and 3-param versions
      // 3-param: SetPlayerPos(name, x, y) - set position for named character
      // 2-param: SetPlayerPos(x, y) - set position for PlayerKindCharacter
      let targetCharacter: Player | Npc | null = null;

      if (characterName) {
        // 3-param version: find character by name
        if (player && player.name === characterName) {
          targetCharacter = player;
        } else {
          targetCharacter = npcManager.getNpc(characterName);
        }
      } else {
        // 2-param version: use PlayerKindCharacter
        // C#: Globals.PlayerKindCharacter = NpcManager.GetPlayerKindCharacter()
        //       ?? (ThePlayer.ControledCharacter ?? ThePlayer)
        const npcWithPlayerKind = npcManager.getPlayerKindCharacter();
        if (npcWithPlayerKind) {
          targetCharacter = npcWithPlayerKind;
        } else if (player.controledCharacter) {
          targetCharacter = player.controledCharacter as Player | Npc;
        } else {
          targetCharacter = player;
        }
      }

      if (!targetCharacter) {
        logger.warn(`[ScriptContext] SetPlayerPos: character not found: ${characterName}`);
        return;
      }

      targetCharacter.setPosition(x, y);

      // C#: SetPlayerPos 后调用 Globals.TheCarmera.CenterPlayerInCamera()
      centerCameraOnPlayer();

      // Reset partner position relate to player position
      if (player) {
        player.resetPartnerPosition?.();
      }

      // After setting position, check and trigger trap at current position
      // C#: Globals.ThePlayer.CheckMapTrap() - we use checkTrap which handles this
      checkTrap({ x, y });
    },
    setPlayerDirection: (direction) => {
      player.setDirection(direction);
    },
    setPlayerState: (state) => {
      // C#: Globals.ThePlayer.SetFightState(int.Parse(parameters[0]) != 0)
      // state != 0 means enter fighting mode, state == 0 means exit fighting mode
      player.setFightState(state !== 0);
    },
    playerGoto: (x, y) => {
      player.walkToTile(x, y);
    },
    isPlayerGotoEnd: (destination) => {
      if (!player) return true;

      const pos = player.tilePosition;
      const atDestination = pos.x === destination.x && pos.y === destination.y;

      const isStanding =
        player.state === CharacterState.Stand || player.state === CharacterState.Stand1;

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

      const pos = player.tilePosition;
      const atDestination = pos.x === destination.x && pos.y === destination.y;

      const isStanding =
        player.state === CharacterState.Stand || player.state === CharacterState.Stand1;

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
      return player.state === CharacterState.Stand || player.state === CharacterState.Stand1;
    },

    // NPC
    addNpc: (npcFile, x, y, direction?) => {
      // C#: NpcManager.AddNpc(file, x, y, direction) - direction defaults to 4 (south)
      npcManager.addNpc(ResourcePath.npc(npcFile), x, y, direction ?? 4);
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
      // C# Reference: IsCharacterMoveEndAndStanding(character, destinationTilePosition, isRun=false)
      // 获取角色
      let character: Character | null = null;
      if (player && player.name === name) {
        character = player;
      } else {
        character = npcManager.getNpc(name);
      }

      if (!character) return true;

      const tilePos = character.tilePosition;
      const atDestination = tilePos.x === destination.x && tilePos.y === destination.y;

      // C#: var isEnd = true;
      let isEnd = true;

      // C#: if (character != null && character.TilePosition != destinationTilePosition)
      if (!atDestination) {
        // C#: if (character.IsStanding()) { character.WalkTo(destinationTilePosition); }
        if (character.isStanding()) {
          character.walkTo(destination);
        }

        // C#: Check moveable - path validity
        // if (character.Path == null ||
        //     (character.Path.Count == 2 &&
        //      character.TilePosition != MapBase.ToTilePosition(character.Path.First.Next.Value) &&
        //      character.HasObstacle(MapBase.ToTilePosition(character.Path.First.Next.Value))))
        // { character.StandingImmediately(); }
        // else { isEnd = false; }
        const path = character.path;
        if (path.length === 0) {
          // Path is null/empty - can't move, end immediately
          character.standingImmediately();
        } else if (path.length >= 1) {
          // path[0] is the next tile (since path.slice(1) is stored)
          const nextTile = path[0];
          // C#: Path.Count == 2 意味着只剩一步要走
          // 检查下一步是否有障碍物
          if (
            path.length === 1 &&
            (tilePos.x !== nextTile.x || tilePos.y !== nextTile.y) &&
            character.hasObstacle(nextTile)
          ) {
            character.standingImmediately();
          } else {
            isEnd = false;
          }
        }
      } else {
        // C#: else if (character.TilePosition == destinationTilePosition && !character.IsStanding())
        // At destination tile but still moving - keep waiting
        if (!character.isStanding()) {
          isEnd = false;
        }
      }

      return isEnd;
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
        return player.state === CharacterState.Stand || player.state === CharacterState.Stand1;
      }

      const npc = npcManager.getNpc(name);
      if (!npc) return true;
      return npc.state === CharacterState.Stand || npc.state === CharacterState.Stand1;
    },
    setNpcActionFile: (name, stateType, asfFile) => {
      logger.log(
        `[ScriptContext] SetNpcActionFile: name="${name}", state=${stateType}, file="${asfFile}"`
      );
      if (player && player.name === name) {
        // Check if this is the first time setting custom ASF for this state
        const isFirstTimeSet =
          !player.customActionFiles.has(stateType) ||
          !(player as any)._customAsfCache?.has(stateType);

        // Use Player's setNpcActionFile method
        player.setNpcActionFile(stateType, asfFile);

        // Preload the ASF file
        player
          .preloadCustomActionFile(stateType, asfFile)
          .then(() => {
            // Only update texture immediately if:
            // 1. This is the first time setting custom ASF for this state
            // 2. Current state matches the one we just loaded
            // 3. Not in special action (avoid interrupting special action animation)
            if (isFirstTimeSet && player.state === stateType && !player.isInSpecialAction) {
              (player as any)._updateTextureForState(stateType);
            }
          })
          .catch((err: any) => logger.error(`Failed to preload player custom action file:`, err));
        return;
      }
      npcManager.setNpcActionFile(name, stateType, asfFile);
    },
    npcSpecialAction: (name, asfFile) => {
      const isPlayer = player.name === name;

      if (isPlayer) {
        // Use Player's setSpecialAction method
        player
          .setSpecialAction(asfFile)
          .then((success: boolean) => {
            if (!success) {
              logger.warn(`[ScriptContext] Failed to start player special action, clearing state`);
            }
          })
          .catch((err: any) => {
            logger.error(`Failed to start player special action:`, err);
            player.isInSpecialAction = false;
          });
      } else {
        // Use getNpc to get Npc class instance
        const npc = npcManager.getNpc(name);
        if (npc) {
          logger.log(`[ScriptContext] NpcSpecialAction for NPC "${name}": ${asfFile}`);
          // Use Npc's setSpecialAction method
          npc
            .setSpecialAction(asfFile)
            .then((success: boolean) => {
              if (!success) {
                logger.warn(`[ScriptContext] Failed to start NPC special action, clearing state`);
              }
            })
            .catch((err: any) => {
              logger.error(`Failed to start NPC special action:`, err);
              npc.isInSpecialAction = false;
            });
        } else {
          logger.warn(`[ScriptContext] NpcSpecialAction: NPC not found: ${name}`);
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
        logger.log(`[ScriptContext] SetNpcLevel: setting player level to ${level}`);
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
    setNpcRelation: (name, relation) => {
      // C#: GetPlayerAndAllNpcs - 包括 Player
      npcManager.setNpcRelation(name, relation);
      if (player && player.name === name) {
        player.setRelation(relation);
      }
    },
    setNpcDeathScript: (name, scriptFile) => {
      // 先检查是否是玩家
      if (player && player.name === name) {
        player.deathScript = scriptFile;
        logger.log(`[setNpcDeathScript] Set death script for Player ${name}: ${scriptFile}`);
        return;
      }
      // 再检查 NPC
      const npc = npcManager.getNpc(name);
      if (npc) {
        npc.deathScript = scriptFile;
        logger.log(`[setNpcDeathScript] Set death script for ${name}: ${scriptFile}`);
      } else {
        logger.warn(`[setNpcDeathScript] NPC not found: ${name}`);
      }
    },
    setNpcScript: (name, scriptFile) => {
      npcManager.setNpcScript(name, scriptFile);
    },
    showNpc: (name, show) => {
      npcManager.showNpc(name, show);
      logger.log(`[ShowNpc] ${name} -> show=${show}`);
    },
    mergeNpc: async (npcFile) => {
      await npcManager.mergeNpc(npcFile);
    },
    saveNpc: async (fileName) => {
      await npcManager.saveNpc(fileName);
    },
    watch: (char1Name, char2Name, watchType) => {
      // C#: Watch - make characters face each other
      // watchType: 0 = both face each other, 1 = only char1 faces char2
      const char1 = getCharacterByName(char1Name);
      const char2 = getCharacterByName(char2Name);
      if (!char1 || !char2) {
        logger.warn(`[Watch] Character not found: ${char1Name} or ${char2Name}`);
        return;
      }

      const isC1 = watchType === 0 || watchType === 1;
      const isC2 = watchType === 0;

      if (isC1) {
        // char1 面向 char2
        const dx = char2.pixelPosition.x - char1.pixelPosition.x;
        const dy = char2.pixelPosition.y - char1.pixelPosition.y;
        char1.setDirectionFromDelta(dx, dy);
      }
      if (isC2) {
        // char2 面向 char1
        const dx = char1.pixelPosition.x - char2.pixelPosition.x;
        const dy = char1.pixelPosition.y - char2.pixelPosition.y;
        char2.setDirectionFromDelta(dx, dy);
      }
      logger.log(`[Watch] ${char1Name} <-> ${char2Name}, type=${watchType}`);
    },
    enableNpcAI: () => {
      npcManager.enableGlobalAI();
    },
    disableNpcAI: () => {
      npcManager.disableGlobalAI();
    },

    // Player
    addGoods: async (goodsName, count) => {
      logger.log(`AddGoods: ${goodsName} x${count}`);
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
      logger.log(`RemoveGoods: ${goodsName} x${count}`);
      goodsListManager.deleteGoodByName(goodsName, count);
    },
    equipGoods: async (goodsIndex, equipSlot) => {
      const equipIndex = equipSlot + 200;
      logger.log(`EquipGoods: from index ${goodsIndex} to slot ${equipIndex}`);
      goodsListManager.exchangeListItemAndEquiping(goodsIndex, equipIndex);
    },
    addMoney: (amount) => {
      player.addMoney(amount);
    },
    addExp: (amount) => {
      player.addExp(amount);
    },

    // Player stats (C#: Globals.ThePlayer.FullLife/AddLife/etc.)
    fullLife: () => {
      if (player) {
        player.fullLife();
        logger.log("[ScriptContext] FullLife");
      }
    },
    fullMana: () => {
      if (player) {
        player.fullMana();
        logger.log("[ScriptContext] FullMana");
      }
    },
    fullThew: () => {
      if (player) {
        player.fullThew();
        logger.log("[ScriptContext] FullThew");
      }
    },
    addLife: (amount) => {
      if (player) {
        player.addLife(amount);
        logger.log(`[ScriptContext] AddLife: ${amount}`);
      }
    },
    addMana: (amount) => {
      if (player) {
        player.addMana(amount);
        logger.log(`[ScriptContext] AddMana: ${amount}`);
      }
    },
    addThew: (amount) => {
      if (player) {
        player.addThew(amount);
        logger.log(`[ScriptContext] AddThew: ${amount}`);
      }
    },

    // Magic functions
    addMagic: async (magicFile) => {
      if (player) {
        const success = await player.addMagic(magicFile);
        if (success) {
          logger.log(`[ScriptContext] AddMagic: ${magicFile}`);
        } else {
          logger.warn(`[ScriptContext] AddMagic failed: ${magicFile}`);
        }
      }
    },
    setMagicLevel: (magicFile, level) => {
      // C#: MagicListManager.SetNonReplaceMagicLevel(fileName, level)
      const magicListManager = player.getMagicListManager();
      magicListManager.setNonReplaceMagicLevel(magicFile, level);
      logger.log(`[ScriptContext] SetMagicLevel: ${magicFile} -> level ${level}`);
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
      logger.log(`[ScriptContext] LoadObj command: ${fileName}`);
      const result = await objManager.load(fileName);
      logger.log(`[ScriptContext] LoadObj result: ${result}`);
    },
    addObj: async (fileName, x, y, direction) => {
      logger.log(`[ScriptContext] AddObj command: ${fileName} at (${x}, ${y}) dir=${direction}`);
      await objManager.addObjByFile(fileName, x, y, direction);
    },
    delCurObj: () => {
      // C# Reference: ScriptExecuter.DelCurObj - removes the object that triggered the script
      // The belongObject is stored in ScriptState, accessed via command handler
      // This is a no-op as the actual deletion is handled by delObj with __id__ prefix
      logger.log(`[ScriptContext] DelCurObj command (no-op, handled by delObj)`);
    },
    delObj: (objNameOrId) => {
      // Support both name-based and id-based deletion
      // ID-based: "__id__:xxx" format (used by DelCurObj)
      if (objNameOrId.startsWith("__id__:")) {
        const id = objNameOrId.substring(7);
        logger.log(`[ScriptContext] DelObj by id: ${id}`);
        objManager.deleteObjById(id);
      } else {
        logger.log(`[ScriptContext] DelObj by name: ${objNameOrId}`);
        objManager.deleteObj(objNameOrId);
      }
    },
    openBox: (objNameOrId) => {
      // C# Reference: ScriptExecuter.OpenBox - plays box opening animation
      // If no name provided, uses belongObject (handled by command)
      if (objNameOrId) {
        logger.log(`[ScriptContext] OpenBox: ${objNameOrId}`);
        objManager.openBox(objNameOrId);
      }
    },
    closeBox: (objNameOrId) => {
      // C# Reference: ScriptExecuter.CloseBox - plays box closing animation
      if (objNameOrId) {
        logger.log(`[ScriptContext] CloseBox: ${objNameOrId}`);
        objManager.closeBox(objNameOrId);
      }
    },
    setObjScript: (objNameOrId, scriptFile) => {
      // C# Reference: ScriptExecuter.SetObjScript - sets object's script file
      // When scriptFile is empty, the object becomes non-interactive
      logger.log(`[ScriptContext] SetObjScript: ${objNameOrId} -> "${scriptFile}"`);
      objManager.setObjScript(objNameOrId, scriptFile);
    },
    saveObj: async (fileName) => {
      await objManager.saveObj(fileName);
    },
    clearBody: () => {
      // C#: ObjManager.ClearBody() - removes all objects with IsBody=true
      objManager.clearBodies();
      logger.log(`[ScriptContext] ClearBody`);
    },
    getObjPosition: (objNameOrId) => {
      // Get OBJ position by name or id
      const obj = objManager.getObj(objNameOrId);
      if (obj) {
        return obj.tilePosition;
      }
      return null;
    },
    addRandGoods: async (buyFileName) => {
      // C# Reference: ScriptExecuter.AddRandGoods
      // Reads ini/buy/{buyFileName}, picks random item, calls AddGoods
      logger.log(`[ScriptContext] AddRandGoods: ${buyFileName}`);
      try {
        const filePath = ResourcePath.buy(buyFileName);
        const content = await resourceLoader.loadText(filePath);
        if (!content) {
          logger.warn(`[ScriptContext] Failed to load buy file: ${filePath}`);
          return;
        }

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
          logger.warn(`[ScriptContext] No items found in buy file: ${buyFileName}`);
          return;
        }

        // Pick random item
        const randomIndex = Math.floor(Math.random() * items.length);
        const randomItem = items[randomIndex];
        logger.log(`[ScriptContext] AddRandGoods picked: ${randomItem}`);

        // Add the item using existing addGoods logic
        const result = await goodsListManager.addGoodToList(randomItem);
        if (result.success && result.good) {
          guiManager.showMessage(`你获得了${result.good.name}`);
        }
        // Note: GoodsListManager.addGoodToList already calls onUpdateView callback
      } catch (error) {
        logger.error(`[ScriptContext] AddRandGoods error:`, error);
      }
    },

    // Trap management
    setMapTrap: (trapIndex, trapFileName, mapName) => {
      setMapTrap(trapIndex, trapFileName, mapName);
    },

    // Game flow
    sleep: (_ms) => {
      // Note: This is handled by the caller, not stored here
    },
    playMusic: (file) => {
      audioManager.playMusic(file);
    },
    stopMusic: () => {
      audioManager.stopMusic();
    },
    playSound: (file, emitterPosition?) => {
      // C#: PlaySound uses belongObject position for 3D spatial audio
      if (emitterPosition) {
        audioManager.play3DSoundOnce(file, emitterPosition);
      } else {
        audioManager.playSound(file);
      }
    },
    playMovie: (file) => {
      // C#: PlayMovie uses XNA VideoPlayer
      // Web implementation: Use HTML5 Video element
      logger.log(`[ScriptContext] PlayMovie: ${file}`);
      guiManager.playMovie(file);
    },
    isMovieEnd: () => {
      return guiManager.isMovieEnd();
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
    beginRain: (fileName) => {
      // C#: WeatherManager.BeginRain(string fileName) - start rain effect
      // fileName 是雨效果配置文件，如 "Rain2.ini"
      weatherManager.beginRain(fileName);
      logger.log(`[ScriptContext] BeginRain: ${fileName}`);
    },
    endRain: () => {
      // C#: WeatherManager.StopRain - stop rain effect
      weatherManager.stopRain();
      // 恢复正常颜色
      screenEffects.setMapColor(255, 255, 255);
      screenEffects.setSpriteColor(255, 255, 255);
      logger.log(`[ScriptContext] EndRain`);
    },
    showSnow: (show) => {
      // C#: WeatherManager.ShowSnow - show/hide snow effect
      weatherManager.showSnow(show);
      logger.log(`[ScriptContext] ShowSnow: ${show}`);
    },
    freeMap: () => {
      // C#: MapBase.Free() - release map resources
      // In JS, we rely on garbage collection
      // This is mainly a signal that map should be unloaded
      logger.log(`[ScriptContext] FreeMap (JS uses garbage collection)`);
    },
    setLevelFile: async (file) => {
      const paths = [ResourcePath.level(file), ResourcePath.level(file.toLowerCase())];

      for (const path of paths) {
        try {
          // Try to load the file - if it exists, it will be cached for later use
          const content = await resourceLoader.loadText(path);
          if (content) {
            await levelManager.setLevelFile(path);
            logger.log(`[ScriptContext] Level file set to: ${path}`);
            return;
          }
        } catch {
          // Try next path
        }
      }
      logger.warn(`[ScriptContext] Could not load level file: ${file}`);
    },

    // Timer commands (C#: TimerGui, ScriptExecuter)
    openTimeLimit: (seconds) => {
      timerManager.openTimeLimit(seconds);
      logger.log(`[ScriptContext] OpenTimeLimit: ${seconds} seconds`);
    },
    closeTimeLimit: () => {
      timerManager.closeTimeLimit();
      logger.log(`[ScriptContext] CloseTimeLimit`);
    },
    hideTimerWnd: () => {
      timerManager.hideTimerWnd();
      logger.log(`[ScriptContext] HideTimerWnd`);
    },
    setTimeScript: (triggerSeconds, scriptFileName) => {
      // C#: 只存储文件名，触发时根据当前地图构建路径
      timerManager.setTimeScript(triggerSeconds, scriptFileName);
      logger.log(`[ScriptContext] SetTimeScript: ${triggerSeconds}s -> ${scriptFileName}`);
    },

    // Input/ability control (C#: Globals.IsInputDisabled, Player.IsFightDisabled, etc.)
    // Note: IsInputDisabled is a global state that prevents player input during cutscenes
    // In TS, we handle this via script execution state - when script is running, input is already disabled
    disableInput: () => {
      // C#: Globals.IsInputDisabled = true
      // In TypeScript, script execution already blocks input
      // This is mainly for explicit cutscene control
      logger.log("[ScriptContext] DisableInput");
    },
    enableInput: () => {
      // C#: Globals.IsInputDisabled = false
      logger.log("[ScriptContext] EnableInput");
    },
    disableFight: () => {
      // C#: Globals.ThePlayer.DisableFight()
      if (player) {
        player.isFightDisabled = true;
        logger.log("[ScriptContext] DisableFight");
      }
    },
    enableFight: () => {
      // C#: Globals.ThePlayer.EnableFight()
      if (player) {
        player.isFightDisabled = false;
        logger.log("[ScriptContext] EnableFight");
      }
    },
    disableJump: () => {
      // C#: Globals.ThePlayer.DisableJump()
      if (player) {
        player.isJumpDisabled = true;
        logger.log("[ScriptContext] DisableJump");
      }
    },
    enableJump: () => {
      // C#: Globals.ThePlayer.EnableJump()
      if (player) {
        player.isJumpDisabled = false;
        logger.log("[ScriptContext] EnableJump");
      }
    },
    disableRun: () => {
      // C#: Globals.ThePlayer.DisableRun()
      if (player) {
        player.isRunDisabled = true;
        logger.log("[ScriptContext] DisableRun");
      }
    },
    enableRun: () => {
      // C#: Globals.ThePlayer.EnableRun()
      if (player) {
        player.isRunDisabled = false;
        logger.log("[ScriptContext] EnableRun");
      }
    },

    // Character state
    toNonFightingState: () => {
      // C#: Globals.PlayerKindCharacter.ToNonFightingState()
      // Used during dialogs (Say/Talk) to exit fighting mode
      const npcWithPlayerKind = npcManager.getPlayerKindCharacter();
      const targetCharacter = npcWithPlayerKind ?? player.controledCharacter ?? player;
      if (targetCharacter) {
        targetCharacter.toNonFightingState();
        logger.log("[ScriptContext] ToNonFightingState");
      }
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
    returnToTitle: () => {
      // 返回标题界面 - 通过依赖项的回调来实现
      logger.log("[ScriptContext] ReturnToTitle");
      deps.returnToTitle();
    },

    // Map time
    setMapTime: (time) => {
      // C#: MapBase.MapTime = time
      deps.setMapTime(time);
    },

    // Player change
    playerChange: async (index) => {
      // C#: Loader.ChangePlayer(index)
      logger.log(`[ScriptContext] PlayerChange: ${index} (TODO: implement player switching)`);
    },

    // ============= Extended Player Commands =============
    playerJumpTo: (x, y) => {
      if (player) {
        // C#: Globals.ThePlayer.JumpTo(x, y)
        const success = player.jumpTo({ x, y });
        logger.log(`[ScriptContext] PlayerJumpTo: (${x}, ${y}) success=${success}`);
      }
    },
    isPlayerJumpToEnd: () => {
      if (!player) return true;
      return player.state === CharacterState.Stand || player.state === CharacterState.Stand1;
    },
    playerGotoEx: (x, y) => {
      if (player) {
        player.walkToTile(x, y);
        logger.log(`[ScriptContext] PlayerGotoEx: (${x}, ${y}) (non-blocking)`);
      }
    },
    playerRunToEx: (x, y) => {
      if (player) {
        player.runToTile(x, y);
        logger.log(`[ScriptContext] PlayerRunToEx: (${x}, ${y}) (non-blocking)`);
      }
    },
    setPlayerScn: () => {
      // C#: CenterPlayerInCamera - 将摄像机居中到玩家位置
      deps.centerCameraOnPlayer();
      logger.log(`[ScriptContext] SetPlayerScn: centering camera on player`);
    },
    getMoneyNum: () => {
      return player?.money || 0;
    },
    setMoneyNum: (amount) => {
      if (player) {
        player.setMoney(amount);
        logger.log(`[ScriptContext] SetMoneyNum: ${amount}`);
      }
    },
    getPlayerExp: () => {
      return player?.exp || 0;
    },
    getPlayerState: (stateName) => {
      if (!player) return 0;
      switch (stateName) {
        case "Level": return player.level;
        case "Attack": return player.attack;
        case "Defend": return player.defend;
        case "Evade": return player.evade;
        case "Life": return player.life;
        case "Thew": return player.thew;
        case "Mana": return player.mana;
        default: return 0;
      }
    },
    getPlayerMagicLevel: (magicFile) => {
      if (!player) return 0;
      const magicListManager = player.getMagicListManager();
      const info = magicListManager.getMagicByFileName(magicFile);
      return info?.level || 0;
    },
    limitMana: (limit) => {
      if (player) {
        // C#: Globals.ThePlayer.ManaLimit = (int.Parse(parameters[0]) != 0)
        player.manaLimit = limit;
        logger.log(`[ScriptContext] LimitMana: ${limit}`);
      }
    },
    addMoveSpeedPercent: (percent) => {
      if (player) {
        player.addMoveSpeedPercent = (player.addMoveSpeedPercent || 0) + percent;
        logger.log(`[ScriptContext] AddMoveSpeedPercent: ${percent}`);
      }
    },
    useMagic: (magicFile, x, y) => {
      if (!player) return;

      // C#: ScriptExecuter.UseMagic - 获取魔法并让玩家使用
      const magicListManager = player.getMagicListManager();
      const magicInfo = magicListManager.getMagicByFileName(magicFile);

      if (!magicInfo || !magicInfo.magic) {
        logger.warn(`[ScriptContext] UseMagic: magic not found: ${magicFile}`);
        return;
      }

      // 计算目标位置
      let mapX = x ?? 0;
      let mapY = y ?? 0;

      // 如果没有提供坐标，使用玩家当前方向上的邻居瓦片
      if (x === undefined || y === undefined) {
        const neighbors = getNeighbors(player.tilePosition);
        const dest = neighbors[player.currentDirection];
        mapX = dest.x;
        mapY = dest.y;
      }

      // 直接设置 pending magic 并触发魔法释放
      // C#: Globals.ThePlayer.UseMagic(magicInfo.TheMagic, new Vector2(mapX, mapY))
      const origin = player.positionInWorld;
      const destination = tileToPixel(mapX, mapY);

      player.setPendingMagic(magicInfo.magic, origin, destination);
      // 直接触发 onMagicCast 释放魔法（跳过动画）
      (player as unknown as { onMagicCast(): void }).onMagicCast();

      logger.log(`[ScriptContext] UseMagic: ${magicFile} (${magicInfo.magic.name}) at (${mapX}, ${mapY})`);
    },
    isEquipWeapon: () => {
      const weapon = goodsListManager.get(205); // 武器槽位
      return weapon !== null;
    },
    addAttack: (value, type) => {
      if (player) {
        // C#: type 1=_attack, 2=_attack2, 3=_attack3 (default 1)
        const t = type ?? 1;
        if (t === 1) {
          player.attack += value;
        } else if (t === 2) {
          player.attack2 += value;
        } else if (t === 3) {
          player.attack3 += value;
        }
        logger.log(`[ScriptContext] AddAttack: ${value}, type=${t}`);
      }
    },
    addDefend: (value, type) => {
      if (player) {
        // C#: type 1=_defend, 2=_defend2, 3=_defend3 (default 1)
        // Also clamps to 0 minimum
        const t = type ?? 1;
        if (t === 1) {
          player.defend = Math.max(0, player.defend + value);
        } else if (t === 2) {
          player.defend2 = Math.max(0, player.defend2 + value);
        } else if (t === 3) {
          player.defend3 = Math.max(0, player.defend3 + value);
        }
        logger.log(`[ScriptContext] AddDefend: ${value}, type=${t}`);
      }
    },
    addEvade: (value) => {
      if (player) {
        player.evade += value;
        logger.log(`[ScriptContext] AddEvade: ${value}`);
      }
    },
    addLifeMax: (value) => {
      if (player) {
        player.lifeMax += value;
        logger.log(`[ScriptContext] AddLifeMax: ${value}`);
      }
    },
    addManaMax: (value) => {
      if (player) {
        player.manaMax += value;
        logger.log(`[ScriptContext] AddManaMax: ${value}`);
      }
    },
    addThewMax: (value) => {
      if (player) {
        player.thewMax += value;
        logger.log(`[ScriptContext] AddThewMax: ${value}`);
      }
    },
    delMagic: (magicFile) => {
      if (player) {
        const magicListManager = player.getMagicListManager();
        magicListManager.deleteMagic(magicFile);
        logger.log(`[ScriptContext] DelMagic: ${magicFile}`);
      }
    },
    setPlayerMagicToUseWhenBeAttacked: (magicFile, direction) => {
      if (player) {
        player.magicToUseWhenBeAttacked = magicFile;
        if (direction !== undefined) {
          player.magicDirectionWhenBeAttacked = direction;
        }
        logger.log(`[ScriptContext] SetPlayerMagicToUseWhenBeAttacked: ${magicFile}, dir=${direction}`);
      }
    },
    setWalkIsRun: (value) => {
      if (player) {
        player.walkIsRun = value;
        logger.log(`[ScriptContext] SetWalkIsRun: ${value}`);
      }
    },

    // ============= Extended NPC Commands =============
    setNpcKind: (name, kind) => {
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) {
        npc.kind = kind;
      }
      if (player && player.name === name) {
        player.kind = kind;
      }
      logger.log(`[ScriptContext] SetNpcKind: ${name} -> ${kind}`);
    },
    setNpcMagicFile: (name, magicFile) => {
      // C#: SetMagicFile -> FlyIni = Utils.GetMagic(fileName)
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.setFlyIni(magicFile);
      }
      logger.log(`[ScriptContext] SetNpcMagicFile: ${name} -> ${magicFile}`);
    },
    setNpcRes: (name, resFile) => {
      // C#: SetRes -> SetNpcIni(fileName) -> refresh draw image
      const character = getCharacterByName(name);
      if (character) {
        // 异步加载新资源文件
        character.loadSpritesFromNpcIni(resFile).then((success) => {
          if (success) {
            logger.log(`[ScriptContext] SetNpcRes: ${name} -> ${resFile} (loaded)`);
          } else {
            logger.warn(`[ScriptContext] SetNpcRes: ${name} -> ${resFile} (failed)`);
          }
        });
      }
      logger.log(`[ScriptContext] SetNpcRes: ${name} -> ${resFile}`);
    },
    setNpcAction: (name, action, x, y) => {
      // C#: SetNpcAction - 设置 NPC 执行指定动作
      const character = getCharacterByName(name);
      if (!character) return;
      const destination = { x: x ?? 0, y: y ?? 0 };
      const pixelDest = tileToPixel(destination.x, destination.y);
      switch (action) {
        case CharacterState.Stand:
        case CharacterState.Stand1:
          character.standingImmediately();
          break;
        case CharacterState.Walk:
          character.walkTo(destination);
          break;
        case CharacterState.Run:
          character.runTo(destination);
          break;
        case CharacterState.Jump:
          character.jumpTo(destination);
          break;
        case CharacterState.Attack:
        case CharacterState.Attack1:
        case CharacterState.Attack2:
          character.performeAttack(pixelDest);
          break;
        case CharacterState.Magic:
          // C#: target.UseMagic(target.FlyIni, destination)
          // Use performeAttack with magic file to trigger magic state
          if (character.flyIni) {
            character.performeAttack(pixelDest, character.flyIni);
          }
          break;
        case CharacterState.Sit:
          // C#: target.Sitdown() - 只有 Player 有此方法
          if ('sitdown' in character && typeof (character as any).sitdown === 'function') {
            (character as any).sitdown();
          } else {
            character.state = CharacterState.Sit;
          }
          break;
        case CharacterState.Hurt:
          character.hurting();
          break;
        case CharacterState.Death:
          character.death();
          break;
        case CharacterState.FightStand:
          character.standingImmediately();
          character.toFightingState();
          break;
        case CharacterState.FightWalk:
          character.walkTo(destination);
          character.toFightingState();
          break;
        case CharacterState.FightRun:
          character.runTo(destination);
          character.toFightingState();
          break;
        case CharacterState.FightJump:
          character.jumpTo(destination);
          character.toFightingState();
          break;
        default:
          logger.log(`[ScriptContext] SetNpcAction: Unhandled action ${action}`);
      }
      logger.log(`[ScriptContext] SetNpcAction: ${name}, action=${action}, pos=(${x}, ${y})`);
    },
    setNpcActionType: (name, actionType) => {
      // C#: SetNpcActionType -> Action = type
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.action = actionType;
      }
      logger.log(`[ScriptContext] SetNpcActionType: ${name} -> ${actionType}`);
    },
    setAllNpcScript: (name, scriptFile) => {
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) {
        npc.scriptFile = scriptFile;
      }
      logger.log(`[ScriptContext] SetAllNpcScript: ${name} -> ${scriptFile}`);
    },
    setAllNpcDeathScript: (name, scriptFile) => {
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) {
        npc.deathScript = scriptFile;
      }
      logger.log(`[ScriptContext] SetAllNpcDeathScript: ${name} -> ${scriptFile}`);
    },
    npcAttack: (name, x, y) => {
      // C#: target.PerformeAttack(MapBase.ToPixelPosition(value))
      const characters = getCharactersByName(name);
      const pixelPos = tileToPixel(x, y);
      for (const character of characters) {
        character.performeAttack(pixelPos);
      }
      logger.log(`[ScriptContext] NpcAttack: ${name} at (${x}, ${y})`);
    },
    followNpc: (follower, target) => {
      const followerChar = getCharacterByName(follower);
      const targetChar = getCharacterByName(target);
      if (followerChar && targetChar) {
        followerChar.follow(targetChar);
        logger.log(`[ScriptContext] FollowNpc: ${follower} follows ${target}`);
      }
    },
    setNpcMagicToUseWhenBeAttacked: (name, magicFile, direction) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.magicToUseWhenBeAttacked = magicFile;
        if (direction !== undefined) {
          character.magicDirectionWhenBeAttacked = direction;
        }
      }
      logger.log(`[ScriptContext] SetNpcMagicToUseWhenBeAttacked: ${name}, ${magicFile}, dir=${direction}`);
    },
    addNpcProperty: (name, property, value) => {
      // C#: AddNpcProperty - 使用反射设置属性
      const npcs = npcManager.getAllNpcsByName(name);
      const characters = [...npcs];
      if (player && player.name === name) {
        characters.push(player as any);
      }
      // 将属性名转换为小写开头 (C# 属性名是 PascalCase)
      const propName = property.charAt(0).toLowerCase() + property.slice(1);
      for (const character of characters) {
        const charAny = character as any;
        if (propName in charAny && typeof charAny[propName] === 'number') {
          charAny[propName] += value;
        }
      }
      logger.log(`[ScriptContext] AddNpcProperty: ${name}.${property} += ${value}`);
    },
    changeFlyIni: (name, magicFile) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.setFlyIni(magicFile);
      }
      logger.log(`[ScriptContext] ChangeFlyIni: ${name} -> ${magicFile}`);
    },
    changeFlyIni2: (name, magicFile) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.setFlyIni2(magicFile);
      }
      logger.log(`[ScriptContext] ChangeFlyIni2: ${name} -> ${magicFile}`);
    },
    addFlyInis: (name, magicFile, distance) => {
      // C#: AddFlyInis - 追加武功到 flyInis 列表
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.addFlyInis(magicFile, distance);
      }
      logger.log(`[ScriptContext] AddFlyInis: ${name}, ${magicFile}, distance=${distance}`);
    },
    setNpcDestination: (name, x, y) => {
      // C#: SetNpcDestination - 设置 NPC 目的地坐标
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) {
        npc.destinationMapPosX = x;
        npc.destinationMapPosY = y;
      }
      logger.log(`[ScriptContext] SetNpcDestination: ${name} -> (${x}, ${y})`);
    },
    getNpcCount: (kind1, kind2) => {
      // C#: GetNpcCount - 统计指定类型范围的 NPC 数量
      const allNpcs = npcManager.getAllNpcs();
      let count = 0;
      for (const [, npc] of allNpcs) {
        if (kind2 !== undefined) {
          if (npc.kind >= kind1 && npc.kind <= kind2) count++;
        } else {
          if (npc.kind === kind1) count++;
        }
      }
      return count;
    },
    setKeepAttack: (name, x, y) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.keepAttackX = x;
        character.keepAttackY = y;
      }
      logger.log(`[ScriptContext] SetKeepAttack: ${name} -> (${x}, ${y})`);
    },

    // ============= Extended Goods Commands =============
    buyGoods: async (buyFile, canSellSelfGoods) => {
      // C# Reference: BuyGui.BeginBuy
      logger.log(`[ScriptContext] BuyGoods: ${buyFile}, canSellSelfGoods=${canSellSelfGoods}`);
      const success = await buyManager.beginBuy(buyFile, null, canSellSelfGoods);
      if (success) {
        guiManager.openBuyGui();
      }
    },
    isBuyGoodsEnd: () => {
      // C# Reference: GuiManager.IsBuyGoodsEnd
      return !buyManager.isOpen();
    },
    getGoodsNum: (goodsFile) => {
      return goodsListManager.getGoodsNum(goodsFile);
    },
    getGoodsNumByName: (goodsName) => {
      return goodsListManager.getGoodsNumByName(goodsName);
    },
    clearGoods: () => {
      goodsListManager.renewList();
      logger.log("[ScriptContext] ClearGoods");
    },
    clearMagic: () => {
      if (player) {
        const magicListManager = player.getMagicListManager();
        magicListManager.renewList();
        logger.log("[ScriptContext] ClearMagic");
      }
    },
    delGoodByName: (name, count) => {
      goodsListManager.deleteGoodByName(name, count ?? 1);
      logger.log(`[ScriptContext] DelGoodByName: ${name} x${count ?? 1}`);
    },
    checkFreeGoodsSpace: () => {
      return goodsListManager.hasFreeItemSpace();
    },
    checkFreeMagicSpace: () => {
      if (!player) return false;
      const magicListManager = player.getMagicListManager();
      return magicListManager.getFreeIndex() !== -1;
    },
    setDropIni: (name, dropFile) => {
      // C#: SetDropIni - 设置角色的掉落物配置文件
      const character = getCharacterByName(name);
      if (character) {
        character.dropIni = dropFile;
      }
      logger.log(`[ScriptContext] SetDropIni: ${name} -> ${dropFile}`);
    },
    enableDrop: () => {
      enableDrop();
      logger.log("[ScriptContext] EnableDrop");
    },
    disableDrop: () => {
      disableDrop();
      logger.log("[ScriptContext] DisableDrop");
    },

    // ============= Extended Camera Commands =============
    moveScreenEx: (x, y, speed) => {
      // C#: MoveScreenEx - 将摄像机移动到指定瓦片位置（使该瓦片居中）
      // _moveToBeginDestination = MapBase.ToPixelPosition(centerTilePosition) - GetHalfViewSize()
      // 这里我们将瓦片转为像素，视口偏移由 GameEngine 处理
      const pixelPos = tileToPixel(x, y);
      cameraMoveToPosition(pixelPos.x, pixelPos.y, speed);
      logger.log(`[ScriptContext] MoveScreenEx: tile(${x}, ${y}) -> pixel(${pixelPos.x}, ${pixelPos.y}), speed=${speed}`);
    },
    isMoveScreenExEnd: () => {
      return isCameraMoveToPositionEnd();
    },
    setMapPos: (x, y) => {
      // C#: SetMapPos - 将瓦片坐标转换为像素坐标，设置摄像机位置
      // Globals.TheCarmera.CarmeraBeginPositionInWorld = MapBase.ToPixelPosition(x, y)
      const pixelPos = tileToPixel(x, y);
      setCameraPosition(pixelPos.x, pixelPos.y);
      logger.log(`[ScriptContext] SetMapPos: tile(${x}, ${y}) -> pixel(${pixelPos.x}, ${pixelPos.y})`);
    },
    openWaterEffect: () => {
      screenEffects.openWaterEffect();
      logger.log("[ScriptContext] OpenWaterEffect");
    },
    closeWaterEffect: () => {
      screenEffects.closeWaterEffect();
      logger.log("[ScriptContext] CloseWaterEffect");
    },

    // ============= Save Commands =============
    saveMapTrap: () => {
      deps.saveMapTrap();
      logger.log("[ScriptContext] SaveMapTrap");
    },
    clearAllSave: () => {
      logger.log("[ScriptContext] ClearAllSave (TODO)");
    },
    enableSave: () => {
      enableSave();
      logger.log("[ScriptContext] EnableSave");
    },
    disableSave: () => {
      disableSave();
      logger.log("[ScriptContext] DisableSave");
    },

    // ============= Variable Commands =============
    clearAllVar: (keepsVars) => {
      const variables = getVariables();
      const keeps: Record<string, number> = {};
      for (const key of keepsVars || []) {
        const normalizedKey = key.startsWith("$") ? key : `$${key}`;
        if (normalizedKey in variables) {
          keeps[normalizedKey] = variables[normalizedKey];
        }
      }
      // Clear all
      for (const key of Object.keys(variables)) {
        delete variables[key];
      }
      // Restore keeps
      for (const [key, value] of Object.entries(keeps)) {
        variables[key] = value;
      }
      logger.log(`[ScriptContext] ClearAllVar, kept: ${Object.keys(keeps).join(", ")}`);
    },
    getPartnerIdx: () => {
      // 获取第一个队友的索引
      const partners = npcManager.getAllPartners();
      if (partners.length > 0) {
        const partnerName = partners[0].name;
        const idx = partnerList.getIndex(partnerName);
        logger.log(`[ScriptContext] GetPartnerIdx: ${partnerName} -> ${idx}`);
        return idx;
      }
      // 如果没有队友，返回 count + 1
      const count = partnerList.getCount();
      logger.log(`[ScriptContext] GetPartnerIdx: no partner, returning ${count + 1}`);
      return count + 1;
    },

    // ============= Effect Commands =============
    petrifyMillisecond: (ms) => {
      if (player) {
        // C#: seconds = Globals.ThePlayer.PetrifiedSeconds < seconds ? seconds : Globals.ThePlayer.PetrifiedSeconds;
        let seconds = ms / 1000;
        seconds = player.petrifiedSeconds < seconds ? seconds : player.petrifiedSeconds;
        player.setPetrifySeconds(seconds, true);
        logger.log(`[ScriptContext] PetrifyMillisecond: ${ms}ms (actual: ${seconds}s)`);
      }
    },
    poisonMillisecond: (ms) => {
      if (player) {
        // C#: seconds = Globals.ThePlayer.PoisonSeconds < seconds ? seconds : Globals.ThePlayer.PoisonSeconds;
        let seconds = ms / 1000;
        seconds = player.poisonSeconds < seconds ? seconds : player.poisonSeconds;
        player.setPoisonSeconds(seconds, true);
        logger.log(`[ScriptContext] PoisonMillisecond: ${ms}ms (actual: ${seconds}s)`);
      }
    },
    frozenMillisecond: (ms) => {
      if (player) {
        // C#: seconds = Globals.ThePlayer.FrozenSeconds < seconds ? seconds : Globals.ThePlayer.FrozenSeconds;
        let seconds = ms / 1000;
        seconds = player.frozenSeconds < seconds ? seconds : player.frozenSeconds;
        player.setFrozenSeconds(seconds, true);
        logger.log(`[ScriptContext] FrozenMillisecond: ${ms}ms (actual: ${seconds}s)`);
      }
    },

    // ============= Misc Extended Commands =============
    runParallelScript: (scriptFile, delay) => {
      if (deps.runParallelScript) {
        deps.runParallelScript(scriptFile, delay || 0);
      } else {
        logger.warn(`[ScriptContext] RunParallelScript not available: ${scriptFile}`);
      }
    },
    setObjOfs: (objName, x, y) => {
      const obj = objManager.getObj(objName) || objManager.getObjById(objName);
      if (obj) {
        obj.setOffset({ x, y });
      }
      logger.log(`[ScriptContext] SetObjOfs: ${objName} -> (${x}, ${y})`);
    },
    setShowMapPos: (show) => {
      deps.setScriptShowMapPos(show);
      logger.log(`[ScriptContext] SetShowMapPos: ${show}`);
    },
    showSystemMsg: (msg, stayTime) => {
      // C#: GuiManager.ShowSystemMsg(msg, stayTime) - stayTime in milliseconds
      guiManager.showMessage(msg, stayTime || 3000);
      logger.log(`[ScriptContext] ShowSystemMsg: "${msg}", stayTime=${stayTime || 3000}`);
    },
    randRun: (_probability, _script1, _script2) => {
      // Handled by command handler
    },
    stopSound: () => {
      audioManager.stopAllSounds();
      logger.log("[ScriptContext] StopSound");
    },

    // ============= Extended Dialog Commands =============
    chooseEx: (message, options, _resultVar) => {
      // Create selection options from the array
      const selectionOptions = options.map((opt, idx) => ({
        text: opt.text,
        label: String(idx),
        enabled: true,
      }));
      guiManager.showSelection(selectionOptions, message);
      logger.log(`[ScriptContext] ChooseEx: "${message}" with ${options.length} options`);
    },
    chooseMultiple: (columns, rows, varPrefix, message, options) => {
      // C#: GuiManager.ChooseMultiple(column, selectionCount, varName, message, selections, isShows)
      // rows 参数对应 C# 的 selectionCount（需要选择的数量）
      const selectionOptions = options.map((opt, idx) => ({
        text: opt.text,
        label: String(idx),
        enabled: opt.condition !== "false", // 简单条件判断
      }));
      guiManager.showMultiSelection(columns, rows, message, selectionOptions);
      // 保存变量前缀用于后续获取结果
      (guiManager as unknown as { multiSelectionVarPrefix?: string }).multiSelectionVarPrefix = varPrefix;
      logger.log(`[ScriptContext] ChooseMultiple: ${columns}x${rows}, prefix=${varPrefix}, msg="${message}", ${options.length} options`);
    },
    isChooseExEnd: () => {
      return !guiManager.getState().selection.isVisible;
    },
    isChooseMultipleEnd: () => {
      return guiManager.isMultiSelectionEnd();
    },
    getMultiSelectionResult: () => {
      return guiManager.getState().selection.selectedIndex;
    },
    getChooseMultipleResult: () => {
      return guiManager.getMultiSelectionResult();
    },

    // Debug hooks
    onScriptStart: deps.onScriptStart,
    onLineExecuted: deps.onLineExecuted,
  };
}
