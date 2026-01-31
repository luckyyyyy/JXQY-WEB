/**
 * UI components exports
 */

// Font configuration
export * from "@/engine/gui/fonts";
// ASF Animated Sprite - 高性能动画精灵组件
export { AsfAnimatedSprite } from "./AsfAnimatedSprite";
export type { BottomSlotDragData } from "./BottomGui";
export { BottomGui } from "./BottomGui";
export type { ShopItemData } from "./BuyGui";
export { BuyGui } from "./BuyGui";
export { BottomStateGui } from "./BottomStateGui";
// Debug Panel
export { DebugPanel } from "./DebugPanel/index";
export type { DebugPanelProps, LoadedResources, PlayerStats as DebugPlayerStats, ScriptHistoryItem, ScriptInfo } from "./DebugPanel/types";
export { DialogUI } from "./DialogUI";
export type { DragData, EquipItemData, EquipSlots, EquipSlotType } from "./EquipGui";
export { EquipGui, equipPositionToSlotType, slotTypeToEquipPosition } from "./EquipGui";
// Game Cursor - 自定义鼠标指针
export { GameCursor, GameCursorContainer } from "./GameCursor";
export type { GoodItemData } from "./GoodsGui";
export { GoodsGui } from "./GoodsGui";
// Hooks
export * from "./hooks";
export type { TooltipState } from "./ItemTooltip";
// Item Tooltip
export { defaultTooltipState, ItemTooltip } from "./ItemTooltip";
export type { CharacterMarker } from "./LittleMapGui";
export { LittleMapGui } from "./LittleMapGui";
export type { MagicDragData, MagicItem } from "./MagicGui";
export { MagicGui } from "./MagicGui";
export type { MagicTooltipState } from "./MagicTooltip";
// Magic Tooltip
export { defaultMagicTooltipState, MagicTooltip } from "./MagicTooltip";
export { MemoGui } from "./MemoGui";
export { MessageGui } from "./MessageGui";
// NPC Equipment GUI - NPC装备界面
export type { EquipSlots as NpcEquipSlots, DragData as NpcDragData } from "./NpcEquipGui";
export { NpcEquipGui } from "./NpcEquipGui";
// NPC Life Bar - 显示鼠标悬停NPC的血条
export { NpcLifeBar } from "./NpcLifeBar";
// ScrollBar - 滚动条组件
export { ScrollBar } from "./ScrollBar";
export { SelectionMultipleUI } from "./SelectionMultipleUI";
export { SelectionUI } from "./SelectionUI";
export type { LoadGameModalProps, SaveLoadPanelProps, SettingsPanelProps } from "./SidePanel";

// Side Panels (for left sidebar menu) and audio settings
export {
  LoadGameModal,
  loadAudioSettings,
  SaveLoadPanel,
  SettingsPanel,
  saveAudioSettings,
} from "./SidePanel";
export type { PlayerStats } from "./StateGui";
// Panel GUIs - 对应 C# 的各个面板
export { StateGui } from "./StateGui";
export { SystemGui } from "./SystemGui";
// SaveLoad GUI - 存档/读档界面 (游戏内)
export { SaveLoadGui } from "./SaveLoadGui";
// Timer UI - 计时器显示
export { TimerGui } from "./TimerGui";
export { TitleGui } from "./TitleGui";
// TitleSettingsModal - 标题界面设置弹窗
export type { TitleSettingsModalProps } from "./TitleSettingsModal";
export { TitleSettingsModal } from "./TitleSettingsModal";
export { TopGui } from "./TopGui";
// Video Player - 视频播放器
export { VideoPlayer } from "./VideoPlayer";
export type { XiuLianMagic } from "./XiuLianGui";
export { XiuLianGui } from "./XiuLianGui";
