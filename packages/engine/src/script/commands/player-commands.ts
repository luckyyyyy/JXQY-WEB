/**
 * Player Commands - Movement, Stats, Items
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
import { logger } from "../../core/logger";
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
    helpers.context.setPlayerPosition(x, y, name);
  } else {
    // 2-param version: SetPlayerPos(x, y)
    const x = helpers.resolveNumber(params[0] || "0");
    const y = helpers.resolveNumber(params[1] || "0");
    helpers.context.setPlayerPosition(x, y);
  }
  return true;
};

/**
 * SetPlayerDir - Set player facing direction
 */
const setPlayerDirCommand: CommandHandler = (params, _result, helpers) => {
  const direction = helpers.resolveNumber(params[0] || "0");
  helpers.context.setPlayerDirection(direction);
  return true;
};

/**
 * SetPlayerState - Set player state
 */
const setPlayerStateCommand: CommandHandler = (params, _result, helpers) => {
  const state = helpers.resolveNumber(params[0] || "0");
  helpers.context.setPlayerState(state);
  return true;
};

/**
 * PlayerGoto - Walk player to position (BLOCKING)
 */
const playerGotoCommand: CommandHandler = async (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  await helpers.context.playerGoto(x, y);
  return true;
};

/**
 * PlayerRunTo - Run player to position (BLOCKING)
 */
const playerRunToCommand: CommandHandler = async (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  await helpers.context.playerRunTo(x, y);
  return true;
};

/**
 * PlayerGotoDir - Walk player in direction (BLOCKING)
 */
const playerGotoDirCommand: CommandHandler = async (params, _result, helpers) => {
  const direction = helpers.resolveNumber(params[0] || "0");
  const steps = helpers.resolveNumber(params[1] || "1");
  await helpers.context.playerGotoDir(direction, steps);
  return true;
};

/**
 * AddGoods - Add items to inventory
 */
const addGoodsCommand: CommandHandler = (params, _result, helpers) => {
  const goodsName = helpers.resolveString(params[0] || "");
  const count = helpers.resolveNumber(params[1] || "1");
  helpers.context.addGoods(goodsName, count);
  return true;
};

/**
 * AddRandGoods - Add random item from buy file
 */
const addRandGoodsCommand: CommandHandler = async (params, _result, helpers) => {
  const buyFileName = helpers.resolveString(params[0] || "");
  logger.log(`[ScriptExecutor] AddRandGoods: ${buyFileName}`);
  await helpers.context.addRandGoods(buyFileName);
  return true;
};

/**
 * DelGoods - Remove items from inventory
 * If no parameters, removes the current item (from belongObject)
 */
const delGoodsCommand: CommandHandler = (params, _result, helpers) => {
  let goodsName: string;
  const count = helpers.resolveNumber(params[1] || "1");

  if (params.length === 0 || !params[0]) {
    // No parameter - use belongObject (current good being used)
    const belongObject = helpers.state.belongObject;
    if (belongObject && belongObject.type === "good") {
      goodsName = belongObject.id;
    } else {
      logger.warn("[DelGoods] No parameter and no current good");
      return true;
    }
  } else {
    goodsName = helpers.resolveString(params[0]);
  }

  helpers.context.removeGoods(goodsName, count);
  return true;
};

/**
 * EquipGoods - Equip an item
 */
const equipGoodsCommand: CommandHandler = (params, _result, helpers) => {
  const equipType = helpers.resolveNumber(params[0] || "0");
  const goodsId = helpers.resolveNumber(params[1] || "0");
  helpers.context.equipGoods(equipType, goodsId);
  return true;
};

/**
 * AddMoney - Add money to player
 */
const addMoneyCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  helpers.context.addMoney(amount);
  return true;
};

/**
 * AddRandMoney - Add random amount of money
 */
const addRandMoneyCommand: CommandHandler = (params, _result, helpers) => {
  const min = helpers.resolveNumber(params[0] || "0");
  const max = helpers.resolveNumber(params[1] || "100");
  const amount = min + Math.floor(Math.random() * (max - min + 1));
  helpers.context.addMoney(amount);
  return true;
};

/**
 * AddExp - Add experience to player
 */
const addExpCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  helpers.context.addExp(amount);
  return true;
};

