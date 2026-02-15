/**
 * GoodDrop - NPC击杀后的物品掉落系统
 *
 *
 * 掉落逻辑：
 * 1. 只有敌人（IsEnemy）死亡时才会掉落
 * 2. 如果设置了 DropIni，则掉落指定物品（可带概率）
 * 3. 如果是 Boss（ExpBonus > 0），必定掉落武器或防具
 * 4. 普通敌人随机掉落：武器、防具、金钱、药品
 *    - 武器/防具：1/10 概率
 *    - 金钱/药品：1/2 概率
 */

import { logger } from "../../core/logger";
import type { Vector2 } from "../../core/types";
import { Obj } from "../../obj/obj";

/** 物品类型枚举*/
export enum GoodType {
  Weapon = 0, // 武器
  Armor = 1, // 防具
  Money = 2, // 金钱
  Drug = 3, // 药品
  MaxType = 4, // 类型数量
}

/** 角色掉落信息接口 */
export interface DropCharacter {
  name: string;
  level: number;
  tilePosition: Vector2;
  isEnemy: boolean;
  expBonus: number; // > 0 表示 Boss
  noDropWhenDie: number; // > 0 表示禁止掉落
  dropIni: string; // 自定义掉落配置
}

/**
 * 获取掉落脚本文件名
 *
 * 武器/防具/金钱：根据等级计算（level/12 + 1，最大7级）
 * 药品：根据等级范围
 */
function getScriptFileName(type: GoodType, characterLevel: number): string {
  switch (type) {
    case GoodType.Weapon:
    case GoodType.Armor:
    case GoodType.Money: {
      // var level = characterLevel/12 + 1; if (level > 7) level = 7;
      let level = Math.floor(characterLevel / 12) + 1;
      if (level > 7) level = 7;

      switch (type) {
        case GoodType.Weapon:
          return `${level}级武器.txt`;
        case GoodType.Armor:
          return `${level}级防具.txt`;
        case GoodType.Money:
          return `${level}级钱.txt`;
      }
      break;
    }
    case GoodType.Drug:
      // 药品根据等级范围
      if (characterLevel <= 10) {
        return "低级药品.txt";
      } else if (characterLevel <= 30) {
        return "中级药品.txt";
      } else if (characterLevel <= 60) {
        return "高级药品.txt";
      } else {
        return "特级药品.txt";
      }
  }
  return "";
}

/**
 * 获取掉落物品的 ini 文件名
 * 中的 fileName 选择
 */
function getDropIniFileName(type: GoodType): string {
  switch (type) {
    case GoodType.Weapon:
      return "可捡武器.ini";
    case GoodType.Armor:
      return "可捡防具.ini";
    case GoodType.Money:
      return "可捡钱.ini";
    case GoodType.Drug:
      return "可捡药品.ini";
    default:
      return "";
  }
}

/**
 * 创建掉落物品对象
 *
 * @param type 物品类型
 * @param character 死亡角色信息
 * @returns Obj 实例或 null
 */
async function createDropObj(type: GoodType, character: DropCharacter): Promise<Obj | null> {
  const fileName = getDropIniFileName(type);
  if (!fileName) return null;

  const obj = await Obj.createFromFile(fileName);
  if (!obj) return null;

  // 设置位置
  obj.tilePosition = { ...character.tilePosition };

  // 计算等级（Boss有额外等级加成）
  // if (character.ExpBonus > 0) 根据随机数加 0/12/24
  let level = character.level;
  if (character.expBonus > 0) {
    const rand = Math.floor(Math.random() * 100);
    if (rand < 10) {
      level += 0;
    } else if (rand < 60) {
      level += 12;
    } else {
      level += 24;
    }
  }

  // 设置脚本文件（脚本在 common 目录下）
  obj.scriptFile = getScriptFileName(type, level);

  return obj;
}

