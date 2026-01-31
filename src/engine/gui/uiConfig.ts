/**
 * UI Configuration Loader - based on JxqyHD UI_Settings.ini
 * Parses INI configuration files for GUI layout
 */

import { logger } from "../core/logger";
import { parseIni } from "../core/utils";
import { resourceLoader } from "../resource/resourceLoader";
import { DefaultPaths } from "@/config/resourcePaths";

// UI配置结构定义
export interface UiRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface UiColorRGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface UiButtonConfig extends UiRect {
  image: string;
  sound?: string;
}

export interface UiTextConfig extends UiRect {
  charSpace: number;
  lineSpace: number;
  color: UiColorRGBA;
  align?: number; // 0=left, 1=center, 2=right
}

export interface UiPanelConfig extends UiRect {
  image: string;
  leftAdjust: number;
  topAdjust: number;
}

// 顶部按钮栏配置
export interface TopGuiConfig {
  panel: UiPanelConfig;
  stateBtn: UiButtonConfig;
  equipBtn: UiButtonConfig;
  xiulianBtn: UiButtonConfig;
  goodsBtn: UiButtonConfig;
  magicBtn: UiButtonConfig;
  memoBtn: UiButtonConfig;
  systemBtn: UiButtonConfig;
}

// 底部快捷栏配置
export interface BottomGuiConfig {
  panel: UiPanelConfig;
  items: Array<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>;
}

// 底部状态栏配置
export interface BottomStateConfig {
  panel: UiPanelConfig;
  life: UiRect & { image: string };
  thew: UiRect & { image: string };
  mana: UiRect & { image: string };
}

// 对话框配置
export interface DialogGuiConfig {
  panel: UiPanelConfig;
  text: UiTextConfig;
  selectA: UiTextConfig;
  selectB: UiTextConfig;
  portrait: UiRect;
}

// 主界面配置
export interface TitleGuiConfig {
  backgroundImage: string;
  beginBtn: UiButtonConfig;
  loadBtn: UiButtonConfig;
  teamBtn: UiButtonConfig;
  exitBtn: UiButtonConfig;
}

// 存档界面配置
export interface SaveLoadGuiConfig {
  panel: UiPanelConfig;
  snapshot: UiRect;
  textList: UiTextConfig & { itemHeight: number; selectedColor: UiColorRGBA };
  loadBtn: UiButtonConfig;
  saveBtn: UiButtonConfig;
  exitBtn: UiButtonConfig;
}

// 系统菜单配置
export interface SystemGuiConfig {
  panel: UiPanelConfig;
  saveLoadBtn: UiButtonConfig;
  optionBtn: UiButtonConfig;
  exitBtn: UiButtonConfig;
  returnBtn: UiButtonConfig;
}

// 物品列表配置
export interface GoodsInitConfig {
  goodsListType: number;
  storeIndexBegin: number;
  storeIndexEnd: number;
  equipIndexBegin: number;
  equipIndexEnd: number;
  bottomIndexBegin: number;
  bottomIndexEnd: number;
}

// 武功列表配置
export interface MagicInitConfig {
  storeIndexBegin: number;
  storeIndexEnd: number;
  bottomIndexBegin: number;
  bottomIndexEnd: number;
  xiulianIndex: number;
  hideStartIndex: number;
}

// 完整UI配置
export interface UiSettings {
  goodsInit: GoodsInitConfig;
  magicInit: MagicInitConfig;
  title: TitleGuiConfig;
  saveLoad: SaveLoadGuiConfig;
  system: SystemGuiConfig;
  top: TopGuiConfig;
  bottom: BottomGuiConfig;
  bottomState: BottomStateConfig;
  dialog: DialogGuiConfig;
}

// 解析颜色字符串 "r,g,b,a" 或 "r,g,b"
function parseColor(colorStr: string): UiColorRGBA {
  const parts = colorStr.split(",").map((s) => parseInt(s.trim(), 10));
  return {
    r: parts[0] || 0,
    g: parts[1] || 0,
    b: parts[2] || 0,
    a: parts[3] !== undefined ? parts[3] : 255,
  };
}

// 解析数字，支持默认值
function parseNum(val: string | undefined, defaultVal: number = 0): number {
  if (!val) return defaultVal;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? defaultVal : n;
}

// 解析按钮配置
function parseButton(section: Record<string, string> | undefined): UiButtonConfig {
  if (!section) {
    return { left: 0, top: 0, width: 50, height: 50, image: "", sound: "" };
  }
  return {
    left: parseNum(section.Left),
    top: parseNum(section.Top),
    width: parseNum(section.Width),
    height: parseNum(section.Height),
    image: section.Image || "",
    sound: section.Sound || "",
  };
}

