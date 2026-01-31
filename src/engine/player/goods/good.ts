/**
 * Good class - based on JxqyHD Engine/Good.cs
 * Represents an item (equipment, drug, or event item)
 *
 * 支持随机属性（AttrInt/AttrString）
 */
import { logger } from "@/engine/core/logger";
import { AttrInt, AttrString, parseAttrInt, parseAttrString } from "@/engine/core/attrTypes";
import { resourceLoader } from "@/engine/resource/resourceLoader";
import { ResourcePath } from "@/config/resourcePaths";

// ============= Enums =============
export enum GoodKind {
  Drug = 0,
  Equipment = 1,
  Event = 2,
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

// ============= Interfaces =============

/**
 * 原始 INI 数据（字符串形式，支持随机值格式）
 */
export interface GoodRawData {
  fileName: string;
  name: string;
  kind: string;
  intro: string;
  effect: string;
  imagePath: string;
  iconPath: string;
  part: string;

  // Stats modifiers (支持随机值)
  life: string;
  thew: string;
  mana: string;
  lifeMax: string;
  thewMax: string;
  manaMax: string;
  attack: string;
  attack2: string;
  attack3: string;
  defend: string;
  defend2: string;
  defend3: string;
  evade: string;

  // Special effects
  effectType: string;
  specialEffect: string;
  specialEffectValue: string;

  // Magic related (支持随机值)
  script: string;
  flyIni: string;
  flyIni2: string;
  magicIniWhenUse: string;

  // Cost
  cost: string;
  sellPrice: string;

  // Requirements
  user: string;
  minUserLevel: string;

  // Special flags
  noNeedToEquip: string;

  // Additional effects
  addMagicEffectPercent: string;
  addMagicEffectAmount: string;
  changeMoveSpeedPercent: string;
  coldMilliSeconds: string;

  // 扩展属性（C# 版本有）
  replaceMagic: string;
  useReplaceMagic: string;
  magicToUseWhenBeAttacked: string;
  magicDirectionWhenBeAttacked: string;
  followPartnerHasDrugEffect: string;
  fighterFriendHasDrugEffect: string;
}

/**
 * 传统 GoodData 接口（用于向后兼容）
 */
export interface GoodData {
  fileName: string;
  name: string;
  kind: GoodKind;
  intro: string;
  effect: number;
  imagePath: string;
  iconPath: string;
  part: EquipPosition;

  // Stats modifiers
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

  // Special effects
  effectType: number;
  specialEffect: number;
  specialEffectValue: number;

  // Magic related
  script?: string;
  flyIni?: string;
  flyIni2?: string;
  magicIniWhenUse?: string;

  // Cost
  cost: number;
  sellPrice: number;

  // Requirements
  user?: string[];
  minUserLevel: number;

  // Special flags
  noNeedToEquip: number;

  // Additional effects
  addMagicEffectPercent: number;
  addMagicEffectAmount: number;
  changeMoveSpeedPercent: number;
  coldMilliSeconds: number;
}

// ============= Good Class =============
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
  user: string[] | undefined;

  // AttrInt 属性（支持随机值）
  private _effect: AttrInt;
  private _life: AttrInt;
  private _thew: AttrInt;
  private _mana: AttrInt;
  private _lifeMax: AttrInt;
  private _thewMax: AttrInt;
  private _manaMax: AttrInt;
  private _attack: AttrInt;
  private _attack2: AttrInt;
  private _attack3: AttrInt;
  private _defend: AttrInt;
  private _defend2: AttrInt;
  private _defend3: AttrInt;
  private _evade: AttrInt;
  private _effectType: AttrInt;
  private _specialEffect: AttrInt;
  private _specialEffectValue: AttrInt;
  private _cost: AttrInt;
  private _sellPrice: AttrInt;
  private _minUserLevel: AttrInt;
  private _noNeedToEquip: AttrInt;
  private _addMagicEffectPercent: AttrInt;
  private _addMagicEffectAmount: AttrInt;
  private _changeMoveSpeedPercent: AttrInt;
  private _coldMilliSeconds: AttrInt;
  private _magicDirectionWhenBeAttacked: AttrInt;
  private _followPartnerHasDrugEffect: AttrInt;
  private _fighterFriendHasDrugEffect: AttrInt;

