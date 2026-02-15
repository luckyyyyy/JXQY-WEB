/**
 * Player Commands - Movement, Stats, Combat
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
import type { CommandHandler, CommandRegistry } from "./types";

/**
 * SetPlayerPos - Set player tile position
 * 2 params (x, y) for player, 3 params (name, x, y) for any character
 */
const setPlayerPosCommand: CommandHandler = (params, _result, helpers) => {
  if (params.length >= 3) {
    // 3-param version: SetPlayerPos(name, x, y)
    const name = helpers.resolveString(params[0] || "");
    const x = helpers.resolveNumber(params[1] || "0");
    const y = helpers.resolveNumber(params[2] || "0");
    helpers.api.player.setPosition(x, y, name);
  } else {
    // 2-param version: SetPlayerPos(x, y)
    const x = helpers.resolveNumber(params[0] || "0");
    const y = helpers.resolveNumber(params[1] || "0");
    helpers.api.player.setPosition(x, y);
  }
  return true;
};

/**
 * SetPlayerDir - Set player facing direction
 */
const setPlayerDirCommand: CommandHandler = (params, _result, helpers) => {
  const direction = helpers.resolveNumber(params[0] || "0");
  helpers.api.player.setDirection(direction);
  return true;
};

/**
 * SetPlayerState - Set player state
 */
const setPlayerStateCommand: CommandHandler = (params, _result, helpers) => {
  const state = helpers.resolveNumber(params[0] || "0");
  helpers.api.player.setState(state);
  return true;
};

/**
 * PlayerGoto - Walk player to position (BLOCKING)
 */
const playerGotoCommand: CommandHandler = async (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  await helpers.api.player.walkTo(x, y);
  return true;
};

/**
 * PlayerRunTo - Run player to position (BLOCKING)
 */
const playerRunToCommand: CommandHandler = async (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  await helpers.api.player.runTo(x, y);
  return true;
};

/**
 * PlayerGotoDir - Walk player in direction (BLOCKING)
 */
const playerGotoDirCommand: CommandHandler = async (params, _result, helpers) => {
  const direction = helpers.resolveNumber(params[0] || "0");
  const steps = helpers.resolveNumber(params[1] || "1");
  await helpers.api.player.walkToDir(direction, steps);
  return true;
};

/**
 * AddMoney - Add money to player
 */
const addMoneyCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  helpers.api.player.addMoney(amount);
  return true;
};

/**
 * AddRandMoney - Add random amount of money
 */
const addRandMoneyCommand: CommandHandler = (params, _result, helpers) => {
  const min = helpers.resolveNumber(params[0] || "0");
  const max = helpers.resolveNumber(params[1] || "100");
  const amount = min + Math.floor(Math.random() * (max - min + 1));
  helpers.api.player.addMoney(amount);
  return true;
};

/**
 * AddExp - Add experience to player
 */
const addExpCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  helpers.api.player.addExp(amount);
  return true;
};

/**
 * FullLife - Fully restore player health
 * Globals.ThePlayer.FullLife()
 */
const fullLifeCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.player.fullLife();
  return true;
};

/**
 * FullMana - Fully restore player mana
 * Globals.ThePlayer.FullMana()
 */
const fullManaCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.player.fullMana();
  return true;
};

/**
 * FullThew - Fully restore player stamina
 * Globals.ThePlayer.FullThew()
 */
const fullThewCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.player.fullThew();
  return true;
};

/**
 * AddLife - Add health to player
 * Globals.ThePlayer.AddLife(value)
 */
const addLifeCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  helpers.api.player.addLife(amount);
  return true;
};

/**
 * AddMana - Add mana to player
 * Globals.ThePlayer.AddMana(value)
 */
const addManaCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  helpers.api.player.addMana(amount);
  return true;
};

/**
 * AddThew - Add stamina to player
 * Globals.ThePlayer.AddThew(value)
 */
const addThewCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  helpers.api.player.addThew(amount);
  return true;
};

// ============= Extended Player Commands =============

/**
 * PlayerGotoEx - Walk player to position (NON-BLOCKING)
 * just calls WalkTo() without waiting
 */
const playerGotoExCommand: CommandHandler = (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  helpers.api.player.walkToNonBlocking(x, y);
  return true;
};

/**
 * PlayerJumpTo - Jump player to position (BLOCKING)
 *
 */
const playerJumpToCommand: CommandHandler = async (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  await helpers.api.player.jumpTo(x, y);
  return true;
};

