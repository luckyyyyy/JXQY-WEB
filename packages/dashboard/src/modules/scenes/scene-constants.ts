/**
 * 场景编辑器共享常量：默认条目、标签映射、虚拟滚动参数
 */
import type { SceneNpcEntry, SceneObjEntry } from "@miu2d/types";

export function createDefaultNpcEntry(): SceneNpcEntry {
  return {
    name: "",
    kind: 0,
    npcIni: "",
    dir: 0,
    mapX: 0,
    mapY: 0,
    action: 0,
    walkSpeed: 1,
    state: 0,
    pathFinder: 0,
    lum: 0,
    scriptFile: "",
    deathScript: "",
    dialogRadius: 1,
    visionRadius: 10,
    relation: 0,
    group: 0,
    attack: 0,
    defend: 0,
    evade: 0,
    attackLevel: 0,
    attackRadius: 0,
    bodyIni: "",
    flyIni: "",
    flyIni2: "",
    idle: 0,
    level: 0,
    levelUpExp: 0,
    exp: 0,
    expBonus: 0,
    life: 0,
    lifeMax: 0,
    thew: 0,
    thewMax: 0,
    mana: 0,
    manaMax: 0,
    fixedPos: "",
  };
}

export function createDefaultObjEntry(): SceneObjEntry {
  return {
    objName: "",
    objFile: "",
    wavFile: "",
    scriptFile: "",
    kind: 0,
    dir: 0,
    lum: 0,
    mapX: 0,
    mapY: 0,
    offX: 0,
    offY: 0,
    damage: 0,
    frame: 0,
  };
}

export const NPC_KIND_LABELS: Record<number, string> = {
  0: "普通",
  1: "战斗",
  3: "伙伴",
  4: "地面动物",
  5: "事件NPC",
  6: "怕人动物",
  7: "飞行",
};

export const OBJ_KIND_LABELS: Record<number, string> = {
  0: "动态",
  1: "静态",
  2: "尸体",
  3: "循环音效",
  4: "随机音效",
  5: "门",
  6: "陷阱",
  7: "掉落",
};

export const DIRECTION_LABELS: Record<number, string> = {
  0: "↓ 南",
  1: "↙ 西南",
  2: "← 西",
  3: "↖ 西北",
  4: "↑ 北",
  5: "↗ 东北",
  6: "→ 东",
  7: "↘ 东南",
};

export const RELATION_LABELS: Record<number, string> = {
  0: "友好",
  1: "敌对",
  2: "中立",
  3: "无阵营",
};
export const ACTION_LABELS: Record<number, string> = { 0: "站立", 1: "随机走", 2: "循环走" };

/** 虚拟滚动折叠态行高 */
export const ITEM_HEIGHT = 34;
export const OVERSCAN = 5;