  // AttrString 属性（支持随机值）
  private _flyIni: AttrString;
  private _flyIni2: AttrString;
  private _magicIniWhenUse: AttrString;
  private _replaceMagic: AttrString;
  private _useReplaceMagic: AttrString;
  private _magicToUseWhenBeAttacked: AttrString;

  constructor(rawData: GoodRawData) {
    // 基础属性
    this.fileName = rawData.fileName;
    this.name = rawData.name;
    this.kind = (parseInt(rawData.kind, 10) as GoodKind) || GoodKind.Drug;
    this.intro = rawData.intro;
    this.imagePath = rawData.imagePath;
    this.iconPath = rawData.iconPath;
    this.part = parseEquipPosition(rawData.part);
    this.script = rawData.script;
    this.user = rawData.user
      ? rawData.user
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s)
      : undefined;

    // AttrInt 属性
    this._effect = parseAttrInt(rawData.effect);
    this._life = parseAttrInt(rawData.life);
    this._thew = parseAttrInt(rawData.thew);
    this._mana = parseAttrInt(rawData.mana);
    this._lifeMax = parseAttrInt(rawData.lifeMax);
    this._thewMax = parseAttrInt(rawData.thewMax);
    this._manaMax = parseAttrInt(rawData.manaMax);
    this._attack = parseAttrInt(rawData.attack);
    this._attack2 = parseAttrInt(rawData.attack2);
    this._attack3 = parseAttrInt(rawData.attack3);
    this._defend = parseAttrInt(rawData.defend);
    this._defend2 = parseAttrInt(rawData.defend2);
    this._defend3 = parseAttrInt(rawData.defend3);
    this._evade = parseAttrInt(rawData.evade);
    this._effectType = parseAttrInt(rawData.effectType);
    this._specialEffect = parseAttrInt(rawData.specialEffect);
    this._specialEffectValue = parseAttrInt(rawData.specialEffectValue, 1);
    this._cost = parseAttrInt(rawData.cost);
    this._sellPrice = parseAttrInt(rawData.sellPrice);
    this._minUserLevel = parseAttrInt(rawData.minUserLevel);
    this._noNeedToEquip = parseAttrInt(rawData.noNeedToEquip);
    this._addMagicEffectPercent = parseAttrInt(rawData.addMagicEffectPercent);
    this._addMagicEffectAmount = parseAttrInt(rawData.addMagicEffectAmount);
    this._changeMoveSpeedPercent = parseAttrInt(rawData.changeMoveSpeedPercent);
    this._coldMilliSeconds = parseAttrInt(rawData.coldMilliSeconds);
    this._magicDirectionWhenBeAttacked = parseAttrInt(rawData.magicDirectionWhenBeAttacked);
    this._followPartnerHasDrugEffect = parseAttrInt(rawData.followPartnerHasDrugEffect);
    this._fighterFriendHasDrugEffect = parseAttrInt(rawData.fighterFriendHasDrugEffect);

