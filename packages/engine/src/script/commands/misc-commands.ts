/**
 * Misc Commands - Audio, Effects, Weather, Objects, Memo
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
import { logger } from "../../core/logger";
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
 * PlaySound - Play sound effect with optional 3D positioning
 * PlaySound uses belongObject (Sprite) position for 3D spatial audio
 * SoundManager.Play3DSoundOnece(sound, soundPosition - Globals.ListenerPosition)
 */
const playSoundCommand: CommandHandler = (params, _result, helpers) => {
  const file = helpers.resolveString(params[0] || "");
  logger.log(`[ScriptExecutor] PlaySound: "${file}"`);

  // var soundPosition = Globals.ListenerPosition;
  // var sprit = belongObject as Sprite;
  // if (sprit != null) soundPosition = sprit.PositionInWorld;
  const belongObject = helpers.state.belongObject;
  if (belongObject) {
    let position: { x: number; y: number } | null = null;

    if (belongObject.type === "npc") {
      // Get NPC position
      position = helpers.context.getNpcPosition?.(belongObject.id) ?? null;
    } else if (belongObject.type === "obj") {
      // Get OBJ position
      position = helpers.context.getObjPosition?.(belongObject.id) ?? null;
    }

    if (position) {
      helpers.context.playSound(file, position);
      return true;
    }
  }

  // Fallback to non-positional sound (when no belongObject or position not found)
  helpers.context.playSound(file);
  return true;
};

/**
 * PlayMovie - Play video file (BLOCKING)
 * PlayMovie(fileName) plays video using XNA VideoPlayer
 * Blocks script execution until video ends or is skipped
 */
const playMovieCommand: CommandHandler = async (params, _result, helpers) => {
  const file = helpers.resolveString(params[0] || "");
  logger.log(`[ScriptExecutor] PlayMovie: "${file}"`);
  await helpers.context.playMovie(file);
  return true;
};

// ============= Screen Effects Commands =============

/**
 * FadeIn - Fade in effect (BLOCKING)
 */
const fadeInCommand: CommandHandler = async (_params, _result, helpers) => {
  await helpers.context.fadeIn();
  return true;
};

/**
 * FadeOut - Fade out effect (BLOCKING)
 */
const fadeOutCommand: CommandHandler = async (_params, _result, helpers) => {
  await helpers.context.fadeOut();
  return true;
};

/**
 * MoveScreen - Move camera (BLOCKING)
 */
const moveScreenCommand: CommandHandler = async (params, _result, helpers) => {
  const direction = helpers.resolveNumber(params[0] || "0");
  const distance = helpers.resolveNumber(params[1] || "100");
  const speed = helpers.resolveNumber(params[2] || "1");
  await helpers.context.moveScreen(direction, distance, speed);
  return true;
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
 * WeatherManager.BeginRain(string fileName)
 * 参数是雨效果配置文件名，如 "Rain2.ini"
 */
const beginRainCommand: CommandHandler = (params, _result, helpers) => {
  const fileName = helpers.resolveString(params[0] || "");
  helpers.context.beginRain(fileName);
  return true;
};

/**
 * EndRain - Stop rain effect
 *
 */
const endRainCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.endRain();
  return true;
};

/**
 * ShowSnow - Show snow effect
 *
 */
const showSnowCommand: CommandHandler = (params, _result, helpers) => {
  const show = helpers.resolveNumber(params[0] || "1") !== 0;
  helpers.context.showSnow(show);
  return true;
};

// ============= Object Commands =============

/**
 * LoadObj - Load object file
 */
const loadObjCommand: CommandHandler = async (params, _result, helpers) => {
  const fileName = helpers.resolveString(params[0] || "");
  logger.log(`[ScriptExecutor] Executing LoadObj: ${fileName}`);
  await helpers.context.loadObj(fileName);
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
  await helpers.context.addObj(fileName, x, y, direction);
  return true;
};

/**
 * DelObj - Delete object by name
 */
const delObjCommand: CommandHandler = (params, _result, helpers) => {
  const objName = helpers.resolveString(params[0] || "");
  logger.log(`[ScriptExecutor] DelObj: ${objName}`);
  helpers.context.delObj(objName);
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
    helpers.context.delObj(`__id__:${belongObject.id}`);
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
    helpers.context.openBox(objName);
  } else {
    // Use belongObject (current object that triggered script)
    const belongObject = helpers.state.belongObject;
    if (belongObject && belongObject.type === "obj") {
      logger.log(`[ScriptExecutor] OpenBox (belongObject): ${belongObject.id}`);
      helpers.context.openBox(belongObject.id);
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
    helpers.context.closeBox(objName);
  } else {
    const belongObject = helpers.state.belongObject;
    if (belongObject && belongObject.type === "obj") {
      logger.log(`[ScriptExecutor] CloseBox (belongObject): ${belongObject.id}`);
      helpers.context.closeBox(belongObject.id);
    }
  }
  return true;
};

