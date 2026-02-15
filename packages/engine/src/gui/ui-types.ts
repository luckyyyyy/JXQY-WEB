/**
 * GUI 类型定义 + UI ↔ 引擎数据契约
 *
 * 合并自原 types.ts 和 contract.ts：
 * - 内部 GUI 管理器状态 (GuiManagerState, HudState, MenuState, ...)
 * - 默认状态工厂 (createDefaultGuiState, ...)
 * - 热键配置
 * - UI 契约 (UIBridge, UIAction, UISnapshot, ...)
 *
 * 设计原则：
 * 1. 所有 UI 数据都是 readonly，单向流动 (引擎 → UI)
 * 2. UI 通过 UIAction 派发动作 (UI → 引擎)
 * 3. UI 订阅状态变化，不直接访问引擎内部
 */

import type { Vector2 } from "../core/types";
import type { Good } from "../player/goods/good";

// 从 core/ 重新导出事件共享类型（保持向后兼容）
export type {
  DialogGuiState,
  MultiSelectionGuiState,
  PanelState,
  SelectionGuiState,
  SelectionOptionData,
} from "../core/gui-state-types";

import type {
  DialogGuiState,
  MultiSelectionGuiState,
  PanelState,
  SelectionGuiState,
  SelectionOptionData,
} from "../core/gui-state-types";

// =============================================================================
// 内部 GUI 管理器类型
// =============================================================================

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

export interface HotbarItem {
  type: "skill" | "item";
  id: string;
  name: string;
  iconPath?: string;
  cooldown: number;
  maxCooldown: number;
  count?: number;
}

// === 菜单 ===

export interface MenuState {
  currentMenu: MenuType | null;
  isOpen: boolean;
}

export type MenuType = "inventory" | "equipment" | "magic" | "status" | "system" | "save" | "load";

// === 状态 ===

export interface GuiManagerState {
  dialog: DialogGuiState;
  selection: SelectionGuiState;
  multiSelection: MultiSelectionGuiState;
  menu: MenuState;
  hud: HudState;
  panels: PanelState;
  tooltipText: string;
  tooltipVisible: boolean;
  tooltipPosition: Vector2;
  dragItem: unknown | null;
  isDragging: boolean;
  dragPosition: Vector2;
  isVisible: boolean;
}

// === 默认状态工厂 ===

export const createDefaultDialogState = (): DialogGuiState => ({
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
});

export const createDefaultSelectionState = (): SelectionGuiState => ({
  isVisible: false,
  message: "",
  options: [],
  selectedIndex: 0,
  hoveredIndex: -1,
});

export const createDefaultMultiSelectionState = (): MultiSelectionGuiState => ({
  isVisible: false,
  message: "",
  options: [],
  columns: 1,
  selectionCount: 1,
  selectedIndices: [],
});

export const createDefaultHudState = (): HudState => ({
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
});

export const createDefaultGuiState = (): GuiManagerState => ({
  dialog: createDefaultDialogState(),
  selection: createDefaultSelectionState(),
  multiSelection: createDefaultMultiSelectionState(),
  hud: createDefaultHudState(),
  menu: { currentMenu: null, isOpen: false },
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
    littleMap: false,
  },
  tooltipText: "",
  tooltipVisible: false,
  tooltipPosition: { x: 0, y: 0 },
  dragItem: null,
  isDragging: false,
  dragPosition: { x: 0, y: 0 },
  isVisible: true,
});

// === 热键配置 ===

export const DEFAULT_HOTKEYS = {
  skill1: "Digit1",
  skill2: "Digit2",
  skill3: "Digit3",
  skill4: "Digit4",
  skill5: "Digit5",
  skill6: "Digit6",
  skill7: "Digit7",
  skill8: "Digit8",
  item1: "KeyZ",
  item2: "KeyX",
  item3: "KeyC",
  inventory: "KeyI",
  equipment: "KeyE",
  magic: "KeyM",
  status: "KeyT",
  system: "Escape",
  interact: "Space",
  attack: "KeyA",
  minimap: "Tab",
} as const;

export type HotkeyAction = keyof typeof DEFAULT_HOTKEYS;

// =============================================================================
// UI 契约 — UI 层与引擎层之间的数据契约
// =============================================================================

// ============= 玩家状态 =============

export interface UIPlayerState {
  readonly playerIndex: number; // 当前角色索引，用于面板图像切换
  readonly playerName: string; // 角色名称，用于头像加载
  readonly level: number;
  readonly exp: number;
  readonly levelUpExp: number;
  readonly life: number;
  readonly lifeMax: number;
  readonly thew: number;
  readonly thewMax: number;
  readonly mana: number;
  readonly manaMax: number;
  readonly manaLimit: boolean; // 内力限制标志
  readonly attack: number;
  readonly defend: number;
  readonly evade: number;
  readonly money: number;
}