    // AttrString 属性
    this._flyIni = parseAttrString(rawData.flyIni);
    this._flyIni2 = parseAttrString(rawData.flyIni2);
    this._magicIniWhenUse = parseAttrString(rawData.magicIniWhenUse);
    this._replaceMagic = parseAttrString(rawData.replaceMagic);
    this._useReplaceMagic = parseAttrString(rawData.useReplaceMagic);
    this._magicToUseWhenBeAttacked = parseAttrString(rawData.magicToUseWhenBeAttacked);
  }

  // ============= AttrInt Getters（获取单个值） =============
  get effect(): number {
    return this._effect.getOneValue();
  }
  get life(): number {
    return this._life.getOneValue();
  }
  get thew(): number {
    return this._thew.getOneValue();
  }
  get mana(): number {
    return this._mana.getOneValue();
  }
  get lifeMax(): number {
    return this._lifeMax.getOneValue();
  }
  get thewMax(): number {
    return this._thewMax.getOneValue();
  }
  get manaMax(): number {
    return this._manaMax.getOneValue();
  }
  get attack(): number {
    return this._attack.getOneValue();
  }
  get attack2(): number {
    return this._attack2.getOneValue();
  }
  get attack3(): number {
    return this._attack3.getOneValue();
  }
  get defend(): number {
    return this._defend.getOneValue();
  }
  get defend2(): number {
    return this._defend2.getOneValue();
  }
  get defend3(): number {
    return this._defend3.getOneValue();
  }
  get evade(): number {
    return this._evade.getOneValue();
  }
  get effectType(): number {
    return this._effectType.getOneValue();
  }
  get specialEffect(): number {
    return this._specialEffect.getOneValue();
  }
  get specialEffectValue(): number {
    return this._specialEffectValue.getOneValue();
  }
  get minUserLevel(): number {
    return this._minUserLevel.getOneValue();
  }
  get noNeedToEquip(): number {
    return this._noNeedToEquip.getOneValue();
  }
  get addMagicEffectPercent(): number {
    return this._addMagicEffectPercent.getOneValue();
  }
  get addMagicEffectAmount(): number {
    return this._addMagicEffectAmount.getOneValue();
  }
  get changeMoveSpeedPercent(): number {
    return this._changeMoveSpeedPercent.getOneValue();
  }
  get coldMilliSeconds(): number {
    return this._coldMilliSeconds.getOneValue();
  }
  get magicDirectionWhenBeAttacked(): number {
    return this._magicDirectionWhenBeAttacked.getOneValue();
  }
  get followPartnerHasDrugEffect(): number {
    return this._followPartnerHasDrugEffect.getOneValue();
  }
  get fighterFriendHasDrugEffect(): number {
    return this._fighterFriendHasDrugEffect.getOneValue();
  }

  // ============= AttrString Getters（获取单个值） =============
  get flyIni(): string {
    return this._flyIni.getOneValue();
  }
  get flyIni2(): string {
    return this._flyIni2.getOneValue();
  }
  get magicIniWhenUse(): string {
    return this._magicIniWhenUse.getOneValue();
  }
  get replaceMagic(): string {
    return this._replaceMagic.getOneValue();
  }
  get useReplaceMagic(): string {
    return this._useReplaceMagic.getOneValue();
  }
  get magicToUseWhenBeAttacked(): string {
    return this._magicToUseWhenBeAttacked.getOneValue();
  }

  // ============= AttrInt 原始对象访问（用于检查随机性） =============
  get effectAttr(): AttrInt {
    return this._effect;
  }
  get lifeAttr(): AttrInt {
    return this._life;
  }
  get thewAttr(): AttrInt {
    return this._thew;
  }
  get manaAttr(): AttrInt {
    return this._mana;
  }
  get lifeMaxAttr(): AttrInt {
    return this._lifeMax;
  }
  get thewMaxAttr(): AttrInt {
    return this._thewMax;
  }
  get manaMaxAttr(): AttrInt {
    return this._manaMax;
  }
  get attackAttr(): AttrInt {
    return this._attack;
  }
  get attack2Attr(): AttrInt {
    return this._attack2;
  }
  get attack3Attr(): AttrInt {
    return this._attack3;
  }
  get defendAttr(): AttrInt {
    return this._defend;
  }
  get defend2Attr(): AttrInt {
    return this._defend2;
  }
  get defend3Attr(): AttrInt {
    return this._defend3;
  }
  get evadeAttr(): AttrInt {
    return this._evade;
  }
  get costAttr(): AttrInt {
    return this._cost;
  }
  get sellPriceAttr(): AttrInt {
    return this._sellPrice;
  }

  // ============= AttrString 原始对象访问 =============
  get flyIniAttr(): AttrString {
    return this._flyIni;
  }
  get flyIni2Attr(): AttrString {
    return this._flyIni2;
  }
  get magicIniWhenUseAttr(): AttrString {
    return this._magicIniWhenUse;
  }

  /**
   * 是否有随机属性
   */
  get hasRandAttr(): boolean {
    // 检查 AttrInt 属性
    const intAttrs: AttrInt[] = [
      this._effect,
      this._life,
      this._thew,
      this._mana,
      this._lifeMax,
      this._thewMax,
      this._manaMax,
      this._attack,
      this._attack2,
      this._attack3,
      this._defend,
      this._defend2,
      this._defend3,
      this._evade,
      this._effectType,
      this._specialEffect,
      this._specialEffectValue,
      this._cost,
      this._sellPrice,
      this._minUserLevel,
      this._noNeedToEquip,
      this._addMagicEffectPercent,
      this._addMagicEffectAmount,
      this._changeMoveSpeedPercent,
      this._coldMilliSeconds,
    ];

    for (const attr of intAttrs) {
      if (attr.isRand()) return true;
    }

    // 检查 AttrString 属性
    const strAttrs: AttrString[] = [
      this._flyIni,
      this._flyIni2,
      this._magicIniWhenUse,
      this._replaceMagic,
      this._useReplaceMagic,
      this._magicToUseWhenBeAttacked,
    ];

    for (const attr of strAttrs) {
      if (attr.isRand()) return true;
    }

    return false;
  }

  /**
   * Get the effect type based on kind and part
   * Based on C#'s Good.TheEffectType property
   */
  get theEffectType(): GoodEffectType {
    switch (this.kind) {
      case GoodKind.Drug:
        switch (this.effectType) {
          case 1:
            return GoodEffectType.ClearFrozen;
          case 2:
            return GoodEffectType.ClearPoison;
          case 3:
            return GoodEffectType.ClearPetrifaction;
        }
        break;
      case GoodKind.Equipment:
        switch (this.effectType) {
          case 1:
            switch (this.part) {
              case EquipPosition.Foot:
                return GoodEffectType.ThewNotLoseWhenRun;
              case EquipPosition.Neck:
                return GoodEffectType.ManaRestore;
              case EquipPosition.Hand:
                return GoodEffectType.EnemyFrozen;
            }
            break;
          case 2:
            if (this.part === EquipPosition.Hand) return GoodEffectType.EnemyPoisoned;
            break;
          case 3:
            if (this.part === EquipPosition.Hand) return GoodEffectType.EnemyPetrified;
            break;
        }
        break;
    }
    return GoodEffectType.None;
  }

  /**
   * 计算原始成本（不含商店加成）
   */
  private get costRaw(): number {
    switch (this.kind) {
      case GoodKind.Drug:
        return (this.thew * 4 + this.life * 2 + this.mana * 2) * (1 + (this.effectType === 0 ? 0 : 1));
      case GoodKind.Equipment:
        if (this.noNeedToEquip > 0) return 0;
        return (
          (this.attack * 20 +
            this.attack2 * 20 +
            this.attack3 * 20 +
            this.defend * 20 +
            this.defend2 * 20 +
            this.defend3 * 20 +
            this.evade * 40 +
            this.lifeMax * 2 +
            this.thewMax * 3 +
            this.manaMax * 2) *
          (1 + (this.effectType === 0 ? 0 : 1))
        );
      default:
        return 0;
    }
  }

  /**
   * 获取购买价格
   */
  get cost(): number {
    const baseCost = this._cost.getMaxValue() > 0 ? this._cost.getMaxValue() : this.costRaw;
    return baseCost;
  }

  /**
   * 获取出售价格
   */
  get sellPrice(): number {
    const baseSellPrice =
      this._sellPrice.getMaxValue() > 0 ? this._sellPrice.getMaxValue() : Math.floor(this.costRaw / 2);
    return baseSellPrice;
  }

  /**
   * Check if this equipment can be equipped in a position
   */
  static canEquip(good: Good | null, position: EquipPosition): boolean {
    return good !== null && good.part === position;
  }

  /**
   * 获取一个非随机的物品实例
   * 将所有随机属性具体化为固定值
   */
  getOneNonRandom(): Good {
    // 创建新的 rawData，将所有随机值转为固定值
    const newRawData: GoodRawData = {
      fileName: this.fileName,
      name: this.name,
      kind: this.kind.toString(),
      intro: this.intro,
      effect: this._effect.getOneValue().toString(),
      imagePath: this.imagePath,
      iconPath: this.iconPath,
      part: equipPositionToString(this.part),
      life: this._life.getOneValue().toString(),
      thew: this._thew.getOneValue().toString(),
      mana: this._mana.getOneValue().toString(),
      lifeMax: this._lifeMax.getOneValue().toString(),
      thewMax: this._thewMax.getOneValue().toString(),
      manaMax: this._manaMax.getOneValue().toString(),
      attack: this._attack.getOneValue().toString(),
      attack2: this._attack2.getOneValue().toString(),
      attack3: this._attack3.getOneValue().toString(),
      defend: this._defend.getOneValue().toString(),
      defend2: this._defend2.getOneValue().toString(),
      defend3: this._defend3.getOneValue().toString(),
      evade: this._evade.getOneValue().toString(),
      effectType: this._effectType.getOneValue().toString(),
      specialEffect: this._specialEffect.getOneValue().toString(),
      specialEffectValue: this._specialEffectValue.getOneValue().toString(),
      script: this.script,
      flyIni: this._flyIni.getOneValue(),
      flyIni2: this._flyIni2.getOneValue(),
      magicIniWhenUse: this._magicIniWhenUse.getOneValue(),
      cost: this._cost.getOneValue().toString(),
      sellPrice: this._sellPrice.getOneValue().toString(),
      user: this.user ? this.user.join(",") : "",
      minUserLevel: this._minUserLevel.getOneValue().toString(),
      noNeedToEquip: this._noNeedToEquip.getOneValue().toString(),
      addMagicEffectPercent: this._addMagicEffectPercent.getOneValue().toString(),
      addMagicEffectAmount: this._addMagicEffectAmount.getOneValue().toString(),
      changeMoveSpeedPercent: this._changeMoveSpeedPercent.getOneValue().toString(),
      coldMilliSeconds: this._coldMilliSeconds.getOneValue().toString(),
      replaceMagic: this._replaceMagic.getOneValue(),
      useReplaceMagic: this._useReplaceMagic.getOneValue(),
      magicToUseWhenBeAttacked: this._magicToUseWhenBeAttacked.getOneValue(),
      magicDirectionWhenBeAttacked: this._magicDirectionWhenBeAttacked.getOneValue().toString(),
      followPartnerHasDrugEffect: this._followPartnerHasDrugEffect.getOneValue().toString(),
      fighterFriendHasDrugEffect: this._fighterFriendHasDrugEffect.getOneValue().toString(),
    };

    // 生成新的文件名（包含随机值信息，用于区分不同实例）
    const newGood = new Good(newRawData);

    // 如果有随机属性，修改文件名以区分
    if (this.hasRandAttr) {
      const baseName = this.fileName.replace(/\.[^.]+$/, "");
      const ext = this.fileName.match(/\.[^.]+$/)?.[0] || "";
      // 添加一些关键属性值到文件名
      const suffix = `_a${newGood.attack}_d${newGood.defend}_l${newGood.lifeMax}`;
      newGood.fileName = baseName + suffix + ext;
    }

    return newGood;
  }

  /**
   * Get effect description string for tooltip
   */
  getEffectString(): string {
    const effects: string[] = [];

    // 使用 AttrInt 的 UI 显示方法
    if (this._life.getMaxValue() !== 0) effects.push(`命 ${this._life.getUIString()}`);
    if (this._thew.getMaxValue() !== 0) effects.push(`体 ${this._thew.getUIString()}`);
    if (this._mana.getMaxValue() !== 0) effects.push(`气 ${this._mana.getUIString()}`);

    if (this._attack.getMaxValue() !== 0 || this._attack2.getMaxValue() !== 0 || this._attack3.getMaxValue() !== 0) {
      let attackStr = "攻 ";
      if (this._attack.getMaxValue() !== 0) attackStr += this._attack.getUIString();
      if (this._attack2.getMaxValue() !== 0 || this._attack3.getMaxValue() !== 0) {
        attackStr += `(${this._attack2.getUIString()})(${this._attack3.getUIString()})`;
      }
      effects.push(attackStr);
    }

    if (this._defend.getMaxValue() !== 0 || this._defend2.getMaxValue() !== 0 || this._defend3.getMaxValue() !== 0) {
      let defendStr = "防 ";
      if (this._defend.getMaxValue() !== 0) defendStr += this._defend.getUIString();
      if (this._defend2.getMaxValue() !== 0 || this._defend3.getMaxValue() !== 0) {
        defendStr += `(${this._defend2.getUIString()})(${this._defend3.getUIString()})`;
      }
      effects.push(defendStr);
    }

    if (this._evade.getMaxValue() !== 0) effects.push(`捷 ${this._evade.getUIString()}`);
    if (this._lifeMax.getMaxValue() !== 0) effects.push(`命上限 ${this._lifeMax.getUIString()}`);
    if (this._thewMax.getMaxValue() !== 0) effects.push(`体上限 ${this._thewMax.getUIString()}`);
    if (this._manaMax.getMaxValue() !== 0) effects.push(`气上限 ${this._manaMax.getUIString()}`);

    return effects.join("  ");
  }

  /**
   * 转换为传统 GoodData 格式（向后兼容）
   */
  toGoodData(): GoodData {
    return {
      fileName: this.fileName,
      name: this.name,
      kind: this.kind,
      intro: this.intro,
      effect: this.effect,
      imagePath: this.imagePath,
      iconPath: this.iconPath,
      part: this.part,
      life: this.life,
      thew: this.thew,
      mana: this.mana,
      lifeMax: this.lifeMax,
      thewMax: this.thewMax,
      manaMax: this.manaMax,
      attack: this.attack,
      attack2: this.attack2,
      attack3: this.attack3,
      defend: this.defend,
      defend2: this.defend2,
      defend3: this.defend3,
      evade: this.evade,
      effectType: this.effectType,
      specialEffect: this.specialEffect,
      specialEffectValue: this.specialEffectValue,
      script: this.script || undefined,
      flyIni: this.flyIni || undefined,
      flyIni2: this.flyIni2 || undefined,
      magicIniWhenUse: this.magicIniWhenUse || undefined,
      cost: this.cost,
      sellPrice: this.sellPrice,
      user: this.user,
      minUserLevel: this.minUserLevel,
      noNeedToEquip: this.noNeedToEquip,
      addMagicEffectPercent: this.addMagicEffectPercent,
      addMagicEffectAmount: this.addMagicEffectAmount,
      changeMoveSpeedPercent: this.changeMoveSpeedPercent,
      coldMilliSeconds: this.coldMilliSeconds,
    };
  }
}

