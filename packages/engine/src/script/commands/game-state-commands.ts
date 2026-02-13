/**
 * Game State Commands - Map loading, variables, flow control
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
import { logger } from "../../core/logger";
import type { CommandHandler, CommandRegistry } from "./types";

/**
 * LoadMap - Load a new map
 */
const loadMapCommand: CommandHandler = async (params, _result, helpers) => {
  const mapName = helpers.resolveString(params[0] || "");
  await helpers.context.loadMap(mapName);
  return true;
};

/**
 * LoadGame - Load game from save slot
 */
const loadGameCommand: CommandHandler = async (params, _result, helpers) => {
  const index = helpers.resolveNumber(params[0] || "0");
  await helpers.context.loadGame(index);
  return true;
};

/**
 * FreeMap - Free map resources
 * release map resources
 */
const freeMapCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.freeMap();
  return true;
};

/**
 * If - Conditional jump
 */
const ifCommand: CommandHandler = (params, result, helpers) => {
  const condition = params[0] || "";
  if (evaluateCondition(condition, helpers.context.getVariable)) {
    helpers.gotoLabel(result);
  }
  return true;
};

/**
 * Goto - Unconditional jump
 */
const gotoCommand: CommandHandler = (params, _result, helpers) => {
  helpers.gotoLabel(params[0]);
  return true;
};

/**
 * Return - Return from script
 * When there's a parent script in callStack, restore it and continue execution
 * When there's no parent, end the script completely
 */
const returnCommand: CommandHandler = (_params, _result, helpers) => {
  if (helpers.state.callStack.length > 0) {
    const caller = helpers.state.callStack.pop()!;
    logger.log(
      `[ScriptExecutor] Return: restoring ${caller.script.fileName} at line ${caller.line}`
    );
    helpers.state.currentScript = caller.script;
    helpers.state.currentLine = caller.line;
    // Return true to continue execution with parent script
    return true;
  } else {
    helpers.endScript();
    return false;
  }
};

/**
 * Assign - Set variable value
 */
const assignCommand: CommandHandler = (params, _result, helpers) => {
  const varName = params[0]?.replace("$", "") || "";
  const value = helpers.resolveNumber(params[1] || "0");
  helpers.context.setVariable(varName, value);
  return true;
};

/**
 * Add - Add to variable
 */
const addCommand: CommandHandler = (params, _result, helpers) => {
  const varName = params[0]?.replace("$", "") || "";
  const value = helpers.resolveNumber(params[1] || "0");
  const current = helpers.context.getVariable(varName);
  helpers.context.setVariable(varName, current + value);
  return true;
};

/**
 * Sub - Subtract from variable
 */
const subCommand: CommandHandler = (params, _result, helpers) => {
  const varName = params[0]?.replace("$", "") || "";
  const value = helpers.resolveNumber(params[1] || "0");
  const current = helpers.context.getVariable(varName);
  helpers.context.setVariable(varName, current - value);
  return true;
};

/**
 * GetRandNum - Generate random number
 * generates random in range [min, max]
 */
const getRandNumCommand: CommandHandler = (params, _result, helpers) => {
  const varName = params[0]?.replace("$", "") || "";
  const min = helpers.resolveNumber(params[1] || "0");
  const max = helpers.resolveNumber(params[2] || "100");
  // inclusive of both min and max
  const randValue = min + Math.floor(Math.random() * (max - min + 1));
  helpers.context.setVariable(varName, randValue);
  return true;
};

/**
 * Sleep - Pause execution
 */
const sleepCommand: CommandHandler = async (params, _result, helpers) => {
  const ms = helpers.resolveNumber(params[0] || "0");
  await helpers.context.sleep(ms);
  return true;
};

/**
 * RunScript - Run another script
 */
const runScriptCommand: CommandHandler = async (params, _result, helpers) => {
  const scriptFile = helpers.resolveString(params[0] || "");
  logger.log(`[ScriptExecutor] RunScript: ${scriptFile}`);
  await helpers.context.runScript(scriptFile);
  return false;
};

/**
 * DisableInput - Disable player input
 * Globals.IsInputDisabled = true
 */
const disableInputCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.disableInput();
  return true;
};

/**
 * EnableInput - Enable player input
 * Globals.IsInputDisabled = false
 */
const enableInputCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.enableInput();
  return true;
};

/**
 * DisableFight - Disable combat
 * Globals.ThePlayer.DisableFight()
 */
const disableFightCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.disableFight();
  return true;
};

/**
 * EnableFight - Enable combat
 * Globals.ThePlayer.EnableFight()
 */
const enableFightCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.enableFight();
  return true;
};

/**
 * DisableJump - Disable jumping
 * Globals.ThePlayer.DisableJump()
 */
const disableJumpCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.disableJump();
  return true;
};

/**
 * EnableJump - Enable jumping
 * Globals.ThePlayer.EnableJump()
 */
const enableJumpCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.enableJump();
  return true;
};

/**
 * DisableRun - Disable running
 * Globals.ThePlayer.DisableRun()
 */
const disableRunCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.disableRun();
  return true;
};

/**
 * EnableRun - Enable running
 * Globals.ThePlayer.EnableRun()
 */
const enableRunCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.enableRun();
  return true;
};

/**
 * SetLevelFile - Set level file
 * 从 API 按需加载等级配置，自动转小写请求
 */
const setLevelFileCommand: CommandHandler = async (params, _result, helpers) => {
  const file = helpers.resolveString(params[0] || "");
  await helpers.context.setLevelFile(file);
  return true;
};

/**
 * ReturnToTitle - Return to title screen
 * 清除脚本，显示标题界面
 */
const returnToTitleCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.returnToTitle();
  return false; // 停止脚本执行
};

/**
 * SetMapTime - Set the map time
 * MapBase.MapTime = int.Parse(parameters[0])
 */
const setMapTimeCommand: CommandHandler = (params, _result, helpers) => {
  const time = helpers.resolveNumber(params[0] || "0");
  helpers.context.setMapTime(time);
  return true;
};

/**
 * RunParallelScript - Run a script in parallel
 * ScriptManager.RunParallelScript(path, delay)
 */
const runParallelScriptCommand: CommandHandler = (params, _result, helpers) => {
  const scriptFile = helpers.resolveString(params[0] || "");
  const delay = params.length >= 2 ? helpers.resolveNumber(params[1]) : 0;
  helpers.context.runParallelScript(scriptFile, delay);
  return true;
};

/**
 * Evaluate a condition expression
 * 使用 getVariable 函数获取变量，而不是直接访问对象
 */
function evaluateCondition(condition: string, getVariable: (name: string) => number): boolean {
  const match = condition.match(/\$([_a-zA-Z0-9]+)\s*([><=]+)\s*([-]?\d+|\$[_a-zA-Z0-9]+)/);
  if (!match) {
    if (condition.startsWith("$")) {
      const varName = condition.slice(1).trim();
      return getVariable(varName) !== 0;
    }
    return false;
  }

  const [, varName, operator, rightValue] = match;
  const leftVal = getVariable(varName);
  const rightVal = rightValue.startsWith("$")
    ? getVariable(rightValue.slice(1))
    : parseInt(rightValue, 10);

  switch (operator) {
    case "==":
      return leftVal === rightVal;
    case "!=":
    case "<>":
      return leftVal !== rightVal;
    case ">=":
      return leftVal >= rightVal;
    case "<=":
      return leftVal <= rightVal;
    case ">":
    case ">>":
      return leftVal > rightVal;
    case "<":
    case "<<":
      return leftVal < rightVal;
    default:
      return false;
  }
}

/**
 * Register all game state commands
 */
export function registerGameStateCommands(registry: CommandRegistry): void {
  // Map/Game loading
  registry.set("loadmap", loadMapCommand);
  registry.set("loadgame", loadGameCommand);
  registry.set("freemap", freeMapCommand);

  // Flow control
  registry.set("if", ifCommand);
  registry.set("goto", gotoCommand);
  registry.set("return", returnCommand);
  registry.set("sleep", sleepCommand);
  registry.set("runscript", runScriptCommand);

  // Variables
  registry.set("assign", assignCommand);
  registry.set("add", addCommand);
  registry.set("sub", subCommand);
  registry.set("getrandnum", getRandNumCommand);

  // Input control
  registry.set("disableinput", disableInputCommand);
  registry.set("enableinput", enableInputCommand);
  registry.set("disablefight", disableFightCommand);
  registry.set("enablefight", enableFightCommand);
  registry.set("disablejump", disableJumpCommand);
  registry.set("enablejump", enableJumpCommand);
  registry.set("disablerun", disableRunCommand);
  registry.set("enablerun", enableRunCommand);

  // Level
  registry.set("setlevelfile", setLevelFileCommand);

  // Return to title
  registry.set("returntotitle", returnToTitleCommand);

  // Map time
  registry.set("setmaptime", setMapTimeCommand);

  // Parallel script
  registry.set("runparallelscript", runParallelScriptCommand);
}
