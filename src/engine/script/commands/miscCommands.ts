/**
 * Misc Commands - Audio, Effects, Weather, Objects, Memo
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
import type { CommandHandler, CommandRegistry } from "./types";

// ============= Audio Commands =============

/**
 * PlayMusic - Play background music
 */
const playMusicCommand: CommandHandler = (params, _result, helpers) => {
  const file = helpers.resolveString(params[0] || "");
  helpers.context.playMusic(file);
  return true;
};

/**
 * StopMusic - Stop background music
 */
const stopMusicCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.stopMusic();
  return true;
};

/**
 * PlaySound - Play sound effect
 */
const playSoundCommand: CommandHandler = (params, _result, helpers) => {
  const file = helpers.resolveString(params[0] || "");
  console.log(`[ScriptExecutor] PlaySound: "${file}"`);
  helpers.context.playSound(file);
  return true;
};

/**
 * PlayMovie - Play video (placeholder)
 */
const playMovieCommand: CommandHandler = (params) => {
  console.log("PlayMovie:", params[0]);
  return true;
};

// ============= Screen Effects Commands =============

/**
 * FadeIn - Fade in effect (BLOCKING)
 */
const fadeInCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.fadeIn();

  if (helpers.context.isFadeInEnd()) {
    return true;
  }

  helpers.state.waitingForFadeIn = true;
  return false;
};

/**
 * FadeOut - Fade out effect (BLOCKING)
 */
const fadeOutCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.fadeOut();

  if (helpers.context.isFadeOutEnd()) {
    return true;
  }

  helpers.state.waitingForFadeOut = true;
  return false;
};

/**
 * MoveScreen - Move camera (BLOCKING)
 */
const moveScreenCommand: CommandHandler = (params, _result, helpers) => {
  const direction = helpers.resolveNumber(params[0] || "0");
  const distance = helpers.resolveNumber(params[1] || "100");
  const speed = helpers.resolveNumber(params[2] || "1");
  helpers.context.moveScreen(direction, distance, speed);

  if (helpers.context.isMoveScreenEnd()) {
    return true;
  }

  helpers.state.waitingForMoveScreen = true;
  return false;
};

/**
 * ChangeMapColor - Change map tint color
 */
const changeMapColorCommand: CommandHandler = (params, _result, helpers) => {
  const r = helpers.resolveNumber(params[0] || "255");
  const g = helpers.resolveNumber(params[1] || "255");
  const b = helpers.resolveNumber(params[2] || "255");
  helpers.context.changeMapColor(r, g, b);
  return true;
};

/**
 * ChangeAsfColor - Change sprite tint color
 */
const changeAsfColorCommand: CommandHandler = (params, _result, helpers) => {
  const r = helpers.resolveNumber(params[0] || "255");
  const g = helpers.resolveNumber(params[1] || "255");
  const b = helpers.resolveNumber(params[2] || "255");
  helpers.context.changeAsfColor(r, g, b);
  return true;
};

// ============= Weather Commands =============

/**
 * BeginRain - Start rain effect
 */
const beginRainCommand: CommandHandler = (params, _result, helpers) => {
  const intensity = helpers.resolveNumber(params[0] || "5");
  console.log(`BeginRain: intensity=${intensity}`);
  return true;
};

/**
 * EndRain - Stop rain effect
 */
const endRainCommand: CommandHandler = () => {
  console.log("EndRain");
  return true;
};

/**
 * ShowSnow - Show snow effect
 */
const showSnowCommand: CommandHandler = (params, _result, helpers) => {
  const intensity = helpers.resolveNumber(params[0] || "5");
  console.log(`ShowSnow: intensity=${intensity}`);
  return true;
};

// ============= Object Commands =============

/**
 * LoadObj - Load object file
 */
const loadObjCommand: CommandHandler = async (params, _result, helpers) => {
  const fileName = helpers.resolveString(params[0] || "");
  console.log(`[ScriptExecutor] Executing LoadObj: ${fileName}`);
  await helpers.context.loadObj(fileName);
  console.log(`[ScriptExecutor] LoadObj completed: ${fileName}`);
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
  console.log(`[ScriptExecutor] AddObj: ${fileName} at (${x}, ${y}) dir=${direction}`);
  await helpers.context.addObj(fileName, x, y, direction);
  return true;
};

/**
 * DelObj - Delete object by name
 * C# Reference: ScriptExecuter.DelObj
 */
const delObjCommand: CommandHandler = (params, _result, helpers) => {
  const objName = helpers.resolveString(params[0] || "");
  console.log(`[ScriptExecutor] DelObj: ${objName}`);
  helpers.context.delObj(objName);
  return true;
};

/**
 * DelCurObj - Delete the object that triggered this script
 * C# Reference: ScriptExecuter.DelCurObj
 * Uses the belongObject from script state
 */
const delCurObjCommand: CommandHandler = (_params, _result, helpers) => {
  const belongObject = helpers.state.belongObject;
  if (belongObject && belongObject.type === "obj") {
    console.log(`[ScriptExecutor] DelCurObj: removing object ${belongObject.id}`);
    // Use special marker to indicate delete by ID
    helpers.context.delObj(`__id__:${belongObject.id}`);
  } else {
    console.warn(`[ScriptExecutor] DelCurObj: no belongObject or not an obj type`);
  }
  return true;
};

/**
 * OpenBox - Play box opening animation
 * C# Reference: ScriptExecuter.OpenBox
 */
