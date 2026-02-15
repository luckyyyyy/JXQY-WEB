/**
 * NPC Commands - NPC control and management
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
import { logger } from "../../core/logger";
import type { CommandHandler, CommandRegistry } from "./types";

/**
 * AddNpc - Add NPC to map
 * direction is required
 */
const addNpcCommand: CommandHandler = async (params, _result, helpers) => {
  const npcFile = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  const direction = params.length >= 4 ? helpers.resolveNumber(params[3] || "4") : undefined;
  await helpers.api.npc.add(npcFile, x, y, direction);
  return true;
};

/**
 * LoadNpc - Load NPC file
 */
const loadNpcCommand: CommandHandler = async (params, _result, helpers) => {
  const npcFile = helpers.resolveString(params[0] || "");
  logger.log("LoadNpc:", npcFile);
  await helpers.api.map.loadNpc(npcFile);
  return true;
};

/**
 * LoadOneNpc - Load single NPC at position
 */
const loadOneNpcCommand: CommandHandler = async (params, _result, helpers) => {
  const npcFile = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  await helpers.api.npc.add(npcFile, x, y);
  return true;
};

/**
 * DeleteNpc - Remove NPC from map
 */
const deleteNpcCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  helpers.api.npc.delete(npcName);
  return true;
};

/**
 * DelNpc - Alias for DeleteNpc
 */
const delNpcCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  helpers.api.npc.delete(npcName);
  return true;
};

/**
 * SetNpcPos - Set NPC tile position
 */
const setNpcPosCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  helpers.api.npc.setPosition(npcName, x, y);
  return true;
};

/**
 * SetNpcDir - Set NPC facing direction
 * supports 1-param (value) with belongObject or 2-param (name, value)
 */
const setNpcDirCommand: CommandHandler = (params, _result, helpers) => {
  let npcName: string;
  let direction: number;

  if (params.length === 1) {
    // 1-param version: use belongObject as target
    const belongObject = helpers.state.belongObject;
    if (belongObject && belongObject.type === "npc") {
      npcName = belongObject.id;
    } else {
      return true; // No target, skip
    }
    direction = helpers.resolveNumber(params[0] || "0");
  } else {
    // 2-param version: name, direction
    npcName = helpers.resolveString(params[0] || "");
    direction = helpers.resolveNumber(params[1] || "0");
  }

  helpers.api.npc.setDirection(npcName, direction);
  return true;
};

/**
 * SetNpcState - Set NPC state
 */
const setNpcStateCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const state = helpers.resolveNumber(params[1] || "0");
  helpers.api.npc.setState(npcName, state);
  return true;
};

/**
 * SetNpcLevel - Set NPC level
 */
const setNpcLevelCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const level = helpers.resolveNumber(params[1] || "1");
  helpers.api.npc.setLevel(npcName, level);
  return true;
};

/**
 * NpcGoto - Walk NPC to position (BLOCKING)
 */
const npcGotoCommand: CommandHandler = async (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  await helpers.api.npc.walkTo(npcName, x, y);
  return true;
};

/**
 * NpcGotoEx - Walk NPC to position (NON-BLOCKING)
 * NpcGotoEx just calls target.WalkTo() without waiting
 */
const npcGotoExCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  helpers.api.npc.walkToNonBlocking(npcName, x, y);
  // Non-blocking, return immediately
  return true;
};

/**
 * NpcGotoDir - Walk NPC in direction (BLOCKING)
 */
const npcGotoDirCommand: CommandHandler = async (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const direction = helpers.resolveNumber(params[1] || "0");
  const steps = helpers.resolveNumber(params[2] || "1");
  await helpers.api.npc.walkToDir(npcName, direction, steps);
  return true;
};

/**
 * SetNpcActionFile - Set NPC animation file for a state
 * 不等待 ASF 加载完成，立即继续执行脚本（匹配 C# 同步行为）
 * 这样后续的 NpcSpecialAction 等命令能在同一帧内执行，
 * 避免因异步加载导致中间帧闪烁
 */
const setNpcActionFileCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const stateType = helpers.resolveNumber(params[1] || "0");
  const asfFile = helpers.resolveString(params[2] || "");
  logger.log(
    `[ScriptExecutor] SetNpcActionFile: name="${npcName}", state=${stateType}, file="${asfFile}"`
  );
  // Fire and forget: ASF 在后台加载，加载完成后自动刷新贴图
  // 如果此时已有 NpcSpecialAction 设置了 isInSpecialAction，则跳过刷新
  helpers.api.npc.setActionFile(npcName, stateType, asfFile);
  return true;
};

/**
 * NpcSpecialAction - Play NPC special animation (non-blocking)
 */
const npcSpecialActionCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const asfFile = helpers.resolveString(params[1] || "");
  helpers.api.npc.specialActionNonBlocking(npcName, asfFile);
  return true;
};

/**
 * NpcSpecialActionEx - Play NPC special animation (BLOCKING)
 */
const npcSpecialActionExCommand: CommandHandler = async (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const asfFile = helpers.resolveString(params[1] || "");
  await helpers.api.npc.specialAction(npcName, asfFile);
  return true;
};

/**
 * ShowNpc - Show/hide NPC
 * sets IsHide property
 */
const showNpcCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const show = helpers.resolveNumber(params[1] || "1") !== 0;
  helpers.api.npc.show(npcName, show);
  return true;
};

/**
 * SetNpcScript - Set NPC interaction script
 * sets the ScriptFile property
 */
const setNpcScriptCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const scriptFile = helpers.resolveString(params[1] || "");
  helpers.api.npc.setScript(npcName, scriptFile);
  return true;
};

/**
 * SetNpcDeathScript - Set NPC death script
 * Sets the death script for an NPC
 */
const setNpcDeathScriptCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const scriptFile = helpers.resolveString(params[1] || "");
  helpers.api.npc.setDeathScript(npcName, scriptFile);
  return true;
};

/**
 * MergeNpc - Merge NPC file without clearing existing NPCs
 * calls Load with clearCurrentNpcs=false
 */
const mergeNpcCommand: CommandHandler = async (params, _result, helpers) => {
  const npcFile = helpers.resolveString(params[0] || "");
  await helpers.api.npc.merge(npcFile);
  return true;
};

/**
 * SaveNpc - Save NPC state
 * saves current NPCs to save file
 */
const saveNpcCommand: CommandHandler = async (params, _result, helpers) => {
  const fileName = params[0] ? helpers.resolveString(params[0]) : undefined;
  await helpers.api.npc.save(fileName);
  return true;
};

/**
 * DisableNpcAI - Disable global NPC AI
 */
const disableNpcAICommand: CommandHandler = (_params, _result, helpers) => {
  logger.log("DisableNpcAI");
  helpers.api.npc.setAIEnabled(false);
  return true;
};

/**
 * EnableNpcAI - Enable global NPC AI
 */
const enableNpcAICommand: CommandHandler = (_params, _result, helpers) => {
  logger.log("EnableNpcAI");
  helpers.api.npc.setAIEnabled(true);
  return true;
};

/**
 * SetNpcRelation - Set NPC relation type
 * SetNpcRelation(name, relation) where relation is 0=Friend, 1=Enemy, 2=None
 */
const setNpcRelationCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const relation = helpers.resolveNumber(params[1] || "0");
  logger.log(`SetNpcRelation: ${npcName} -> ${relation}`);
  helpers.api.npc.setRelation(npcName, relation);
  return true;
};

/**
 * Watch - Make character face another character
 * Watch(char1, char2, watchType)
 * watchType: 0 = both face each other (default), 1 = only char1 faces char2
 */
const watchCommand: CommandHandler = (params, _result, helpers) => {
  const char1 = helpers.resolveString(params[0] || "");
  const char2 = helpers.resolveString(params[1] || "");
  const watchType = helpers.resolveNumber(params[2] || "0");
  helpers.api.npc.watch(char1, char2, watchType);
  return true;
};

// ============= Extended NPC Commands =============

/**
 * SetNpcKind - Set NPC type/kind
 * SetNpcKind(name, kind)
 */
const setNpcKindCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const kind = helpers.resolveNumber(params[1] || "0");
  helpers.api.npc.setKind(npcName, kind);
  return true;
};

/**
 * SetNpcMagicFile - Set NPC magic file
 * 1-param (magicFile) with belongObject, or 2-param (name, magicFile)
 */
