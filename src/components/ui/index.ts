/**
 * UI components exports
 */
export { DialogUI } from "./DialogUI";
export { SelectionUI } from "./SelectionUI";
export { TopGui } from "./TopGui";
export { BottomGui } from "./BottomGui";
export type { BottomSlotDragData } from "./BottomGui";
export { BottomStateGui } from "./BottomStateGui";
export { TitleGui } from "./TitleGui";
export { MessageGui } from "./MessageGui";

// Panel GUIs - 对应 C# 的各个面板
export { StateGui } from "./StateGui";
export type { PlayerStats } from "./StateGui";
export { EquipGui, equipPositionToSlotType, slotTypeToEquipPosition } from "./EquipGui";
export type { EquipItemData, EquipSlots, EquipSlotType, DragData } from "./EquipGui";
export { GoodsGui } from "./GoodsGui";
export type { GoodItemData } from "./GoodsGui";
export { MagicGui } from "./MagicGui";
export type { MagicItem, MagicDragData } from "./MagicGui";
export { MemoGui } from "./MemoGui";
export { SystemGui } from "./SystemGui";
export { XiuLianGui } from "./XiuLianGui";
export type { XiuLianMagic } from "./XiuLianGui";

// Item Tooltip
export { ItemTooltip, defaultTooltipState } from "./ItemTooltip";
export type { TooltipState } from "./ItemTooltip";

// Magic Tooltip
export { MagicTooltip, defaultMagicTooltipState } from "./MagicTooltip";
export type { MagicTooltipState } from "./MagicTooltip";

// Mission/Quest UI
export { CurrentMissionHint } from "./CurrentMissionHint";

// System Menu Modal (unified save/load/settings interface)
export { SystemMenuModal, loadAudioSettings, saveAudioSettings } from "./SystemMenuModal";
export type { SystemMenuModalProps, SystemMenuTab } from "./SystemMenuModal";

// Side Panels (for left sidebar menu)
export { SaveLoadPanel, SettingsPanel } from "./SidePanel";
export type { SaveLoadPanelProps, SettingsPanelProps } from "./SidePanel";

// Debug Panel
export { DebugPanel } from "./DebugPanel";

// Game Cursor - 自定义鼠标指针
export { GameCursor, GameCursorContainer } from "./GameCursor";

// ASF Animated Sprite - 高性能动画精灵组件
export { AsfAnimatedSprite } from "./AsfAnimatedSprite";

// ScrollBar - 滚动条组件
export { ScrollBar } from "./ScrollBar";

// Hooks
export * from "./hooks";

// Font configuration
export * from "../../engine/gui/fonts";