// 解析文本配置
function parseText(section: Record<string, string> | undefined): UiTextConfig {
  if (!section) {
    return {
      left: 0,
      top: 0,
      width: 100,
      height: 20,
      charSpace: 0,
      lineSpace: 0,
      color: { r: 0, g: 0, b: 0, a: 255 },
    };
  }
  return {
    left: parseNum(section.Left),
    top: parseNum(section.Top),
    width: parseNum(section.Width),
    height: parseNum(section.Height),
    charSpace: parseNum(section.CharSpace),
    lineSpace: parseNum(section.LineSpace),
    color: parseColor(section.Color || "0,0,0,255"),
    align: parseNum(section.Align, 0),
  };
}

/**
 * 加载UI配置文件
 * Uses unified resourceLoader for text data fetching
 */
export async function loadUiSettings(): Promise<UiSettings> {
  try {
    const text = await resourceLoader.loadText(DefaultPaths.uiSettingsContent);
    if (!text) {
      logger.error("Failed to load UI_Settings.ini");
      return getDefaultUiSettings();
    }
    const ini = parseIni(text);

    // 解析 GoodsInit
    const goodsInit: GoodsInitConfig = {
      goodsListType: parseNum(ini.GoodsInit?.GoodsListType, 0),
      storeIndexBegin: parseNum(ini.GoodsInit?.StoreIndexBegin, 1),
      storeIndexEnd: parseNum(ini.GoodsInit?.StoreIndexEnd, 198),
      equipIndexBegin: parseNum(ini.GoodsInit?.EquipIndexBegin, 201),
      equipIndexEnd: parseNum(ini.GoodsInit?.EquipIndexEnd, 207),
      bottomIndexBegin: parseNum(ini.GoodsInit?.BottomIndexBegin, 221),
      bottomIndexEnd: parseNum(ini.GoodsInit?.BottomIndexEnd, 223),
    };

    // 解析 MagicInit
    const magicInit: MagicInitConfig = {
      storeIndexBegin: parseNum(ini.MagicInit?.StoreIndexBegin, 1),
      storeIndexEnd: parseNum(ini.MagicInit?.StoreIndexEnd, 36),
      bottomIndexBegin: parseNum(ini.MagicInit?.BottomIndexBegin, 40),
      bottomIndexEnd: parseNum(ini.MagicInit?.BottomIndexEnd, 44),
      xiulianIndex: parseNum(ini.MagicInit?.XiuLianIndex, 49),
      hideStartIndex: parseNum(ini.MagicInit?.HideStartIndex, 1000),
    };

    // 解析 Title
    const title: TitleGuiConfig = {
      backgroundImage: ini.Title?.BackgroundImage || "",
      beginBtn: parseButton(ini.Title_Btn_Begin),
      loadBtn: parseButton(ini.Title_Btn_Load),
      teamBtn: parseButton(ini.Title_Btn_Team),
      exitBtn: parseButton(ini.Title_Btn_Exit),
    };

    // 解析 SaveLoad
    const saveLoad: SaveLoadGuiConfig = {
      panel: {
        left: 0,
        top: 0,
        width: 640,
        height: 480,
        image: ini.SaveLoad?.Image || "",
        leftAdjust: parseNum(ini.SaveLoad?.LeftAdjust),
        topAdjust: parseNum(ini.SaveLoad?.TopAdjust),
      },
      snapshot: {
        left: parseNum(ini.Save_Snapshot?.Left),
        top: parseNum(ini.Save_Snapshot?.Top),
        width: parseNum(ini.Save_Snapshot?.Width),
        height: parseNum(ini.Save_Snapshot?.Height),
      },
      textList: {
        ...parseText(ini.SaveLoad_Text_List),
        itemHeight: parseNum(ini.SaveLoad_Text_List?.ItemHeight, 25),
        selectedColor: parseColor(ini.SaveLoad_Text_List?.SelectedColor || "102,73,212,204"),
      },
      loadBtn: parseButton(ini.SaveLoad_Load_Btn),
      saveBtn: parseButton(ini.SaveLoad_Save_Btn),
      exitBtn: parseButton(ini.SaveLoad_Exit_Btn),
    };

    // 解析 System
    const system: SystemGuiConfig = {
      panel: {
        left: 0,
        top: 0,
        width: 200,
        height: 350,
        image: ini.System?.Image || "",
        leftAdjust: parseNum(ini.System?.LeftAdjust),
        topAdjust: parseNum(ini.System?.TopAdjust),
      },
      saveLoadBtn: parseButton(ini.System_SaveLoad_Btn),
      optionBtn: parseButton(ini.System_Option_Btn),
      exitBtn: parseButton(ini.System_Exit_Btn),
      returnBtn: parseButton(ini.System_Return_Btn),
    };

    // 解析 Top
    const top: TopGuiConfig = {
      panel: {
        left: 0,
        top: 0,
        width: 285,
        height: 27,
        image: ini.Top?.Image || "",
        leftAdjust: parseNum(ini.Top?.LeftAdjust),
        topAdjust: parseNum(ini.Top?.TopAdjust),
      },
      stateBtn: parseButton(ini.Top_State_Btn),
      equipBtn: parseButton(ini.Top_Equip_Btn),
      xiulianBtn: parseButton(ini.Top_XiuLian_Btn),
      goodsBtn: parseButton(ini.Top_Goods_Btn),
      magicBtn: parseButton(ini.Top_Magic_Btn),
      memoBtn: parseButton(ini.Top_Memo_Btn),
      systemBtn: parseButton(ini.Top_System_Btn),
    };

    // 解析 Bottom
    const bottomItems: BottomGuiConfig["items"] = [];
    for (let i = 1; i <= 8; i++) {
      bottomItems.push({
        left: parseNum(ini.Bottom_Items?.[`Item_Left_${i}`]),
        top: parseNum(ini.Bottom_Items?.[`Item_Top_${i}`]),
        width: parseNum(ini.Bottom_Items?.[`Item_Width_${i}`], 30),
        height: parseNum(ini.Bottom_Items?.[`Item_Height_${i}`], 40),
      });
    }

    const bottom: BottomGuiConfig = {
      panel: {
        left: 0,
        top: 0,
        width: 391,
        height: 70,
        image: ini.Bottom?.Image || "",
        leftAdjust: parseNum(ini.Bottom?.LeftAdjust, 102),
        topAdjust: parseNum(ini.Bottom?.TopAdjust),
      },
      items: bottomItems,
    };

    // 解析 BottomState
    const bottomState: BottomStateConfig = {
      panel: {
        left: 0,
        top: 0,
        width: 170,
        height: 70,
        image: ini.BottomState?.Image || "",
        leftAdjust: parseNum(ini.BottomState?.LeftAdjust, -320),
        topAdjust: parseNum(ini.BottomState?.TopAdjust),
      },
      life: {
        left: parseNum(ini.BottomState_Life?.Left),
        top: parseNum(ini.BottomState_Life?.Top),
        width: parseNum(ini.BottomState_Life?.Width),
        height: parseNum(ini.BottomState_Life?.Height),
        image: ini.BottomState_Life?.Image || "",
      },
      thew: {
        left: parseNum(ini.BottomState_Thew?.Left),
        top: parseNum(ini.BottomState_Thew?.Top),
        width: parseNum(ini.BottomState_Thew?.Width),
        height: parseNum(ini.BottomState_Thew?.Height),
        image: ini.BottomState_Thew?.Image || "",
      },
      mana: {
        left: parseNum(ini.BottomState_Mana?.Left),
        top: parseNum(ini.BottomState_Mana?.Top),
        width: parseNum(ini.BottomState_Mana?.Width),
        height: parseNum(ini.BottomState_Mana?.Height),
        image: ini.BottomState_Mana?.Image || "",
      },
    };

    // 解析 Dialog
    const dialog: DialogGuiConfig = {
      panel: {
        left: 0,
        top: 0,
        width: 350,
        height: 85,
        image: ini.Dialog?.Image || "",
        leftAdjust: parseNum(ini.Dialog?.LeftAdjust),
        topAdjust: parseNum(ini.Dialog?.TopAdjust, -208),
      },
      text: parseText(ini.Dialog_Txt),
      selectA: parseText(ini.Dialog_SelA),
      selectB: parseText(ini.Dialog_SelB),
      portrait: {
        left: parseNum(ini.Dialog_Portrait?.Left, 5),
        top: parseNum(ini.Dialog_Portrait?.Top, -143),
        width: parseNum(ini.Dialog_Portrait?.Width, 200),
        height: parseNum(ini.Dialog_Portrait?.Height, 160),
      },
    };

    return {
      goodsInit,
      magicInit,
      title,
      saveLoad,
      system,
      top,
      bottom,
      bottomState,
      dialog,
    };
  } catch (error) {
    logger.error("Failed to load UI settings:", error);
    return getDefaultUiSettings();
  }
}