const setNpcMagicFileCommand: CommandHandler = (params, _result, helpers) => {
  let npcName: string;
  let magicFile: string;

  if (params.length === 1) {
    // 1-param version: use belongObject as target
    const belongObject = helpers.state.belongObject;
    if (belongObject && belongObject.type === "npc") {
      npcName = belongObject.id;
    } else {
      return true; // No target, skip
    }
    magicFile = helpers.resolveString(params[0] || "");
  } else {
    // 2-param version: name, magicFile
    npcName = helpers.resolveString(params[0] || "");
    magicFile = helpers.resolveString(params[1] || "");
  }

  helpers.api.npc.setMagicFile(npcName, magicFile);
  return true;
};

/**
 * SetNpcRes - Set NPC resource file
 *
 */
const setNpcResCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const resFile = helpers.resolveString(params[1] || "");
  helpers.api.npc.setResource(npcName, resFile);
  return true;
};

/**
 * SetNpcAction - Set NPC action state
 * SetNpcAction(name, action, x?, y?)
 */
const setNpcActionCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const action = helpers.resolveNumber(params[1] || "0");
  const x = params.length >= 3 ? helpers.resolveNumber(params[2]) : undefined;
  const y = params.length >= 4 ? helpers.resolveNumber(params[3]) : undefined;
  helpers.api.npc.setAction(npcName, action, x, y);
  return true;
};

/**
 * SetNpcActionType - Set NPC action type
 *
 */
const setNpcActionTypeCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const actionType = helpers.resolveNumber(params[1] || "0");
  helpers.api.npc.setActionType(npcName, actionType);
  return true;
};

/**
 * SetAllNpcScript - Set script for all NPCs with same name
 *
 */
const setAllNpcScriptCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const scriptFile = helpers.resolveString(params[1] || "");
  helpers.api.npc.setAllScript(npcName, scriptFile);
  return true;
};

/**
 * SetAllNpcDeathScript - Set death script for all NPCs with same name
 *
 */
const setAllNpcDeathScriptCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const scriptFile = helpers.resolveString(params[1] || "");
  helpers.api.npc.setAllDeathScript(npcName, scriptFile);
  return true;
};

/**
 * NpcAttack - Make NPC attack at position
 * NpcAttack(name, x, y)
 */
const npcAttackCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  helpers.api.npc.attack(npcName, x, y);
  return true;
};

/**
 * FollowNpc - Make one character follow another
 * FollowNpc(follower, target) or FollowNpc(target) with belongObject
 */
const followNpcCommand: CommandHandler = (params, _result, helpers) => {
  let follower: string;
  let target: string;

  if (params.length >= 2) {
    follower = helpers.resolveString(params[0] || "");
    target = helpers.resolveString(params[1] || "");
  } else {
    // Use belongObject as follower
    const belongObject = helpers.state.belongObject;
    follower = belongObject?.id || "";
    target = helpers.resolveString(params[0] || "");
  }

  helpers.api.npc.follow(follower, target);
  return true;
};

/**
 * SetNpcMagicToUseWhenBeAttacked - Set NPC counter-attack magic
 *
 */
const setNpcMagicToUseWhenBeAttackedCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const magicFile = helpers.resolveString(params[1] || "");
  const direction = helpers.resolveNumber(params[2] || "0");
  helpers.api.npc.setMagicWhenAttacked(npcName, magicFile, direction);
  return true;
};

/**
 * AddNpcProperty - Add value to NPC property
 * AddNpcProperty(name, property, value)
 */
const addNpcPropertyCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const property = helpers.resolveString(params[1] || "");
  const value = helpers.resolveNumber(params[2] || "0");
  helpers.api.npc.addProperty(npcName, property, value);
  return true;
};

/**
 * ChangeFlyIni - Change NPC fly magic
 * ChangeFlyIni(name, magicFile)
 */
const changeFlyIniCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const magicFile = helpers.resolveString(params[1] || "");
  helpers.api.npc.changeFlyIni(npcName, magicFile);
  return true;
};

/**
 * ChangeFlyIni2 - Change NPC secondary fly magic
 * ChangeFlyIni2(name, magicFile)
 */