/**
 * FullLife - Fully restore player health
 * Globals.ThePlayer.FullLife()
 */
const fullLifeCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.fullLife();
  return true;
};

/**
 * FullMana - Fully restore player mana
 * Globals.ThePlayer.FullMana()
 */
const fullManaCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.fullMana();
  return true;
};

/**
 * FullThew - Fully restore player stamina
 * Globals.ThePlayer.FullThew()
 */
const fullThewCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.fullThew();
  return true;
};

/**
 * AddLife - Add health to player
 * Globals.ThePlayer.AddLife(value)
 */
const addLifeCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  helpers.context.addLife(amount);
  return true;
};

/**
 * AddMana - Add mana to player
 * Globals.ThePlayer.AddMana(value)
 */
const addManaCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  helpers.context.addMana(amount);
  return true;
};

/**
 * AddThew - Add stamina to player
 * Globals.ThePlayer.AddThew(value)
 */
const addThewCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  helpers.context.addThew(amount);
  return true;
};

/**
 * AddMagic - Add magic to player
 * Globals.ThePlayer.AddMagic(fileName)
 */
const addMagicCommand: CommandHandler = async (params, _result, helpers) => {
  const magicFile = helpers.resolveString(params[0] || "");
  await helpers.context.addMagic(magicFile);
  return true;
};

/**
 * SetMagicLevel - Set magic level
 * MagicListManager.SetNonReplaceMagicLevel(fileName, level)
 */
const setMagicLevelCommand: CommandHandler = (params, _result, helpers) => {
  const magicFile = helpers.resolveString(params[0] || "");
  const level = helpers.resolveNumber(params[1] || "1");
  helpers.context.setMagicLevel(magicFile, level);
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
  helpers.context.playerGotoEx(x, y);
  return true;
};

/**
 * PlayerJumpTo - Jump player to position (BLOCKING)
 *
 */
const playerJumpToCommand: CommandHandler = async (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  await helpers.context.playerJumpTo(x, y);
  return true;
};

/**
 * PlayerRunToEx - Run player to position (NON-BLOCKING)
 * just calls RunTo() without waiting
 */
const playerRunToExCommand: CommandHandler = (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  helpers.context.playerRunToEx(x, y);
  return true;
};

/**
 * SetPlayerScn - Center camera on player
 *
 */
const setPlayerScnCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.context.setPlayerScn();
  return true;
};

/**
 * GetMoneyNum - Get money amount into variable
 *
 */
const getMoneyNumCommand: CommandHandler = (params, result, helpers) => {
  const varName = (params[0] || result || "$MoneyNum").replace("$", "");
  const money = helpers.context.getMoneyNum();
  helpers.context.setVariable(varName, money);
  return true;
};

/**
 * SetMoneyNum - Set money amount
 *
 */
const setMoneyNumCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  helpers.context.setMoneyNum(amount);
  return true;
};

/**
 * GetPlayerExp - Get player exp into variable
 *
 */
const getPlayerExpCommand: CommandHandler = (params, _result, helpers) => {
  const varName = (params[0] || "$PlayerExp").replace("$", "");
  const exp = helpers.context.getPlayerExp();
  helpers.context.setVariable(varName, exp);
  return true;
};

/**
 * GetPlayerState - Get player state (Level/Attack/Defend/etc) into variable
 *
 */
const getPlayerStateCommand: CommandHandler = (params, _result, helpers) => {
  const stateName = helpers.resolveString(params[0] || "");
  const varName = (params[1] || "$PlayerState").replace("$", "");
  const value = helpers.context.getPlayerState(stateName);
  helpers.context.setVariable(varName, value);
  return true;
};

/**
 * GetPlayerMagicLevel - Get player magic level into variable
 *
 */
const getPlayerMagicLevelCommand: CommandHandler = (params, _result, helpers) => {
  const magicFile = helpers.resolveString(params[0] || "");
  const varName = (params[1] || "$MagicLevel").replace("$", "");
  const level = helpers.context.getPlayerMagicLevel(magicFile);
  helpers.context.setVariable(varName, level);
  return true;
};

/**
 * LimitMana - Limit mana usage
 *
 */
const limitManaCommand: CommandHandler = (params, _result, helpers) => {
  const limit = helpers.resolveNumber(params[0] || "0") !== 0;
  helpers.context.limitMana(limit);
  return true;
};

