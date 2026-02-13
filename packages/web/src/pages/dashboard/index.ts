/**
 * Dashboard 模块导出
 */

// 布局和基础组件
export { DashboardLayout } from "./DashboardLayout";
export { DashboardHome } from "./DashboardHome";
export { DashboardProvider, useDashboard } from "./DashboardContext";
export { ActivityBar } from "./ActivityBar";
export { SidebarContent } from "./SidebarContent";
export { DashboardHeader } from "./DashboardHeader";
export { GameSelector, GameSelectorWithData } from "./GameSelector";
export { DashboardIcons, Icon } from "./icons";
export type { IconName } from "./icons";
export * from "./types";

// 游戏编辑模块
export { GameGlobalConfigPage } from "./modules/gameConfig";

// 通用编辑器
export { ListEditorPage, DetailEditorPage } from "./modules/ListEditorPage";

// NPC 编辑
export { NpcListPage, NpcDetailPage } from "./modules/npc";

// 物品编辑
export { GoodsListPage, GoodsDetailPage } from "./modules/goods/GoodsPages";

// 商店编辑
export { ShopsListPage, ShopDetailPage } from "./modules/ShopsPages";

// 武功编辑
export { MagicListPage, MagicDetailPage } from "./modules/magic";

// 等级配置
export { LevelListPage, LevelDetailPage, StrengthConfigPage } from "./modules/level";

// 脚本编辑 (ScriptsPage 已移除)

// 场景编辑
export {
  ScenesHomePage,
  SceneDetailPage,
  ImportScenesModal,
} from "./modules/scenes";

// 资源管理
export {
  ResourcesHomePage,
  ImagesPage,
  MusicPage,
  SoundsPage,
  AsfResourcesPage,
} from "./modules/ResourcesPages";

// 数据统计
export {
  StatisticsHomePage,
  PlayerDataPage,
  PlayerSavesPage,
} from "./modules/StatisticsPages";
