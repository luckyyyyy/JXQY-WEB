/**
 * UI Settings Loader - loads and parses UI_Settings.ini
 * Based on C# GuiManager.Settings
 *
 * INI files in resources/ are now UTF-8 encoded.
 */
import { logger } from "../core/logger";
import { parseIni } from "../core/utils";
import { resourceLoader } from "../resource/resourceLoader";
import { DefaultPaths } from "@/config/resourcePaths";

// Cache for loaded settings
let cachedSettings: Record<string, Record<string, string>> | null = null;
let loadingPromise: Promise<Record<string, Record<string, string>>> | null = null;

/**
 * Load and parse UI_Settings.ini
 * Returns cached result if already loaded
 */
export async function loadUISettings(): Promise<Record<string, Record<string, string>>> {
  if (cachedSettings) {
    return cachedSettings;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      const content = await resourceLoader.loadText(DefaultPaths.uiSettingsIni);
      if (!content) {
        logger.error("Failed to load UI_Settings.ini");
        return {};
      }

      // Parse INI content
      cachedSettings = parseIni(content);
      logger.log("[UISettings] Loaded UI_Settings.ini successfully");
      return cachedSettings;
    } catch (error) {
      logger.error("Error loading UI_Settings.ini:", error);
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
export function parseColor(colorStr: string, defaultColor = "rgba(0,0,0,1)"): string {
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
export function parseInt2(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
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

// NPC 装备界面配置 - 与 EquipGuiConfig 结构相同但读取不同配置节
export interface NpcEquipGuiConfig {
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

// ============= SaveLoad GUI Config =============
// Based on C#'s SaveLoadGui.cs - shows save/load interface

export interface SaveLoadGuiConfig {
  panel: PanelConfig;
  snapshot: { left: number; top: number; width: number; height: number };
  textList: {
    text: string[];
    left: number;
    top: number;
    width: number;
    height: number;
    charSpace: number;
    lineSpace: number;
    itemHeight: number;
    color: string;
    selectedColor: string;
    sound: string;
  };
  loadBtn: ButtonConfig;
  saveBtn: ButtonConfig;
  exitBtn: ButtonConfig;
  saveTimeText: TextConfig;
  messageLine: TextConfig & { align: number };
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
      image: normalizeImagePath(system.Image || "asf/ui/common/panel.asf"),
      leftAdjust: parseInt2(system.LeftAdjust, 0),
      topAdjust: parseInt2(system.TopAdjust, 26),
    },
    saveLoadBtn: {
      left: parseInt2(saveLoad.Left, 58),
      top: parseInt2(saveLoad.Top, 86),
      width: parseInt2(saveLoad.Width, 69),
      height: parseInt2(saveLoad.Height, 64),
      image: normalizeImagePath(saveLoad.Image || "asf/ui/system/saveload.asf"),
      sound: saveLoad.Sound,
    },
    optionBtn: {
      left: parseInt2(option.Left, 58),
      top: parseInt2(option.Top, 150),
      width: parseInt2(option.Width, 69),
      height: parseInt2(option.Height, 54),
      image: normalizeImagePath(option.Image || "asf/ui/system/option.asf"),
      sound: option.Sound,
    },
    exitBtn: {
      left: parseInt2(exit.Left, 58),
      top: parseInt2(exit.Top, 213),
      width: parseInt2(exit.Width, 69),
      height: parseInt2(exit.Height, 54),
      image: normalizeImagePath(exit.Image || "asf/ui/system/quit.asf"),
      sound: exit.Sound,
    },
    returnBtn: {
      left: parseInt2(returnBtn.Left, 58),
      top: parseInt2(returnBtn.Top, 276),
      width: parseInt2(returnBtn.Width, 69),
      height: parseInt2(returnBtn.Height, 54),
      image: normalizeImagePath(returnBtn.Image || "asf/ui/system/return.asf"),
      sound: returnBtn.Sound,
    },
  };
}

export function parseStateGuiConfig(
  settings: Record<string, Record<string, string>>
): StateGuiConfig {
  const state = getSection(settings, "State");

  const parseTextSection = (sectionName: string, defaultTop: number): TextConfig => {
    const section = getSection(settings, sectionName);
    return {
      left: parseInt2(section.Left, 144),
      top: parseInt2(section.Top, defaultTop),
      width: parseInt2(section.Width, 100),
      height: parseInt2(section.Height, 12),
      charSpace: parseInt2(section.CharSpace, 0),
      lineSpace: parseInt2(section.LineSpace, 0),
      color: parseColor(section.Color, "rgba(0,0,0,0.7)"),
    };
  };

  return {
    panel: {
      image: normalizeImagePath(state.Image || "asf/ui/common/panel5.asf"),
      leftAdjust: parseInt2(state.LeftAdjust, 0),
      topAdjust: parseInt2(state.TopAdjust, 0),
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

  const parseSlot = (sectionName: string, defaultLeft: number, defaultTop: number) => {
    const section = getSection(settings, sectionName);
    return {
      left: parseInt2(section.Left, defaultLeft),
      top: parseInt2(section.Top, defaultTop),
      width: parseInt2(section.Width, 60),
      height: parseInt2(section.Height, 75),
    };
  };

  return {
    panel: {
      image: normalizeImagePath(equip.Image || "asf/ui/common/panel7.asf"),
      leftAdjust: parseInt2(equip.LeftAdjust, 0),
      topAdjust: parseInt2(equip.TopAdjust, 0),
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

export function parseNpcEquipGuiConfig(
  settings: Record<string, Record<string, string>>
): NpcEquipGuiConfig {
  const npcEquip = getSection(settings, "NpcEquip");

  const parseSlot = (sectionName: string, defaultLeft: number, defaultTop: number) => {
    const section = getSection(settings, sectionName);
    return {
      left: parseInt2(section.Left, defaultLeft),
      top: parseInt2(section.Top, defaultTop),
      width: parseInt2(section.Width, 60),
      height: parseInt2(section.Height, 75),
    };
  };

  return {
    panel: {
      image: normalizeImagePath(npcEquip.Image || "asf/ui/common/panel7.asf"),
      leftAdjust: parseInt2(npcEquip.LeftAdjust, 0),
      topAdjust: parseInt2(npcEquip.TopAdjust, 0),
    },
    head: parseSlot("NpcEquip_Head", 47, 66),
    neck: parseSlot("NpcEquip_Neck", 193, 66),
    body: parseSlot("NpcEquip_Body", 121, 168),
    back: parseSlot("NpcEquip_Back", 193, 267),
    hand: parseSlot("NpcEquip_Hand", 193, 168),
    wrist: parseSlot("NpcEquip_Wrist", 47, 168),
    foot: parseSlot("NpcEquip_Foot", 47, 267),
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
      image: normalizeImagePath(xiulian.Image || "asf/ui/common/panel6.asf"),
      leftAdjust: parseInt2(xiulian.LeftAdjust, 0),
      topAdjust: parseInt2(xiulian.TopAdjust, 0),
    },
    magicImage: {
      left: parseInt2(magicImg.Left, 115),
      top: parseInt2(magicImg.Top, 75),
      width: parseInt2(magicImg.Width, 60),
      height: parseInt2(magicImg.Height, 75),
    },
    levelText: {
      left: parseInt2(levelText.Left, 126),
      top: parseInt2(levelText.Top, 224),
      width: parseInt2(levelText.Width, 80),
      height: parseInt2(levelText.Height, 12),
      charSpace: parseInt2(levelText.CharSpace, 0),
      lineSpace: parseInt2(levelText.LineSpace, 0),
      color: parseColor(levelText.Color, "rgba(0,0,0,0.8)"),
    },
    expText: {
      left: parseInt2(expText.Left, 126),
      top: parseInt2(expText.Top, 243),
      width: parseInt2(expText.Width, 80),
      height: parseInt2(expText.Height, 12),
      charSpace: parseInt2(expText.CharSpace, 0),
      lineSpace: parseInt2(expText.LineSpace, 0),
      color: parseColor(expText.Color, "rgba(0,0,0,0.8)"),
    },
    nameText: {
      left: parseInt2(nameText.Left, 105),
      top: parseInt2(nameText.Top, 256),
      width: parseInt2(nameText.Width, 200),
      height: parseInt2(nameText.Height, 20),
      charSpace: parseInt2(nameText.CharSpace, 0),
      lineSpace: parseInt2(nameText.LineSpace, 0),
      color: parseColor(nameText.Color, "rgba(88,32,32,0.9)"),
    },
    introText: {
      left: parseInt2(introText.Left, 75),
      top: parseInt2(introText.Top, 275),
      width: parseInt2(introText.Width, 145),
      height: parseInt2(introText.Height, 120),
      charSpace: parseInt2(introText.CharSpace, 0),
      lineSpace: parseInt2(introText.LineSpace, 0),
      color: parseColor(introText.Color, "rgba(47,32,88,0.9)"),
    },
  };
}

export function parseGoodsGuiConfig(
  settings: Record<string, Record<string, string>>
): GoodsGuiConfig {
  const goods = getSection(settings, "Goods");
  const items = getSection(settings, "Goods_List_Items");
  const money = getSection(settings, "Goods_Money");

  const itemConfigs: { left: number; top: number; width: number; height: number }[] = [];
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
      image: normalizeImagePath(goods.Image || "asf/ui/common/panel3.asf"),
      leftAdjust: parseInt2(goods.LeftAdjust, 0),
      topAdjust: parseInt2(goods.TopAdjust, 0),
    },
    scrollBar: {
      left: parseInt2(goods.ScrollBarLeft, 294),
      top: parseInt2(goods.ScrollBarRight, 108),
      width: parseInt2(goods.ScrollBarWidth, 28),
      height: parseInt2(goods.ScrollBarHeight, 190),
      button: normalizeImagePath(goods.ScrollBarButton || "asf/ui/option/slidebtn.asf"),
    },
    items: itemConfigs,
    money: {
      left: parseInt2(money.Left, 137),
      top: parseInt2(money.Top, 363),
      width: parseInt2(money.Width, 100),
      height: parseInt2(money.Height, 12),
      charSpace: 0,
      lineSpace: 0,
      color: parseColor(money.Color, "rgba(255,255,255,0.8)"),
    },
  };
}

export function parseMagicsGuiConfig(
  settings: Record<string, Record<string, string>>
): MagicsGuiConfig {
  const magics = getSection(settings, "Magics");
  const items = getSection(settings, "Magics_List_Items");

  const itemConfigs: { left: number; top: number; width: number; height: number }[] = [];
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
      image: normalizeImagePath(magics.Image || "asf/ui/common/panel2.asf"),
      leftAdjust: parseInt2(magics.LeftAdjust, 0),
      topAdjust: parseInt2(magics.TopAdjust, 0),
    },
    scrollBar: {
      left: parseInt2(magics.ScrollBarLeft, 294),
      top: parseInt2(magics.ScrollBarRight, 108),
      width: parseInt2(magics.ScrollBarWidth, 28),
      height: parseInt2(magics.ScrollBarHeight, 190),
      button: normalizeImagePath(magics.ScrollBarButton || "asf/ui/option/slidebtn.asf"),
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
      image: normalizeImagePath(memo.Image || "asf/ui/common/panel4.asf"),
      leftAdjust: parseInt2(memo.LeftAdjust, 0),
      topAdjust: parseInt2(memo.TopAdjust, 0),
    },
    text: {
      left: parseInt2(text.Left, 90),
      top: parseInt2(text.Top, 155),
      width: parseInt2(text.Width, 150),
      height: parseInt2(text.Height, 180),
      charSpace: parseInt2(text.CharSpace, 1),
      lineSpace: parseInt2(text.LineSpace, 1),
      color: parseColor(text.Color, "rgba(40,25,15,0.8)"),
    },
    slider: {
      left: parseInt2(slider.Left, 295),
      top: parseInt2(slider.Top, 108),
      width: parseInt2(slider.Width, 28),
      height: parseInt2(slider.Height, 190),
      imageBtn: normalizeImagePath(slider.Image_Btn || "asf/ui/option/slidebtn.asf"),
    },
    // TODO: scrollBar 默认值，参考 C# MemoGui.cs 的滚动条位置
    scrollBar: {
      left: parseInt2(slider.Left, 295),
      top: parseInt2(slider.Top, 108),
      width: parseInt2(slider.Width, 10),
      height: parseInt2(slider.Height, 190),
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
      image: normalizeImagePath(dialog.Image || "asf/ui/dialog/panel.asf"),
      leftAdjust: parseInt2(dialog.LeftAdjust, 0),
      topAdjust: parseInt2(dialog.TopAdjust, -208),
    },
    text: {
      left: parseInt2(text.Left, 65),
      top: parseInt2(text.Top, 30),
      width: parseInt2(text.Width, 310),
      height: parseInt2(text.Height, 70),
      charSpace: -1,
      // charSpace: parseInt2(text["CharSpace"], -1),
      lineSpace: parseInt2(text.LineSpace, 0),
      color: parseColor(text.Color, "rgba(0,0,0,0.8)"),
    },
    selectA: {
      left: parseInt2(selectA.Left, 65),
      top: parseInt2(selectA.Top, 52),
      width: parseInt2(selectA.Width, 310),
      height: parseInt2(selectA.Height, 20),
      charSpace: parseInt2(selectA.CharSpace, 1),
      lineSpace: parseInt2(selectA.LineSpace, 0),
      color: parseColor(selectA.Color, "rgba(0,0,255,0.8)"),
    },
    selectB: {
      left: parseInt2(selectB.Left, 65),
      top: parseInt2(selectB.Top, 74),
      width: parseInt2(selectB.Width, 310),
      height: parseInt2(selectB.Height, 20),
      charSpace: parseInt2(selectB.CharSpace, 1),
      lineSpace: parseInt2(selectB.LineSpace, 0),
      color: parseColor(selectB.Color, "rgba(0,0,255,0.8)"),
    },
    portrait: {
      left: parseInt2(portrait.Left, 5),
      top: parseInt2(portrait.Top, -143),
      width: parseInt2(portrait.Width, 200),
      height: parseInt2(portrait.Height, 160),
    },
  };
}

// ============= SaveLoad GUI Config Parser =============
// Based on C#'s SaveLoadGui.cs

export function parseSaveLoadGuiConfig(
  settings: Record<string, Record<string, string>>
): SaveLoadGuiConfig {
  const saveLoad = getSection(settings, "SaveLoad");
  const snapshot = getSection(settings, "Save_Snapshot");
  const textList = getSection(settings, "SaveLoad_Text_List");
  const loadBtn = getSection(settings, "SaveLoad_Load_Btn");
  const saveBtn = getSection(settings, "SaveLoad_Save_Btn");
  const exitBtn = getSection(settings, "SaveLoad_Exit_Btn");
  const saveTimeText = getSection(settings, "SaveLoad_Save_Time_Text");
  const messageLine = getSection(settings, "SaveLoad_Message_Line_Text");

  // 解析文本列表项 (进度一/进度二/...)
  const textItems = textList.Text?.split("/") ?? [
    "进度一",
    "进度二",
    "进度三",
    "进度四",
    "进度五",
    "进度六",
    "进度七",
  ];

  return {
    panel: {
      image: normalizeImagePath(saveLoad.Image || "asf/ui/saveload/panel.asf"),
      leftAdjust: parseInt2(saveLoad.LeftAdjust, 0),
      topAdjust: parseInt2(saveLoad.TopAdjust, 0),
    },
    snapshot: {
      left: parseInt2(snapshot.Left, 256),
      top: parseInt2(snapshot.Top, 94),
      width: parseInt2(snapshot.Width, 267),
      height: parseInt2(snapshot.Height, 200),
    },
    textList: {
      text: textItems,
      left: parseInt2(textList.Left, 135),
      top: parseInt2(textList.Top, 118),
      width: parseInt2(textList.Width, 80),
      height: parseInt2(textList.Height, 189),
      charSpace: parseInt2(textList.CharSpace, 3),
      lineSpace: parseInt2(textList.LineSpace, 0),
      itemHeight: parseInt2(textList.ItemHeight, 25),
      color: parseColor(textList.Color, "rgba(91,31,27,0.8)"),
      selectedColor: parseColor(textList.SelectedColor, "rgba(102,73,212,0.8)"),
      sound: textList.Sound || "界-浏览.wav",
    },
    loadBtn: {
      left: parseInt2(loadBtn.Left, 248),
      top: parseInt2(loadBtn.Top, 355),
      width: parseInt2(loadBtn.Width, 64),
      height: parseInt2(loadBtn.Height, 72),
      image: normalizeImagePath(loadBtn.Image || "asf/ui/saveload/btnLoad.asf"),
      sound: loadBtn.Sound || "界-大按钮.wav",
    },
    saveBtn: {
      left: parseInt2(saveBtn.Left, 366),
      top: parseInt2(saveBtn.Top, 355),
      width: parseInt2(saveBtn.Width, 64),
      height: parseInt2(saveBtn.Height, 72),
      image: normalizeImagePath(saveBtn.Image || "asf/ui/saveload/btnSave.asf"),
      sound: saveBtn.Sound || "界-大按钮.wav",
    },
    exitBtn: {
      left: parseInt2(exitBtn.Left, 464),
      top: parseInt2(exitBtn.Top, 355),
      width: parseInt2(exitBtn.Width, 64),
      height: parseInt2(exitBtn.Height, 72),
      image: normalizeImagePath(exitBtn.Image || "asf/ui/saveload/btnExit.asf"),
      sound: exitBtn.Sound || "界-大按钮.wav",
    },
    saveTimeText: {
      left: parseInt2(saveTimeText.Left, 254),
      top: parseInt2(saveTimeText.Top, 310),
      width: parseInt2(saveTimeText.Width, 350),
      height: parseInt2(saveTimeText.Height, 30),
      charSpace: parseInt2(saveTimeText.CharSpace, 1),
      lineSpace: parseInt2(saveTimeText.LineSpace, 0),
      color: parseColor(saveTimeText.Color, "rgba(182,219,189,0.7)"),
    },
    messageLine: {
      left: parseInt2(messageLine.Left, 0),
      top: parseInt2(messageLine.Top, 440),
      width: parseInt2(messageLine.Width, 640),
      height: parseInt2(messageLine.Height, 40),
      charSpace: 0,
      lineSpace: 0,
      color: parseColor(messageLine.Color, "rgba(255,215,0,0.8)"),
      align: parseInt2(messageLine.Align, 1),
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
      image: normalizeImagePath(message.Image || "asf/ui/message/msgbox.asf"),
      leftAdjust: parseInt2(message.LeftAdjust, -10),
      topAdjust: parseInt2(message.TopAdjust, -47),
    },
    text: {
      left: parseInt2(text.Left, 46),
      top: parseInt2(text.Top, 32),
      width: parseInt2(text.Width, 148),
      height: parseInt2(text.Height, 50),
      charSpace: parseInt2(text.CharSpace, 0),
      lineSpace: parseInt2(text.LineSpace, 0),
      color: parseColor(text.Color, "rgba(155,34,22,0.8)"),
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
    width: parseInt2(npcInfo.Width, 300),
    height: parseInt2(npcInfo.Height, 25),
    leftAdjust: parseInt2(npcInfo.LeftAdjust, 0),
    topAdjust: parseInt2(npcInfo.TopAdjust, 50),
  };
}

// ============= LittleMap (小地图) Config =============
// Based on C#'s LittleMapGui.cs - shows a mini map for navigation

export interface LittleMapButtonConfig {
  left: number;
  top: number;
  image: string;
  sound: string;
}

export interface LittleMapTextConfig {
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  align: number; // 0=left, 1=center, 2=right
}

export interface LittleMapGuiConfig {
  panel: {
    image: string;
    leftAdjust: number;
    topAdjust: number;
  };
  leftBtn: LittleMapButtonConfig;
  rightBtn: LittleMapButtonConfig;
  upBtn: LittleMapButtonConfig;
  downBtn: LittleMapButtonConfig;
  closeBtn: LittleMapButtonConfig;
  mapNameText: LittleMapTextConfig;
  bottomTipText: LittleMapTextConfig;
  messageTipText: LittleMapTextConfig;
}

export function parseLittleMapGuiConfig(
  settings: Record<string, Record<string, string>>
): LittleMapGuiConfig {
  const littleMap = getSection(settings, "LittleMap");
  const leftBtn = getSection(settings, "LittleMap_Left_Btn");
  const rightBtn = getSection(settings, "LittleMap_Right_Btn");
  const upBtn = getSection(settings, "LittleMap_Up_Btn");
  const downBtn = getSection(settings, "LittleMap_Down_Btn");
  const closeBtn = getSection(settings, "LittleMap_Close_Btn");
  const mapNameText = getSection(settings, "LittleMap_Map_Name_Line_Text");
  const bottomTipText = getSection(settings, "LittleMap_Bottom_Tip_Line_Text");
  const messageTipText = getSection(settings, "LittleMap_Message_Tip_Line_Text");

  return {
    panel: {
      image: normalizeImagePath(littleMap.Image || "asf/ui/littlemap/panel.asf"),
      leftAdjust: parseInt2(littleMap.LeftAdjust, 0),
      topAdjust: parseInt2(littleMap.TopAdjust, 0),
    },
    leftBtn: {
      left: parseInt2(leftBtn.Left, 437),
      top: parseInt2(leftBtn.Top, 379),
      image: normalizeImagePath(leftBtn.Image || "asf/ui/littlemap/btnleft.asf"),
      sound: leftBtn.Sound || "界-浏览.wav",
    },
    rightBtn: {
      left: parseInt2(rightBtn.Left, 464),
      top: parseInt2(rightBtn.Top, 379),
      image: normalizeImagePath(rightBtn.Image || "asf/ui/littlemap/btnright.asf"),
      sound: rightBtn.Sound || "界-浏览.wav",
    },
    upBtn: {
      left: parseInt2(upBtn.Left, 448),
      top: parseInt2(upBtn.Top, 368),
      image: normalizeImagePath(upBtn.Image || "asf/ui/littlemap/btnup.asf"),
      sound: upBtn.Sound || "界-浏览.wav",
    },
    downBtn: {
      left: parseInt2(downBtn.Left, 448),
      top: parseInt2(downBtn.Top, 395),
      image: normalizeImagePath(downBtn.Image || "asf/ui/littlemap/btndown.asf"),
      sound: downBtn.Sound || "界-浏览.wav",
    },
    closeBtn: {
      left: parseInt2(closeBtn.Left, 448),
      top: parseInt2(closeBtn.Top, 379),
      image: normalizeImagePath(closeBtn.Image || "asf/ui/littlemap/btnclose.asf"),
      sound: closeBtn.Sound || "界-浏览.wav",
    },
    mapNameText: {
      left: parseInt2(mapNameText.Left, 210),
      top: parseInt2(mapNameText.Top, 92),
      width: parseInt2(mapNameText.Width, 220),
      height: parseInt2(mapNameText.Height, 30),
      color: parseColor(mapNameText.Color, "rgba(76,56,48,0.8)"),
      align: parseInt2(mapNameText.Align, 1),
    },
    bottomTipText: {
      left: parseInt2(bottomTipText.Left, 160),
      top: parseInt2(bottomTipText.Top, 370),
      width: parseInt2(bottomTipText.Width, 260),
      height: parseInt2(bottomTipText.Height, 30),
      color: parseColor(bottomTipText.Color, "rgba(76,56,48,0.8)"),
      align: parseInt2(bottomTipText.Align, 0),
    },
    messageTipText: {
      left: parseInt2(messageTipText.Left, 160),
      top: parseInt2(messageTipText.Top, 370),
      width: parseInt2(messageTipText.Width, 260),
      height: parseInt2(messageTipText.Height, 30),
      color: parseColor(messageTipText.Color, "rgba(200,0,0,0.8)"),
      align: parseInt2(messageTipText.Align, 2),
    },
  };
}

// ============= BuySell (商店) Config =============
// Based on C#'s BuyGui.cs - shows shop interface for buying/selling items

export interface BuySellGuiConfig {
  panel: {
    image: string;
    leftAdjust: number;
    topAdjust: number;
  };
  scrollBar: {
    left: number;
    top: number;
    width: number;
    height: number;
    button: string;
  };
  items: { left: number; top: number; width: number; height: number }[];
  closeBtn: {
    left: number;
    top: number;
    image: string;
    sound: string;
  };
}

export function parseBuySellGuiConfig(
  settings: Record<string, Record<string, string>>
): BuySellGuiConfig {
  const buySell = getSection(settings, "BuySell");
  const listItems = getSection(settings, "BuySell_List_Items");

  // Parse 9 item slots (3x3 grid)
  const items: { left: number; top: number; width: number; height: number }[] = [];
  for (let i = 1; i <= 9; i++) {
    items.push({
      left: parseInt2(listItems[`Item_Left_${i}`], 55 + ((i - 1) % 3) * 65),
      top: parseInt2(listItems[`Item_Top_${i}`], 91 + Math.floor((i - 1) / 3) * 79),
      width: parseInt2(listItems[`Item_Width_${i}`], 60),
      height: parseInt2(listItems[`Item_Height_${i}`], 75),
    });
  }

  return {
    panel: {
      image: normalizeImagePath(buySell.Image || "asf/ui/common/panel8.asf"),
      leftAdjust: parseInt2(buySell.LeftAdjust, 0),
      topAdjust: parseInt2(buySell.TopAdjust, 0),
    },
    scrollBar: {
      left: parseInt2(buySell.ScrollBarLeft, 271),
      top: parseInt2(buySell.ScrollBarRight, 108), // Note: config uses "ScrollBarRight" for top position
      width: parseInt2(buySell.ScrollBarWidth, 28),
      height: parseInt2(buySell.ScrollBarHeight, 190),
      button: normalizeImagePath(buySell.ScrollBarButton || "asf/ui/option/slidebtn.asf"),
    },
    items,
    closeBtn: {
      left: parseInt2(buySell.CloseLeft, 117),
      top: parseInt2(buySell.CloseTop, 354),
      image: normalizeImagePath(buySell.CloseImage || "asf/ui/buysell/CloseBtn.asf"),
      sound: buySell.CloseSound || "界-大按钮.wav",
    },
  };
}