// ============= 物品系统 =============

/** Good 的只读视图，直接复用引擎类型，不手写第二套 */
export type UIGoodData = Readonly<Good>;

export interface UIGoodsSlot {
  readonly index: number;
  readonly good: UIGoodData | null;
  readonly count: number;
}

export interface UIEquipSlots {
  readonly head: UIGoodsSlot | null;
  readonly neck: UIGoodsSlot | null;
  readonly body: UIGoodsSlot | null;
  readonly back: UIGoodsSlot | null;
  readonly hand: UIGoodsSlot | null;
  readonly wrist: UIGoodsSlot | null;
  readonly foot: UIGoodsSlot | null;
}

export interface UIGoodsState {
  readonly items: readonly UIGoodsSlot[];
  readonly equips: UIEquipSlots;
  readonly bottomGoods: readonly (UIGoodsSlot | null)[];
  readonly money: number;
}

// ============= 武功系统 =============

export interface UIMagicData {
  readonly fileName: string;
  readonly name: string;
  readonly intro: string;
  readonly iconPath: string;
  readonly level: number;
  readonly maxLevel: number;
  readonly currentLevelExp: number;
  readonly levelUpExp: number;
  readonly manaCost: number;
}

export interface UIMagicSlot {
  readonly index: number;
  readonly magic: UIMagicData | null;
}

export interface UIMagicState {
  readonly storeMagics: readonly (UIMagicSlot | null)[];
  readonly bottomMagics: readonly (UIMagicSlot | null)[];
  readonly xiuLianMagic: UIMagicSlot | null;
}

// ============= 对话系统 =============

export type UIDialogState = Readonly<DialogGuiState>;

export type UISelectionOption = Readonly<SelectionOptionData>;

export type UISelectionState = Readonly<
  Omit<SelectionGuiState, "options"> & {
    options: readonly UISelectionOption[];
  }
>;

export type UIMultiSelectionState = Readonly<
  Omit<MultiSelectionGuiState, "options" | "selectedIndices"> & {
    options: readonly UISelectionOption[];
    selectedIndices: readonly number[];
  }
>;

// ============= 面板可见性 =============

export type UIPanelVisibility = Readonly<PanelState>;

export type UIPanelName = keyof UIPanelVisibility;

// ============= 商店系统 =============

export interface UIShopItem {
  readonly good: UIGoodData;
  readonly price: number;
  readonly count: number;
}

export interface UIShopState {
  readonly isOpen: boolean;
  readonly items: readonly (UIShopItem | null)[];
  readonly buyPercent: number;
  readonly numberValid: boolean;
  readonly canSellSelfGoods: boolean;
}

// ============= 消息通知 =============

export interface UIMessageState {
  readonly text: string;
  readonly isVisible: boolean;
}

// ============= 备忘录 =============

export interface UIMemoEntry {
  readonly id: number;
  readonly text: string;
}

export interface UIMemoState {
  readonly memos: readonly UIMemoEntry[];
}

// ============= 计时器 =============

export interface UITimerState {
  readonly isRunning: boolean;
  readonly seconds: number;
  readonly isHidden: boolean;
}

// ============= NPC 血条 =============

export interface UINpcLifeBarState {
  readonly isVisible: boolean;
  readonly name: string;
  readonly life: number;
  readonly lifeMax: number;
}

// ============= 小地图 =============

export interface UICharacterMarker {
  readonly x: number;
  readonly y: number;
  readonly type: "player" | "partner" | "enemy" | "neutral";
}

export interface UIMinimapState {
  readonly isVisible: boolean;
  readonly mapName: string;
  readonly mapDisplayName: string;
  readonly playerPosition: Vector2;
  readonly cameraPosition: Vector2;
  readonly characters: readonly UICharacterMarker[];
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly mapData: unknown; // JxqyMapData, but kept as unknown to avoid engine dependency
}

// ============= 视频播放 =============

export interface UIVideoState {
  readonly isPlaying: boolean;
  readonly videoFile: string | null;
}

// ============= 存档系统 =============

export interface UISaveSlotInfo {
  readonly index: number;
  readonly isEmpty: boolean;
  readonly playerName?: string;
  readonly mapName?: string;
  readonly playTime?: string;
  readonly saveTime?: string;
}

export interface UISaveLoadState {
  readonly isVisible: boolean;
  readonly canSave: boolean;
  readonly slots: readonly UISaveSlotInfo[];
}

// ============= 完整 UI 快照 =============

