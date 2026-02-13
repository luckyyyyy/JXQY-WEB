/**
 * Good - 物品类
 *
 * 从统一数据加载器获取物品配置，缓存到内存中。
 * 启动时自动注册到 dataLoader，数据加载完成后自动构建缓存。
 */

import {
  getGoodsData,
  type ApiGoodsData,
} from "../../resource/resource-loader";
import { createConfigCache } from "../../resource/cache-registry";
import { logger } from "../../core/logger";

// ============= Enums =============

export enum GoodKind {
  Drug = 0,       // 消耗品
  Equipment = 1,  // 装备
  Event = 2,      // 任务道具
}

export enum EquipPosition {
  None = 0,
  Head = 1,
  Neck = 2,
  Body = 3,
  Back = 4,
  Hand = 5,
  Wrist = 6,
  Foot = 7,
}

export enum GoodEffectType {
  None = 0,
  ThewNotLoseWhenRun = 1,
  ManaRestore = 2,
  EnemyFrozen = 3,
  ClearFrozen = 4,
  EnemyPoisoned = 5,
  ClearPoison = 6,
  EnemyPetrified = 7,
  ClearPetrifaction = 8,
}

// ============= API 类型 =============

/** API 返回的物品种类 */
type ApiGoodsKind = "Consumable" | "Equipment" | "Quest";

/** API 返回的装备部位 */
type ApiGoodsPart = "Hand" | "Head" | "Body" | "Foot" | "Neck" | "Back" | "Wrist";

/** API 返回的物品数据（复用 dataLoader 类型） */
export type ApiGoods = ApiGoodsData;

/** 物品种类映射 */
const GoodsKindMap: Record<ApiGoodsKind, GoodKind> = {
  Consumable: GoodKind.Drug,
  Equipment: GoodKind.Equipment,
  Quest: GoodKind.Event,
};

/** 装备部位映射 */
const GoodsPartMap: Record<ApiGoodsPart, EquipPosition> = {
  Head: EquipPosition.Head,
  Neck: EquipPosition.Neck,
  Body: EquipPosition.Body,
  Back: EquipPosition.Back,
  Hand: EquipPosition.Hand,
  Wrist: EquipPosition.Wrist,
  Foot: EquipPosition.Foot,
};

// ============= 缓存 =============

/** 物品缓存 key -> Good */
const GOODS_KEY_PREFIXES = ["ini/goods/"] as const;

// ============= Good 类 =============

export class Good {
  // 基础属性
  fileName: string;
  name: string;
  kind: GoodKind;
  intro: string;
  imagePath: string;
  iconPath: string;
  part: EquipPosition;
  script: string;

  // 数值属性
  life: number;
  thew: number;
  mana: number;
  lifeMax: number;
  thewMax: number;
  manaMax: number;
  attack: number;
  attack2: number;
  attack3: number;
  defend: number;
  defend2: number;
  defend3: number;
  evade: number;
  effectType: number;
  specialEffect: number;
  specialEffectValue: number;
  private _cost: number;

  // 装备特殊属性
  noNeedToEquip: number;
  addMagicEffectPercent: number;
  addMagicEffectAmount: number;
  changeMoveSpeedPercent: number;
  coldMilliSeconds: number;

  // 武功相关
  flyIni: string;
  flyIni2: string;
  magicIniWhenUse: string;
  replaceMagic: string;
  useReplaceMagic: string;
  magicToUseWhenBeAttacked: string;
  magicDirectionWhenBeAttacked: number;

  // 伙伴效果
  followPartnerHasDrugEffect: number;
  fighterFriendHasDrugEffect: number;

  // 用户要求
  user: string[] | undefined;
  minUserLevel: number;

  constructor(api: ApiGoods) {
    this.fileName = api.key.toLowerCase();
    this.name = api.name;
    this.kind = GoodsKindMap[api.kind];
    this.intro = api.intro ?? "";
    this.imagePath = api.image ? `asf/goods/${api.image}` : "";
    this.iconPath = api.icon ? `asf/goods/${api.icon}` : "";
    this.part = api.part ? GoodsPartMap[api.part] : EquipPosition.None;
    this.script = api.script ?? "";

    this.life = api.life ?? 0;
    this.thew = api.thew ?? 0;
    this.mana = api.mana ?? 0;
    this.lifeMax = api.lifeMax ?? 0;
    this.thewMax = api.thewMax ?? 0;
    this.manaMax = api.manaMax ?? 0;
    this.attack = api.attack ?? 0;
    this.attack2 = 0;  // API 暂不支持
    this.attack3 = 0;
    this.defend = api.defend ?? 0;
    this.defend2 = 0;
    this.defend3 = 0;
    this.evade = api.evade ?? 0;
    this.effectType = api.effectType ?? 0;
    this.specialEffect = 0;
    this.specialEffectValue = 1;
    this._cost = api.cost ?? 0;

    // 装备特殊属性（API 暂不支持）
    this.noNeedToEquip = 0;
    this.addMagicEffectPercent = 0;
    this.addMagicEffectAmount = 0;
    this.changeMoveSpeedPercent = 0;
    this.coldMilliSeconds = 0;

    // 武功相关（API 暂不支持）
    this.flyIni = "";
    this.flyIni2 = "";
    this.magicIniWhenUse = "";
    this.replaceMagic = "";
    this.useReplaceMagic = "";
    this.magicToUseWhenBeAttacked = "";
    this.magicDirectionWhenBeAttacked = 0;

    // 伙伴效果
    this.followPartnerHasDrugEffect = 0;
    this.fighterFriendHasDrugEffect = 0;

    // 用户要求
    this.user = undefined;
    this.minUserLevel = 0;
  }