const changeFlyIni2Command: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const magicFile = helpers.resolveString(params[1] || "");
  helpers.api.npc.changeFlyIni2(npcName, magicFile);
  return true;
};

/**
 * AddFlyInis - Add fly magic with distance
 * AddFlyInis(name, magicFile, distance)
 */
const addFlyInisCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const magicFile = helpers.resolveString(params[1] || "");
  const distance = helpers.resolveNumber(params[2] || "0");
  helpers.api.npc.addFlyInis(npcName, magicFile, distance);
  return true;
};

/**
 * SetNpcDestination - Set NPC destination
 * SetNpcDestination(name, x, y)
 */
const setNpcDestinationCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  helpers.api.npc.setDestination(npcName, x, y);
  return true;
};

/**
 * GetNpcCount - Get NPC count by kind range
 * GetNpcCount(kind1, kind2)
 */
const getNpcCountCommand: CommandHandler = (params, _result, helpers) => {
  const kind1 = helpers.resolveNumber(params[0] || "0");
  const kind2 = helpers.resolveNumber(params[1] || "0");
  const count = helpers.api.npc.getCount(kind1, kind2);
  helpers.api.variables.set("NpcCount", count);
  return true;
};

/**
 * SetKeepAttack - Set NPC keep attack position
 * SetKeepAttack(name, x, y)
 */
const setKeepAttackCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  helpers.api.npc.setKeepAttack(npcName, x, y);
  return true;
};

/**
 * Register all NPC commands
 */
export function registerNpcCommands(registry: CommandRegistry): void {
  // NPC creation/removal
  registry.set("addnpc", addNpcCommand);
  registry.set("loadnpc", loadNpcCommand);
  registry.set("loadonenpc", loadOneNpcCommand);
  registry.set("deletenpc", deleteNpcCommand);
  registry.set("delnpc", delNpcCommand);
  registry.set("mergenpc", mergeNpcCommand);

  // NPC positioning
  registry.set("setnpcpos", setNpcPosCommand);
  registry.set("setnpcdir", setNpcDirCommand);
  registry.set("setnpcstate", setNpcStateCommand);
  registry.set("setnpclevel", setNpcLevelCommand);

  // NPC movement
  registry.set("npcgoto", npcGotoCommand);
  registry.set("npcgotoex", npcGotoExCommand);
  registry.set("npcgotodir", npcGotoDirCommand);

  // NPC animation
  registry.set("setnpcactionfile", setNpcActionFileCommand);
  registry.set("npcspecialaction", npcSpecialActionCommand);
  registry.set("npcspecialactionex", npcSpecialActionExCommand);

  // NPC visibility and scripts
  registry.set("shownpc", showNpcCommand);
  registry.set("setnpcscript", setNpcScriptCommand);
  registry.set("setnpcdeathscript", setNpcDeathScriptCommand);

  // NPC state management
  registry.set("savenpc", saveNpcCommand);
  registry.set("disablenpcai", disableNpcAICommand);
  registry.set("enablenpcai", enableNpcAICommand);
  registry.set("setnpcrelation", setNpcRelationCommand);

  // Character interaction
  registry.set("watch", watchCommand);

  // Extended NPC commands
  registry.set("setnpckind", setNpcKindCommand);
  registry.set("setnpcmagicfile", setNpcMagicFileCommand);
  registry.set("setnpcres", setNpcResCommand);
  registry.set("setnpcaction", setNpcActionCommand);
  registry.set("setnpcactiontype", setNpcActionTypeCommand);
  registry.set("setallnpcscript", setAllNpcScriptCommand);
  registry.set("setallnpcdeathscript", setAllNpcDeathScriptCommand);
  registry.set("npcattack", npcAttackCommand);
  registry.set("follownpc", followNpcCommand);
  registry.set("setnpcmagictousewhenbeatacked", setNpcMagicToUseWhenBeAttackedCommand);
  registry.set("addnpcproperty", addNpcPropertyCommand);
  registry.set("changeflyini", changeFlyIniCommand);
  registry.set("changeflyini2", changeFlyIni2Command);
  registry.set("addflyinis", addFlyInisCommand);
  registry.set("setnpcdestination", setNpcDestinationCommand);
  registry.set("getnpccount", getNpcCountCommand);
  registry.set("setkeepattack", setKeepAttackCommand);
}