// ============= Helper Functions =============

/**
 * Parse equipment position from string
 */
function parseEquipPosition(value: string): EquipPosition {
  if (!value) return EquipPosition.None;
  switch (value.toLowerCase()) {
    case "head":
      return EquipPosition.Head;
    case "neck":
      return EquipPosition.Neck;
    case "body":
      return EquipPosition.Body;
    case "back":
      return EquipPosition.Back;
    case "hand":
      return EquipPosition.Hand;
    case "wrist":
      return EquipPosition.Wrist;
    case "foot":
      return EquipPosition.Foot;
    default:
      return EquipPosition.None;
  }
}

/**
 * Convert equipment position to string
 */
function equipPositionToString(position: EquipPosition): string {
  switch (position) {
    case EquipPosition.Head:
      return "Head";
    case EquipPosition.Neck:
      return "Neck";
    case EquipPosition.Body:
      return "Body";
    case EquipPosition.Back:
      return "Back";
    case EquipPosition.Hand:
      return "Hand";
    case EquipPosition.Wrist:
      return "Wrist";
    case EquipPosition.Foot:
      return "Foot";
    default:
      return "";
  }
}

/**
 * 创建默认的 GoodRawData
 */
function createDefaultRawData(): GoodRawData {
  return {
    fileName: "",
    name: "",
    kind: "0",
    intro: "",
    effect: "",
    imagePath: "",
    iconPath: "",
    part: "",
    life: "",
    thew: "",
    mana: "",
    lifeMax: "",
    thewMax: "",
    manaMax: "",
    attack: "",
    attack2: "",
    attack3: "",
    defend: "",
    defend2: "",
    defend3: "",
    evade: "",
    effectType: "",
    specialEffect: "",
    specialEffectValue: "1",
    script: "",
    flyIni: "",
    flyIni2: "",
    magicIniWhenUse: "",
    cost: "",
    sellPrice: "",
    user: "",
    minUserLevel: "",
    noNeedToEquip: "",
    addMagicEffectPercent: "",
    addMagicEffectAmount: "",
    changeMoveSpeedPercent: "",
    coldMilliSeconds: "",
    replaceMagic: "",
    useReplaceMagic: "",
    magicToUseWhenBeAttacked: "",
    magicDirectionWhenBeAttacked: "",
    followPartnerHasDrugEffect: "",
    fighterFriendHasDrugEffect: "",
  };
}

