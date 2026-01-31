/**
 * Good class - based on JxqyHD Engine/Good.cs
 * Represents an item (equipment, drug, or event item)
 */
import { logger } from "@/engine/core/logger";
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
  private data: GoodData;

  constructor(data: GoodData) {
    this.data = data;
  }

  // Getters
  get fileName(): string {
    return this.data.fileName;
  }
  get name(): string {
    return this.data.name;
  }
  get kind(): GoodKind {
    return this.data.kind;
  }
  get intro(): string {
    return this.data.intro;
  }
  get imagePath(): string {
    return this.data.imagePath;
  }
  get iconPath(): string {
    return this.data.iconPath;
  }
  get part(): EquipPosition {
    return this.data.part;
  }

  get life(): number {
    return this.data.life;
  }
  get thew(): number {
    return this.data.thew;
  }
  get mana(): number {
    return this.data.mana;
  }
  get lifeMax(): number {
    return this.data.lifeMax;
  }
  get thewMax(): number {
    return this.data.thewMax;
  }
  get manaMax(): number {
    return this.data.manaMax;
  }
  get attack(): number {
    return this.data.attack;
  }
  get attack2(): number {
    return this.data.attack2;
  }
  get attack3(): number {
    return this.data.attack3;
  }
  get defend(): number {
    return this.data.defend;
  }
  get defend2(): number {
    return this.data.defend2;
  }
  get defend3(): number {
    return this.data.defend3;
  }
  get evade(): number {
    return this.data.evade;
  }

  get effectType(): number {
    return this.data.effectType;
  }
  get specialEffect(): number {
    return this.data.specialEffect;
  }
  get specialEffectValue(): number {
    return this.data.specialEffectValue;
  }

  get script(): string | undefined {
    return this.data.script;
  }
  get flyIni(): string | undefined {
    return this.data.flyIni;
  }
  get flyIni2(): string | undefined {
    return this.data.flyIni2;
  }
  get magicIniWhenUse(): string | undefined {
    return this.data.magicIniWhenUse;
  }

  get cost(): number {
    return this.data.cost || this.calculateCost();
  }
  get sellPrice(): number {
    return this.data.sellPrice || Math.floor(this.cost / 2);
  }

  get user(): string[] | undefined {
    return this.data.user;
  }
  get minUserLevel(): number {
    return this.data.minUserLevel;
  }
  get noNeedToEquip(): number {
    return this.data.noNeedToEquip;
  }

  get addMagicEffectPercent(): number {
    return this.data.addMagicEffectPercent;
  }
  get addMagicEffectAmount(): number {
    return this.data.addMagicEffectAmount;
  }
  get changeMoveSpeedPercent(): number {
    return this.data.changeMoveSpeedPercent;
  }
  get coldMilliSeconds(): number {
    return this.data.coldMilliSeconds;
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
   * Calculate cost based on stats (from C# Good.CostRaw)
   */
  private calculateCost(): number {
    switch (this.kind) {
      case GoodKind.Drug:
        return (
          (this.thew * 4 + this.life * 2 + this.mana * 2) * (1 + (this.effectType === 0 ? 0 : 1))
        );
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
   * Check if this equipment can be equipped in a position
   */
  static canEquip(good: Good | null, position: EquipPosition): boolean {
    return good !== null && good.part === position;
  }

  /**
   * Get effect description string for tooltip
   */
  getEffectString(): string {
    const effects: string[] = [];

    if (this.life !== 0) effects.push(`命 ${this.life > 0 ? "+" : ""}${this.life}`);
    if (this.thew !== 0) effects.push(`体 ${this.thew > 0 ? "+" : ""}${this.thew}`);
    if (this.mana !== 0) effects.push(`气 ${this.mana > 0 ? "+" : ""}${this.mana}`);

    if (this.attack !== 0 || this.attack2 !== 0 || this.attack3 !== 0) {
      let attackStr = "攻 ";
      if (this.attack !== 0) attackStr += `${this.attack > 0 ? "+" : ""}${this.attack}`;
      if (this.attack2 !== 0 || this.attack3 !== 0) {
        attackStr += `(${this.attack2})(${this.attack3})`;
      }
      effects.push(attackStr);
    }

    if (this.defend !== 0 || this.defend2 !== 0 || this.defend3 !== 0) {
      let defendStr = "防 ";
      if (this.defend !== 0) defendStr += `${this.defend > 0 ? "+" : ""}${this.defend}`;
      if (this.defend2 !== 0 || this.defend3 !== 0) {
        defendStr += `(${this.defend2})(${this.defend3})`;
      }
      effects.push(defendStr);
    }

    if (this.evade !== 0) effects.push(`捷 ${this.evade > 0 ? "+" : ""}${this.evade}`);
    if (this.lifeMax !== 0) effects.push(`命上限 ${this.lifeMax > 0 ? "+" : ""}${this.lifeMax}`);
    if (this.thewMax !== 0) effects.push(`体上限 ${this.thewMax > 0 ? "+" : ""}${this.thewMax}`);
    if (this.manaMax !== 0) effects.push(`气上限 ${this.manaMax > 0 ? "+" : ""}${this.manaMax}`);

    return effects.join("  ");
  }
}

// ============= Good Loading =============

/**
 * Parse equipment position from string
 */
function parseEquipPosition(value: string): EquipPosition {
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
 * Load a good from an INI file
 * Uses unified resourceLoader for caching parsed results
 */
export async function loadGood(filePath: string): Promise<Good | null> {
  // 使用 loadIni 缓存解析结果
  const parser = (content: string) => parseGoodIni(content, filePath);
  const data = await resourceLoader.loadIni<GoodData>(filePath, parser, "goods");

  if (!data) {
    return null;
  }

  return new Good(data);
}

/**
 * Parse good INI content
 */
function parseGoodIni(content: string, filePath: string): GoodData | null {
  const lines = content.split(/\r?\n/);

  // Extract filename from path
  const fileName = filePath.split("/").pop() || "";

  const data: GoodData = {
    fileName,
    name: "",
    kind: GoodKind.Drug,
    intro: "",
    effect: 0,
    imagePath: "",
    iconPath: "",
    part: EquipPosition.None,
    life: 0,
    thew: 0,
    mana: 0,
    lifeMax: 0,
    thewMax: 0,
    manaMax: 0,
    attack: 0,
    attack2: 0,
    attack3: 0,
    defend: 0,
    defend2: 0,
    defend3: 0,
    evade: 0,
    effectType: 0,
    specialEffect: 0,
    specialEffectValue: 1,
    cost: 0,
    sellPrice: 0,
    minUserLevel: 0,
    noNeedToEquip: 0,
    addMagicEffectPercent: 0,
    addMagicEffectAmount: 0,
    changeMoveSpeedPercent: 0,
    coldMilliSeconds: 0,
  };

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

    if (!value) continue;

    switch (key.toLowerCase()) {
      case "name":
        data.name = value;
        break;
      case "kind":
        data.kind = parseInt(value, 10) as GoodKind;
        break;
      case "intro":
        data.intro = value;
        break;
      case "effect":
        data.effect = parseInt(value, 10) || 0;
        break;
      case "image":
        data.imagePath = `asf/goods/${value}`;
        break;
      case "icon":
        data.iconPath = `asf/goods/${value}`;
        break;
      case "part":
        data.part = parseEquipPosition(value);
        break;
      case "life":
        data.life = parseInt(value, 10) || 0;
        break;
      case "thew":
        data.thew = parseInt(value, 10) || 0;
        break;
      case "mana":
        data.mana = parseInt(value, 10) || 0;
        break;
      case "lifemax":
        data.lifeMax = parseInt(value, 10) || 0;
        break;
      case "thewmax":
        data.thewMax = parseInt(value, 10) || 0;
        break;
      case "manamax":
        data.manaMax = parseInt(value, 10) || 0;
        break;
      case "attack":
        data.attack = parseInt(value, 10) || 0;
        break;
      case "attack2":
        data.attack2 = parseInt(value, 10) || 0;
        break;
      case "attack3":
        data.attack3 = parseInt(value, 10) || 0;
        break;
      case "defend":
        data.defend = parseInt(value, 10) || 0;
        break;
      case "defend2":
        data.defend2 = parseInt(value, 10) || 0;
        break;
      case "defend3":
        data.defend3 = parseInt(value, 10) || 0;
        break;
      case "evade":
        data.evade = parseInt(value, 10) || 0;
        break;
      case "effecttype":
        data.effectType = parseInt(value, 10) || 0;
        break;
      case "specialeffect":
        data.specialEffect = parseInt(value, 10) || 0;
        break;
      case "specialeffectvalue":
        data.specialEffectValue = parseInt(value, 10) || 1;
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
        data.magicIniWhenUse = value;
        break;
      case "cost":
        data.cost = parseInt(value, 10) || 0;
        break;
      case "sellprice":
        data.sellPrice = parseInt(value, 10) || 0;
        break;
      case "user":
        data.user = value
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s);
        break;
      case "minuserlevel":
        data.minUserLevel = parseInt(value, 10) || 0;
        break;
      case "noneedtoequip":
        data.noNeedToEquip = parseInt(value, 10) || 0;
        break;
      case "addmagiceffectpercent":
        data.addMagicEffectPercent = parseInt(value, 10) || 0;
        break;
      case "addmagiceffectamount":
        data.addMagicEffectAmount = parseInt(value, 10) || 0;
        break;
      case "changemovespeedpercent":
        data.changeMoveSpeedPercent = parseInt(value, 10) || 0;
        break;
      case "coldmilliseconds":
        data.coldMilliSeconds = parseInt(value, 10) || 0;
        break;
    }
  }

  return data;
}

// ============= Good Loading =============

/**
 * Get a good by filename
 * Uses resourceLoader for caching
 */
export async function getGood(fileName: string): Promise<Good | null> {
  // Try loading from resources with different path patterns
  const paths = [
    ResourcePath.goods(fileName),
    ResourcePath.goods(fileName.toLowerCase()),
  ];

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
