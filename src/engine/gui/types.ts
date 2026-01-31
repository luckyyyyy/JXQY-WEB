/** GUI 类型定义 */
import type { Vector2 } from "../core/types";

// === 基础类型 ===

export interface GuiRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface HudState {
  life: number;
  lifeMax: number;
  mana: number;
  manaMax: number;
  thew: number;
  thewMax: number;
  hotbarItems: (HotbarItem | null)[];
  minimapVisible: boolean;
  messageText: string;
  messageVisible: boolean;
  messageTimer: number;
}

// === GUI 元素 ===

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
  normalImage?: string; hoverImage?: string; pressedImage?: string; disabledImage?: string;
  isHovered: boolean; isPressed: boolean;
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
  fontSize: number; fontColor: string;
  align: "left" | "center" | "right";
  lineHeight: number;
}

export interface GuiPanel extends GuiElement {
  type: "panel";
  backgroundImage?: string; backgroundColor?: string; borderColor?: string;
  isDraggable: boolean;
}

export interface GuiProgressBar extends GuiElement {
  type: "progressBar";
  value: number; maxValue: number;
  fillColor: string; backgroundColor: string;
  direction: "horizontal" | "vertical";
}

// === 对话和选择 ===

export interface DialogGuiState {
  isVisible: boolean;
  text: string;
  portraitIndex: number;
  portraitSide: "left" | "right";
  nameText: string;
  textProgress: number;
  isComplete: boolean;
  // 选择模式
  isInSelecting: boolean;
  selectA: string; selectB: string;
  selection: number;
}

export interface SelectionGuiState {
  isVisible: boolean;
  message: string;
  options: SelectionOptionData[];
  selectedIndex: number;
  hoveredIndex: number;
}

export interface MultiSelectionGuiState {
  isVisible: boolean;
  message: string;
  options: SelectionOptionData[];
  columns: number;
  selectionCount: number;
  selectedIndices: number[];
}

export interface SelectionOptionData {
  text: string; label: string; enabled: boolean;
}

export interface HotbarItem {
  type: "skill" | "item";
  id: string; name: string; iconPath?: string;
  cooldown: number; maxCooldown: number;
  count?: number;
}

// === 菜单和事件 ===

export interface MenuState {
  currentMenu: MenuType | null;
  isOpen: boolean;
}

export type MenuType = "inventory" | "equipment" | "magic" | "status" | "system" | "save" | "load";

export interface GuiMouseEvent {
  x: number; y: number; worldX: number; worldY: number;
  button: "left" | "right" | "middle";
}

export interface GuiKeyEvent {
  key: string; code: string;
  ctrl: boolean; shift: boolean; alt: boolean;
}

// === 状态 ===

export interface GuiManagerState {
  dialog: DialogGuiState;
  selection: SelectionGuiState;
  multiSelection: MultiSelectionGuiState;
  menu: MenuState;
  hud: HudState;
  panels: PanelState;
  tooltipText: string; tooltipVisible: boolean; tooltipPosition: Vector2;
  dragItem: unknown | null; isDragging: boolean; dragPosition: Vector2;
  isVisible: boolean;
}

export interface PanelState {
  state: boolean; equip: boolean; xiulian: boolean;
  goods: boolean; magic: boolean; memo: boolean;
  system: boolean; saveLoad: boolean; buy: boolean;
  npcEquip: boolean; title: boolean; timer: boolean; littleMap: boolean;
}

// === 默认状态工厂 ===

export const createDefaultDialogState = (): DialogGuiState => ({
  isVisible: false, text: "", portraitIndex: 0, portraitSide: "left", nameText: "",
  textProgress: 0, isComplete: true,
  isInSelecting: false, selectA: "", selectB: "", selection: -1,
});

export const createDefaultSelectionState = (): SelectionGuiState => ({
  isVisible: false, message: "", options: [], selectedIndex: 0, hoveredIndex: -1,
});

export const createDefaultMultiSelectionState = (): MultiSelectionGuiState => ({
  isVisible: false, message: "", options: [], columns: 1, selectionCount: 1, selectedIndices: [],
});

export const createDefaultHudState = (): HudState => ({
  life: 1000, lifeMax: 1000, mana: 1000, manaMax: 1000, thew: 1000, thewMax: 1000,
  hotbarItems: Array(8).fill(null),
  minimapVisible: true, messageText: "", messageVisible: false, messageTimer: 0,
});

export const createDefaultGuiState = (): GuiManagerState => ({
  dialog: createDefaultDialogState(),
  selection: createDefaultSelectionState(),
  multiSelection: createDefaultMultiSelectionState(),
  hud: createDefaultHudState(),
  menu: { currentMenu: null, isOpen: false },
  panels: {
    state: false, equip: false, xiulian: false, goods: false, magic: false, memo: false,
    system: false, saveLoad: false, buy: false, npcEquip: false, title: false, timer: false, littleMap: false,
  },
  tooltipText: "", tooltipVisible: false, tooltipPosition: { x: 0, y: 0 },
  dragItem: null, isDragging: false, dragPosition: { x: 0, y: 0 },
  isVisible: true,
});

// === 热键配置 ===

export const DEFAULT_HOTKEYS = {
  skill1: "Digit1", skill2: "Digit2", skill3: "Digit3", skill4: "Digit4",
  skill5: "Digit5", skill6: "Digit6", skill7: "Digit7", skill8: "Digit8",
  item1: "KeyZ", item2: "KeyX", item3: "KeyC",
  inventory: "KeyI", equipment: "KeyE", magic: "KeyM", status: "KeyT", system: "Escape",
  interact: "Space", attack: "KeyA", minimap: "Tab",
} as const;

export type HotkeyAction = keyof typeof DEFAULT_HOTKEYS;