/**
 * 解析 DropIni 配置
 * 中对 DropIni 的解析
 *
 * 格式：
 * - "xxx.ini" - 直接使用该 ini 文件
 * - "xxx.ini[50]" - 50% 概率掉落
 *
 * @returns { ini: 文件名, dropChance: 是否应该掉落 }
 */
function parseDropIni(dropIni: string): { ini: string; shouldDrop: boolean } {
  if (!dropIni.endsWith("]")) {
    return { ini: dropIni, shouldDrop: true };
  }

  const startIdx = dropIni.lastIndexOf("[");
  if (startIdx === -1) {
    logger.warn(`[GoodDrop] DropIni格式错误，无法解析: ${dropIni}`);
    return { ini: dropIni, shouldDrop: true };
  }

  const chanceStr = dropIni.substring(startIdx + 1, dropIni.length - 1);
  const chance = parseInt(chanceStr, 10);
  if (Number.isNaN(chance)) {
    logger.warn(`[GoodDrop] DropIni格式错误，无法解析概率: ${dropIni}`);
    return { ini: dropIni.substring(0, startIdx), shouldDrop: true };
  }

  const roll = Math.floor(Math.random() * 100);
  return {
    ini: dropIni.substring(0, startIdx),
    shouldDrop: roll <= chance,
  };
}

/**
 * 获取 NPC 死亡时的掉落物品
 * character)
 *
 * 调用时机：NPC.IsDeath && NPC.IsBodyIniAdded == 0 时，在 NpcManager.Update 中调用
 *
 * @param character 死亡角色信息
 * @param isDropEnabled 全局掉落开关
 * @returns 掉落的 Obj，或 null 如果不掉落
 */
export async function getDropObj(
  character: DropCharacter,
  isDropEnabled: boolean
): Promise<Obj | null> {
  // if (Globals.IsDropGoodWhenDefeatEnemyDisabled || !character.IsEnemy || character.NoDropWhenDie > 0) return null;
  if (!isDropEnabled || !character.isEnemy || character.noDropWhenDie > 0) {
    return null;
  }

  // 1. 检查自定义 DropIni
  // if (!string.IsNullOrEmpty(character.DropIni))
  if (character.dropIni) {
    const { ini, shouldDrop } = parseDropIni(character.dropIni);
    if (!shouldDrop) {
      return null;
    }

    // 从 ini/obj/ 加载自定义掉落
    const obj = await Obj.createFromFile(ini);
    if (obj) {
      obj.tilePosition = { ...character.tilePosition };
      logger.log(`[GoodDrop] ${character.name} 使用自定义掉落: ${ini}`);
    }
    return obj;
  }

  // 2. Boss 必定掉落武器或防具
  // if (character.ExpBonus > 0) return GetObj(Random.Next(0, 2) == 0 ? Weapon : Armor, character);
  if (character.expBonus > 0) {
    const type = Math.floor(Math.random() * 2) === 0 ? GoodType.Weapon : GoodType.Armor;
    const obj = await createDropObj(type, character);
    if (obj) {
      logger.log(
        `[GoodDrop] Boss ${character.name} 掉落: ${type === GoodType.Weapon ? "武器" : "防具"}`
      );
    }
    return obj;
  }

  // 3. 普通敌人随机掉落
  // var goodType = (GoodType)Random.Next(0, (int)GoodType.MaxType);
  const goodType = Math.floor(Math.random() * GoodType.MaxType) as GoodType;

  // 武器/防具的掉落概率为 1/10，其他为 1/2
  let maxRandValue = 2;
  if (goodType === GoodType.Weapon || goodType === GoodType.Armor) {
    maxRandValue = 10;
  }

  // if (Random.Next(maxRandValue) == 0)
  if (Math.floor(Math.random() * maxRandValue) === 0) {
    const obj = await createDropObj(goodType, character);
    if (obj) {
      const typeNames = ["武器", "防具", "金钱", "药品"];
      logger.log(`[GoodDrop] ${character.name} 掉落: ${typeNames[goodType]}`);
    }
    return obj;
  }

  return null;
}
