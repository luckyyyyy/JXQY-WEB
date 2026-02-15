/**
 * Object Commands - LoadObj, AddObj, DelObj, OpenBox, SetTrap, etc.
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
import { logger } from "../../core/logger";
import type { CommandHandler, CommandRegistry } from "./types";

/**
 * LoadObj - Load object file
 */
const loadObjCommand: CommandHandler = async (params, _result, helpers) => {
  const fileName = helpers.resolveString(params[0] || "");
  logger.log(`[ScriptExecutor] Executing LoadObj: ${fileName}`);
  await helpers.api.obj.load(fileName);
  logger.log(`[ScriptExecutor] LoadObj completed: ${fileName}`);
  return true;
};

/**
 * AddObj - Add object at position
 */
const addObjCommand: CommandHandler = async (params, _result, helpers) => {
  const fileName = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  const direction = helpers.resolveNumber(params[3] || "0");
  logger.log(`[ScriptExecutor] AddObj: ${fileName} at (${x}, ${y}) dir=${direction}`);
  await helpers.api.obj.add(fileName, x, y, direction);
  return true;
};

/**
 * DelObj - Delete object by name
 */
const delObjCommand: CommandHandler = (params, _result, helpers) => {
  const objName = helpers.resolveString(params[0] || "");
  logger.log(`[ScriptExecutor] DelObj: ${objName}`);
  helpers.api.obj.delete(objName);
  return true;
};

/**
 * DelCurObj - Delete the object that triggered this script
 * Uses the belongObject from script state
 */
const delCurObjCommand: CommandHandler = (_params, _result, helpers) => {
  const belongObject = helpers.state.belongObject;
  if (belongObject && belongObject.type === "obj") {
    logger.log(`[ScriptExecutor] DelCurObj: removing object ${belongObject.id}`);
    // Use special marker to indicate delete by ID
    helpers.api.obj.delete(`__id__:${belongObject.id}`);
  } else {
    logger.warn(`[ScriptExecutor] DelCurObj: no belongObject or not an obj type`);
  }
  return true;
};

/**
 * OpenBox - Play box opening animation
 */
const openBoxCommand: CommandHandler = (params, _result, helpers) => {
  const objName = helpers.resolveString(params[0] || "");

  if (objName) {
    // Named object
    logger.log(`[ScriptExecutor] OpenBox: ${objName}`);
    helpers.api.obj.openBox(objName);
  } else {
    // Use belongObject (current object that triggered script)
    const belongObject = helpers.state.belongObject;
    if (belongObject && belongObject.type === "obj") {
      logger.log(`[ScriptExecutor] OpenBox (belongObject): ${belongObject.id}`);
      helpers.api.obj.openBox(belongObject.id);
    } else {
      logger.warn(`[ScriptExecutor] OpenBox: no object specified and no belongObject`);
    }
  }
  return true;
};

/**
 * CloseBox - Play box closing animation
 */
const closeBoxCommand: CommandHandler = (params, _result, helpers) => {
  const objName = helpers.resolveString(params[0] || "");

  if (objName) {
    logger.log(`[ScriptExecutor] CloseBox: ${objName}`);
    helpers.api.obj.closeBox(objName);
  } else {
    const belongObject = helpers.state.belongObject;
    if (belongObject && belongObject.type === "obj") {
      logger.log(`[ScriptExecutor] CloseBox (belongObject): ${belongObject.id}`);
      helpers.api.obj.closeBox(belongObject.id);
    }
  }
  return true;
};

/**
 * SetObjScript - Set object script
 * When called as SetObjScript(, ) with empty name, uses belongObject
 * When scriptFile is empty, the object becomes non-interactive
 */
const setObjScriptCommand: CommandHandler = (params, _result, helpers) => {
  let objNameOrId = helpers.resolveString(params[0] || "");
  const scriptFile = helpers.resolveString(params[1] || "");

  // If no name provided, use the object that triggered this script
  if (!objNameOrId && helpers.state.belongObject?.type === "obj") {
    objNameOrId = helpers.state.belongObject.id;
  }

  if (objNameOrId) {
    helpers.api.obj.setScript(objNameOrId, scriptFile);
  } else {
    logger.warn(`[SetObjScript] No object specified and no belongObject`);
  }
  return true;
};

/**
 * SaveObj - Save object state
 * saves current objects to save file
 */
const saveObjCommand: CommandHandler = async (params, _result, helpers) => {
  const fileName = params[0] ? helpers.resolveString(params[0]) : undefined;
  await helpers.api.obj.save(fileName);
  return true;
};

/**
 * SetObjOfs - Set object offset
 * SetObjOfs(name, x, y)
 */
const setObjOfsCommand: CommandHandler = (params, _result, helpers) => {
  const objName = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  helpers.api.obj.setOffset(objName, x, y);
  return true;
};

/**
 * ClearBody - Clear dead bodies
 */
const clearBodyCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.obj.clearBody();
  return true;
};

// ============= Trap Commands =============

/**
 * SetTrap - Set map trap (with map name)
 */
const setTrapCommand: CommandHandler = (params, _result, helpers) => {
  const mapName = helpers.resolveString(params[0] || "");
  const trapIndex = helpers.resolveNumber(params[1] || "0");
  const trapFileName = helpers.resolveString(params[2] || "");
  logger.log(`SetTrap: map=${mapName}, index=${trapIndex}, file=${trapFileName}`);
  helpers.api.map.setTrap(trapIndex, trapFileName, mapName || undefined);
  return true;
};

/**
 * SetMapTrap - Set map trap (current map)
 */
const setMapTrapCommand: CommandHandler = (params, _result, helpers) => {
  const trapIndex = helpers.resolveNumber(params[0] || "0");
  const trapFileName = helpers.resolveString(params[1] || "");
  helpers.api.map.setTrap(trapIndex, trapFileName);
  return true;
};

/**
 * SaveMapTrap - Save map trap state
 */
const saveMapTrapCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.map.saveTrap();
  return true;
};

export function registerObjCommands(registry: CommandRegistry): void {
  // Objects
  registry.set("loadobj", loadObjCommand);
  registry.set("addobj", addObjCommand);
  registry.set("delobj", delObjCommand);
  registry.set("delcurobj", delCurObjCommand);
  registry.set("openbox", openBoxCommand);
  registry.set("openobj", openBoxCommand); // alias: OpenObj calls OpenBox
  registry.set("closebox", closeBoxCommand);
  registry.set("setobjscript", setObjScriptCommand);
  registry.set("saveobj", saveObjCommand);
  registry.set("setobjofs", setObjOfsCommand);
  registry.set("clearbody", clearBodyCommand);

  // Traps
  registry.set("settrap", setTrapCommand);
  registry.set("setmaptrap", setMapTrapCommand);
  registry.set("savemaptrap", saveMapTrapCommand);
}