// ============= Good Loading =============

/**
 * Load a good from an INI file
 * Uses unified resourceLoader for caching parsed results
 */
export async function loadGood(filePath: string): Promise<Good | null> {
  // 使用 loadIni 缓存解析结果
  const parser = (content: string) => parseGoodIni(content, filePath);
  const rawData = await resourceLoader.loadIni<GoodRawData>(filePath, parser, "goods");

  if (!rawData) {
    return null;
  }

  return new Good(rawData);
}

/**
 * Parse good INI content
 */
function parseGoodIni(content: string, filePath: string): GoodRawData | null {
  const lines = content.split(/\r?\n/);

  // Extract filename from path
  const fileName = filePath.split("/").pop() || "";

  const data = createDefaultRawData();
  data.fileName = fileName;

  let inInitSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Section header
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      inInitSection = trimmed.toLowerCase() === "[init]";
      continue;
    }

    if (!inInitSection) continue;

    // Key=Value
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim();

    // 保留原始字符串值，让 AttrInt/AttrString 处理随机格式
    switch (key.toLowerCase()) {
      case "name":
        data.name = value;
        break;
      case "kind":
        data.kind = value;
        break;
      case "intro":
        data.intro = value;
        break;
      case "effect":
        data.effect = value;
        break;
      case "image":
        data.imagePath = `asf/goods/${value}`;
        break;
      case "icon":
        data.iconPath = `asf/goods/${value}`;
        break;
      case "part":
        data.part = value;
        break;
      case "life":
        data.life = value;
        break;
      case "thew":
        data.thew = value;
        break;
      case "mana":
        data.mana = value;
        break;
      case "lifemax":
        data.lifeMax = value;
        break;
      case "thewmax":
        data.thewMax = value;
        break;
      case "manamax":
        data.manaMax = value;
        break;
      case "attack":
        data.attack = value;
        break;
      case "attack2":
        data.attack2 = value;
        break;
      case "attack3":
        data.attack3 = value;
        break;
      case "defend":
        data.defend = value;
        break;
      case "defend2":
        data.defend2 = value;
        break;
      case "defend3":
        data.defend3 = value;
        break;
      case "evade":
        data.evade = value;
        break;
      case "effecttype":
        data.effectType = value;
        break;
      case "specialeffect":
        data.specialEffect = value;
        break;
      case "specialeffectvalue":
        data.specialEffectValue = value;
        break;
      case "script":
        data.script = value;
        break;
      case "flyini":
        data.flyIni = value;
        break;
      case "flyini2":
        data.flyIni2 = value;
        break;
      case "magiciniwhenuuse":
      case "magiciniwhenuuse": // 支持拼写错误
        data.magicIniWhenUse = value;
        break;
      case "cost":
        data.cost = value;
        break;
      case "sellprice":
        data.sellPrice = value;
        break;
      case "user":
        data.user = value;
        break;
      case "minuserlevel":
        data.minUserLevel = value;
        break;
      case "noneedtoequip":
        data.noNeedToEquip = value;
        break;
      case "addmagiceffectpercent":
        data.addMagicEffectPercent = value;
        break;
      case "addmagiceffectamount":
        data.addMagicEffectAmount = value;
        break;
      case "changemovespeedpercent":
        data.changeMoveSpeedPercent = value;
        break;
      case "coldmilliseconds":
        data.coldMilliSeconds = value;
        break;
      case "replacemagic":
        data.replaceMagic = value;
        break;
      case "usereplacemagic":
        data.useReplaceMagic = value;
        break;
      case "magictousewhenbeattacked":
        data.magicToUseWhenBeAttacked = value;
        break;
      case "magicdirectionwhenbeattacked":
        data.magicDirectionWhenBeAttacked = value;
        break;
      case "followpartnerhasdrugeffect":
        data.followPartnerHasDrugEffect = value;
        break;
      case "fighterfriendhasdrugeffect":
        data.fighterFriendHasDrugEffect = value;
        break;
    }
  }

  return data;
}

/**
 * Get a good by filename
 * Uses resourceLoader for caching
 */
export async function getGood(fileName: string): Promise<Good | null> {
  // Try loading from resources with different path patterns
  const paths = [ResourcePath.goods(fileName), ResourcePath.goods(fileName.toLowerCase())];

  for (const path of paths) {
    const good = await loadGood(path);
    if (good) {
      return good;
    }
  }

  logger.warn(`[Good] Could not find: ${fileName}`);
  return null;
}

/**
 * Clear good cache (委托给 resourceLoader)
 */
export function clearGoodCache(): void {
  resourceLoader.clearCache("goods");
}
