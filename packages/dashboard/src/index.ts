/**
 * Dashboard 模块导出
 */

export { ActivityBar } from "./ActivityBar";
// 主应用
export { DashboardApp } from "./DashboardApp";
export { DashboardProvider, useDashboard } from "./DashboardContext";
export { DashboardHeader } from "./DashboardHeader";
export { DashboardHome } from "./DashboardHome";
// 布局和基础组件
export { DashboardLayout } from "./DashboardLayout";
export { GameSelector, GameSelectorWithData } from "./GameSelector";
export type { IconName } from "./icons";
export { DashboardIcons, Icon } from "./icons";
// 游戏编辑模块
export { GameGlobalConfigPage } from "./modules/gameConfig";
// 物品编辑
export { GoodsDetailPage, GoodsListPage } from "./modules/goods/GoodsPages";
// 通用编辑器
export { DetailEditorPage, ListEditorPage } from "./modules/ListEditorPage";
// 等级配置
export { LevelDetailPage, LevelListPage, StrengthConfigPage } from "./modules/level";
// 武功编辑
export { MagicDetailPage, MagicListPage } from "./modules/magic";
// NPC 编辑
export { NpcDetailPage, NpcListPage } from "./modules/npc";

// 商店编辑
export { ShopDetailPage, ShopsListPage } from "./modules/ShopsPages";
export { SidebarContent } from "./SidebarContent";
export * from "./types";

// 脚本编辑 (ScriptsPage 已移除)

// 资源管理
export {
  AsfResourcesPage,
  ImagesPage,
  MusicPage,
  ResourcesHomePage,
  SoundsPage,
} from "./modules/ResourcesPages";
// 数据统计
export {
  PlayerDataPage,
  PlayerSavesPage,
  StatisticsHomePage,
} from "./modules/StatisticsPages";
// 场景编辑
export {
  ImportScenesModal,
  SceneDetailPage,
  ScenesHomePage,
} from "./modules/scenes";
