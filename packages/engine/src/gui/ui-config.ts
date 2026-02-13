/**
 * UI Configuration Loader - based on JxqyHD UI_Settings.ini
 * Parses INI configuration files for GUI layout
 */


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

/**
 * 解析 INI 颜色字符串 "r,g,b,a" 或 "r,g,b" 为 UiColorRGBA (0-255 整数)
 */
export function parseIniColor(colorStr: string): UiColorRGBA {
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
    color: parseIniColor(section.Color || "0,0,0,255"),
    align: parseNum(section.Align, 0),
  };
}



/**
 * 颜色转CSS
 */
export function colorToCSS(color: UiColorRGBA): string {
  return `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
}
