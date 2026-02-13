/**
 * Dashboard 侧边栏面板
 * 根据当前选中的模块显示不同的子菜单
 *
 * 组件拆分到 ./sidebar/ 目录下：
 * - SidebarShared: 共享组件（SidebarPanel, TreeView, ListPanel）和树数据
 * - MagicListPanel: 武功列表面板
 * - LevelListPanel: 等级配置面板
 * - ShopListPanel: 商店列表面板
 * - GoodsListPanel: 物品列表面板
 * - NpcListPanel: NPC 列表面板
 * - ObjListPanel: Object 列表面板
 * - ModuleNav: 共享的分组导航组件（游戏编辑 + 游戏模块共用）
 */
import { useParams, useLocation } from "react-router-dom";
import { SidebarPanel, TreeView, statisticsTree } from "./sidebar/SidebarShared";
import { SectionedModuleNav, type ModuleNavSection } from "./sidebar/ModuleNav";
import { GameModulesPanel } from "./sidebar/GameModulesPanel";
import { PlayerListPanel } from "./sidebar/PlayerListPanel";
import { SceneListPanel } from "./sidebar/SceneListPanel";

/** 游戏编辑分组导航 */
const gameEditSections: ModuleNavSection[] = [
  {
    label: "基础信息",
    accent: "amber",
    items: [
      { id: "basic", label: "基础信息", path: "basic" },
      { id: "newgame", label: "新游戏脚本", path: "newgame" },
    ],
  },
  {
    label: "游戏设置",
    accent: "blue",
    items: [
      { id: "player-speed", label: "移动速度", path: "player-speed" },
      { id: "player-thew", label: "体力消耗", path: "player-thew" },
      { id: "player-restore", label: "自然恢复", path: "player-restore" },
      { id: "player-combat", label: "战斗参数", path: "player-combat" },
      { id: "magic-exp", label: "武功经验", path: "magic-exp" },
    ],
  },
  {
    label: "掉落系统",
    accent: "emerald",
    items: [
      { id: "drop-probability", label: "掉落概率", path: "drop-probability" },
      { id: "drop-equip", label: "装备等级映射", path: "drop-equip" },
      { id: "drop-money", label: "金钱掉落", path: "drop-money" },
      { id: "drop-drug", label: "药品掉落", path: "drop-drug" },
      { id: "drop-boss", label: "Boss 加成", path: "drop-boss" },
    ],
  },
];

export function SidebarContent() {
  const { gameId } = useParams();
  const location = useLocation();

  const basePath = gameId ? `/dashboard/${gameId}` : "/dashboard";

  // 根据当前路径确定显示哪个面板
  const pathParts = location.pathname.split("/").filter(Boolean);
  const currentModule = pathParts[2] || "game"; // dashboard/gameId/module

  switch (currentModule) {
    case "game":
      return (
        <SidebarPanel title="游戏编辑">
          <SectionedModuleNav sections={gameEditSections} basePath={`${basePath}/game`} />
        </SidebarPanel>
      );

    case "player":
      return <PlayerListPanel basePath={`${basePath}/player`} />;

    case "game-modules":
    case "npcs":
    case "magic":
    case "goods":
    case "objs":
    case "shops":
    case "levels":
    case "talks":
      return <GameModulesPanel basePath={basePath} />;

    case "scenes":
      return <SceneListPanel basePath={`${basePath}/scenes`} />;

    case "resources":
      // 资源管理器不需要子菜单，直接显示文件管理器
      return null;

    case "statistics":
      return (
        <SidebarPanel title="数据统计">
          <TreeView nodes={statisticsTree} basePath={`${basePath}/statistics`} />
        </SidebarPanel>
      );

    default:
      return (
        <SidebarPanel title="Dashboard">
          <div className="px-4 py-2 text-sm text-[#858585]">
            请选择一个模块
          </div>
        </SidebarPanel>
      );
  }
}
