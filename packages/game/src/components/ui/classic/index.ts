/**
 * Classic UI components - ASF-based retro style
 * 经典复古风格游戏 UI（基于 ASF 精灵）
 */

// ASF Animated Sprite - 高性能动画精灵组件
export { AsfAnimatedSprite } from "./AsfAnimatedSprite";
// Bottom GUI
export type { BottomSlotDragData } from "./BottomGui";
export { BottomGui } from "./BottomGui";
// Bottom State GUI
export { BottomStateGui } from "./BottomStateGui";
// Buy GUI
export type { ShopItemData } from "./BuyGui";
export { BuyGui } from "./BuyGui";

// Dialog UI
export { DialogUI } from "./DialogUI";
// Equip GUI
export type { DragData, EquipItemData, EquipSlots, EquipSlotType } from "./EquipGui";
export { EquipGui, equipPositionToSlotType, slotTypeToEquipPosition } from "./EquipGui";
// Game Cursor
export { GameCursor, GameCursorContainer } from "./GameCursor";
// Good GUI
export type { GoodItemData } from "./GoodsGui";
export { GoodsGui } from "./GoodsGui";
export {
  destroyGameCursor,
  disableGameCursor,
  enableGameCursor,
  initGameCursor,
  isGameCursorEnabled,
  isGameCursorInitialized,
} from "./gameCursorManager";
// Hooks
export * from "./hooks";
// Item Tooltip
export type { TooltipState } from "./ItemTooltip";
export { defaultTooltipState, ItemTooltip } from "./ItemTooltip";
// Little Head GUI (Partner portraits)
export type { PartnerInfo } from "./LittleHeadGui";
export { LittleHeadGui } from "./LittleHeadGui";
// Little Map GUI
export type { CharacterMarker } from "./LittleMapGui";
export { LittleMapGui } from "./LittleMapGui";
// Magic GUI
export type { MagicDragData, MagicItem } from "./MagicGui";
export { MagicGui } from "./MagicGui";
// Magic Tooltip
export type { MagicTooltipState } from "./MagicTooltip";
export { defaultMagicTooltipState, MagicTooltip } from "./MagicTooltip";
// Memo GUI
export { MemoGui } from "./MemoGui";
// Message GUI
export { MessageGui } from "./MessageGui";
// NPC Equipment GUI
export type { DragData as NpcDragData, EquipSlots as NpcEquipSlots } from "./NpcEquipGui";
export { NpcEquipGui } from "./NpcEquipGui";
// NPC Life Bar
export { NpcLifeBar } from "./NpcLifeBar";
// ScrollBar
export { ScrollBar } from "./ScrollBar";
export { SelectionMultipleUI } from "./SelectionMultipleUI";
// Selection UI
export { SelectionUI } from "./SelectionUI";
// State GUI
export type { PlayerStats } from "./StateGui";
export { StateGui } from "./StateGui";
// System GUI
export { SystemGui } from "./SystemGui";
// Timer GUI
export { TimerGui } from "./TimerGui";
// Title GUI
export { TitleGui } from "./TitleGui";
// Top GUI
export { TopGui } from "./TopGui";
// Video Player
export { VideoPlayer } from "./VideoPlayer";
// XiuLian GUI
export type { XiuLianMagic } from "./XiuLianGui";
export { XiuLianGui } from "./XiuLianGui";
