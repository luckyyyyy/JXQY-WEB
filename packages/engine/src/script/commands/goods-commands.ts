/**
 * Goods & Inventory Commands - AddGoods, DelGoods, BuyGoods, SellGoods, GetGoodsNum,
 * AddMagic, DelMagic, ClearGoods, ClearMagic, Drop control, etc.
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
import { logger } from "../../core/logger";
import type { CommandHandler, CommandRegistry } from "./types";

/**
 * AddGoods - Add items to inventory
 */
const addGoodsCommand: CommandHandler = (params, _result, helpers) => {
  const goodsName = helpers.resolveString(params[0] || "");
  const count = helpers.resolveNumber(params[1] || "1");
  helpers.api.goods.add(goodsName, count);
  return true;
};

/**
 * AddRandGoods - Add random item from buy file
 */
const addRandGoodsCommand: CommandHandler = async (params, _result, helpers) => {
  const buyFileName = helpers.resolveString(params[0] || "");
  logger.log(`[ScriptExecutor] AddRandGoods: ${buyFileName}`);
  await helpers.api.goods.addRandom(buyFileName);
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

  helpers.api.goods.remove(goodsName, count);
  return true;
};

/**
 * EquipGoods - Equip an item
 */
const equipGoodsCommand: CommandHandler = (params, _result, helpers) => {
  const equipType = helpers.resolveNumber(params[0] || "0");
  const goodsId = helpers.resolveNumber(params[1] || "0");
  helpers.api.goods.equip(equipType, goodsId);
  return true;
};

/**
 * AddMagic - Add magic to player
 * Globals.ThePlayer.AddMagic(fileName)
 */
const addMagicCommand: CommandHandler = async (params, _result, helpers) => {
  const magicFile = helpers.resolveString(params[0] || "");
  await helpers.api.magic.add(magicFile);
  return true;
};

/**
 * SetMagicLevel - Set magic level
 * PlayerMagicInventory.SetNonReplaceMagicLevel(fileName, level)
 */
const setMagicLevelCommand: CommandHandler = (params, _result, helpers) => {
  const magicFile = helpers.resolveString(params[0] || "");
  const level = helpers.resolveNumber(params[1] || "1");
  helpers.api.magic.setLevel(magicFile, level);
  return true;
};

/**
 * DelMagic - Delete magic from player
 */
const delMagicCommand: CommandHandler = (params, _result, helpers) => {
  const magicFile = helpers.resolveString(params[0] || "");
  helpers.api.magic.delete(magicFile);
  return true;
};

/**
 * BuyGoods - Open buy goods interface
 * BuyGoods(buyFile, canSellSelfGoods)
 */
const buyGoodsCommand: CommandHandler = async (params, _result, helpers) => {
  const buyFile = helpers.resolveString(params[0] || "");
  const canSellSelfGoods = params.length >= 2 && helpers.resolveNumber(params[1]) !== 0;
  await helpers.api.goods.buy(buyFile, canSellSelfGoods);
  return true;
};

/**
 * SellGoods - Open sell goods interface (same as BuyGoods with canSellSelfGoods=true)
 * SellGoods(buyFile) -> BuyGoods(buyFile, true)
 */
const sellGoodsCommand: CommandHandler = async (params, _result, helpers) => {
  const buyFile = helpers.resolveString(params[0] || "");
  await helpers.api.goods.buy(buyFile, true);
  return true;
};

/**
 * BuyGoodsOnly - Open buy goods interface without selling (canSellSelfGoods=false)
 * BuyGoodsOnly(buyFile) -> BuyGoods(buyFile, false)
 */
const buyGoodsOnlyCommand: CommandHandler = async (params, _result, helpers) => {
  const buyFile = helpers.resolveString(params[0] || "");
  await helpers.api.goods.buy(buyFile, false);
  return true;
};

/**
 * GetGoodsNum - Get goods count by file name
 */
const getGoodsNumCommand: CommandHandler = (params, _result, helpers) => {
  const goodsFile = helpers.resolveString(params[0] || "");
  const count = helpers.api.goods.getCountByFile(goodsFile);
  helpers.api.variables.set("GoodsNum", count);
  return true;
};

/**
 * GetGoodsNumByName - Get goods count by display name
 */
const getGoodsNumByNameCommand: CommandHandler = (params, _result, helpers) => {
  const goodsName = helpers.resolveString(params[0] || "");
  const count = helpers.api.goods.getCountByName(goodsName);
  helpers.api.variables.set("GoodsNum", count);
  return true;
};

/**
 * ClearGoods - Clear all goods from inventory
 */
const clearGoodsCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.goods.clear();
  return true;
};

/**
 * ClearMagic - Clear all magic from player
 */
const clearMagicCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.magic.clear();
  return true;
};

/**
 * DelGoodByName - Delete goods by display name
 * DelGoodByName(name, count?)
 */
const delGoodByNameCommand: CommandHandler = (params, _result, helpers) => {
  const name = helpers.resolveString(params[0] || "");
  const count = params.length >= 2 ? helpers.resolveNumber(params[1]) : undefined;
  helpers.api.goods.deleteByName(name, count);
  return true;
};

/**
 * CheckFreeGoodsSpace - Check if there's free goods space
 */
const checkFreeGoodsSpaceCommand: CommandHandler = (params, _result, helpers) => {
  const varName = (params[0] || "$FreeSpace").replace("$", "");
  const hasFreeSpace = helpers.api.goods.hasFreeSpace() ? 1 : 0;
  helpers.api.variables.set(varName, hasFreeSpace);
  return true;
};

/**
 * CheckFreeMagicSpace - Check if there's free magic space
 */
const checkFreeMagicSpaceCommand: CommandHandler = (params, _result, helpers) => {
  const varName = (params[0] || "$FreeSpace").replace("$", "");
  const hasFreeSpace = helpers.api.magic.hasFreeSpace() ? 1 : 0;
  helpers.api.variables.set(varName, hasFreeSpace);
  return true;
};

/**
 * SetDropIni - Set drop file for character
 * SetDropIni(name, dropFile)
 */
const setDropIniCommand: CommandHandler = (params, _result, helpers) => {
  const name = helpers.resolveString(params[0] || "");
  const dropFile = helpers.resolveString(params[1] || "");
  helpers.api.goods.setDropIni(name, dropFile);
  return true;
};

/**
 * EnableDrop - Enable item drop on defeat
 */
const enableDropCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.goods.setDropEnabled(true);
  return true;
};

/**
 * DisableDrop - Disable item drop on defeat
 */
const disableDropCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.goods.setDropEnabled(false);
  return true;
};

export function registerGoodsCommands(registry: CommandRegistry): void {
  // Add/Remove goods
  registry.set("addgoods", addGoodsCommand);
  registry.set("addrandgoods", addRandGoodsCommand);
  registry.set("delgoods", delGoodsCommand);
  registry.set("equipgoods", equipGoodsCommand);

  // Add/Remove magic
  registry.set("addmagic", addMagicCommand);
  registry.set("setmagiclevel", setMagicLevelCommand);
  registry.set("delmagic", delMagicCommand);

  // Buy/Sell
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
}