/**
 * PlayerRunToEx - Run player to position (NON-BLOCKING)
 * just calls RunTo() without waiting
 */
const playerRunToExCommand: CommandHandler = (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  helpers.api.player.runToNonBlocking(x, y);
  return true;
};

/**
 * SetPlayerScn - Center camera on player
 *
 */
const setPlayerScnCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.player.centerCamera();
  return true;
};

/**
 * GetMoneyNum - Get money amount into variable
 *
 */
const getMoneyNumCommand: CommandHandler = (params, result, helpers) => {
  const varName = (params[0] || result || "$MoneyNum").replace("$", "");
  const money = helpers.api.player.getMoney();
  helpers.api.variables.set(varName, money);
  return true;
};

/**
 * SetMoneyNum - Set money amount
 *
 */
const setMoneyNumCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  helpers.api.player.setMoney(amount);
  return true;
};

/**
 * GetPlayerExp - Get player exp into variable
 *
 */
const getPlayerExpCommand: CommandHandler = (params, _result, helpers) => {
  const varName = (params[0] || "$PlayerExp").replace("$", "");
  const exp = helpers.api.player.getExp();
  helpers.api.variables.set(varName, exp);
  return true;
};

/**
 * GetPlayerState - Get player state (Level/Attack/Defend/etc) into variable
 *
 */
const getPlayerStateCommand: CommandHandler = (params, _result, helpers) => {
  const stateName = helpers.resolveString(params[0] || "");
  const varName = (params[1] || "$PlayerState").replace("$", "");
  const value = helpers.api.player.getStat(stateName);
  helpers.api.variables.set(varName, value);
  return true;
};

/**
 * GetPlayerMagicLevel - Get player magic level into variable
 *
 */
const getPlayerMagicLevelCommand: CommandHandler = (params, _result, helpers) => {
  const magicFile = helpers.resolveString(params[0] || "");
  const varName = (params[1] || "$MagicLevel").replace("$", "");
  const level = helpers.api.magic.getLevel(magicFile);
  helpers.api.variables.set(varName, level);
  return true;
};

/**
 * LimitMana - Limit mana usage
 *
 */
const limitManaCommand: CommandHandler = (params, _result, helpers) => {
  const limit = helpers.resolveNumber(params[0] || "0") !== 0;
  helpers.api.player.limitMana(limit);
  return true;
};

/**
 * AddMoveSpeedPercent - Add move speed percentage
 *
 */
const addMoveSpeedPercentCommand: CommandHandler = (params, _result, helpers) => {
  const percent = helpers.resolveNumber(params[0] || "0");
  helpers.api.player.addMoveSpeedPercent(percent);
  return true;
};

/**
 * UseMagic - Use a magic skill
 *
 */
const useMagicCommand: CommandHandler = (params, _result, helpers) => {
  const magicFile = helpers.resolveString(params[0] || "");
  const x = params.length >= 2 ? helpers.resolveNumber(params[1]) : undefined;
  const y = params.length >= 3 ? helpers.resolveNumber(params[2]) : undefined;
  helpers.api.magic.use(magicFile, x, y);
  return true;
};

/**
 * IsEquipWeapon - Check if weapon is equipped, store result in variable
 *
 */
const isEquipWeaponCommand: CommandHandler = (params, _result, helpers) => {
  const varName = (params[0] || "$IsEquipWeapon").replace("$", "");
  const equipped = helpers.api.player.isEquipWeapon() ? 1 : 0;
  helpers.api.variables.set(varName, equipped);
  return true;
};

/**
 * AddAttack - Add attack power
 * AddAttack(value, type)
 */
const addAttackCommand: CommandHandler = (params, _result, helpers) => {
  const value = helpers.resolveNumber(params[0] || "0");
  const type = params.length >= 2 ? helpers.resolveNumber(params[1]) : 1;
  helpers.api.player.addAttack(value, type);
  return true;
};

/**
 * AddDefend - Add defense power
 * AddDefend(value, type)
 */
const addDefendCommand: CommandHandler = (params, _result, helpers) => {
  const value = helpers.resolveNumber(params[0] || "0");
  const type = params.length >= 2 ? helpers.resolveNumber(params[1]) : 1;
  helpers.api.player.addDefend(value, type);
  return true;
};

/**
 * AddEvade - Add evade
 *
 */
const addEvadeCommand: CommandHandler = (params, _result, helpers) => {
  const value = helpers.resolveNumber(params[0] || "0");
  helpers.api.player.addEvade(value);
  return true;
};

