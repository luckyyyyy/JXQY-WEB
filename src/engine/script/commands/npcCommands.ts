/**
 * NPC Commands - NPC control and management
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
import type { CommandHandler, CommandRegistry } from "./types";

/**
 * AddNpc - Add NPC to map
 */
const addNpcCommand: CommandHandler = (params, _result, helpers) => {
  const npcFile = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  helpers.context.addNpc(npcFile, x, y);
  return true;
};

/**
 * LoadNpc - Load NPC file
 */
const loadNpcCommand: CommandHandler = async (params, _result, helpers) => {
  const npcFile = helpers.resolveString(params[0] || "");
  console.log("LoadNpc:", npcFile);
  await helpers.context.loadNpc(npcFile);
  return true;
};

/**
 * LoadOneNpc - Load single NPC at position
 */
const loadOneNpcCommand: CommandHandler = (params, _result, helpers) => {
  const npcFile = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  helpers.context.addNpc(npcFile, x, y);
  return true;
};

/**
 * DeleteNpc - Remove NPC from map
 */
const deleteNpcCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  helpers.context.deleteNpc(npcName);
  return true;
};

/**
 * DelNpc - Alias for DeleteNpc
 */
const delNpcCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  helpers.context.deleteNpc(npcName);
  return true;
};

/**
 * SetNpcPos - Set NPC tile position
 */
const setNpcPosCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  helpers.context.setNpcPosition(npcName, x, y);
  return true;
};

/**
 * SetNpcDir - Set NPC facing direction
 */
const setNpcDirCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const direction = helpers.resolveNumber(params[1] || "0");
  helpers.context.setNpcDirection(npcName, direction);
  return true;
};

/**
 * SetNpcState - Set NPC state
 */
const setNpcStateCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const state = helpers.resolveNumber(params[1] || "0");
  helpers.context.setNpcState(npcName, state);
  return true;
};

/**
 * SetNpcLevel - Set NPC level
 */
const setNpcLevelCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const level = helpers.resolveNumber(params[1] || "1");
  helpers.context.setNpcLevel(npcName, level);
  return true;
};

/**
 * NpcGoto - Walk NPC to position (BLOCKING)
 */
const npcGotoCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  const destination = { x, y };
  helpers.context.npcGoto(npcName, x, y);

  if (helpers.context.isNpcGotoEnd(npcName, destination)) {
    return true;
  }

  helpers.state.waitingForNpcGoto = true;
  helpers.state.npcGotoName = npcName;
  helpers.state.npcGotoDestination = destination;
  return false;
};

/**
 * NpcGotoEx - Walk NPC to position (NON-BLOCKING)
 * C#: NpcGotoEx just calls target.WalkTo() without waiting
 */
const npcGotoExCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  helpers.context.npcGoto(npcName, x, y);
  // Non-blocking, return immediately
  return true;
};

/**
 * NpcGotoDir - Walk NPC in direction (BLOCKING)
 */
const npcGotoDirCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const direction = helpers.resolveNumber(params[1] || "0");
  const steps = helpers.resolveNumber(params[2] || "1");
  helpers.context.npcGotoDir(npcName, direction, steps);

  if (helpers.context.isNpcGotoDirEnd(npcName)) {
    return true;
  }

  helpers.state.waitingForNpcGotoDir = true;
  helpers.state.npcGotoDirName = npcName;
  return false;
};

/**
 * SetNpcActionFile - Set NPC animation file for a state
 */
const setNpcActionFileCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const stateType = helpers.resolveNumber(params[1] || "0");
  const asfFile = helpers.resolveString(params[2] || "");
  console.log(`[ScriptExecutor] SetNpcActionFile: name="${npcName}", state=${stateType}, file="${asfFile}"`);
  helpers.context.setNpcActionFile(npcName, stateType, asfFile);
  return true;
};

/**
 * NpcSpecialAction - Play NPC special animation (non-blocking)
 */
const npcSpecialActionCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const asfFile = helpers.resolveString(params[1] || "");
  helpers.context.npcSpecialAction(npcName, asfFile);
  return true;
};

/**
 * NpcSpecialActionEx - Play NPC special animation (BLOCKING)
 */
const npcSpecialActionExCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const asfFile = helpers.resolveString(params[1] || "");
  helpers.context.npcSpecialAction(npcName, asfFile);

  if (helpers.context.isNpcSpecialActionEnd(npcName)) {
    return true;
  }

  helpers.state.waitingForNpcSpecialAction = true;
  helpers.state.npcSpecialActionName = npcName;
  return false;
};

/**
 * ShowNpc - Show/hide NPC
 */
const showNpcCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const show = helpers.resolveNumber(params[1] || "1");
  console.log(`ShowNpc: ${npcName}, show=${show}`);
  return true;
};

/**
 * SetNpcScript - Set NPC interaction script
 */
const setNpcScriptCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const scriptFile = helpers.resolveString(params[1] || "");
  console.log(`SetNpcScript: ${npcName} -> ${scriptFile}`);
  return true;
};

/**
 * SetNpcDeathScript - Set NPC death script
 * C#: ScriptExecuter.SetNpcDeathScript - Sets the death script for an NPC
 */
const setNpcDeathScriptCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const scriptFile = helpers.resolveString(params[1] || "");
  console.log(`SetNpcDeathScript: ${npcName} -> ${scriptFile}`);
  helpers.context.setNpcDeathScript(npcName, scriptFile);
  return true;
};

/**
 * MergeNpc - Merge NPC file
 */
const mergeNpcCommand: CommandHandler = (params, _result, helpers) => {
  const npcFile = helpers.resolveString(params[0] || "");
  console.log(`MergeNpc: ${npcFile}`);
  return true;
};

/**
 * SaveNpc - Save NPC state
 */
const saveNpcCommand: CommandHandler = () => {
  console.log("SaveNpc - saving current NPCs state");
  return true;
};

/**
 * DisableNpcAI - Disable global NPC AI
 */
const disableNpcAICommand: CommandHandler = (_params, _result, helpers) => {
  console.log("DisableNpcAI");
  helpers.context.disableNpcAI();
  return true;
};

/**
 * EnableNpcAI - Enable global NPC AI
 */
const enableNpcAICommand: CommandHandler = (_params, _result, helpers) => {
  console.log("EnableNpcAI");
  helpers.context.enableNpcAI();
  return true;
};

/**
 * SetNpcRelation - Set NPC relation type
 * C#: SetNpcRelation(name, relation) where relation is 0=Friend, 1=Enemy, 2=None
 */
const setNpcRelationCommand: CommandHandler = (params, _result, helpers) => {
  const npcName = helpers.resolveString(params[0] || "");
  const relation = helpers.resolveNumber(params[1] || "0");
  console.log(`SetNpcRelation: ${npcName} -> ${relation}`);
  helpers.context.setNpcRelation(npcName, relation);
  return true;
};

/**
 * Watch - Make character face another character
 */
const watchCommand: CommandHandler = (params, _result, helpers) => {
  const char1 = helpers.resolveString(params[0] || "");
  const char2 = helpers.resolveString(params[1] || "");
  console.log(`Watch: ${char1} -> ${char2}`);
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
}