  /**
   * 计算原始成本
   */
  private get costRaw(): number {
    switch (this.kind) {
      case GoodKind.Drug:
        return (this.thew * 4 + this.life * 2 + this.mana * 2) * (1 + (this.effectType === 0 ? 0 : 1));
      case GoodKind.Equipment:
        return (
          (this.attack * 20 + this.defend * 20 + this.evade * 40 +
           this.lifeMax * 2 + this.thewMax * 3 + this.manaMax * 2) *
          (1 + (this.effectType === 0 ? 0 : 1))
        );
      default:
        return 0;
    }
  }

  /** 购买价格 */
  get cost(): number {
    return this._cost > 0 ? this._cost : this.costRaw;
  }

  /** 出售价格 */
  get sellPrice(): number {
    return Math.floor(this.costRaw / 2);
  }

  /** 效果类型 */
  get theEffectType(): GoodEffectType {
    if (this.kind === GoodKind.Drug) {
      switch (this.effectType) {
        case 1: return GoodEffectType.ClearFrozen;
        case 2: return GoodEffectType.ClearPoison;
        case 3: return GoodEffectType.ClearPetrifaction;
      }
    } else if (this.kind === GoodKind.Equipment) {
      if (this.effectType === 1) {
        switch (this.part) {
          case EquipPosition.Foot: return GoodEffectType.ThewNotLoseWhenRun;
          case EquipPosition.Neck: return GoodEffectType.ManaRestore;
          case EquipPosition.Hand: return GoodEffectType.EnemyFrozen;
        }
      } else if (this.effectType === 2 && this.part === EquipPosition.Hand) {
        return GoodEffectType.EnemyPoisoned;
      } else if (this.effectType === 3 && this.part === EquipPosition.Hand) {
        return GoodEffectType.EnemyPetrified;
      }
    }
    return GoodEffectType.None;
  }

  /** 是否有随机属性（API 数据不支持随机，始终返回 false） */
  get hasRandAttr(): boolean {
    return false;
  }

  /** 获取非随机实例（API 数据已是具体值，返回自身） */
  getOneNonRandom(): Good {
    return this;
  }

  /** 效果描述字符串 */
  getEffectString(): string {
    const effects: string[] = [];
    if (this.life !== 0) effects.push(`命 ${this.life}`);
    if (this.thew !== 0) effects.push(`体 ${this.thew}`);
    if (this.mana !== 0) effects.push(`气 ${this.mana}`);
    if (this.attack !== 0) effects.push(`攻 ${this.attack}`);
    if (this.defend !== 0) effects.push(`防 ${this.defend}`);
    if (this.evade !== 0) effects.push(`捷 ${this.evade}`);
    if (this.lifeMax !== 0) effects.push(`命上限 ${this.lifeMax}`);
    if (this.thewMax !== 0) effects.push(`体上限 ${this.thewMax}`);
    if (this.manaMax !== 0) effects.push(`气上限 ${this.manaMax}`);
    return effects.join("  ");
  }

  /** 是否可装备到指定位置 */
  static canEquip(good: Good | null, position: EquipPosition): boolean {
    return good !== null && good.part === position;
  }
}

// ============= 缓存（使用通用 CacheRegistry） =============

type GoodsApiData = NonNullable<ReturnType<typeof getGoodsData>>;

const goodsCacheStore = createConfigCache<GoodsApiData, Good>({
  name: "Goods",
  keyPrefixes: GOODS_KEY_PREFIXES,
  getData: getGoodsData,
  build(data, cache, normalizeKey) {
    for (const api of data) {
      cache.set(normalizeKey(api.key), new Good(api));
    }
  },
});

// ============= 公共 API =============

/** 获取物品（同步，从缓存读取） */
export function getGood(fileName: string): Good | null {
  const good = goodsCacheStore.get(fileName);
  if (!good) {
    logger.warn(`[Good] Not found: ${fileName}`);
  }
  return good;
}

/** 获取所有物品列表（用于调试面板） */
export function getAllGoods(): Good[] {
  return goodsCacheStore.allValues();
}