/**
 * AddMoveSpeedPercent - Add move speed percentage
 *
 */
const addMoveSpeedPercentCommand: CommandHandler = (params, _result, helpers) => {
  const percent = helpers.resolveNumber(params[0] || "0");
  helpers.context.addMoveSpeedPercent(percent);
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
  helpers.context.useMagic(magicFile, x, y);
  return true;
};

/**
 * IsEquipWeapon - Check if weapon is equipped, store result in variable
 *
 */
const isEquipWeaponCommand: CommandHandler = (params, _result, helpers) => {
  const varName = (params[0] || "$IsEquipWeapon").replace("$", "");
  const equipped = helpers.context.isEquipWeapon() ? 1 : 0;
  helpers.context.setVariable(varName, equipped);
  return true;
};

/**
 * AddAttack - Add attack power
 * AddAttack(value, type)
 */
const addAttackCommand: CommandHandler = (params, _result, helpers) => {
  const value = helpers.resolveNumber(params[0] || "0");
  const type = params.length >= 2 ? helpers.resolveNumber(params[1]) : 1;
  helpers.context.addAttack(value, type);
  return true;
};

/**
 * AddDefend - Add defense power
 * AddDefend(value, type)
 */
const addDefendCommand: CommandHandler = (params, _result, helpers) => {
  const value = helpers.resolveNumber(params[0] || "0");
  const type = params.length >= 2 ? helpers.resolveNumber(params[1]) : 1;
  helpers.context.addDefend(value, type);
  return true;
};

/**
 * AddEvade - Add evade
 *
 */
const addEvadeCommand: CommandHandler = (params, _result, helpers) => {
  const value = helpers.resolveNumber(params[0] || "0");
  helpers.context.addEvade(value);
  return true;
};

/**
 * AddLifeMax - Add max life
 *
 */
const addLifeMaxCommand: CommandHandler = (params, _result, helpers) => {
  const value = helpers.resolveNumber(params[0] || "0");
  helpers.context.addLifeMax(value);
  return true;
};

/**
 * AddManaMax - Add max mana
 *
 */
const addManaMaxCommand: CommandHandler = (params, _result, helpers) => {
  const value = helpers.resolveNumber(params[0] || "0");
  helpers.context.addManaMax(value);
  return true;
};

/**
 * AddThewMax - Add max stamina
 *
 */
const addThewMaxCommand: CommandHandler = (params, _result, helpers) => {
  const value = helpers.resolveNumber(params[0] || "0");
  helpers.context.addThewMax(value);
  return true;
};

/**
 * DelMagic - Delete magic from player
 *
 */
const delMagicCommand: CommandHandler = (params, _result, helpers) => {
  const magicFile = helpers.resolveString(params[0] || "");
  helpers.context.delMagic(magicFile);
  return true;
};

/**
 * SetPlayerMagicToUseWhenBeAttacked - Set counter-attack magic
 *
 */
const setPlayerMagicToUseWhenBeAttackedCommand: CommandHandler = (params, _result, helpers) => {
  const magicFile = helpers.resolveString(params[0] || "");
  const direction = helpers.resolveNumber(params[1] || "0");
  helpers.context.setPlayerMagicToUseWhenBeAttacked(magicFile, direction);
  return true;
};

/**
 * SetWalkIsRun - Set walk as run mode
 *
 */
const setWalkIsRunCommand: CommandHandler = (params, _result, helpers) => {
  const value = helpers.resolveNumber(params[0] || "0");
  helpers.context.setWalkIsRun(value);
  return true;
};

/**
 * PlayerChange - Change player character
 * Loader.ChangePlayer(int.Parse(parameters[0]))
 */
const playerChangeCommand: CommandHandler = async (params, _result, helpers) => {
  const index = helpers.resolveNumber(params[0] || "0");
  await helpers.context.playerChange(index);
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

  // Inventory
  registry.set("addgoods", addGoodsCommand);
  registry.set("addrandgoods", addRandGoodsCommand);
  registry.set("delgoods", delGoodsCommand);
  registry.set("equipgoods", equipGoodsCommand);

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

  // Magic
  registry.set("addmagic", addMagicCommand);
  registry.set("setmagiclevel", setMagicLevelCommand);
  registry.set("delmagic", delMagicCommand);

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
