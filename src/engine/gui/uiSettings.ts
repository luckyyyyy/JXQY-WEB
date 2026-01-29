/**
 * UI Settings Loader - loads and parses UI_Settings.ini
 * Based on C# GuiManager.Settings
 *
 * INI files in resources/ are now UTF-8 encoded.
 */
import { parseIni } from "../core/utils";
import { resourceLoader } from "../resource/resourceLoader";

// Cache for loaded settings
let cachedSettings: Record<string, Record<string, string>> | null = null;
let loadingPromise: Promise<Record<string, Record<string, string>>> | null =
  null;

/**
 * Load and parse UI_Settings.ini
 * Returns cached result if already loaded
 */
export async function loadUISettings(): Promise<
  Record<string, Record<string, string>>
> {
  if (cachedSettings) {
    return cachedSettings;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      const content = await resourceLoader.loadText("/resources/ini/UI_Settings.ini");
      if (!content) {
        console.error("Failed to load UI_Settings.ini");
        return {};
      }

      // Parse INI content
      cachedSettings = parseIni(content);
      console.log("[UISettings] Loaded UI_Settings.ini successfully");
      return cachedSettings;
    } catch (error) {
      console.error("Error loading UI_Settings.ini:", error);
      return {};
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Get a section from UI settings
 */
export function getSection(
  settings: Record<string, Record<string, string>>,
  sectionName: string
): Record<string, string> {
  return settings[sectionName] || {};
}

/**
 * Parse a color string "r,g,b,a" to CSS rgba
 */
export function parseColor(
  colorStr: string,
  defaultColor = "rgba(0,0,0,1)"
): string {
  if (!colorStr) return defaultColor;
  const parts = colorStr.split(",").map((s) => parseInt(s.trim(), 10));
  if (parts.length >= 3) {
    const r = parts[0];
    const g = parts[1];
    const b = parts[2];
    const a = parts.length >= 4 ? parts[3] / 255 : 1;
    return `rgba(${r},${g},${b},${a})`;
  }
  return defaultColor;
}

/**
 * Parse an integer with fallback
 */
export function parseInt2(
  value: string | undefined,
  defaultValue: number
): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Normalize image path (convert backslashes to forward slashes)
 */
export function normalizeImagePath(path: string): string {
  if (!path) return "";
  // Remove leading slash or backslash
  let normalized = path.replace(/\\/g, "/");
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }
  return normalized;
}

// ============================================
// Type definitions for UI configurations
// ============================================

export interface ButtonConfig {
  left: number;
  top: number;
  width: number;
  height: number;
  image: string;
  sound?: string;
}

export interface TextConfig {
  left: number;
  top: number;
  width: number;
  height: number;
  charSpace: number;
  lineSpace: number;
  color: string;
}

export interface PanelConfig {
  image: string;
  leftAdjust: number;
  topAdjust: number;
  width?: number;
  height?: number;
}

// ============================================
// Parsed UI configurations
// ============================================

export interface SystemGuiConfig {
  panel: PanelConfig;
  saveLoadBtn: ButtonConfig;
  optionBtn: ButtonConfig;
  exitBtn: ButtonConfig;
  returnBtn: ButtonConfig;
}

export interface StateGuiConfig {
  panel: PanelConfig;
  level: TextConfig;
  exp: TextConfig;
  levelUp: TextConfig;
  life: TextConfig;
  thew: TextConfig;
  mana: TextConfig;
  attack: TextConfig;
  defend: TextConfig;
  evade: TextConfig;
}

export interface EquipGuiConfig {
  panel: PanelConfig;
  head: { left: number; top: number; width: number; height: number };
  neck: { left: number; top: number; width: number; height: number };
  body: { left: number; top: number; width: number; height: number };
  back: { left: number; top: number; width: number; height: number };
  hand: { left: number; top: number; width: number; height: number };
  wrist: { left: number; top: number; width: number; height: number };
  foot: { left: number; top: number; width: number; height: number };
}

export interface XiuLianGuiConfig {
  panel: PanelConfig;
  magicImage: { left: number; top: number; width: number; height: number };
  levelText: TextConfig;
  expText: TextConfig;
  nameText: TextConfig;
  introText: TextConfig;
}

export interface GoodsGuiConfig {
  panel: PanelConfig;
  scrollBar: {
    left: number;
    top: number;
    width: number;
    height: number;
    button: string;
  };
  items: { left: number; top: number; width: number; height: number }[];
  money: TextConfig;
}

export interface MagicsGuiConfig {
  panel: PanelConfig;
  scrollBar: {
    left: number;
    top: number;
    width: number;
    height: number;
    button: string;
  };
  items: { left: number; top: number; width: number; height: number }[];
}

export interface MemoGuiConfig {
  panel: PanelConfig;
  text: TextConfig;
  slider: {
    left: number;
    top: number;
    width: number;
    height: number;
    imageBtn: string;
  };
  // TODO: scrollBar 用于滚动条显示，参考 C# MemoGui.cs
  scrollBar: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface DialogGuiConfig {
  panel: PanelConfig;
  text: TextConfig;
  selectA: TextConfig;
  selectB: TextConfig;
  portrait: { left: number; top: number; width: number; height: number };
}

// ============================================
// Config parsers
// ============================================

export function parseSystemGuiConfig(
  settings: Record<string, Record<string, string>>
): SystemGuiConfig {
  const system = getSection(settings, "System");
  const saveLoad = getSection(settings, "System_SaveLoad_Btn");
  const option = getSection(settings, "System_Option_Btn");
  const exit = getSection(settings, "System_Exit_Btn");
  const returnBtn = getSection(settings, "System_Return_Btn");

  return {
    panel: {
      image: normalizeImagePath(system["Image"] || "asf/ui/common/panel.asf"),
      leftAdjust: parseInt2(system["LeftAdjust"], 0),
      topAdjust: parseInt2(system["TopAdjust"], 26),
    },
    saveLoadBtn: {
      left: parseInt2(saveLoad["Left"], 58),
      top: parseInt2(saveLoad["Top"], 86),
      width: parseInt2(saveLoad["Width"], 69),
      height: parseInt2(saveLoad["Height"], 64),
      image: normalizeImagePath(
        saveLoad["Image"] || "asf/ui/system/saveload.asf"
      ),
      sound: saveLoad["Sound"],
    },
    optionBtn: {
      left: parseInt2(option["Left"], 58),
      top: parseInt2(option["Top"], 150),
      width: parseInt2(option["Width"], 69),
      height: parseInt2(option["Height"], 54),
      image: normalizeImagePath(option["Image"] || "asf/ui/system/option.asf"),
      sound: option["Sound"],
    },
    exitBtn: {
      left: parseInt2(exit["Left"], 58),
      top: parseInt2(exit["Top"], 213),
      width: parseInt2(exit["Width"], 69),
      height: parseInt2(exit["Height"], 54),
      image: normalizeImagePath(exit["Image"] || "asf/ui/system/quit.asf"),
      sound: exit["Sound"],
    },
    returnBtn: {
      left: parseInt2(returnBtn["Left"], 58),
      top: parseInt2(returnBtn["Top"], 276),
      width: parseInt2(returnBtn["Width"], 69),
      height: parseInt2(returnBtn["Height"], 54),
      image: normalizeImagePath(
        returnBtn["Image"] || "asf/ui/system/return.asf"
      ),
      sound: returnBtn["Sound"],
    },
  };
}

export function parseStateGuiConfig(
  settings: Record<string, Record<string, string>>
): StateGuiConfig {
  const state = getSection(settings, "State");

  const parseTextSection = (
    sectionName: string,
    defaultTop: number
  ): TextConfig => {
    const section = getSection(settings, sectionName);
    return {
      left: parseInt2(section["Left"], 144),
      top: parseInt2(section["Top"], defaultTop),
      width: parseInt2(section["Width"], 100),
      height: parseInt2(section["Height"], 12),
      charSpace: parseInt2(section["CharSpace"], 0),
      lineSpace: parseInt2(section["LineSpace"], 0),
      color: parseColor(section["Color"], "rgba(0,0,0,0.7)"),
    };
  };

  return {
    panel: {
      image: normalizeImagePath(state["Image"] || "asf/ui/common/panel5.asf"),
      leftAdjust: parseInt2(state["LeftAdjust"], 0),
      topAdjust: parseInt2(state["TopAdjust"], 0),
    },
    level: parseTextSection("State_Level", 219),
    exp: parseTextSection("State_Exp", 234),
    levelUp: parseTextSection("State_LevelUp", 249),
    life: parseTextSection("State_Life", 264),
    thew: parseTextSection("State_Thew", 279),
    mana: parseTextSection("State_Mana", 294),
    attack: parseTextSection("State_Attack", 309),
    defend: parseTextSection("State_Defend", 324),
    evade: parseTextSection("State_Evade", 339),
  };
}

export function parseEquipGuiConfig(
  settings: Record<string, Record<string, string>>
): EquipGuiConfig {
  const equip = getSection(settings, "Equip");

  const parseSlot = (
    sectionName: string,
    defaultLeft: number,
    defaultTop: number
  ) => {
    const section = getSection(settings, sectionName);
    return {
      left: parseInt2(section["Left"], defaultLeft),
      top: parseInt2(section["Top"], defaultTop),
      width: parseInt2(section["Width"], 60),
      height: parseInt2(section["Height"], 75),
    };
  };

  return {
    panel: {
      image: normalizeImagePath(equip["Image"] || "asf/ui/common/panel7.asf"),
      leftAdjust: parseInt2(equip["LeftAdjust"], 0),
      topAdjust: parseInt2(equip["TopAdjust"], 0),
    },
    head: parseSlot("Equip_Head", 47, 66),
    neck: parseSlot("Equip_Neck", 193, 66),
    body: parseSlot("Equip_Body", 121, 168),
    back: parseSlot("Equip_Back", 193, 267),
    hand: parseSlot("Equip_Hand", 193, 168),
    wrist: parseSlot("Equip_Wrist", 47, 168),
    foot: parseSlot("Equip_Foot", 47, 267),
  };
}

export function parseXiuLianGuiConfig(
  settings: Record<string, Record<string, string>>
): XiuLianGuiConfig {
  const xiulian = getSection(settings, "XiuLian");
  const magicImg = getSection(settings, "XiuLian_Magic_Image");
  const levelText = getSection(settings, "XiuLian_Level_Text");
  const expText = getSection(settings, "XiuLian_Exp_Text");
  const nameText = getSection(settings, "XiuLian_Name_Text");
  const introText = getSection(settings, "XiuLian_Intro_Text");

  return {
    panel: {
      image: normalizeImagePath(xiulian["Image"] || "asf/ui/common/panel6.asf"),
      leftAdjust: parseInt2(xiulian["LeftAdjust"], 0),
      topAdjust: parseInt2(xiulian["TopAdjust"], 0),
    },
    magicImage: {
      left: parseInt2(magicImg["Left"], 115),
      top: parseInt2(magicImg["Top"], 75),
      width: parseInt2(magicImg["Width"], 60),
      height: parseInt2(magicImg["Height"], 75),
    },
    levelText: {
      left: parseInt2(levelText["Left"], 126),
      top: parseInt2(levelText["Top"], 224),
      width: parseInt2(levelText["Width"], 80),
      height: parseInt2(levelText["Height"], 12),
      charSpace: parseInt2(levelText["CharSpace"], 0),
      lineSpace: parseInt2(levelText["LineSpace"], 0),
      color: parseColor(levelText["Color"], "rgba(0,0,0,0.8)"),
    },
    expText: {
      left: parseInt2(expText["Left"], 126),
      top: parseInt2(expText["Top"], 243),
      width: parseInt2(expText["Width"], 80),
      height: parseInt2(expText["Height"], 12),
      charSpace: parseInt2(expText["CharSpace"], 0),
      lineSpace: parseInt2(expText["LineSpace"], 0),
      color: parseColor(expText["Color"], "rgba(0,0,0,0.8)"),
    },
    nameText: {
      left: parseInt2(nameText["Left"], 105),
      top: parseInt2(nameText["Top"], 256),
      width: parseInt2(nameText["Width"], 200),
      height: parseInt2(nameText["Height"], 20),
      charSpace: parseInt2(nameText["CharSpace"], 0),
      lineSpace: parseInt2(nameText["LineSpace"], 0),
      color: parseColor(nameText["Color"], "rgba(88,32,32,0.9)"),
    },
    introText: {
      left: parseInt2(introText["Left"], 75),
      top: parseInt2(introText["Top"], 275),
      width: parseInt2(introText["Width"], 145),
      height: parseInt2(introText["Height"], 120),
      charSpace: parseInt2(introText["CharSpace"], 0),
      lineSpace: parseInt2(introText["LineSpace"], 0),
      color: parseColor(introText["Color"], "rgba(47,32,88,0.9)"),
    },
  };
}

export function parseGoodsGuiConfig(
  settings: Record<string, Record<string, string>>
): GoodsGuiConfig {
  const goods = getSection(settings, "Goods");
  const items = getSection(settings, "Goods_List_Items");
  const money = getSection(settings, "Goods_Money");

  const itemConfigs: { left: number; top: number; width: number; height: number }[] =
    [];
  for (let i = 1; i <= 9; i++) {
    itemConfigs.push({
      left: parseInt2(items[`Item_Left_${i}`], 71),
      top: parseInt2(items[`Item_Top_${i}`], 91),
      width: parseInt2(items[`Item_Width_${i}`], 60),
      height: parseInt2(items[`Item_Height_${i}`], 75),
    });
  }

  return {
    panel: {
      image: normalizeImagePath(goods["Image"] || "asf/ui/common/panel3.asf"),
      leftAdjust: parseInt2(goods["LeftAdjust"], 0),
      topAdjust: parseInt2(goods["TopAdjust"], 0),
    },
    scrollBar: {
      left: parseInt2(goods["ScrollBarLeft"], 294),
      top: parseInt2(goods["ScrollBarRight"], 108),
      width: parseInt2(goods["ScrollBarWidth"], 28),
      height: parseInt2(goods["ScrollBarHeight"], 190),
      button: normalizeImagePath(
        goods["ScrollBarButton"] || "asf/ui/option/slidebtn.asf"
      ),
    },
    items: itemConfigs,
    money: {
      left: parseInt2(money["Left"], 137),
      top: parseInt2(money["Top"], 363),
      width: parseInt2(money["Width"], 100),
      height: parseInt2(money["Height"], 12),
      charSpace: 0,
      lineSpace: 0,
      color: parseColor(money["Color"], "rgba(255,255,255,0.8)"),
    },
  };
}

export function parseMagicsGuiConfig(
  settings: Record<string, Record<string, string>>
): MagicsGuiConfig {
  const magics = getSection(settings, "Magics");
  const items = getSection(settings, "Magics_List_Items");

  const itemConfigs: { left: number; top: number; width: number; height: number }[] =
    [];
  for (let i = 1; i <= 9; i++) {
    itemConfigs.push({
      left: parseInt2(items[`Item_Left_${i}`], 71),
      top: parseInt2(items[`Item_Top_${i}`], 91),
      width: parseInt2(items[`Item_Width_${i}`], 60),
      height: parseInt2(items[`Item_Height_${i}`], 75),
    });
  }

  return {
    panel: {
      image: normalizeImagePath(magics["Image"] || "asf/ui/common/panel2.asf"),
      leftAdjust: parseInt2(magics["LeftAdjust"], 0),
      topAdjust: parseInt2(magics["TopAdjust"], 0),
    },
    scrollBar: {
      left: parseInt2(magics["ScrollBarLeft"], 294),
      top: parseInt2(magics["ScrollBarRight"], 108),
      width: parseInt2(magics["ScrollBarWidth"], 28),
      height: parseInt2(magics["ScrollBarHeight"], 190),
      button: normalizeImagePath(
        magics["ScrollBarButton"] || "asf/ui/option/slidebtn.asf"
      ),
    },
    items: itemConfigs,
  };
}

export function parseMemoGuiConfig(
  settings: Record<string, Record<string, string>>
): MemoGuiConfig {
  const memo = getSection(settings, "Memo");
  const text = getSection(settings, "Memo_Text");
  const slider = getSection(settings, "Memo_Slider");

  return {
    panel: {
      image: normalizeImagePath(memo["Image"] || "asf/ui/common/panel4.asf"),
      leftAdjust: parseInt2(memo["LeftAdjust"], 0),
      topAdjust: parseInt2(memo["TopAdjust"], 0),
    },
    text: {
      left: parseInt2(text["Left"], 90),
      top: parseInt2(text["Top"], 155),
      width: parseInt2(text["Width"], 150),
      height: parseInt2(text["Height"], 180),
      charSpace: parseInt2(text["CharSpace"], 1),
      lineSpace: parseInt2(text["LineSpace"], 1),
      color: parseColor(text["Color"], "rgba(40,25,15,0.8)"),
    },
    slider: {
      left: parseInt2(slider["Left"], 295),
      top: parseInt2(slider["Top"], 108),
      width: parseInt2(slider["Width"], 28),
      height: parseInt2(slider["Height"], 190),
      imageBtn: normalizeImagePath(
        slider["Image_Btn"] || "asf/ui/option/slidebtn.asf"
      ),
    },
    // TODO: scrollBar 默认值，参考 C# MemoGui.cs 的滚动条位置
    scrollBar: {
      left: parseInt2(slider["Left"], 295),
      top: parseInt2(slider["Top"], 108),
      width: parseInt2(slider["Width"], 10),
      height: parseInt2(slider["Height"], 190),
    },
  };
}

export function parseDialogGuiConfig(
  settings: Record<string, Record<string, string>>
): DialogGuiConfig {
  const dialog = getSection(settings, "Dialog");
  const text = getSection(settings, "Dialog_Txt");
  const portrait = getSection(settings, "Dialog_Portrait");
  const selectA = getSection(settings, "Dialog_SelA");
  const selectB = getSection(settings, "Dialog_SelB");

  return {
    panel: {
      image: normalizeImagePath(dialog["Image"] || "asf/ui/dialog/panel.asf"),
      leftAdjust: parseInt2(dialog["LeftAdjust"], 0),
      topAdjust: parseInt2(dialog["TopAdjust"], -208),
    },
    text: {
      left: parseInt2(text["Left"], 65),
      top: parseInt2(text["Top"], 30),
      width: parseInt2(text["Width"], 310),
      height: parseInt2(text["Height"], 70),
      charSpace: -1,
      // charSpace: parseInt2(text["CharSpace"], -1),
      lineSpace: parseInt2(text["LineSpace"], 0),
      color: parseColor(text["Color"], "rgba(0,0,0,0.8)"),
    },
    selectA: {
      left: parseInt2(selectA["Left"], 65),
      top: parseInt2(selectA["Top"], 52),
      width: parseInt2(selectA["Width"], 310),
      height: parseInt2(selectA["Height"], 20),
      charSpace: parseInt2(selectA["CharSpace"], 1),
      lineSpace: parseInt2(selectA["LineSpace"], 0),
      color: parseColor(selectA["Color"], "rgba(0,0,255,0.8)"),
    },
    selectB: {
      left: parseInt2(selectB["Left"], 65),
      top: parseInt2(selectB["Top"], 74),
      width: parseInt2(selectB["Width"], 310),
      height: parseInt2(selectB["Height"], 20),
      charSpace: parseInt2(selectB["CharSpace"], 1),
      lineSpace: parseInt2(selectB["LineSpace"], 0),
      color: parseColor(selectB["Color"], "rgba(0,0,255,0.8)"),
    },
    portrait: {
      left: parseInt2(portrait["Left"], 5),
      top: parseInt2(portrait["Top"], -143),
      width: parseInt2(portrait["Width"], 200),
      height: parseInt2(portrait["Height"], 160),
    },
  };
}

// ============= Message GUI Config =============
// Based on C#'s MessageGui.cs - shows system messages like level up notifications

export interface MessageGuiConfig {
  panel: {
    image: string;
    leftAdjust: number;
    topAdjust: number;
  };
  text: {
    left: number;
    top: number;
    width: number;
    height: number;
    charSpace: number;
    lineSpace: number;
    color: string;
  };
}

export function parseMessageGuiConfig(
  settings: Record<string, Record<string, string>>
): MessageGuiConfig {
  const message = getSection(settings, "Message");
  const text = getSection(settings, "Message_Text");

  return {
    panel: {
      image: normalizeImagePath(message["Image"] || "asf/ui/message/msgbox.asf"),
      leftAdjust: parseInt2(message["LeftAdjust"], -10),
      topAdjust: parseInt2(message["TopAdjust"], -47),
    },
    text: {
      left: parseInt2(text["Left"], 46),
      top: parseInt2(text["Top"], 32),
      width: parseInt2(text["Width"], 148),
      height: parseInt2(text["Height"], 50),
      charSpace: parseInt2(text["CharSpace"], 0),
      lineSpace: parseInt2(text["LineSpace"], 0),
      color: parseColor(text["Color"], "rgba(155,34,22,0.8)"),
    },
  };
}

// ============= NPC Info Show Config =============
// Based on C#'s InfoDrawer.cs - displays NPC life bar at top of screen
// C# Reference: InfoDrawer.DrawLife() reads [NpcInfoShow] section

export interface NpcInfoShowConfig {
  width: number;
  height: number;
  leftAdjust: number;
  topAdjust: number;
}

export function parseNpcInfoShowConfig(
  settings: Record<string, Record<string, string>>
): NpcInfoShowConfig {
  const npcInfo = getSection(settings, "NpcInfoShow");

  return {
    width: parseInt2(npcInfo["Width"], 300),
    height: parseInt2(npcInfo["Height"], 25),
    leftAdjust: parseInt2(npcInfo["LeftAdjust"], 0),
    topAdjust: parseInt2(npcInfo["TopAdjust"], 50),
  };
}