/**
 * AddLifeMax - Add max life
 *
 */
const addLifeMaxCommand: CommandHandler = (params, _result, helpers) => {
  const value = helpers.resolveNumber(params[0] || "0");
  helpers.api.player.addLifeMax(value);
  return true;
};

/**
 * AddManaMax - Add max mana
 *
 */
const addManaMaxCommand: CommandHandler = (params, _result, helpers) => {
  const value = helpers.resolveNumber(params[0] || "0");
  helpers.api.player.addManaMax(value);
  return true;
};

/**
 * AddThewMax - Add max stamina
 *
 */
const addThewMaxCommand: CommandHandler = (params, _result, helpers) => {
  const value = helpers.resolveNumber(params[0] || "0");
  helpers.api.player.addThewMax(value);
  return true;
};

/**
 * SetPlayerMagicToUseWhenBeAttacked - Set counter-attack magic
 *
 */
const setPlayerMagicToUseWhenBeAttackedCommand: CommandHandler = (params, _result, helpers) => {
  const magicFile = helpers.resolveString(params[0] || "");
  const direction = helpers.resolveNumber(params[1] || "0");
  helpers.api.player.setMagicWhenAttacked(magicFile, direction);
  return true;
};

/**
 * SetWalkIsRun - Set walk as run mode
 *
 */
const setWalkIsRunCommand: CommandHandler = (params, _result, helpers) => {
  const value = helpers.resolveNumber(params[0] || "0");
  helpers.api.player.setWalkIsRun(value);
  return true;
};

/**
 * PlayerChange - Change player character
 * Loader.ChangePlayer(int.Parse(parameters[0]))
 */
const playerChangeCommand: CommandHandler = async (params, _result, helpers) => {
  const index = helpers.resolveNumber(params[0] || "0");
  await helpers.api.player.change(index);
  return true;
};

/**
 * Register all player commands
 */
export function registerPlayerCommands(registry: CommandRegistry): void {
  // Position and movement
  registry.set("setplayerpos", setPlayerPosCommand);
  registry.set("setplayerdir", setPlayerDirCommand);
  registry.set("setplayerstate", setPlayerStateCommand);
  registry.set("playergoto", playerGotoCommand);
  registry.set("playerrunto", playerRunToCommand);
  registry.set("playergotodir", playerGotoDirCommand);

  // Stats
  registry.set("addmoney", addMoneyCommand);
  registry.set("addrandmoney", addRandMoneyCommand);
  registry.set("addexp", addExpCommand);
  registry.set("fulllife", fullLifeCommand);
  registry.set("fullmana", fullManaCommand);
  registry.set("fullthew", fullThewCommand);
  registry.set("addlife", addLifeCommand);
  registry.set("addmana", addManaCommand);
  registry.set("addthew", addThewCommand);

  // Extended movement
  registry.set("playergotoex", playerGotoExCommand);
  registry.set("playerjumpto", playerJumpToCommand);
  registry.set("playerruntoex", playerRunToExCommand);
  registry.set("setplayerscn", setPlayerScnCommand);

  // Money/Exp
  registry.set("getmoneynum", getMoneyNumCommand);
  registry.set("setmoneynum", setMoneyNumCommand);
  registry.set("getplayerexp", getPlayerExpCommand);
  registry.set("getexp", getPlayerExpCommand); // alias:
  registry.set("getplayerstate", getPlayerStateCommand);
  registry.set("getplayermagiclevel", getPlayerMagicLevelCommand);

  // Stats modifiers
  registry.set("limitmana", limitManaCommand);
  registry.set("addmovespeedpercent", addMoveSpeedPercentCommand);
  registry.set("addattack", addAttackCommand);
  registry.set("adddefend", addDefendCommand);
  registry.set("addevade", addEvadeCommand);
  registry.set("addlifemax", addLifeMaxCommand);
  registry.set("addmanamax", addManaMaxCommand);
  registry.set("addthewmax", addThewMaxCommand);

  // Magic usage
  registry.set("usemagic", useMagicCommand);
  registry.set("isequipweapon", isEquipWeaponCommand);
  registry.set("setplayermagictousewhenbeatacked", setPlayerMagicToUseWhenBeAttackedCommand);
  registry.set("setwalkisrun", setWalkIsRunCommand);

  // Player change
  registry.set("playerchange", playerChangeCommand);
}
