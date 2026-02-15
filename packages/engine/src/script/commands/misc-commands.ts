/**
 * Misc Commands - Memo, Timer, Save, Variables, SystemMsg, RandRun
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 *
 * Audio commands → audio-commands.ts
 * Effect/weather/camera commands → effect-commands.ts
 * Object/trap commands → obj-commands.ts
 * Goods/magic commerce commands → goods-commands.ts
 */
import { logger } from "../../core/logger";
import type { CommandHandler, CommandRegistry } from "./types";

// ============= Memo Commands =============

/**
 * Memo - Add memo text directly
 */
const memoCommand: CommandHandler = (params, _result, helpers) => {
  const memoText = helpers.resolveString(params[0] || "");
  logger.log(`[ScriptExecutor] Memo: "${memoText}"`);
  helpers.api.memo.add(memoText);
  return true;
};

/**
 * AddToMemo - Add memo from TalkTextList by ID
 */
const addToMemoCommand: CommandHandler = async (params, _result, helpers) => {
  const memoId = helpers.resolveNumber(params[0] || "0");
  const talkTextList = helpers.api.dialog.talkTextList;
  const detail = talkTextList.getTextDetail(memoId);
  if (detail) {
    logger.log(`[ScriptExecutor] AddToMemo ${memoId}: ${detail.text}`);
  }
  await helpers.api.memo.addById(memoId);
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
    await helpers.api.memo.deleteById(textId);
  } else {
    const memoText = helpers.resolveString(param);
    logger.log(`[ScriptExecutor] DelMemo: "${memoText}"`);
    helpers.api.memo.delete(memoText);
  }
  return true;
};

// ============= Timer Commands =============

/**
 * OpenTimeLimit - Start a countdown timer
 * OpenTimeLimit(int seconds)
 */
const openTimeLimitCommand: CommandHandler = (params, _result, helpers) => {
  const seconds = helpers.resolveNumber(params[0] || "0");
  helpers.api.timer.open(seconds);
  return true;
};

/**
 * CloseTimeLimit - Stop and hide the timer
 */
const closeTimeLimitCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.timer.close();
  return true;
};

/**
 * HideTimerWnd - Hide the timer window (timer keeps running)
 */
const hideTimerWndCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.timer.hide();
  return true;
};

/**
 * SetTimeScript - Set a script to run when timer reaches a certain time
 * SetTimeScript(int triggerSeconds, string scriptFileName)
 */
const setTimeScriptCommand: CommandHandler = (params, _result, helpers) => {
  const triggerSeconds = helpers.resolveNumber(params[0] || "0");
  const scriptFileName = helpers.resolveString(params[1] || "");
  helpers.api.timer.setScript(triggerSeconds, scriptFileName);
  return true;
};

// ============= Save Commands =============

/**
 * ClearAllSave - Delete all save files
 */
const clearAllSaveCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.save.clearAll();
  return true;
};

/**
 * EnableSave - Enable saving
 */
const enableSaveCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.save.setEnabled(true);
  return true;
};

/**
 * DisableSave - Disable saving
 */
const disableSaveCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.save.setEnabled(false);
  return true;
};

// ============= Variable Commands =============

/**
 * ClearAllVar - Clear all variables except specified ones
 * ClearAllVar(keep1, keep2, ...)
 */
const clearAllVarCommand: CommandHandler = (params, _result, helpers) => {
  const keepsVars = params.map((p) => helpers.resolveString(p));
  helpers.api.variables.clearAll(keepsVars);
  return true;
};

/**
 * GetPartnerIdx - Get partner index
 */
const getPartnerIdxCommand: CommandHandler = (params, _result, helpers) => {
  const varName = (params[0] || "$PartnerIdx").replace("$", "");
  const idx = helpers.api.variables.getPartnerIndex();
  helpers.api.variables.set(varName, idx);
  return true;
};

// ============= Misc Extended =============

/**
 * ShowSystemMsg - Show system message
 * ShowSystemMsg(msg, stayTime?)
 */
const showSystemMsgCommand: CommandHandler = (params, _result, helpers) => {
  const msg = helpers.resolveString(params[0] || "");
  const stayTime = params.length >= 2 ? helpers.resolveNumber(params[1]) : undefined;
  helpers.api.dialog.showSystemMessage(msg, stayTime);
  return true;
};

/**
 * RandRun - Randomly run one of two scripts
 * RandRun(probability, script1, script2)
 */
const randRunCommand: CommandHandler = async (params, _result, helpers) => {
  const probability = helpers.api.variables.get((params[0] || "").replace("$", ""));
  const script1 = helpers.resolveString(params[1] || "");
  const script2 = helpers.resolveString(params[2] || "");

  const rand = Math.floor(Math.random() * 100);
  const scriptToRun = rand <= probability ? script1 : script2;
  await helpers.api.script.run(scriptToRun);
  return false; // Script will continue from runScript
};

export function registerMiscCommands(registry: CommandRegistry): void {
  // Memo
  registry.set("memo", memoCommand);
  registry.set("addtomemo", addToMemoCommand);
  registry.set("delmemo", delMemoCommand);

  // Timer
  registry.set("opentimelimit", openTimeLimitCommand);
  registry.set("closetimelimit", closeTimeLimitCommand);
  registry.set("hidetimerwnd", hideTimerWndCommand);
  registry.set("settimescript", setTimeScriptCommand);

  // Save
  registry.set("clearallsave", clearAllSaveCommand);
  registry.set("enablesave", enableSaveCommand);
  registry.set("disablesave", disableSaveCommand);

  // Variables
  registry.set("clearallvar", clearAllVarCommand);
  registry.set("getpartneridx", getPartnerIdxCommand);

  // Misc
  registry.set("showsystemmsg", showSystemMsgCommand);
  registry.set("randrun", randRunCommand);
}