export interface UISnapshot {
  readonly player: UIPlayerState | null;
  readonly panels: UIPanelVisibility;
  readonly dialog: UIDialogState;
  readonly selection: UISelectionState;
  readonly multiSelection: UIMultiSelectionState;
  readonly message: UIMessageState;
  readonly goods: UIGoodsState;
  readonly magic: UIMagicState;
  readonly shop: UIShopState;
  readonly memo: UIMemoState;
  readonly timer: UITimerState;
  readonly npcLifeBar: UINpcLifeBarState;
  readonly minimap: UIMinimapState;
  readonly video: UIVideoState;
  readonly saveLoad: UISaveLoadState;
}

// ============= UI 动作 (UI → 引擎) =============

export type UIEquipSlotName = "head" | "neck" | "body" | "back" | "hand" | "wrist" | "foot";

export type UIAction =
  // 面板控制
  | { type: "TOGGLE_PANEL"; panel: UIPanelName }
  // 对话
  | { type: "DIALOG_CLICK" }
  | { type: "DIALOG_SELECT"; selection: number }
  // 选择
  | { type: "SELECTION_CHOOSE"; index: number }
  | { type: "MULTI_SELECTION_TOGGLE"; index: number }
  // 物品
  | { type: "USE_ITEM"; index: number }
  | { type: "EQUIP_ITEM"; fromIndex: number; toSlot: UIEquipSlotName }
  | { type: "UNEQUIP_ITEM"; slot: UIEquipSlotName }
  | { type: "SWAP_ITEMS"; fromIndex: number; toIndex: number }
  | { type: "USE_BOTTOM_ITEM"; slotIndex: number }
  | { type: "SWAP_EQUIP_SLOTS"; fromSlot: UIEquipSlotName; toSlot: UIEquipSlotName }
  // 武功
  | { type: "USE_MAGIC"; magicIndex: number }
  | { type: "USE_MAGIC_BY_BOTTOM"; bottomSlot: number }
  | { type: "SET_CURRENT_MAGIC"; magicIndex: number }
  | { type: "SET_CURRENT_MAGIC_BY_BOTTOM"; bottomIndex: number }
  | { type: "SWAP_MAGIC"; fromIndex: number; toIndex: number }
  | { type: "ASSIGN_MAGIC_TO_BOTTOM"; magicIndex: number; bottomSlot: number }
  | { type: "SET_XIULIAN_MAGIC"; magicIndex: number }
  // 商店
  | { type: "BUY_ITEM"; shopIndex: number }
  | { type: "SELL_ITEM"; bagIndex: number }
  | { type: "CLOSE_SHOP" }
  // 存档
  | { type: "SHOW_SAVE_LOAD"; visible: boolean }
  // 小地图
  | { type: "MINIMAP_CLICK"; worldX: number; worldY: number }
  // 视频
  | { type: "VIDEO_END" }
  // 系统
  | { type: "SHOW_MESSAGE"; text: string }
  | { type: "SHOW_SYSTEM"; visible: boolean }
  | { type: "EXIT_GAME" };

// ============= 状态订阅接口 =============

/**
 * UI 状态订阅者接口
 * UI 层实现此接口来接收引擎状态变化
 */
export interface UIStateSubscriber {
  onPlayerChange?(state: UIPlayerState | null): void;
  onPanelsChange?(panels: UIPanelVisibility): void;
  onDialogChange?(dialog: UIDialogState): void;
  onSelectionChange?(selection: UISelectionState): void;
  onMultiSelectionChange?(selection: UIMultiSelectionState): void;
  onMessageChange?(message: UIMessageState): void;
  onGoodsChange?(goods: UIGoodsState): void;
  onMagicChange?(magic: UIMagicState): void;
  onShopChange?(shop: UIShopState): void;
  onMemoChange?(memo: UIMemoState): void;
  onTimerChange?(timer: UITimerState): void;
  onNpcLifeBarChange?(npcLifeBar: UINpcLifeBarState): void;
  onMinimapChange?(minimap: UIMinimapState): void;
  onVideoChange?(video: UIVideoState): void;
  onSaveLoadChange?(saveLoad: UISaveLoadState): void;
}

// ============= UIBridge 接口 =============

/**
 * UI 桥接器接口
 * 这是 UI 层与引擎交互的唯一入口
 */
export interface UIBridge {
  /**
   * 订阅状态变化
   * @returns 取消订阅函数
   */
  subscribe(subscriber: Partial<UIStateSubscriber>): () => void;

  /**
   * 派发 UI 动作
   */
  dispatch(action: UIAction): void;

  /**
   * 获取当前状态快照（用于初始化）
   */
  getSnapshot(): UISnapshot;

  /**
   * 请求刷新指定状态
   */
  requestRefresh(state: "goods" | "magic" | "shop" | "memo" | "all"): void;
}
