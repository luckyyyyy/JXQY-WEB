/**
 * Game State Commands - Map loading, variables, flow control
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
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
  console.log("LoadGame:", index);
  await helpers.context.loadGame(index);
  return true;
};

/**
 * FreeMap - Free map resources
 */
const freeMapCommand: CommandHandler = () => {
  console.log("FreeMap");
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
    console.log(`[ScriptExecutor] Return: restoring ${caller.script.fileName} at line ${caller.line}`);
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
 */
const getRandNumCommand: CommandHandler = (params, _result, helpers) => {
  const varName = params[0]?.replace("$", "") || "";
  const max = helpers.resolveNumber(params[1] || "100");
  const randValue = Math.floor(Math.random() * max);
  helpers.context.setVariable(varName, randValue);
  return true;
};

/**
 * Sleep - Pause execution
 */
const sleepCommand: CommandHandler = (params, _result, helpers) => {
  const ms = helpers.resolveNumber(params[0] || "0");
  helpers.state.waitTime = ms;
  helpers.context.sleep(ms);
  helpers.state.currentLine++;
  return false;
};

/**
 * RunScript - Run another script
 */
const runScriptCommand: CommandHandler = async (params, _result, helpers) => {
  const scriptFile = helpers.resolveString(params[0] || "");
  console.log(`[ScriptExecutor] RunScript: ${scriptFile}`);
  await helpers.context.runScript(scriptFile);
  return false;
};

/**
 * DisableInput - Disable player input
 */
const disableInputCommand: CommandHandler = () => {
  console.log("DisableInput");
  return true;
};

/**
 * EnableInput - Enable player input
 */
const enableInputCommand: CommandHandler = () => {
  console.log("EnableInput");
  return true;
};

/**
 * DisableFight - Disable combat
 */
const disableFightCommand: CommandHandler = () => {
  console.log("DisableFight");
  return true;
};

/**
 * EnableFight - Enable combat
 */
const enableFightCommand: CommandHandler = () => {
  console.log("EnableFight");
  return true;
};

/**
 * DisableJump - Disable jumping
 */
const disableJumpCommand: CommandHandler = () => {
  console.log("DisableJump");
  return true;
};

/**
 * EnableJump - Enable jumping
 */
const enableJumpCommand: CommandHandler = () => {
  console.log("EnableJump");
  return true;
};

/**
 * DisableRun - Disable running
 */
const disableRunCommand: CommandHandler = () => {
  console.log("DisableRun");
  return true;
};

/**
 * EnableRun - Enable running
 */
const enableRunCommand: CommandHandler = () => {
  console.log("EnableRun");
  return true;
};

/**
 * SetLevelFile - Set level file
 */
const setLevelFileCommand: CommandHandler = async (params, _result, helpers) => {
  const file = helpers.resolveString(params[0] || "");
  await helpers.context.setLevelFile(file);
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
}