/**
 * AddRandGoods - Add random goods from buy file
 */
const _addRandGoodsCommand: CommandHandler = async (params, _result, helpers) => {
  const buyFileName = helpers.resolveString(params[0] || "");
  logger.log(`[ScriptExecutor] AddRandGoods: ${buyFileName}`);
  await helpers.context.addRandGoods(buyFileName);
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
    helpers.context.setObjScript(objNameOrId, scriptFile);
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
  await helpers.context.saveObj(fileName);
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
  logger.log(`[ScriptExecutor] Memo: "${memoText}"`);
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
    logger.log(`[ScriptExecutor] AddToMemo ${memoId}: ${detail.text}`);
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
    logger.log(`[ScriptExecutor] DelMemo by ID: ${textId}`);
    await helpers.context.delMemoById(textId);
  } else {
    const memoText = helpers.resolveString(param);
    logger.log(`[ScriptExecutor] DelMemo: "${memoText}"`);
    helpers.context.delMemo(memoText);
  }
  return true;
};

// ============= Misc Commands =============

/**
 * ClearBody - Clear dead bodies
 */
const clearBodyCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.clearBody();
  return true;
};

// ============= Timer Commands =============

/**
 * OpenTimeLimit - Start a countdown timer
 * OpenTimeLimit(int seconds)
 */
const openTimeLimitCommand: CommandHandler = (params, _result, helpers) => {
  const seconds = helpers.resolveNumber(params[0] || "0");
  helpers.context.openTimeLimit(seconds);
  return true;
};

/**
 * CloseTimeLimit - Stop and hide the timer
 * CloseTimeLimit()
 */
const closeTimeLimitCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.closeTimeLimit();
  return true;
};

/**
 * HideTimerWnd - Hide the timer window (timer keeps running)
 * HideTimerWnd()
 */
const hideTimerWndCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.hideTimerWnd();
  return true;
};

/**
 * SetTimeScript - Set a script to run when timer reaches a certain time
 * SetTimeScript(int triggerSeconds, string scriptFileName)
 */
const setTimeScriptCommand: CommandHandler = (params, _result, helpers) => {
  const triggerSeconds = helpers.resolveNumber(params[0] || "0");
  const scriptFileName = helpers.resolveString(params[1] || "");
  helpers.context.setTimeScript(triggerSeconds, scriptFileName);
  return true;
};

// ============= Goods Extended Commands =============

/**
 * BuyGoods - Open buy goods interface
 * BuyGoods(buyFile, canSellSelfGoods)
 */
const buyGoodsCommand: CommandHandler = async (params, _result, helpers) => {
  const buyFile = helpers.resolveString(params[0] || "");
  const canSellSelfGoods = params.length >= 2 && helpers.resolveNumber(params[1]) !== 0;
  await helpers.context.buyGoods(buyFile, canSellSelfGoods);
  return true;
};

/**
 * SellGoods - Open sell goods interface (same as BuyGoods with canSellSelfGoods=true)
 * SellGoods(buyFile) -> BuyGoods(buyFile, true)
 */
const sellGoodsCommand: CommandHandler = async (params, _result, helpers) => {
  const buyFile = helpers.resolveString(params[0] || "");
  await helpers.context.buyGoods(buyFile, true);
  return true;
};

/**
 * BuyGoodsOnly - Open buy goods interface without selling (canSellSelfGoods=false)
 * BuyGoodsOnly(buyFile) -> BuyGoods(buyFile, false)
 */
const buyGoodsOnlyCommand: CommandHandler = async (params, _result, helpers) => {
  const buyFile = helpers.resolveString(params[0] || "");
  await helpers.context.buyGoods(buyFile, false);
  return true;
};

/**
 * GetGoodsNum - Get goods count by file name
 *
 */
const getGoodsNumCommand: CommandHandler = (params, _result, helpers) => {
  const goodsFile = helpers.resolveString(params[0] || "");
  const count = helpers.context.getGoodsNum(goodsFile);
  helpers.context.setVariable("GoodsNum", count);
  return true;
};

/**
 * GetGoodsNumByName - Get goods count by display name
 *
 */
const getGoodsNumByNameCommand: CommandHandler = (params, _result, helpers) => {
  const goodsName = helpers.resolveString(params[0] || "");
  const count = helpers.context.getGoodsNumByName(goodsName);
  helpers.context.setVariable("GoodsNum", count);
  return true;
};

/**
 * ClearGoods - Clear all goods from inventory
 *
 */
const clearGoodsCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.clearGoods();
  return true;
};

/**
 * ClearMagic - Clear all magic from player
 *
 */
const clearMagicCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.clearMagic();
  return true;
};

/**
 * DelGoodByName - Delete goods by display name
 * DelGoodByName(name, count?)
 */
const delGoodByNameCommand: CommandHandler = (params, _result, helpers) => {
  const name = helpers.resolveString(params[0] || "");
  const count = params.length >= 2 ? helpers.resolveNumber(params[1]) : undefined;
  helpers.context.delGoodByName(name, count);
  return true;
};

/**
 * CheckFreeGoodsSpace - Check if there's free goods space
 *
 */
const checkFreeGoodsSpaceCommand: CommandHandler = (params, _result, helpers) => {
  const varName = (params[0] || "$FreeSpace").replace("$", "");
  const hasFreeSpace = helpers.context.checkFreeGoodsSpace() ? 1 : 0;
  helpers.context.setVariable(varName, hasFreeSpace);
  return true;
};

/**
 * CheckFreeMagicSpace - Check if there's free magic space
 *
 */
const checkFreeMagicSpaceCommand: CommandHandler = (params, _result, helpers) => {
  const varName = (params[0] || "$FreeSpace").replace("$", "");
  const hasFreeSpace = helpers.context.checkFreeMagicSpace() ? 1 : 0;
  helpers.context.setVariable(varName, hasFreeSpace);
  return true;
};

/**
 * SetDropIni - Set drop file for character
 * SetDropIni(name, dropFile)
 */
const setDropIniCommand: CommandHandler = (params, _result, helpers) => {
  const name = helpers.resolveString(params[0] || "");
  const dropFile = helpers.resolveString(params[1] || "");
  helpers.context.setDropIni(name, dropFile);
  return true;
};

/**
 * EnableDrop - Enable item drop on defeat
 *
 */
const enableDropCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.enableDrop();
  return true;
};

/**
 * DisableDrop - Disable item drop on defeat
 *
 */
const disableDropCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.disableDrop();
  return true;
};

// ============= Camera Extended Commands =============

/**
 * MoveScreenEx - Move screen to position (BLOCKING)
 * MoveScreenEx(x, y, speed)
 */
const moveScreenExCommand: CommandHandler = async (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  const speed = helpers.resolveNumber(params[2] || "1");
  await helpers.context.moveScreenEx(x, y, speed);
  return true;
};

/**
 * SetMapPos - Set camera/map position
 * SetMapPos(x, y)
 */
const setMapPosCommand: CommandHandler = (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  helpers.context.setMapPos(x, y);
  return true;
};

/**
 * OpenWaterEffect - Enable water ripple effect
 *
 */
const openWaterEffectCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.openWaterEffect();
  return true;
};

/**
 * CloseWaterEffect - Disable water ripple effect
 *
 */
const closeWaterEffectCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.closeWaterEffect();
  return true;
};

// ============= Save Commands =============

/**
 * SaveMapTrap - Save map trap state
 *
 */
const saveMapTrapCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.saveMapTrap();
  return true;
};

/**
 * ClearAllSave - Delete all save files
 *
 */
const clearAllSaveCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.clearAllSave();
  return true;
};

/**
 * EnableSave - Enable saving
 *
 */
const enableSaveCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.enableSave();
  return true;
};

/**
 * DisableSave - Disable saving
 *
 */
const disableSaveCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.disableSave();
  return true;
};

// ============= Variable Commands =============

/**
 * ClearAllVar - Clear all variables except specified ones
 * ClearAllVar(keep1, keep2, ...)
 */
const clearAllVarCommand: CommandHandler = (params, _result, helpers) => {
  const keepsVars = params.map((p) => helpers.resolveString(p));
  helpers.context.clearAllVar(keepsVars);
  return true;
};

/**
 * GetPartnerIdx - Get partner index
 *
 */
const getPartnerIdxCommand: CommandHandler = (params, _result, helpers) => {
  const varName = (params[0] || "$PartnerIdx").replace("$", "");
  const idx = helpers.context.getPartnerIdx();
  helpers.context.setVariable(varName, idx);
  return true;
};

// ============= Effect Commands =============

/**
 * PetrifyMillisecond - Apply petrify effect
 *
 */
const petrifyMillisecondCommand: CommandHandler = (params, _result, helpers) => {
  const ms = helpers.resolveNumber(params[0] || "0");
  helpers.context.petrifyMillisecond(ms);
  return true;
};

/**
 * PoisonMillisecond - Apply poison effect
 *
 */
const poisonMillisecondCommand: CommandHandler = (params, _result, helpers) => {
  const ms = helpers.resolveNumber(params[0] || "0");
  helpers.context.poisonMillisecond(ms);
  return true;
};