const openBoxCommand: CommandHandler = (params, _result, helpers) => {
  const objName = helpers.resolveString(params[0] || "");

  if (objName) {
    // Named object
    console.log(`[ScriptExecutor] OpenBox: ${objName}`);
    helpers.context.openBox(objName);
  } else {
    // Use belongObject (current object that triggered script)
    const belongObject = helpers.state.belongObject;
    if (belongObject && belongObject.type === "obj") {
      console.log(`[ScriptExecutor] OpenBox (belongObject): ${belongObject.id}`);
      helpers.context.openBox(belongObject.id);
    } else {
      console.warn(`[ScriptExecutor] OpenBox: no object specified and no belongObject`);
    }
  }
  return true;
};

/**
 * CloseBox - Play box closing animation
 * C# Reference: ScriptExecuter.CloseBox
 */
const closeBoxCommand: CommandHandler = (params, _result, helpers) => {
  const objName = helpers.resolveString(params[0] || "");

  if (objName) {
    console.log(`[ScriptExecutor] CloseBox: ${objName}`);
    helpers.context.closeBox(objName);
  } else {
    const belongObject = helpers.state.belongObject;
    if (belongObject && belongObject.type === "obj") {
      console.log(`[ScriptExecutor] CloseBox (belongObject): ${belongObject.id}`);
      helpers.context.closeBox(belongObject.id);
    }
  }
  return true;
};

/**
 * AddRandGoods - Add random goods from buy file
 * C# Reference: ScriptExecuter.AddRandGoods
 */
const addRandGoodsCommand: CommandHandler = async (params, _result, helpers) => {
  const buyFileName = helpers.resolveString(params[0] || "");
  console.log(`[ScriptExecutor] AddRandGoods: ${buyFileName}`);
  await helpers.context.addRandGoods(buyFileName);
  return true;
};

/**
 * SetObjScript - Set object script
 * C# Reference: ScriptExecuter.SetObjScript
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
    helpers.context.setObjScript(objNameOrId, scriptFile);
  } else {
    console.warn(`[SetObjScript] No object specified and no belongObject`);
  }
  return true;
};

/**
 * SaveObj - Save object state
 */
const saveObjCommand: CommandHandler = () => {
  console.log("SaveObj - saving current Objs state");
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
  console.log(`SetTrap: map=${mapName}, index=${trapIndex}, file=${trapFileName}`);
  helpers.context.setMapTrap(trapIndex, trapFileName, mapName || undefined);
  return true;
};

/**
 * SetMapTrap - Set map trap (current map)
 */
const setMapTrapCommand: CommandHandler = (params, _result, helpers) => {
  const trapIndex = helpers.resolveNumber(params[0] || "0");
  const trapFileName = helpers.resolveString(params[1] || "");
  helpers.context.setMapTrap(trapIndex, trapFileName);
  return true;
};

// ============= Memo Commands =============

/**
 * Memo - Add memo text directly
 */
const memoCommand: CommandHandler = (params, _result, helpers) => {
  const memoText = helpers.resolveString(params[0] || "");
  console.log(`[ScriptExecutor] Memo: "${memoText}"`);
  helpers.context.addMemo(memoText);
  return true;
};

/**
 * AddToMemo - Add memo from TalkTextList by ID
 */
const addToMemoCommand: CommandHandler = async (params, _result, helpers) => {
  const memoId = helpers.resolveNumber(params[0] || "0");
  const talkTextList = helpers.context.talkTextList;
  const detail = talkTextList.getTextDetail(memoId);
  if (detail) {
    console.log(`[ScriptExecutor] AddToMemo ${memoId}: ${detail.text}`);
  }
  await helpers.context.addToMemo(memoId);
  return true;
};

/**
 * DelMemo - Delete memo
 */
const delMemoCommand: CommandHandler = async (params, _result, helpers) => {
  const param = params[0] || "";
  if (/^[0-9]+$/.test(param.trim())) {
    const textId = parseInt(param, 10);
    console.log(`[ScriptExecutor] DelMemo by ID: ${textId}`);
    await helpers.context.delMemoById(textId);
  } else {
    const memoText = helpers.resolveString(param);
    console.log(`[ScriptExecutor] DelMemo: "${memoText}"`);
    helpers.context.delMemo(memoText);
  }
  return true;
};

// ============= Misc Commands =============

/**
 * ClearBody - Clear dead bodies
 */
const clearBodyCommand: CommandHandler = () => {
  console.log("ClearBody");
  return true;
};

/**
 * Register all misc commands
 */
export function registerMiscCommands(registry: CommandRegistry): void {
  // Audio
  registry.set("playmusic", playMusicCommand);
  registry.set("stopmusic", stopMusicCommand);
  registry.set("playsound", playSoundCommand);
  registry.set("playmovie", playMovieCommand);

  // Screen effects
  registry.set("fadein", fadeInCommand);
  registry.set("fadeout", fadeOutCommand);
  registry.set("movescreen", moveScreenCommand);
  registry.set("changemapcolor", changeMapColorCommand);
  registry.set("changeasfcolor", changeAsfColorCommand);

  // Weather
  registry.set("beginrain", beginRainCommand);
  registry.set("endrain", endRainCommand);
  registry.set("showsnow", showSnowCommand);

  // Objects
  registry.set("loadobj", loadObjCommand);
  registry.set("addobj", addObjCommand);
  registry.set("delobj", delObjCommand);
  registry.set("delcurobj", delCurObjCommand);
  registry.set("openbox", openBoxCommand);
  registry.set("closebox", closeBoxCommand);
  registry.set("setobjscript", setObjScriptCommand);
  registry.set("saveobj", saveObjCommand);

  // Traps
  registry.set("settrap", setTrapCommand);
  registry.set("setmaptrap", setMapTrapCommand);

  // Memo
  registry.set("memo", memoCommand);
  registry.set("addtomemo", addToMemoCommand);
  registry.set("delmemo", delMemoCommand);

  // Misc
  registry.set("clearbody", clearBodyCommand);
}