/**
 * 获取默认UI配置
 */
export function getDefaultUiSettings(): UiSettings {
  return {
    goodsInit: {
      goodsListType: 0,
      storeIndexBegin: 1,
      storeIndexEnd: 198,
      equipIndexBegin: 201,
      equipIndexEnd: 207,
      bottomIndexBegin: 221,
      bottomIndexEnd: 223,
    },
    magicInit: {
      storeIndexBegin: 1,
      storeIndexEnd: 36,
      bottomIndexBegin: 40,
      bottomIndexEnd: 44,
      xiulianIndex: 49,
      hideStartIndex: 1000,
    },
    title: {
      backgroundImage: "",
      beginBtn: { left: 327, top: 112, width: 81, height: 66, image: "" },
      loadBtn: { left: 327, top: 177, width: 81, height: 66, image: "" },
      teamBtn: { left: 327, top: 240, width: 81, height: 66, image: "" },
      exitBtn: { left: 327, top: 303, width: 81, height: 66, image: "" },
    },
    saveLoad: {
      panel: { left: 0, top: 0, width: 640, height: 480, image: "", leftAdjust: 0, topAdjust: 0 },
      snapshot: { left: 256, top: 94, width: 267, height: 200 },
      textList: {
        left: 135,
        top: 118,
        width: 80,
        height: 189,
        charSpace: 3,
        lineSpace: 0,
        color: { r: 91, g: 31, b: 27, a: 204 },
        itemHeight: 25,
        selectedColor: { r: 102, g: 73, b: 212, a: 204 },
      },
      loadBtn: { left: 248, top: 355, width: 64, height: 72, image: "" },
      saveBtn: { left: 366, top: 355, width: 64, height: 72, image: "" },
      exitBtn: { left: 464, top: 355, width: 64, height: 72, image: "" },
    },
    system: {
      panel: { left: 0, top: 0, width: 200, height: 350, image: "", leftAdjust: 0, topAdjust: 26 },
      saveLoadBtn: { left: 58, top: 86, width: 69, height: 64, image: "" },
      optionBtn: { left: 58, top: 150, width: 69, height: 54, image: "" },
      exitBtn: { left: 58, top: 213, width: 69, height: 54, image: "" },
      returnBtn: { left: 58, top: 276, width: 69, height: 54, image: "" },
    },
    top: {
      panel: { left: 0, top: 0, width: 285, height: 27, image: "", leftAdjust: 0, topAdjust: 0 },
      stateBtn: { left: 52, top: 0, width: 19, height: 19, image: "" },
      equipBtn: { left: 80, top: 0, width: 19, height: 19, image: "" },
      xiulianBtn: { left: 107, top: 0, width: 19, height: 19, image: "" },
      goodsBtn: { left: 135, top: 0, width: 19, height: 19, image: "" },
      magicBtn: { left: 162, top: 0, width: 19, height: 19, image: "" },
      memoBtn: { left: 189, top: 0, width: 19, height: 19, image: "" },
      systemBtn: { left: 216, top: 0, width: 19, height: 19, image: "" },
    },
    bottom: {
      panel: { left: 0, top: 0, width: 391, height: 70, image: "", leftAdjust: 102, topAdjust: 0 },
      items: [
        { left: 7, top: 20, width: 30, height: 40 },
        { left: 44, top: 20, width: 30, height: 40 },
        { left: 82, top: 20, width: 30, height: 40 },
        { left: 199, top: 20, width: 30, height: 40 },
        { left: 238, top: 20, width: 30, height: 40 },
        { left: 277, top: 20, width: 30, height: 40 },
        { left: 316, top: 20, width: 30, height: 40 },
        { left: 354, top: 20, width: 30, height: 40 },
      ],
    },
    bottomState: {
      panel: { left: 0, top: 0, width: 170, height: 70, image: "", leftAdjust: -320, topAdjust: 0 },
      life: { left: 11, top: 22, width: 48, height: 46, image: "" },
      thew: { left: 59, top: 22, width: 48, height: 46, image: "" },
      mana: { left: 113, top: 22, width: 48, height: 46, image: "" },
    },
    dialog: {
      panel: { left: 0, top: 0, width: 350, height: 85, image: "", leftAdjust: 0, topAdjust: -208 },
      text: {
        left: 65,
        top: 30,
        width: 310,
        height: 70,
        charSpace: -2,
        lineSpace: 0,
        color: { r: 0, g: 0, b: 0, a: 204 },
      },
      selectA: {
        left: 65,
        top: 52,
        width: 310,
        height: 20,
        charSpace: 1,
        lineSpace: 0,
        color: { r: 0, g: 0, b: 255, a: 204 },
      },
      selectB: {
        left: 65,
        top: 74,
        width: 310,
        height: 20,
        charSpace: 1,
        lineSpace: 0,
        color: { r: 0, g: 0, b: 255, a: 204 },
      },
      portrait: { left: 5, top: -143, width: 200, height: 160 },
    },
  };
}

/**
 * 颜色转CSS
 */
export function colorToCSS(color: UiColorRGBA): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
}