/**
 * FrozenMillisecond - Apply frozen effect
 *
 */
const frozenMillisecondCommand: CommandHandler = (params, _result, helpers) => {
  const ms = helpers.resolveNumber(params[0] || "0");
  helpers.context.frozenMillisecond(ms);
  return true;
};

// ============= Misc Extended Commands =============

/**
 * SetObjOfs - Set object offset
 * SetObjOfs(name, x, y)
 */
const setObjOfsCommand: CommandHandler = (params, _result, helpers) => {
  const objName = helpers.resolveString(params[0] || "");
  const x = helpers.resolveNumber(params[1] || "0");
  const y = helpers.resolveNumber(params[2] || "0");
  helpers.context.setObjOfs(objName, x, y);
  return true;
};

/**
 * SetShowMapPos - Set whether to show map position
 *
 */
const setShowMapPosCommand: CommandHandler = (params, _result, helpers) => {
  const show = helpers.resolveNumber(params[0] || "0") > 0;
  helpers.context.setShowMapPos(show);
  return true;
};

/**
 * ShowSystemMsg - Show system message
 * ShowSystemMsg(msg, stayTime?)
 */
const showSystemMsgCommand: CommandHandler = (params, _result, helpers) => {
  const msg = helpers.resolveString(params[0] || "");
  const stayTime = params.length >= 2 ? helpers.resolveNumber(params[1]) : undefined;
  helpers.context.showSystemMsg(msg, stayTime);
  return true;
};

/**
 * RandRun - Randomly run one of two scripts
 * RandRun(probability, script1, script2)
 */
const randRunCommand: CommandHandler = async (params, _result, helpers) => {
  const probability = helpers.context.getVariable((params[0] || "").replace("$", ""));
  const script1 = helpers.resolveString(params[1] || "");
  const script2 = helpers.resolveString(params[2] || "");

  const rand = Math.floor(Math.random() * 100);
  const scriptToRun = rand <= probability ? script1 : script2;
  await helpers.context.runScript(scriptToRun);
  return false; // Script will continue from runScript
};

/**
 * StopSound - Stop all sounds
 *
 */
const stopSoundCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.stopSound();
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
  registry.set("openobj", openBoxCommand); // alias: OpenObj calls OpenBox
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

  // Timer
  registry.set("opentimelimit", openTimeLimitCommand);
  registry.set("closetimelimit", closeTimeLimitCommand);
  registry.set("hidetimerwnd", hideTimerWndCommand);
  registry.set("settimescript", setTimeScriptCommand);

  // Goods extended
  registry.set("buygoods", buyGoodsCommand);
  registry.set("sellgoods", sellGoodsCommand);
  registry.set("buygoodsonly", buyGoodsOnlyCommand);
  registry.set("getgoodsnum", getGoodsNumCommand);
  registry.set("getgoodsnumbyname", getGoodsNumByNameCommand);
  registry.set("cleargoods", clearGoodsCommand);
  registry.set("clearmagic", clearMagicCommand);
  registry.set("delgoodbyname", delGoodByNameCommand);
  registry.set("checkfreegoodsspace", checkFreeGoodsSpaceCommand);
  registry.set("checkfreemagicspace", checkFreeMagicSpaceCommand);
  registry.set("setdropini", setDropIniCommand);
  registry.set("enabledrop", enableDropCommand);
  registry.set("enabeldrop", enableDropCommand); // alias (typo in original)
  registry.set("disabledrop", disableDropCommand);

  // Camera extended
  registry.set("movescreenex", moveScreenExCommand);
  registry.set("setmappos", setMapPosCommand);
  registry.set("openwatereffect", openWaterEffectCommand);
  registry.set("closewatereffect", closeWaterEffectCommand);

  // Save commands
  registry.set("savemaptrap", saveMapTrapCommand);
  registry.set("clearallsave", clearAllSaveCommand);
  registry.set("enablesave", enableSaveCommand);
  registry.set("disablesave", disableSaveCommand);

  // Variable commands
  registry.set("clearallvar", clearAllVarCommand);
  registry.set("getpartneridx", getPartnerIdxCommand);

  // Effect commands
  registry.set("petrifymillisecond", petrifyMillisecondCommand);
  registry.set("poisonmillisecond", poisonMillisecondCommand);
  registry.set("frozenmillisecond", frozenMillisecondCommand);

  // Misc extended
  registry.set("setobjofs", setObjOfsCommand);
  registry.set("setshowmappos", setShowMapPosCommand);
  registry.set("showsystemmsg", showSystemMsgCommand);
  registry.set("randrun", randRunCommand);
  registry.set("stopsound", stopSoundCommand);
}
