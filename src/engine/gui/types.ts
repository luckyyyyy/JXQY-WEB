/**
 * GUI Types - based on JxqyHD Engine/Gui/Base/
 */
import type { Vector2 } from "../core/types";

// ============= Base GUI Types =============
export interface GuiRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// ============= HUD Types =============
export interface HudState {
  // Health/Mana/Stamina bars
  life: number;
  lifeMax: number;
  mana: number;
  manaMax: number;
  thew: number;
  thewMax: number;

  // Hotbar
  hotbarItems: (HotbarItem | null)[];

  // Minimap
  minimapVisible: boolean;

  // Message display
  messageText: string;
  messageVisible: boolean;
  messageTimer: number;
}


export interface GuiElement {
  id: string;
  visible: boolean;
  enabled: boolean;
  rect: GuiRect;
  zIndex: number;
  parent?: string;
  children: string[];
}

export interface GuiButton extends GuiElement {
  type: "button";
  text: string;
  normalImage?: string;
  hoverImage?: string;
  pressedImage?: string;
  disabledImage?: string;
  isHovered: boolean;
  isPressed: boolean;
  onClick?: () => void;
}

export interface GuiImage extends GuiElement {
  type: "image";
  imagePath: string;
  frameIndex: number;
}

export interface GuiText extends GuiElement {
  type: "text";
  text: string;
  fontSize: number;
  fontColor: string;
  align: "left" | "center" | "right";
  lineHeight: number;
}

export interface GuiPanel extends GuiElement {
  type: "panel";
  backgroundImage?: string;
  backgroundColor?: string;
  borderColor?: string;
  isDraggable: boolean;
}

export interface GuiProgressBar extends GuiElement {
  type: "progressBar";
  value: number;
  maxValue: number;
  fillColor: string;
  backgroundColor: string;
  direction: "horizontal" | "vertical";
}

// ============= Dialog GUI Types =============
export interface DialogGuiState {
  isVisible: boolean;
  text: string;
  portraitIndex: number;
  portraitSide: "left" | "right";
  nameText: string;
  textProgress: number; // For typewriter effect
  isComplete: boolean;
  // 选择模式 (Choose/Select 命令)
  isInSelecting: boolean;
  selectA: string;
  selectB: string;
  selection: number; // 0 or 1
}

export interface SelectionGuiState {
  isVisible: boolean;
  message: string; // 消息文本（显示在选项上方）- 用于 ChooseEx
  options: SelectionOptionData[];
  selectedIndex: number;
  hoveredIndex: number;
}

export interface SelectionOptionData {
  text: string;
  label: string;
  enabled: boolean;
}

export interface HotbarItem {
  type: "skill" | "item";
  id: string;
  name: string;
  iconPath?: string;
  cooldown: number;
  maxCooldown: number;
  count?: number; // For items
}

// ============= Menu Types =============
export interface MenuState {
  currentMenu: MenuType | null;
  isOpen: boolean;
}

export type MenuType =
  | "inventory"
  | "equipment"
  | "magic"
  | "status"
  | "system"
  | "save"
  | "load";

// ============= GUI Event Types =============
export interface GuiMouseEvent {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  button: "left" | "right" | "middle";
}

export interface GuiKeyEvent {
  key: string;
  code: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

// ============= GUI Manager State =============
export interface GuiManagerState {
  dialog: DialogGuiState;
  selection: SelectionGuiState;
  menu: MenuState;
  hud: HudState;

  // Panel visibility (mirrors JxqyHD GuiManager)
  panels: PanelState;

  // Tooltip
  tooltipText: string;
  tooltipVisible: boolean;
  tooltipPosition: Vector2;

  // Drag & Drop
  dragItem: any | null;
  isDragging: boolean;
  dragPosition: Vector2;

  // Global UI state
  isVisible: boolean;  // 整体UI是否显示
}

// ============= Panel State =============
export interface PanelState {
  state: boolean;      // 主角状态
  equip: boolean;      // 装备
  xiulian: boolean;    // 修炼
  goods: boolean;      // 物品
  magic: boolean;      // 武功
  memo: boolean;       // 任务记事
  system: boolean;     // 系统菜单
  saveLoad: boolean;   // 存档读档
  buy: boolean;        // 买卖
  npcEquip: boolean;   // NPC装备
  title: boolean;      // 标题画面
  timer: boolean;      // 计时器
  littleMap: boolean;  // 小地图
}

// ============= Default States =============
export function createDefaultDialogState(): DialogGuiState {
  return {
    isVisible: false,
    text: "",
    portraitIndex: 0,
    portraitSide: "left",
    nameText: "",
    textProgress: 0,
    isComplete: true,
    isInSelecting: false,
    selectA: "",
    selectB: "",
    selection: -1,
  };
}

export function createDefaultSelectionState(): SelectionGuiState {
  return {
    isVisible: false,
    message: "",
    options: [],
    selectedIndex: 0,
    hoveredIndex: -1,
  };
}


export function createDefaultHudState(): HudState {
  return {
    life: 1000,
    lifeMax: 1000,
    mana: 1000,
    manaMax: 1000,
    thew: 1000,
    thewMax: 1000,
    hotbarItems: Array(8).fill(null),
    minimapVisible: true,
    messageText: "",
    messageVisible: false,
    messageTimer: 0,
  };
}

export function createDefaultGuiState(): GuiManagerState {
  return {
    dialog: createDefaultDialogState(),
    selection: createDefaultSelectionState(),
    hud: createDefaultHudState(),
    menu: {
      currentMenu: null,
      isOpen: false,
    },
    panels: {
      state: false,
      equip: false,
      xiulian: false,
      goods: false,
      magic: false,
      memo: false,
      system: false,
      saveLoad: false,
      buy: false,
      npcEquip: false,
      title: false,
      timer: false,
      littleMap: true,
    },
    tooltipText: "",
    tooltipVisible: false,
    tooltipPosition: { x: 0, y: 0 },
    dragItem: null,
    isDragging: false,
    dragPosition: { x: 0, y: 0 },
    isVisible: true,
  };
}

// ============= Hotkey Bindings =============
export const DEFAULT_HOTKEYS = {
  // Skills (number keys)
  skill1: "Digit1",
  skill2: "Digit2",
  skill3: "Digit3",
  skill4: "Digit4",
  skill5: "Digit5",
  skill6: "Digit6",
  skill7: "Digit7",
  skill8: "Digit8",

  // Quick items
  item1: "KeyZ",
  item2: "KeyX",
  item3: "KeyC",

  // Menus
  inventory: "KeyI",
  equipment: "KeyE",
  magic: "KeyM",
  status: "KeyT",
  system: "Escape",

  // Actions
  interact: "Space",
  attack: "KeyA",

  // Toggle
  minimap: "Tab",
} as const;

export type HotkeyAction = keyof typeof DEFAULT_HOTKEYS;
